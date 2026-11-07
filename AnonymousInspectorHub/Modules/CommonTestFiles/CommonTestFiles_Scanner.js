(function(Framework){"use strict";class CommonTestFilesViewerScanner extends Framework.BaseModule{

        static id = "CommonTestFiles_Scanner";
        static title = "Common Test Files";
        static description = "Find common test pages and files";
        static icon = "🧪";
        static scanPolicy = {
            scope: "origin-root",
            defaultTTL: "7d"
        };


        destroy() {
            this.foundFiles = [];
        }

        getResult() {
            return {
                page: window.location.href,
                scannedAt: this.scannedAt,
                totalFound: this.foundFiles.length,
                foundFiles: this.foundFiles.map(file => ({
                    path: file.path,
                    url: file.url
                }))
            };
        }

        async runScan() {
            this.available = false;
            this.foundFiles = [];
            this.scannedAt = new Date().toISOString();

            const base = new URL("/", window.location.origin);

            const candidates = [
                "test.php",
                "test.aspx",
                "test",
                "test.html",
                "test.asp",
                "testing.php",
                "test/index.html",
                "index2.php",
                "index3.php",
                "index2.aspx",
                "index3.aspx"
            ];

            // Sequential HEAD requests to avoid unnecessary server load.
            for (const path of candidates) {
                const url = new URL(path, base);

                if (url.origin !== window.location.origin) {
                    continue;
                }

                try {
                    const response = await Framework.SiteIntelligence.fetch(url.href, {
                        method: "HEAD",
                        credentials: "same-origin",
                        redirect: "follow",
                        cache: "no-store"
                    });

                    if (
                        response.status >= 200 &&
                        response.status < 300 &&
                        new URL(response.url).origin === window.location.origin
                    ) {
                        this.foundFiles.push({
                            path,
                            url: response.url
                        });
                    }

                } catch (error) {
                    // Unavailable paths are ignored.
                }
            }

            this.available = this.foundFiles.length > 0;
        }

        constructor() {
            super();
            this.foundFiles = [];
            this.scannedAt = null;
        }
async scan(context={}){await this.runScan(context);if(!this.available)return null;const result=await this.getResult();if(!result||typeof result!=="object")return null;const origin=new URL(context.url||context.currentUrl||location.href).origin;return {...result,directoryUrl:context.directoryUrl||context.scope||origin+"/"};}}
Framework.register(CommonTestFilesViewerScanner.id,CommonTestFilesViewerScanner);})(Framework);