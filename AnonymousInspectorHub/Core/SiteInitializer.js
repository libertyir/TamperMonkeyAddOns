(function (root) {
    "use strict";

    class SiteInitializer {
        constructor(kernel) {
            if (!kernel) {
                throw new Error(
                    "SiteInitializer requires a Kernel instance."
                );
            }

            this.kernel = kernel;
        }

        async initialize(hostname = window.location.hostname) {
            const kernel = this.kernel;

            if (!kernel.storageManager) {
                throw new Error(
                    "StorageManager is not initialized."
                );
            }

            if (!kernel.siteManager) {
                throw new Error(
                    "SiteManager is not initialized."
                );
            }

            const website =
                await kernel.storageManager.upsertWebsite({
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

            return {
                website,
                hostname,
                allowedModules: allowed
            };
        }
    }

    root.AnonymousInspectorSiteInitializer = SiteInitializer;

})(globalThis);