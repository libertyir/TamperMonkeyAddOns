(function (root) {
    "use strict";

    const StorageAdapter =
        root.AnonymousInspectorStorageAdapter;

    if (typeof StorageAdapter !== "function") {
        throw new Error(
            "StorageAdapter must be loaded before GMStorageAdapter."
        );
    }

    class GMStorageAdapter extends StorageAdapter {
        constructor(options = {}) {
            super({
                name: "gm"
            });

            const gm = options.gm || options;

            this.getValue =
                gm.getValue || null;

            this.setValue =
                gm.setValue || null;

            this.deleteValue =
                gm.deleteValue || null;

            this.listValues =
                gm.listValues || null;

            this.namespace =
                options.namespace || "aih_storage_v1";

            this.storeNames = [
                "websites",
                "results",
                "metadata",
                "executions"
            ];

            this.keyPrefix =
                this.namespace + ":";
        }

        // --------------------------------------------------
        // INITIALIZATION
        // --------------------------------------------------

        async initialize() {
            if (this.initialized && !this.destroyed) {
                return this;
            }

            const requiredAPIs = {
                getValue: this.getValue,
                setValue: this.setValue,
                deleteValue: this.deleteValue,
                listValues: this.listValues
            };

            for (const [name, api] of Object.entries(requiredAPIs)) {
                if (typeof api !== "function") {
                    throw new Error(
                        "GMStorageAdapter requires GM API: " + name
                    );
                }
            }

            this.destroyed = false;
            this.initialized = true;

            return this;
        }

        // --------------------------------------------------
        // VALIDATION
        // --------------------------------------------------

        ensureInitialized() {
            if (!this.initialized || this.destroyed) {
                throw new Error(
                    "GMStorageAdapter has not been initialized."
                );
            }
        }

        validateStore(storeName) {
            if (
                typeof storeName !== "string" ||
                !this.storeNames.includes(storeName)
            ) {
                throw new Error(
                    "Unknown GM storage store: " + storeName
                );
            }

            return storeName;
        }

        validateKey(key) {
            if (
                (typeof key !== "string" &&
                    typeof key !== "number") ||
                String(key).length === 0
            ) {
                throw new Error("Invalid GM storage key.");
            }

            return key;
        }

        // --------------------------------------------------
        // KEY MANAGEMENT
        // --------------------------------------------------

        getStorePrefix(storeName) {
            this.validateStore(storeName);

            return this.keyPrefix + storeName + ":";
        }

        getStorageKey(storeName, key) {
            this.validateStore(storeName);
            this.validateKey(key);

            const typedKey =
                typeof key === "number"
                    ? "n:" + String(key)
                    : "s:" + String(key);

            return (
                this.getStorePrefix(storeName) +
                encodeURIComponent(typedKey)
            );
        }

        // --------------------------------------------------
        // GET
        // --------------------------------------------------

        async get(storeName, key) {
            this.ensureInitialized();

            const storageKey =
                this.getStorageKey(storeName, key);

            return await this.getValue(
                storageKey,
                undefined
            );
        }

        // --------------------------------------------------
        // PUT
        // --------------------------------------------------

        async put(storeName, key, value) {
            this.ensureInitialized();

            const storageKey =
                this.getStorageKey(storeName, key);

            await this.setValue(
                storageKey,
                value
            );

            return key;
        }

        // --------------------------------------------------
        // DELETE
        // --------------------------------------------------

        async delete(storeName, key) {
            this.ensureInitialized();

            const storageKey =
                this.getStorageKey(storeName, key);

            await this.deleteValue(storageKey);

            return true;
        }

        // --------------------------------------------------
        // GET ALL
        // --------------------------------------------------

        async getAll(storeName) {
            this.ensureInitialized();
            this.validateStore(storeName);

            const prefix =
                this.getStorePrefix(storeName);

            const allKeys =
                await this.listValues();

            const matchingKeys =
                allKeys.filter(key =>
                    typeof key === "string" &&
                    key.startsWith(prefix)
                );

            const values = await Promise.all(
                matchingKeys.map(key =>
                    this.getValue(key, undefined)
                )
            );

            return values.filter(
                value => value !== undefined
            );
        }

        // --------------------------------------------------
        // CLEAR
        // --------------------------------------------------

        async clear(storeName) {
            this.ensureInitialized();
            this.validateStore(storeName);

            const prefix =
                this.getStorePrefix(storeName);

            const allKeys =
                await this.listValues();

            const matchingKeys =
                allKeys.filter(key =>
                    typeof key === "string" &&
                    key.startsWith(prefix)
                );

            await Promise.all(
                matchingKeys.map(key =>
                    this.deleteValue(key)
                )
            );

            return true;
        }

        // --------------------------------------------------
        // STORAGE INFORMATION
        // --------------------------------------------------

        async getDatabaseInfo() {
            this.ensureInitialized();

            return {
                name: this.namespace,
                type: "GM Storage",
                stores: [...this.storeNames]
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

    root.AnonymousInspectorGMStorageAdapter =
        GMStorageAdapter;

})(globalThis);