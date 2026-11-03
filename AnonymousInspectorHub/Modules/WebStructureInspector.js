(function (Framework) {
    "use strict";

    class WebStructureInspector extends Framework.BaseModule {
        static id = "WebStructureInspector";
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

            await this.loadDependencies();
            await this.loadSettings();
            await this.store.load();

            // Passive collection only. No directory requests are made here.
            await this.collector.collectCurrentPage();
            this.collector.start();

            this.available = true;
        }

        getMetadata() {
            return {
                id: WebStructureInspector.id,
                title: WebStructureInspector.title,
                description: WebStructureInspector.description,
                icon: WebStructureInspector.icon
            };
        }

        getRecords() {
            return this.store.getAll();
        }

        async scanDirectory(rawUrl) {
            if (this.operation) return;

            this.operation = "directory";
            this.lastError = null;
            this.uiManager.refresh();

            try {
                await this.directoryScanner.scan(rawUrl);
            } catch (error) {
                this.lastError = error.message;
            } finally {
                this.operation = null;
                this.uiManager.refresh();
            }
        }

        async scanSensitive(rawUrl) {
            if (this.operation) return;

            this.operation = "sensitive";
            this.lastError = null;
            this.uiManager.refresh();

            try {
                await this.sensitiveScanner.scan(rawUrl);
            } catch (error) {
                this.lastError = error.message;
            } finally {
                this.operation = null;
                this.uiManager.refresh();
            }
        }

        async runGrabber(startUrl = location.href) {
            if (this.operation) return;

            this.operation = "grabber";
            this.lastError = null;
            this.uiManager.refresh();

            try {
                await this.grabber.run(startUrl);
            } catch (error) {
                this.lastError = error.message;
            } finally {
                this.operation = null;
                this.uiManager.refresh();
            }
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

            this.uiManager.refresh();
        }

        render() {
            return this.uiManager.render();
        }

        getResult() {
            return {
                origin: location.origin,
                capturedAt: new Date().toISOString(),
                totalResources: this.store
                    ? this.store.getAll().length
                    : 0,
                resources: this.store
                    ? this.store.getAll()
                    : []
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