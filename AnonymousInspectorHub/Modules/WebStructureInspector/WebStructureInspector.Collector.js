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
            this.flushPromise = null;
        }

        isAllowed(url) {
            try {
                const parsed = new URL(url, document.baseURI);
                return parsed.origin === location.origin &&
                    ["http:", "https:"].includes(parsed.protocol);
            } catch {
                return false;
            }
        }

        add(rawUrl, source, extra = {}) {
            if (!rawUrl) return;

            let url;

            try {
                url = new URL(rawUrl, document.baseURI);
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
                        ...(existing.sources || []),
                        ...(record.sources || [])
                    ])
                ];

                existing.tags = [
                    ...new Set([
                        ...(existing.tags || []),
                        ...(record.tags || [])
                    ])
                ];
            } else {
                this.pending.set(key, record);
            }

            this.scheduleFlush();
        }

        scheduleFlush() {
            if (this.flushTimer || !this.pending.size) return;

            this.flushTimer = setTimeout(() => {
                this.flushTimer = null;

                this.flushPending().catch(error => {
                    console.error(
                        "[WebStructureInspector] Resource storage failed:",
                        error
                    );
                });
            }, 500);
        }

        async flushPending() {
            if (this.flushPromise) return this.flushPromise;
            if (!this.pending.size) return;

            this.flushPromise = (async () => {
                const items = [...this.pending.entries()];
                this.pending.clear();

                try {
                    const records = items.map(([, record]) => record);
                    const service = Framework.SiteIntelligence;

                    if (!service || typeof service.discoverMany !== "function") {
                        throw new Error("Central Site Intelligence service is unavailable.");
                    }

                    await service.discoverMany(
                        records.map(record => ({
                            url: record.url,
                            source: "WebStructureInspector:" + (record.sources || []).join(","),
                            tags: record.tags || [],
                            metadata: {
                                resourceType: record.type,
                                extension: record.extension || null
                            }
                        }))
                    );

                    const settled = await Promise.allSettled(
                        records.map(record =>
                            service.scan(record.url, {
                                source: "WebStructureInspector",
                                needContent: false
                            })
                        )
                    );

                    const validated = [];

                    for (let index = 0; index < settled.length; index++) {
                        const outcome = settled[index];

                        if (outcome.status !== "fulfilled") {
                            continue;
                        }

                        const result = outcome.value;
                        const central = result?.record;
                        const original = records[index];

                        if (
                            !central ||
                            central.status !== "accessible" ||
                            !(central.httpStatus >= 200 && central.httpStatus < 300)
                        ) {
                            continue;
                        }

                        validated.push({
                            ...original,
                            status: "verified",
                            httpStatus: central.httpStatus,
                            contentType: central.contentType || original.contentType || null,
                            tags: [...new Set([...(original.tags || []), ...(central.tags || [])])]
                        });
                    }

                    if (validated.length) {
                        await this.module.store.upsertMany(validated);
                    }

                    this.module.uiManager?.refresh();

                } catch (error) {
                    for (const [key, record] of items) {
                        const current = this.pending.get(key);

                        if (current) {
                            current.sources = [
                                ...new Set([
                                    ...(record.sources || []),
                                    ...(current.sources || [])
                                ])
                            ];

                            current.tags = [
                                ...new Set([
                                    ...(record.tags || []),
                                    ...(current.tags || [])
                                ])
                            ];
                        } else {
                            this.pending.set(key, record);
                        }
                    }

                    throw error;

                } finally {
                    this.flushPromise = null;
                }
            })();

            return this.flushPromise;
        }

        collectElement(element) {
            if (!element || element.nodeType !== 1) return;

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
                "form[action]",
                "input[src]",
                "track[src]"
            ];

            const collect = node => {
                const attributes = [
                    "href",
                    "src",
                    "data",
                    "action",
                    "poster"
                ];

                for (const attribute of attributes) {
                    const value = node.getAttribute(attribute);

                    if (value) {
                        this.add(value, "html-reference");
                    }
                }

                if (
                    (node.tagName === "IMG" || node.tagName === "SOURCE") &&
                    node.currentSrc
                ) {
                    this.add(node.currentSrc, "browser-resource");
                }
            };

            collect(element);

            for (const node of element.querySelectorAll(
                selectors.join(",")
            )) {
                collect(node);
            }
        }

        collectDocument() {
            this.add(location.href, "current-page");

            this.collectElement(document.documentElement);

            for (const entry of performance.getEntriesByType("resource")) {
                this.add(entry.name, "browser-network", {
                    size: entry.transferSize || null
                });
            }
        }

        async collectCurrentPage() {
            this.collectDocument();

            if (this.flushTimer) {
                clearTimeout(this.flushTimer);
                this.flushTimer = null;
            }

            await this.flushPending();
        }

        handleMutations(mutations) {
            for (const mutation of mutations) {
                if (mutation.type === "attributes") {
                    this.collectElement(mutation.target);
                    continue;
                }

                for (const node of mutation.addedNodes) {
                    if (node.nodeType === 1) {
                        this.collectElement(node);
                    }
                }
            }
        }

        start() {
            if (this.started) return;

            this.started = true;

            this.observer = new MutationObserver(mutations => {
                this.handleMutations(mutations);
            });

            this.observer.observe(document.documentElement, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: [
                    "href", "src", "action", "data", "poster"
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
            if (this.observer) {
                this.observer.disconnect();
                this.observer = null;
            }

            if (this.performanceObserver) {
                this.performanceObserver.disconnect();
                this.performanceObserver = null;
            }

            window.removeEventListener("popstate", this.onNavigation);
            window.removeEventListener("hashchange", this.onNavigation);

            if (this.flushTimer) {
                clearTimeout(this.flushTimer);
                this.flushTimer = null;
            }

            this.started = false;

            return this.flushPending();
        }
    }

    ns.Collector = Collector;

})(globalThis);