(function (Framework) {
    "use strict";

    // ==================================================
    // MODULE
    // ==================================================

    class DebugModeInspector extends Framework.BaseModule {

        static id = "DebugModeInspector";

        static title = "Debug Mode Inspector";

        static description =
            "Detect exposed debugging interfaces, development error pages and known platform vulnerabilities.";

        static icon = "🔍";

        static scanPolicy = {
            scope: "origin-root",
            defaultTTL: "7d"
        };

        // ==================================================
        // CONFIGURATION
        // ==================================================

        static assetBaseUrl =
            "https://libertyir.github.io/TamperMonkeyAddOns/AnonymousInspectorHub/Modules/DebugModeInspector/";

        static confidenceThreshold = 0.65;

        static maxRequests = 20;

        static requestTimeout = 7000;

        static maxResponseSize = 128 * 1024;

        static platformModules = [
            "DotNet",
            "Laravel",
            "Django",
            "PHP",
            "WordPress",
            "Flask",
            "Node",
            "Java",
            "Rails",
            "Go"
        ];

        static sharedDependencies = [
            "DebugModeInspector.PlatformDetector.js",
            "DebugModeInspector.RequestManager.js",
            "DebugModeInspector.EvidenceAnalyzer.js",
            "DebugModeInspector.ReportBuilder.js",

            // Vulnerability dependencies
            "DebugModeInspector.CVE.NVD.js",
            "DebugModeInspector.CVE.OSV.js",
            "DebugModeInspector.CVE.GitHub.js",
            "DebugModeInspector.VulnerabilityLookup.js"
        ];

        // ==================================================
        // CONSTRUCTOR
        // ==================================================

        constructor(...args) {
            super(...args);

            this.available = false;
            this.error = null;

            this.namespace = null;

            this.requestManager = null;
            this.requestManagerInstance = null;

            this.platformDetector = null;
            this.evidenceAnalyzer = null;
            this.reportBuilder = null;

            this.vulnerabilityLookup = null;
            this.vulnerabilityReport = null;

            this.loadedPlatforms = new Map();

            this.dependencyErrors = [];

            this.detectedPlatforms = [];

            this.results = [];

            this.report = null;

            this.scannedAt = null;

            this.scanStartedAt = null;

            this.scanDuration = 0;

            this.initialized = false;
        }

        // ==================================================
        // METADATA
        // ==================================================

        getMetadata() {
            return {
                id: DebugModeInspector.id,
                title: DebugModeInspector.title,
                description: DebugModeInspector.description,
                icon: DebugModeInspector.icon
            };
        }

        // ==================================================
        // NAMESPACE
        // ==================================================

        getNamespace() {
            const namespaceName =
                "AnonymousInspectorDebugMode";

            if (
                !globalThis[namespaceName] ||
                typeof globalThis[namespaceName] !== "object"
            ) {
                globalThis[namespaceName] = {
                    platforms: new Map(),

                    registerPlatform(id, platform) {
                        if (
                            typeof id !== "string" ||
                            !id.trim()
                        ) {
                            throw new Error(
                                "Invalid platform ID."
                            );
                        }

                        if (
                            !platform ||
                            typeof platform !== "object"
                        ) {
                            throw new Error(
                                "Invalid platform definition."
                            );
                        }

                        this.platforms.set(id, platform);

                        return platform;
                    },

                    getPlatform(id) {
                        return this.platforms.get(id) || null;
                    },

                    hasPlatform(id) {
                        return this.platforms.has(id);
                    }
                };
            }

            const namespace = globalThis[namespaceName];

            if (!(namespace.platforms instanceof Map)) {
                namespace.platforms = new Map();
            }

            if (
                typeof namespace.registerPlatform !== "function"
            ) {
                namespace.registerPlatform = function (id, platform) {
                    namespace.platforms.set(id, platform);
                    return platform;
                };
            }

            this.namespace = namespace;

            return namespace;
        }

        // ==================================================
        // SCRIPT LOADER
        // ==================================================

        async loadScript(filename) {
            const url =
                DebugModeInspector.assetBaseUrl + filename;

            const source = await Framework.requestText(url);

            if (
                typeof source !== "string" ||
                !source.trim()
            ) {
                throw new Error(
                    "Unable to load dependency: " + filename
                );
            }

            try {
                const execute = new Function(
                    "Framework",
                    source +
                    "\n//# sourceURL=" + url
                );

                execute(Framework);

            } catch (error) {
                throw new Error(
                    "Execution failed for " +
                    filename +
                    ": " +
                    error.message
                );
            }
        }

        // ==================================================
        // DEPENDENCY LOADING
        // ==================================================

        async loadSharedDependencies() {
            const namespace = this.getNamespace();

            for (
                const filename of
                DebugModeInspector.sharedDependencies
            ) {
                await this.loadScript(filename);
            }

            this.requestManager =
                namespace.RequestManager || null;

            this.platformDetector =
                typeof namespace.PlatformDetector === "function"
                    ? new namespace.PlatformDetector()
                    : null;

            this.evidenceAnalyzer =
                typeof namespace.EvidenceAnalyzer === "function"
                    ? new namespace.EvidenceAnalyzer()
                    : namespace.EvidenceAnalyzer || null;

            this.reportBuilder =
                namespace.ReportBuilder || null;

            // ----------------------------------------------
            // Vulnerability lookup
            // ----------------------------------------------

            this.vulnerabilityLookup = null;

            if (
                typeof namespace.VulnerabilityLookup === "function"
            ) {
                this.vulnerabilityLookup =
                    new namespace.VulnerabilityLookup({
                        Framework,

                        maxProducts: 5,

                        maxResultsPerProduct: 20,

                        maxOSVLookups: 5,

                        maxGitHubLookups: 5
                    });
            }

            const required = [
                ["RequestManager", this.requestManager],
                ["PlatformDetector", this.platformDetector],
                ["EvidenceAnalyzer", this.evidenceAnalyzer],
                ["ReportBuilder", this.reportBuilder],
                ["VulnerabilityLookup", this.vulnerabilityLookup]
            ];

            const missing = required
                .filter(([, value]) => !value)
                .map(([name]) => name);

            if (missing.length) {
                throw new Error(
                    "Missing shared dependencies: " +
                    missing.join(", ")
                );
            }

            return true;
        }

        // ==================================================
        // PLATFORM LOADING
        // ==================================================

        async loadPlatformModules() {
            const namespace = this.getNamespace();

            for (
                const platformId of
                DebugModeInspector.platformModules
            ) {
                const filename =
                    "DebugModeInspector." +
                    platformId +
                    ".js";

                try {
                    await this.loadScript(filename);

                    const platform =
                        namespace.getPlatform(platformId);

                    if (!platform) {
                        throw new Error(
                            "Platform did not register itself."
                        );
                    }

                    if (typeof platform.run !== "function") {
                        throw new Error(
                            "Platform run() method is missing."
                        );
                    }

                    this.loadedPlatforms.set(
                        platformId,
                        platform
                    );

                } catch (error) {
                    this.dependencyErrors.push({
                        platform: platformId,
                        message: error.message
                    });

                    console.error(
                        "[DebugModeInspector] Platform loading failed:",
                        platformId,
                        error
                    );
                }
            }

            return this.loadedPlatforms;
        }

        // ==================================================
        // REQUEST MANAGER
        // ==================================================

        createRequestManager() {
            const RequestManager = this.requestManager;

            return new RequestManager({
                Framework,

                origin: location.origin,

                timeout:
                    DebugModeInspector.requestTimeout,

                maxRequests:
                    DebugModeInspector.maxRequests,

                maxResponseSize:
                    DebugModeInspector.maxResponseSize,

                allowedMethods: [
                    "GET",
                    "HEAD"
                ]
            });
        }

        // ==================================================
        // PLATFORM DETECTION
        // ==================================================

        async detectPlatforms(context) {
            const detector = this.platformDetector;

            const detected = await detector.detect({
                origin: location.origin,
                hostname: location.hostname,
                pathname: location.pathname,

                requestManager:
                    this.requestManagerInstance,

                context
            });

            if (!Array.isArray(detected)) {
                return [];
            }

            return detected
                .filter(item => {
                    return (
                        item &&
                        typeof item.id === "string" &&
                        Number.isFinite(item.confidence)
                    );
                })
                .sort((a, b) => {
                    return b.confidence - a.confidence;
                });
        }

        // ==================================================
        // PLATFORM SELECTION
        // ==================================================

        selectPlatforms(detected) {
            const threshold =
                DebugModeInspector.confidenceThreshold;

            const candidates = detected.filter(item => {
                return item.confidence >= threshold;
            });

            const selected = candidates
                .filter(item => {
                    return this.loadedPlatforms.has(item.id);
                })
                .map(item => item.id);

            if (selected.length > 0) {
                return {
                    mode: "detected",
                    platforms: [...new Set(selected)],
                    candidates
                };
            }

            return {
                mode: "fallback",
                platforms: [
                    ...this.loadedPlatforms.keys()
                ],
                candidates
            };
        }

        // ==================================================
        // PLATFORM EXECUTION
        // ==================================================

        async executePlatform(platformId, context) {
            const platform =
                this.loadedPlatforms.get(platformId);

            if (!platform) {
                return {
                    platform: platformId,
                    status: "Error",
                    error: "Platform module is unavailable.",
                    findings: []
                };
            }

            try {
                const output = await platform.run({
                    ...context,

                    platformId,

                    requestManager:
                        this.requestManagerInstance,

                    evidenceAnalyzer:
                        this.evidenceAnalyzer
                });

                return {
                    platform: platformId,
                    status: "Completed",

                    findings: Array.isArray(output?.findings)
                        ? output.findings
                        : [],

                    metadata: output?.metadata || {},

                    error: null
                };

            } catch (error) {
                console.error(
                    "[DebugModeInspector] Platform execution failed:",
                    platformId,
                    error
                );

                return {
                    platform: platformId,
                    status: "Error",
                    findings: [],
                    error: error.message
                };
            }
        }

        // ==================================================
        // VULNERABILITY INSPECTION
        // ==================================================

        async inspectVulnerabilities(context) {
            if (
                !this.vulnerabilityLookup ||
                typeof this.vulnerabilityLookup.run !== "function"
            ) {
                return {
                    status: "Unavailable",
                    targets: [],
                    vulnerabilities: [],
                    skipped: [],
                    errors: [
                        "VulnerabilityLookup is unavailable."
                    ],
                    metadata: {}
                };
            }

            try {
                return await this.vulnerabilityLookup.run({
                    results: this.results,

                    detectedPlatforms:
                        this.detectedPlatforms,

                    context
                });

            } catch (error) {
                console.error(
                    "[DebugModeInspector] Vulnerability inspection failed:",
                    error
                );

                return {
                    status: "Error",
                    targets: [],
                    vulnerabilities: [],
                    skipped: [],
                    errors: [
                        error.message || "Unknown vulnerability lookup error."
                    ],
                    metadata: {}
                };
            }
        }

        // ==================================================
        // EXECUTION PIPELINE
        // ==================================================

        async runInspection() {
            this.scanStartedAt = Date.now();

            this.scannedAt = new Date().toISOString();

            this.results = [];

            this.detectedPlatforms = [];

            this.dependencyErrors = [];

            this.vulnerabilityReport = null;

            this.report = null;

            this.loadedPlatforms.clear();

            // ----------------------------------------------
            // 1. Load shared dependencies
            // ----------------------------------------------

            await this.loadSharedDependencies();

            // ----------------------------------------------
            // 2. Create request manager
            // ----------------------------------------------

            this.requestManagerInstance =
                this.createRequestManager();

            // ----------------------------------------------
            // 3. Load platform modules
            // ----------------------------------------------

            await this.loadPlatformModules();

            if (this.loadedPlatforms.size === 0) {
                throw new Error(
                    "No platform modules could be loaded."
                );
            }

            // ----------------------------------------------
            // 4. Inspection context
            // ----------------------------------------------

            const context = {
                origin: location.origin,
                hostname: location.hostname,
                pathname: location.pathname,
                url: location.href
            };

            // ----------------------------------------------
            // 5. Detect platforms
            // ----------------------------------------------

            this.detectedPlatforms =
                await this.detectPlatforms(context);

            // ----------------------------------------------
            // 6. Select platforms
            // ----------------------------------------------

            const selection =
                this.selectPlatforms(
                    this.detectedPlatforms
                );

            // ----------------------------------------------
            // 7. Execute selected platforms
            // ----------------------------------------------

            for (
                const platformId of
                selection.platforms
            ) {
                const result =
                    await this.executePlatform(
                        platformId,
                        context
                    );

                this.results.push(result);
            }

            // ----------------------------------------------
            // 8. Vulnerability lookup
            // ----------------------------------------------

            this.vulnerabilityReport =
                await this.inspectVulnerabilities(context);

            // ----------------------------------------------
            // 9. Analyze evidence
            // ----------------------------------------------

            const analysis =
                await this.evidenceAnalyzer.analyze({
                    results: this.results,

                    detectedPlatforms:
                        this.detectedPlatforms,

                    context
                });

            // ----------------------------------------------
            // 10. Build final report
            // ----------------------------------------------

            this.report =
                await this.reportBuilder.build({
                    context,

                    scannedAt: this.scannedAt,

                    duration:
                        Date.now() - this.scanStartedAt,

                    detectionMode: selection.mode,

                    detectedPlatforms:
                        this.detectedPlatforms,

                    selectedPlatforms:
                        selection.platforms,

                    results: this.results,

                    analysis,

                    dependencyErrors:
                        this.dependencyErrors,

                    vulnerabilityReport:
                        this.vulnerabilityReport
                });

            // Keep vulnerability report accessible
            // independently of ReportBuilder structure.

            if (this.report &&
                typeof this.report === "object") {

                this.report.vulnerabilityReport =
                    this.vulnerabilityReport;
            }

            this.scanDuration =
                Date.now() - this.scanStartedAt;

            this.initialized = true;
            this.available = true;
            this.error = null;

            return this.report;
        }

        // ==================================================
        // INITIALIZATION
        // ==================================================

        async init() {
            try {
                await this.runInspection();

                this.available = true;

                return true;

            } catch (error) {
                this.available = false;
                this.error = error.message;

                console.error(
                    "[DebugModeInspector] Initialization failed:",
                    error
                );

                throw error;
            }
        }

        // ==================================================
        // RESULT
        // ==================================================

        getResult() {
            return {
                moduleId: DebugModeInspector.id,

                scannedAt: this.scannedAt,

                scanDuration: this.scanDuration,

                available: this.available,

                error: this.error,

                detectedPlatforms:
                    this.detectedPlatforms,

                results: this.results,

                report: this.report,

                vulnerabilityReport:
                    this.vulnerabilityReport,

                dependencyErrors:
                    this.dependencyErrors
            };
        }

        // ==================================================
        // RESTORE RESULT
        // ==================================================

        restoreResult(data) {
            if (!data || typeof data !== "object") {
                return false;
            }

            this.scannedAt =
                data.scannedAt || null;

            this.scanDuration =
                Number(data.scanDuration) || 0;

            this.available =
                data.available === true;

            this.error =
                data.error || null;

            this.detectedPlatforms =
                Array.isArray(data.detectedPlatforms)
                    ? data.detectedPlatforms
                    : [];

            this.results =
                Array.isArray(data.results)
                    ? data.results
                    : [];

            this.report =
                data.report || null;

            this.vulnerabilityReport =
                data.vulnerabilityReport ||
                this.report?.vulnerabilityReport ||
                null;

            this.dependencyErrors =
                Array.isArray(data.dependencyErrors)
                    ? data.dependencyErrors
                    : [];

            this.initialized = true;

            return true;
        }

        // ==================================================
        // DOM HELPERS
        // ==================================================

        createElement(tag, className, text) {
            const element = document.createElement(tag);

            if (className) {
                element.className = className;
            }

            if (text !== undefined && text !== null) {
                element.textContent = String(text);
            }

            return element;
        }

        createButton(label, callback) {
            const button = this.createElement(
                "button",
                "aih-debug-button",
                label
            );

            button.type = "button";

            button.addEventListener("click", callback);

            return button;
        }

        // ==================================================
        // RENDER
        // ==================================================

        render() {
            const root = this.createElement(
                "div",
                "aih-debug-inspector"
            );

            const style = this.createElement("style");

            style.textContent = `
                .aih-debug-inspector {
                    color: inherit;
                    font-size: 13px;
                }

                .aih-debug-summary {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 10px;
                    margin-bottom: 14px;
                }

                .aih-debug-stat {
                    border: 1px solid rgba(128,128,128,.3);
                    border-radius: 6px;
                    padding: 10px 14px;
                    min-width: 120px;
                }

                .aih-debug-stat strong {
                    display: block;
                    font-size: 19px;
                    margin-bottom: 4px;
                }

                .aih-debug-card {
                    border: 1px solid rgba(128,128,128,.3);
                    border-radius: 6px;
                    padding: 12px;
                    margin: 10px 0;
                }

                .aih-debug-header {
                    display: flex;
                    justify-content: space-between;
                    flex-wrap: wrap;
                    gap: 8px;
                    margin-bottom: 8px;
                    font-weight: 600;
                }

                .aih-debug-meta {
                    opacity: .7;
                    margin: 6px 0;
                }

                .aih-debug-error {
                    color: #d66;
                    overflow-wrap: anywhere;
                }

                .aih-debug-button {
                    cursor: pointer;
                    padding: 7px 12px;
                    border: 1px solid rgba(128,128,128,.4);
                    border-radius: 4px;
                    background: transparent;
                    color: inherit;
                    margin: 4px 4px 4px 0;
                }

                .aih-debug-button:hover {
                    background: rgba(128,128,128,.15);
                }

                .aih-debug-finding {
                    border-top: 1px solid rgba(128,128,128,.2);
                    padding-top: 8px;
                    margin-top: 8px;
                    overflow-wrap: anywhere;
                }

                .aih-debug-cve {
                    border-top: 1px solid rgba(128,128,128,.2);
                    padding-top: 10px;
                    margin-top: 10px;
                    overflow-wrap: anywhere;
                }

                .aih-debug-cve-title {
                    font-weight: 600;
                    margin-bottom: 6px;
                }

                .aih-debug-cve a {
                    color: inherit;
                    text-decoration: underline;
                }

                .aih-debug-severity {
                    display: inline-block;
                    border: 1px solid rgba(128,128,128,.4);
                    border-radius: 4px;
                    padding: 2px 6px;
                    margin-left: 5px;
                    font-size: 11px;
                }
            `;

            root.appendChild(style);

            // ----------------------------------------------
            // Summary
            // ----------------------------------------------

            const summary = this.createElement(
                "div",
                "aih-debug-summary"
            );

            const findingCount =
                this.results.reduce(
                    (total, item) =>
                        total + (item.findings || []).length,
                    0
                );

            const vulnerabilityCount =
                this.vulnerabilityReport?.vulnerabilities?.length || 0;

            const stats = [
                [
                    "Platforms Detected",
                    this.detectedPlatforms.length
                ],
                [
                    "Platforms Tested",
                    this.results.length
                ],
                [
                    "Findings",
                    findingCount
                ],
                [
                    "Known CVEs",
                    vulnerabilityCount
                ],
                [
                    "Scan Duration",
                    this.scanDuration + " ms"
                ]
            ];

            for (const [label, value] of stats) {
                const stat = this.createElement(
                    "div",
                    "aih-debug-stat"
                );

                stat.appendChild(
                    this.createElement(
                        "strong",
                        "",
                        value
                    )
                );

                stat.appendChild(
                    this.createElement(
                        "span",
                        "",
                        label
                    )
                );

                summary.appendChild(stat);
            }

            root.appendChild(summary);

            // ----------------------------------------------
            // Final status
            // ----------------------------------------------

            if (this.report) {
                const status = this.createElement(
                    "div",
                    "aih-debug-card"
                );

                status.appendChild(
                    this.createElement(
                        "div",
                        "aih-debug-header",
                        "Inspection Result"
                    )
                );

                status.appendChild(
                    this.createElement(
                        "div",
                        "",
                        this.report.status || "Not Detected"
                    )
                );

                if (this.report.summary) {
                    status.appendChild(
                        this.createElement(
                            "div",
                            "aih-debug-meta",
                            this.report.summary
                        )
                    );
                }

                root.appendChild(status);
            }

            // ----------------------------------------------
            // Actions
            // ----------------------------------------------

            root.appendChild(
                this.createButton(
                    "Copy Full Report",
                    () => {
                        Framework.copy(
                            JSON.stringify(
                                this.getResult(),
                                null,
                                2
                            )
                        );
                    }
                )
            );

            // ----------------------------------------------
            // Platform results
            // ----------------------------------------------

            for (const result of this.results) {
                root.appendChild(
                    this.renderPlatformResult(result)
                );
            }

            // ----------------------------------------------
            // Vulnerability report
            // ----------------------------------------------

            if (this.vulnerabilityReport) {
                root.appendChild(
                    this.renderVulnerabilityReport(
                        this.vulnerabilityReport
                    )
                );
            }

            // ----------------------------------------------
            // Dependency errors
            // ----------------------------------------------

            if (this.dependencyErrors.length > 0) {
                const errors = this.createElement(
                    "div",
                    "aih-debug-card"
                );

                errors.appendChild(
                    this.createElement(
                        "div",
                        "aih-debug-header",
                        "Dependency Errors"
                    )
                );

                for (const item of this.dependencyErrors) {
                    errors.appendChild(
                        this.createElement(
                            "div",
                            "aih-debug-error",
                            item.platform + ": " + item.message
                        )
                    );
                }

                root.appendChild(errors);
            }

            if (this.error) {
                root.appendChild(
                    this.createElement(
                        "div",
                        "aih-debug-error",
                        this.error
                    )
                );
            }

            return root;
        }

        // ==================================================
        // PLATFORM RESULT RENDERING
        // ==================================================

        renderPlatformResult(result) {
            const card = this.createElement(
                "div",
                "aih-debug-card"
            );

            const header = this.createElement(
                "div",
                "aih-debug-header"
            );

            header.appendChild(
                this.createElement(
                    "span",
                    "",
                    result.platform
                )
            );

            header.appendChild(
                this.createElement(
                    "span",
                    "",
                    result.status
                )
            );

            card.appendChild(header);

            if (result.error) {
                card.appendChild(
                    this.createElement(
                        "div",
                        "aih-debug-error",
                        result.error
                    )
                );
            }

            for (const finding of result.findings || []) {
                const item = this.createElement(
                    "div",
                    "aih-debug-finding"
                );

                item.appendChild(
                    this.createElement(
                        "strong",
                        "",
                        finding.title ||
                        finding.type ||
                        "Finding"
                    )
                );

                if (finding.description) {
                    item.appendChild(
                        this.createElement(
                            "div",
                            "",
                            finding.description
                        )
                    );
                }

                if (finding.url) {
                    item.appendChild(
                        this.createElement(
                            "div",
                            "aih-debug-meta",
                            finding.url
                        )
                    );
                }

                if (finding.confidence !== undefined) {
                    item.appendChild(
                        this.createElement(
                            "div",
                            "aih-debug-meta",
                            "Confidence: " +
                            finding.confidence
                        )
                    );
                }

                card.appendChild(item);
            }

            return card;
        }

        // ==================================================
        // VULNERABILITY REPORT RENDERING
        // ==================================================

        renderVulnerabilityReport(report) {
            const card = this.createElement(
                "div",
                "aih-debug-card"
            );

            card.appendChild(
                this.createElement(
                    "div",
                    "aih-debug-header",
                    "Known Vulnerabilities (CVE)"
                )
            );

            card.appendChild(
                this.createElement(
                    "div",
                    "aih-debug-meta",
                    "Lookup Status: " +
                    (report.status || "Unknown")
                )
            );

            const vulnerabilities =
                Array.isArray(report.vulnerabilities)
                    ? report.vulnerabilities
                    : [];

            card.appendChild(
                this.createElement(
                    "div",
                    "",
                    "Found: " + vulnerabilities.length
                )
            );

            // ----------------------------------------------
            // Vulnerability entries
            // ----------------------------------------------

            for (const item of vulnerabilities) {
                const entry = this.createElement(
                    "div",
                    "aih-debug-cve"
                );

                const title = this.createElement(
                    "div",
                    "aih-debug-cve-title"
                );

                title.appendChild(
                    this.createElement(
                        "strong",
                        "",
                        item.id || "Unknown CVE"
                    )
                );

                title.appendChild(
                    this.createElement(
                        "span",
                        "aih-debug-severity",
                        item.severity || "UNKNOWN"
                    )
                );

                entry.appendChild(title);

                entry.appendChild(
                    this.createElement(
                        "div",
                        "",
                        item.title || "No title available."
                    )
                );

                entry.appendChild(
                    this.createElement(
                        "div",
                        "aih-debug-meta",
                        "Platform: " +
                        (item.platform || "Unknown")
                    )
                );

                entry.appendChild(
                    this.createElement(
                        "div",
                        "aih-debug-meta",
                        "Detected Version: " +
                        (item.detectedVersion || "Unknown")
                    )
                );

                entry.appendChild(
                    this.createElement(
                        "div",
                        "aih-debug-meta",
                        "Match Status: " +
                        (item.matchStatus || "Potential")
                    )
                );

                if (Array.isArray(item.platforms) &&
                    item.platforms.length > 1) {

                    entry.appendChild(
                        this.createElement(
                            "div",
                            "aih-debug-meta",
                            "Additional platform matches: " +
                            item.platforms.length
                        )
                    );
                }

                // ------------------------------------------
                // External references
                // ------------------------------------------

                if (
                    typeof item.url === "string" &&
                    /^https:\/\/nvd\.nist\.gov\//i.test(item.url)
                ) {
                    const link = this.createElement("a");

                    link.href = item.url;
                    link.target = "_blank";
                    link.rel = "noopener noreferrer";
                    link.textContent = "View NVD Record";

                    entry.appendChild(link);
                }

                // ------------------------------------------
                // OSV enrichment
                // ------------------------------------------

                if (item.osv) {
                    entry.appendChild(
                        this.createElement(
                            "div",
                            "aih-debug-meta",
                            "OSV: Additional advisory information available."
                        )
                    );
                }

                // ------------------------------------------
                // GitHub enrichment
                // ------------------------------------------

                if (item.github) {
                    entry.appendChild(
                        this.createElement(
                            "div",
                            "aih-debug-meta",
                            "GitHub Advisory: " +
                            (
                                item.github.ghsa_id ||
                                "Additional advisory information available."
                            )
                        )
                    );

                    const githubUrl = item.github.url;

                    if (
                        typeof githubUrl === "string" &&
                        /^https:\/\/github\.com\//i.test(githubUrl)
                    ) {
                        const link = this.createElement("a");

                        link.href = githubUrl;
                        link.target = "_blank";
                        link.rel = "noopener noreferrer";
                        link.textContent = "View GitHub Advisory";

                        entry.appendChild(link);
                    }
                }

                card.appendChild(entry);
            }

            // ----------------------------------------------
            // Lookup errors
            // ----------------------------------------------

            if (Array.isArray(report.errors) &&
                report.errors.length > 0) {

                const errors = this.createElement(
                    "div",
                    "aih-debug-finding"
                );

                errors.appendChild(
                    this.createElement(
                        "strong",
                        "",
                        "Lookup Errors"
                    )
                );

                for (const error of report.errors) {
                    const message =
                        typeof error === "string"
                            ? error
                            : [
                                error.source || "Source",
                                error.id || error.platform || "",
                                error.message || "Unknown error"
                            ].filter(Boolean).join(": ");

                    errors.appendChild(
                        this.createElement(
                            "div",
                            "aih-debug-error",
                            message
                        )
                    );
                }

                card.appendChild(errors);
            }

            // ----------------------------------------------
            // Metadata
            // ----------------------------------------------

            if (report.metadata) {
                const metadata = report.metadata;

                const sourceSummary = [
                    "NVD: " +
                    (metadata.queriedProducts ?? 0),

                    "OSV: " +
                    (metadata.osvEnriched ?? 0),

                    "GitHub: " +
                    (metadata.githubEnriched ?? 0)
                ].join(" | ");

                card.appendChild(
                    this.createElement(
                        "div",
                        "aih-debug-meta",
                        sourceSummary
                    )
                );
            }

            return card;
        }

        // ==================================================
        // DESTROY
        // ==================================================

        destroy() {
            if (
                this.requestManagerInstance &&
                typeof this.requestManagerInstance.destroy === "function"
            ) {
                this.requestManagerInstance.destroy();
            }

            this.requestManagerInstance = null;

            this.initialized = false;
        }
    }

    // ==================================================
    // REGISTER MODULE
    // ==================================================

    Framework.register(
        DebugModeInspector.id,
        DebugModeInspector
    );

})(Framework);