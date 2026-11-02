(function (root) {
    "use strict";

    const StorageAdapter =
        root.AnonymousInspectorStorageAdapter;

    if (typeof StorageAdapter !== "function") {
        throw new Error(
            "StorageAdapter must be loaded before IndexedDBAdapter."
        );
    }

    class IndexedDBAdapter extends StorageAdapter {
        constructor(options = {}) {
            super({
                name: "indexedDB"
            });

            this.databaseName =
                options.databaseName || "AnonymousInspectorHub";

            this.databaseVersion =
                options.databaseVersion || 1;

            this.storeNames = [
                "websites",
                "results",
                "metadata",
                "executions"
            ];

            this.database = null;
            this.openPromise = null;
        }

        // --------------------------------------------------
        // INITIALIZATION
        // --------------------------------------------------

        async initialize() {
            if (this.initialized && this.database) {
                return this;
            }

            if (this.openPromise) {
                return this.openPromise;
            }

            if (!root.indexedDB) {
                throw new Error(
                    "IndexedDB is not available in this environment."
                );
            }

            this.destroyed = false;
            this.openPromise = this.openDatabase();

            try {
                await this.openPromise;
                return this;
            } finally {
                this.openPromise = null;
            }
        }

        openDatabase() {
            return new Promise((resolve, reject) => {
                const request = root.indexedDB.open(
                    this.databaseName,
                    this.databaseVersion
                );

                request.onupgradeneeded = event => {
                    const database = event.target.result;

                    for (const storeName of this.storeNames) {
                        if (!database.objectStoreNames.contains(storeName)) {
                            database.createObjectStore(storeName, {
                                keyPath: "_key"
                            });
                        }
                    }
                };

                request.onsuccess = event => {
                    const database = event.target.result;

                    database.onversionchange = () => {
                        database.close();

                        if (this.database === database) {
                            this.database = null;
                            this.initialized = false;
                        }
                    };

                    database.onclose = () => {
                        if (this.database === database) {
                            this.database = null;
                            this.initialized = false;
                        }
                    };

                    this.database = database;
                    this.initialized = true;

                    resolve(database);
                };

                request.onerror = () => {
                    reject(
                        request.error ||
                        new Error("Failed to open IndexedDB.")
                    );
                };

                request.onblocked = () => {
                    console.warn(
                        "[Anonymous Inspector] IndexedDB upgrade is blocked."
                    );
                };
            });
        }

        // --------------------------------------------------
        // VALIDATION
        // --------------------------------------------------

        ensureInitialized() {
            if (
                !this.initialized ||
                !this.database ||
                this.destroyed
            ) {
                throw new Error(
                    "IndexedDBAdapter has not been initialized."
                );
            }
        }

        validateStore(storeName) {
            if (
                typeof storeName !== "string" ||
                !this.storeNames.includes(storeName)
            ) {
                throw new Error(
                    "Unknown IndexedDB store: " + storeName
                );
            }

            return storeName;
        }

        // --------------------------------------------------
        // TRANSACTION HELPER
        // --------------------------------------------------

        executeTransaction(storeName, mode, operation) {
            this.ensureInitialized();
            this.validateStore(storeName);

            return new Promise((resolve, reject) => {
                let transaction;
                let result;
                let operationError = null;

                try {
                    transaction = this.database.transaction(
                        [storeName],
                        mode
                    );

                    const store = transaction.objectStore(
                        storeName
                    );

                    result = operation(store);

                } catch (error) {
                    reject(error);
                    return;
                }

                transaction.oncomplete = () => {
                    resolve(result);
                };

                transaction.onerror = () => {
                    reject(
                        operationError ||
                        transaction.error ||
                        new Error("IndexedDB transaction failed.")
                    );
                };

                transaction.onabort = () => {
                    reject(
                        operationError ||
                        transaction.error ||
                        new Error("IndexedDB transaction aborted.")
                    );
                };

                if (result && typeof result.then === "function") {
                    reject(
                        new Error(
                            "IndexedDB transaction operations must be synchronous."
                        )
                    );
                    return;
                }
            });
        }

        // --------------------------------------------------
        // GET
        // --------------------------------------------------

        async get(storeName, key) {
            this.validateKey(key);

            return new Promise((resolve, reject) => {
                this.ensureInitialized();
                this.validateStore(storeName);

                let transaction;
                let request;

                try {
                    transaction = this.database.transaction(
                        [storeName],
                        "readonly"
                    );

                    request = transaction
                        .objectStore(storeName)
                        .get(key);

                } catch (error) {
                    reject(error);
                    return;
                }

                request.onsuccess = () => {
                    const record = request.result;

                    resolve(
                        record === undefined
                            ? undefined
                            : record.value
                    );
                };

                request.onerror = () => {
                    reject(
                        request.error ||
                        new Error("IndexedDB read failed.")
                    );
                };
            });
        }

        // --------------------------------------------------
        // PUT
        // --------------------------------------------------

        async put(storeName, key, value) {
            this.validateKey(key);

            return this.executeTransaction(
                storeName,
                "readwrite",
                store => {
                    const request = store.put({
                        _key: key,
                        value
                    });

                    request.onerror = () => {
                        console.error(
                            "[Anonymous Inspector] IndexedDB write failed:",
                            request.error
                        );
                    };

                    return key;
                }
            );
        }

        // --------------------------------------------------
        // DELETE
        // --------------------------------------------------

        async delete(storeName, key) {
            this.validateKey(key);

            return this.executeTransaction(
                storeName,
                "readwrite",
                store => {
                    const request = store.delete(key);

                    request.onerror = () => {
                        console.error(
                            "[Anonymous Inspector] IndexedDB delete failed:",
                            request.error
                        );
                    };

                    return true;
                }
            );
        }

        // --------------------------------------------------
        // GET ALL
        // --------------------------------------------------

        async getAll(storeName) {
            return new Promise((resolve, reject) => {
                this.ensureInitialized();
                this.validateStore(storeName);

                let transaction;
                let request;

                try {
                    transaction = this.database.transaction(
                        [storeName],
                        "readonly"
                    );

                    request = transaction
                        .objectStore(storeName)
                        .getAll();

                } catch (error) {
                    reject(error);
                    return;
                }

                request.onsuccess = () => {
                    const records = request.result || [];

                    resolve(
                        records.map(record => record.value)
                    );
                };

                request.onerror = () => {
                    reject(
                        request.error ||
                        new Error("IndexedDB read failed.")
                    );
                };
            });
        }

        // --------------------------------------------------
        // CLEAR
        // --------------------------------------------------

        async clear(storeName) {
            return this.executeTransaction(
                storeName,
                "readwrite",
                store => {
                    const request = store.clear();

                    request.onerror = () => {
                        console.error(
                            "[Anonymous Inspector] IndexedDB clear failed:",
                            request.error
                        );
                    };

                    return true;
                }
            );
        }

        // --------------------------------------------------
        // DATABASE INFORMATION
        // --------------------------------------------------

        getDatabaseInfo() {
            this.ensureInitialized();

            return {
                name: this.database.name,
                version: this.database.version,
                stores: [...this.database.objectStoreNames]
            };
        }

        // --------------------------------------------------
        // SHUTDOWN
        // --------------------------------------------------

        async destroy() {
            if (this.database) {
                this.database.close();
            }

            this.database = null;
            this.initialized = false;
            this.destroyed = true;
        }
    }

    root.AnonymousInspectorIndexedDBAdapter =
        IndexedDBAdapter;

})(globalThis);