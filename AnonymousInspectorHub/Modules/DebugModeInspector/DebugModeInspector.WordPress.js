(function () {
    "use strict";

    const namespace =
        globalThis.AnonymousInspectorDebugMode;

    if (!namespace) {
        throw new Error(
            "DebugModeInspector namespace is not initialized."
        );
    }

    class WordPress {

        static id = "WordPress";

        static title = "WordPress";

        constructor() {
            this.maxProbes = 2;

            this.patterns = [
                {
                    id: "wordpress-database-error",
                    regex: /WordPress database error:/i,
                    confidence: 0.98,
                    classification: "confirmed",
                    description:
                        "WordPress database error details exposed."
                },
                {
                    id: "wordpress-php-error",
                    regex: /(?:Fatal error|Warning|Notice):.+?(?:wp-content|wp-includes)\//is,
                    confidence: 0.95,
                    classification: "confirmed",
                    description:
                        "Detailed PHP error originating from WordPress detected."
                },
                {
                    id: "wordpress-debug-true",
                    regex: /\b(?:WP_DEBUG|WP_DEBUG_DISPLAY)\s*[:=]\s*(?:true|1)/i,
                    confidence: 0.90,
                    classification: "suspected",
                    description:
                        "WordPress debug configuration appears enabled."
                },
                {
                    id: "wordpress-stack-trace",
                    regex: /Stack trace:.*(?:wp-content|wp-includes)\//is,
                    confidence: 0.95,
                    classification: "confirmed",
                    description:
                        "WordPress stack trace exposed."
                },
                {
                    id: "wordpress-source-path",
                    regex: /(?:\/wp-content\/(?:plugins|themes)\/[^<>\r\n"]+\.php|\/wp-includes\/[^<>\r\n"]+\.php)/i,
                    confidence: 0.85,
                    classification: "exposed",
                    description:
                        "Internal WordPress source file path exposed."
                },
                {
                    id: "wordpress-database-credentials",
                    regex: /\b(?:DB_PASSWORD|DB_USER)\s*[:=]\s*["'][^"']+["']/i,
                    confidence: 0.95,
                    classification: "exposed",
                    description:
                        "WordPress database credentials exposed."
                },
                {
                    id: "wordpress-plugin-error",
                    regex: /(?:Plugin|Theme)\s+['"][^'"]+['"].{0,200}(?:Fatal error|Uncaught Error)/is,
                    confidence: 0.90,
                    classification: "confirmed",
                    description:
                        "WordPress plugin or theme exception details exposed."
                },
                {
                    id: "wordpress-version",
                    regex: /<meta[^>]+name=["']generator["'][^>]+content=["']WordPress\s+[\d.]+/i,
                    confidence: 0.70,
                    classification: "exposed",
                    description:
                        "WordPress version disclosed through generator metadata."
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
                    platform: WordPress.id,
                    type: "wordpress-response",
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
                        platform: WordPress.id,
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
                        platform: WordPress.id,
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
                    platform: WordPress.id,
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
        WordPress.id,
        new WordPress()
    );

})();