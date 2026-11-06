(function (Framework) {
    "use strict";
    class DSStoreProvider {
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

            if (!record || record.moduleId !== "DS_Store_Scanner" ||
                record.scope !== currentDirectory ||
                record.schemaVersion !== 1 ||
                !record.data ||
                !Array.isArray(record.data.records) ||
                record.data.directoryUrl !== currentDirectory) {
                return null;
            }
            return record.data;
        }

        async getStatus(context = {}) {
            const result = await this.getResult(context);
            return {
                available: Boolean(result),
                recordCount: result && Array.isArray(result.records) ? result.records.length : 0,
                scannedAt: result ? result.scannedAt || null : null
            };
        }
    }
    Framework.registerProvider("DS_Store_Provider", DSStoreProvider);
})(Framework);
