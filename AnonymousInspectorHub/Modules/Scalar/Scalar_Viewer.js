(function(Framework){"use strict";class ScalarViewer extends Framework.BaseModule{
        static id = "Scalar_Viewer";
        static title = "Scalar Viewer";
        static description = "Discover Scalar API documentation interfaces";
        static icon = "◈";
        static scanPolicy = {
            scope: "origin-root",
            defaultTTL: "7d"
        };


static providerId="Scalar_Provider";async init(context={}){const result=context&&context.result;this.available=Boolean(result&&this.restoreResult(result,context));}
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

        getMetadata() {
            return {
                id: ScalarViewer.id,
                title: ScalarViewer.title,
                description: ScalarViewer.description,
                icon: ScalarViewer.icon
            };
        }

        constructor() {
            super();
            this.available = false;
            this.foundPages = [];
            this.scannedAt = null;
        }
}Framework.register(ScalarViewer.id,ScalarViewer);})(Framework);