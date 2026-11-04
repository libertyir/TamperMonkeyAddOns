(function (root) {
    "use strict";

    class ApplicationStartup {
        constructor(kernel) {
            if (!kernel) {
                throw new Error(
                    "ApplicationStartup requires a Kernel instance."
                );
            }

            this.kernel = kernel;
        }

        async start(moduleIds = []) {
            const kernel = this.kernel;

            if (kernel.state === "running") {
                return kernel;
            }

            kernel.state = "starting";

            try {
                await kernel.kernelConfig.loadConfig();

                kernel.configuredModuleIds = [
                    ...new Set(
                        moduleIds.filter(
                            id => typeof id === "string"
                        )
                    )
                ];

                await kernel.loadBootstrap();

                kernel.createServices();
                kernel.registerApplicationServices();

                const hostname = window.location.hostname;

                await kernel.application.start({
                    kernel,
                    hostname
                });

                await kernel.registerCurrentWebsite();

                const disabled =
                    await kernel.kernelConfig.getDisabledModules();

                const globallyEnabled =
                    kernel.configuredModuleIds.filter(
                        id => !disabled.includes(id)
                    );

                const allowed =
                    kernel.siteManager.getAllowedModules(
                        globallyEnabled,
                        hostname
                    );

                await kernel.runModules(allowed);

                kernel.uiManager.refreshMenu();

                kernel.started = true;
                kernel.state = "running";

                if (kernel.config.showInitializationSummary) {
                    console.info(
                        "[Anonymous Inspector Hub] Initialized",
                        {
                            version: kernel.version,
                            storageAdapter: kernel.storageAdapterName,
                            totalModules: kernel.configuredModuleIds.length,
                            loaded: kernel.moduleManager.getActiveIds(),
                            settings: kernel.settingsManager.getActiveIds(),
                            hostname,
                            allowedModules: allowed
                        }
                    );
                }

                return kernel;

            } catch (error) {
                kernel.state = "failed";

                console.error(
                    "[Anonymous Inspector Hub] Initialization failed:",
                    error
                );

                if (kernel.uiManager) {
                    kernel.uiManager.showProgress(
                        "Initialization failed: " + error.message
                    );
                }

                throw error;
            }
        }
    }

    root.AnonymousInspectorApplicationStartup = ApplicationStartup;

})(globalThis);