
(function (root) {
    "use strict";

    class StorageManager {
        constructor(options = {}) {
            this.adapters = new Map();

            this.defaultAdapterName =
                options.defaultAdapter || "indexedDB";

            this.activeAdapter = null;
            this.initialized = false;
            this.initializePromise = null;

            this.stores = Object.freeze({
                websites: "websites",
                results: "results",
                metadata: "metadata"
            });
        }

        // --------------------------------------------------
        // ADAPTER REGISTRATION
        // --------------------------------------------------

        registerAdapter(name, adapter) {
            if (
                typeof name !== "string" ||
                !name.trim()
            ) {
                throw new Error("Invalid adapter name.");
            }

            if (!adapter || typeof adapter !== "object") {
                throw new Error("Invalid storage adapter.");
            }

            if (this.initialized) {
                throw new Error(
                    "Adapters cannot be registered after initialization."
                );
            }

            if (this.adapters.has(name)) {
                throw new Error(
                    "Storage adapter already registered: " + name
                );
            }

            const requiredMethods = [
                "initialize",
                "get",
                "put",
                "delete",
                "getAll",
                "clear"
            ];

            for (const method of requiredMethods) {
                if (typeof adapter[method] !== "function") {
                    throw new Error(
                        "Adapter is missing method: " + method
                    );
                }
            }

            this.adapters.set(name, adapter);

            return adapter;
        }

        // --------------------------------------------------
        // ADAPTER ACCESS
        // --------------------------------------------------

        getAdapter(name) {
            return this.adapters.get(name) || null;
        }

        getAdapterNames() {
            return [...this.adapters.keys()];
        }

        selectAdapter(name) {
            if (this.initialized) {
                throw new Error(
                    "Storage adapter cannot be changed after initialization."
                );
            }

            if (!this.adapters.has(name)) {
                throw new Error(
                    "Storage adapter not found: " + name
                );
            }

            this.defaultAdapterName = name;
        }

        // --------------------------------------------------
        // INITIALIZATION
        // --------------------------------------------------

        async initialize() {
            if (this.initialized) {
                return this;
            }

            if (this.initializePromise) {
                return this.initializePromise;
            }

            this.initializePromise = this.initializeAdapter();

            try {
                await this.initializePromise;
                return this;
            } finally {
                this.initializePromise = null;
            }
        }

        async initializeAdapter() {
            const adapter = this.adapters.get(
                this.defaultAdapterName
            );

            if (!adapter) {
                throw new Error(
                    "Default storage adapter is not registered: " +
                    this.defaultAdapterName
                );
            }

            await adapter.initialize();

            this.activeAdapter = adapter;
            this.initialized = true;
        }

        // --------------------------------------------------
        // STATE VALIDATION
        // --------------------------------------------------

        ensureInitialized() {
            if (!this.initialized || !this.activeAdapter) {
                throw new Error(
                    "StorageManager has not been initialized."
                );
            }
        }

        validateStore(store) {
            if (
                typeof store !== "string" ||
                !store.trim()
            ) {
                throw new Error("Invalid storage name.");
            }

            return store;
        }

        validateKey(key) {
            if (
                typeof key !== "string" &&
                typeof key !== "number"
            ) {
                throw new Error("Invalid storage key.");
            }

            if (String(key).length === 0) {
                throw new Error("Storage key cannot be empty.");
            }

            return key;
        }

        // --------------------------------------------------
        // GENERIC STORAGE OPERATIONS
        // --------------------------------------------------

        async get(store, key) {
            this.ensureInitialized();

            this.validateStore(store);
            this.validateKey(key);

            return this.activeAdapter.get(store, key);
        }

        async put(store, key, value) {
            this.ensureInitialized();

            this.validateStore(store);
            this.validateKey(key);

            if (value === undefined) {
                throw new Error(
                    "Cannot store undefined values."
                );
            }

            return this.activeAdapter.put(
                store,
                key,
                value
            );
        }

        async delete(store, key) {
            this.ensureInitialized();

            this.validateStore(store);
            this.validateKey(key);

            return this.activeAdapter.delete(
                store,
                key
            );
        }

        async getAll(store) {
            this.ensureInitialized();

            this.validateStore(store);

            return this.activeAdapter.getAll(store);
        }

        async clear(store) {
            this.ensureInitialized();

            this.validateStore(store);

            return this.activeAdapter.clear(store);
        }

        // --------------------------------------------------
        // WEBSITE OPERATIONS
        // --------------------------------------------------

        async getWebsite(guid) {
            return this.get(
                this.stores.websites,
                guid
            );
        }

        async saveWebsite(website) {
            if (
                !website ||
                typeof website !== "object" ||
                !website.guid
            ) {
                throw new Error(
                    "Invalid website record."
                );
            }

            return this.put(
                this.stores.websites,
                website.guid,
                website
            );
        }

        async deleteWebsite(guid) {
            return this.delete(
                this.stores.websites,
                guid
            );
        }

        async getAllWebsites() {
            return this.getAll(
                this.stores.websites
            );
        }

        // --------------------------------------------------
        // MODULE RESULT OPERATIONS
        // --------------------------------------------------

        async getResult(resultGuid) {
            return this.get(
                this.stores.results,
                resultGuid
            );
        }

        async saveResult(result) {
            if (
                !result ||
                typeof result !== "object" ||
                !result.resultGuid
            ) {
                throw new Error(
                    "Invalid module result."
                );
            }

            if (!result.websiteGuid || !result.moduleId) {
                throw new Error(
                    "Module result is missing its references."
                );
            }

            return this.put(
                this.stores.results,
                result.resultGuid,
                result
            );
        }

        async deleteResult(resultGuid) {
            return this.delete(
                this.stores.results,
                resultGuid
            );
        }

        async getAllResults() {
            return this.getAll(
                this.stores.results
            );
        }

        // --------------------------------------------------
        // METADATA OPERATIONS
        // --------------------------------------------------

        async getMetadata(key) {
            return this.get(
                this.stores.metadata,
                key
            );
        }

        async saveMetadata(key, value) {
            return this.put(
                this.stores.metadata,
                key,
                value
            );
        }

        async deleteMetadata(key) {
            return this.delete(
                this.stores.metadata,
                key
            );
        }

        // --------------------------------------------------
        // EXPORT
        // --------------------------------------------------

        async exportAll() {
            this.ensureInitialized();

            const websites = await this.getAllWebsites();
            const results = await this.getAllResults();
            const metadata = await this.getAll(
                this.stores.metadata
            );

            return {
                format: "AnonymousInspectorHub",
                version: 1,
                exportedAt: new Date().toISOString(),

                data: {
                    websites,
                    results,
                    metadata
                }
            };
        }

        // --------------------------------------------------
        // IMPORT
        // --------------------------------------------------

        async importAll(payload, options = {}) {
            this.ensureInitialized();

            if (
                !payload ||
                typeof payload !== "object" ||
                payload.format !== "AnonymousInspectorHub" ||
                payload.version !== 1 ||
                !payload.data ||
                typeof payload.data !== "object"
            ) {
                throw new Error(
                    "Invalid or unsupported import data."
                );
            }

            const websites = payload.data.websites || [];
            const results = payload.data.results || [];
            const metadata = payload.data.metadata || [];

            if (
                !Array.isArray(websites) ||
                !Array.isArray(results) ||
                !Array.isArray(metadata)
            ) {
                throw new Error(
                    "Invalid import data structure."
                );
            }

            const replace = options.replace === true;

            if (replace) {
                await this.clear(this.stores.websites);
                await this.clear(this.stores.results);
                await this.clear(this.stores.metadata);
            }

            for (const website of websites) {
                if (!website || !website.guid) {
                    throw new Error(
                        "Invalid website in import data."
                    );
                }

                await this.saveWebsite(website);
            }

            for (const result of results) {
                if (
                    !result ||
                    !result.resultGuid ||
                    !result.websiteGuid ||
                    !result.moduleId
                ) {
                    throw new Error(
                        "Invalid result in import data."
                    );
                }

                await this.saveResult(result);
            }

            for (const item of metadata) {
                if (
                    !item ||
                    !Object.prototype.hasOwnProperty.call(item, "key")
                ) {
                    throw new Error(
                        "Invalid metadata in import data."
                    );
                }

                await this.saveMetadata(
                    item.key,
                    item.value
                );
            }

            return {
                websites: websites.length,
                results: results.length,
                metadata: metadata.length,
                replaced: replace
            };
        }

        // --------------------------------------------------
        // STATUS
        // --------------------------------------------------

        getStatus() {
            return {
                initialized: this.initialized,
                defaultAdapter: this.defaultAdapterName,
                activeAdapter: this.activeAdapter
                    ? this.defaultAdapterName
                    : null,
                registeredAdapters: this.getAdapterNames()
            };
        }

        // --------------------------------------------------
        // SHUTDOWN
        // --------------------------------------------------

        async destroy() {
            if (!this.activeAdapter) {
                this.initialized = false;
                return;
            }

            const adapter = this.activeAdapter;

            this.activeAdapter = null;
            this.initialized = false;

            if (typeof adapter.destroy === "function") {
                await adapter.destroy();
            }
        }
    }

    root.AnonymousInspectorStorageManager = StorageManager;

})(globalThis);
