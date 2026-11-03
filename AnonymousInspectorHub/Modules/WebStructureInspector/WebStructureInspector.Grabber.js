(function (root) {
    "use strict";

    const ns = root.AnonymousInspectorWebStructure =
        root.AnonymousInspectorWebStructure || {};

    class Grabber {
        constructor(module) {
            this.module = module;
            this.maxPages = 30;
            this.maxDepth = 2;
            this.maxPageSize = 256 * 1024;
            this.timeout = 7000;
        }

        isAllowed(url) {
            if (!["http:", "https:"].includes(url.protocol)) {
                return false;
            }

            if (url.username || url.password) return false;

            if (url.origin === location.origin) return true;

            if (this.module.settings.grabberScope !== "subdomain") {
                return false;
            }

            const base = location.hostname.toLowerCase();
            const host = url.hostname.toLowerCase();

            return host.endsWith("." + base);
        }

        isPageUrl(url) {
            const last = url.pathname.split("/").pop() || "";

            return !/\.[a-z0-9]{1,12}$/i.test(last);
        }

        async readLimited(response) {
            if (!response.body) return "";

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            let output = "";
            let total = 0;
            let truncated = false;

            try {
                while (total < this.maxPageSize) {
                    const { done, value } = await reader.read();

                    if (done) break;
                    if (!value) continue;

                    const remaining = this.maxPageSize - total;
                    const chunk = value.subarray(0, remaining);

                    output += decoder.decode(chunk, { stream: true });
                    total += chunk.length;

                    if (chunk.length < value.length) {
                        truncated = true;
                        break;
                    }
                }

                if (!truncated && total >= this.maxPageSize) {
                    truncated = true;
                }

                output += decoder.decode();

                if (truncated) {
                    throw new Error("Page response exceeds the maximum allowed size.");
                }
            } finally {
                reader.cancel().catch(() => {});
            }

            return output;
        }

        extractLinks(doc, baseUrl) {
            const links = new Set();

            for (const anchor of doc.querySelectorAll("a[href]")) {
                try {
                    const url = new URL(
                        anchor.getAttribute("href"),
                        baseUrl
                    );

                    url.hash = "";

                    if (!this.isAllowed(url)) continue;
                    if (!this.isPageUrl(url)) continue;

                    links.add(url.href);
                } catch {
                }
            }

            return [...links];
        }

        extractResources(doc, baseUrl) {
            const resources = [];
            const seen = new Set();

            const selectors = [
                "script[src]",
                "link[href]",
                "img[src]",
                "source[src]",
                "iframe[src]",
                "video[src]",
                "audio[src]",
                "track[src]",
                "object[data]",
                "embed[src]"
            ];

            for (const element of doc.querySelectorAll(
                selectors.join(",")
            )) {
                const raw =
                    element.getAttribute("src") ||
                    element.getAttribute("href") ||
                    element.getAttribute("data");

                if (!raw) continue;

                try {
                    const url = new URL(raw, baseUrl);

                    if (!this.isAllowed(url)) continue;
                    if (seen.has(url.href)) continue;

                    seen.add(url.href);

                    const record = this.module.analyzer.analyze(
                        url.href,
                        "grabber-resource"
                    );

                    if (!record) continue;

                    record.status = "observed";
                    resources.push(record);
                } catch {
                }
            }

            return resources;
        }

        async fetchPage(rawUrl) {
            const url = new URL(rawUrl);

            if (!this.isAllowed(url)) return null;

            const controller = new AbortController();
            const timeoutId = setTimeout(
                () => controller.abort(),
                this.timeout
            );

            try {
                const response = await fetch(url.href, {
                    method: "GET",
                    credentials:
                        url.origin === location.origin
                            ? "same-origin"
                            : "omit",
                    redirect: "manual",
                    cache: "no-store",
                    signal: controller.signal,
                    headers: {
                        "Accept": "text/html"
                    }
                });

                if (
                    response.type === "opaqueredirect" ||
                    !response.ok
                ) {
                    return null;
                }

                const finalUrl = new URL(response.url || url.href);

                if (!this.isAllowed(finalUrl)) return null;

                const contentType =
                    response.headers.get("content-type") || "";

                if (!/text\/html/i.test(contentType)) return null;

                const html = await this.readLimited(response);
                if (!html) return null;

                const doc = new DOMParser().parseFromString(
                    html,
                    "text/html"
                );

                return {
                    url: finalUrl.href,
                    links: this.extractLinks(doc, finalUrl.href),
                    resources: this.extractResources(doc, finalUrl.href)
                };
            } finally {
                clearTimeout(timeoutId);
            }
        }

        async run(startUrl = location.href) {
            const start = new URL(startUrl);

            if (!this.isAllowed(start)) {
                throw new Error("Grabber start URL is outside the configured scope.");
            }

            start.hash = "";

            const queue = [{ url: start.href, depth: 0 }];
            const visited = new Set();
            const collected = [];
            const collectedResources = new Set();
            let pagesVisited = 0;

            while (
                queue.length &&
                visited.size < this.maxPages
            ) {
                const item = queue.shift();

                if (visited.has(item.url)) continue;
                visited.add(item.url);

                let page;

                try {
                    page = await this.fetchPage(item.url);
                } catch {
                    continue;
                }

                if (!page) continue;

                visited.add(page.url);
                pagesVisited++;

                const pageRecord = this.module.analyzer.analyze(
                    page.url,
                    "grabber-page"
                );

                if (pageRecord) {
                    pageRecord.status = "confirmed";
                    collected.push(pageRecord);
                }

                for (const resource of page.resources) {
                    if (collectedResources.has(resource.path)) continue;

                    collectedResources.add(resource.path);
                    collected.push(resource);
                }

                if (item.depth >= this.maxDepth) continue;

                for (const link of page.links) {
                    if (!visited.has(link)) {
                        queue.push({
                            url: link,
                            depth: item.depth + 1
                        });
                    }
                }
            }

            await this.module.store.upsertMany(collected);

            return {
                pagesVisited,
                resourcesFound: collectedResources.size,
                completedAt: new Date().toISOString()
            };
        }
    }

    ns.Grabber = Grabber;

})(globalThis);