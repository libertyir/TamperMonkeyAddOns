(function(Framework){"use strict";class HealthCheckViewer extends Framework.BaseModule{
        static id = "HealthCheck_Viewer";
        static title = "Health Check Viewer";
        static description = "Discover and inspect application health check endpoints";
        static icon = "♥";
        static scanPolicy = {
            scope: "origin-root",
            defaultTTL: "7d"
        };


static providerId="HealthCheck_Provider";async init(context={}){const result=context&&context.result;this.available=Boolean(result&&this.restoreResult(result,context));}
        render() {
            const root = this.create("div", "aih-health-viewer");

            const style = this.create("style");

            style.textContent = `
                .aih-health-viewer {
                    color: inherit;
                    font-size: 13px;
                }

                .aih-health-summary {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 10px;
                    margin-bottom: 15px;
                }

                .aih-health-stat {
                    padding: 10px 14px;
                    border: 1px solid rgba(128,128,128,.3);
                    border-radius: 6px;
                    min-width: 85px;
                }

                .aih-health-stat strong {
                    display: block;
                    font-size: 19px;
                    margin-bottom: 3px;
                }

                .aih-health-card {
                    border: 1px solid rgba(128,128,128,.3);
                    border-radius: 7px;
                    padding: 12px;
                    margin-bottom: 12px;
                }

                .aih-health-card-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    flex-wrap: wrap;
                    gap: 8px;
                    margin-bottom: 10px;
                }

                .aih-health-path {
                    font-weight: 600;
                    overflow-wrap: anywhere;
                }

                .aih-health-status {
                    font-weight: 600;
                }

                .aih-health-meta {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 12px;
                    opacity: .8;
                    margin: 8px 0;
                }

                .aih-health-details {
                    margin: 8px 0;
                    padding-left: 18px;
                }

                .aih-health-details li {
                    margin: 4px 0;
                }

                .aih-health-sample {
                    white-space: pre-wrap;
                    overflow-wrap: anywhere;
                    max-height: 220px;
                    overflow: auto;
                    padding: 10px;
                    border-radius: 5px;
                    background: rgba(128,128,128,.12);
                    margin-top: 8px;
                    font-family: monospace;
                    font-size: 12px;
                }

                .aih-health-actions {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 7px;
                    margin-top: 10px;
                }

                .aih-health-viewer .aih-button {
                    cursor: pointer;
                    padding: 6px 10px;
                    border: 1px solid rgba(128,128,128,.4);
                    border-radius: 4px;
                    background: transparent;
                    color: inherit;
                }

                .aih-health-viewer .aih-button:hover {
                    background: rgba(128,128,128,.15);
                }

                .aih-health-empty {
                    opacity: .7;
                    padding: 12px 0;
                }
            `;

            root.appendChild(style);

            const healthyCount = this.results.filter(
                item => item.health === "Healthy"
            ).length;

            const unhealthyCount = this.results.filter(
                item => item.health === "Unhealthy"
            ).length;

            const degradedCount = this.results.filter(
                item => item.health === "Degraded"
            ).length;

            const summary = this.create(
                "div",
                "aih-health-summary"
            );

            const stats = [
                ["Endpoints", this.results.length],
                ["Healthy", healthyCount],
                ["Degraded", degradedCount],
                ["Unhealthy", unhealthyCount]
            ];

            for (const [label, value] of stats) {
                const stat = this.create(
                    "div",
                    "aih-health-stat"
                );

                stat.appendChild(
                    this.create("strong", "", String(value))
                );

                stat.appendChild(
                    this.create("span", "", label)
                );

                summary.appendChild(stat);
            }

            root.appendChild(summary);

            this.addButton(
                root,
                "Copy Full Report",
                () => Framework.copy(
                    this.buildReport()
                )
            );

            const cards = this.create(
                "div",
                "aih-health-results"
            );

            root.appendChild(cards);

            for (const result of this.results) {
                cards.appendChild(
                    this.renderResult(result)
                );
            }

            return root;
        }

        renderResult(result) {
            const card = this.create(
                "div",
                "aih-health-card"
            );

            const header = this.create(
                "div",
                "aih-health-card-header"
            );

            header.appendChild(
                this.create(
                    "span",
                    "aih-health-path",
                    result.path
                )
            );

            header.appendChild(
                this.create(
                    "span",
                    "aih-health-status",
                    result.health
                )
            );

            card.appendChild(header);

            const meta = this.create(
                "div",
                "aih-health-meta"
            );

            [
                "HTTP " + result.status + " " + result.statusText,
                result.responseTime + " ms",
                result.format,
                result.contentType || "Unknown Content-Type"
            ].forEach(value => {
                meta.appendChild(
                    this.create("span", "", value)
                );
            });

            card.appendChild(meta);

            if (result.redirected) {
                card.appendChild(
                    this.create(
                        "div",
                        "",
                        "Redirected to: " + result.url
                    )
                );
            }

            if (result.healthDetails.length) {
                const list = this.create(
                    "ul",
                    "aih-health-details"
                );

                for (const detail of result.healthDetails) {
                    list.appendChild(
                        this.create("li", "", detail)
                    );
                }

                card.appendChild(list);
            }

            const actions = this.create(
                "div",
                "aih-health-actions"
            );

            this.addButton(
                actions,
                "Open Endpoint",
                () => Framework.open(result.url)
            );

            this.addButton(
                actions,
                "Copy URL",
                () => Framework.copy(result.url)
            );

            this.addButton(
                actions,
                "Copy Response",
                () => Framework.copy(result.sample)
            );

            this.addButton(
                actions,
                "View Response",
                () => {
                    const existing = card.querySelector(
                        ".aih-health-sample"
                    );

                    if (existing) {
                        existing.remove();
                        return;
                    }

                    const sample = this.create(
                        "pre",
                        "aih-health-sample",
                        result.sample || "(Empty response)"
                    );

                    card.appendChild(sample);
                }
            );

            this.addButton(
                actions,
                "Copy Headers",
                () => Framework.copy(
                    JSON.stringify(result.headers, null, 2)
                )
            );

            card.appendChild(actions);

            return card;
        }

        addButton(parent, label, callback) {
            const button = this.create(
                "button",
                "aih-button",
                label
            );

            button.type = "button";
            button.addEventListener("click", callback);
            parent.appendChild(button);

            return button;
        }

        create(tag, className, text) {
            const element = document.createElement(tag);

            if (className) {
                element.className = className;
            }

            if (text !== undefined) {
                element.textContent = text;
            }

            return element;
        }

        buildReport() {
            return JSON.stringify({
                page: location.href,
                scannedAt: this.scannedAt,
                totalEndpoints: this.results.length,
                results: this.results
            }, null, 2);
        }

        restoreResult(data) {
            if (
                !data ||
                !Array.isArray(data.results) ||
                data.results.length === 0
            ) {
                return false;
            }

            const restoredResults = [];

            try {
                for (const result of data.results) {
                    if (
                        !result ||
                        result.detected !== true ||
                        typeof result.path !== "string" ||
                        typeof result.url !== "string" ||
                        typeof result.status !== "number" ||
                        typeof result.health !== "string" ||
                        !Array.isArray(result.healthDetails) ||
                        !result.healthDetails.every(
                            item => typeof item === "string"
                        ) ||
                        typeof result.sample !== "string" ||
                        typeof result.format !== "string" ||
                        !result.headers ||
                        typeof result.headers !== "object" ||
                        Array.isArray(result.headers)
                    ) {
                        return false;
                    }

                    const endpoint = new URL(result.url);

                    if (
                        endpoint.origin !== location.origin ||
                        !Number.isInteger(result.status) ||
                        result.status < 0 ||
                        result.status > 599
                    ) {
                        return false;
                    }

                    restoredResults.push({
                        ...result,
                        url: endpoint.href,
                        healthDetails: [...result.healthDetails],
                        headers: { ...result.headers }
                    });
                }

                this.results = restoredResults;
                this.scannedAt = data.scannedAt || null;
                this.available = true;

                return true;

            } catch (error) {
                return false;
            }
        }

        getMetadata() {
            return {
                id: HealthCheckViewer.id,
                title: HealthCheckViewer.title,
                description: HealthCheckViewer.description,
                icon: HealthCheckViewer.icon
            };
        }

        constructor(...args) {
            super(...args);
            this.available = false;
            this.results = [];
            this.timeout = 6000;
            this.maxResponseSize = 16384;
            this.scannedAt = null;
        }
}Framework.register(HealthCheckViewer.id,HealthCheckViewer);})(Framework);