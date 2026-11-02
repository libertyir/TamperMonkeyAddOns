(function (Framework) {
    "use strict";

    class StatusViewer extends Framework.BaseModule {
        static id = "Status_Viewer";
        static title = "HTTP Status Viewer";
        static description = "Inspect HTTP status codes and common public resources";
        static icon = "📡";

        constructor() {
            super();
            this.available = false;
            this.results = [];
            this.timeout = 7000;
            this.scannedAt = null;
        }

        getMetadata() {
            return {
                id: StatusViewer.id,
                title: StatusViewer.title,
                description: StatusViewer.description,
                icon: StatusViewer.icon
            };
        }

        async init() {
            this.available = false;
            this.results = [];
            this.scannedAt = new Date().toISOString();

            const paths = [
                "/",
                "/robots.txt",
                "/sitemap.xml",
                "/sitemap_index.xml",
                "/favicon.ico",
                "/security.txt",
                "/.well-known/security.txt",
                "/humans.txt",
                "/ads.txt",
                "/crossdomain.xml",
                "/clientaccesspolicy.xml",
                "/manifest.json",
                "/browserconfig.xml",
                "/.well-known/assetlinks.json",
                "/.well-known/apple-app-site-association"
            ];

            const origin = location.origin;

            for (const path of paths) {
                const url = new URL(path, origin);

                try {
                    const result = await this.checkUrl(url.href);
                    this.results.push(result);
                } catch (error) {
                    this.results.push({
                        url: url.href,
                        status: 0,
                        statusText: "Request Failed",
                        finalUrl: url.href,
                        method: "HEAD",
                        duration: 0,
                        contentType: "",
                        contentLength: "",
                        headers: {},
                        error: error.message || "Request failed"
                    });
                }
            }

            this.available = this.results.length > 0;
        }

        getResult() {
            if (!this.available || !this.results.length) {
                return null;
            }

            return {
                page: window.location.href,
                scannedAt: this.scannedAt,
                totalChecked: this.results.length,
                results: this.results.map(result => ({
                    ...result,
                    headers: { ...result.headers }
                }))
            };
        }

        async checkUrl(url) {
            let result = await this.request(url, "HEAD");

            // Some servers do not support HEAD.
            if (result.status === 405 || result.status === 501) {
                result = await this.request(url, "GET");
            }

            return result;
        }

        async request(url, method) {
            const controller = new AbortController();
            const started = performance.now();

            const timer = setTimeout(
                () => controller.abort(),
                this.timeout
            );

            try {
                const response = await fetch(url, {
                    method,
                    credentials: "same-origin",
                    cache: "no-store",
                    redirect: "follow",
                    signal: controller.signal
                });

                const finalUrl = new URL(response.url);

                if (finalUrl.origin !== location.origin) {
                    throw new Error("Redirected outside the current origin.");
                }

                const headers = {};

                response.headers.forEach((value, name) => {
                    headers[name.toLowerCase()] = value;
                });

                return {
                    url,
                    status: response.status,
                    statusText: response.statusText,
                    finalUrl: response.url,
                    method,
                    duration: Math.round(performance.now() - started),
                    contentType: headers["content-type"] || "",
                    contentLength: headers["content-length"] || "",
                    headers,
                    redirected: response.redirected,
                    error: null
                };

            } finally {
                clearTimeout(timer);
            }
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
                item => item.status >= 400 || item.status === 0
            ).length;

            this.addRow(summary, "Total Checked", this.results.length);
            this.addRow(summary, "Successful", successful);
            this.addRow(summary, "Redirects", redirects);
            this.addRow(summary, "Errors / Failed", errors);

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
    }

    Framework.register(StatusViewer.id, StatusViewer);

})(Framework);