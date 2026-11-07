(function(Framework){"use strict";class ApiDocsViewerScanner extends Framework.BaseModule{
        static id = "ApiDocs_Scanner";
        static title = "API Docs Viewer";
        static description = "Discover API documentation platforms and interfaces";
        static icon = "📚";
        static scanPolicy = {
            scope: "origin-root",
            defaultTTL: "7d"
        };


        getResult() {
            return {
                page: location.href,
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
                "api-docs",
                "api-docs/",
                "api/documentation",
                "api/documentation/",
                "api-reference",
                "api-reference/",
                "api/reference",
                "api/reference/",
                "developer",
                "developer/",
                "developers",
                "developers/",
                "api",
                "api/",
                "apidocs",
                "apidocs/",
                "reference",
                "reference/",
                "documentation",
                "documentation/",
                "docs/api",
                "docs/api/",
                "docs/reference",
                "docs/reference/",
                "developers/api",
                "developers/api/",
                "docs"
            ];

            const base = new URL("/", location.origin);
            const checked = new Set();

            for (const path of paths) {
                const url = new URL(path, base);

                if (url.origin !== location.origin) continue;
                if (checked.has(url.href)) continue;

                checked.add(url.href);

                try {
                    const response = await Framework.SiteIntelligence.fetch(url.href, {
                        method: "GET",
                        credentials: "same-origin",
                        cache: "no-store",
                        redirect: "follow"
                    });

                    if (!response.ok) continue;

                    const finalUrl = new URL(response.url);

                    if (finalUrl.origin !== location.origin) continue;

                    const contentType =
                        response.headers.get("content-type") || "";

                    if (!contentType.includes("text/html")) continue;

                    const html = await response.text();

                    if (!html || html.length > 5 * 1024 * 1024) {
                        continue;
                    }

                    const detection = this.detectPlatform(html);

                    if (!detection) continue;

                    if (this.foundPages.some(
                        item => item.url === finalUrl.href
                    )) {
                        continue;
                    }

                    this.foundPages.push({
                        url: finalUrl.href,
                        path,
                        title: this.extractTitle(html),
                        platform: detection.platform,
                        indicators: detection.indicators
                    });

                    this.available = true;

                } catch (error) {
                    // Ignore inaccessible paths.
                }
            }
        }

        extractTitle(html) {
            const match = html.match(
                /<title[^>]*>([\s\S]*?)<\/title>/i
            );

            if (!match) return "API Documentation";

            return match[1]
                .replace(/<[^>]+>/g, "")
                .replace(/&amp;/g, "&")
                .replace(/&lt;/g, "<")
                .replace(/&gt;/g, ">")
                .replace(/&quot;/g, '"')
                .trim() || "API Documentation";
        }

        detectPlatform(html) {
            const platforms = [
                {
                    name: "Stoplight Elements",
                    patterns: [
                        /elements-api(?:\.min)?\.js/i,
                        /@stoplight\/elements/i,
                        /<elements-api(?:\s|>)/i,
                        /stoplight\.io\/elements/i
                    ]
                },
                {
                    name: "RapiDoc",
                    patterns: [
                        /<rapi-doc(?:\s|>)/i,
                        /rapidoc-min\.js/i,
                        /@rapidoc\/rapidoc/i
                    ]
                },
                {
                    name: "ReadMe",
                    patterns: [
                        /readme\.com/i,
                        /readme-api/i,
                        /readme-io/i,
                        /rdme/i
                    ]
                },
                {
                    name: "Slate",
                    patterns: [
                        /slate-api/i,
                        /slate\.css/i,
                        /slate-logo/i,
                        /slate documentation/i
                    ]
                },
                {
                    name: "Apiary",
                    patterns: [
                        /apiary\.io/i,
                        /apiary\.js/i,
                        /apiary-documentation/i
                    ]
                },
                {
                    name: "Fern",
                    patterns: [
                        /buildwithfern\.com/i,
                        /fern-api/i,
                        /fern-docs/i
                    ]
                },
                {
                    name: "Mintlify",
                    patterns: [
                        /mintlify/i,
                        /mintlify\.com/i,
                        /mintlify\/components/i
                    ]
                }
            ];

            for (const platform of platforms) {
                const matched = platform.patterns.filter(
                    pattern => pattern.test(html)
                );

                if (matched.length > 0) {
                    return {
                        platform: platform.name,
                        indicators: matched.map(
                            pattern => pattern.toString()
                        )
                    };
                }
            }

            return null;
        }

        constructor() {
            super();
            this.available = false;
            this.foundPages = [];
            this.scannedAt = null;
        }
async scan(context={}){await this.runScan(context);if(!this.available)return null;const result=await this.getResult();if(!result||typeof result!=="object")return null;const origin=new URL(context.url||context.currentUrl||location.href).origin;return {...result,directoryUrl:context.directoryUrl||context.scope||origin+"/"};}}
Framework.register(ApiDocsViewerScanner.id,ApiDocsViewerScanner);})(Framework);