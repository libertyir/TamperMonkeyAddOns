(function (root) {
    "use strict";

    class ServiceRegistrar {
        constructor(kernel) {
            if (!kernel) {
                throw new Error(
                    "ServiceRegistrar requires a Kernel instance."
                );
            }

            this.kernel = kernel;
        }

        register() {
            const kernel = this.kernel;
            const app = kernel.application;

            if (!app) {
                throw new Error(
                    "Application has not been created."
                );
            }

            const requiredServices = [
                "storageManager",
                "cryptoManager",
                "siteManager",
                "siteIntelligenceService",
                "uiManager",
                "settingsManager"
            ];

            for (const name of requiredServices) {
                if (!kernel[name]) {
                    throw new Error(
                        `Cannot register services: ${name} is missing.`
                    );
                }
            }

            // Storage must initialize before dependent services.
            app.registerService(
                "storage",
                kernel.storageManager
            );

            // CryptoManager currently uses GM storage directly.
            // Its registration order is kept after StorageManager.
            app.registerService(
                "crypto",
                kernel.cryptoManager
            );

            app.registerService(
                "sites",
                kernel.siteManager
            );

            // Site Intelligence depends on StorageManager.
            app.registerService(
                "siteIntelligence",
                kernel.siteIntelligenceService
            );

            // Initialize the base UI before loading settings.
            app.registerService("ui", {
                initialize: async context => {
                    await kernel.uiManager.initialize(context);

                    if (typeof kernel.onUIReady === "function") {
                        kernel.onUIReady();
                    }
                },

                destroy: () => {
                    return kernel.uiManager.destroy();
                }
            });

            // Settings are loaded after the UI is ready.
            app.registerService("settings", {
                initialize: () => {
                    return kernel.settingsManager.loadAll();
                },

                destroy: () => {
                    return kernel.settingsManager.destroyAll();
                }
            });

            return app;
        }
    }

    root.AnonymousInspectorServiceRegistrar =
        ServiceRegistrar;

})(globalThis);