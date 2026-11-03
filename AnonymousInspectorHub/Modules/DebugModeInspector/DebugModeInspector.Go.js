(function () {
    "use strict";

    const namespace =
        globalThis.AnonymousInspectorDebugMode;

    if (!namespace) {
        throw new Error(
            "DebugModeInspector namespace is not initialized."
        );
    }

    class Go {

        static id = "Go";
        static title = "Go / Gin / Echo / Fiber";

        constructor() {
            this.patterns = [
                {
                    id: "go-stack-trace",
                    regex: /goroutine\s+\d+\s+\[[^\]]+\]:[\s\S]{0,1000}?\n\s+[\w./-]+\.go:\d+/i,
                    classification: "exposed",
                    confidence: 0.95,
                    description: "Go goroutine stack trace exposed."
                },
                {
                    id: "go-panic",
                    regex: /panic:\s*[^\r\n<]+/i,
                    classification: "exposed",
                    confidence: 0.90,
                    description: "Go panic information exposed."
                },
                {
                    id: "go-source-path",
                    regex: /(?:\/(?:go\/src|app|srv|var\/www)\/[^<>\r\n"]+\.go|[A-Z]:\\[^<>\r\n"]+\.go)/i,
                    classification: "exposed",
                    confidence: 0.85,
                    description: "Go source file path exposed."
                },
                {
                    id: "go-runtime-path",
                    regex: /runtime\/(?:panic|proc|asm|internal)\.go:\d+/i,
                    classification: "exposed",
                    confidence: 0.90,
                    description: "Go runtime internal path exposed."
                },
                {
                    id: "gin-framework-error",
                    regex: /\[GIN\]\s+\d{4}\/\d{2}\/\d{2}|github\.com\/gin-gonic\/gin/i,
                    classification: "suspected",
                    confidence: 0.80,
                    description: "Gin framework diagnostic information detected."
                },
                {
                    id: "echo-framework-error",
                    regex: /github\.com\/labstack\/echo|echo\.HTTPError/i,
                    classification: "suspected",
                    confidence: 0.80,
                    description: "Echo framework diagnostic information detected."
                },
                {
                    id: "fiber-framework-error",
                    regex: /github\.com\/gofiber\/fiber|fiber\.Error/i,
                    classification: "suspected",
                    confidence: 0.80,
                    description: "Fiber framework diagnostic information detected."
                },
                {
                    id: "go-debug-config",
                    regex: /\b(?:GIN_MODE|GO_ENV)\s*[:=]\s*["']?(?:debug|development)\b/i,
                    classification: "suspected",
                    confidence: 0.75,
                    description: "Go application debug configuration indicator detected."
                },
                {
                    id: "go-version",
                    regex: /\bgo version go\d+\.\d+(?:\.\d+)?/i,
                    classification: "exposed",
                    confidence: 0.85,
                    description: "Go runtime version exposed."
                },
                {
                    id: "go-sensitive-config",
                    regex: /\b(?:DATABASE_URL|JWT_SECRET|API_SECRET|AWS_SECRET_ACCESS_KEY)\s*[:=]\s*["']?[^"'\s<]{8,}/i,
                    classification: "exposed",
                    confidence: 0.98,
                    description: "Sensitive Go application configuration exposed."
                }
            ];
        }

        // ==================================================
        // RESPONSE ANALYSIS
        // ==================================================

        redactSensitiveValue(value, patternId) {
            if (
                patternId === "go-sensitive-config" &&
                typeof value === "string"
            ) {
                return value.replace(
                    /([:=]\s*["']?)[^"'\s<]+/i,
                    "$1[REDACTED]"
                );
            }

            return String(value).slice(0, 500);
        }

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
                    platform: Go.id,
                    type: "go-response",
                    classification: pattern.classification,
                    confidence: pattern.confidence,
                    description: pattern.description,
                    value: this.redactSensitiveValue(
                        match[0],
                        pattern.id
                    ),
                    source: "HTTP GET response",
                    url: sourceUrl
                });
            }

            return findings;
        }

        // ==================================================
        // REQUEST EXECUTION
        // ==================================================

        async inspectCurrentPage(context, requestManager) {
            const url = context.url || location.href;

            try {
                const response =
                    await requestManager.get(url);

                if (
                    !response ||
                    typeof response.body !== "string"
                ) {
                    return {
                        findings: [],
                        error: null
                    };
                }

                return {
                    findings: this.analyzeResponse(
                        response.body,
                        url
                    ),
                    error: null
                };

            } catch (error) {
                return {
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
                        platform: Go.id,
                        completed: false,
                        error: "RequestManager is unavailable."
                    }
                };
            }

            const result = await this.inspectCurrentPage(
                context,
                requestManager
            );

            return {
                findings: result.findings,

                metadata: {
                    platform: Go.id,
                    completed: true,
                    probes: 1,
                    successfulFindings: result.findings.length,
                    errors: result.error
                        ? [{
                            url: context.url || location.href,
                            message: result.error
                        }]
                        : []
                }
            };
        }
    }

    // ==================================================
    // REGISTER PLATFORM
    // ==================================================

    namespace.registerPlatform(
        Go.id,
        new Go()
    );

})();