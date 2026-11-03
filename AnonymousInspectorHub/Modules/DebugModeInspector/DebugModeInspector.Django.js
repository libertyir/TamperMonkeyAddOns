(function () {
    "use strict";

    const namespace =
        globalThis.AnonymousInspectorDebugMode;

    if (!namespace) {
        throw new Error(
            "DebugModeInspector namespace is not initialized."
        );
    }

    class Django {

        static id = "Django";

        static title = "Django";

        constructor() {
            this.maxProbes = 2;

            this.patterns = [
                {
                    id: "django-debug-page",
                    regex: /Django Version:.*Request Method:.*Exception Type:.*Exception Value:/is,
                    confidence: 0.99,
                    classification: "confirmed",
                    description:
                        "Django technical debug page detected."
                },
                {
                    id: "django-traceback",
                    regex: /Traceback \(most recent call last\):[\s\S]{0,1000}(?:django\.core|django\.http|django\.db)/i,
                    confidence: 0.96,
                    classification: "confirmed",
                    description:
                        "Django detailed traceback detected."
                },
                {
                    id: "django-technical-500",
                    regex: /Technical 500 error|You're seeing this error because you have DEBUG = True/i,
                    confidence: 0.98,
                    classification: "confirmed",
                    description:
                        "Django technical error page indicates debug mode."
                },
                {
                    id: "django-settings-debug",
                    regex: /\bDEBUG\s*=\s*(?:True|1)/,
                    confidence: 0.90,
                    classification: "suspected",
                    description:
                        "Django DEBUG configuration appears enabled."
                },
                {
                    id: "django-settings-module",
                    regex: /\bDJANGO_SETTINGS_MODULE\s*[:=]\s*["'][^"']+["']/i,
                    confidence: 0.85,
                    classification: "exposed",
                    description:
                        "Django settings module name exposed."
                },
                {
                    id: "django-secret-key",
                    regex: /\bSECRET_KEY\s*[:=]\s*["'][^"']{20,}["']/i,
                    confidence: 0.99,
                    classification: "exposed",
                    description:
                        "Django secret key exposed."
                },
                {
                    id: "django-database-password",
                    regex: /(?:PASSWORD|DB_PASSWORD)\s*[:=]\s*["'][^"']{3,}["']/i,
                    confidence: 0.95,
                    classification: "exposed",
                    description:
                        "Django database password exposed."
                },
                {
                    id: "django-source-path",
                    regex: /(?:\/(?:home|var|srv)\/[^<>\r\n"]+\/(?:django|site-packages)\/|[A-Z]:\\[^<>\r\n"]+\\(?:django|site-packages)\\)/i,
                    confidence: 0.90,
                    classification: "exposed",
                    description:
                        "Internal Django filesystem path exposed."
                },
                {
                    id: "django-version",
                    regex: /Django Version:\s*\d+(?:\.\d+){1,2}/i,
                    confidence: 0.75,
                    classification: "exposed",
                    description:
                        "Django version disclosed."
                },
                {
                    id: "django-database-error",
                    regex: /django\.db\.utils\.(?:OperationalError|ProgrammingError|IntegrityError)/i,
                    confidence: 0.90,
                    classification: "confirmed",
                    description:
                        "Detailed Django database exception detected."
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
                    platform: Django.id,
                    type: "django-response",
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
                        platform: Django.id,
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
                        platform: Django.id,
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
                    platform: Django.id,
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
        Django.id,
        new Django()
    );

})();