(function () {
    "use strict";

    const namespace =
        globalThis.AnonymousInspectorDebugMode;

    if (!namespace) {
        throw new Error(
            "DebugModeInspector namespace is not initialized."
        );
    }

    class DotNet {

        static id = "DotNet";

        static title = ".NET / ASP.NET";

        constructor() {
            this.maxProbes = 3;

            this.patterns = [
                {
                    id: "aspnet-developer-exception",
                    regex: /Developer Exception Page/i,
                    confidence: 0.99,
                    classification: "confirmed",
                    description:
                        "ASP.NET Core Developer Exception Page detected."
                },
                {
                    id: "aspnet-detailed-error",
                    regex: /Server Error in ['"]\/['"] Application/i,
                    confidence: 0.98,
                    classification: "confirmed",
                    description:
                        "ASP.NET detailed server error page detected."
                },
                {
                    id: "aspnet-runtime-error",
                    regex: /Runtime Error.*(?:ASP\.NET|Server Error)/is,
                    confidence: 0.95,
                    classification: "confirmed",
                    description:
                        "ASP.NET runtime error page detected."
                },
                {
                    id: "aspnet-compilation-error",
                    regex: /Compilation Error.*ASP\.NET/is,
                    confidence: 0.95,
                    classification: "confirmed",
                    description:
                        "ASP.NET compilation error details detected."
                },
                {
                    id: "aspnet-core-exception",
                    regex: /Microsoft\.AspNetCore\.Diagnostics|Microsoft\.AspNetCore\.Server/i,
                    confidence: 0.88,
                    classification: "suspected",
                    description:
                        "ASP.NET Core diagnostic information detected."
                },
                {
                    id: "dotnet-stack-trace",
                    regex: /(?:System\.[A-Za-z0-9_.]+Exception|at [A-Za-z0-9_.]+\([^)]*\))/,
                    confidence: 0.88,
                    classification: "confirmed",
                    description:
                        ".NET exception or stack trace information detected."
                },
                {
                    id: "dotnet-source-location",
                    regex: /(?:[A-Z]:\\[^<>\r\n"]+\.cs:\s*line\s+\d+|\/[^<>\r\n"]+\.cs:\s*line\s+\d+)/i,
                    confidence: 0.95,
                    classification: "exposed",
                    description:
                        "Internal .NET source file path and line number exposed."
                },
                {
                    id: "dotnet-connection-string",
                    regex: /\b(?:Server|Data Source)\s*=\s*[^;]+;\s*(?:Database|Initial Catalog)\s*=/i,
                    confidence: 0.95,
                    classification: "exposed",
                    description:
                        "Database connection string information exposed."
                },
                {
                    id: "dotnet-trace-information",
                    regex: /(?:Request Information|Application Information|Trace Information)/i,
                    confidence: 0.80,
                    classification: "exposed",
                    description:
                        "ASP.NET diagnostic trace information exposed."
                },
                {
                    id: "dotnet-environment-details",
                    regex: /(?:\.NET Framework Version|ASP\.NET Version)\s*:/i,
                    confidence: 0.70,
                    classification: "exposed",
                    description:
                        "Detailed .NET runtime version information exposed."
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

            const candidates = [
                currentUrl.href,
                new URL("/trace.axd", origin).href,
                new URL("/elmah.axd", origin).href
            ];

            return [...new Set(candidates)]
                .slice(0, this.maxProbes);
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
                    platform: DotNet.id,
                    type: "dotnet-response",
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
                        platform: DotNet.id,
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
                        platform: DotNet.id,
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
                    platform: DotNet.id,
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
        DotNet.id,
        new DotNet()
    );

})();