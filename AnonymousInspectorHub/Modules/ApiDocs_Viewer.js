(function (Framework) {
    "use strict";

    class ApiDocsViewer extends Framework.BaseModule {
        static id = "ApiDocs_Viewer";
        static title = "API Docs Viewer";
        static description = "Discover API documentation platforms and interfaces";
        static icon = "📚";
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
                id: ApiDocsViewer.id,
                title: ApiDocsViewer.title,
                description: ApiDocsViewer.description,
                icon: ApiDocsViewer.icon
            };
        }

        async init() {
            this.available = false;
            this.foundPages = [];
            this.scannedAt = new Date().toISOString();

            const paths = [
                "api-docs",
                "api-docs/",
                "api/documentation",
                "api/documentation/",
                "api-reference",
                "api-reference/",
                "api/reference",
                "api/reference/",
                "developer",
                "developer/",
                "developers",
                "developers/",
                "api",
                "api/",
                "apidocs",
                "apidocs/",
                "reference",
                "reference/",
                "documentation",
                "documentation/",
                "docs/api",
                "docs/api/",
                "docs/reference",
                "docs/reference/",
                "developers/api",
                "developers/api/",
                "docs"
            ];

            const base = new URL("/", location.origin);
            const checked = new Set();

            for (const path of paths) {
                const url = new URL(path, base);

                if (url.origin !== location.origin) continue;
                if (checked.has(url.href)) continue;

                checked.add(url.href);

                try {
                    const response = await fetch(url.href, {
                        method: "GET",
                        credentials: "same-origin",
                        cache: "no-store",
                        redirect: "follow"
                    });

                    if (!response.ok) continue;

                    const finalUrl = new URL(response.url);

                    if (finalUrl.origin !== location.origin) continue;

                    const contentType =
                        response.headers.get("content-type") || "";

                    if (!contentType.includes("text/html")) continue;

                    const html = await response.text();

                    if (!html || html.length > 5 * 1024 * 1024) {
                        continue;
                    }

                    const detection = this.detectPlatform(html);

                    if (!detection) continue;

                    if (this.foundPages.some(
                        item => item.url === finalUrl.href
                    )) {
                        continue;
                    }

                    this.foundPages.push({
                        url: finalUrl.href,
                        path,
                        title: this.extractTitle(html),
                        platform: detection.platform,
                        indicators: detection.indicators
                    });

                    this.available = true;

                } catch (error) {
                    // Ignore inaccessible paths.
                }
            }
        }

        getResult() {
            return {
                page: location.href,
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
                !data.foundPages.every(page =>
                    page &&
                    typeof page.url === "string" &&
                    typeof page.title === "string" &&
                    typeof page.platform === "string" &&
                    Array.isArray(page.indicators)
                )
            ) {
                return false;
            }

            this.foundPages = data.foundPages.map(page => ({
                url: page.url,
                path: page.path || "",
                title: page.title,
                platform: page.platform,
                indicators: [...page.indicators]
            }));

            this.scannedAt = data.scannedAt || null;
            this.available = true;

            return true;
        }

        detectPlatform(html) {
            const platforms = [
                {
                    name: "Stoplight Elements",
                    patterns: [
                        /elements-api(?:\.min)?\.js/i,
                        /@stoplight\/elements/i,
                        /<elements-api(?:\s|>)/i,
                        /stoplight\.io\/elements/i
                    ]
                },
                {
                    name: "RapiDoc",
                    patterns: [
                        /<rapi-doc(?:\s|>)/i,
                        /rapidoc-min\.js/i,
                        /@rapidoc\/rapidoc/i
                    ]
                },
                {
                    name: "ReadMe",
                    patterns: [
                        /readme\.com/i,
                        /readme-api/i,
                        /readme-io/i,
                        /rdme/i
                    ]
                },
                {
                    name: "Slate",
                    patterns: [
                        /slate-api/i,
                        /slate\.css/i,
                        /slate-logo/i,
                        /slate documentation/i
                    ]
                },
                {
                    name: "Apiary",
                    patterns: [
                        /apiary\.io/i,
                        /apiary\.js/i,
                        /apiary-documentation/i
                    ]
                },
                {
                    name: "Fern",
                    patterns: [
                        /buildwithfern\.com/i,
                        /fern-api/i,
                        /fern-docs/i
                    ]
                },
                {
                    name: "Mintlify",
                    patterns: [
                        /mintlify/i,
                        /mintlify\.com/i,
                        /mintlify\/components/i
                    ]
                }
            ];

            for (const platform of platforms) {
                const matched = platform.patterns.filter(
                    pattern => pattern.test(html)
                );

                if (matched.length > 0) {
                    return {
                        platform: platform.name,
                        indicators: matched.map(
                            pattern => pattern.toString()
                        )
                    };
                }
            }

            return null;
        }

        extractTitle(html) {
            const match = html.match(
                /<title[^>]*>([\s\S]*?)<\/title>/i
            );

            if (!match) return "API Documentation";

            return match[1]
                .replace(/<[^>]+>/g, "")
                .replace(/&amp;/g, "&")
                .replace(/&lt;/g, "<")
                .replace(/&gt;/g, ">")
                .replace(/&quot;/g, '"')
                .trim() || "API Documentation";
        }

        render() {
            const root = Framework.createElement("div", {
                className: "api-docs-viewer",
                style: "padding:12px;overflow:auto;max-height:75vh;"
            });

            root.appendChild(
                Framework.createElement("h2", {
                    textContent: "API Documentation Discovery"
                })
            );

            root.appendChild(
                Framework.createElement("p", {
                    textContent:
                        `${this.foundPages.length} API documentation page(s) found.`
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
                        textContent: `Platform: ${page.platform}`
                    })
                );

                card.appendChild(
                    Framework.createElement("p", {
                        textContent: page.url
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

    Framework.register(ApiDocsViewer.id, ApiDocsViewer);

})(Framework);