(function(Framework){"use strict";class StatusViewerScanner extends Framework.BaseModule{
        static id = "Status_Scanner";
        static title = "HTTP Status Viewer";
        static description = "Inspect HTTP status codes and common public resources";
        static icon = "📡";

        static scanPolicy = {
            scope: "origin-root",
            defaultTTL: "permanent"
        };


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

        async runScan() {
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

                // Network errors and timeouts must fail the scan.
                // They must not become permanently cached status: 0 results.
                const result = await this.checkUrl(url.href);

                this.results.push(result);
            }

            this.available = this.results.length > 0;
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
                const response = await Framework.SiteIntelligence.fetch(url, {
                    method,
                    credentials: "same-origin",
                    cache: "no-store",
                    redirect: "follow",
                    signal: controller.signal
                });

                const finalUrl = new URL(response.url);

                if (finalUrl.origin !== location.origin) {
                    throw new Error(
                        "Redirected outside the current origin."
                    );
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

        constructor() {
            super();
            this.available = false;
            this.results = [];
            this.timeout = 7000;
            this.scannedAt = null;
        }
async scan(context={}){await this.runScan(context);if(!this.available)return null;const result=await this.getResult();if(!result||typeof result!=="object")return null;const origin=new URL(context.url||context.currentUrl||location.href).origin;return {...result,directoryUrl:context.directoryUrl||context.scope||origin+"/"};}}
Framework.register(StatusViewerScanner.id,StatusViewerScanner);})(Framework);