(function (root) {
    "use strict";

    const ns = root.AnonymousInspectorWebStructure =
        root.AnonymousInspectorWebStructure || {};

    class SensitiveScanner {
        constructor(module) {
            this.module = module;
            this.maxCandidates = 40;
            this.maxContentSize = 32 * 1024;
            this.timeout = 6000;

            this.knownFiles = [
                ".env",
                ".env.production",
                ".env.local",
                ".env.backup",
                "web.config",
                "appsettings.json",
                "appsettings.Production.json",
                "wp-config.php",
                "composer.json",
                "composer.lock",
                "package.json",
                "database.yml",
                "local_settings.py",
                "config.php",
                "config.ini",
                "database.ini",
                "backup.sql",
                "database.sql",
                "backup.zip",
                "site-backup.zip",
                "error.log",
                "debug.log",
                "laravel.log",
                "php_error.log"
            ];
        }

        async readLimited(response) {
            if (!response.body) return "";

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            let output = "";
            let total = 0;

            try {
                while (total < this.maxContentSize) {
                    const { done, value } = await reader.read();

                    if (done) break;
                    if (!value) continue;

                    const remaining = this.maxContentSize - total;
                    const chunk = value.subarray(0, remaining);

                    output += decoder.decode(chunk, { stream: true });
                    total += chunk.length;

                    if (chunk.length < value.length) break;
                }

                output += decoder.decode();
            } finally {
                reader.cancel().catch(() => {});
            }

            return output;
        }

        isHtml(contentType, text) {
            return (
                /text\/html/i.test(contentType) ||
                /^\s*(?:<!doctype html|<html|<head|<body)/i.test(text)
            );
        }

        hasSensitiveContent(name, contentType, text) {
            const lower = name.toLowerCase();

            if (
                lower === ".env" ||
                lower.startsWith(".env.") ||
                lower === "wp-config.php"
            ) {
                return /(?:DB_PASSWORD|DB_HOST|APP_KEY|APP_SECRET|API_KEY|DATABASE_URL)\s*=/i
                    .test(text);
            }

            if (/\.json$/i.test(name)) {
                return /"(?:password|secret|client_secret|api_key|access_token|connectionString)"\s*:/i
                    .test(text);
            }

            if (/\.(?:ini|config|conf|xml|yml|yaml)$/i.test(name)) {
                return /(?:password|secret|api[_-]?key|connectionString|private[_-]?key)/i
                    .test(text);
            }

            if (/\.(?:sql|log|txt)$/i.test(name)) {
                return /(?:password|secret|token|authorization|CREATE TABLE|INSERT INTO)/i
                    .test(text);
            }

            return false;
        }

        async inspectFile(url) {
            const controller = new AbortController();
            const timeoutId = setTimeout(
                () => controller.abort(),
                this.timeout
            );

            try {
                const response = await fetch(url.href, {
                    method: "GET",
                    credentials: "same-origin",
                    redirect: "manual",
                    cache: "no-store",
                    signal: controller.signal
                });

                if (
                    response.type === "opaqueredirect" ||
                    !response.ok
                ) {
                    return null;
                }

                const finalUrl = new URL(response.url || url.href);

                if (finalUrl.origin !== location.origin) return null;

                const contentType =
                    response.headers.get("content-type") || "";

                const text = await this.readLimited(response);

                if (!text) return null;
                if (this.isHtml(contentType, text)) return null;

                const name = url.pathname.split("/").pop() || "";
                const confirmed = this.hasSensitiveContent(
                    name,
                    contentType,
                    text
                );

                const record = this.module.analyzer.analyze(
                    url.href,
                    "sensitive-scan",
                    {
                        status: "verified",
                        contentType
                    }
                );

                if (!record) return null;

                record.status = "verified";
                record.tags = [
                    ...new Set([
                        ...record.tags,
                        confirmed
                            ? "sensitive-confirmed"
                            : "sensitive-type"
                    ])
                ];

                record.sensitive = {
                    confirmed,
                    contentAnalyzed: true,
                    valuesStored: false
                };

                // Raw response text is deliberately not retained.
                return record;
            } finally {
                clearTimeout(timeoutId);
            }
        }

        async scan(rawDirectory) {
            const directory = new URL(rawDirectory, location.href);

            if (directory.origin !== location.origin) {
                throw new Error("Sensitive scan is restricted to the current origin.");
            }

            if (!directory.pathname.endsWith("/")) {
                directory.pathname += "/";
            }

            const mode = this.module.settings.sensitiveDetection;
            const records = this.module.store.getAll();

            // First tag already-known resources without making requests.
            for (const record of records) {
                if (!record.path.startsWith(directory.pathname)) continue;

                if (
                    mode === "extension-name" ||
                    mode === "both"
                ) {
                    const analyzed = this.module.analyzer.analyze(
                        record.url,
                        "sensitive-classification"
                    );

                    if (
                        analyzed &&
                        analyzed.tags.includes("sensitive-type")
                    ) {
                        record.tags = [
                            ...new Set([
                                ...(record.tags || []),
                                "sensitive-type"
                            ])
                        ];

                        this.module.store.upsert(record, false);
                    }
                }
            }

            if (mode === "extension-name") {
                await this.module.store.save();
                return;
            }

            const candidates = this.knownFiles
                .slice(0, this.maxCandidates)
                .map(name => new URL(name, directory.href));

            const results = await Promise.all(
                candidates.map(url =>
                    this.inspectFile(url).catch(() => null)
                )
            );

            await this.module.store.upsertMany(
                results.filter(Boolean)
            );
        }
    }

    ns.SensitiveScanner = SensitiveScanner;

})(globalThis);