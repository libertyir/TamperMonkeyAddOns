(function (Framework) {
    "use strict";

    class WebStructureInspector extends Framework.BaseModule {
        static id = "WebStructureInspector";
        static providerId = "WebStructureInspector_Provider";
        static title = "Web Structure Inspector";
        static description = "Persistent website resource and directory explorer";
        static icon = "📁";

        // Reinitialize on every page load.
        // The resource tree itself is stored permanently.
        static scanPolicy = {
            scope: "origin-root",
            defaultTTL: "always"
        };

        static assetBaseUrl =
            "https://libertyir.github.io/TamperMonkeyAddOns/AnonymousInspectorHub/Modules/WebStructureInspector/";

        static dependencies = [
            "WebStructureInspector.ResourceStore.js",
            "WebStructureInspector.ResourceAnalyzer.js",
            "WebStructureInspector.Collector.js",
            "WebStructureInspector.DirectoryScanner.js",
            "WebStructureInspector.SensitiveScanner.js",
            "WebStructureInspector.Grabber.js",
            "WebStructureInspector.TreeBuilder.js",
            "WebStructureInspector.UIManager.js"
        ];

        constructor() {
            super();

            this.available = false;
            this.error = null;

            this.namespace = null;
            this.store = null;
            this.analyzer = null;
            this.collector = null;
            this.directoryScanner = null;
            this.sensitiveScanner = null;
            this.grabber = null;
            this.treeBuilder = null;
            this.uiManager = null;

            this.settings = {
                sensitiveScope: "both",
                grabberScope: "same-origin",
                sensitiveDetection: "both"
            };

            this.currentDirectory = new URL(
                location.pathname.endsWith("/")
                    ? location.href
                    : new URL(".", location.href).href
            ).href;

            this.operation = null;
            this.lastError = null;
        }

        async loadDependency(filename) {
            const url = WebStructureInspector.assetBaseUrl + filename;
            const source = await Framework.requestText(url);

            if (typeof source !== "string" || !source.trim()) {
                throw new Error("Unable to load dependency: " + filename);
            }

            new Function(
                "Framework",
                source + "\n//# sourceURL=" + url
            )(Framework);
        }

        async loadDependencies() {
            for (const filename of WebStructureInspector.dependencies) {
                await this.loadDependency(filename);
            }

            const ns = globalThis.AnonymousInspectorWebStructure;

            if (!ns) {
                throw new Error("Web Structure namespace is unavailable.");
            }

            this.namespace = ns;

            const required = [
                "ResourceStore",
                "ResourceAnalyzer",
                "Collector",
                "DirectoryScanner",
                "SensitiveScanner",
                "Grabber",
                "TreeBuilder",
                "UIManager"
            ];

            for (const name of required) {
                if (typeof ns[name] !== "function") {
                    throw new Error("Missing component: " + name);
                }
            }

            this.store = new ns.ResourceStore(Framework, location.origin);
            this.analyzer = new ns.ResourceAnalyzer();
            this.collector = new ns.Collector(this);
            this.directoryScanner = new ns.DirectoryScanner(this);
            this.sensitiveScanner = new ns.SensitiveScanner(this);
            this.grabber = new ns.Grabber(this);
            this.treeBuilder = new ns.TreeBuilder();
            this.uiManager = new ns.UIManager(this);
        }

        async loadSettings() {
            const key = "web-structure-settings:" + location.origin;

            try {
                const saved = await Framework.Storage.getMetadata(key);

                if (saved && typeof saved === "object") {
                    this.settings = {
                        ...this.settings,
                        ...saved
                    };
                }
            } catch (error) {
                console.warn(
                    "[WebStructureInspector] Settings load failed:",
                    error
                );
            }

            this.settings.sensitiveScope =
                ["current", "root", "both"].includes(
                    this.settings.sensitiveScope
                )
                    ? this.settings.sensitiveScope
                    : "both";

            this.settings.grabberScope =
                ["same-origin", "subdomain"].includes(
                    this.settings.grabberScope
                )
                    ? this.settings.grabberScope
                    : "same-origin";

            this.settings.sensitiveDetection =
                ["extension-name", "content", "both"].includes(
                    this.settings.sensitiveDetection
                )
                    ? this.settings.sensitiveDetection
                    : "both";
        }

        async init() {
            this.available = false;
            this.error = null;

            try {
                await this.loadDependencies();
                await this.loadSettings();
                await this.store.load();

                const siteIntelligence = Framework.SiteIntelligence;

                if (!siteIntelligence || typeof siteIntelligence.getAllResources !== "function") {
                    throw new Error("Site Intelligence service is unavailable.");
                }

                const centralResources = await siteIntelligence.getAllResources();

                if (centralResources.length) {
                    const successfulResources = centralResources.filter(record =>
                        record.status === "accessible" &&
                        record.httpStatus >= 200 &&
                        record.httpStatus < 300
                    );

                    const failedUrls = centralResources
                        .filter(record =>
                            record.status !== "accessible" ||
                            !(record.httpStatus >= 200 && record.httpStatus < 300)
                        )
                        .map(record => record.url);

                    if (failedUrls.length) {
                        await this.store.removeMany(failedUrls);
                    }

                    if (successfulResources.length) {
                        await this.store.upsertMany(
                            successfulResources.map(record => ({
                                url: record.url,
                                path: new URL(record.url).pathname,
                                name: new URL(record.url).pathname.split("/").filter(Boolean).pop() || "/",
                                type: new URL(record.url).pathname.endsWith("/") ? "directory" : "file",
                                status: "verified",
                                sources: record.sources || [],
                                tags: record.tags || [],
                                contentType: record.contentType || null,
                                size: record.contentLength || null,
                                httpStatus: record.httpStatus,
                                directoryListing: Boolean(record.metadata?.directoryListing)
                            }))
                        );
                    }
                }

                // Passive collection only. No directory requests are made here.
                await this.collector.collectCurrentPage();
                this.collector.start();

                this.available = true;

            } catch (error) {
                this.available = false;
                this.error = error.message || String(error);

                if (this.collector) {
                    this.collector.stop();
                }

                console.error(
                    "[WebStructureInspector] Initialization failed:",
                    error
                );

                throw error;
            }
        }

        getMetadata() {
            let icon = WebStructureInspector.icon;

            if (this.store) {
                const sensitive = this.store.getSensitive();

                const hasConfirmed = sensitive.some(record =>
                    (record.tags || []).includes("sensitive-confirmed")
                );

                if (hasConfirmed) {
                    icon = "🚨";
                } else if (sensitive.length > 0) {
                    icon = "⚠️";
                }
            }

            return {
                id: WebStructureInspector.id,
                title: WebStructureInspector.title,
                description: WebStructureInspector.description,
                icon
            };
        }

        getRecords() {
            return this.store
                ? this.store.getAll()
                : [];
        }

        getSensitiveRecords() {
            return this.store
                ? this.store.getSensitive()
                : [];
        }

        async executeOperation(name, callback) {
            if (this.operation) return false;

            this.operation = name;
            this.lastError = null;

            this.uiManager?.refresh();

            try {
                await callback();
                return true;

            } catch (error) {
                this.lastError = error.message || String(error);

                console.error(
                    "[WebStructureInspector] Operation failed:",
                    name,
                    error
                );

                return false;

            } finally {
                this.operation = null;
                this.uiManager?.refresh();
            }
        }

        async scanDirectory(rawUrl) {
            return this.executeOperation(
                "directory",
                async () => {
                    await this.directoryScanner.scan(rawUrl);
                }
            );
        }

        async scanSensitive(rawUrl) {
            return this.executeOperation(
                "sensitive",
                async () => {
                    await this.sensitiveScanner.scan(rawUrl);
                }
            );
        }

        async runGrabber(startUrl = location.href) {
            return this.executeOperation(
                "grabber",
                async () => {
                    await this.grabber.run(startUrl);
                }
            );
        }

        async saveSettings(settings) {
            this.settings = {
                ...this.settings,
                ...settings
            };

            await Framework.Storage.saveMetadata(
                "web-structure-settings:" + location.origin,
                this.settings
            );

            this.uiManager?.refresh();
        }

        render() {
            if (!this.uiManager) {
                const element = Framework.createElement("div", {});
                element.textContent =
                    this.error || "Web Structure Inspector is not initialized.";

                return element;
            }

            return this.uiManager.render();
        }

        getResult() {
            const records = this.getRecords();

            return {
                origin: location.origin,
                capturedAt: new Date().toISOString(),
                totalResources: records.length,
                resources: records
            };
        }

        destroy() {
            if (this.collector) {
                this.collector.stop();
            }

            this.available = false;
        }
    }

    Framework.register(
        WebStructureInspector.id,
        WebStructureInspector
    );

})(Framework);