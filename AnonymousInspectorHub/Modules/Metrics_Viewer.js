(function (Framework) {
    "use strict";

    class MetricsViewer extends Framework.BaseModule {
        static id = "Metrics_Viewer";
        static title = "Metrics Viewer";
        static description = "Discover monitoring and metrics endpoints";
        static icon = "📊";
        static scanPolicy = {
            scope: "origin-root",
            defaultTTL: "7d"
        };

        constructor() {
            super();
            this.available = false;
            this.results = [];
            this.timeout = 6000;
            this.scannedAt = null;
        }

        getMetadata() {
            return {
                id: MetricsViewer.id,
                title: MetricsViewer.title,
                description: MetricsViewer.description,
                icon: MetricsViewer.icon
            };
        }

        async init() {
            this.available = false;
            this.results = [];
            this.scannedAt = new Date().toISOString();

            const paths = [
                "/metrics",
                "/metrics/",
                "/actuator/metrics",
                "/actuator/prometheus",
                "/prometheus/metrics",
                "/prometheus",
                "/stats",
                "/stats/",
                "/status",
                "/server-status",
                "/nginx_status",
                "/stub_status",
                "/_stats",
                "/debug/vars",
                "/debug/metrics",
                "/internal/metrics"
            ];

            for (const path of paths) {
                const url = new URL(path, location.origin);

                try {
                    const result = await this.checkEndpoint(url.href);

                    if (result && result.detected) {
                        this.results.push(result);
                    }
                } catch (error) {
                    // Ignore inaccessible endpoints.
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
                totalEndpoints: this.results.length,
                results: this.results.map(item => ({
                    ...item,
                    headers: { ...item.headers }
                }))
            };
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

        async checkEndpoint(url) {
            const controller = new AbortController();
            const timer = setTimeout(
                () => controller.abort(),
                this.timeout
            );

            const started = performance.now();

            try {
                const response = await fetch(url, {
                    method: "GET",
                    credentials: "same-origin",
                    cache: "no-store",
                    redirect: "follow",
                    signal: controller.signal
                });

                const finalUrl = new URL(response.url);

                if (finalUrl.origin !== location.origin) {
                    return null;
                }

                const contentType =
                    response.headers.get("content-type") || "";

                const reader = response.body?.getReader();

                let body = "";

                if (reader) {
                    try {
                        while (body.length < 32768) {
                            const { done, value } = await reader.read();

                            if (done) break;

                            body += new TextDecoder().decode(value);

                            if (body.length >= 32768) {
                                break;
                            }
                        }
                    } finally {
                        await reader.cancel().catch(() => { });
                    }
                }

                const detection = this.detectMetrics(
                    url,
                    contentType,
                    body
                );

                if (!detection) return null;

                const headers = {};

                response.headers.forEach((value, name) => {
                    headers[name.toLowerCase()] = value;
                });

                return {
                    detected: true,
                    url,
                    finalUrl: response.url,
                    status: response.status,
                    statusText: response.statusText,
                    duration: Math.round(performance.now() - started),
                    contentType,
                    platform: detection.platform,
                    format: detection.format,
                    sample: body.slice(0, 12000),
                    headers,
                    redirected: response.redirected
                };

            } finally {
                clearTimeout(timer);
            }
        }

        detectMetrics(url, contentType, body) {
            const path = new URL(url).pathname.toLowerCase();
            const text = body.toLowerCase();

            if (
                path === "/metrics" ||
                path.endsWith("/metrics") ||
                path.includes("/actuator/prometheus")
            ) {
                if (
                    /^# (help|type) /m.test(body) ||
                    /^[a-z_:][a-z0-9_:]*\s+[-+]?\d/m.test(body)
                ) {
                    return {
                        platform: "Prometheus",
                        format: "Prometheus exposition format"
                    };
                }
            }

            if (
                path.includes("/actuator/metrics") &&
                (
                    text.includes("names") ||
                    text.includes("measurements")
                )
            ) {
                return {
                    platform: "Spring Boot Actuator",
                    format: "JSON"
                };
            }

            if (
                path === "/debug/vars" &&
                (
                    text.includes("memstats") ||
                    text.includes("cmdline") ||
                    text.includes("goroutines")
                )
            ) {
                return {
                    platform: "Go expvar",
                    format: "JSON"
                };
            }

            if (
                path.includes("nginx_status") ||
                path.includes("stub_status")
            ) {
                if (
                    /active connections/i.test(body) ||
                    /server accepts handled requests/i.test(body)
                ) {
                    return {
                        platform: "Nginx Stub Status",
                        format: "Plain Text"
                    };
                }
            }

            if (path === "/server-status") {
                if (
                    /server version/i.test(body) ||
                    /total accesses/i.test(body) ||
                    /scoreboard/i.test(body)
                ) {
                    return {
                        platform: "Apache mod_status",
                        format: "HTML"
                    };
                }
            }

            if (
                path === "/stats" ||
                path === "/stats/" ||
                path === "/_stats"
            ) {
                if (
                    text.includes("uptime") ||
                    text.includes("requests") ||
                    text.includes("connections") ||
                    text.includes("metrics")
                ) {
                    return {
                        platform: "Generic Metrics",
                        format: contentType || "Unknown"
                    };
                }
            }

            if (
                path === "/debug/metrics" ||
                path === "/internal/metrics"
            ) {
                if (
                    text.includes("metric") ||
                    text.includes("counter") ||
                    text.includes("gauge")
                ) {
                    return {
                        platform: "Generic Monitoring",
                        format: contentType || "Unknown"
                    };
                }
            }

            return null;
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
    }

    Framework.register(MetricsViewer.id, MetricsViewer);

})(Framework);