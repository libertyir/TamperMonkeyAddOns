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
                        loaded: 0
                    };
                }

                return await kernel.moduleManager.initializeMany(ids, {
                    concurrency: kernel.config.maxConcurrentModules,
                    onProgress: progress => {
                        kernel.uiManager.setProgress(progress);
                        kernel.uiManager.refreshMenu();
                    }
                });
            } finally {
                kernel.uiManager.refreshMenu();
                kernel.uiManager.hideProgress();
            }
        }
    }

    root.AnonymousInspectorModuleRunner = ModuleRunner;
})(globalThis);
