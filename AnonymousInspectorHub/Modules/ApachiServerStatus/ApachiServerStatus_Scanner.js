(function(Framework){"use strict";class ApacheServerStatusViewerScanner extends Framework.BaseModule{

        static id = "ApachiServerStatus_Scanner";
        static title = "Apache Server Status";
        static description = "Inspect exposed Apache server status";
        static icon = "🖥️";

        static scanPolicy = {
            scope: "origin-root",
            defaultTTL: "7d"
        };


        destroy() {
            this.content = null;
            this.links = [];
        }

        getResult() {
            if (!this.content) {
                return null;
            }

            return {
                page: window.location.href,
                statusUrl: this.statusUrl,
                scannedAt: this.scannedAt,
                reportText: this.content.body
                    ? this.content.body.innerText || ""
                    : "",
                reportHtml: this.content.body
                    ? this.content.body.innerHTML || ""
                    : "",
                links: [...new Set(this.links)]
            };
        }

        async runScan() {
            this.available = false;

            this.statusUrl = new URL(
                "/server-status",
                window.location.origin
            ).href;

            try {
                const response = await Framework.SiteIntelligence.fetch(this.statusUrl, {
                    method: "GET",
                    credentials: "same-origin",
                    redirect: "follow",
                    cache: "no-store"
                });

                if (!response.ok) {
                    return;
                }

                const html = await response.text();

                if (!html || html.length > 5 * 1024 * 1024) {
                    return;
                }

                const parser = new DOMParser();
                const parsed = parser.parseFromString(
                    html,
                    "text/html"
                );

                if (!this.isApacheStatus(parsed)) {
                    return;
                }

                this.content = parsed;
                this.statusUrl = response.url || this.statusUrl;
                this.scannedAt = new Date().toISOString();
                this.available = true;

            } catch (error) {
                this.error = error;
                console.warn("[Apache Server Status]", error);
            }
        }

        isApacheStatus(doc) {
            const title = doc.title || "";

            const bodyText = (
                doc.body ? doc.body.textContent : ""
            ) || "";

            const normalizedTitle = title.toLowerCase();

            const titleMatch =
                normalizedTitle.includes("apache server status");

            const contentPatterns = [
                /server uptime\s*:/i,
                /total accesses\s*:/i,
                /total traffic\s*:/i,
                /requests currently being processed/i,
                /scoreboard/i,
                /apache server status/i
            ];

            return titleMatch ||
                contentPatterns.some(pattern =>
                    pattern.test(bodyText)
                );
        }

        constructor() {
            super();

            this.content = null;
            this.statusUrl = null;
            this.links = [];
            this.scannedAt = null;
        }
async scan(context={}){await this.runScan(context);if(!this.available)return null;const result=await this.getResult();if(!result||typeof result!=="object")return null;const origin=new URL(context.url||context.currentUrl||location.href).origin;return {...result,directoryUrl:context.directoryUrl||context.scope||origin+"/"};}}
Framework.register(ApacheServerStatusViewerScanner.id,ApacheServerStatusViewerScanner);})(Framework);