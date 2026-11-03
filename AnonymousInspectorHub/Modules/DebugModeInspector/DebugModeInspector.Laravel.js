(function () {
    "use strict";

    const namespace =
        globalThis.AnonymousInspectorDebugMode;

    if (!namespace) {
        throw new Error(
            "DebugModeInspector namespace is not initialized."
        );
    }

    class Laravel {

        static id = "Laravel";

        static title = "Laravel";

        constructor() {
            this.maxProbes = 2;

            this.patterns = [
                {
                    id: "laravel-whoops",
                    regex: /Whoops!.*(?:Illuminate\\|Stack trace|Exception)/is,
                    confidence: 0.99,
                    classification: "confirmed",
                    description:
                        "Laravel Whoops exception page detected."
                },
                {
                    id: "laravel-ignition",
                    regex: /Ignition.*(?:Stack trace|Exception|Solution)/is,
                    confidence: 0.98,
                    classification: "confirmed",
                    description:
                        "Laravel Ignition debug page detected."
                },
                {
                    id: "laravel-debug-page",
                    regex: /Illuminate\\(?:Database|Routing|Http|Foundation)\\[A-Za-z0-9\\]+.*(?:Exception|Error)/is,
                    confidence: 0.95,
                    classification: "confirmed",
                    description:
                        "Laravel detailed exception information detected."
                },
                {
                    id: "laravel-stack-trace",
                    regex: /(?:Illuminate\\|vendor\/laravel\/framework\/).{0,300}(?:Stack trace|#\d+)/is,
                    confidence: 0.92,
                    classification: "confirmed",
                    description:
                        "Laravel framework stack trace exposed."
                },
                {
                    id: "laravel-app-debug",
                    regex: /\bAPP_DEBUG\s*[:=]\s*(?:true|1|"true")/i,
                    confidence: 0.95,
                    classification: "confirmed",
                    description:
                        "Laravel APP_DEBUG configuration appears enabled."
                },
                {
                    id: "laravel-app-key",
                    regex: /\bAPP_KEY\s*[:=]\s*(?:base64:)?[A-Za-z0-9+/=]{20,}/i,
                    confidence: 0.99,
                    classification: "exposed",
                    description:
                        "Laravel application encryption key exposed."
                },
                {
                    id: "laravel-env-exposure",
                    regex: /(?:APP_ENV|DB_PASSWORD|MAIL_PASSWORD)\s*[:=]\s*["']?[^"'\s<]{3,}/i,
                    confidence: 0.95,
                    classification: "exposed",
                    description:
                        "Laravel environment configuration value exposed."
                },
                {
                    id: "laravel-source-path",
                    regex: /(?:\/var\/www\/[^<>\r\n"]+|[A-Z]:\\[^<>\r\n"]+)\/(?:vendor\/laravel|app\/Http|app\/Exceptions)\//i,
                    confidence: 0.90,
                    classification: "exposed",
                    description:
                        "Internal Laravel application filesystem path exposed."
                },
                {
                    id: "laravel-sql-error",
                    regex: /Illuminate\\Database\\(?:QueryException|ConnectionException)/i,
                    confidence: 0.90,
                    classification: "confirmed",
                    description:
                        "Detailed Laravel database exception detected."
                },
                {
                    id: "laravel-version",
                    regex: /Laravel Framework\s+v?\d+(?:\.\d+){1,2}/i,
                    confidence: 0.70,
                    classification: "exposed",
                    description:
                        "Laravel framework version disclosed."
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
                    platform: Laravel.id,
                    type: "laravel-response",
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
                        platform: Laravel.id,
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
                        platform: Laravel.id,
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
                    platform: Laravel.id,
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
        Laravel.id,
        new Laravel()
    );

})();