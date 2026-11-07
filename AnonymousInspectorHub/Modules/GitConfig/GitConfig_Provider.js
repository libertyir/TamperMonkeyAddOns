(function (Framework) {
    "use strict";

    class GitConfigProvider extends Framework.BaseProvider {
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

            const normalized = pathname
                .replace(/\\/g, "/")
                .toLowerCase();

            return (
                normalized.endsWith("/.git/config") ||
                normalized === ".git/config"
            );
        }

        async getResult(context = {}) {
            const source = context.url ||
                context.resource?.url ||
                context.resource?.path ||
                window.location.href;

            let origin;

            try {
                origin = new URL(
                    source,
                    window.location.href
                ).origin;
            } catch {
                return null;
            }

            const directoryUrl = origin + "/";

            const key = [
                "module-result",
                "GitConfig_Scanner",
                encodeURIComponent(directoryUrl)
            ].join(":");

            const record = await Framework.Storage.getMetadata(key);

            if (
                !record ||
                record.moduleId !== "GitConfig_Scanner" ||
                record.scope !== directoryUrl ||
                record.schemaVersion !== 1 ||
                !record.data ||
                typeof record.data.content !== "string" ||
                record.data.fileName !== ".git/config" ||
                record.data.directoryUrl !== directoryUrl ||
                record.data.content.length > 262144
            ) {
                return null;
            }

            try {
                const fileUrl = new URL(record.data.fileUrl);

                if (
                    fileUrl.origin !== origin ||
                    fileUrl.pathname !== "/.git/config" ||
                    !/^\s*\[[^\]]+\]/m.test(record.data.content) ||
                    !/^\s*[\w.-]+\s*=/m.test(record.data.content)
                ) {
                    return null;
                }
            } catch {
                return null;
            }

            return record.data;
        }

        async getStatus(context = {}) {
            const result = await this.getResult(context);

            return {
                available: Boolean(result),
                contentLength: result
                    ? result.contentLength
                    : 0,
                scannedAt: result
                    ? result.scannedAt
                    : null
            };
        }
    }

    Framework.registerProvider("GitConfig_Provider", GitConfigProvider);
})(Framework);
