(function(Framework){"use strict";class HealthCheckViewerScanner extends Framework.BaseModule{
        static id = "HealthCheck_Scanner";
        static title = "Health Check Viewer";
        static description = "Discover and inspect application health check endpoints";
        static icon = "♥";
        static scanPolicy = {
            scope: "origin-root",
            defaultTTL: "7d"
        };


        getResult() {
            if (!this.available || !this.results.length) {
                return null;
            }

            return {
                page: location.href,
                scannedAt: this.scannedAt,
                totalEndpoints: this.results.length,
                results: this.results.map(result => ({
                    ...result,
                    healthDetails: [...result.healthDetails],
                    headers: { ...result.headers }
                }))
            };
        }

        async runScan() {
            this.available = false;
            this.results = [];
            this.scannedAt = new Date().toISOString();

            const candidates = this.getCandidates();

            for (const path of candidates) {
                try {
                    const result = await this.checkEndpoint(path);

                    if (result && result.detected) {
                        this.results.push(result);
                    }
                } catch (error) {
                    // Ignore individual endpoint failures.
                }
            }

            this.available = this.results.length > 0;
        }

        async checkEndpoint(path) {
            const url = new URL(path, location.origin);

            if (url.origin !== location.origin) {
                return null;
            }

            const controller = new AbortController();
            const timeoutId = setTimeout(
                () => controller.abort(),
                this.timeout
            );

            const startedAt = performance.now();

            try {
                const response = await Framework.SiteIntelligence.fetch(url.href, {
                    method: "GET",
                    credentials: "same-origin",
                    redirect: "follow",
                    cache: "no-store",
                    signal: controller.signal,
                    headers: {
                        "Accept": "application/json, text/plain, */*"
                    }
                });

                const responseTime = Math.round(
                    performance.now() - startedAt
                );

                if (new URL(response.url).origin !== location.origin) {
                    return null;
                }

                const contentType =
                    response.headers.get("content-type") || "";

                const body = await this.readResponse(response);

                const analysis = this.analyzeResponse(
                    response,
                    body,
                    contentType,
                    path
                );

                if (!analysis.detected) {
                    return null;
                }

                return {
                    detected: true,
                    path: path,
                    url: response.url,
                    status: response.status,
                    statusText: response.statusText,
                    responseTime: responseTime,
                    contentType: contentType,
                    contentLength:
                        response.headers.get("content-length") || "",
                    redirected: response.redirected,
                    health: analysis.health,
                    healthDetails: analysis.details,
                    format: analysis.format,
                    sample: body,
                    headers: this.getHeaders(response.headers)
                };

            } finally {
                clearTimeout(timeoutId);
            }
        }

        getHeaders(headers) {
            const output = {};

            headers.forEach((value, key) => {
                output[key] = value;
            });

            return output;
        }

        analyzeResponse(response, body, contentType, path) {
            const result = {
                detected: false,
                health: "Unknown",
                details: [],
                format: "Unknown"
            };

            const trimmed = body.trim();

            let json = null;

            if (
                contentType.toLowerCase().includes("json") ||
                trimmed.startsWith("{") ||
                trimmed.startsWith("[")
            ) {
                try {
                    json = JSON.parse(trimmed);
                    result.format = "JSON";
                } catch (error) {
                    json = null;
                }
            }

            if (json !== null) {
                const statuses = this.extractStatuses(json);

                if (statuses.length > 0) {
                    result.detected = true;
                    result.details = statuses;
                    result.health = this.evaluateStatuses(statuses);
                } else if (
                    this.hasHealthStructure(json)
                ) {
                    result.detected = true;
                    result.health = response.ok
                        ? "Unknown"
                        : "Unhealthy";
                    result.details = [
                        "Health-related JSON response detected"
                    ];
                }
            }

            if (!result.detected && trimmed) {
                const textResult = this.analyzePlainText(trimmed);

                if (textResult.detected) {
                    result.detected = true;
                    result.health = textResult.health;
                    result.details = textResult.details;
                    result.format = "Plain Text";
                }
            }

            if (
                !result.detected &&
                trimmed.length === 0 &&
                response.ok &&
                [204, 205].includes(response.status)
            ) {
                result.detected = true;
                result.health = "Healthy";
                result.details = [
                    "Successful empty health-check response"
                ];
                result.format = "Empty Response";
            }

            if (
                !result.detected &&
                response.status >= 500 &&
                this.isExplicitHealthPath(path) &&
                (
                    contentType.includes("json") ||
                    /health|unhealthy|unavailable|degraded|down/i.test(trimmed)
                )
            ) {
                result.detected = true;
                result.health = "Unhealthy";
                result.details = [
                    "HTTP server error returned by health endpoint"
                ];
            }

            if (result.detected && response.status >= 500) {
                result.health = "Unhealthy";
            }

            return result;
        }

        isExplicitHealthPath(path) {
            return /health|ready|live|heartbeat/i.test(path);
        }

        analyzePlainText(body) {
            const normalized = body
                .trim()
                .toLowerCase()
                .replace(/^[\"']|[\"']$/g, "");

            const healthyPatterns = [
                /^ok$/,
                /^healthy$/,
                /^up$/,
                /^pong$/,
                /^alive$/,
                /^ready$/,
                /^pass$/
            ];

            const unhealthyPatterns = [
                /^down$/,
                /^unhealthy$/,
                /^not ready$/,
                /^failed$/,
                /^failure$/,
                /^unavailable$/
            ];

            if (healthyPatterns.some(pattern =>
                pattern.test(normalized)
            )) {
                return {
                    detected: true,
                    health: "Healthy",
                    details: ["Response: " + normalized]
                };
            }

            if (unhealthyPatterns.some(pattern =>
                pattern.test(normalized)
            )) {
                return {
                    detected: true,
                    health: "Unhealthy",
                    details: ["Response: " + normalized]
                };
            }

            return {
                detected: false,
                health: "Unknown",
                details: []
            };
        }

        hasHealthStructure(data) {
            if (!data || typeof data !== "object") {
                return false;
            }

            const keys = Object.keys(data).map(
                key => key.toLowerCase()
            );

            return keys.some(key =>
                [
                    "checks",
                    "components",
                    "details",
                    "dependencies",
                    "indicators",
                    "groups"
                ].includes(key)
            );
        }

        evaluateStatuses(statuses) {
            const values = statuses.map(item =>
                item.substring(item.indexOf(":") + 1)
                    .trim()
                    .toLowerCase()
            );

            const unhealthy = [
                "down",
                "unhealthy",
                "out_of_service",
                "out-of-service",
                "failed",
                "failure",
                "critical",
                "error"
            ];

            const degraded = [
                "degraded",
                "warning",
                "partial",
                "limited"
            ];

            const healthy = [
                "up",
                "healthy",
                "ok",
                "pass",
                "passed",
                "ready",
                "alive"
            ];

            if (values.some(value =>
                unhealthy.includes(value)
            )) {
                return "Unhealthy";
            }

            if (values.some(value =>
                degraded.includes(value)
            )) {
                return "Degraded";
            }

            if (
                values.length > 0 &&
                values.every(value =>
                    healthy.includes(value)
                )
            ) {
                return "Healthy";
            }

            return "Unknown";
        }

        extractStatuses(data, depth = 0, output = []) {
            if (
                depth > 8 ||
                output.length >= 50 ||
                data === null ||
                typeof data !== "object"
            ) {
                return output;
            }

            if (Array.isArray(data)) {
                for (const item of data) {
                    this.extractStatuses(item, depth + 1, output);
                }

                return output;
            }

            for (const [key, value] of Object.entries(data)) {
                const normalizedKey = key.toLowerCase();

                if (
                    ["status", "state", "health"].includes(normalizedKey) &&
                    typeof value === "string"
                ) {
                    output.push(
                        key + ": " + value
                    );
                }

                if (
                    value &&
                    typeof value === "object"
                ) {
                    this.extractStatuses(
                        value,
                        depth + 1,
                        output
                    );
                }
            }

            return output;
        }

        async readResponse(response) {
            if (!response.body) {
                return "";
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            let result = "";
            let total = 0;

            try {
                while (total < this.maxResponseSize) {
                    const { done, value } = await reader.read();

                    if (done) {
                        break;
                    }

                    const remaining =
                        this.maxResponseSize - total;

                    const chunk = value.slice(0, remaining);

                    result += decoder.decode(chunk, {
                        stream: true
                    });

                    total += chunk.length;

                    if (chunk.length < value.length) {
                        break;
                    }
                }

                result += decoder.decode();

            } finally {
                try {
                    await reader.cancel();
                } catch (error) {
                    // Ignore stream cancellation errors.
                }
            }

            return result;
        }

        getCandidates() {
            return [
                "/health",
                "/health/",
                "/healthz",
                "/health/live",
                "/health/ready",
                "/healthcheck",
                "/health-check",
                "/api/health",
                "/api/healthz",
                "/api/healthcheck",
                "/ready",
                "/readyz",
                "/live",
                "/livez",
                "/ping",
                "/heartbeat",
                "/_health",
                "/_healthz",
                "/actuator/health",
                "/actuator/health/liveness",
                "/actuator/health/readiness",
                "/status/health"
            ];
        }

        constructor(...args) {
            super(...args);
            this.available = false;
            this.results = [];
            this.timeout = 6000;
            this.maxResponseSize = 16384;
            this.scannedAt = null;
        }
async scan(context={}){await this.runScan(context);if(!this.available)return null;const result=await this.getResult();if(!result||typeof result!=="object")return null;const origin=new URL(context.url||context.currentUrl||location.href).origin;return {...result,directoryUrl:context.directoryUrl||context.scope||origin+"/"};}}
Framework.register(HealthCheckViewerScanner.id,HealthCheckViewerScanner);})(Framework);