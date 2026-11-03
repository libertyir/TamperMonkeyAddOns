(function () {
    "use strict";

    const namespace =
        globalThis.AnonymousInspectorDebugMode;

    if (!namespace) {
        throw new Error(
            "DebugModeInspector namespace is not initialized."
        );
    }

    class PHP {

        static id = "PHP";

        static title = "PHP";

        constructor() {
            this.maxProbes = 2;

            this.patterns = [
                {
                    id: "php-fatal-error",
                    regex: /Fatal error:\s*.+?(?:in\s+.+?\s+on line\s+\d+)?/i,
                    confidence: 0.95,
                    classification: "confirmed",
                    description:
                        "PHP fatal error details exposed."
                },
                {
                    id: "php-uncaught-exception",
                    regex: /Uncaught\s+(?:Error|Exception|Throwable):/i,
                    confidence: 0.95,
                    classification: "confirmed",
                    description:
                        "Uncaught PHP exception details exposed."
                },
                {
                    id: "php-warning",
                    regex: /Warning:\s*.+?\s+in\s+.+?\s+on line\s+\d+/i,
                    confidence: 0.90,
                    classification: "confirmed",
                    description:
                        "PHP warning details exposed."
                },
                {
                    id: "php-notice",
                    regex: /Notice:\s*.+?\s+in\s+.+?\s+on line\s+\d+/i,
                    confidence: 0.85,
                    classification: "confirmed",
                    description:
                        "PHP notice details exposed."
                },
                {
                    id: "php-stack-trace",
                    regex: /Stack trace:\s*(?:#\d+\s+.+\n?)+/i,
                    confidence: 0.95,
                    classification: "confirmed",
                    description:
                        "PHP stack trace exposed."
                },
                {
                    id: "php-source-path",
                    regex: /(?:\/(?:var\/www|home|srv|usr\/share)\/[^<>\r\n"]+\.php|[A-Z]:\\[^<>\r\n"]+\.php)/i,
                    confidence: 0.90,
                    classification: "exposed",
                    description:
                        "Internal PHP filesystem path exposed."
                },
                {
                    id: "php-configuration",
                    regex: /\b(?:display_errors|display_startup_errors)\s*=\s*(?:On|1|true)/i,
                    confidence: 0.85,
                    classification: "suspected",
                    description:
                        "PHP error display configuration appears enabled."
                },
                {
                    id: "php-version",
                    regex: /PHP\/\d+\.\d+(?:\.\d+)?/i,
                    confidence: 0.80,
                    classification: "exposed",
                    description:
                        "PHP runtime version disclosed."
                },
                {
                    id: "php-database-error",
                    regex: /(?:PDOException|mysqli_sql_exception|SQLSTATE\[[A-Z0-9]+\])/i,
                    confidence: 0.90,
                    classification: "confirmed",
                    description:
                        "Detailed PHP database exception exposed."
                },
                {
                    id: "php-sensitive-configuration",
                    regex: /\b(?:DB_PASSWORD|DATABASE_PASSWORD|SECRET_KEY)\s*[:=]\s*["']?[^"'\s<]{4,}/i,
                    confidence: 0.95,
                    classification: "exposed",
                    description:
                        "Sensitive PHP application configuration exposed."
                }
            ];
        }

        // ==================================================
        // URL HELPERS
        // ==================================================

        getOrigin(context) {
            return context.origin ||
                new URL(
                    context.url || location.href
                ).origin;
        }

        getCurrentUrl(context) {
            return context.url || location.href;
        }

        getProbeUrls(context) {
            const origin = this.getOrigin(context);

            const currentUrl = new URL(
                this.getCurrentUrl(context),
                origin
            );

            const probeUrl = new URL(
                "/__debugmodeinspector_probe_not_found__",
                origin
            );

            return [
                currentUrl.href,
                probeUrl.href
            ].slice(0, this.maxProbes);
        }

        // ==================================================
        // RESPONSE ANALYSIS
        // ==================================================

        analyzeResponse(body, sourceUrl) {
            if (typeof body !== "string" || !body) {
                return [];
            }

            const findings = [];

            for (const pattern of this.patterns) {
                const match = body.match(pattern.regex);

                if (!match) {
                    continue;
                }

                findings.push({
                    id: pattern.id,
                    platform: PHP.id,
                    type: "php-response",
                    classification: pattern.classification,
                    confidence: pattern.confidence,
                    description: pattern.description,
                    value: match[0].slice(0, 500),
                    source: "HTTP GET response",
                    url: sourceUrl
                });
            }

            return findings;
        }

        // ==================================================
        // REQUEST EXECUTION
        // ==================================================

        async inspectUrl(url, requestManager) {
            try {
                const response =
                    await requestManager.get(url);

                if (
                    !response ||
                    typeof response.body !== "string"
                ) {
                    return {
                        url,
                        findings: [],
                        error: null
                    };
                }

                return {
                    url,
                    findings: this.analyzeResponse(
                        response.body,
                        url
                    ),
                    error: null
                };

            } catch (error) {
                return {
                    url,
                    findings: [],
                    error: error.message
                };
            }
        }

        // ==================================================
        // MAIN EXECUTION
        // ==================================================

        async run(context = {}) {
            const requestManager =
                context.requestManager;

            if (
                !requestManager ||
                typeof requestManager.get !== "function"
            ) {
                return {
                    findings: [],
                    metadata: {
                        platform: PHP.id,
                        completed: false,
                        error: "RequestManager is unavailable."
                    }
                };
            }

            let urls;

            try {
                urls = this.getProbeUrls(context);
            } catch (error) {
                return {
                    findings: [],
                    metadata: {
                        platform: PHP.id,
                        completed: false,
                        error: error.message
                    }
                };
            }

            const findings = [];
            const errors = [];

            for (const url of urls) {
                const result = await this.inspectUrl(
                    url,
                    requestManager
                );

                findings.push(...result.findings);

                if (result.error) {
                    errors.push({
                        url,
                        message: result.error
                    });
                }
            }

            return {
                findings,

                metadata: {
                    platform: PHP.id,
                    completed: true,
                    probes: urls.length,
                    successfulFindings: findings.length,
                    errors
                }
            };
        }
    }

    // ==================================================
    // REGISTER PLATFORM
    // ==================================================

    namespace.registerPlatform(
        PHP.id,
        new PHP()
    );

})();