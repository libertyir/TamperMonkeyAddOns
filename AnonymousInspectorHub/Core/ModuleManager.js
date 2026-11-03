
(function (root) {
    "use strict";

    class ModuleManager {
        constructor(options = {}) {
            this.baseUrl = options.baseUrl || "";
            this.requestText = options.requestText;
            this.Framework = options.Framework;
            this.BaseModule = options.BaseModule;

            this.gm = options.gm || {};

            this.modules = new Map();
            this.activeInstances = new Map();

            this.loadingPromises = new Map();
            this.initializingPromises = new Map();

            this.websiteGuid = null;

            this.defaultTTL = "7d";

            this.onError = options.onError || (
                (id, error) => {
                    console.error(
                        "[Anonymous Inspector] Module error:",
                        id,
                        error
                    );
                }
            );
        }

        // --------------------------------------------------
        // VALIDATION
        // --------------------------------------------------

        validateId(id) {
            if (
                typeof id !== "string" ||
                !/^[a-zA-Z0-9_-]+$/.test(id)
            ) {
                throw new Error("Invalid module ID.");
            }
        }

        validateModuleClass(ModuleClass) {
            if (typeof ModuleClass !== "function") {
                throw new Error("Invalid module class.");
            }

            if (
                !this.BaseModule ||
                !(ModuleClass.prototype instanceof this.BaseModule)
            ) {
                throw new Error(
                    "Module must extend BaseModule."
                );
            }
        }

        // --------------------------------------------------
        // MODULE REGISTRATION
        // --------------------------------------------------

        register(id, ModuleClass) {
            this.validateId(id);
            this.validateModuleClass(ModuleClass);

            this.modules.set(id, ModuleClass);

            return ModuleClass;
        }

        has(id) {
            return this.modules.has(id);
        }

        get(id) {
            return this.modules.get(id) || null;
        }

        getRegisteredIds() {
            return [...this.modules.keys()];
        }

        // --------------------------------------------------
        // SCAN POLICY
        // --------------------------------------------------

        normalizeTTL(value, fallback = this.defaultTTL) {
            const valid = new Set([
                "always",
                "1h",
                "6h",
                "12h",
                "1d",
                "3d",
                "7d",
                "30d",
                "90d",
                "permanent"
            ]);

            return valid.has(value)
                ? value
                : fallback;
        }

        getTTLMilliseconds(ttl) {
            const durations = {
                "1h": 60 * 60 * 1000,
                "6h": 6 * 60 * 60 * 1000,
                "12h": 12 * 60 * 60 * 1000,
                "1d": 24 * 60 * 60 * 1000,
                "3d": 3 * 24 * 60 * 60 * 1000,
                "7d": 7 * 24 * 60 * 60 * 1000,
                "30d": 30 * 24 * 60 * 60 * 1000,
                "90d": 90 * 24 * 60 * 60 * 1000
            };

            if (ttl === "permanent") {
                return Infinity;
            }

            if (ttl === "always") {
                return 0;
            }

            return durations[ttl] ?? durations[this.defaultTTL];
        }

        getScanPolicy(ModuleClass) {
            const declared = ModuleClass.scanPolicy || {};

            const scope = [
                "origin-root",
                "directory"
            ].includes(declared.scope)
                ? declared.scope
                : "origin-root";

            return {
                scope,
                defaultTTL: this.normalizeTTL(
                    declared.defaultTTL,
                    this.defaultTTL
                )
            };
        }

        async getModuleSettings(id) {
            try {
                return await this.Framework.Storage.getMetadata(
                    "module-settings:" + id
                ) || {};
            } catch (error) {
                console.error(
                    "[Anonymous Inspector] Module settings read failed:",
                    id,
                    error
                );

                return {};
            }
        }

        async setModuleTTL(id, ttl) {
            this.validateId(id);

            if (
                ttl !== null &&
                ![
                    "always",
                    "1h",
                    "6h",
                    "12h",
                    "1d",
                    "3d",
                    "7d",
                    "30d",
                    "90d",
                    "permanent"
                ].includes(ttl)
            ) {
                throw new Error("Invalid module TTL.");
            }

            const key = "module-settings:" + id;
            const current =
                await this.getModuleSettings(id);

            const updated = {
                ...current,
                ttl,
                moduleId: id,
                updatedAt: new Date().toISOString()
            };

            await this.Framework.Storage.saveMetadata(
                key,
                updated
            );

            return updated;
        }

        async getEffectiveTTL(id, ModuleClass) {
            const settings = await this.getModuleSettings(id);

            if (
                Object.prototype.hasOwnProperty.call(
                    settings,
                    "ttl"
                )
            ) {
                return this.normalizeTTL(
                    settings.ttl,
                    this.getScanPolicy(ModuleClass).defaultTTL
                );
            }

            return this.getScanPolicy(ModuleClass).defaultTTL;
        }

        // --------------------------------------------------
        // SCOPE RESOLUTION
        // --------------------------------------------------

        normalizeScope(scope) {
            const url = new URL(
                scope,
                root.location.href
            );

            url.search = "";
            url.hash = "";

            if (!url.pathname.endsWith("/")) {
                url.pathname += "/";
            }

            return url.href;
        }

        createDefaultScope(policy) {
            const origin = root.location.origin;

            if (policy.scope === "directory") {
                return this.normalizeScope(
                    new URL(".", root.location.href).href
                );
            }

            return this.normalizeScope(
                new URL("/", origin).href
            );
        }

        async getModuleScopes(id, ModuleClass) {
            const policy = this.getScanPolicy(ModuleClass);

            const context = {
                moduleId: id,
                websiteGuid: this.websiteGuid,
                origin: root.location.origin,
                currentUrl: root.location.href,
                currentDirectory: new URL(
                    ".",
                    root.location.href
                ).href,
                defaultScope: this.createDefaultScope(policy)
            };

            if (
                typeof ModuleClass.getScanScopes !== "function"
            ) {
                return [{
                    scope: context.defaultScope,
                    context
                }];
            }

            const declaredScopes =
                await ModuleClass.getScanScopes(context);

            if (!Array.isArray(declaredScopes)) {
                throw new Error(
                    "getScanScopes() must return an array."
                );
            }

            const unique = new Map();

            for (const item of declaredScopes) {
                const rawScope =
                    typeof item === "string"
                        ? item
                        : item && item.scope;

                if (typeof rawScope !== "string") {
                    continue;
                }

                const scope = this.normalizeScope(rawScope);

                unique.set(scope, {
                    scope,
                    context: {
                        ...context,
                        ...(typeof item === "object" ? item : {}),
                        scope
                    }
                });
            }

            return [...unique.values()];
        }

        createInstanceKey(id, scope) {
            return id + "::" + scope;
        }

        createScanMetadataKey(id, scope) {
            return [
                "scan",
                this.websiteGuid,
                id,
                encodeURIComponent(scope)
            ].join(":");
        }

        // --------------------------------------------------
        // SCAN CACHE
        // --------------------------------------------------

        async getScanRecord(id, scope) {
            try {
                const key = this.createScanMetadataKey(
                    id,
                    scope
                );

                return await this.Framework.Storage.getMetadata(
                    key
                );
            } catch (error) {
                console.error(
                    "[Anonymous Inspector] Scan cache read failed:",
                    id,
                    error
                );

                return null;
            }
        }

        isScanRecordValid(record, ttl) {
            if (
                !record ||
                !["success", "unavailable"].includes(record.status)
            ) {
                return false;
            }

            if (ttl === "always") {
                return false;
            }

            if (ttl === "permanent") {
                return true;
            }

            const duration = this.getTTLMilliseconds(ttl);
            const timestamp = Date.parse(record.completedAt);

            if (!Number.isFinite(timestamp)) {
                return false;
            }

            return Date.now() < timestamp + duration;
        }

        async saveScanRecord(id, scope, status, details = {}) {
            try {
                const key = this.createScanMetadataKey(
                    id,
                    scope
                );

                const record = {
                    moduleId: id,
                    websiteGuid: this.websiteGuid,
                    scope,
                    status,
                    completedAt: new Date().toISOString(),
                    resultGuid: details.resultGuid || null,
                    executionGuid: details.executionGuid || null
                };

                await this.Framework.Storage.saveMetadata(
                    key,
                    record
                );

                return record;

            } catch (error) {
                console.error(
                    "[Anonymous Inspector] Scan cache save failed:",
                    id,
                    error
                );

                return null;
            }
        }

        async restoreCachedInstance(
            id,
            ModuleClass,
            scopeInfo,
            record
        ) {
            if (!record.resultGuid) {
                return null;
            }

            if (
                typeof ModuleClass.prototype.restoreResult !==
                "function"
            ) {
                return null;
            }

            try {
                const result =
                    await this.Framework.Storage.getResult(
                        record.resultGuid
                    );

                if (!result || result.data === undefined) {
                    return null;
                }

                const instance = new ModuleClass();

                await instance.restoreResult(
                    result.data,
                    scopeInfo.context
                );

                if (!instance.available) {
                    instance.available = true;
                }

                this.activeInstances.set(
                    this.createInstanceKey(id, scopeInfo.scope),
                    instance
                );

                return instance;

            } catch (error) {
                console.error(
                    "[Anonymous Inspector] Cached result restore failed:",
                    id,
                    error
                );

                return null;
            }
        }

        // --------------------------------------------------
        // EXECUTION HISTORY
        // --------------------------------------------------

        createExecutionGuid() {
            if (
                root.crypto &&
                typeof root.crypto.randomUUID === "function"
            ) {
                return root.crypto.randomUUID();
            }

            return (
                Date.now().toString(36) +
                "-" +
                Math.random().toString(36).slice(2) +
                "-" +
                Math.random().toString(36).slice(2)
            );
        }

        async saveExecution(record) {
            try {
                if (
                    !this.Framework ||
                    !this.Framework.Storage
                ) {
                    throw new Error(
                        "Framework Storage is unavailable."
                    );
                }

                await this.Framework.Storage.saveExecution(record);

                return record;

            } catch (error) {
                console.error(
                    "[Anonymous Inspector] Execution history save failed:",
                    error
                );

                return null;
            }
        }

        async recordExecution(id, status, details = {}) {
            const completedTimestamp = Date.now();
            const completedAt = new Date(
                completedTimestamp
            ).toISOString();

            const startedTimestamp =
                details.startedTimestamp || completedTimestamp;

            const record = {
                guid: this.createExecutionGuid(),
                websiteGuid: this.websiteGuid,
                moduleId: id,
                scope: details.scope || null,
                status,
                startedAt: details.startedAt || completedAt,
                completedAt,
                duration: Math.max(
                    0,
                    completedTimestamp - startedTimestamp
                ),
                error: details.error
                    ? {
                        name: details.error.name || "Error",
                        message: details.error.message || String(details.error)
                    }
                    : null,
                resultGuid: details.resultGuid || null
            };

            await this.saveExecution(record);

            return record;
        }

        // --------------------------------------------------
        // MODULE RESULT PERSISTENCE
        // --------------------------------------------------

        createResultGuid() {
            return this.createExecutionGuid();
        }

        async saveModuleResult(id, instance, execution, scope) {
            try {
                if (
                    !this.Framework ||
                    !this.Framework.Storage
                ) {
                    throw new Error(
                        "Framework Storage is unavailable."
                    );
                }

                if (!this.websiteGuid) {
                    throw new Error(
                        "Website has not been registered."
                    );
                }

                if (
                    !instance ||
                    typeof instance.getResult !== "function"
                ) {
                    return null;
                }

                const data = await instance.getResult();

                if (
                    data === null ||
                    data === undefined
                ) {
                    return null;
                }

                const resultGuid = this.createResultGuid();

                const result = {
                    resultGuid,
                    websiteGuid: this.websiteGuid,
                    moduleId: id,
                    scope,
                    executionGuid: execution.guid,
                    createdAt: new Date().toISOString(),
                    data
                };

                await this.Framework.Storage.saveResult(result);

                return resultGuid;

            } catch (error) {
                console.error(
                    "[Anonymous Inspector] Module result save failed:",
                    id,
                    error
                );

                return null;
            }
        }

        async saveModuleMetadata(id, updates = {}) {
            try {
                const key = "module:" + id;

                const current =
                    await this.Framework.Storage.getMetadata(key) || {};

                await this.Framework.Storage.saveMetadata(
                    key,
                    {
                        ...current,
                        ...updates,
                        moduleId: id,
                        updatedAt: new Date().toISOString()
                    }
                );

            } catch (error) {
                console.error(
                    "[Anonymous Inspector] Module metadata save failed:",
                    id,
                    error
                );
            }
        }

        // --------------------------------------------------
        // SOURCE EXECUTION
        // --------------------------------------------------

        executeSource(source, url) {
            if (typeof source !== "string") {
                throw new Error("Invalid module source.");
            }

            if (!this.Framework) {
                throw new Error(
                    "Framework is unavailable."
                );
            }

            const gmGetValue =
                typeof this.gm.getValue === "function"
                    ? this.gm.getValue
                    : undefined;

            const gmSetValue =
                typeof this.gm.setValue === "function"
                    ? this.gm.setValue
                    : undefined;

            const gmDeleteValue =
                typeof this.gm.deleteValue === "function"
                    ? this.gm.deleteValue
                    : typeof gmSetValue === "function"
                        ? key => gmSetValue(key, null)
                        : undefined;

            const gmXmlHttpRequest =
                typeof this.gm.xmlHttpRequest === "function"
                    ? this.gm.xmlHttpRequest
                    : undefined;

            const gmSetClipboard =
                typeof this.gm.setClipboard === "function"
                    ? this.gm.setClipboard
                    : undefined;

            const execute = new Function(
                "Framework",
                "GM_getValue",
                "GM_setValue",
                "GM_deleteValue",
                "GM_xmlhttpRequest",
                "GM_setClipboard",
                source + "\n//# sourceURL=" + url
            );

            execute(
                this.Framework,
                gmGetValue,
                gmSetValue,
                gmDeleteValue,
                gmXmlHttpRequest,
                gmSetClipboard
            );
        }

        // --------------------------------------------------
        // MODULE LOADING
        // --------------------------------------------------

        async load(id) {
            this.validateId(id);

            if (this.modules.has(id)) {
                return this.modules.get(id);
            }

            if (this.loadingPromises.has(id)) {
                return this.loadingPromises.get(id);
            }

            const promise = this.loadSource(id);

            this.loadingPromises.set(id, promise);

            try {
                return await promise;
            } finally {
                this.loadingPromises.delete(id);
            }
        }

        async loadSource(id) {
            if (typeof this.requestText !== "function") {
                throw new Error(
                    "Module source loader is unavailable."
                );
            }

            const url = this.baseUrl + id + ".js";
            const source = await this.requestText(url);

            if (source === null || source === undefined) {
                throw new Error(
                    "Module file unavailable: " + id
                );
            }

            this.executeSource(source, url);

            if (!this.modules.has(id)) {
                throw new Error(
                    "Module did not register: " + id
                );
            }

            return this.modules.get(id);
        }

        // --------------------------------------------------
        // MODULE INITIALIZATION
        // --------------------------------------------------

        async initialize(id) {
            this.validateId(id);

            const ModuleClass = await this.load(id);
            const scopes = await this.getModuleScopes(
                id,
                ModuleClass
            );

            const instances = [];

            for (const scopeInfo of scopes) {
                const instance = await this.initializeScope(
                    id,
                    ModuleClass,
                    scopeInfo
                );

                if (instance) {
                    instances.push(instance);
                }
            }

            return instances[0] || null;
        }

        async initializeScope(id, ModuleClass, scopeInfo) {
            const scope = scopeInfo.scope;
            const instanceKey = this.createInstanceKey(
                id,
                scope
            );

            if (this.activeInstances.has(instanceKey)) {
                return this.activeInstances.get(instanceKey);
            }

            if (this.initializingPromises.has(instanceKey)) {
                return this.initializingPromises.get(instanceKey);
            }

            const promise = this.initializeInstance(
                id,
                ModuleClass,
                scopeInfo
            );

            this.initializingPromises.set(
                instanceKey,
                promise
            );

            try {
                return await promise;
            } finally {
                this.initializingPromises.delete(instanceKey);
            }
        }

        async initializeInstance(id, ModuleClass, scopeInfo) {
            const scope = scopeInfo.scope;
            const instanceKey = this.createInstanceKey(
                id,
                scope
            );

            const ttl = await this.getEffectiveTTL(
                id,
                ModuleClass
            );

            const cachedRecord = await this.getScanRecord(
                id,
                scope
            );

            if (this.isScanRecordValid(cachedRecord, ttl)) {
                const restored = await this.restoreCachedInstance(
                    id,
                    ModuleClass,
                    scopeInfo,
                    cachedRecord
                );

                if (restored) {
                    return restored;
                }

                if (
                    cachedRecord.status === "unavailable" &&
                    !cachedRecord.resultGuid
                ) {
                    return null;
                }
            }

            let instance = null;

            const startedTimestamp = Date.now();
            const startedAt = new Date(
                startedTimestamp
            ).toISOString();

            try {
                instance = new ModuleClass();

                if (
                    !instance ||
                    typeof instance.init !== "function"
                ) {
                    throw new Error(
                        "Invalid module instance: " + id
                    );
                }

                await instance.init(scopeInfo.context);

                if (instance.available) {
                    this.activeInstances.set(
                        instanceKey,
                        instance
                    );

                    const execution = await this.recordExecution(
                        id,
                        "success",
                        {
                            startedAt,
                            startedTimestamp,
                            scope
                        }
                    );

                    let resultGuid = null;

                    if (execution) {
                        resultGuid = await this.saveModuleResult(
                            id,
                            instance,
                            execution,
                            scope
                        );

                        execution.resultGuid = resultGuid;

                        if (resultGuid) {
                            await this.saveExecution(execution);
                        }

                        await this.saveModuleMetadata(id, {
                            lastExecutionGuid: execution.guid,
                            lastResultGuid: resultGuid,
                            lastExecutionStatus: "success",
                            lastExecutedAt: execution.completedAt
                        });

                        await this.saveScanRecord(
                            id,
                            scope,
                            "success",
                            {
                                resultGuid,
                                executionGuid: execution.guid
                            }
                        );
                    }

                    return instance;
                }

                await this.destroyInstance(instance);

                const execution = await this.recordExecution(
                    id,
                    "unavailable",
                    {
                        startedAt,
                        startedTimestamp,
                        scope
                    }
                );

                if (execution) {
                    await this.saveModuleMetadata(id, {
                        lastExecutionGuid: execution.guid,
                        lastExecutionStatus: "unavailable",
                        lastExecutedAt: execution.completedAt
                    });

                    await this.saveScanRecord(
                        id,
                        scope,
                        "unavailable",
                        {
                            executionGuid: execution.guid
                        }
                    );
                }

                return null;

            } catch (error) {
                if (instance) {
                    await this.destroyInstance(instance);
                }

                const execution = await this.recordExecution(
                    id,
                    "failed",
                    {
                        startedAt,
                        startedTimestamp,
                        scope,
                        error
                    }
                );

                if (execution) {
                    await this.saveModuleMetadata(id, {
                        lastExecutionGuid: execution.guid,
                        lastExecutionStatus: "failed",
                        lastExecutedAt: execution.completedAt
                    });
                }

                this.onError(id, error);

                return null;
            }
        }

        // --------------------------------------------------
        // BATCH INITIALIZATION
        // --------------------------------------------------

        async initializeMany(ids, options = {}) {
            if (!Array.isArray(ids)) {
                throw new Error(
                    "Module IDs must be an array."
                );
            }

            const uniqueIds = [...new Set(ids)];

            const concurrency = Number.isInteger(
                options.concurrency
            )
                ? Math.max(1, Math.min(10, options.concurrency))
                : 4;

            const results = new Array(uniqueIds.length).fill(null);

            let nextIndex = 0;
            let completed = 0;
            let failed = 0;

            const onProgress =
                typeof options.onProgress === "function"
                    ? options.onProgress
                    : null;

            const notifyProgress = (details = {}) => {
                if (!onProgress) return;

                try {
                    onProgress({
                        total: uniqueIds.length,
                        completed,
                        failed,
                        loaded: completed - failed,
                        ...details
                    });
                } catch (error) {
                    console.error(
                        "[Anonymous Inspector] Progress callback failed:",
                        error
                    );
                }
            };

            const worker = async () => {
                while (true) {
                    const index = nextIndex++;

                    if (index >= uniqueIds.length) {
                        return;
                    }

                    const id = uniqueIds[index];

                    notifyProgress({
                        id,
                        phase: "started"
                    });

                    let instance = null;

                    try {
                        instance = await this.initialize(id);
                        results[index] = instance;

                        if (!instance) {
                            failed++;
                        }

                    } catch (error) {
                        failed++;

                        console.error(
                            "[Anonymous Inspector] Module initialization failed:",
                            id,
                            error
                        );
                    }

                    completed++;

                    notifyProgress({
                        id,
                        phase: "completed",
                        instance
                    });
                }
            };

            const workerCount = Math.min(
                concurrency,
                uniqueIds.length
            );

            await Promise.all(
                Array.from(
                    { length: workerCount },
                    () => worker()
                )
            );

            return {
                results,
                total: uniqueIds.length,
                completed,
                failed,
                loaded: completed - failed
            };
        }

        // --------------------------------------------------
        // INSTANCE MANAGEMENT
        // --------------------------------------------------

        getActive(id, scope = null) {
            if (scope !== null) {
                return this.activeInstances.get(
                    this.createInstanceKey(id, scope)
                ) || null;
            }

            for (const [key, instance] of this.activeInstances) {
                if (key.startsWith(id + "::")) {
                    return instance;
                }
            }

            return null;
        }

        getActiveIds() {
            return [
                ...new Set(
                    [...this.activeInstances.keys()].map(
                        key => key.slice(0, key.indexOf("::"))
                    )
                )
            ];
        }

        getActiveInstances() {
            return [...this.activeInstances.values()];
        }

        isActive(id, scope = null) {
            if (scope !== null) {
                return this.activeInstances.has(
                    this.createInstanceKey(id, scope)
                );
            }

            return this.getActive(id) !== null;
        }

        // --------------------------------------------------
        // DESTRUCTION
        // --------------------------------------------------

        async destroyInstance(instance) {
            if (
                !instance ||
                typeof instance.destroy !== "function"
            ) {
                return;
            }

            try {
                await instance.destroy();
            } catch (error) {
                console.error(
                    "[Anonymous Inspector] Module destroy failed:",
                    error
                );
            }
        }

        async destroy(id, scope = null) {
            if (scope !== null) {
                const key = this.createInstanceKey(id, scope);
                const instance = this.activeInstances.get(key);

                if (!instance) {
                    return false;
                }

                this.activeInstances.delete(key);

                await this.destroyInstance(instance);

                return true;
            }

            const entries = [
                ...this.activeInstances.entries()
            ].filter(([key]) => key.startsWith(id + "::"));

            if (!entries.length) {
                return false;
            }

            for (const [key, instance] of entries) {
                this.activeInstances.delete(key);
                await this.destroyInstance(instance);
            }

            return true;
        }

        async destroyAll() {
            const entries = [
                ...this.activeInstances.entries()
            ].reverse();

            this.activeInstances.clear();

            for (const [, instance] of entries) {
                await this.destroyInstance(instance);
            }
        }

        // --------------------------------------------------
        // STATUS
        // --------------------------------------------------

        getStatus() {
            return {
                registered: this.modules.size,
                active: this.activeInstances.size,
                registeredIds: this.getRegisteredIds(),
                activeIds: this.getActiveIds()
            };
        }
    }

    // --------------------------------------------------
    // GLOBAL EXPORT
    // --------------------------------------------------

    root.AnonymousInspectorModuleManager = ModuleManager;

})(globalThis);
