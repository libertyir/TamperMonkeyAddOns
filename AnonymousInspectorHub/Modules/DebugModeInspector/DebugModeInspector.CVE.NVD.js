(function () {
    "use strict";

    const namespace = globalThis.AnonymousInspectorDebugMode;

    if (!namespace) {
        throw new Error("DebugModeInspector namespace is not initialized.");
    }

    class NVD {

        static baseUrl =
            "https://services.nvd.nist.gov/rest/json/cves/2.0";

        static async search(product, version, options = {}) {
            if (!product || !version) {
                throw new Error("Product and version are required.");
            }

            const params = new URLSearchParams({
                keywordSearch: product,
                resultsPerPage: String(options.limit || 100)
            });

            const url = `${NVD.baseUrl}?${params.toString()}`;

            const response = await options.Framework.requestText(url);

            if (typeof response !== "string" || !response.trim()) {
                throw new Error("NVD returned an empty response.");
            }

            let data;

            try {
                data = JSON.parse(response);
            } catch {
                throw new Error("Invalid NVD JSON response.");
            }

            return (data.vulnerabilities || [])
                .map(item => NVD.normalize(
                    item.cve,
                    product,
                    version
                ))
                .filter(Boolean);
        }

        static normalize(cve, product, version) {
            if (!cve || !cve.id) {
                return null;
            }

            const description =
                (cve.descriptions || [])
                    .find(item => item.lang === "en")?.value ||
                "No description available.";

            const matches = NVD.getCPEMatches(cve);

            const productMatches = matches.filter(item =>
                NVD.matchesProduct(item.criteria, product)
            );

            if (!productMatches.length) {
                return null;
            }

            const evaluations = productMatches.map(item =>
                NVD.evaluateVersion(item, version)
            );

            if (evaluations.every(item => item === "not-affected")) {
                return null;
            }

            const matchStatus = evaluations.includes("affected")
                ? "Affected"
                : "Potential";

            return {
                id: cve.id,
                title: NVD.extractTitle(description),
                description,
                source: "NVD",
                url: `https://nvd.nist.gov/vuln/detail/${cve.id}`,
                published: cve.published || null,
                modified: cve.lastModified || null,
                severity: NVD.getSeverity(cve),
                matchStatus,
                matchedProduct: product,
                detectedVersion: version
            };
        }

        static getCPEMatches(cve) {
            const output = [];

            const walk = node => {
                if (!node || typeof node !== "object") {
                    return;
                }

                for (const item of node.cpeMatch || []) {
                    if (item.vulnerable === true) {
                        output.push(item);
                    }
                }

                for (const child of node.nodes || []) {
                    walk(child);
                }

                for (const child of node.children || []) {
                    walk(child);
                }
            };

            for (const config of cve.configurations || []) {
                walk(config);
            }

            return output;
        }

        static matchesProduct(criteria, product) {
            if (typeof criteria !== "string") {
                return false;
            }

            const parts = criteria.toLowerCase().split(":");
            const cpeProduct = parts[4] || "";
            const cpeVendor = parts[3] || "";

            const normalize = value =>
                String(value).toLowerCase().replace(/[^a-z0-9]/g, "");

            const target = normalize(product);

            return (
                normalize(cpeProduct) === target ||
                normalize(cpeVendor) === target ||
                normalize(cpeVendor + cpeProduct) === target
            );
        }

        static evaluateVersion(cpe, detectedVersion) {
            const criteria = String(cpe.criteria || "");
            const parts = criteria.split(":");
            const cpeVersion = parts[5] || "*";

            const startIncluding = cpe.versionStartIncluding;
            const startExcluding = cpe.versionStartExcluding;
            const endIncluding = cpe.versionEndIncluding;
            const endExcluding = cpe.versionEndExcluding;

            if (
                !startIncluding &&
                !startExcluding &&
                !endIncluding &&
                !endExcluding
            ) {
                if (cpeVersion === "*" || cpeVersion === "-") {
                    return "potential";
                }

                return NVD.compareVersions(
                    detectedVersion,
                    cpeVersion
                ) === 0
                    ? "affected"
                    : "not-affected";
            }

            if (
                startIncluding &&
                NVD.compareVersions(detectedVersion, startIncluding) < 0
            ) {
                return "not-affected";
            }

            if (
                startExcluding &&
                NVD.compareVersions(detectedVersion, startExcluding) <= 0
            ) {
                return "not-affected";
            }

            if (
                endIncluding &&
                NVD.compareVersions(detectedVersion, endIncluding) > 0
            ) {
                return "not-affected";
            }

            if (
                endExcluding &&
                NVD.compareVersions(detectedVersion, endExcluding) >= 0
            ) {
                return "not-affected";
            }

            return "affected";
        }

        static compareVersions(a, b) {
            const tokenize = value =>
                String(value)
                    .replace(/^v/i, "")
                    .split(/[.+_-]/)
                    .map(part => /^\d+$/.test(part)
                        ? Number(part)
                        : part.toLowerCase()
                    );

            const left = tokenize(a);
            const right = tokenize(b);

            const length = Math.max(left.length, right.length);

            for (let i = 0; i < length; i++) {
                const x = left[i] ?? 0;
                const y = right[i] ?? 0;

                if (x === y) {
                    continue;
                }

                if (typeof x === "number" && typeof y === "number") {
                    return x < y ? -1 : 1;
                }

                return String(x).localeCompare(String(y), undefined, {
                    numeric: true
                });
            }

            return 0;
        }

        static getSeverity(cve) {
            const metrics = cve.metrics || {};

            const candidates = [
                ...(metrics.cvssMetricV40 || []),
                ...(metrics.cvssMetricV31 || []),
                ...(metrics.cvssMetricV30 || []),
                ...(metrics.cvssMetricV2 || [])
            ];

            const metric = candidates[0];

            if (!metric) {
                return {
                    label: "Unknown",
                    score: null
                };
            }

            const cvss = metric.cvssData || {};
            const score = Number(cvss.baseScore);

            let label = "Unknown";

            if (Number.isFinite(score)) {
                if (score >= 9) label = "Critical";
                else if (score >= 7) label = "High";
                else if (score >= 4) label = "Medium";
                else label = "Low";
            }

            return {
                label,
                score: Number.isFinite(score) ? score : null
            };
        }

        static extractTitle(description) {
            const firstSentence =
                String(description).split(/(?<=[.!?])\s/)[0];

            return firstSentence.slice(0, 220);
        }
    }

    namespace.NVD = NVD;

})();