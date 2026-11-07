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
                kernel.kernelConfig.loadConfig();

                kernel.configuredModuleIds = [...new Set(
                    moduleIds.filter(id => typeof id === "string")
                )];

                await kernel.loadBootstrap();

                kernel.createServices();
                kernel.registerApplicationServices();

                const hostname = window.location.hostname;
                await kernel.application.start({ kernel, hostname });

                const {
                    website,
                    allowedModules
                } = await kernel.siteInitializer.initialize(hostname);

                kernel.allowedModuleIds = [...allowedModules];
                kernel.modulesStarted = false;
                kernel.modulesStartPromise = null;
                kernel.moduleRunResult = null;

                kernel.uiManager.refreshMenu();

                kernel.started = true;
                kernel.state = "running";

                if (typeof kernel.onUIReady === "function") {
                    kernel.onUIReady();
                }

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
                            websiteGuid: website.guid,
                            allowedModules
                        }
                    );
                }

                return kernel;
            } catch (error) {
                kernel.started = false;
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
