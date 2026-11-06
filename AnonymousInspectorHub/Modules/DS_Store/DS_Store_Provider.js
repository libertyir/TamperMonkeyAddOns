(function (Framework) {
    "use strict";
    class DSStoreProvider {
        async getResult(context = {}) {
            const currentUrl = context.url || window.location.href;
            const currentDirectory = new URL(".", currentUrl).href;
            const moduleIds = ["DS_Store_Scanner", "DS_Store_Viewer"];
            const histories = await Promise.all(
                moduleIds.map(id => Framework.Storage.getExecutionsByModule(id))
            );
            const candidates = histories
                .flatMap(records => Array.isArray(records) ? records : [])
                .filter(record => record && record.status === "success" && record.resultGuid)
                .sort((a, b) =>
                    Date.parse(b.completedAt || 0) - Date.parse(a.completedAt || 0)
                );

            for (const execution of candidates) {
                const result = await Framework.Storage.getResult(execution.resultGuid);
                const data = result && result.data;
                if (!data || !Array.isArray(data.records)) continue;
                const savedDirectory = data.directoryUrl ||
                    (data.page ? new URL(".", data.page).href : null);
                if (savedDirectory === currentDirectory) return data;
            }
            return null;
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
