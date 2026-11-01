
(function (Framework) {
    "use strict";

    class RedocViewer extends Framework.BaseModule {
        static id = "Redoc_Viewer";
        static title = "ReDoc Viewer";
        static description = "Discover ReDoc API documentation interfaces";
        static icon = "📖";

        constructor() {
            super();
            this.available = false;
            this.foundPages = [];
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

            const base = new URL(".", location.href);
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

                    const contentType = response.headers.get("content-type") || "";

                    if (!contentType.includes("text/html")) continue;

                    const html = await response.text();

                    if (!this.isRedocPage(html)) continue;

                    if (this.foundPages.some(item => item.url === finalUrl.href)) {
                        continue;
                    }

                    this.foundPages.push({
                        url: finalUrl.href,
                        path: path,
                        title: this.extractTitle(html),
                        embedded: this.hasRedocElement(html)
                    });

                    this.available = true;

                } catch (error) {
                    // Ignore inaccessible paths.
                }
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
            const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);

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
