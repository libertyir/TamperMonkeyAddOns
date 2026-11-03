(function (root) {
    "use strict";

    const ns = root.AnonymousInspectorWebStructure =
        root.AnonymousInspectorWebStructure || {};

    class Collector {
        constructor(module) {
            this.module = module;
            this.observer = null;
            this.performanceObserver = null;
            this.started = false;
            this.pending = new Map();
            this.flushTimer = null;
        }

        isAllowed(url) {
            try {
                return new URL(url, location.href).origin === location.origin;
            } catch {
                return false;
            }
        }

        add(rawUrl, source, extra = {}) {
            if (!rawUrl) return;

            let url;

            try {
                url = new URL(rawUrl, location.href);
            } catch {
                return;
            }

            if (!this.isAllowed(url.href)) return;

            const record = this.module.analyzer.analyze(
                url.href,
                source,
                extra
            );

            if (!record) return;

            const key = record.path;
            const existing = this.pending.get(key);

            if (existing) {
                existing.sources = [
                    ...new Set([
                        ...existing.sources,
                        ...record.sources
                    ])
                ];

                existing.tags = [
                    ...new Set([
                        ...existing.tags,
                        ...record.tags
                    ])
                ];
            } else {
                this.pending.set(key, record);
            }

            this.scheduleFlush();
        }

        scheduleFlush() {
            if (this.flushTimer) return;

            this.flushTimer = setTimeout(async () => {
                this.flushTimer = null;

                const items = [...this.pending.values()];
                this.pending.clear();

                if (items.length) {
                    await this.module.store.upsertMany(items);
                    this.module.uiManager.refresh();
                }
            }, 500);
        }

        collectDocument() {
            this.add(location.href, "current-page");

            const selectors = [
                "a[href]",
                "area[href]",
                "link[href]",
                "script[src]",
                "img[src]",
                "source[src]",
                "iframe[src]",
                "video[src]",
                "audio[src]",
                "object[data]",
                "embed[src]",
                "form[action]"
            ];

            for (const element of document.querySelectorAll(
                selectors.join(",")
            )) {
                const value =
                    element.getAttribute("href") ||
                    element.getAttribute("src") ||
                    element.getAttribute("data") ||
                    element.getAttribute("action");

                if (value) {
                    this.add(value, "html-reference");
                }
            }

            for (const entry of performance.getEntriesByType("resource")) {
                this.add(entry.name, "browser-network", {
                    size: entry.transferSize || null
                });
            }
        }

        async collectCurrentPage() {
            this.collectDocument();

            const items = [...this.pending.values()];
            this.pending.clear();

            if (items.length) {
                await this.module.store.upsertMany(items);
            }
        }

        start() {
            if (this.started) return;

            this.started = true;

            this.observer = new MutationObserver(() => {
                this.collectDocument();
            });

            this.observer.observe(document.documentElement, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: [
                    "href", "src", "action", "data"
                ]
            });

            if ("PerformanceObserver" in root) {
                try {
                    this.performanceObserver = new PerformanceObserver(list => {
                        for (const entry of list.getEntries()) {
                            this.add(entry.name, "browser-network", {
                                size: entry.transferSize || null
                            });
                        }
                    });

                    this.performanceObserver.observe({
                        type: "resource",
                        buffered: true
                    });
                } catch {
                    this.performanceObserver = null;
                }
            }

            window.addEventListener("popstate", this.onNavigation);
            window.addEventListener("hashchange", this.onNavigation);
        }

        onNavigation = () => {
            this.collectDocument();
        };

        stop() {
            if (this.observer) this.observer.disconnect();
            if (this.performanceObserver) {
                this.performanceObserver.disconnect();
            }

            window.removeEventListener("popstate", this.onNavigation);
            window.removeEventListener("hashchange", this.onNavigation);

            if (this.flushTimer) {
                clearTimeout(this.flushTimer);
                this.flushTimer = null;
            }

            this.started = false;
        }
    }

    ns.Collector = Collector;

})(globalThis);