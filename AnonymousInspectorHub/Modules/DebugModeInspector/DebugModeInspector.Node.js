(function () {
    "use strict";

    const namespace =
        globalThis.AnonymousInspectorDebugMode;

    if (!namespace) {
        throw new Error(
            "DebugModeInspector namespace is not initialized."
        );
    }

    class Node {

        static id = "Node";

        static title = "Node.js / Express";

        constructor() {
            this.maxProbes = 2;

            this.patterns = [
                {
                    id: "node-stack-trace",
                    regex: /(?:TypeError|ReferenceError|SyntaxError|RangeError):\s*[\s\S]{0,500}?\n\s+at\s+/i,
                    confidence: 0.95,
                    classification: "confirmed",
                    description:
                        "Node.js exception stack trace detected."
                },
                {
                    id: "express-error-handler",
                    regex: /at Layer\.handle_error|at Function\.handle/i,
                    confidence: 0.95,
                    classification: "confirmed",
                    description:
                        "Express.js internal error handler trace detected."
                },
                {
                    id: "node-internal-path",
                    regex: /node:internal\/(?:modules|process|errors|streams)\//i,
                    confidence: 0.85,
                    classification: "exposed",
                    description:
                        "Node.js internal runtime path exposed."
                },
                {
                    id: "node-modules-path",
                    regex: /(?:\/node_modules\/[^<>\r\n"]+|\\node_modules\\[^<>\r\n"]+)/i,
                    confidence: 0.85,
                    classification: "exposed",
                    description:
                        "Internal Node.js dependency path exposed."
                },
                {
                    id: "node-source-path",
                    regex: /(?:\/(?:var\/www|home|srv|app)\/[^<>\r\n"]+\.js|[A-Z]:\\[^<>\r\n"]+\.js)/i,
                    confidence: 0.85,
                    classification: "exposed",
                    description:
                        "Internal JavaScript source path exposed."
                },
                {
                    id: "express-error-page",
                    regex: /Cannot\s+(?:GET|POST|PUT|DELETE)\s+\/[^\s<]*/i,
                    confidence: 0.65,
                    classification: "suspected",
                    description:
                        "Express-style route error response detected."
                },
                {
                    id: "node-debug-config",
                    regex: /\b(?:NODE_ENV|DEBUG)\s*[:=]\s*["']?(?:development|true|1)/i,
                    confidence: 0.75,
                    classification: "suspected",
                    description:
                        "Node.js development or debug configuration exposed."
                },
                {
                    id: "node-sensitive-env",
                    regex: /\b(?:JWT_SECRET|SESSION_SECRET|DATABASE_URL|REDIS_PASSWORD)\s*[:=]\s*["']?[^"'\s<]{8,}/i,
                    confidence: 0.98,
                    classification: "exposed",
                    description:
                        "Sensitive Node.js application configuration exposed."
                },
                {
                    id: "node-error-object",
                    regex: /(?:Error:|UnhandledPromiseRejection|Unhandled Rejection)/i,
                    confidence: 0.75,
                    classification: "suspected",
                    description:
                        "Node.js runtime error information detected."
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
                    platform: Node.id,
                    type: "node-response",
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
                        platform: Node.id,
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
                        platform: Node.id,
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
                    platform: Node.id,
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
        Node.id,
        new Node()
    );

})();