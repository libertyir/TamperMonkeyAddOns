(function (root) {
    "use strict";

    class ModuleRunner {
        constructor(kernel) {
            if (!kernel) {
                throw new Error("ModuleRunner requires a Kernel instance.");
            }
            this.kernel = kernel;
        }

        async run(moduleIds = []) {
            const kernel = this.kernel;

            if (!kernel.moduleManager || !kernel.uiManager) {
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

            const disabledActiveIds =
                kernel.moduleManager.getActiveIds().filter(
                    id => disabled.has(id)
                );

            for (const id of disabledActiveIds) {
                await kernel.moduleManager.destroy(id);
            }

            kernel.uiManager.showProgress(
                ids.length
                    ? "Initializing modules..."
                    : "No modules to initialize."
            );

            try {
                if (!ids.length) {
                    kernel.uiManager.refreshMenu();
                    return {
                        results: [],
                        total: 0,
                        completed: 0,
                        failed: 0,
                        loaded: 0,
                        deferredViewers: []
                    };
                }

                const loadedModules = await Promise.allSettled(
                    ids.map(id => kernel.moduleManager.load(id))
                );

                const descriptorIds = new Set(
                    ids.filter(id => kernel.moduleManager.isDescriptor(id))
                );

                const deferredViewers = new Set(
                    ids.filter(id => {
                        if (!/(?:_Viewer|Viewer)$/i.test(id)) return false;
                        const ModuleClass = kernel.moduleManager.get(id);
                        return ModuleClass && (
                            (typeof ModuleClass.providerId === "string" && ModuleClass.providerId.trim()) ||
                            (typeof ModuleClass.scannerId === "string" && ModuleClass.scannerId.trim())
                        );
                    })
                );

                const failedLoads = new Map();
                for (let index = 0; index < loadedModules.length; index++) {
                    if (loadedModules[index].status === "rejected") {
                        failedLoads.set(ids[index], loadedModules[index].reason);
                    }
                }

                const moduleIdsToInitialize = ids.filter(
                    id => !descriptorIds.has(id) && !deferredViewers.has(id) && !failedLoads.has(id)
                );

                const result = moduleIdsToInitialize.length
                    ? await kernel.moduleManager.initializeMany(
                        moduleIdsToInitialize,
                        {
                            concurrency: kernel.config.maxConcurrentModules,
                            onProgress: progress => {
                                kernel.uiManager.setProgress(progress);
                                kernel.uiManager.refreshMenu();
                            }
                        }
                    )
                    : {
                        results: [],
                        total: 0,
                        completed: 0,
                        failed: 0,
                        loaded: 0
                    };

                return {
                    ...result,
                    total: result.total + deferredViewers.size + descriptorIds.size + failedLoads.size,
                    completed: result.completed + deferredViewers.size + descriptorIds.size,
                    failed: result.failed + failedLoads.size,
                    loaded: result.loaded + deferredViewers.size + descriptorIds.size,
                    deferredViewers: [...deferredViewers],
                    descriptors: [...descriptorIds]
                };
            } finally {
                kernel.uiManager.refreshMenu();
                kernel.uiManager.hideProgress();
            }
        }
    }

    root.AnonymousInspectorModuleRunner = ModuleRunner;
})(globalThis);