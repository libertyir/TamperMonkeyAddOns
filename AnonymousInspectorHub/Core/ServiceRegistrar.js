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
                throw new Error("Application has not been created.");
            }

            const requiredServices = [
                "storageManager",
                "cryptoManager",
                "siteManager",
                "siteIntelligenceService",
                "moduleManager",
                "uiManager",
                "settingsManager"
            ];

            for (const name of requiredServices) {
                if (!kernel[name]) {
                    throw new Error(
                        "Cannot register services: " + name + " is missing."
                    );
                }
            }

            app.registerService("storage", kernel.storageManager);
            app.registerService("crypto", kernel.cryptoManager);
            app.registerService("sites", kernel.siteManager);
            app.registerService(
                "siteIntelligence",
                kernel.siteIntelligenceService
            );

            // Modules are destroyed before their dependent services.
            app.registerService("modules", {
                destroy: () => kernel.moduleManager.destroyAll()
            });

            app.registerService("ui", {
                initialize: async context => {
                    await kernel.uiManager.initialize(context);
                    if (typeof kernel.onUIReady === "function") {
                        kernel.onUIReady();
                    }
                },
                destroy: () => kernel.uiManager.destroy()
            });

            app.registerService("settings", {
                initialize: () => kernel.settingsManager.loadAll(),
                destroy: () => kernel.settingsManager.destroyAll()
            });

            return app;
        }
    }

    root.AnonymousInspectorServiceRegistrar = ServiceRegistrar;
})(globalThis);
