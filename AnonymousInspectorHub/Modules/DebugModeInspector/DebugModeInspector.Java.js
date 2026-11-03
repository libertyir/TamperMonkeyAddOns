(function () {
    "use strict";

    const namespace =
        globalThis.AnonymousInspectorDebugMode;

    if (!namespace) {
        throw new Error(
            "DebugModeInspector namespace is not initialized."
        );
    }

    class Java {

        static id = "Java";
        static title = "Java / Spring / Servlet";

        constructor() {
            this.patterns = [
                {
                    id: "java-stack-trace",
                    regex: /(?:Exception|Error)(?::[^\r\n<]*)?(?:\r?\n)\s+at\s+[\w.$]+\([^)\r\n]+\)/i,
                    classification: "exposed",
                    confidence: 0.95,
                    description: "Java exception stack trace exposed."
                },
                {
                    id: "spring-whitelabel-error",
                    regex: /Whitelabel Error Page/i,
                    classification: "exposed",
                    confidence: 0.90,
                    description: "Spring Boot Whitelabel error page detected."
                },
                {
                    id: "spring-error-details",
                    regex: /There was an unexpected error \(type=[^,]+,\s*status=\d+\)/i,
                    classification: "exposed",
                    confidence: 0.90,
                    description: "Spring Boot error details exposed."
                },
                {
                    id: "tomcat-error-report",
                    regex: /Apache Tomcat\/[\d.]+|org\.apache\.catalina\./i,
                    classification: "suspected",
                    confidence: 0.75,
                    description: "Apache Tomcat runtime information detected."
                },
                {
                    id: "java-source-path",
                    regex: /(?:\/(?:opt|srv|var|home)\/[^<>\r\n"]+\.java|[A-Z]:\\[^<>\r\n"]+\.java)/i,
                    classification: "exposed",
                    confidence: 0.85,
                    description: "Java source file path exposed."
                },
                {
                    id: "spring-framework-trace",
                    regex: /org\.springframework\.[\w.$]+\([^)\r\n]+\.java:\d+\)/i,
                    classification: "exposed",
                    confidence: 0.90,
                    description: "Spring Framework stack trace exposed."
                },
                {
                    id: "hibernate-error",
                    regex: /org\.hibernate\.[\w.$]+(?:Exception|Error)/i,
                    classification: "exposed",
                    confidence: 0.85,
                    description: "Hibernate exception information exposed."
                },
                {
                    id: "java-debug-indicator",
                    regex: /\b(?:JDWP|Java Debug Wire Protocol)\b[\s\S]{0,100}\b(?:enabled|listening|connected)\b/i,
                    classification: "suspected",
                    confidence: 0.80,
                    description: "Java debugging interface information detected."
                },
                {
                    id: "java-version",
                    regex: /\b(?:Java version|java\.version)\s*[:=]\s*["']?[\d._+-]+/i,
                    classification: "exposed",
                    confidence: 0.80,
                    description: "Java runtime version information exposed."
                },
                {
                    id: "java-sensitive-config",
                    regex: /\b(?:spring\.datasource\.password|spring\.security\.user\.password|client-secret)\s*[:=]\s*["']?[^"'\s<]{4,}/i,
                    classification: "exposed",
                    confidence: 0.98,
                    description: "Sensitive Java application configuration exposed."
                }
            ];
        }

        // ==================================================
        // RESPONSE ANALYSIS
        // ==================================================

        redactSensitiveValue(value, patternId) {
            if (
                patternId === "java-sensitive-config" &&
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
                    platform: Java.id,
                    type: "java-response",
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
                const response = await requestManager.get(url);

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
                        platform: Java.id,
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
                    platform: Java.id,
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
        Java.id,
        new Java()
    );

})();