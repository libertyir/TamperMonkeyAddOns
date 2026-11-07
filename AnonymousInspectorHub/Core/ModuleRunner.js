(function (root) {
    "use strict";

    class ModuleRunner {
        constructor(kernel) {
            if (!kernel) {
                throw new Error("ModuleRunner requires a Kernel instance.");
            }

            this.kernel = kernel;
            this.scannerQueue = [];
            this.nextScannerIndex = 0;
            this.completedScanners = 0;
            this.failedScanners = 0;
            this.activeScannerId = null;
            this.scanPromise = null;
            this.scanPaused = false;
            this.scanStatus = "idle";
        }

        async run(moduleIds = [], options = {}) {
            const kernel = this.kernel;
            const manager = kernel.moduleManager;

            if (!manager || !kernel.uiManager) {
                throw new Error(
                    "ModuleRunner requires ModuleManager and UIManager."
                );
            }

            const ids = [...new Set(
                moduleIds.filter(id => typeof id === "string")
            )];

            const disabled = new Set(
                kernel.kernelConfig.getDisabledModules()
            );

            const disabledActiveIds = manager.getActiveIds().filter(
                id => disabled.has(id)
            );

            for (const id of disabledActiveIds) {
                await manager.destroy(id);
            }

            kernel.uiManager.showProgress("Loading modules...");

            const loadResults = await Promise.allSettled(
                ids.map(id => manager.load(id))
            );

            const loadedIds = [];
            const failedLoads = [];

            for (let index = 0; index < loadResults.length; index++) {
                const result = loadResults[index];

                if (result.status === "fulfilled") {
                    loadedIds.push(ids[index]);
                } else {
                    failedLoads.push({
                        id: ids[index],
                        error: result.reason
                    });

                    console.error(
                        "[Anonymous Inspector] Module load failed:",
                        ids[index],
                        result.reason
                    );
                }
            }

            const descriptorIds = new Set(
                loadedIds.filter(id => manager.isDescriptor(id))
            );

            const legacyIds = loadedIds.filter(
                id => !descriptorIds.has(id)
            );

            if (legacyIds.length && !options.loadOnly) {
                await manager.initializeMany(
                    legacyIds,
                    {
                        concurrency: kernel.config.maxConcurrentModules
                    }
                );
            }

            const availableModules = [];

            for (const descriptorId of descriptorIds) {
                const descriptor = manager.getDescriptor(descriptorId);

                if (!descriptor) {
                    continue;
                }

                for (const component of descriptor.components) {
                    if (component.type !== "module") {
                        continue;
                    }

                    const ModuleClass = manager.get(component.id);

                    if (
                        !ModuleClass ||
                        typeof ModuleClass.providerId !== "string" ||
                        !ModuleClass.providerId.trim()
                    ) {
                        continue;
                    }

                    const scannerId = component.id.replace(/_Viewer$/, "_Scanner");
                    const ScannerClass = manager.get(scannerId);

                    let scopeInfo = null;

                    if (
                        ScannerClass &&
                        typeof ScannerClass.scan === "undefined" &&
                        typeof ScannerClass.prototype?.scan !== "function"
                    ) {
                        scopeInfo = null;
                    } else if (ScannerClass) {
                        const scopes = await manager.getModuleScopes(
                            scannerId,
                            ScannerClass
                        );

                        scopeInfo = scopes[0] || null;
                    }

                    const context = {
                        url: location.href,
                        currentUrl: location.href,
                        origin: location.origin,
                        ...(scopeInfo?.context || {}),
                        directoryUrl: scopeInfo?.scope,
                        scope: scopeInfo?.scope
                    };

                    if (
                        ModuleClass.autoInitialize !== true &&
                        ScannerClass &&
                        scopeInfo
                    ) {
                        const ttl = await manager.getEffectiveTTL(
                            scannerId,
                            ScannerClass
                        );

                        const cached = await this.getCachedScannerResult(
                            scannerId,
                            scopeInfo.scope,
                            ttl,
                            manager
                        );

                        if (
                            !cached ||
                            !this.isCachedResultValid(
                                cached,
                                scannerId,
                                scopeInfo.scope,
                                ttl,
                                manager
                            )
                        ) {
                            continue;
                        }
                    }

                    try {
                        const instance = ModuleClass.autoInitialize === true
                            ? await manager.initialize(
                                component.id,
                                context
                            )
                            : await manager.initializeFromProvider(
                                component.id,
                                context
                            );

                        if (instance) {
                            availableModules.push(component.id);
                        }
                    } catch (error) {
                        console.warn(
                            "[Anonymous Inspector] Module data could not be restored:",
                            component.id,
                            error
                        );
                    }
                }
            }

            await this.buildScannerQueue([...descriptorIds]);

            kernel.uiManager.refreshMenu();
            kernel.uiManager.hideProgress();
            kernel.uiManager.setScanState({
                status: "idle"
            });

            return {
                loaded: loadedIds.length,
                failed: failedLoads.length,
                failedLoads,
                availableModules,
                scanners: this.scannerQueue.length
            };
        }

        async getCachedScannerResult(
            scannerId,
            scope,
            ttl,
            manager,
            options = {}
        ) {
            const currentKey = [
                "module-result",
                scannerId,
                encodeURIComponent(scope)
            ].join(":");

            const currentRecord = await manager.Framework.Storage.getMetadata(
                currentKey
            );

            if (this.isCachedResultValid(
                currentRecord,
                scannerId,
                scope,
                ttl,
                manager
            )) {
                return currentRecord;
            }

            const legacyModuleId = scannerId.replace(/_Scanner$/, "_Viewer");

            if (legacyModuleId === scannerId) {
                return null;
            }

            const legacyModuleClass = manager.get(legacyModuleId);
            const legacyTTL = await manager.getEffectiveTTL(
                legacyModuleId,
                legacyModuleClass || manager.get(scannerId)
            );

            const legacyRecord = await manager.getScanRecord(
                legacyModuleId,
                scope
            );

            if (!manager.isScanRecordValid(legacyRecord, legacyTTL)) {
                return null;
            }

            if (legacyRecord.status === "unavailable") {
                return {
                    moduleId: scannerId,
                    scope,
                    schemaVersion: 1,
                    createdAt: legacyRecord.completedAt,
                    data: null,
                    unavailable: true
                };
            }

            if (!legacyRecord.resultGuid) {
                return null;
            }

            const legacyResult = await manager.Framework.Storage.getResult(
                legacyRecord.resultGuid
            );

            if (
                !legacyResult ||
                !legacyResult.data ||
                typeof legacyResult.data !== "object"
            ) {
                return null;
            }

            const migratedRecord = {
                moduleId: scannerId,
                scope,
                schemaVersion: 1,
                createdAt: legacyResult.createdAt ||
                    legacyRecord.completedAt,
                data: {
                    ...legacyResult.data,
                    directoryUrl: scope
                }
            };

            if (options.persist !== false) {
                await manager.Framework.Storage.saveMetadata(
                    currentKey,
                    migratedRecord
                );
            }

            return migratedRecord;
        }

        isCachedResultValid(
            record,
            moduleId,
            scope,
            ttl,
            manager
        ) {
            if (
                !record ||
                record.moduleId !== moduleId ||
                record.scope !== scope ||
                record.schemaVersion !== 1
            ) {
                return false;
            }

            const isUnavailable = record.unavailable === true;

            if (
                !isUnavailable &&
                (
                    !record.data ||
                    typeof record.data !== "object" ||
                    record.data.directoryUrl !== scope
                )
            ) {
                return false;
            }

            if (ttl === "always") {
                return false;
            }

            if (ttl === "permanent") {
                return true;
            }

            const createdAt = Date.parse(
                record.createdAt ||
                record.data?.scannedAt ||
                ""
            );

            if (!Number.isFinite(createdAt)) {
                return false;
            }

            return Date.now() <
                createdAt + manager.getTTLMilliseconds(ttl);
        }

        async buildScannerQueue(
            descriptorIds = this.kernel.allowedModuleIds || [],
            options = {}
        ) {
            const manager = this.kernel.moduleManager;
            const queue = [];

            for (const descriptorId of descriptorIds) {
                const descriptor = manager.getDescriptor(descriptorId);

                if (!descriptor) {
                    continue;
                }

                for (const component of descriptor.components) {
                    if (component.type !== "module") {
                        continue;
                    }

                    const ScannerClass = manager.get(component.id);

                    if (
                        !ScannerClass ||
                        typeof ScannerClass.prototype?.scan !== "function"
                    ) {
                        continue;
                    }

                    const scopes = await manager.getModuleScopes(
                        component.id,
                        ScannerClass
                    );

                    for (const scopeInfo of scopes) {
                        const ttl = await manager.getEffectiveTTL(
                            component.id,
                            ScannerClass
                        );

                        const cached = await this.getCachedScannerResult(
                            component.id,
                            scopeInfo.scope,
                            ttl,
                            manager
                        );

                        const viewerClass = manager.get(
                            component.id.replace(/_Scanner$/, "_Viewer")
                        );
                        const providerId = viewerClass?.providerId ||
                            component.id.replace(/_Scanner$/, "_Provider");
                        const provider = manager.getProvider(providerId);

                        if (
                            !provider ||
                            typeof provider.shouldScan !== "function"
                        ) {
                            console.error(
                                "[Anonymous Inspector] Scanner provider is missing its scan gate:",
                                providerId
                            );
                            continue;
                        }

                        const shouldScan = await provider.shouldScan({
                            scannerId: component.id,
                            scope: scopeInfo.scope,
                            ttl,
                            ttlMilliseconds: manager.getTTLMilliseconds(ttl),
                            cachedRecord: cached,
                            force: options.force === true
                        });

                        if (!options.includeCached && !shouldScan) {
                            continue;
                        }

                        queue.push({
                            id: component.id,
                            context: {
                                ...scopeInfo.context,
                                url: location.href,
                                currentUrl: location.href,
                                origin: location.origin,
                                directoryUrl: scopeInfo.scope,
                                scope: scopeInfo.scope
                            }
                        });
                    }
                }
            }

            this.scannerQueue = queue;
            this.nextScannerIndex = 0;
            this.completedScanners = 0;
            this.failedScanners = 0;

            return queue;
        }

        async playScan() {
            if (this.scanPromise) {
                return this.scanPromise;
            }

            const currentPromise = (async () => {
                try {
                    this.scanPaused = false;
                    this.scanStatus = "preparing";

                    this.kernel.uiManager.setScanState({
                        status: "running"
                    });

                    if (!this.kernel.modulesStarted) {
                        await this.kernel.startModules();
                    }

                    if (this.scanPaused) {
                        this.scanStatus = "paused";
                        this.kernel.uiManager.setScanState({
                            status: "paused"
                        });

                        return {
                            status: "paused",
                            completed: this.completedScanners,
                            total: this.scannerQueue.length
                        };
                    }

                    await this.buildScannerQueue();

                    if (this.scanPaused) {
                        this.scanStatus = "paused";
                        this.kernel.uiManager.setScanState({
                            status: "paused"
                        });

                        return {
                            status: "paused",
                            completed: this.completedScanners,
                            total: this.scannerQueue.length
                        };
                    }

                    if (!this.scannerQueue.length) {
                        this.scanStatus = "completed";
                        this.kernel.uiManager.setScanState({
                            status: "completed"
                        });
                        this.kernel.uiManager.hideProgress();

                        return {
                            status: "completed",
                            completed: 0,
                            total: 0
                        };
                    }

                    this.scanStatus = "running";
                    this.kernel.siteIntelligenceService?.resumeScanning?.();

                    this.kernel.uiManager.setScanState({
                        status: "running"
                    });

                    return await this.processScannerQueue();

                } finally {
                    if (this.scanPromise === currentPromise) {
                        this.scanPromise = null;
                    }
                }
            })();

            this.scanPromise = currentPromise;

            return currentPromise;
        }

        async initializeViewerForScanner(item) {
            const manager = this.kernel.moduleManager;

            for (const descriptorId of this.kernel.allowedModuleIds || []) {
                const descriptor = manager.getDescriptor(descriptorId);

                if (!descriptor) {
                    continue;
                }

                for (const component of descriptor.components) {
                    if (
                        component.type !== "module" ||
                        !component.id.endsWith("_Viewer") ||
                        component.id.replace(/_Viewer$/, "_Scanner") !== item.id
                    ) {
                        continue;
                    }

                    try {
                        await manager.initializeFromProvider(
                            component.id,
                            item.context
                        );
                    } catch (error) {
                        console.warn(
                            "[Anonymous Inspector] Viewer result could not be restored:",
                            component.id,
                            error
                        );
                    }

                    this.kernel.uiManager.refreshMenu();
                }
            }
        }

        async processScannerQueue() {
            const manager = this.kernel.moduleManager;
            const ui = this.kernel.uiManager;
            const total = this.scannerQueue.length;

            ui.showProgress("Preparing website scan...");

            while (
                !this.scanPaused &&
                this.nextScannerIndex < total
            ) {
                const item = this.scannerQueue[this.nextScannerIndex];
                this.activeScannerId = item.id;

                ui.setProgress({
                    total,
                    completed: this.completedScanners,
                    failed: this.failedScanners,
                    id: item.id,
                    phase: "started"
                });

                try {
                    await manager.startScanner(
                        item.id,
                        item.context
                    );

                    if (!this.scanPaused) {
                        await this.initializeViewerForScanner(item);
                    }
                } catch (error) {
                    if (!this.scanPaused) {
                        this.failedScanners++;

                        console.error(
                            "[Anonymous Inspector] Scanner failed:",
                            item.id,
                            error
                        );
                    }
                }

                this.activeScannerId = null;

                if (this.scanPaused) {
                    break;
                }

                this.nextScannerIndex++;
                this.completedScanners++;

                ui.setProgress({
                    total,
                    completed: this.completedScanners,
                    failed: this.failedScanners,
                    id: item.id,
                    phase: "completed"
                });
            }

            if (this.scanPaused) {
                this.scanStatus = "paused";

                ui.setScanState({
                    status: "paused"
                });

                ui.showProgress(
                    "Paused: " +
                    this.completedScanners +
                    " / " +
                    total +
                    " scanners completed"
                );

                return {
                    status: "paused",
                    completed: this.completedScanners,
                    total
                };
            }

            this.scanStatus = "completed";

            ui.setScanState({
                status: "completed"
            });

            ui.hideProgress();

            return {
                status: "completed",
                completed: this.completedScanners,
                failed: this.failedScanners,
                total
            };
        }

        async stopScan() {
            if (
                ![
                    "running",
                    "preparing"
                ].includes(this.scanStatus) &&
                !this.scanPromise
            ) {
                return false;
            }

            this.scanPaused = true;
            this.scanStatus = "paused";

            this.kernel.siteIntelligenceService?.pauseScanning?.();

            if (this.activeScannerId) {
                await this.kernel.moduleManager.stopScanner(
                    this.activeScannerId
                );
            }

            this.kernel.uiManager.setScanState({
                status: "paused"
            });

            if (this.scanPromise) {
                try {
                    await this.scanPromise;
                } catch {
                    // A stopped scanner must not block the pause operation.
                }
            }

            return true;
        }

        async refreshScan() {
            await this.stopScan();

            if (!this.kernel.modulesStarted) {
                await this.kernel.startModules();
            }

            await this.buildScannerQueue(
                this.kernel.allowedModuleIds || [],
                { includeCached: true }
            );

            this.scanStatus = "refreshing";

            this.kernel.uiManager.setScanState({
                status: "refreshing"
            });

            this.kernel.uiManager.showProgress(
                "Clearing this website's cache..."
            );

            await this.clearWebsiteCache();
            await this.buildScannerQueue();

            this.scanPaused = false;
            this.scanStatus = "idle";

            this.kernel.siteIntelligenceService?.resumeScanning?.();

            return this.playScan();
        }

        async clearWebsiteCache() {
            const kernel = this.kernel;
            const manager = kernel.moduleManager;
            const service = kernel.siteIntelligenceService;
            const origin = location.origin;

            if (service?.scanner) {
                await service.scanner.clearTemporaryCache(origin);
            }

            if (service?.repository) {
                await service.repository.clear();
            }

            for (const item of this.scannerQueue) {
                const resultKey = [
                    "module-result",
                    item.id,
                    encodeURIComponent(item.context.scope)
                ].join(":");

                await kernel.Framework.Storage.deleteMetadata(resultKey);

                const scanKey = manager.createScanMetadataKey(
                    item.id,
                    item.context.scope
                );

                await kernel.Framework.Storage.deleteMetadata(scanKey);
            }

            await kernel.Framework.Storage.deleteMetadata(
                "web-structure-tree:" + origin
            );

            const webStructure = manager.getActive(
                "WebStructureInspector",
                origin + "/"
            );

            if (webStructure?.store) {
                webStructure.store.records.clear();
                await webStructure.store.save();
            }
        }

        getScanStatus() {
            return {
                status: this.scanStatus,
                activeScannerId: this.activeScannerId,
                completed: this.completedScanners,
                failed: this.failedScanners,
                total: this.scannerQueue.length,
                nextIndex: this.nextScannerIndex,
                paused: this.scanPaused
            };
        }
    }

    root.AnonymousInspectorModuleRunner = ModuleRunner;
})(globalThis);
