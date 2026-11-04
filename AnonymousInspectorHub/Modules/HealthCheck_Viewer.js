(function (Framework) {
    "use strict";

    class HealthCheckViewer extends Framework.BaseModule {
        static id = "HealthCheck_Viewer";
        static title = "Health Check Viewer";
        static description = "Discover and inspect application health check endpoints";
        static icon = "♥";
        static scanPolicy = {
            scope: "origin-root",
            defaultTTL: "7d"
        };

        constructor(...args) {
            super(...args);
            this.available = false;
            this.results = [];
            this.timeout = 6000;
            this.maxResponseSize = 16384;
            this.scannedAt = null;
        }

        getMetadata() {
            return {
                id: HealthCheckViewer.id,
                title: HealthCheckViewer.title,
                description: HealthCheckViewer.description,
                icon: HealthCheckViewer.icon
            };
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

        async init() {
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

        isExplicitHealthPath(path) {
            return /health|ready|live|heartbeat/i.test(path);
        }

        getHeaders(headers) {
            const output = {};

            headers.forEach((value, key) => {
                output[key] = value;
            });

            return output;
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

        buildReport() {
            return JSON.stringify({
                page: location.href,
                scannedAt: this.scannedAt,
                totalEndpoints: this.results.length,
                results: this.results
            }, null, 2);
        }
    }

    Framework.register(
        HealthCheckViewer.id,
        HealthCheckViewer
    );

})(Framework);