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
            if (!response.body) {
                return {
                    text: "",
                    truncated: false
                };
            }

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

        createRecord(url, status, contentType, mode, confirmed, contentAnalyzed) {
            const record = this.module.analyzer.analyze(
                url.href,
                "sensitive-scan",
                {
                    status,
                    contentType
                }
            );

            if (!record) return null;

            const isNameSensitive =
                record.tags.includes("sensitive-type");

            record.tags = record.tags.filter(tag =>
                !tag.startsWith("sensitive")
            );

            if (confirmed) {
                record.tags.push("sensitive-confirmed");
            } else if (
                (mode === "extension-name" || mode === "both") &&
                isNameSensitive
            ) {
                record.tags.push("sensitive-type");
            }

            record.status = status;

            record.sensitive = {
                confirmed,
                contentAnalyzed,
                valuesStored: false,
                access: "accessible"
            };

            return record;
        }

        createDeniedRecord(url) {
            const record = this.module.analyzer.analyze(
                url.href,
                "sensitive-scan",
                {
                    status: "denied"
                }
            );

            if (!record) return null;

            record.tags = record.tags.filter(tag =>
                !tag.startsWith("sensitive")
            );

            record.status = "denied";

            record.sensitive = {
                confirmed: false,
                contentAnalyzed: false,
                valuesStored: false,
                access: "denied"
            };

            return record;
        }

        async inspectFile(url, mode) {
            const service = Framework.SiteIntelligence;

            if (!service || typeof service.scan !== "function") {
                throw new Error("Central Site Intelligence service is unavailable.");
            }

            const result = await service.scan(url.href, {
                source: "WebStructureInspector.SensitiveScanner",
                needContent: mode === "content" || mode === "both",
                force: true
            });

            if (result.status === 404) {
                return {
                    url: url.href,
                    status: 404,
                    record: null
                };
            }

            if (result.status === 403) {
                return {
                    url: url.href,
                    status: 403,
                    record: this.createDeniedRecord(url)
                };
            }

            const central = result.record;
            if (!central) {
                return {
                    url: url.href,
                    status: result.status,
                    record: null
                };
            }

            const content = typeof result.content === "string"
                ? result.content
                : "";

            const contentType = central.contentType || "";
            const name = new URL(result.url || url.href).pathname.split("/").pop() || "";
            const contentAnalyzed = Boolean(
                (mode === "content" || mode === "both") &&
                result.contentAvailable &&
                content &&
                !this.isHtml(contentType, content)
            );

            const confirmed = contentAnalyzed &&
                this.hasSensitiveContent(name, contentType, content);

            const record = this.createRecord(
                new URL(result.url || url.href),
                central.status === "accessible" ? "verified" : central.status,
                contentType,
                mode,
                confirmed,
                contentAnalyzed
            );

            return {
                url: result.url || url.href,
                status: result.status,
                record
            };
        }

        async inspectCandidates(candidates, mode) {
            const results = [];
            const missing = [];

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
                        this.inspectFile(url, mode).catch(() => null)
                    )
                );

                for (const result of batchResults) {
                    if (!result) continue;

                    if (result.status === 404) {
                        missing.push(result.url);
                    } else if (result.record) {
                        results.push(result.record);
                    }
                }
            }

            return {
                results,
                missing
            };
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

            const candidates = new Map();

            const existingRecords = this.module.store.getAll().filter(record =>
                typeof record.path === "string" &&
                record.path.startsWith(directory.pathname) &&
                record.type !== "directory"
            );

            for (const record of existingRecords) {
                try {
                    const url = new URL(record.url);

                    candidates.set(url.pathname, url);
                } catch {
                    continue;
                }
            }

            for (const name of this.knownFiles) {
                const url = new URL(name, directory.href);

                candidates.set(url.pathname, url);
            }

            const candidateList = [...candidates.values()]
                .slice(0, this.maxCandidates);

            const inspected = await this.inspectCandidates(
                candidateList,
                mode
            );

            const removed = await this.module.store.removeMany(
                inspected.missing
            );

            await this.module.store.replaceMany(
                inspected.results
            );

            return {
                candidatesChecked: candidateList.length,
                sensitiveFound: this.module.store.getSensitive().filter(
                    record => record.path.startsWith(directory.pathname)
                ).length,
                removed,
                scannedAt: new Date().toISOString()
            };
        }
    }

    ns.SensitiveScanner = SensitiveScanner;

})(globalThis);