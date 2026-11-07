(function(Framework){"use strict";class EnvFileViewerScanner extends Framework.BaseModule{

        static id = "EnvFile_Scanner";
        static title = "Environment File";
        static description = "View and download exposed environment files";
        static icon = "🔐";
        static scanPolicy = {
            scope: "origin-root",
            defaultTTL: "7d"
        };


        getResult() {
            if (this.fileContent === null) {
                return null;
            }

            return {
                page: window.location.href,
                fileUrl: this.fileUrl,
                fileName: ".env",
                scannedAt: this.scannedAt,
                contentLength: this.fileContent.length,
                content: this.fileContent
            };
        }

        async runScan() {
            this.available = false;
            this.fileUrl = null;
            this.fileContent = null;
            this.scannedAt = new Date().toISOString();

            const url = new URL("/.env", window.location.origin);

            try {
                const response = await Framework.SiteIntelligence.fetch(url.href, {
                    method: "GET",
                    credentials: "same-origin",
                    redirect: "follow",
                    cache: "no-store"
                });

                if (!response.ok) return;

                const finalUrl = new URL(response.url);

                if (finalUrl.origin !== location.origin) return;

                const content = await response.text();

                if (!content.trim()) return;

                this.fileUrl = finalUrl.href;
                this.fileContent = content;
                this.available = true;

            } catch (error) {
                console.error("[EnvFile Viewer]", error);
            }
        }

        constructor() {
            super();
            this.available = false;
            this.fileUrl = null;
            this.fileContent = null;
            this.scannedAt = null;
        }
async scan(context={}){await this.runScan(context);if(!this.available)return null;const result=await this.getResult();if(!result||typeof result!=="object")return null;const origin=new URL(context.url||context.currentUrl||location.href).origin;return {...result,directoryUrl:context.directoryUrl||context.scope||origin+"/"};}}
Framework.register(EnvFileViewerScanner.id,EnvFileViewerScanner);})(Framework);