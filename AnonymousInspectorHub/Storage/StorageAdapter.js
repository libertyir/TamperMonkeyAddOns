(function (root) {
    "use strict";

    class StorageAdapter {
        constructor(options = {}) {
            this.name = options.name || "base";
            this.initialized = false;
            this.destroyed = false;
        }

        // --------------------------------------------------
        // INITIALIZATION
        // --------------------------------------------------

        async initialize() {
            throw new Error(
                "StorageAdapter.initialize() must be implemented."
            );
        }

        // --------------------------------------------------
        // STATE VALIDATION
        // --------------------------------------------------

        ensureInitialized() {
            if (!this.initialized || this.destroyed) {
                throw new Error(
                    this.name + " has not been initialized."
                );
            }
        }

        // --------------------------------------------------
        // VALIDATION
        // --------------------------------------------------

        validateStore(storeName) {
            if (
                typeof storeName !== "string" ||
                !storeName.trim()
            ) {
                throw new Error("Invalid storage store name.");
            }

            return storeName;
        }

        validateKey(key) {
            if (
                (typeof key !== "string" &&
                    typeof key !== "number") ||
                String(key).length === 0
            ) {
                throw new Error("Invalid storage key.");
            }

            return key;
        }

        // --------------------------------------------------
        // STORAGE OPERATIONS
        // --------------------------------------------------

        async get(storeName, key) {
            throw new Error(
                "StorageAdapter.get() must be implemented."
            );
        }

        async put(storeName, key, value) {
            throw new Error(
                "StorageAdapter.put() must be implemented."
            );
        }

        async delete(storeName, key) {
            throw new Error(
                "StorageAdapter.delete() must be implemented."
            );
        }

        async getAll(storeName) {
            throw new Error(
                "StorageAdapter.getAll() must be implemented."
            );
        }

        async clear(storeName) {
            throw new Error(
                "StorageAdapter.clear() must be implemented."
            );
        }

        // --------------------------------------------------
        // STORAGE INFORMATION
        // --------------------------------------------------

        async getDatabaseInfo() {
            this.ensureInitialized();

            return {
                name: this.name,
                type: this.constructor.name
            };
        }

        // --------------------------------------------------
        // SHUTDOWN
        // --------------------------------------------------

        async destroy() {
            this.initialized = false;
            this.destroyed = true;
        }
    }

    root.AnonymousInspectorStorageAdapter =
        StorageAdapter;

})(globalThis);