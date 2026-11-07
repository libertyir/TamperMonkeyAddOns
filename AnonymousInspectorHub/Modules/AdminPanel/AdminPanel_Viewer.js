(function(Framework){"use strict";class AdminPanelViewer extends Framework.BaseModule{
        static id = "AdminPanel_Viewer";
        static title = "Admin Panel Viewer";
        static description = "Discover administrative interfaces on the current domain";
        static icon = "🔐";

        static scanPolicy = {
            scope: "origin-root",
            defaultTTL: "7d"
        };


static providerId="AdminPanel_Provider";async init(context={}){const result=context&&context.result;this.available=Boolean(result&&this.restoreResult(result,context));}
        render() {
            const root = this.createElement(
                "div",
                "aih-admin-viewer"
            );

            const style = this.createElement("style");

            style.textContent = `
                .aih-admin-viewer {
                    color: inherit;
                    font-size: 13px;
                }

                .aih-admin-summary {
                    display: flex;
                    gap: 10px;
                    flex-wrap: wrap;
                    margin-bottom: 14px;
                }

                .aih-admin-stat {
                    padding: 10px 14px;
                    border: 1px solid rgba(128,128,128,.3);
                    border-radius: 6px;
                }

                .aih-admin-stat strong {
                    display: block;
                    font-size: 19px;
                }

                .aih-admin-card {
                    border: 1px solid rgba(128,128,128,.3);
                    border-radius: 7px;
                    padding: 12px;
                    margin: 12px 0;
                }

                .aih-admin-header {
                    display: flex;
                    justify-content: space-between;
                    flex-wrap: wrap;
                    gap: 8px;
                    margin-bottom: 8px;
                }

                .aih-admin-title {
                    font-weight: 600;
                    overflow-wrap: anywhere;
                }

                .aih-admin-url {
                    overflow-wrap: anywhere;
                    opacity: .8;
                    margin: 6px 0;
                }

                .aih-admin-meta {
                    opacity: .7;
                    margin: 7px 0;
                }

                .aih-admin-indicators {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 6px;
                    margin: 10px 0;
                }

                .aih-admin-indicator {
                    padding: 4px 7px;
                    border: 1px solid rgba(128,128,128,.3);
                    border-radius: 4px;
                    font-size: 11px;
                }

                .aih-admin-actions {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 7px;
                    margin-top: 10px;
                }

                .aih-admin-button {
                    cursor: pointer;
                    padding: 7px 12px;
                    border: 1px solid rgba(128,128,128,.4);
                    border-radius: 4px;
                    background: transparent;
                    color: inherit;
                }

                .aih-admin-button:hover {
                    background: rgba(128,128,128,.15);
                }
            `;

            root.appendChild(style);

            const summary = this.createElement(
                "div",
                "aih-admin-summary"
            );

            const stats = [
                ["Detected Panels", this.results.length],
                [
                    "Admin Subdomains",
                    this.results.filter(
                        item => item.source === "Admin Subdomain"
                    ).length
                ],
                [
                    "Login Pages",
                    this.results.filter(
                        item => item.type === "Admin Login"
                    ).length
                ]
            ];

            for (const [label, value] of stats) {
                const stat = this.createElement(
                    "div",
                    "aih-admin-stat"
                );

                stat.appendChild(
                    this.createElement("strong", "", String(value))
                );

                stat.appendChild(
                    this.createElement("span", "", label)
                );

                summary.appendChild(stat);
            }

            root.appendChild(summary);

            root.appendChild(
                this.createButton(
                    "Copy Full Report",
                    () => Framework.copy(
                        JSON.stringify({
                            page: location.href,
                            scannedAt: this.scannedAt || new Date().toISOString(),
                            results: this.results
                        }, null, 2)
                    )
                )
            );

            for (const result of this.results) {
                root.appendChild(this.renderResult(result));
            }

            return root;
        }

        renderResult(result) {
            const card = this.createElement(
                "div",
                "aih-admin-card"
            );

            const header = this.createElement(
                "div",
                "aih-admin-header"
            );

            header.appendChild(
                this.createElement(
                    "span",
                    "aih-admin-title",
                    result.title
                )
            );

            header.appendChild(
                this.createElement(
                    "span",
                    "",
                    result.type
                )
            );

            card.appendChild(header);

            card.appendChild(
                this.createElement(
                    "div",
                    "aih-admin-url",
                    result.url
                )
            );

            card.appendChild(
                this.createElement(
                    "div",
                    "aih-admin-meta",
                    "HTTP " + result.status +
                    " | " + result.responseTime + " ms" +
                    " | " + result.source
                )
            );

            const indicators = this.createElement(
                "div",
                "aih-admin-indicators"
            );

            for (const item of result.indicators) {
                indicators.appendChild(
                    this.createElement(
                        "span",
                        "aih-admin-indicator",
                        item
                    )
                );
            }

            card.appendChild(indicators);

            const actions = this.createElement(
                "div",
                "aih-admin-actions"
            );

            actions.appendChild(
                this.createButton(
                    "Open Admin Panel",
                    () => Framework.open(result.url)
                )
            );

            actions.appendChild(
                this.createButton(
                    "Copy URL",
                    () => Framework.copy(result.url)
                )
            );

            card.appendChild(actions);

            return card;
        }

        createButton(label, callback) {
            const button = this.createElement(
                "button",
                "aih-admin-button",
                label
            );

            button.type = "button";
            button.addEventListener("click", callback);

            return button;
        }

        createElement(tag, className, text) {
            const element = document.createElement(tag);

            if (className) {
                element.className = className;
            }

            if (text !== undefined) {
                element.textContent = text;
            }

            return element;
        }

        restoreResult(data) {
            if (
                !data ||
                !Array.isArray(data.results) ||
                !data.results.every(result =>
                    result &&
                    typeof result.url === "string" &&
                    Array.isArray(result.indicators) &&
                    result.indicators.every(
                        indicator => typeof indicator === "string"
                    )
                )
            ) {
                return false;
            }

            this.results = data.results.map(result => ({
                ...result,
                indicators: [...result.indicators]
            }));

            this.scannedAt =
                typeof data.scannedAt === "string"
                    ? data.scannedAt
                    : null;

            this.available = this.results.length > 0;

            return true;
        }

        getMetadata() {
            return {
                id: AdminPanelViewer.id,
                title: AdminPanelViewer.title,
                description: AdminPanelViewer.description,
                icon: AdminPanelViewer.icon
            };
        }

        constructor(...args) {
            super(...args);
            this.available = false;
            this.results = [];
            this.scannedAt = null;
            this.timeout = 7000;
            this.maxResponseSize = 128 * 1024;
        }
}Framework.register(AdminPanelViewer.id,AdminPanelViewer);})(Framework);