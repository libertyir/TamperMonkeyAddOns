(function (root) {
    "use strict";

    class ModuleRunner {
        constructor(kernel) {
            if (!kernel) {
                throw new Error(
                    "ModuleRunner requires a Kernel instance."
                );
            }

            this.kernel = kernel;
        }

        async run(moduleIds) {
            const kernel = this.kernel;
            const requestedIds = [...new Set(moduleIds)];

            const disabled = new Set(
                await kernel.kernelConfig.getDisabledModules()
            );

            const ids = requestedIds.filter(
                id => !disabled.has(id)
            );

            // Remove instances of modules that are now disabled.
            const activeIds = kernel.moduleManager.getActiveIds();

            const disabledActiveIds = activeIds.filter(
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

            if (!ids.length) {
                kernel.uiManager.refreshMenu();
                kernel.uiManager.hideProgress();

                return {
                    results: [],
                    total: 0,
                    completed: 0,
                    failed: 0,
                    loaded: 0
                };
            }

            const result =
                await kernel.moduleManager.initializeMany(
                    ids,
                    {
                        concurrency:
                            kernel.config.maxConcurrentModules,

                        onProgress: progress => {
                            kernel.uiManager.setProgress(progress);
                            kernel.uiManager.refreshMenu();
                        }
                    }
                );

            kernel.uiManager.refreshMenu();
            kernel.uiManager.hideProgress();

            return result;
        }
    }

    root.AnonymousInspectorModuleRunner = ModuleRunner;

})(globalThis);