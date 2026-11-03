(function () {
    "use strict";

    const namespace =
        globalThis.AnonymousInspectorDebugMode;

    if (!namespace) {
        throw new Error(
            "DebugModeInspector namespace is not initialized."
        );
    }

    class PlatformDetector {

        // ==================================================
        // PLATFORM SIGNATURES
        // ==================================================

        static signatures = {

            DotNet: {
                patterns: [
                    /ASP\.NET/i,
                    /Microsoft\.AspNetCore/i,
                    /System\.Web/i,
                    /__VIEWSTATE/i,
                    /__EVENTVALIDATION/i,
                    /Server Error in ['"]\/['"] Application/i,
                    /Developer Exception Page/i,
                    /Microsoft\.NETCore\.App/i,
                    /Kestrel/i
                ],

                paths: [
                    /\/_framework\//i,
                    /\/aspnet_client\//i
                ],

                globals: [
                    "__doPostBack",
                    "Sys",
                    "WebForm_PostBackOptions"
                ]
            },

            Laravel: {
                patterns: [
                    /Laravel/i,
                    /Illuminate\\[A-Z]/,
                    /Illuminate\\\\/,
                    /Whoops!/i,
                    /vendor\/laravel\//i,
                    /laravel_session/i,
                    /APP_DEBUG/i
                ],

                paths: [
                    /\/vendor\/laravel\//i,
                    /\/storage\/framework\//i
                ],

                globals: []
            },

            Django: {
                patterns: [
                    /Django Version:/i,
                    /Request Method:/i,
                    /Exception Type:/i,
                    /Exception Value:/i,
                    /Using the URLconf defined in/i,
                    /django\.core\.handlers/i,
                    /django\.template/i
                ],

                paths: [
                    /\/static\/admin\//i
                ],

                globals: []
            },

            PHP: {
                patterns: [
                    /PHP Fatal error:/i,
                    /PHP Parse error:/i,
                    /PHP Warning:/i,
                    /PHP Notice:/i,
                    /Uncaught (?:Error|Exception):/i,
                    /Stack trace:/i,
                    /<\/?b>Fatal error<\/?b>/i,
                    /Powered by PHP/i
                ],

                paths: [
                    /\.php(?:\/|$|\?)/i
                ],

                globals: []
            },

            WordPress: {
                patterns: [
                    /wp-content/i,
                    /wp-includes/i,
                    /WordPress database error/i,
                    /\/wp-json\//i,
                    /name=["']generator["'][^>]*WordPress/i,
                    /content=["']WordPress/i
                ],

                paths: [
                    /\/wp-content\//i,
                    /\/wp-includes\//i,
                    /\/wp-admin\//i
                ],

                globals: [
                    "wp",
                    "wpApiSettings"
                ]
            },

            Flask: {
                patterns: [
                    /Werkzeug Debugger/i,
                    /This is the Werkzeug interactive debugger/i,
                    /PIN:/i,
                    /Traceback \(most recent call last\):/i,
                    /flask\.app/i
                ],

                paths: [],

                globals: []
            },

            Node: {
                patterns: [
                    /Cannot read propert(?:y|ies) of (?:undefined|null)/i,
                    /TypeError:/i,
                    /ReferenceError:/i,
                    /node_modules\//i,
                    /Express/i,
                    /X-Powered-By:\s*Express/i,
                    /at Object\.<anonymous>/i,
                    /internal\/process\/task_queues/i
                ],

                paths: [
                    /\/node_modules\//i
                ],

                globals: []
            },

            Java: {
                patterns: [
                    /Whitelabel Error Page/i,
                    /org\.springframework\./i,
                    /java\.lang\.[A-Z]/i,
                    /javax\.servlet\./i,
                    /jakarta\.servlet\./i,
                    /DispatcherServlet/i,
                    /Tomcat Web Server/i,
                    /Apache Tomcat/i
                ],

                paths: [
                    /\/WEB-INF\//i,
                    /\/servlet\//i
                ],

                globals: []
            },

            Rails: {
                patterns: [
                    /ActionController::/i,
                    /ActiveRecord::/i,
                    /Rails\.root/i,
                    /consider_all_requests_local/i,
                    /Action View/i,
                    /Action Dispatch/i,
                    /Ruby on Rails/i
                ],

                paths: [
                    /\/assets\/application-[a-z0-9]+\.js/i
                ],

                globals: []
            },

            Go: {
                patterns: [
                    /goroutine \d+ \[/i,
                    /panic:/i,
                    /runtime\/panic\.go/i,
                    /net\/http\.\(\*conn\)/i,
                    /http: panic serving/i
                ],

                paths: [],

                globals: []
            }
        };

        // ==================================================
        // CONFIGURATION
        // ==================================================

        static weights = {
            pattern: 0.12,
            path: 0.10,
            global: 0.08,
            generator: 0.25
        };

        static minimumConfidence = 0.15;

        static maximumEvidence = 30;

        // ==================================================
        // CONSTRUCTOR
        // ==================================================

        constructor(options = {}) {
            this.options = options;
        }

        // ==================================================
        // SAFE TEXT EXTRACTION
        // ==================================================

        getPageText() {
            try {
                return document.documentElement
                    ? document.documentElement.innerText ||
                      document.documentElement.textContent ||
                      ""
                    : "";
            } catch {
                return "";
            }
        }

        getPageHTML() {
            try {
                return document.documentElement
                    ? document.documentElement.outerHTML || ""
                    : "";
            } catch {
                return "";
            }
        }

        // ==================================================
        // SCRIPT AND RESOURCE URLS
        // ==================================================

        getResourceUrls() {
            const urls = [];

            try {
                for (const element of document.querySelectorAll(
                    "script[src], link[href]"
                )) {
                    const raw =
                        element.getAttribute("src") ||
                        element.getAttribute("href");

                    if (!raw) continue;

                    try {
                        const url = new URL(
                            raw,
                            location.href
                        );

                        if (
                            url.protocol === "http:" ||
                            url.protocol === "https:"
                        ) {
                            urls.push(url.pathname);
                        }

                    } catch {
                        // Ignore malformed resource URLs.
                    }
                }
            } catch {
                // Ignore DOM access errors.
            }

            return [...new Set(urls)];
        }

        // ==================================================
        // META GENERATOR
        // ==================================================

        getGenerator() {
            try {
                const element = document.querySelector(
                    'meta[name="generator" i]'
                );

                return element
                    ? element.getAttribute("content") || ""
                    : "";

            } catch {
                return "";
            }
        }

        // ==================================================
        // GLOBAL DETECTION
        // ==================================================

        hasGlobal(name) {
            try {
                return name in globalThis &&
                    globalThis[name] !== undefined &&
                    globalThis[name] !== null;

            } catch {
                return false;
            }
        }

        // ==================================================
        // EVIDENCE MATCHING
        // ==================================================

        matchPatterns(text, patterns) {
            const matches = [];

            for (const pattern of patterns) {
                if (pattern.test(text)) {
                    matches.push({
                        type: "pattern",
                        value: pattern.source
                    });
                }
            }

            return matches;
        }

        matchPaths(paths, patterns) {
            const matches = [];

            for (const path of paths) {
                for (const pattern of patterns) {
                    if (pattern.test(path)) {
                        matches.push({
                            type: "path",
                            value: path
                        });

                        break;
                    }
                }
            }

            return matches;
        }

        matchGlobals(names) {
            const matches = [];

            for (const name of names) {
                if (this.hasGlobal(name)) {
                    matches.push({
                        type: "global",
                        value: name
                    });
                }
            }

            return matches;
        }

        matchGenerator(generator, platformId) {
            if (!generator) return [];

            const patterns = {
                DotNet: /ASP\.NET|\.NET/i,
                Laravel: /Laravel/i,
                Django: /Django/i,
                PHP: /PHP/i,
                WordPress: /WordPress/i,
                Flask: /Flask/i,
                Node: /Express|Node\.js/i,
                Java: /Spring|Java|Tomcat/i,
                Rails: /Rails/i,
                Go: /Go(?:lang)?/i
            };

            const pattern = patterns[platformId];

            if (pattern && pattern.test(generator)) {
                return [{
                    type: "generator",
                    value: generator
                }];
            }

            return [];
        }

        // ==================================================
        // CONFIDENCE CALCULATION
        // ==================================================

        calculateConfidence(evidence) {
            if (!evidence.length) {
                return 0;
            }

            const weights =
                PlatformDetector.weights;

            let score = 0;

            const types = new Set();

            for (const item of evidence) {
                score += weights[item.type] || 0;
                types.add(item.type);
            }

            // Multiple independent evidence types
            // increase confidence.

            if (types.size >= 2) {
                score += 0.10;
            }

            if (types.size >= 3) {
                score += 0.10;
            }

            // Repeated matches have diminishing value.

            const uniqueTypes = evidence.reduce(
                (result, item) => {
                    result[item.type] =
                        (result[item.type] || 0) + 1;

                    return result;
                },
                {}
            );

            for (const count of Object.values(uniqueTypes)) {
                if (count > 1) {
                    score += Math.min(
                        (count - 1) * 0.025,
                        0.10
                    );
                }
            }

            return Math.min(
                Number(score.toFixed(3)),
                1
            );
        }

        // ==================================================
        // DETECT ONE PLATFORM
        // ==================================================

        detectOne(
            platformId,
            signature,
            context
        ) {
            const evidence = [];

            evidence.push(
                ...this.matchPatterns(
                    context.text,
                    signature.patterns || []
                )
            );

            evidence.push(
                ...this.matchPaths(
                    context.paths,
                    signature.paths || []
                )
            );

            evidence.push(
                ...this.matchGlobals(
                    signature.globals || []
                )
            );

            evidence.push(
                ...this.matchGenerator(
                    context.generator,
                    platformId
                )
            );

            if (!evidence.length) {
                return null;
            }

            const confidence =
                this.calculateConfidence(evidence);

            if (
                confidence <
                PlatformDetector.minimumConfidence
            ) {
                return null;
            }

            return {
                id: platformId,

                confidence,

                evidence: evidence.slice(
                    0,
                    PlatformDetector.maximumEvidence
                )
            };
        }

        // ==================================================
        // DETECT ALL PLATFORMS
        // ==================================================

        async detect(context = {}) {
            const text = this.getPageText();

            const html = this.getPageHTML();

            const generator = this.getGenerator();

            const paths = this.getResourceUrls();

            const detectionContext = {
                text: text + "\n" + html,
                generator,
                paths
            };

            const results = [];

            for (
                const [platformId, signature] of
                Object.entries(
                    PlatformDetector.signatures
                )
            ) {
                const result = this.detectOne(
                    platformId,
                    signature,
                    detectionContext
                );

                if (result) {
                    results.push(result);
                }
            }

            results.sort((a, b) => {
                return b.confidence - a.confidence;
            });

            return results;
        }
    }

    // ==================================================
    // REGISTER SERVICE
    // ==================================================

    namespace.PlatformDetector = PlatformDetector;

})();