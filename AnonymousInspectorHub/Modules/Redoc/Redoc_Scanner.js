(function(Framework){"use strict";class RedocViewerScanner extends Framework.BaseModule{
        static id = "Redoc_Scanner";
        static title = "ReDoc Viewer";
        static description = "Discover ReDoc API documentation interfaces";
        static icon = "📖";
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
                    ...page
                }))
            };
        }

        async runScan() {
            this.available = false;
            this.foundPages = [];
            this.scannedAt = new Date().toISOString();

            const paths = [
                "redoc",
                "redoc/",
                "redoc.html",
                "redoc/index.html",
                "api/redoc",
                "api/redoc/",
                "api/redoc.html",
                "docs",
                "docs/",
                "api/docs",
                "api/docs/",
                "api-reference",
                "api-reference/",
                "reference",
                "reference/",
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
                        `ReDoc scan failed with HTTP ${response.status}: ${url.href}`
                    );
                }

                if (!response.ok) continue;

                const finalUrl = new URL(response.url);

                if (finalUrl.origin !== location.origin) continue;

                const contentType =
                    response.headers.get("content-type") || "";

                if (!contentType.includes("text/html")) continue;

                const html = await response.text();

                if (!this.isRedocPage(html)) continue;

                if (
                    this.foundPages.some(
                        item => item.url === finalUrl.href
                    )
                ) {
                    continue;
                }

                this.foundPages.push({
                    url: finalUrl.href,
                    path,
                    title: this.extractTitle(html),
                    embedded: this.hasRedocElement(html)
                });

                this.available = true;
            }
        }

        hasRedocElement(html) {
            return /<redoc(?:\s|>)/i.test(html);
        }

        extractTitle(html) {
            const match = html.match(
                /<title[^>]*>([\s\S]*?)<\/title>/i
            );

            if (!match) return "ReDoc Documentation";

            return match[1]
                .replace(/<[^>]+>/g, "")
                .replace(/&amp;/g, "&")
                .replace(/&lt;/g, "<")
                .replace(/&gt;/g, ">")
                .replace(/&quot;/g, '"')
                .trim() || "ReDoc Documentation";
        }

        isRedocPage(html) {
            if (!html || html.length > 5 * 1024 * 1024) {
                return false;
            }

            const hasRedocElement = this.hasRedocElement(html);

            const hasRedocScript =
                /redoc(?:\.standalone)?(?:\.min)?\.js/i.test(html) ||
                /cdn\.redoc\.ly/i.test(html);

            const hasRedocInitialization =
                /Redoc\.init\s*\(/i.test(html) ||
                /<redoc\b/i.test(html);

            return hasRedocElement ||
                (hasRedocScript && hasRedocInitialization);
        }

        constructor() {
            super();
            this.available = false;
            this.foundPages = [];
            this.scannedAt = null;
        }
async scan(context={}){await this.runScan(context);if(!this.available)return null;const result=await this.getResult();if(!result||typeof result!=="object")return null;const origin=new URL(context.url||context.currentUrl||location.href).origin;return {...result,directoryUrl:context.directoryUrl||context.scope||origin+"/"};}}
Framework.register(RedocViewerScanner.id,RedocViewerScanner);})(Framework);