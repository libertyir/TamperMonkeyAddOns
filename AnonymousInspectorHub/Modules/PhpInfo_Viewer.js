(function (Framework) {
    "use strict";

    class PhpInfoViewer extends Framework.BaseModule {

        static id = "PhpInfo_Viewer";
        static title = "PHP Info Viewer";
        static description = "Inspect exposed PHP configuration";
        static icon = "🐘";

        constructor() {
            super();

            this.content = null;
            this.fileUrl = null;
            this.links = [];
            this.scannedAt = null;
        }

        getMetadata() {
            return {
                id: PhpInfoViewer.id,
                title: PhpInfoViewer.title,
                description: PhpInfoViewer.description,
                icon: PhpInfoViewer.icon
            };
        }

        async init() {
            this.available = false;
            this.scannedAt = new Date().toISOString();

            this.fileUrl = new URL(
                "phpinfo.php",
                Framework.getCurrentDirectory()
            ).href;

            try {
                const response = await fetch(this.fileUrl, {
                    method: "GET",
                    credentials: "same-origin",
                    redirect: "follow",
                    cache: "no-store"
                });

                if (!response.ok) {
                    return;
                }

                const html = await response.text();

                if (!html || html.length > 10 * 1024 * 1024) {
                    return;
                }

                const doc = new DOMParser().parseFromString(
                    html,
                    "text/html"
                );

                if (!this.isPhpInfo(doc)) {
                    return;
                }

                this.content = doc;
                this.fileUrl = response.url || this.fileUrl;
                this.available = true;

            } catch (error) {
                this.error = error;
                console.warn("[PHP Info Viewer]", error);
            }
        }

        getResult() {
            if (!this.available || !this.content) {
                return null;
            }

            return {
                page: window.location.href,
                fileUrl: this.fileUrl,
                fileName: "phpinfo.php",
                scannedAt: this.scannedAt,
                contentLength: (
                    this.content.body.innerText ||
                    this.content.body.textContent ||
                    ""
                ).length,
                content: (
                    this.content.body.innerText ||
                    this.content.body.textContent ||
                    ""
                ),
                links: [...new Set(this.links)]
            };
        }

        isPhpInfo(doc) {
            const body = doc.body;

            if (!body) {
                return false;
            }

            const text = body.innerText || body.textContent || "";

            const hasPhpInfoTitle =
                /phpinfo\(\)/i.test(doc.title) ||
                /phpinfo\(\)/i.test(text);

            const hasPhpVersion =
                /php version\s+\d+\.\d+/i.test(text);

            const hasConfiguration =
                /configuration file|php extension|loaded configuration file/i.test(text);

            const hasPhpInfoTable =
                !!doc.querySelector(
                    "table.phpinfo, table.center, .center table"
                );

            return hasPhpInfoTitle &&
                hasPhpVersion &&
                (hasConfiguration || hasPhpInfoTable);
        }

        createSafeElement(sourceNode) {
            if (sourceNode.nodeType === Node.TEXT_NODE) {
                return document.createTextNode(sourceNode.nodeValue);
            }

            if (sourceNode.nodeType !== Node.ELEMENT_NODE) {
                return document.createDocumentFragment();
            }

            const allowedTags = new Set([
                "H1", "H2", "H3", "H4",
                "P", "DIV", "SPAN",
                "TABLE", "THEAD", "TBODY", "TFOOT",
                "TR", "TH", "TD",
                "PRE", "CODE",
                "UL", "OL", "LI",
                "B", "STRONG", "I", "EM",
                "BR", "HR",
                "A"
            ]);

            if (!allowedTags.has(sourceNode.tagName)) {
                const fragment = document.createDocumentFragment();

                for (const child of sourceNode.childNodes) {
                    fragment.appendChild(
                        this.createSafeElement(child)
                    );
                }

                return fragment;
            }

            const element = document.createElement(
                sourceNode.tagName.toLowerCase()
            );

            if (sourceNode.tagName === "A") {
                const rawHref = sourceNode.getAttribute("href");

                if (rawHref) {
                    try {
                        const url = new URL(rawHref, this.fileUrl);

                        if (
                            url.protocol === "http:" ||
                            url.protocol === "https:"
                        ) {
                            element.href = url.href;
                            element.target = "_blank";
                            element.rel = "noopener noreferrer";

                            this.links.push(url.href);
                        }
                    } catch (_) {
                        // Ignore invalid URLs.
                    }
                }
            }

            if (
                sourceNode.tagName === "TH" ||
                sourceNode.tagName === "TD"
            ) {
                for (const attribute of ["colspan", "rowspan"]) {
                    const value = sourceNode.getAttribute(attribute);

                    if (value && /^\d+$/.test(value)) {
                        element.setAttribute(attribute, value);
                    }
                }
            }

            for (const child of sourceNode.childNodes) {
                element.appendChild(
                    this.createSafeElement(child)
                );
            }

            return element;
        }

        createButton(label, callback) {
            const button = Framework.createElement("button", {
                type: "button",
                textContent: label,
                style: [
                    "padding:7px 11px",
                    "margin:4px",
                    "border:1px solid #555",
                    "border-radius:4px",
                    "background:#292929",
                    "color:#fff",
                    "cursor:pointer"
                ].join(";")
            });

            button.addEventListener("click", callback);

            return button;
        }

        addLinkCopyButtons(container) {
            const anchors = container.querySelectorAll("a");

            for (const anchor of anchors) {
                if (!anchor.href) {
                    continue;
                }

                const copyButton = this.createButton(
                    "Copy",
                    () => {
                        Framework.copy(anchor.href);
                        copyButton.textContent = "Copied";
                    }
                );

                copyButton.style.fontSize = "10px";
                copyButton.style.padding = "3px 6px";

                anchor.insertAdjacentElement(
                    "afterend",
                    copyButton
                );
            }
        }

        render() {
            const container = Framework.createElement("div");

            const heading = Framework.createElement("h2", {
                textContent: "PHP Information"
            });

            const description = Framework.createElement("p", {
                textContent:
                    "Exposed PHP configuration and environment information."
            });

            const sourceLink = Framework.createElement("a", {
                href: this.fileUrl,
                target: "_blank",
                rel: "noopener noreferrer",
                textContent: "Open original phpinfo.php"
            });

            const toolbar = Framework.createElement("div", {
                style: "margin:12px 0;"
            });

            const copyReportButton = this.createButton(
                "Copy Report",
                () => {
                    Framework.copy(
                        this.content.body.innerText ||
                        this.content.body.textContent ||
                        ""
                    );

                    copyReportButton.textContent = "Copied";
                }
            );

            const copyLinksButton = this.createButton(
                "Copy All Links",
                () => {
                    Framework.copy(
                        [...new Set(this.links)].join("\n")
                    );

                    copyLinksButton.textContent = "Copied";
                }
            );

            toolbar.append(
                copyReportButton,
                copyLinksButton
            );

            const report = Framework.createElement("div", {
                style: [
                    "padding:15px",
                    "margin-top:12px",
                    "background:#101010",
                    "border:1px solid #444",
                    "border-radius:5px",
                    "overflow:auto",
                    "color:#ddd",
                    "font-size:13px"
                ].join(";")
            });

            for (const child of this.content.body.childNodes) {
                report.appendChild(
                    this.createSafeElement(child)
                );
            }

            this.addLinkCopyButtons(report);

            container.append(
                heading,
                description,
                sourceLink,
                toolbar,
                report
            );

            return container;
        }

        destroy() {
            this.content = null;
            this.links = [];
        }
    }

    Framework.register(
        PhpInfoViewer.id,
        PhpInfoViewer
    );

})(Framework);