(function (Framework) {
    "use strict";

    class WebStructureInspectorProvider {
        matchesResource(resource) {
            const rawUrl = typeof resource === "string"
                ? resource
                : resource && (
                    resource.url ||
                    resource.path ||
                    resource.directoryUrl ||
                    ""
                );

            if (!rawUrl) {
                return false;
            }

            try {
                const url = new URL(rawUrl, location.href);

                return (
                    url.origin === location.origin &&
                    ["http:", "https:"].includes(url.protocol)
                );
            } catch {
                return false;
            }
        }

        async getResult(context = {}) {
            let origin;

            try {
                origin = new URL(
                    context.url ||
                    context.resource?.url ||
                    context.origin ||
                    location.href,
                    location.href
                ).origin;
            } catch {
                return null;
            }

            const key = "web-structure-tree:" + origin;

            try {
                const record = await Framework.Storage.getMetadata(key);

                if (
                    !record ||
                    record.version !== 1 ||
                    record.origin !== origin ||
                    !Array.isArray(record.records)
                ) {
                    return null;
                }

                return {
                    origin,
                    capturedAt: record.updatedAt || null,
                    totalResources: record.records.length,
                    resources: record.records
                };
            } catch (error) {
                console.warn(
                    "[WebStructureInspector] Result load failed:",
                    error
                );

                return null;
            }
        }
    }

    Framework.registerProvider(
        "WebStructureInspector_Provider",
        WebStructureInspectorProvider
    );
})(Framework);
