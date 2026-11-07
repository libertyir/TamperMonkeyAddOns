(function(Framework){"use strict";class MetricsViewer extends Framework.BaseModule{
        static id = "Metrics_Viewer";
        static title = "Metrics Viewer";
        static description = "Discover monitoring and metrics endpoints";
        static icon = "📊";
        static scanPolicy = {
            scope: "origin-root",
            defaultTTL: "7d"
        };


static providerId="Metrics_Provider";async init(context={}){const result=context&&context.result;this.available=Boolean(result&&this.restoreResult(result,context));}
        render() {
            const root = Framework.createElement("div", {
                className: "metrics-viewer",
                style: "padding:12px;overflow:auto;max-height:75vh;"
            });

            root.appendChild(
                Framework.createElement("h2", {
                    textContent: "Metrics & Monitoring"
                })
            );

            root.appendChild(
                Framework.createElement("p", {
                    textContent:
                        `${this.results.length} metrics endpoint(s) detected.`
                })
            );

            if (!this.results.length) {
                root.appendChild(
                    Framework.createElement("p", {
                        textContent: "No recognizable metrics endpoints found."
                    })
                );

                return root;
            }

            for (const item of this.results) {
                const card = this.createSection(item.platform);

                this.addRow(card, "Endpoint", item.url);
                this.addRow(card, "HTTP Status", `${item.status} ${item.statusText}`);
                this.addRow(card, "Format", item.format);
                this.addRow(card, "Content-Type", item.contentType);
                this.addRow(card, "Response Time", `${item.duration} ms`);

                if (item.redirected) {
                    this.addRow(card, "Final URL", item.finalUrl);
                }

                card.appendChild(
                    this.createButton("Open Endpoint", () => {
                        Framework.open(item.url);
                    })
                );

                card.appendChild(
                    this.createButton("Copy URL", () => {
                        Framework.copy(item.url);
                    })
                );

                card.appendChild(
                    this.createButton("Copy Sample", () => {
                        Framework.copy(item.sample);
                    })
                );

                card.appendChild(
                    this.createButton("Copy Headers", () => {
                        Framework.copy(
                            JSON.stringify(item.headers, null, 2)
                        );
                    })
                );

                card.appendChild(
                    Framework.createElement("h4", {
                        textContent: "Response Sample"
                    })
                );

                card.appendChild(
                    Framework.createElement("pre", {
                        textContent: item.sample,
                        style: "white-space:pre-wrap;overflow-wrap:anywhere;max-height:300px;overflow:auto;padding:8px;border:1px solid #888;"
                    })
                );

                root.appendChild(card);
            }

            root.appendChild(
                this.createButton("Copy Full Report", () => {
                    Framework.copy(
                        JSON.stringify(this.results, null, 2)
                    );
                })
            );

            return root;
        }

        createButton(label, handler) {
            const button = Framework.createElement("button", {
                textContent: label,
                style: "margin:4px;padding:6px 10px;cursor:pointer;"
            });

            button.addEventListener("click", handler);
            return button;
        }

        addRow(container, name, value) {
            const row = Framework.createElement("div", {
                style: "display:flex;flex-wrap:wrap;gap:8px;margin:6px 0;padding:5px 0;border-bottom:1px solid #888;"
            });

            row.appendChild(
                Framework.createElement("strong", {
                    textContent: name + ":"
                })
            );

            row.appendChild(
                Framework.createElement("span", {
                    textContent: String(value ?? "Not available"),
                    style: "overflow-wrap:anywhere;"
                })
            );

            container.appendChild(row);
        }

        createSection(title) {
            const section = Framework.createElement("section", {
                style: "margin:14px 0;padding:10px;border:1px solid #888;border-radius:6px;"
            });

            section.appendChild(
                Framework.createElement("h3", {
                    textContent: title
                })
            );

            return section;
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
                for (const item of data.results) {
                    if (
                        !item ||
                        typeof item.url !== "string" ||
                        typeof item.finalUrl !== "string" ||
                        typeof item.status !== "number" ||
                        typeof item.platform !== "string" ||
                        typeof item.format !== "string" ||
                        typeof item.sample !== "string" ||
                        !item.headers ||
                        typeof item.headers !== "object" ||
                        Array.isArray(item.headers)
                    ) {
                        return false;
                    }

                    const originalUrl = new URL(item.url);
                    const finalUrl = new URL(item.finalUrl);

                    if (
                        originalUrl.origin !== location.origin ||
                        finalUrl.origin !== location.origin ||
                        !Number.isInteger(item.status) ||
                        item.status < 0 ||
                        item.status > 599
                    ) {
                        return false;
                    }

                    restoredResults.push({
                        ...item,
                        url: originalUrl.href,
                        finalUrl: finalUrl.href,
                        headers: { ...item.headers }
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
                id: MetricsViewer.id,
                title: MetricsViewer.title,
                description: MetricsViewer.description,
                icon: MetricsViewer.icon
            };
        }

        constructor() {
            super();
            this.available = false;
            this.results = [];
            this.timeout = 6000;
            this.scannedAt = null;
        }
}Framework.register(MetricsViewer.id,MetricsViewer);})(Framework);