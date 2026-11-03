(function () {
    "use strict";

    const namespace =
        globalThis.AnonymousInspectorDebugMode;

    if (!namespace) {
        throw new Error(
            "DebugModeInspector namespace is not initialized."
        );
    }

    class Rails {

        static id = "Rails";
        static title = "Ruby on Rails";

        constructor() {
            this.patterns = [
                {
                    id: "rails-exception-page",
                    regex: /Action Controller: Exception caught|Rails\.application\.env|We're sorry, but something went wrong/i,
                    classification: "suspected",
                    confidence: 0.85,
                    description: "Ruby on Rails exception page detected."
                },
                {
                    id: "rails-debug-exception",
                    regex: /ActionView::Template::Error|ActiveRecord::(?:RecordNotFound|StatementInvalid|ConnectionNotEstablished)|ActionController::(?:RoutingError|UnknownFormat)/i,
                    classification: "exposed",
                    confidence: 0.90,
                    description: "Rails exception details exposed."
                },
                {
                    id: "ruby-stack-trace",
                    regex: /(?:\/[^ \r\n<>"]+\.rb:\d+:in\s+[`'][^`']+[`']|from\s+\/[^ \r\n<>"]+\.rb:\d+)/i,
                    classification: "exposed",
                    confidence: 0.95,
                    description: "Ruby stack trace exposed."
                },
                {
                    id: "rails-source-path",
                    regex: /(?:\/(?:app|config|lib|gems)\/[^<>\r\n"]+\.rb|[A-Z]:\\[^<>\r\n"]+\.rb)/i,
                    classification: "exposed",
                    confidence: 0.85,
                    description: "Ruby source file path exposed."
                },
                {
                    id: "rails-gem-path",
                    regex: /\/gems\/[\w.-]+\/(?:lib|app)\//i,
                    classification: "exposed",
                    confidence: 0.80,
                    description: "Installed Ruby gem path exposed."
                },
                {
                    id: "rails-development-mode",
                    regex: /\b(?:Rails\.env|RAILS_ENV)\s*[:=]\s*["']?development\b/i,
                    classification: "suspected",
                    confidence: 0.75,
                    description: "Rails development environment indicator detected."
                },
                {
                    id: "rails-debugger-indicator",
                    regex: /\b(?:web-console|WebConsole::Middleware|better_errors)\b/i,
                    classification: "suspected",
                    confidence: 0.80,
                    description: "Rails debugging component detected."
                },
                {
                    id: "rails-version",
                    regex: /\bRails\s+v?(\d+\.\d+(?:\.\d+)?)/i,
                    classification: "exposed",
                    confidence: 0.80,
                    description: "Ruby on Rails version exposed."
                },
                {
                    id: "rails-sensitive-config",
                    regex: /\b(?:secret_key_base|database_password|aws_secret_access_key)\s*[:=]\s*["']?[^"'\s<]{8,}/i,
                    classification: "exposed",
                    confidence: 0.98,
                    description: "Sensitive Rails configuration exposed."
                }
            ];
        }

        // ==================================================
        // RESPONSE ANALYSIS
        // ==================================================

        redactSensitiveValue(value, patternId) {
            if (
                patternId === "rails-sensitive-config" &&
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
                    platform: Rails.id,
                    type: "rails-response",
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
                        platform: Rails.id,
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
                    platform: Rails.id,
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
        Rails.id,
        new Rails()
    );

})();