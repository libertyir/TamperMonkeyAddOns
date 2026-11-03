(function (Framework) {
    "use strict";

    class RedocViewer extends Framework.BaseModule {
        static id = "Redoc_Viewer";
        static title = "ReDoc Viewer";
        static description = "Discover ReDoc API documentation interfaces";
        static icon = "📖";
        static scanPolicy = {
            scope: "origin-root",
            defaultTTL: "7d"
        };

        constructor() {
            super();
            this.available = false;
            this.foundPages = [];
            this.scannedAt = null;
        }

        getMetadata() {
            return {
                id: RedocViewer.id,
                title: RedocViewer.title,
                description: RedocViewer.description,
                icon: RedocViewer.icon
            };
        }

        async init() {
            this.available = false;
            this.foundPages = [];
            this.scannedAt = new Date().toISOString();

            const paths = [
                "redoc",
                "redoc/",
                "redoc.html",
                "redoc/index.html",
                "api/redoc",
                "api/redoc/",
                "api/redoc.html",
                "docs",
                "docs/",
                "api/docs",
                "api/docs/",
                "api-reference",
                "api-reference/",
                "reference",
                "reference/",
                "documentation",
                "documentation/"
            ];

            const base = new URL("/", location.origin);
            const checked = new Set();

            for (const path of paths) {
                const url = new URL(path, base);

                if (url.origin !== location.origin) continue;
                if (checked.has(url.href)) continue;

                checked.add(url.href);

                const response = await fetch(url.href, {
                    method: "GET",
                    credentials: "same-origin",
                    cache: "no-store",
                    redirect: "follow"
                });

                if (response.status >= 500) {
                    throw new Error(
                        `ReDoc scan failed with HTTP ${response.status}: ${url.href}`
                    );
                }

                if (!response.ok) continue;

                const finalUrl = new URL(response.url);

                if (finalUrl.origin !== location.origin) continue;

                const contentType =
                    response.headers.get("content-type") || "";

                if (!contentType.includes("text/html")) continue;

                const html = await response.text();

                if (!this.isRedocPage(html)) continue;

                if (
                    this.foundPages.some(
                        item => item.url === finalUrl.href
                    )
                ) {
                    continue;
                }

                this.foundPages.push({
                    url: finalUrl.href,
                    path,
                    title: this.extractTitle(html),
                    embedded: this.hasRedocElement(html)
                });

                this.available = true;
            }
        }

        getResult() {
            if (!this.available || !this.foundPages.length) {
                return null;
            }

            return {
                page: window.location.href,
                scannedAt: this.scannedAt,
                totalFound: this.foundPages.length,
                foundPages: this.foundPages.map(page => ({
                    ...page
                }))
            };
        }

        restoreResult(data) {
            if (
                !data ||
                !Array.isArray(data.foundPages) ||
                data.foundPages.length === 0
            ) {
                return false;
            }

            try {
                const restored = [];

                for (const page of data.foundPages) {
                    if (
                        !page ||
                        typeof page.url !== "string" ||
                        typeof page.path !== "string" ||
                        typeof page.title !== "string" ||
                        typeof page.embedded !== "boolean"
                    ) {
                        return false;
                    }

                    const url = new URL(page.url);

                    if (url.origin !== location.origin) {
                        return false;
                    }

                    restored.push({
                        url: url.href,
                        path: page.path,
                        title: page.title,
                        embedded: page.embedded
                    });
                }

                this.foundPages = restored;
                this.scannedAt = data.scannedAt || null;
                this.available = true;

                return true;

            } catch (error) {
                return false;
            }
        }

        isRedocPage(html) {
            if (!html || html.length > 5 * 1024 * 1024) {
                return false;
            }

            const hasRedocElement = this.hasRedocElement(html);

            const hasRedocScript =
                /redoc(?:\.standalone)?(?:\.min)?\.js/i.test(html) ||
                /cdn\.redoc\.ly/i.test(html);

            const hasRedocInitialization =
                /Redoc\.init\s*\(/i.test(html) ||
                /<redoc\b/i.test(html);

            return hasRedocElement ||
                (hasRedocScript && hasRedocInitialization);
        }

        hasRedocElement(html) {
            return /<redoc(?:\s|>)/i.test(html);
        }

        extractTitle(html) {
            const match = html.match(
                /<title[^>]*>([\s\S]*?)<\/title>/i
            );

            if (!match) return "ReDoc Documentation";

            return match[1]
                .replace(/<[^>]+>/g, "")
                .replace(/&amp;/g, "&")
                .replace(/&lt;/g, "<")
                .replace(/&gt;/g, ">")
                .replace(/&quot;/g, '"')
                .trim() || "ReDoc Documentation";
        }

        render() {
            const root = Framework.createElement("div", {
                className: "redoc-viewer",
                style: "padding:12px;overflow:auto;max-height:75vh;"
            });

            root.appendChild(
                Framework.createElement("h2", {
                    textContent: "ReDoc Documentation"
                })
            );

            root.appendChild(
                Framework.createElement("p", {
                    textContent: `${this.foundPages.length} ReDoc documentation page(s) found.`
                })
            );

            for (const page of this.foundPages) {
                const card = Framework.createElement("div", {
                    style: "margin:12px 0;padding:12px;border:1px solid #888;border-radius:6px;"
                });

                card.appendChild(
                    Framework.createElement("strong", {
                        textContent: page.title
                    })
                );

                card.appendChild(
                    Framework.createElement("p", {
                        textContent: page.url
                    })
                );

                card.appendChild(
                    Framework.createElement("p", {
                        textContent: page.embedded
                            ? "ReDoc custom element detected."
                            : "ReDoc initialization detected."
                    })
                );

                const openButton = Framework.createElement("button", {
                    textContent: "Open Documentation",
                    style: "margin:4px;padding:6px 10px;cursor:pointer;"
                });

                openButton.addEventListener("click", () => {
                    Framework.open(page.url);
                });

                card.appendChild(openButton);

                const copyButton = Framework.createElement("button", {
                    textContent: "Copy URL",
                    style: "margin:4px;padding:6px 10px;cursor:pointer;"
                });

                copyButton.addEventListener("click", () => {
                    Framework.copy(page.url);
                });

                card.appendChild(copyButton);

                root.appendChild(card);
            }

            return root;
        }
    }

    Framework.register(RedocViewer.id, RedocViewer);

})(Framework);