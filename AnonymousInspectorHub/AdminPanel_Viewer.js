
(function (Framework) {
    "use strict";

    class AdminPanelViewer extends Framework.BaseModule {
        static id = "AdminPanel_Viewer";
        static title = "Admin Panel Viewer";
        static description = "Discover administrative interfaces on the current domain";
        static icon = "🔐";

        constructor(...args) {
            super(...args);
            this.available = false;
            this.results = [];
            this.timeout = 7000;
            this.maxResponseSize = 128 * 1024;
        }

        getMetadata() {
            return {
                id: AdminPanelViewer.id,
                title: AdminPanelViewer.title,
                description: AdminPanelViewer.description,
                icon: AdminPanelViewer.icon
            };
        }

        getPaths() {
            return [
                "/admin",
                "/admin/",
                "/administrator",
                "/administrator/",
                "/admin.php",
                "/admin.html",
                "/admin/login",
                "/admin/login.php",
                "/admin/dashboard",
                "/admin/index.php",
                "/admin/index.html",
                "/adminpanel",
                "/admin-panel",
                "/admin_area",
                "/adminarea",
                "/admincp",
                "/admin/controlpanel",
                "/controlpanel",
                "/control-panel",
                "/cpanel",
                "/manage",
                "/manager",
                "/management",
                "/backend",
                "/backoffice",
                "/dashboard",
                "/wp-admin/",
                "/wp-login.php",
                "/user/login",
                "/login",
                "/login.php",
                "/auth/login",
                "/cms",
                "/cms/",
                "/panel",
                "/panel/",
                "/console",
                "/console/",
                "/system",
                "/system/",
                "/moderator"
            ];
        }

        getAllowedHosts() {
            const currentHost = location.hostname.toLowerCase();

            return [
                currentHost,
                "admin." + currentHost
            ];
        }

        isAllowedHost(hostname) {
            return this.getAllowedHosts().includes(
                hostname.toLowerCase()
            );
        }

        getTargets() {
            const hosts = this.getAllowedHosts();
            const protocol = location.protocol;

            const targets = [];
            const seen = new Set();

            for (const host of hosts) {
                for (const path of this.getPaths()) {
                    const url = new URL(
                        protocol + "//" + host + path
                    );

                    if (seen.has(url.href)) continue;

                    seen.add(url.href);

                    targets.push({
                        url: url.href,
                        host: host,
                        path: path,
                        source: host === "admin." + location.hostname.toLowerCase()
                            ? "Admin Subdomain"
                            : "Current Domain"
                    });
                }
            }

            return targets;
        }

        async init() {
            this.available = false;
            this.results = [];

            const targets = this.getTargets();

            let index = 0;

            const worker = async () => {
                while (index < targets.length) {
                    const target = targets[index++];

                    try {
                        const result = await this.checkTarget(target);

                        if (result) {
                            this.results.push(result);
                        }
                    } catch (error) {
                        // Ignore inaccessible targets.
                    }
                }
            };

            const workers = Array.from(
                { length: 4 },
                () => worker()
            );

            await Promise.all(workers);

            this.results.sort((a, b) =>
                a.url.localeCompare(b.url)
            );

            this.available = this.results.length > 0;
        }

        async checkTarget(target) {
            const startedAt = performance.now();

            const responseData = await this.requestPage(target.url);

            if (!responseData) return null;

            const responseTime = Math.round(
                performance.now() - startedAt
            );

            const finalUrl = new URL(responseData.url);

            // Never accept redirects to other hosts.
            if (!this.isAllowedHost(finalUrl.hostname)) {
                return null;
            }

            const analysis = this.analyzePage(
                responseData.html,
                target
            );

            if (!analysis.detected) return null;

            return {
                url: responseData.url,
                requestedUrl: target.url,
                host: target.host,
                path: target.path,
                source: target.source,
                status: responseData.status,
                responseTime: responseTime,
                title: analysis.title,
                type: analysis.type,
                indicators: analysis.indicators
            };
        }

        requestPage(url) {
            return new Promise((resolve, reject) => {
                if (typeof GM_xmlhttpRequest !== "function") {
                    this.fetchPage(url).then(resolve).catch(reject);
                    return;
                }

                GM_xmlhttpRequest({
                    method: "GET",
                    url: url,
                    timeout: this.timeout,
                    headers: {
                        "Accept": "text/html"
                    },
                    onload: response => {
                        if (
                            response.status < 200 ||
                            response.status >= 400
                        ) {
                            resolve(null);
                            return;
                        }

                        const finalUrl = response.finalUrl || url;

                        // Reject redirects outside the two allowed hosts.
                        try {
                            if (!this.isAllowedHost(
                                new URL(finalUrl).hostname
                            )) {
                                resolve(null);
                                return;
                            }
                        } catch (error) {
                            resolve(null);
                            return;
                        }

                        resolve({
                            status: response.status,
                            url: finalUrl,
                            html: (response.responseText || "")
                                .substring(0, this.maxResponseSize)
                        });
                    },
                    onerror: () => resolve(null),
                    ontimeout: () => resolve(null)
                });
            });
        }

        async fetchPage(url) {
            const controller = new AbortController();

            const timer = setTimeout(
                () => controller.abort(),
                this.timeout
            );

            try {
                const response = await fetch(url, {
                    method: "GET",
                    credentials: new URL(url).origin === location.origin
                        ? "same-origin"
                        : "omit",
                    mode: "cors",
                    redirect: "manual",
                    cache: "no-store",
                    signal: controller.signal
                });

                if (!response.ok) return null;

                const finalUrl = new URL(response.url);

                if (!this.isAllowedHost(finalUrl.hostname)) {
                    return null;
                }

                const contentType =
                    response.headers.get("content-type") || "";

                if (!contentType.includes("text/html")) return null;

                const html = await response.text();

                return {
                    status: response.status,
                    url: response.url,
                    html: html.substring(0, this.maxResponseSize)
                };
            } finally {
                clearTimeout(timer);
            }
        }

        analyzePage(html, target) {
            if (!html || html.length < 30) {
                return { detected: false };
            }

            const doc = new DOMParser().parseFromString(
                html,
                "text/html"
            );

            const title = doc.title || "";

            const bodyText = doc.body
                ? doc.body.innerText || doc.body.textContent || ""
                : "";

            const combined = (
                title + " " + bodyText
            ).toLowerCase();

            const indicators = [];

            const adminKeywords = [
                "admin dashboard",
                "administrator",
                "administration",
                "admin panel",
                "admin console",
                "control panel",
                "management dashboard",
                "manage users",
                "user management",
                "site administration",
                "system administration",
                "backend dashboard",
                "back office"
            ];

            for (const keyword of adminKeywords) {
                if (combined.includes(keyword)) {
                    indicators.push(keyword);
                }
            }

            const hasPasswordField = !!doc.querySelector(
                'input[type="password"]'
            );

            const hasLoginForm = !!doc.querySelector(
                'form input[type="password"]'
            );

            const hasAdminPath =
                /admin|administrator|adminpanel|admincp|backend|backoffice|controlpanel|dashboard|console/i
                    .test(target.path);

            const isAdminHost =
                target.host.toLowerCase().startsWith("admin.");

            const hasLoginIndicators =
                /sign in|log in|login|authentication|password/i
                    .test(combined);

            if (hasPasswordField) {
                indicators.push("Password Input");
            }

            if (hasLoginForm) {
                indicators.push("Login Form");
            }

            if (hasLoginIndicators) {
                indicators.push("Login-related Text");
            }

            const hasAdminKeywords = indicators.some(item =>
                adminKeywords.includes(item)
            );

            const adminInterface =
                hasAdminKeywords &&
                (hasAdminPath || isAdminHost);

            const adminLogin =
                hasPasswordField &&
                hasLoginIndicators &&
                (hasAdminPath || isAdminHost);

            if (!adminInterface && !adminLogin) {
                return {
                    detected: false
                };
            }

            return {
                detected: true,
                title: title || "Admin Interface",
                type: adminLogin
                    ? "Admin Login"
                    : "Admin Interface",
                indicators: [...new Set(indicators)]
            };
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
                            scannedAt: new Date().toISOString(),
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
    }

    Framework.register(
        AdminPanelViewer.id,
        AdminPanelViewer
    );

})(Framework);
