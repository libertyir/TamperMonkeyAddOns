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
                metadata: "metadata",
                executions: "executions"
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
                !Object.values(this.stores).includes(store)
            ) {
                throw new Error(
                    "Unknown storage name: " + store
                );
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
        // WEBSITE HELPERS
        // --------------------------------------------------

        normalizeDomain(value) {
            if (
                typeof value !== "string" ||
                !value.trim()
            ) {
                throw new Error("Invalid website domain.");
            }

            let domain = value.trim().toLowerCase();

            try {
                if (!/^https?:\/\//i.test(domain)) {
                    domain = "https://" + domain;
                }

                domain = new URL(domain).hostname;
            } catch {
                throw new Error("Invalid website domain.");
            }

            return domain.replace(/\.$/, "");
        }

        createGuid() {
            if (
                root.crypto &&
                typeof root.crypto.randomUUID === "function"
            ) {
                return root.crypto.randomUUID();
            }

            return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
                /[xy]/g,
                character => {
                    const random = Math.random() * 16 | 0;

                    const value = character === "x"
                        ? random
                        : (random & 0x3 | 0x8);

                    return value.toString(16);
                }
            );
        }

        validateWebsite(website) {
            if (
                !website ||
                typeof website !== "object" ||
                Array.isArray(website)
            ) {
                throw new Error("Invalid website record.");
            }

            if (
                typeof website.domain !== "string" ||
                !website.domain.trim()
            ) {
                throw new Error(
                    "Website domain is required."
                );
            }

            if (
                website.ip !== undefined &&
                website.ip !== null &&
                typeof website.ip !== "string"
            ) {
                throw new Error("Invalid website IP address.");
            }

            if (
                website.identity !== undefined &&
                website.identity !== null &&
                (
                    typeof website.identity !== "object" ||
                    Array.isArray(website.identity)
                )
            ) {
                throw new Error("Invalid website identity.");
            }

            if (
                website.technologies !== undefined &&
                !Array.isArray(website.technologies)
            ) {
                throw new Error(
                    "Website technologies must be an array."
                );
            }
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

        async getWebsiteByDomain(domain) {
            const normalizedDomain = this.normalizeDomain(domain);
            const websites = await this.getAllWebsites();

            return websites.find(website =>
                website.domain === normalizedDomain
            ) || null;
        }

        async saveWebsite(website) {
            this.validateWebsite(website);

            if (
                typeof website.guid !== "string" ||
                !website.guid.trim()
            ) {
                throw new Error(
                    "Website GUID is required."
                );
            }

            const normalized = {
                ...website,
                domain: this.normalizeDomain(website.domain)
            };

            return this.put(
                this.stores.websites,
                normalized.guid,
                normalized
            );
        }

        async upsertWebsite(website) {
            this.ensureInitialized();
            this.validateWebsite(website);

            const domain = this.normalizeDomain(website.domain);

            const existing = await this.getWebsiteByDomain(domain);
            const now = new Date().toISOString();

            const record = {
                ...(existing || {}),
                ...website,

                guid:
                    website.guid ||
                    (existing && existing.guid) ||
                    this.createGuid(),

                domain,

                ip:
                    website.ip !== undefined
                        ? website.ip
                        : existing?.ip ?? null,

                firstSeenAt:
                    existing?.firstSeenAt ||
                    website.firstSeenAt ||
                    now,

                lastCheckedAt:
                    website.lastCheckedAt || now,

                identity:
                    website.identity !== undefined
                        ? website.identity
                        : existing?.identity ?? null,

                technologies:
                    website.technologies !== undefined
                        ? [...website.technologies]
                        : [...(existing?.technologies || [])]
            };

            await this.saveWebsite(record);

            return record;
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
        // EXECUTION HISTORY OPERATIONS
        // --------------------------------------------------

        async getExecution(guid) {
            return this.get(
                this.stores.executions,
                guid
            );
        }

        async saveExecution(record) {
            if (
                !record ||
                typeof record !== "object" ||
                Array.isArray(record)
            ) {
                throw new Error("Invalid execution record.");
            }

            if (
                typeof record.guid !== "string" ||
                !record.guid.trim()
            ) {
                throw new Error(
                    "Execution GUID is required."
                );
            }

            if (
                typeof record.moduleId !== "string" ||
                !record.moduleId.trim()
            ) {
                throw new Error(
                    "Execution module ID is required."
                );
            }

            if (
                typeof record.status !== "string" ||
                !record.status.trim()
            ) {
                throw new Error(
                    "Execution status is required."
                );
            }

            if (
                typeof record.startedAt !== "string" ||
                !record.startedAt.trim()
            ) {
                throw new Error(
                    "Execution start time is required."
                );
            }

            return this.put(
                this.stores.executions,
                record.guid,
                record
            );
        }

        async deleteExecution(guid) {
            return this.delete(
                this.stores.executions,
                guid
            );
        }

        async getAllExecutions() {
            return this.getAll(
                this.stores.executions
            );
        }

        async getExecutionsByModule(moduleId) {
            if (
                typeof moduleId !== "string" ||
                !moduleId.trim()
            ) {
                throw new Error("Invalid module ID.");
            }

            const executions = await this.getAllExecutions();

            return executions
                .filter(record => record.moduleId === moduleId)
                .sort((a, b) =>
                    new Date(b.startedAt).getTime() -
                    new Date(a.startedAt).getTime()
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
            const executions = await this.getAllExecutions();
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
                    executions,
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
            const executions = payload.data.executions || [];
            const metadata = payload.data.metadata || [];

            if (
                !Array.isArray(websites) ||
                !Array.isArray(results) ||
                !Array.isArray(executions) ||
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
                await this.clear(this.stores.executions);
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

            for (const execution of executions) {
                await this.saveExecution(execution);
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
                executions: executions.length,
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