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
            this.concurrency = 4;

            this.knownFiles = [
                ".env",
                ".env.production",
                ".env.local",
                ".env.backup",
                ".git-credentials",
                ".htpasswd",
                ".npmrc",
                ".pypirc",
                "id_rsa",
                "id_ed25519",
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
                "php_error.log",
                "credentials.json",
                "secrets.json",
                "secrets.yml",
                "dump.sql",
                "backup.tar.gz"
            ];
        }

        async readLimited(response) {
            if (!response.body) return "";

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            let output = "";
            let total = 0;
            let truncated = false;

            try {
                while (total < this.maxContentSize) {
                    const { done, value } = await reader.read();

                    if (done) break;
                    if (!value) continue;

                    const remaining = this.maxContentSize - total;
                    const chunk = value.subarray(0, remaining);

                    output += decoder.decode(chunk, { stream: true });
                    total += chunk.length;

                    if (chunk.length < value.length) {
                        truncated = true;
                        break;
                    }
                }

                if (!truncated && total >= this.maxContentSize) {
                    truncated = true;
                }

                output += decoder.decode();

                return {
                    text: truncated ? "" : output,
                    truncated
                };
            } finally {
                reader.cancel().catch(() => {});
            }
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
                return /(?:DB_PASSWORD|DB_HOST|APP_KEY|APP_SECRET|API_KEY|DATABASE_URL|SECRET_KEY|PRIVATE_KEY)\s*=/i
                    .test(text);
            }

            if (
                /(?:credentials|secrets|config|settings).*\.json$/i.test(lower) ||
                /\.json$/i.test(lower)
            ) {
                return /"(?:password|secret|client_secret|api_key|access_token|refresh_token|connectionString|private_key)"\s*:/i
                    .test(text);
            }

            if (/\.(?:ini|config|conf|xml|yml|yaml)$/i.test(lower)) {
                return /(?:password|secret|api[_-]?key|connectionString|private[_-]?key|access[_-]?token)/i
                    .test(text);
            }

            if (/\.(?:sql|log|txt)$/i.test(lower)) {
                return /(?:password|secret|token|authorization|CREATE TABLE|INSERT INTO)/i
                    .test(text);
            }

            if (/\.(?:pem|key|crt|cer|p12|pfx)$/i.test(lower)) {
                return /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?(?:PRIVATE KEY|CERTIFICATE)-----/i
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
                    signal: controller.signal,
                    headers: {
                        "Accept": "text/plain, application/json, application/xml, application/octet-stream, */*"
                    }
                });

                if (
                    response.type === "opaqueredirect" ||
                    !response.ok
                ) {
                    return null;
                }

                const finalUrl = new URL(response.url || url.href);

                if (finalUrl.origin !== location.origin) return null;
                if (finalUrl.username || finalUrl.password) return null;

                const contentType =
                    response.headers.get("content-type") || "";

                const result = await this.readLimited(response);

                if (result.truncated || !result.text) return null;
                if (this.isHtml(contentType, result.text)) return null;

                const name = finalUrl.pathname.split("/").pop() || "";
                const confirmed = this.hasSensitiveContent(
                    name,
                    contentType,
                    result.text
                );

                const record = this.module.analyzer.analyze(
                    finalUrl.href,
                    "sensitive-scan",
                    {
                        status: "verified",
                        contentType
                    }
                );

                if (!record) return null;

                record.status = confirmed ? "confirmed" : "verified";
                record.tags = [
                    ...new Set([
                        ...record.tags.filter(tag =>
                            !tag.startsWith("sensitive")
                        ),
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

                return record;
            } finally {
                clearTimeout(timeoutId);
            }
        }

        async inspectCandidates(candidates) {
            const results = [];

            for (
                let i = 0;
                i < candidates.length;
                i += this.concurrency
            ) {
                const batch = candidates.slice(
                    i,
                    i + this.concurrency
                );

                const batchResults = await Promise.all(
                    batch.map(url =>
                        this.inspectFile(url).catch(() => null)
                    )
                );

                results.push(...batchResults.filter(Boolean));
            }

            return results;
        }

        async scan(rawDirectory) {
            const directory = new URL(rawDirectory, location.href);

            if (directory.origin !== location.origin) {
                throw new Error("Sensitive scan is restricted to the current origin.");
            }

            if (directory.username || directory.password) {
                throw new Error("URLs containing credentials are not allowed.");
            }

            if (!directory.pathname.endsWith("/")) {
                directory.pathname += "/";
            }

            directory.search = "";
            directory.hash = "";

            const mode = this.module.settings.sensitiveDetection;

            if (!["extension-name", "content", "both"].includes(mode)) {
                throw new Error("Invalid sensitive detection mode.");
            }

            const records = this.module.store.getAll();

            if (
                mode === "extension-name" ||
                mode === "both"
            ) {
                for (const record of records) {
                    if (!record.path.startsWith(directory.pathname)) continue;

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
                return {
                    candidatesChecked: 0,
                    sensitiveFound: this.module.store.getSensitive().length,
                    scannedAt: new Date().toISOString()
                };
            }

            const candidates = this.knownFiles
                .slice(0, this.maxCandidates)
                .map(name => new URL(name, directory.href));

            const results = await this.inspectCandidates(candidates);

            await this.module.store.upsertMany(results);

            return {
                candidatesChecked: candidates.length,
                sensitiveFound: results.filter(record =>
                    record.tags.includes("sensitive-confirmed")
                ).length,
                scannedAt: new Date().toISOString()
            };
        }
    }

    ns.SensitiveScanner = SensitiveScanner;

})(globalThis);