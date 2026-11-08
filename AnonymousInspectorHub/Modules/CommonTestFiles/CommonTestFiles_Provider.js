(function (Framework) {
    "use strict";

    class CommonTestFiles_Provider extends Framework.BaseProvider {
        matchesResource(resource) {
            if (!resource || typeof resource !== "object") {
                return false;
            }

            // These are site-level inspectors, not file viewers.
            // They may match an explicitly supplied site/directory resource only.
            if (
                resource.kind !== "site" &&
                resource.type !== "directory"
            ) {
                return false;
            }

            const raw = resource.url ||
                resource.path ||
                resource.directoryUrl ||
                "";

            if (!raw) {
                return false;
            }

            try {
                const url = new URL(String(raw), location.href);
                return url.origin === location.origin;
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
                "CommonTestFiles_Scanner",
                encodeURIComponent(scope)
            ].join(":");

            const record = await Framework.Storage.getMetadata(key);

            if (
                !record ||
                record.moduleId !== "CommonTestFiles_Scanner" ||
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

    Framework.registerProvider("CommonTestFiles_Provider", CommonTestFiles_Provider);
})(Framework);
