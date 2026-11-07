(function(Framework){"use strict";class ApacheServerStatusViewer extends Framework.BaseModule{

        static id = "ApachiServerStatus_Viewer";
        static title = "Apache Server Status";
        static description = "Inspect exposed Apache server status";
        static icon = "🖥️";

        static scanPolicy = {
            scope: "origin-root",
            defaultTTL: "7d"
        };


static providerId="ApachiServerStatus_Provider";async init(context={}){const result=context&&context.result;this.available=Boolean(result&&this.restoreResult(result,context));}
        destroy() {
            this.content = null;
            this.links = [];
        }

        render() {
            const container = Framework.createElement("div");

            const heading = Framework.createElement("h2", {
                textContent: "Apache Server Status"
            });

            const description = Framework.createElement("p", {
                textContent:
                    "Live server statistics and request information."
            });

            const sourceLink = Framework.createElement("a", {
                href: this.statusUrl,
                target: "_blank",
                rel: "noopener noreferrer",
                textContent: "Open original server-status page"
            });

            const toolbar = Framework.createElement("div", {
                style: "margin:12px 0;"
            });

            const copyTextButton = this.createButton(
                "Copy Report",
                () => {
                    Framework.copy(
                        this.content.body.innerText || ""
                    );

                    copyTextButton.textContent = "Copied";
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
                copyTextButton,
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

            const body = this.content.body;

            for (const child of body.childNodes) {
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

        createSafeElement(sourceNode) {
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

            if (sourceNode.nodeType === Node.TEXT_NODE) {
                return document.createTextNode(sourceNode.nodeValue);
            }

            if (sourceNode.nodeType !== Node.ELEMENT_NODE) {
                return document.createDocumentFragment();
            }

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
                        const url = new URL(
                            rawHref,
                            this.statusUrl
                        );

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
                const colspan = sourceNode.getAttribute("colspan");
                const rowspan = sourceNode.getAttribute("rowspan");

                if (colspan && /^\d+$/.test(colspan)) {
                    element.colSpan = Number(colspan);
                }

                if (rowspan && /^\d+$/.test(rowspan)) {
                    element.rowSpan = Number(rowspan);
                }
            }

            for (const child of sourceNode.childNodes) {
                element.appendChild(
                    this.createSafeElement(child)
                );
            }

            return element;
        }

        restoreResult(data) {
            if (
                !data ||
                typeof data.statusUrl !== "string" ||
                typeof data.reportHtml !== "string" ||
                typeof data.reportText !== "string" ||
                !Array.isArray(data.links)
            ) {
                return false;
            }

            let statusUrl;

            try {
                statusUrl = new URL(data.statusUrl);

                if (
                    statusUrl.protocol !== "http:" &&
                    statusUrl.protocol !== "https:"
                ) {
                    return false;
                }
            } catch (_) {
                return false;
            }

            if (
                data.links.some(link => {
                    if (typeof link !== "string") {
                        return true;
                    }

                    try {
                        const url = new URL(link);

                        return (
                            url.protocol !== "http:" &&
                            url.protocol !== "https:"
                        );
                    } catch (_) {
                        return true;
                    }
                })
            ) {
                return false;
            }

            const parsed = new DOMParser().parseFromString(
                "<!DOCTYPE html><html><body>" +
                data.reportHtml +
                "</body></html>",
                "text/html"
            );

            if (!this.isApacheStatus(parsed)) {
                return false;
            }

            this.content = parsed;
            this.statusUrl = statusUrl.href;
            this.scannedAt =
                typeof data.scannedAt === "string"
                    ? data.scannedAt
                    : null;
            this.links = [...new Set(data.links)];
            this.available = true;

            return true;
        }

        isApacheStatus(doc) {
            const title = doc.title || "";

            const bodyText = (
                doc.body ? doc.body.textContent : ""
            ) || "";

            const normalizedTitle = title.toLowerCase();

            const titleMatch =
                normalizedTitle.includes("apache server status");

            const contentPatterns = [
                /server uptime\s*:/i,
                /total accesses\s*:/i,
                /total traffic\s*:/i,
                /requests currently being processed/i,
                /scoreboard/i,
                /apache server status/i
            ];

            return titleMatch ||
                contentPatterns.some(pattern =>
                    pattern.test(bodyText)
                );
        }

        getMetadata() {
            return {
                id: ApacheServerStatusViewer.id,
                title: ApacheServerStatusViewer.title,
                description: ApacheServerStatusViewer.description,
                icon: ApacheServerStatusViewer.icon
            };
        }

        constructor() {
            super();

            this.content = null;
            this.statusUrl = null;
            this.links = [];
            this.scannedAt = null;
        }
}Framework.register(ApacheServerStatusViewer.id,ApacheServerStatusViewer);})(Framework);