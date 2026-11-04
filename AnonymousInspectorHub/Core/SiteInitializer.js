(function (root) {
    "use strict";

    class SiteInitializer {
        constructor(kernel) {
            if (!kernel) {
                throw new Error("SiteInitializer requires a Kernel instance.");
            }
            this.kernel = kernel;
        }

        async initialize(hostname = window.location.hostname) {
            const kernel = this.kernel;

            if (!kernel.storageManager) {
                throw new Error("StorageManager is not initialized.");
            }
            if (!kernel.siteManager) {
                throw new Error("SiteManager is not initialized.");
            }

            const website = await kernel.storageManager.upsertWebsite({
                domain: hostname
            });

            if (!website) {
                throw new Error(
                    "Failed to register current website: " + hostname
                );
            }

            kernel.websiteGuid = website.guid;
            if (kernel.moduleManager) {
                kernel.moduleManager.websiteGuid = website.guid;
            }

            const disabled = new Set(
                kernel.kernelConfig.getDisabledModules()
            );
            const enabledIds = kernel.configuredModuleIds.filter(
                id => !disabled.has(id)
            );
            const allowedModules = kernel.siteManager.getAllowedModules(
                enabledIds,
                hostname
            );

            return { website, hostname, allowedModules };
        }
    }

    root.AnonymousInspectorSiteInitializer = SiteInitializer;
})(globalThis);
