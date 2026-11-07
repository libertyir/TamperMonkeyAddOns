(function(Framework){"use strict";class StatusViewer extends Framework.BaseModule{
        static id = "Status_Viewer";
        static title = "HTTP Status Viewer";
        static description = "Inspect HTTP status codes and common public resources";
        static icon = "📡";

        static scanPolicy = {
            scope: "origin-root",
            defaultTTL: "permanent"
        };


static providerId="Status_Provider";async init(context={}){const result=context&&context.result;this.available=Boolean(result&&this.restoreResult(result,context));}
        render() {
            const root = Framework.createElement("div", {
                className: "status-viewer",
                style: "padding:12px;overflow:auto;max-height:75vh;"
            });

            root.appendChild(
                Framework.createElement("h2", {
                    textContent: "HTTP Status Inspection"
                })
            );

            const summary = this.createSection("Summary");

            const successful = this.results.filter(
                item => item.status >= 200 && item.status < 300
            ).length;

            const redirects = this.results.filter(
                item => item.status >= 300 && item.status < 400
            ).length;

            const errors = this.results.filter(
                item => item.status >= 400
            ).length;

            this.addRow(summary, "Total Checked", this.results.length);
            this.addRow(summary, "Successful", successful);
            this.addRow(summary, "Redirects", redirects);
            this.addRow(summary, "Errors", errors);

            root.appendChild(summary);

            const resultsSection = this.createSection("Resource Results");

            for (const result of this.results) {
                resultsSection.appendChild(
                    this.renderResult(result)
                );
            }

            root.appendChild(resultsSection);

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

        renderResult(result) {
            const card = Framework.createElement("div", {
                style: "margin:10px 0;padding:10px;border:1px solid #888;border-radius:6px;"
            });

            const status = result.status
                ? `${result.status} ${result.statusText}`
                : result.statusText;

            const statusElement = Framework.createElement("strong", {
                textContent: status,
                style: `color:${this.getStatusColor(result.status)};`
            });

            card.appendChild(statusElement);

            card.appendChild(
                Framework.createElement("p", {
                    textContent: result.url,
                    style: "overflow-wrap:anywhere;"
                })
            );

            this.addRow(
                card,
                "Result",
                result.error || this.getStatusLabel(result.status)
            );

            this.addRow(card, "Method", result.method);

            this.addRow(
                card,
                "Response Time",
                `${result.duration} ms`
            );

            if (result.redirected) {
                this.addRow(card, "Final URL", result.finalUrl);
            }

            if (result.contentType) {
                this.addRow(card, "Content-Type", result.contentType);
            }

            if (result.contentLength) {
                this.addRow(card, "Content-Length", result.contentLength);
            }

            card.appendChild(
                this.createButton("Open", () => {
                    Framework.open(result.url);
                })
            );

            card.appendChild(
                this.createButton("Copy URL", () => {
                    Framework.copy(result.url);
                })
            );

            card.appendChild(
                this.createButton("Copy Headers", () => {
                    Framework.copy(
                        JSON.stringify(result.headers, null, 2)
                    );
                })
            );

            card.appendChild(
                this.createButton("View Details", () => {
                    this.showDetails(card, result);
                })
            );

            return card;
        }

        showDetails(card, result) {
            const existing = card.querySelector(".status-details");

            if (existing) {
                existing.remove();
                return;
            }

            const details = Framework.createElement("div", {
                className: "status-details",
                style: "margin-top:10px;padding:8px;border-top:1px solid #888;"
            });

            details.appendChild(
                Framework.createElement("h4", {
                    textContent: "Response Headers"
                })
            );

            if (!Object.keys(result.headers).length) {
                this.addRow(details, "Headers", "No readable headers");
            }

            for (const [name, value] of Object.entries(result.headers)) {
                this.addRow(details, name, value);
            }

            card.appendChild(details);
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

        getStatusLabel(status) {
            if (status >= 200 && status < 300) return "Success";
            if (status >= 300 && status < 400) return "Redirect";
            if (status === 401) return "Unauthorized";
            if (status === 403) return "Forbidden";
            if (status === 404) return "Not Found";
            if (status >= 400 && status < 500) return "Client Error";
            if (status >= 500) return "Server Error";
            return "Unknown";
        }

        getStatusColor(status) {
            if (status >= 200 && status < 300) return "#16803c";
            if (status >= 300 && status < 400) return "#b7791f";
            if (status >= 400) return "#c53030";
            return "#777";
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

            try {
                const restored = [];

                for (const result of data.results) {
                    if (
                        !result ||
                        typeof result.url !== "string" ||
                        typeof result.finalUrl !== "string" ||
                        typeof result.status !== "number" ||
                        result.status < 100 ||
                        result.status > 599 ||
                        typeof result.statusText !== "string" ||
                        !["HEAD", "GET"].includes(result.method) ||
                        typeof result.duration !== "number" ||
                        typeof result.contentType !== "string" ||
                        typeof result.contentLength !== "string" ||
                        typeof result.redirected !== "boolean" ||
                        !result.headers ||
                        typeof result.headers !== "object" ||
                        Array.isArray(result.headers) ||
                        (
                            result.error !== null &&
                            typeof result.error !== "string"
                        )
                    ) {
                        return false;
                    }

                    const url = new URL(result.url);
                    const finalUrl = new URL(result.finalUrl);

                    if (
                        url.origin !== location.origin ||
                        finalUrl.origin !== location.origin
                    ) {
                        return false;
                    }

                    const headers = {};

                    for (const [name, value] of Object.entries(result.headers)) {
                        if (
                            typeof name !== "string" ||
                            typeof value !== "string"
                        ) {
                            return false;
                        }

                        headers[name.toLowerCase()] = value;
                    }

                    restored.push({
                        ...result,
                        url: url.href,
                        finalUrl: finalUrl.href,
                        headers
                    });
                }

                this.results = restored;
                this.scannedAt = data.scannedAt || null;
                this.available = true;

                return true;

            } catch (error) {
                return false;
            }
        }

        getMetadata() {
            return {
                id: StatusViewer.id,
                title: StatusViewer.title,
                description: StatusViewer.description,
                icon: StatusViewer.icon
            };
        }

        constructor() {
            super();
            this.available = false;
            this.results = [];
            this.timeout = 7000;
            this.scannedAt = null;
        }
}Framework.register(StatusViewer.id,StatusViewer);})(Framework);