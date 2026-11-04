(function (Framework) {
    "use strict";

    class ScalarViewer extends Framework.BaseModule {
        static id = "Scalar_Viewer";
        static title = "Scalar Viewer";
        static description = "Discover Scalar API documentation interfaces";
        static icon = "◈";
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
                id: ScalarViewer.id,
                title: ScalarViewer.title,
                description: ScalarViewer.description,
                icon: ScalarViewer.icon
            };
        }

        async init() {
            this.available = false;
            this.foundPages = [];
            this.scannedAt = new Date().toISOString();

            const paths = [
                "scalar",
                "scalar/",
                "scalar.html",
                "scalar/index.html",
                "api/scalar",
                "api/scalar/",
                "api/reference",
                "api/reference/",
                "reference",
                "reference/",
                "api-docs",
                "api-docs/",
                "docs",
                "docs/",
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

                const response = await Framework.SiteIntelligence.fetch(url.href, {
                    method: "GET",
                    credentials: "same-origin",
                    cache: "no-store",
                    redirect: "follow"
                });

                if (response.status >= 500) {
                    throw new Error(
                        `Scalar scan failed with HTTP ${response.status}: ${url.href}`
                    );
                }

                if (!response.ok) continue;

                const finalUrl = new URL(response.url);

                if (finalUrl.origin !== location.origin) continue;

                const contentType =
                    response.headers.get("content-type") || "";

                if (!contentType.includes("text/html")) continue;

                const html = await response.text();

                if (!this.isScalarPage(html)) continue;

                if (this.foundPages.some(
                    item => item.url === finalUrl.href
                )) {
                    continue;
                }

                this.foundPages.push({
                    url: finalUrl.href,
                    path,
                    title: this.extractTitle(html),
                    indicators: this.getIndicators(html)
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
                    ...page,
                    indicators: [...page.indicators]
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
                        !Array.isArray(page.indicators) ||
                        !page.indicators.every(
                            item => typeof item === "string"
                        )
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
                        indicators: [...page.indicators]
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

        isScalarPage(html) {
            if (!html || html.length > 5 * 1024 * 1024) {
                return false;
            }

            const indicators = this.getIndicators(html);

            return indicators.length >= 2;
        }

        getIndicators(html) {
            const indicators = [];

            const patterns = [
                {
                    name: "Scalar Custom Element",
                    pattern: /<api-reference(?:\s|>)/i
                },
                {
                    name: "Scalar Web Component",
                    pattern: /<scalar-api-reference(?:\s|>)/i
                },
                {
                    name: "Scalar JavaScript Package",
                    pattern: /@scalar\/api-reference|@scalar\/api-client/i
                },
                {
                    name: "Scalar CDN",
                    pattern: /cdn\.scalar\.com/i
                },
                {
                    name: "Scalar Initialization",
                    pattern: /ScalarApiReference\s*\(/i
                },
                {
                    name: "Scalar Configuration",
                    pattern: /scalar\/api-reference/i
                }
            ];

            for (const item of patterns) {
                if (item.pattern.test(html)) {
                    indicators.push(item.name);
                }
            }

            return indicators;
        }

        extractTitle(html) {
            const match = html.match(
                /<title[^>]*>([\s\S]*?)<\/title>/i
            );

            if (!match) return "Scalar API Documentation";

            return match[1]
                .replace(/<[^>]+>/g, "")
                .replace(/&amp;/g, "&")
                .replace(/&lt;/g, "<")
                .replace(/&gt;/g, ">")
                .replace(/&quot;/g, '"')
                .trim() || "Scalar API Documentation";
        }

        render() {
            const root = Framework.createElement("div", {
                className: "scalar-viewer",
                style: "padding:12px;overflow:auto;max-height:75vh;"
            });

            root.appendChild(
                Framework.createElement("h2", {
                    textContent: "Scalar API Documentation"
                })
            );

            root.appendChild(
                Framework.createElement("p", {
                    textContent:
                        `${this.foundPages.length} Scalar documentation page(s) found.`
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
                        textContent: "Detection indicators:"
                    })
                );

                const list = Framework.createElement("ul", {});

                for (const indicator of page.indicators) {
                    list.appendChild(
                        Framework.createElement("li", {
                            textContent: indicator
                        })
                    );
                }

                card.appendChild(list);

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

    Framework.register(ScalarViewer.id, ScalarViewer);

})(Framework);