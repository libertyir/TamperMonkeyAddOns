(function () {
    "use strict";

    const namespace =
        globalThis.AnonymousInspectorDebugMode;

    if (!namespace) {
        throw new Error(
            "DebugModeInspector namespace is not initialized."
        );
    }

    class GitHubAdvisories {

        static baseUrl =
            "https://api.github.com/advisories";

        static async lookupById(id, Framework) {
            if (
                typeof id !== "string" ||
                !/^CVE-\d{4}-\d{4,}$/i.test(id)
            ) {
                return null;
            }

            const url =
                GitHubAdvisories.baseUrl +
                "?cve_id=" +
                encodeURIComponent(id);

            try {
                const response =
                    await Framework.requestText(url);

                if (
                    typeof response !== "string" ||
                    !response.trim()
                ) {
                    return null;
                }

                const data = JSON.parse(response);

                if (!Array.isArray(data) || !data.length) {
                    return null;
                }

                const advisory = data[0];

                return {
                    id: advisory.ghsa_id || null,
                    cve: advisory.cve_id || id,
                    summary:
                        advisory.summary ||
                        advisory.description ||
                        "No description available.",
                    description:
                        advisory.description || null,

                    severity:
                        GitHubAdvisories.normalizeSeverity(
                            advisory.severity
                        ),

                    published: advisory.published_at || null,
                    updated: advisory.updated_at || null,

                    references: (
                        advisory.references || []
                    )
                        .map(item => item.url)
                        .filter(Boolean)
                        .slice(0, 10),

                    affectedPackages: (
                        advisory.vulnerabilities || []
                    ).map(item => ({
                        ecosystem:
                            item.package?.ecosystem || null,
                        name:
                            item.package?.name || null,
                        vulnerableRange:
                            item.vulnerable_version_range || null,
                        patchedVersions:
                            item.patched_versions || null
                    })),

                    url:
                        advisory.html_url ||
                        `https://github.com/advisories/${advisory.ghsa_id}`,

                    source: "GitHub Advisory Database"
                };

            } catch {
                return null;
            }
        }

        static normalizeSeverity(value) {
            const severity =
                String(value || "unknown").toLowerCase();

            const allowed = [
                "critical",
                "high",
                "moderate",
                "low"
            ];

            return allowed.includes(severity)
                ? severity
                : "unknown";
        }
    }

    namespace.GitHubAdvisories =
        GitHubAdvisories;

})();