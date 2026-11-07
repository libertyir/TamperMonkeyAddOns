(function(Framework){"use strict";class SwaggerUIViewScanner extends Framework.BaseModule{

        static id = "SwaggerUI_Scanner";
        static title = "Swagger UI";
        static description = "Open exposed Swagger API documentation";
        static icon = "📘";

        static scanPolicy = {
            scope: "origin-root",
            defaultTTL: "7d"
        };


        getResult() {
            if (!this.available || !this.swaggerUrl) {
                return null;
            }

            return {
                page: window.location.href,
                scannedAt: this.scannedAt,
                swaggerUrl: this.swaggerUrl
            };
        }

        async runScan() {
            this.available = false;
            this.swaggerUrl = null;
            this.scannedAt = new Date().toISOString();

            const base = new URL("/", window.location.origin);

            const paths = [
                "swagger",
                "swagger/",
                "swagger/index.html",
                "swagger-ui",
                "swagger-ui/",
                "swagger-ui/index.html",
                "swagger-ui.html",
                "api/swagger",
                "api/swagger/",
                "api/swagger/index.html",
                "api/swagger-ui",
                "api/swagger-ui/",
                "api/swagger-ui/index.html",
                "api/docs",
                "docs",
                "api-docs"
            ];

            for (const path of paths) {
                const url = new URL(path, base).href;

                if (await this.checkHead(url)) {
                    this.swaggerUrl = url;
                    this.available = true;
                    return;
                }
            }
        }

        async checkHead(url) {
            const controller = new AbortController();

            const timer = setTimeout(
                () => controller.abort(),
                this.timeout
            );

            try {
                const response = await Framework.SiteIntelligence.fetch(url, {
                    method: "HEAD",
                    credentials: "same-origin",
                    redirect: "follow",
                    cache: "no-store",
                    signal: controller.signal
                });

                const finalUrl = new URL(response.url);

                if (finalUrl.origin !== window.location.origin) {
                    throw new Error(
                        "Redirected outside the current origin."
                    );
                }

                // Server errors are inconclusive and must not be cached.
                if (response.status >= 500) {
                    throw new Error(
                        `HTTP server error: ${response.status}`
                    );
                }

                if (!response.ok) {
                    return false;
                }

                const contentType = (
                    response.headers.get("content-type") || ""
                ).toLowerCase();

                const finalPath = finalUrl.href.toLowerCase();

                return (
                    contentType.includes("text/html") ||
                    finalPath.includes("swagger")
                );

            } finally {
                clearTimeout(timer);
            }
        }

        constructor() {
            super();
            this.swaggerUrl = null;
            this.scannedAt = null;
            this.timeout = 7000;
        }
async scan(context={}){await this.runScan(context);if(!this.available)return null;const result=await this.getResult();if(!result||typeof result!=="object")return null;const origin=new URL(context.url||context.currentUrl||location.href).origin;return {...result,directoryUrl:context.directoryUrl||context.scope||origin+"/"};}}
Framework.register(SwaggerUIViewScanner.id,SwaggerUIViewScanner);})(Framework);