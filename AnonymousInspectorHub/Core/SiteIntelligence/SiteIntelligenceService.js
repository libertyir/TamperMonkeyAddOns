
(function (root) {
    "use strict";

    class SiteIntelligenceService {
        constructor(options = {}) {
            if (!options.storage) {
                throw new Error(
                    "SiteIntelligenceService requires StorageManager."
                );
            }

            this.storage = options.storage;

            this.origin =
                options.origin ||
                (
                    typeof location !== "undefined"
                        ? location.origin
                        : null
                );

            this.scannerOptions =
                options.scannerOptions || {};

            this.getModuleScanPolicy =
                typeof options.getModuleScanPolicy === "function"
                    ? options.getModuleScanPolicy
                    : null;

            this.repository = null;
            this.scanner = null;
            this.structure = null;
            this.dialog = null;

            this.listeners = new Map();

            this.initialized = false;
            this.destroyed = false;
            this.initializePromise = null;
            this.destroyPromise = null;
        }

        // --------------------------------------------------
        // INITIALIZATION
        // --------------------------------------------------

        async initialize(options = {}) {
            if (this.initialized) {
                return this;
            }

            if (this.destroyed) {
                throw new Error(
                    "SiteIntelligenceService has been destroyed."
                );
            }

            if (this.initializePromise) {
                return this.initializePromise;
            }

            this.initializePromise =
                this.initializeService(options);

            try {
                return await this.initializePromise;
            } finally {
                this.initializePromise = null;
            }
        }

        async initializeService(options) {
            try {
                const origin =
                    options.origin ||
                    this.origin;

                if (!origin) {
                    throw new Error(
                        "SiteIntelligenceService requires a valid origin."
                    );
                }

                this.origin = new URL(origin).origin;

                const RepositoryClass =
                    root.AnonymousInspectorResourceRepository;

                const ScannerClass =
                    root.AnonymousInspectorResourceScanner;

                const StructureClass =
                    root.AnonymousInspectorSiteStructureManager;

                if (typeof RepositoryClass !== "function") {
                    throw new Error(
                        "ResourceRepository is not loaded."
                    );
                }

                if (typeof ScannerClass !== "function") {
                    throw new Error(
                        "ResourceScanner is not loaded."
                    );
                }

                if (typeof StructureClass !== "function") {
                    throw new Error(
                        "SiteStructureManager is not loaded."
                    );
                }

                this.repository = new RepositoryClass({
                    storage: this.storage
                });

                await this.repository.initialize({
                    origin: this.origin
                });

                this.ensureNotDestroyed();

                this.scanner = new ScannerClass({
                    repository: this.repository,
                    ...this.scannerOptions,

                    onStateChange: event => {
                        this.emit("scanner:updated", event);
                    }
                });

                this.scanner.initialize();

                this.structure = new StructureClass({
                    repository: this.repository
                });

                await this.structure.initialize({
                    origin: this.origin
                });

                this.ensureNotDestroyed();

                const DialogClass =
                    root.AnonymousInspectorSiteIntelligenceDialog;

                if (typeof DialogClass !== "function") {
                    throw new Error("SiteIntelligenceDialog is not loaded.");
                }

                this.dialog = new DialogClass();
                this.dialog.initialize(this);

                this.initialized = true;

                this.emit("service:initialized", {
                    origin: this.origin
                });

                return this;

            } catch (error) {
                await this.cleanupComponents();

                this.initialized = false;

                throw error;
            }
        }

        ensureNotDestroyed() {
            if (this.destroyed) {
                throw new Error(
                    "SiteIntelligenceService has been destroyed."
                );
            }
        }

        ensureInitialized() {
            if (!this.initialized || this.destroyed) {
                throw new Error(
                    "SiteIntelligenceService is not initialized."
                );
            }
        }

        // --------------------------------------------------
        // EVENT MANAGEMENT
        // --------------------------------------------------

        on(eventName, callback) {
            if (
                typeof eventName !== "string" ||
                !eventName.trim()
            ) {
                throw new Error("Invalid event name.");
            }

            if (typeof callback !== "function") {
                throw new Error(
                    "Event callback must be a function."
                );
            }

            if (!this.listeners.has(eventName)) {
                this.listeners.set(eventName, new Set());
            }

            const callbacks =
                this.listeners.get(eventName);

            callbacks.add(callback);

            return () => {
                callbacks.delete(callback);

                if (callbacks.size === 0) {
                    this.listeners.delete(eventName);
                }
            };
        }

        off(eventName, callback) {
            const callbacks =
                this.listeners.get(eventName);

            if (!callbacks) {
                return false;
            }

            const removed = callbacks.delete(callback);

            if (callbacks.size === 0) {
                this.listeners.delete(eventName);
            }

            return removed;
        }

        emit(eventName, data = {}) {
            const callbacks = [
                ...(this.listeners.get(eventName) || [])
            ];

            const wildcardCallbacks = [
                ...(this.listeners.get("*") || [])
            ];

            const event = {
                type: eventName,
                origin: this.origin,
                timestamp: new Date().toISOString(),
                data
            };

            for (const callback of [
                ...callbacks,
                ...wildcardCallbacks
            ]) {
                try {
                    callback(event);
                } catch (error) {
                    console.error(
                        "[Site Intelligence] Event listener failed:",
                        eventName,
                        error
                    );
                }
            }
        }

        // --------------------------------------------------
        // RESOURCE DISCOVERY
        // --------------------------------------------------

        async discover(url, options = {}) {
            this.ensureInitialized();

            try {
                const record =
                    await this.structure.registerResource(
                        url,
                        options
                    );

                this.emit("resource:discovered", {
                    url: record.url,
                    record
                });

                this.emit("structure:updated", {
                    action: "resource-discovered",
                    url: record.url
                });

                return record;

            } catch (error) {
                this.emit("error", {
                    operation: "discover",
                    url,
                    error
                });

                throw error;
            }
        }

        async discoverMany(resources, options = {}) {
            this.ensureInitialized();

            if (!Array.isArray(resources)) {
                throw new Error(
                    "Resources must be an array."
                );
            }

            try {
                const records =
                    await this.structure.registerResources(
                        resources,
                        options
                    );

                for (const record of records) {
                    this.emit("resource:discovered", {
                        url: record.url,
                        record
                    });
                }

                if (records.length) {
                    this.emit("structure:updated", {
                        action: "resources-discovered",
                        count: records.length
                    });
                }

                return records;

            } catch (error) {
                this.emit("error", {
                    operation: "discoverMany",
                    error
                });

                throw error;
            }
        }

        // --------------------------------------------------
        // RESOURCE SCANNING
        // --------------------------------------------------

        async scan(url, options = {}) {
            this.ensureInitialized();

            try {
                const result =
                    await this.scanner.scan(url, options);

                await this.structure.refresh();

                this.emit("resource:scanned", {
                    url: result.url,
                    result,
                    record: result.record
                });

                this.emit("structure:updated", {
                    action: "resource-scanned",
                    url: result.url
                });

                return result;

            } catch (error) {
                this.emit("error", {
                    operation: "scan",
                    url,
                    error
                });

                throw error;
            }
        }

        async scanMany(urls, options = {}) {
            this.ensureInitialized();

            if (!Array.isArray(urls)) {
                throw new Error(
                    "URLs must be an array."
                );
            }

            const uniqueItems = new Map();

            for (const item of urls) {
                const url =
                    typeof item === "string"
                        ? item
                        : item?.url;

                if (typeof url !== "string") {
                    continue;
                }

                const itemOptions =
                    typeof item === "object" && item !== null
                        ? item
                        : {};

                uniqueItems.set(url, {
                    ...itemOptions,
                    ...options,
                    url
                });
            }

            const items = [...uniqueItems.values()];

            if (!items.length) {
                return [];
            }

            try {
                const settledResults = await Promise.allSettled(
                    items.map(item =>
                        this.scanner.scan(
                            item.url,
                            item
                        )
                    )
                );

                const results = [];
                const errors = [];

                for (let i = 0; i < settledResults.length; i++) {
                    const settled = settledResults[i];

                    if (settled.status === "fulfilled") {
                        const result = settled.value;

                        results.push(result);

                        this.emit("resource:scanned", {
                            url: result.url,
                            result,
                            record: result.record
                        });
                    } else {
                        errors.push(settled.reason);
                    }
                }

                let refreshError = null;

                try {
                    await this.structure.refresh();

                    this.emit("structure:updated", {
                        action: "resources-scanned",
                        count: items.length
                    });
                } catch (error) {
                    refreshError = error;
                }

                if (errors.length > 0) {
                    if (refreshError) {
                        errors[0].refreshError = refreshError;
                    }

                    throw errors[0];
                }

                if (refreshError) {
                    throw refreshError;
                }

                return results;

            } catch (error) {
                this.emit("error", {
                    operation: "scanMany",
                    error
                });

                throw error;
            }
        }

        // --------------------------------------------------
        // MODULE SCAN POLICY
        // --------------------------------------------------

        async scanForModule(
            moduleId,
            ModuleClass,
            url,
            options = {}
        ) {
            this.ensureInitialized();

            if (
                typeof moduleId !== "string" ||
                !moduleId.trim()
            ) {
                throw new Error("Invalid module ID.");
            }

            let policy = null;

            if (this.getModuleScanPolicy) {
                policy = await this.getModuleScanPolicy(
                    moduleId,
                    ModuleClass
                );
            }

            if (!policy) {
                const declared =
                    ModuleClass &&
                    ModuleClass.scanPolicy
                        ? ModuleClass.scanPolicy
                        : {};

                policy = {
                    scope: declared.scope || "origin-root",
                    ttl: declared.defaultTTL || "7d"
                };
            }

            const ttl =
                options.ttl ||
                policy.ttl ||
                policy.defaultTTL ||
                "7d";

            return this.scan(url, {
                ...options,
                ttl,
                source: moduleId
            });
        }

        // --------------------------------------------------
        // RESOURCE ACCESS
        // --------------------------------------------------

        async getResource(url) {
            this.ensureInitialized();

            return this.repository.get(url);
        }

        async getAllResources() {
            this.ensureInitialized();

            return this.repository.getAll();
        }

        async hasResource(url) {
            this.ensureInitialized();

            return this.repository.has(url);
        }

        async isResourceFresh(url, ttl = "7d") {
            this.ensureInitialized();

            return this.repository.isResourceFresh(
                url,
                "validation",
                ttl
            );
        }

        // --------------------------------------------------
        // STRUCTURE ACCESS
        // --------------------------------------------------

        async getStructure(options = {}) {
            this.ensureInitialized();

            if (options.refresh === true) {
                await this.structure.refresh();
            }

            return this.structure.getStructure();
        }

        async getNode(url) {
            this.ensureInitialized();

            return this.structure.getNode(url);
        }

        async getChildren(url = "/") {
            this.ensureInitialized();

            return this.structure.getChildren(url);
        }

        async getParent(url) {
            this.ensureInitialized();

            return this.structure.getParent(url);
        }

        async getAncestors(url) {
            this.ensureInitialized();

            return this.structure.getAncestors(url);
        }

        async getResourcesByStatus(status) {
            this.ensureInitialized();

            return this.structure.getResourcesByStatus(
                status
            );
        }

        async getResourcesBySource(source) {
            this.ensureInitialized();

            return this.structure.getResourcesBySource(
                source
            );
        }

        async getStatistics() {
            this.ensureInitialized();

            return this.structure.getStatistics();
        }

        // --------------------------------------------------
        // REFRESH
        // --------------------------------------------------

        async refresh() {
            this.ensureInitialized();

            const structure =
                await this.structure.refresh();

            this.emit("structure:updated", {
                action: "refresh"
            });

            return structure;
        }

        // --------------------------------------------------
        // STATUS
        // --------------------------------------------------

        getStatus() {
            if (!this.initialized) {
                return {
                    initialized: false,
                    destroyed: this.destroyed,
                    origin: this.origin
                };
            }

            return {
                initialized: true,
                destroyed: false,
                origin: this.origin,
                repository: this.repository.getStatus(),
                scanner: this.scanner.getStatus(),
                structure: this.structure.getStatus(),
                listeners: this.listeners.size
            };
        }

        // --------------------------------------------------
        // COMPONENT CLEANUP
        // --------------------------------------------------

        async cleanupComponents() {
            if (this.dialog) {
                this.dialog.destroy();
                this.dialog = null;
            }

            if (this.scanner) {
                this.scanner.destroy();
                this.scanner = null;
            }

            if (this.structure) {
                this.structure.destroy();
                this.structure = null;
            }

            if (this.repository) {
                try {
                    await this.repository.destroy();
                } finally {
                    this.repository = null;
                }
            }
        }

        // --------------------------------------------------
        // SHUTDOWN
        // --------------------------------------------------

        async destroy() {
            if (this.destroyPromise) {
                return this.destroyPromise;
            }

            if (this.destroyed) {
                return;
            }

            this.destroyed = true;

            this.destroyPromise = this.destroyService();

            return this.destroyPromise;
        }

        async destroyService() {
            this.emit("service:destroying");

            if (this.initializePromise) {
                try {
                    await this.initializePromise;
                } catch {
                    // Initialization failure already performs cleanup.
                }
            }

            await this.cleanupComponents();

            this.listeners.clear();

            this.initialized = false;
            this.origin = null;
        }
    }

    root.AnonymousInspectorSiteIntelligenceService =
        SiteIntelligenceService;

})(globalThis);
