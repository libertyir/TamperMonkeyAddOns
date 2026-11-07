(function(Framework){"use strict";class AdminPanelViewerScanner extends Framework.BaseModule{
        static id = "AdminPanel_Scanner";
        static title = "Admin Panel Viewer";
        static description = "Discover administrative interfaces on the current domain";
        static icon = "🔐";

        static scanPolicy = {
            scope: "origin-root",
            defaultTTL: "7d"
        };


        getResult() {
            return {
                page: location.href,
                scannedAt: this.scannedAt || new Date().toISOString(),
                results: this.results.map(result => ({
                    ...result,
                    indicators: [...result.indicators]
                }))
            };
        }

        async runScan() {
            this.available = false;
            this.results = [];

            const targets = this.getTargets();

            let index = 0;
            let scanFailed = false;

            const worker = async () => {
                while (index < targets.length) {
                    const target = targets[index++];

                    try {
                        const result = await this.checkTarget(target);

                        if (result) {
                            this.results.push(result);
                        }
                    } catch (error) {
                        scanFailed = true;
                    }
                }
            };

            const workers = Array.from(
                { length: 4 },
                () => worker()
            );

            await Promise.all(workers);

            if (scanFailed) {
                this.results = [];
                throw new Error(
                    "Admin panel scan was incomplete due to network errors."
                );
            }

            this.results.sort((a, b) =>
                a.url.localeCompare(b.url)
            );

            this.scannedAt = new Date().toISOString();
            this.available = this.results.length > 0;
        }

        async checkTarget(target) {
            const startedAt = performance.now();

            // HEAD is sufficient to identify whether the admin subdomain responds.
            const headResponse = await this.requestPage(target.url, "HEAD");

            if (!headResponse) return null;

            const finalUrl = new URL(headResponse.url);

            // Never accept redirects outside the current host and its admin subdomain.
            if (!this.isAllowedHost(finalUrl.hostname)) {
                return null;
            }

            const responseTimeAfterHead = Math.round(
                performance.now() - startedAt
            );

            if (target.rootOnly) {
                if (headResponse.status < 200 || headResponse.status >= 600) {
                    return null;
                }

                return {
                    url: headResponse.url,
                    requestedUrl: target.url,
                    host: target.host,
                    path: target.path,
                    source: target.source,
                    status: headResponse.status,
                    responseTime: responseTimeAfterHead,
                    title: "Admin Subdomain",
                    type: "Admin Subdomain",
                    indicators: ["Admin subdomain responded to HTTP HEAD"]
                };
            }

            let responseData = null;

            // Some servers do not implement HEAD. Fall back to GET only in that case.
            if (headResponse.status === 405 || headResponse.status === 501) {
                responseData = await this.requestPage(target.url, "GET");
            } else {
                if (headResponse.status < 200 || headResponse.status >= 300) {
                    return null;
                }

                const contentType = (headResponse.contentType || "").toLowerCase();

                // Avoid downloading non-HTML resources. Empty content-type is allowed
                // because some servers omit it from HEAD responses.
                if (contentType && !contentType.includes("text/html") &&
                    !contentType.includes("application/xhtml+xml")) {
                    return null;
                }

                responseData = await this.requestPage(target.url, "GET");
            }

            if (!responseData) return null;

            const finalGetUrl = new URL(responseData.url);

            if (!this.isAllowedHost(finalGetUrl.hostname)) {
                return null;
            }

            const analysis = this.analyzePage(responseData.html, target);

            if (!analysis.detected) return null;

            return {
                url: responseData.url,
                requestedUrl: target.url,
                host: target.host,
                path: target.path,
                source: target.source,
                status: responseData.status,
                responseTime: Math.round(performance.now() - startedAt),
                title: analysis.title,
                type: analysis.type,
                indicators: analysis.indicators
            };
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

        isAllowedHost(hostname) {
            return this.getAllowedHosts().includes(
                hostname.toLowerCase()
            );
        }

        getAllowedHosts() {
            const currentHost = location.hostname.toLowerCase();

            return [
                currentHost,
                "admin." + currentHost
            ];
        }

        requestPage(url, method = "GET") {
            return new Promise((resolve, reject) => {
                if (typeof GM_xmlhttpRequest !== "function") {
                    // Fetch cannot reliably read a cross-origin admin subdomain
                    // unless the target server explicitly allows CORS.
                    if (new URL(url).origin !== location.origin) {
                        reject(new Error(
                            "Cross-origin request requires GM_xmlhttpRequest."
                        ));
                        return;
                    }

                    this.fetchPage(url, method).then(resolve).catch(reject);
                    return;
                }

                GM_xmlhttpRequest({
                    method: method,
                    url: url,
                    timeout: this.timeout,
                    headers: {
                        "Accept": "text/html"
                    },
                    onload: response => {
                        if (
                            !response.status ||
                            response.status < 100 ||
                            response.status >= 600
                        ) {
                            reject(new Error(
                                "Invalid HTTP response status."
                            ));
                            return;
                        }

                        const finalUrl = response.finalUrl || url;

                        try {
                            if (!this.isAllowedHost(new URL(finalUrl).hostname)) {
                                resolve(null);
                                return;
                            }
                        } catch (error) {
                            resolve(null);
                            return;
                        }

                        const headers = response.responseHeaders || "";
                        const contentTypeMatch = headers.match(
                            /^content-type:\s*([^\r\n]+)/im
                        );

                        resolve({
                            status: response.status,
                            url: finalUrl,
                            contentType: contentTypeMatch
                                ? contentTypeMatch[1].trim()
                                : "",
                            html: method === "HEAD"
                                ? ""
                                : (response.responseText || "").substring(
                                    0,
                                    this.maxResponseSize
                                )
                        });
                    },
                    onerror: () => reject(
                        new Error("Network request failed.")
                    ),
                    ontimeout: () => reject(
                        new Error("Network request timed out.")
                    )
                });
            });
        }

        async fetchPage(url, method = "GET") {
            const controller = new AbortController();

            const timer = setTimeout(
                () => controller.abort(),
                this.timeout
            );

            try {
                const response = await Framework.SiteIntelligence.fetch(url, {
                    method: method,
                    credentials: "same-origin",
                    mode: "same-origin",
                    redirect: "follow",
                    cache: "no-store",
                    signal: controller.signal
                });

                if (response.status < 100 || response.status >= 600) {
                    throw new Error("Invalid HTTP response status.");
                }

                const finalUrl = new URL(response.url);

                if (!this.isAllowedHost(finalUrl.hostname)) {
                    return null;
                }

                const contentType =
                    response.headers.get("content-type") || "";

                const html = method === "HEAD"
                    ? ""
                    : (await response.text()).substring(
                        0,
                        this.maxResponseSize
                    );

                return {
                    status: response.status,
                    url: response.url,
                    contentType: contentType,
                    html: html
                };
            } finally {
                clearTimeout(timer);
            }
        }

        getTargets() {
            const currentHost = location.hostname.toLowerCase();
            const protocol = location.protocol;
            const port = location.port
                ? ":" + location.port
                : "";

            const targets = [];

            // Check the admin subdomain first; only its root is required.
            const adminHost = "admin." + currentHost;

            //targets.push({
            //   url: protocol + "//" + adminHost + port + "/",
           //     host: adminHost,
            //    path: "/",
            //    source: "Admin Subdomain",
            //    rootOnly: true
            //});

            // Scan common paths only on the current hostname.
            for (const path of this.getPaths()) {
                targets.push({
                    url: protocol + "//" + currentHost + port + path,
                    host: currentHost,
                    path: path,
                    source: "Current Domain"
                });
            }

            return targets;
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

        constructor(...args) {
            super(...args);
            this.available = false;
            this.results = [];
            this.scannedAt = null;
            this.timeout = 7000;
            this.maxResponseSize = 128 * 1024;
        }
async scan(context={}){await this.runScan(context);if(!this.available)return null;const result=await this.getResult();if(!result||typeof result!=="object")return null;const origin=new URL(context.url||context.currentUrl||location.href).origin;return {...result,directoryUrl:context.directoryUrl||context.scope||origin+"/"};}}
Framework.register(AdminPanelViewerScanner.id,AdminPanelViewerScanner);})(Framework);