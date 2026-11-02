
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

            if (this.activeInstances.has(id)) {
                return this.activeInstances.get(id);
            }

            if (this.initializingPromises.has(id)) {
                return this.initializingPromises.get(id);
            }

            const promise = this.initializeInstance(id);

            this.initializingPromises.set(id, promise);

            try {
                return await promise;
            } finally {
                this.initializingPromises.delete(id);
            }
        }

        async initializeInstance(id) {
            let instance = null;

            try {
                const ModuleClass = await this.load(id);

                instance = new ModuleClass();

                if (
                    !instance ||
                    typeof instance.init !== "function"
                ) {
                    throw new Error(
                        "Invalid module instance: " + id
                    );
                }

                await instance.init();

                if (instance.available) {
                    this.activeInstances.set(id, instance);
                    return instance;
                }

                await this.destroyInstance(instance);

                return null;

            } catch (error) {
                if (instance) {
                    await this.destroyInstance(instance);
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

            const worker = async () => {
                while (true) {
                    const index = nextIndex++;

                    if (index >= uniqueIds.length) {
                        return;
                    }

                    const id = uniqueIds[index];

                    const instance = await this.initialize(id);

                    results[index] = instance;

                    completed++;

                    if (!instance) {
                        failed++;
                    }

                    if (onProgress) {
                        try {
                            onProgress({
                                id,
                                instance,
                                total: uniqueIds.length,
                                completed,
                                failed,
                                loaded: completed - failed
                            });
                        } catch (error) {
                            console.error(
                                "[Anonymous Inspector] Progress callback failed:",
                                error
                            );
                        }
                    }
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

        getActive(id) {
            return this.activeInstances.get(id) || null;
        }

        getActiveIds() {
            return [...this.activeInstances.keys()];
        }

        getActiveInstances() {
            return [...this.activeInstances.values()];
        }

        isActive(id) {
            return this.activeInstances.has(id);
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

        async destroy(id) {
            const instance = this.activeInstances.get(id);

            if (!instance) {
                return false;
            }

            this.activeInstances.delete(id);

            await this.destroyInstance(instance);

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
