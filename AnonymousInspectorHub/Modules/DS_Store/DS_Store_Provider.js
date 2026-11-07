(function (Framework) {
    "use strict";

    class DSStoreProvider {
        matchesResource(resource) {
            const raw = typeof resource === "string"
                ? resource
                : resource && (
                    resource.url ||
                    resource.path ||
                    resource.name ||
                    ""
                );

            if (!raw) {
                return false;
            }

            let pathname = String(raw).split(/[?#]/, 1)[0];

            try {
                pathname = new URL(
                    pathname,
                    window.location.href
                ).pathname;
            } catch {
                // Keep the original path when it is not a valid URL.
            }

            const basename = pathname
                .replace(/\\/g, "/")
                .split("/")
                .pop();

            try {
                return decodeURIComponent(basename).toLowerCase() === ".ds_store";
            } catch {
                return basename.toLowerCase() === ".ds_store";
            }
        }

        async getResult(context = {}) {
            const currentUrl = context.url ||
                context.resource?.url ||
                context.resource?.path ||
                window.location.href;

            const currentDirectory = new URL(".", currentUrl).href;

            const key = [
                "module-result",
                "DS_Store_Scanner",
                encodeURIComponent(currentDirectory)
            ].join(":");

            const record = await Framework.Storage.getMetadata(key);

            if (
                !record ||
                record.moduleId !== "DS_Store_Scanner" ||
                record.scope !== currentDirectory ||
                record.schemaVersion !== 1 ||
                !record.data ||
                !Array.isArray(record.data.records) ||
                record.data.directoryUrl !== currentDirectory
            ) {
                return null;
            }

            return record.data;
        }

        async getStatus(context = {}) {
            const result = await this.getResult(context);

            return {
                available: Boolean(result),
                recordCount: result && Array.isArray(result.records)
                    ? result.records.length
                    : 0,
                scannedAt: result
                    ? result.scannedAt || null
                    : null
            };
        }
    }

    Framework.registerProvider("DS_Store_Provider", DSStoreProvider);
})(Framework);
