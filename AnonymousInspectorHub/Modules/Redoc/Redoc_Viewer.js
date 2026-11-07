(function(Framework){"use strict";class RedocViewer extends Framework.BaseModule{
        static id = "Redoc_Viewer";
        static title = "ReDoc Viewer";
        static description = "Discover ReDoc API documentation interfaces";
        static icon = "📖";
        static scanPolicy = {
            scope: "origin-root",
            defaultTTL: "7d"
        };


static providerId="Redoc_Provider";async init(context={}){const result=context&&context.result;this.available=Boolean(result&&this.restoreResult(result,context));}
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

        getMetadata() {
            return {
                id: RedocViewer.id,
                title: RedocViewer.title,
                description: RedocViewer.description,
                icon: RedocViewer.icon
            };
        }

        constructor() {
            super();
            this.available = false;
            this.foundPages = [];
            this.scannedAt = null;
        }
}Framework.register(RedocViewer.id,RedocViewer);})(Framework);