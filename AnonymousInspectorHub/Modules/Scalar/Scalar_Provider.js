(function (Framework) {
    "use strict";

    class Scalar_Provider extends Framework.BaseProvider {
        matchesResource(resource) {
            const raw = typeof resource === "string"
                ? resource
                : resource && (
                    resource.url ||
                    resource.path ||
                    resource.name ||
                    resource.directoryUrl ||
                    ""
                );

            if (!raw) {
                return false;
            }

            let url;

            try {
                url = new URL(String(raw), location.href);
            } catch {
                return false;
            }

            return (
                url.origin === location.origin &&
                new RegExp("/(scalar|api-reference|reference|api-docs|docs|documentation)(/|$)", "i").test(url.pathname)
            );
        }

        async getResult(context = {}) {
            let origin;

            try {
                origin = new URL(
                    context.url ||
                    context.resource?.url ||
                    location.href
                ).origin;
            } catch {
                return null;
            }

            const scope = context.directoryUrl ||
                context.scope ||
                origin + "/";

            const key = [
                "module-result",
                "Scalar_Scanner",
                encodeURIComponent(scope)
            ].join(":");

            const record = await Framework.Storage.getMetadata(key);

            if (
                !record ||
                record.moduleId !== "Scalar_Scanner" ||
                record.scope !== scope ||
                record.schemaVersion !== 1 ||
                !record.data ||
                record.data.directoryUrl !== scope
            ) {
                return null;
            }

            try {
                const pageUrl = new URL(record.data.page || scope);

                if (pageUrl.origin !== origin) {
                    return null;
                }
            } catch {
                return null;
            }

            return record.data;
        }
    }

    Framework.registerProvider("Scalar_Provider", Scalar_Provider);
})(Framework);
