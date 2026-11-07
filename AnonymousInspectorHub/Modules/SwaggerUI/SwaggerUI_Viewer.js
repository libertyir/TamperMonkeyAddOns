(function(Framework){"use strict";class SwaggerUIView extends Framework.BaseModule{

        static id = "SwaggerUI_Viewer";
        static title = "Swagger UI";
        static description = "Open exposed Swagger API documentation";
        static icon = "📘";

        static scanPolicy = {
            scope: "origin-root",
            defaultTTL: "7d"
        };


static providerId="SwaggerUI_Provider";async init(context={}){const result=context&&context.result;this.available=Boolean(result&&this.restoreResult(result,context));}
        render() {
            if (this.swaggerUrl) {
                window.open(
                    this.swaggerUrl,
                    "_blank",
                    "noopener,noreferrer"
                );
            }

            return null;
        }

        restoreResult(data) {
            if (
                !data ||
                typeof data.swaggerUrl !== "string"
            ) {
                return false;
            }

            try {
                const url = new URL(data.swaggerUrl);

                if (url.origin !== window.location.origin) {
                    return false;
                }

                this.swaggerUrl = url.href;
                this.scannedAt = data.scannedAt || null;
                this.available = true;

                return true;

            } catch (error) {
                return false;
            }
        }

        getMetadata() {
            return {
                id: SwaggerUIView.id,
                title: SwaggerUIView.title,
                description: SwaggerUIView.description,
                icon: SwaggerUIView.icon
            };
        }

        constructor() {
            super();
            this.swaggerUrl = null;
            this.scannedAt = null;
            this.timeout = 7000;
        }
}Framework.register(SwaggerUIView.id,SwaggerUIView);})(Framework);