(function () {
    "use strict";

    const namespace = globalThis.AnonymousInspectorDebugMode;

    if (!namespace) {
        throw new Error("DebugModeInspector namespace is not initialized.");
    }

    class OSV {

        static baseUrl = "https://api.osv.dev/v1/vulns/";

        static async lookupById(id, Framework) {
            if (!/^CVE-\d{4}-\d{4,}$/i.test(String(id))) {
                return null;
            }

            const url =
                OSV.baseUrl + encodeURIComponent(id);

            try {
                const response =
                    await Framework.requestText(url);

                if (
                    typeof response !== "string" ||
                    !response.trim()
                ) {
                    return null;
                }

                const data = JSON.parse(response);

                return {
                    id: data.id || id,
                    aliases: Array.isArray(data.aliases)
                        ? data.aliases
                        : [],
                    summary: data.summary || null,
                    details: data.details || null,
                    modified: data.modified || null,
                    published: data.published || null,
                    references: (data.references || [])
                        .slice(0, 10)
                        .map(item => item.url)
                        .filter(Boolean),
                    source: "OSV"
                };

            } catch {
                return null;
            }
        }
    }

    namespace.OSV = OSV;

})();