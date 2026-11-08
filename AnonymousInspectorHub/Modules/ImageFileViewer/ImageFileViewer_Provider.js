(function (Framework) {
    "use strict";

    const extensions = new Set([
        "ico", "png", "jpg", "jpeg", "gif",
        "webp", "bmp", "avif", "svg", "tif", "tiff"
    ]);

    class ImageFileViewerProvider extends Framework.BaseProvider {
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

                return extensions.has(extension) ||
                    /^image\//i.test(String(resource.contentType || ""));
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

    Framework.registerProvider("ImageFileViewer_Provider", ImageFileViewerProvider);
})(Framework);
