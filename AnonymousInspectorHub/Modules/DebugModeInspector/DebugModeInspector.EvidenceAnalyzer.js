(function () {
    "use strict";

    const namespace =
        globalThis.AnonymousInspectorDebugMode;

    if (!namespace) {
        throw new Error(
            "DebugModeInspector namespace is not initialized."
        );
    }

    class EvidenceAnalyzer {

        // ==================================================
        // CONFIGURATION
        // ==================================================

        constructor(options = {}) {
            this.confirmedThreshold =
                options.confirmedThreshold ?? 0.85;

            this.suspectedThreshold =
                options.suspectedThreshold ?? 0.35;

            this.maxEvidence =
                options.maxEvidence ?? 200;

            this.debugPatterns = [
                {
                    id: "debug-toolbar",
                    pattern: /debug toolbar|debug mode is enabled/i,
                    confidence: 0.95,
                    description: "Explicit debug mode indicator."
                },
                {
                    id: "debug-true",
                    pattern: /\b(debug|app_debug)\s*[:=]\s*(true|1|"true")/i,
                    confidence: 0.90,
                    description: "Debug configuration appears enabled."
                },
                {
                    id: "developer-exception",
                    pattern: /developer exception page/i,
                    confidence: 0.95,
                    description: "Developer exception page detected."
                },
                {
                    id: "werkzeug-debugger",
                    pattern: /werkzeug debugger/i,
                    confidence: 0.98,
                    description: "Werkzeug interactive debugger detected."
                },
                {
                    id: "django-debug-page",
                    pattern: /Django Version:.*Exception Type:/is,
                    confidence: 0.98,
                    description: "Django technical debug page detected."
                },
                {
                    id: "whoops-page",
                    pattern: /Whoops!.*(?:Stack trace|Illuminate\\)/is,
                    confidence: 0.95,
                    description: "Laravel exception debug page detected."
                },
                {
                    id: "aspnet-error-page",
                    pattern: /Server Error in '\/' Application|Runtime Error.*ASP\.NET/is,
                    confidence: 0.95,
                    description: "ASP.NET detailed error page detected."
                },
                {
                    id: "stack-trace",
                    pattern: /(?:Stack trace:|Traceback \(most recent call last\):)/i,
                    confidence: 0.80,
                    description: "Detailed application stack trace exposed."
                }
            ];

            this.exposurePatterns = [
                {
                    id: "filesystem-path",
                    pattern: /(?:\/var\/www\/|\/home\/[^/\s]+\/|[A-Z]:\\(?:inetpub|wwwroot|users)\\)/i,
                    confidence: 0.85,
                    description: "Internal filesystem path exposed."
                },
                {
                    id: "environment-variable",
                    pattern: /\b(?:DB_PASSWORD|APP_KEY|SECRET_KEY|AWS_SECRET_ACCESS_KEY)\s*[:=]/i,
                    confidence: 0.95,
                    description: "Sensitive environment variable name exposed."
                },
                {
                    id: "source-location",
                    pattern: /(?:vendor\/|node_modules\/|site-packages\/).+?\.(?:php|js|py|rb|java)/i,
                    confidence: 0.80,
                    description: "Internal application source location exposed."
                },
                {
                    id: "database-details",
                    pattern: /(?:SQLSTATE\[\w+\]|PDOException|OperationalError|SQLException)/i,
                    confidence: 0.85,
                    description: "Internal database error details exposed."
                },
                {
                    id: "framework-version",
                    pattern: /(?:Django Version:|Laravel Framework\s+v?\d|PHP\/\d+\.\d+|ASP\.NET Version:)/i,
                    confidence: 0.70,
                    description: "Framework or runtime version exposed."
                }
            ];
        }

        // ==================================================
        // NORMALIZATION
        // ==================================================

        normalizeConfidence(value, fallback = 0.5) {
            const confidence = Number(value);

            if (!Number.isFinite(confidence)) {
                return fallback;
            }

            return Math.min(
                1,
                Math.max(0, confidence)
            );
        }

        normalizeEvidence(item, platformId = null) {
            if (typeof item === "string") {
                return {
                    id: null,
                    platform: platformId,
                    type: "unknown",
                    value: item,
                    description: item,
                    confidence: 0.5,
                    classification: "suspected"
                };
            }

            if (!item || typeof item !== "object") {
                return null;
            }

            const value =
                item.value ??
                item.match ??
                item.description ??
                "";

            const confidence =
                this.normalizeConfidence(
                    item.confidence,
                    0.5
                );

            return {
                id: item.id ?? null,
                platform:
                    item.platform ??
                    platformId ??
                    null,
                type: item.type ?? "unknown",
                value: String(value),
                description:
                    item.description ??
                    String(value),
                confidence,
                classification:
                    item.classification ??
                    item.classification ??
                    null,
                source: item.source ?? null,
                url: item.url ?? null
            };
        }

        // ==================================================
        // TEXT EXTRACTION
        // ==================================================

        extractResponseText(response) {
            if (typeof response === "string") {
                return response;
            }

            if (!response || typeof response !== "object") {
                return "";
            }

            if (typeof response.body === "string") {
                return response.body;
            }

            if (typeof response.text === "string") {
                return response.text;
            }

            return "";
        }

        // ==================================================
        // PATTERN ANALYSIS
        // ==================================================

        scanPatterns(text, patterns, platformId = null) {
            if (!text) {
                return [];
            }

            const evidence = [];

            for (const item of patterns) {
                const match = text.match(item.pattern);

                if (!match) {
                    continue;
                }

                evidence.push({
                    id: item.id,
                    platform: platformId,
                    type: "response-pattern",
                    value: match[0].slice(0, 500),
                    description: item.description,
                    confidence: item.confidence,
                    classification: null
                });
            }

            return evidence;
        }

        // ==================================================
        // PLATFORM RESULT NORMALIZATION
        // ==================================================

        normalizePlatformResult(result) {
            if (!result || typeof result !== "object") {
                return null;
            }

            const platformId =
                result.platform ??
                result.platformId ??
                result.id ??
                "Unknown";

            const evidence = [];

            if (Array.isArray(result.evidence)) {
                for (const item of result.evidence) {
                    const normalized =
                        this.normalizeEvidence(
                            item,
                            platformId
                        );

                    if (normalized) {
                        evidence.push(normalized);
                    }
                }
            }

            const responseText =
                this.extractResponseText(result.response) ||
                this.extractResponseText(result);

            if (responseText) {
                evidence.push(
                    ...this.scanPatterns(
                        responseText,
                        this.debugPatterns,
                        platformId
                    ),
                    ...this.scanPatterns(
                        responseText,
                        this.exposurePatterns,
                        platformId
                    )
                );
            }

            return {
                platform: platformId,
                detected: result.detected === true,
                confidence: this.normalizeConfidence(
                    result.confidence,
                    0
                ),
                evidence,
                error: result.error ?? null
            };
        }

        // ==================================================
        // EVIDENCE CLASSIFICATION
        // ==================================================

        classifyEvidence(item) {
            const explicitClassification =
                String(item.classification || "")
                    .toLowerCase();

            if (
                explicitClassification === "confirmed" ||
                explicitClassification === "debug"
            ) {
                return "confirmed";
            }

            if (
                explicitClassification === "exposed" ||
                explicitClassification === "disclosure"
            ) {
                return "exposed";
            }

            if (
                explicitClassification === "suspected"
            ) {
                return "suspected";
            }

            const id = String(item.id || "").toLowerCase();
            const type = String(item.type || "").toLowerCase();

            if (
                this.debugPatterns.some(
                    pattern => pattern.id === id
                )
            ) {
                return item.confidence >= this.confirmedThreshold
                    ? "confirmed"
                    : "suspected";
            }

            if (
                this.exposurePatterns.some(
                    pattern => pattern.id === id
                )
            ) {
                return "exposed";
            }

            if (
                type.includes("debug") ||
                type.includes("exception-page") ||
                type.includes("stack-trace")
            ) {
                return item.confidence >= this.confirmedThreshold
                    ? "confirmed"
                    : "suspected";
            }

            if (
                type.includes("disclosure") ||
                type.includes("sensitive") ||
                type.includes("internal-path")
            ) {
                return "exposed";
            }

            return "suspected";
        }

        // ==================================================
        // DEDUPLICATION
        // ==================================================

        deduplicateEvidence(items) {
            const unique = new Map();

            for (const item of items) {
                const key = [
                    item.platform,
                    item.id,
                    item.type,
                    item.value
                ].join("|").toLowerCase();

                const existing = unique.get(key);

                if (
                    !existing ||
                    item.confidence > existing.confidence
                ) {
                    unique.set(key, item);
                }
            }

            return Array.from(unique.values());
        }

        // ==================================================
        // ANALYSIS
        // ==================================================

        analyze(results = []) {
            if (!Array.isArray(results)) {
                results = [results];
            }

            const platforms = [];
            let allEvidence = [];

            for (const result of results) {
                const normalized =
                    this.normalizePlatformResult(result);

                if (!normalized) {
                    continue;
                }

                platforms.push({
                    id: normalized.platform,
                    detected: normalized.detected,
                    confidence: normalized.confidence,
                    error: normalized.error
                });

                allEvidence.push(
                    ...normalized.evidence
                );
            }

            allEvidence = this.deduplicateEvidence(
                allEvidence
            );

            for (const item of allEvidence) {
                item.classification =
                    this.classifyEvidence(item);
            }

            allEvidence.sort(
                (a, b) => b.confidence - a.confidence
            );

            const confirmed = allEvidence.filter(
                item => item.classification === "confirmed"
            );

            const exposed = allEvidence.filter(
                item => item.classification === "exposed"
            );

            const suspected = allEvidence.filter(
                item => item.classification === "suspected"
            );

            let status = "Not Detected";

            if (confirmed.length > 0) {
                status = "Confirmed";
            } else if (exposed.length > 0) {
                status = "Exposed";
            } else if (suspected.length > 0) {
                status = "Suspected";
            }

            const confidence =
                allEvidence.length > 0
                    ? Math.max(
                        ...allEvidence.map(
                            item => item.confidence
                        )
                    )
                    : 0;

            const summary = this.buildSummary(
                status,
                confirmed.length,
                exposed.length,
                suspected.length
            );

            return {
                status,
                summary,
                confidence,

                platforms,

                evidence: allEvidence.slice(
                    0,
                    this.maxEvidence
                ),

                statistics: {
                    total: allEvidence.length,
                    confirmed: confirmed.length,
                    exposed: exposed.length,
                    suspected: suspected.length
                },

                analyzedAt: new Date().toISOString()
            };
        }

        // ==================================================
        // SUMMARY
        // ==================================================

        buildSummary(
            status,
            confirmed,
            exposed,
            suspected
        ) {
            switch (status) {
                case "Confirmed":
                    return (
                        "Debug mode indicators were confirmed. " +
                        confirmed +
                        " confirmed indicator(s) found."
                    );

                case "Exposed":
                    return (
                        "Internal application information was exposed. " +
                        exposed +
                        " disclosure indicator(s) found."
                    );

                case "Suspected":
                    return (
                        "Potential debug-related indicators were found. " +
                        suspected +
                        " unconfirmed indicator(s) found."
                    );

                default:
                    return (
                        "No evidence of active debug mode or " +
                        "internal information exposure was detected."
                    );
            }
        }
    }

    // ==================================================
    // REGISTER
    // ==================================================

    namespace.EvidenceAnalyzer = EvidenceAnalyzer;

})();