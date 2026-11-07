(function (Framework) {
    "use strict";

    class WebStructureInspectorScanner extends Framework.BaseModule {
        static id = "WebStructureInspector_Scanner";

        static scanPolicy = {
            scope: "origin-root",
            defaultTTL: "always"
        };

        static dependencies = [
            "WebStructureInspector.ResourceStore.js",
            "WebStructureInspector.ResourceAnalyzer.js",
            "WebStructureInspector.Collector.js",
            "WebStructureInspector.DirectoryScanner.js",
            "WebStructureInspector.SensitiveScanner.js"
        ];

        constructor() {
            super();

            this.cancelled = false;
            this.module = null;
            this.directoryScanner = null;
            this.sensitiveScanner = null;
            this.collector = null;
        }

        async loadDependencies() {
            const namespace = globalThis.AnonymousInspectorWebStructure;

            for (const filename of WebStructureInspectorScanner.dependencies) {
                const current = globalThis.AnonymousInspectorWebStructure;

                if (
                    current &&
                    current.ResourceStore &&
                    current.ResourceAnalyzer &&
                    current.Collector &&
                    current.DirectoryScanner &&
                    current.SensitiveScanner
                ) {
                    break;
                }

                const url =
                    "https://libertyir.github.io/TamperMonkeyAddOns/" +
                    "AnonymousInspectorHub/Modules/WebStructureInspector/" +
                    filename;

                const source = await Framework.requestText(url);

                if (typeof source !== "string" || !source.trim()) {
                    throw new Error(
                        "Unable to load Web Structure component: " + filename
                    );
                }

                new Function(
                    "Framework",
                    source + "\n//# sourceURL=" + url
                )(Framework);
            }

            const ns = globalThis.AnonymousInspectorWebStructure ||
                namespace;

            const required = [
                "ResourceStore",
                "ResourceAnalyzer",
                "Collector",
                "DirectoryScanner",
                "SensitiveScanner"
            ];

            for (const name of required) {
                if (typeof ns?.[name] !== "function") {
                    throw new Error(
                        "Web Structure component is unavailable: " + name
                    );
                }
            }

            return ns;
        }

        async loadSettings() {
            const defaults = {
                sensitiveScope: "both",
                grabberScope: "same-origin",
                sensitiveDetection: "both"
            };

            const saved = await Framework.Storage.getMetadata(
                "web-structure-settings:" + location.origin
            );

            return {
                ...defaults,
                ...(saved && typeof saved === "object" ? saved : {})
            };
        }

        async scan(context = {}) {
            this.cancelled = false;

            const origin = new URL(
                context.origin || location.origin
            ).origin;

            if (origin !== location.origin) {
                throw new Error(
                    "Web Structure scanning is restricted to the current origin."
                );
            }

            const rootUrl = origin + "/";
            const ns = await this.loadDependencies();

            if (this.cancelled) {
                throw new Error("Web Structure scan was cancelled.");
            }

            const store = new ns.ResourceStore(Framework, origin);
            const settings = await this.loadSettings();

            await store.load();

            this.module = {
                settings,
                store,
                analyzer: new ns.ResourceAnalyzer()
            };

            this.directoryScanner = new ns.DirectoryScanner(
                this.module
            );

            this.sensitiveScanner = new ns.SensitiveScanner(
                this.module
            );

            this.collector = new ns.Collector(this.module);

            await this.collector.collectCurrentPage();

            if (this.cancelled) {
                throw new Error("Web Structure scan was cancelled.");
            }

            await this.directoryScanner.scan(rootUrl);

            if (this.cancelled) {
                throw new Error("Web Structure scan was cancelled.");
            }

            await this.sensitiveScanner.scan(rootUrl);

            if (this.cancelled) {
                throw new Error("Web Structure scan was cancelled.");
            }

            const records = store.getAll();

            return {
                directoryUrl: rootUrl,
                origin,
                capturedAt: new Date().toISOString(),
                totalResources: records.length,
                resources: records
            };
        }

        async stop() {
            this.cancelled = true;

            if (this.directoryScanner) {
                this.directoryScanner.stop();
            }

            if (this.collector) {
                this.collector.stop();
            }
        }

        async destroy() {
            await this.stop();

            this.module = null;
            this.directoryScanner = null;
            this.sensitiveScanner = null;
            this.collector = null;
        }
    }

    Framework.register(
        WebStructureInspectorScanner.id,
        WebStructureInspectorScanner
    );
})(Framework);
