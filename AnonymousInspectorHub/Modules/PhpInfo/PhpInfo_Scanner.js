(function(Framework){"use strict";class PhpInfoViewerScanner extends Framework.BaseModule{

        static id = "PhpInfo_Scanner";
        static title = "PHP Info Viewer";
        static description = "Inspect exposed PHP configuration";
        static icon = "🐘";
        static scanPolicy = {
            scope: "origin-root",
            defaultTTL: "7d"
        };


        destroy() {
            this.content = null;
            this.links = [];
        }

        getResult() {
            if (!this.available || !this.content) {
                return null;
            }

            const text =
                this.content.body.innerText ||
                this.content.body.textContent ||
                "";

            return {
                page: window.location.href,
                fileUrl: this.fileUrl,
                fileName: "phpinfo.php",
                scannedAt: this.scannedAt,
                contentLength: text.length,
                content: text,
                contentHtml: this.content.body.innerHTML,
                links: [...new Set(this.links)]
            };
        }

        async runScan() {
            this.available = false;
            this.content = null;
            this.links = [];
            this.scannedAt = new Date().toISOString();

            this.fileUrl = new URL(
                "/phpinfo.php",
                window.location.origin
            ).href;

            const response = await Framework.SiteIntelligence.fetch(this.fileUrl, {
                method: "GET",
                credentials: "same-origin",
                redirect: "follow",
                cache: "no-store"
            });

            if (!response.ok) {
                if (response.status >= 500) {
                    throw new Error(
                        `PHP Info request failed with HTTP ${response.status}`
                    );
                }

                return;
            }

            const finalUrl = new URL(response.url);

            if (finalUrl.origin !== window.location.origin) {
                return;
            }

            const html = await response.text();

            if (!html || html.length > 10 * 1024 * 1024) {
                return;
            }

            const doc = new DOMParser().parseFromString(
                html,
                "text/html"
            );

            if (!this.isPhpInfo(doc)) {
                return;
            }

            this.content = doc;
            this.fileUrl = finalUrl.href;
            this.available = true;
        }

        isPhpInfo(doc) {
            const body = doc.body;

            if (!body) {
                return false;
            }

            const text = body.innerText || body.textContent || "";

            const hasPhpInfoTitle =
                /phpinfo\(\)/i.test(doc.title) ||
                /phpinfo\(\)/i.test(text);

            const hasPhpVersion =
                /php version\s+\d+\.\d+/i.test(text);

            const hasConfiguration =
                /configuration file|php extension|loaded configuration file/i.test(text);

            const hasPhpInfoTable =
                !!doc.querySelector(
                    "table.phpinfo, table.center, .center table"
                );

            return hasPhpInfoTitle &&
                hasPhpVersion &&
                (hasConfiguration || hasPhpInfoTable);
        }

        constructor() {
            super();

            this.content = null;
            this.fileUrl = null;
            this.links = [];
            this.scannedAt = null;
        }
async scan(context={}){await this.runScan(context);if(!this.available)return null;const result=await this.getResult();if(!result||typeof result!=="object")return null;const origin=new URL(context.url||context.currentUrl||location.href).origin;return {...result,directoryUrl:context.directoryUrl||context.scope||origin+"/"};}}
Framework.register(PhpInfoViewerScanner.id,PhpInfoViewerScanner);})(Framework);