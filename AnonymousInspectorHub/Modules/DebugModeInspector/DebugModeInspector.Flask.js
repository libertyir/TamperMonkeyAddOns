(function () {
    "use strict";

    const namespace =
        globalThis.AnonymousInspectorDebugMode;

    if (!namespace) {
        throw new Error(
            "DebugModeInspector namespace is not initialized."
        );
    }

    class Flask {

        static id = "Flask";

        static title = "Flask";

        constructor() {
            this.maxProbes = 2;

            this.patterns = [
                {
                    id: "werkzeug-debugger",
                    regex: /Werkzeug Debugger/i,
                    confidence: 0.99,
                    classification: "confirmed",
                    description:
                        "Werkzeug interactive debugger detected."
                },
                {
                    id: "werkzeug-console",
                    regex: /werkzeug\.debug\.Console|class=["'][^"']*console[^"']*["'][^>]*>.*Interactive Console/is,
                    confidence: 0.98,
                    classification: "confirmed",
                    description:
                        "Werkzeug interactive debugging console detected."
                },
                {
                    id: "werkzeug-pin",
                    regex: /(?:PIN:\s*\d{4,}|PIN authentication)/i,
                    confidence: 0.98,
                    classification: "confirmed",
                    description:
                        "Werkzeug debugger PIN information detected."
                },
                {
                    id: "python-traceback",
                    regex: /Traceback \(most recent call last\):[\s\S]{0,1000}(?:File "[^"]+\.py"|During handling of the above exception)/i,
                    confidence: 0.95,
                    classification: "confirmed",
                    description:
                        "Python traceback details exposed."
                },
                {
                    id: "flask-exception",
                    regex: /(?:flask\.app|flask\.wrappers)\.(?:full_dispatch_request|dispatch_request|wsgi_app)/i,
                    confidence: 0.90,
                    classification: "confirmed",
                    description:
                        "Flask internal exception details exposed."
                },
                {
                    id: "python-source-path",
                    regex: /File "([^"]+\.py)", line \d+/i,
                    confidence: 0.85,
                    classification: "exposed",
                    description:
                        "Internal Python source file path and line number exposed."
                },
                {
                    id: "flask-secret-key",
                    regex: /\bSECRET_KEY\s*[:=]\s*["'][^"']{20,}["']/i,
                    confidence: 0.99,
                    classification: "exposed",
                    description:
                        "Flask secret key exposed."
                },
                {
                    id: "flask-debug-config",
                    regex: /\b(?:FLASK_DEBUG|DEBUG)\s*[:=]\s*(?:true|True|1)/,
                    confidence: 0.85,
                    classification: "suspected",
                    description:
                        "Flask debug configuration appears enabled."
                },
                {
                    id: "python-environment",
                    regex: /\b(?:FLASK_APP|FLASK_ENV)\s*[:=]\s*["']?[^"'\s<]+/i,
                    confidence: 0.75,
                    classification: "exposed",
                    description:
                        "Flask environment configuration exposed."
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
                    platform: Flask.id,
                    type: "flask-response",
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
                        platform: Flask.id,
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
                        platform: Flask.id,
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
                    platform: Flask.id,
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
        Flask.id,
        new Flask()
    );

})();