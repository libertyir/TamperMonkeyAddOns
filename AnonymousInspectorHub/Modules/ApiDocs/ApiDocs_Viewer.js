(function(Framework){"use strict";class ApiDocsViewer extends Framework.BaseModule{
        static id = "ApiDocs_Viewer";
        static title = "API Docs Viewer";
        static description = "Discover API documentation platforms and interfaces";
        static icon = "📚";
        static scanPolicy = {
            scope: "origin-root",
            defaultTTL: "7d"
        };


static providerId="ApiDocs_Provider";async init(context={}){const result=context&&context.result;this.available=Boolean(result&&this.restoreResult(result,context));}
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

        getMetadata() {
            return {
                id: ApiDocsViewer.id,
                title: ApiDocsViewer.title,
                description: ApiDocsViewer.description,
                icon: ApiDocsViewer.icon
            };
        }

        constructor() {
            super();
            this.available = false;
            this.foundPages = [];
            this.scannedAt = null;
        }
}Framework.register(ApiDocsViewer.id,ApiDocsViewer);})(Framework);