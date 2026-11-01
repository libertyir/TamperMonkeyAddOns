
(function (Framework) {
    "use strict";

    class SwaggerUIView extends Framework.BaseModule {

        static id = "SwaggerUI_Viewer";
        static title = "Swagger UI";
        static description = "Open exposed Swagger API documentation";
        static icon = "📘";

        constructor() {
            super();

            this.swaggerUrl = null;
        }

        getMetadata() {
            return {
                id: SwaggerUIView.id,
                title: SwaggerUIView.title,
                description: SwaggerUIView.description,
                icon: SwaggerUIView.icon
            };
        }

        async init() {
            this.available = false;

            const base = new URL(
                ".",
                window.location.href
            );

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
            try {
                const response = await fetch(url, {
                    method: "HEAD",
                    credentials: "same-origin",
                    redirect: "follow",
                    cache: "no-store"
                });

                if (!response.ok) {
                    return false;
                }

                const contentType = (
                    response.headers.get("content-type") || ""
                ).toLowerCase();

                const finalUrl = response.url.toLowerCase();

                return (
                    contentType.includes("text/html") ||
                    finalUrl.includes("swagger")
                );

            } catch (error) {
                return false;
            }
        }

        render() {
            window.open(
                this.swaggerUrl,
                "_blank",
                "noopener,noreferrer"
            );

            return null;
        }
    }

    Framework.register(
        SwaggerUIView.id,
        SwaggerUIView
    );

})(Framework);
