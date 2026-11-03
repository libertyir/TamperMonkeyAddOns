(function () {
    "use strict";

    const namespace =
        globalThis.AnonymousInspectorDebugMode;

    if (!namespace) {
        throw new Error(
            "DebugModeInspector namespace is not initialized."
        );
    }

    class ReportBuilder {

        constructor(options = {}) {
            this.maxEvidence =
                options.maxEvidence ?? 100;

            this.maxDescriptionLength =
                options.maxDescriptionLength ?? 500;
        }

        // ==================================================
        // NORMALIZATION
        // ==================================================

        normalizeStatus(status) {
            const allowed = [
                "Confirmed",
                "Exposed",
                "Suspected",
                "Not Detected"
            ];

            return allowed.includes(status)
                ? status
                : "Not Detected";
        }

        normalizeText(value, maxLength = this.maxDescriptionLength) {
            if (value === null || value === undefined) {
                return "";
            }

            return String(value).slice(0, maxLength);
        }

        normalizeConfidence(value) {
            const number = Number(value);

            if (!Number.isFinite(number)) {
                return 0;
            }

            return Math.min(1, Math.max(0, number));
        }

        // ==================================================
        // EVIDENCE
        // ==================================================

        buildEvidence(items = []) {
            if (!Array.isArray(items)) {
                return [];
            }

            return items
                .slice(0, this.maxEvidence)
                .map((item, index) => ({
                    index: index + 1,

                    id: this.normalizeText(
                        item.id,
                        100
                    ),

                    platform: this.normalizeText(
                        item.platform,
                        100
                    ),

                    type: this.normalizeText(
                        item.type,
                        100
                    ),

                    classification: this.normalizeText(
                        item.classification,
                        50
                    ),

                    description: this.normalizeText(
                        item.description
                    ),

                    value: this.normalizeText(
                        item.value
                    ),

                    confidence: this.normalizeConfidence(
                        item.confidence
                    ),

                    source: this.normalizeText(
                        item.source,
                        200
                    ),

                    url: this.normalizeText(
                        item.url,
                        2048
                    )
                }));
        }

        // ==================================================
        // PLATFORM RESULTS
        // ==================================================

        buildPlatforms(platforms = []) {
            if (!Array.isArray(platforms)) {
                return [];
            }

            return platforms.map(platform => ({
                id: this.normalizeText(
                    platform.id,
                    100
                ),

                detected:
                    platform.detected === true,

                confidence: this.normalizeConfidence(
                    platform.confidence
                ),

                error: platform.error
                    ? this.normalizeText(
                        platform.error,
                        300
                    )
                    : null
            }));
        }

        // ==================================================
        // STATISTICS
        // ==================================================

        buildStatistics(statistics = {}, evidence = []) {
            const count = classification =>
                evidence.filter(
                    item => item.classification === classification
                ).length;

            return {
                total: Number.isFinite(statistics.total)
                    ? statistics.total
                    : evidence.length,

                confirmed: Number.isFinite(statistics.confirmed)
                    ? statistics.confirmed
                    : count("confirmed"),

                exposed: Number.isFinite(statistics.exposed)
                    ? statistics.exposed
                    : count("exposed"),

                suspected: Number.isFinite(statistics.suspected)
                    ? statistics.suspected
                    : count("suspected")
            };
        }

        // ==================================================
        // REPORT GENERATION
        // ==================================================

        build(analysis = {}) {
            const status = this.normalizeStatus(
                analysis.status
            );

            const evidence = this.buildEvidence(
                analysis.evidence
            );

            const platforms = this.buildPlatforms(
                analysis.platforms
            );

            const statistics = this.buildStatistics(
                analysis.statistics,
                evidence
            );

            const confidence =
                this.normalizeConfidence(
                    analysis.confidence
                );

            return {
                title: "Debug Mode Inspection Report",

                version: "1.0",

                status,

                summary: this.normalizeText(
                    analysis.summary || this.getDefaultSummary(status)
                ),

                confidence,

                platforms,

                evidence,

                statistics,

                metadata: {
                    generatedAt: new Date().toISOString(),

                    analyzedAt:
                        analysis.analyzedAt || null,

                    platformCount: platforms.length,

                    evidenceCount: evidence.length
                }
            };
        }

        // ==================================================
        // DEFAULT SUMMARY
        // ==================================================

        getDefaultSummary(status) {
            const summaries = {
                "Confirmed":
                    "Debug mode indicators were confirmed.",

                "Exposed":
                    "Internal application information was exposed.",

                "Suspected":
                    "Potential debug-related indicators were detected.",

                "Not Detected":
                    "No debug-related evidence was detected."
            };

            return summaries[status];
        }

        // ==================================================
        // EXPORT
        // ==================================================

        toJSON(report, pretty = true) {
            return JSON.stringify(
                report,
                null,
                pretty ? 2 : 0
            );
        }

        // ==================================================
        // TEXT SUMMARY
        // ==================================================

        toText(report) {
            const lines = [
                report.title,
                "=".repeat(report.title.length),
                "",
                "Status: " + report.status,
                "Confidence: " +
                    Math.round(report.confidence * 100) + "%",
                "",
                "Summary:",
                report.summary,
                "",
                "Statistics:",
                "Total: " + report.statistics.total,
                "Confirmed: " + report.statistics.confirmed,
                "Exposed: " + report.statistics.exposed,
                "Suspected: " + report.statistics.suspected,
                "",
                "Platforms:"
            ];

            for (const platform of report.platforms) {
                lines.push(
                    "- " +
                    platform.id +
                    " | Confidence: " +
                    Math.round(platform.confidence * 100) +
                    "%"
                );
            }

            lines.push("", "Evidence:");

            for (const item of report.evidence) {
                lines.push(
                    "",
                    "[" + item.index + "] " +
                    item.classification.toUpperCase(),
                    "Platform: " + item.platform,
                    "Type: " + item.type,
                    "Confidence: " +
                        Math.round(item.confidence * 100) + "%",
                    "Description: " + item.description
                );

                if (item.value) {
                    lines.push("Value: " + item.value);
                }

                if (item.url) {
                    lines.push("URL: " + item.url);
                }
            }

            lines.push(
                "",
                "Generated: " + report.metadata.generatedAt
            );

            return lines.join("\n");
        }
    }

    // ==================================================
    // REGISTER
    // ==================================================

    namespace.ReportBuilder = ReportBuilder;

})();