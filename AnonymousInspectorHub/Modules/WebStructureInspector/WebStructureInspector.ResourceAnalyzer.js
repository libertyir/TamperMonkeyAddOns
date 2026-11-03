(function (root) {
    "use strict";

    const ns = root.AnonymousInspectorWebStructure =
        root.AnonymousInspectorWebStructure || {};

    class ResourceAnalyzer {
        constructor() {
            this.sensitiveExtensions = new Set([
                "ini", "conf", "env",
                "sql", "db", "sqlite",
                "bak", "backup", "old",
                "key", "pem", "p12", "pfx",
                "p7b", "p7c", "p8",
                "crt", "cer",
                "log"
            ]);

            this.executableExtensions = new Set([
                "exe", "dll", "msi", "bin", "so", "dylib"
            ]);

            this.sensitiveNames = new Set([
                ".env",
                ".env.local",
                ".env.development",
                ".env.production",
                ".env.staging",
                ".git",
                ".gitignore",
                ".git-credentials",
                ".htaccess",
                ".htpasswd",
                ".npmrc",
                ".pypirc",
                ".dockercfg",
                "id_rsa",
                "id_dsa",
                "id_ecdsa",
                "id_ed25519",
                "web.config",
                "appsettings.json",
                "wp-config.php",
                "database.yml",
                "local_settings.py",
                "backup.sql",
                "database.sql",
                "credentials",
                "credentials.json",
                "secrets.json",
                "secrets.yml"
            ]);

            this.sensitivePatterns = [
                /(^|\/)\.env(?:\.[^/]*)?$/i,
                /(^|\/)(?:config|configuration|settings|secrets|credentials)(?:\.[^/]*)?$/i,
                /(^|\/)(?:id_rsa|id_dsa|id_ecdsa|id_ed25519)(?:\.[^/]*)?$/i,
                /\.(?:sql|sqlite|db)(?:\.(?:gz|zip|tar))?$/i,
                /\.(?:bak|backup|old|orig|save|swp|swo|tmp|dump)$/i,
                /\.(?:pem|key|p12|pfx|p7b|p7c|p8)$/i,
                /\.(?:log|conf|ini)$/i,
                /(?:^|\/)(?:\.git|\.svn)(?:\/|$)/i
            ];

            this.backupPatterns = [
                /backup/i,
                /dump/i,
                /\.(?:bak|backup|old|orig|save|swp|swo|tmp)$/i,
                /\.(?:sql|db)(?:\.\d{4,8}|\.\d{4}-\d{2}-\d{2})?$/i,
                /(?:^|[._-])\d{4}-\d{2}-\d{2}(?:[._-]|$)/i
            ];

            this.imageExtensions = new Set([
                "png", "jpg", "jpeg", "gif", "svg",
                "webp", "ico", "bmp", "avif"
            ]);

            this.fontExtensions = new Set([
                "woff", "woff2", "ttf", "otf", "eot"
            ]);

            this.audioExtensions = new Set([
                "mp3", "wav", "ogg", "m4a", "aac", "flac"
            ]);

            this.videoExtensions = new Set([
                "mp4", "webm", "mov", "avi", "mkv"
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
            if (url.username || url.password) return null;

            const path = url.pathname;
            const normalizedPath = path.toLowerCase();
            const name = path.split("/").filter(Boolean).pop() || "/";
            const lowerName = name.toLowerCase();
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
            } else if (extension === "pdf") {
                type = "document";
            } else if (this.imageExtensions.has(extension)) {
                type = "image";
            } else if (this.fontExtensions.has(extension)) {
                type = "font";
            } else if (this.audioExtensions.has(extension)) {
                type = "audio";
            } else if (this.videoExtensions.has(extension)) {
                type = "video";
            } else if (this.executableExtensions.has(extension)) {
                type = "executable";
                tags.push("executable");
            } else if (extension) {
                type = extension;
            } else if (!isDirectory) {
                type = "endpoint";
            }

            if (
                this.sensitiveExtensions.has(extension) ||
                this.sensitiveNames.has(lowerName) ||
                this.sensitivePatterns.some(pattern =>
                    pattern.test(normalizedPath)
                )
            ) {
                tags.push("sensitive-type");
            }

            if (
                this.backupPatterns.some(pattern =>
                    pattern.test(normalizedPath)
                )
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