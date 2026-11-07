(function(Framework){"use strict";class MetricsViewerScanner extends Framework.BaseModule{
        static id = "Metrics_Scanner";
        static title = "Metrics Viewer";
        static description = "Discover monitoring and metrics endpoints";
        static icon = "📊";
        static scanPolicy = {
            scope: "origin-root",
            defaultTTL: "7d"
        };


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

        async runScan() {
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

        async checkEndpoint(url) {
            const controller = new AbortController();
            const timer = setTimeout(
                () => controller.abort(),
                this.timeout
            );

            const started = performance.now();

            try {
                const response = await Framework.SiteIntelligence.fetch(url, {
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

        constructor() {
            super();
            this.available = false;
            this.results = [];
            this.timeout = 6000;
            this.scannedAt = null;
        }
async scan(context={}){await this.runScan(context);if(!this.available)return null;const result=await this.getResult();if(!result||typeof result!=="object")return null;const origin=new URL(context.url||context.currentUrl||location.href).origin;return {...result,directoryUrl:context.directoryUrl||context.scope||origin+"/"};}}
Framework.register(MetricsViewerScanner.id,MetricsViewerScanner);})(Framework);