(function(Framework){"use strict";class ScalarViewerScanner extends Framework.BaseModule{
        static id = "Scalar_Scanner";
        static title = "Scalar Viewer";
        static description = "Discover Scalar API documentation interfaces";
        static icon = "◈";
        static scanPolicy = {
            scope: "origin-root",
            defaultTTL: "7d"
        };


        getResult() {
            if (!this.available || !this.foundPages.length) {
                return null;
            }

            return {
                page: window.location.href,
                scannedAt: this.scannedAt,
                totalFound: this.foundPages.length,
                foundPages: this.foundPages.map(page => ({
                    ...page,
                    indicators: [...page.indicators]
                }))
            };
        }

        async runScan() {
            this.available = false;
            this.foundPages = [];
            this.scannedAt = new Date().toISOString();

            const paths = [
                "scalar",
                "scalar/",
                "scalar.html",
                "scalar/index.html",
                "api/scalar",
                "api/scalar/",
                "api/reference",
                "api/reference/",
                "reference",
                "reference/",
                "api-docs",
                "api-docs/",
                "docs",
                "docs/",
                "documentation",
                "documentation/"
            ];

            const base = new URL("/", location.origin);
            const checked = new Set();

            for (const path of paths) {
                const url = new URL(path, base);

                if (url.origin !== location.origin) continue;
                if (checked.has(url.href)) continue;

                checked.add(url.href);

                const response = await Framework.SiteIntelligence.fetch(url.href, {
                    method: "GET",
                    credentials: "same-origin",
                    cache: "no-store",
                    redirect: "follow"
                });

                if (response.status >= 500) {
                    throw new Error(
                        `Scalar scan failed with HTTP ${response.status}: ${url.href}`
                    );
                }

                if (!response.ok) continue;

                const finalUrl = new URL(response.url);

                if (finalUrl.origin !== location.origin) continue;

                const contentType =
                    response.headers.get("content-type") || "";

                if (!contentType.includes("text/html")) continue;

                const html = await response.text();

                if (!this.isScalarPage(html)) continue;

                if (this.foundPages.some(
                    item => item.url === finalUrl.href
                )) {
                    continue;
                }

                this.foundPages.push({
                    url: finalUrl.href,
                    path,
                    title: this.extractTitle(html),
                    indicators: this.getIndicators(html)
                });

                this.available = true;
            }
        }

        getIndicators(html) {
            const indicators = [];

            const patterns = [
                {
                    name: "Scalar Custom Element",
                    pattern: /<api-reference(?:\s|>)/i
                },
                {
                    name: "Scalar Web Component",
                    pattern: /<scalar-api-reference(?:\s|>)/i
                },
                {
                    name: "Scalar JavaScript Package",
                    pattern: /@scalar\/api-reference|@scalar\/api-client/i
                },
                {
                    name: "Scalar CDN",
                    pattern: /cdn\.scalar\.com/i
                },
                {
                    name: "Scalar Initialization",
                    pattern: /ScalarApiReference\s*\(/i
                },
                {
                    name: "Scalar Configuration",
                    pattern: /scalar\/api-reference/i
                }
            ];

            for (const item of patterns) {
                if (item.pattern.test(html)) {
                    indicators.push(item.name);
                }
            }

            return indicators;
        }

        extractTitle(html) {
            const match = html.match(
                /<title[^>]*>([\s\S]*?)<\/title>/i
            );

            if (!match) return "Scalar API Documentation";

            return match[1]
                .replace(/<[^>]+>/g, "")
                .replace(/&amp;/g, "&")
                .replace(/&lt;/g, "<")
                .replace(/&gt;/g, ">")
                .replace(/&quot;/g, '"')
                .trim() || "Scalar API Documentation";
        }

        isScalarPage(html) {
            if (!html || html.length > 5 * 1024 * 1024) {
                return false;
            }

            const indicators = this.getIndicators(html);

            return indicators.length >= 2;
        }

        constructor() {
            super();
            this.available = false;
            this.foundPages = [];
            this.scannedAt = null;
        }
async scan(context={}){await this.runScan(context);if(!this.available)return null;const result=await this.getResult();if(!result||typeof result!=="object")return null;const origin=new URL(context.url||context.currentUrl||location.href).origin;return {...result,directoryUrl:context.directoryUrl||context.scope||origin+"/"};}}
Framework.register(ScalarViewerScanner.id,ScalarViewerScanner);})(Framework);