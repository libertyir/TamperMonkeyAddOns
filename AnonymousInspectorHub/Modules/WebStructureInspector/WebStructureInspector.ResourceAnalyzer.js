(function (root) {
    "use strict";

    const ns = root.AnonymousInspectorWebStructure =
        root.AnonymousInspectorWebStructure || {};

    class ResourceAnalyzer {
        constructor() {
            this.sensitiveExtensions = new Set([
                "config", "ini", "conf", "env",
                "txt", "xml", "xls", "xlsx",
                "json", "bak", "backup", "old",
                "sql", "db", "sqlite", "log",
                "key", "pem", "p12", "pfx"
            ]);

            this.executableExtensions = new Set([
                "exe", "dll", "msi", "bin", "so", "dylib"
            ]);

            this.sensitiveNames = new Set([
                ".env",
                ".env.production",
                ".git",
                ".svn",
                "web.config",
                "appsettings.json",
                "wp-config.php",
                "database.yml",
                "local_settings.py",
                "backup.sql",
                "database.sql"
            ]);
        }

        analyze(rawUrl, source = "unknown", extra = {}) {
            let url;

            try {
                url = new URL(rawUrl, location.href);
            } catch {
                return null;
            }

            if (url.origin !== location.origin) return null;

            const path = url.pathname;
            const name = path.split("/").filter(Boolean).pop() || "/";
            const extensionMatch = name.match(/\.([a-z0-9]{1,12})$/i);
            const extension = extensionMatch
                ? extensionMatch[1].toLowerCase()
                : "";

            const isDirectory = path.endsWith("/") || name === "/";
            const tags = [];

            let type = isDirectory ? "directory" : "file";

            if (isDirectory) {
                type = "directory";
            } else if (
                ["js", "mjs", "cjs"].includes(extension)
            ) {
                type = "javascript";
            } else if (extension === "css") {
                type = "stylesheet";
            } else if (["html", "htm"].includes(extension)) {
                type = "html";
            } else if (
                ["png", "jpg", "jpeg", "gif", "svg", "webp", "ico"].includes(extension)
            ) {
                type = "image";
            } else if (
                ["woff", "woff2", "ttf", "otf"].includes(extension)
            ) {
                type = "font";
            } else if (this.executableExtensions.has(extension)) {
                type = "executable";
                tags.push("executable");
            } else if (extension) {
                type = extension;
            } else if (!isDirectory) {
                type = "endpoint";
            }

            const lowerName = name.toLowerCase();

            if (
                this.sensitiveExtensions.has(extension) ||
                this.sensitiveNames.has(lowerName)
            ) {
                tags.push("sensitive-type");
            }

            if (
                lowerName.includes("backup") ||
                lowerName.includes("dump") ||
                lowerName.endsWith(".bak") ||
                lowerName.endsWith(".old")
            ) {
                tags.push("backup");
            }

            return {
                url: url.href,
                path,
                name,
                type,
                extension,
                status: extra.status || "observed",
                sources: [source],
                tags,
                contentType: extra.contentType || null,
                size: Number.isFinite(extra.size) ? extra.size : null,
                directoryListing: false
            };
        }
    }

    ns.ResourceAnalyzer = ResourceAnalyzer;

})(globalThis);