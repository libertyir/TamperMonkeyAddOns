(function (Framework) {
    "use strict";

    const extensions = new Set([
        "txt", "text", "log", "md", "rst", "css", "scss", "less",
        "js", "mjs", "cjs", "ts", "jsx", "tsx", "json", "jsonc",
        "xml", "html", "htm", "xhtml", "svg", "yaml", "yml",
        "toml", "ini", "conf", "csv", "sql", "sh", "py", "rb",
        "php", "java", "c", "h", "cpp", "cs", "go", "rs",
        "vue", "svelte"
    ]);

    class PlainTextViewerProvider extends Framework.BaseProvider {
        matchesResource(resource) {
            if (!resource || typeof resource !== "object" ||
                resource.type === "directory") {
                return false;
            }

            try {
                const rawUrl = resource.url || resource.path || resource.name || "";
                const url = new URL(rawUrl, location.href);

                if (url.origin !== location.origin) {
                    return false;
                }

                const fileName = url.pathname.split("/").pop() || "";
                const match = fileName.match(/\.([a-z0-9]{1,12})$/i);
                const extension = match ? match[1].toLowerCase() : "";
                const contentType = String(resource.contentType || "");

                return extensions.has(extension) ||
                    /^(text\/|application\/(json|xml|javascript|x-javascript))/i.test(contentType);
            } catch {
                return false;
            }
        }

        async getResult(context = {}) {
            const url = context.url || context.fileUrl;

            if (!url) {
                return null;
            }

            try {
                const parsed = new URL(url, location.href);

                if (parsed.origin !== location.origin) {
                    return null;
                }

                return {
                    url: parsed.href,
                    fileUrl: parsed.href,
                    directResource: true
                };
            } catch {
                return null;
            }
        }
    }

    Framework.registerProvider("PlainTextViewer_Provider", PlainTextViewerProvider);
})(Framework);
