(function (Framework) {
    "use strict";

    class EnvFileViewer extends Framework.BaseModule {

        static id = "EnvFile_Viewer";
        static title = "Environment File";
        static description = "View and download exposed environment files";
        static icon = "🔐";

        constructor() {
            super();
            this.fileUrl = null;
            this.fileContent = null;
            this.scannedAt = null;
        }

        getMetadata() {
            return {
                id: EnvFileViewer.id,
                title: EnvFileViewer.title,
                description: EnvFileViewer.description,
                icon: EnvFileViewer.icon
            };
        }

        async init() {
            this.available = false;
            this.fileUrl = null;
            this.fileContent = null;
            this.scannedAt = new Date().toISOString();

            const url = new URL(".env", window.location.href);

            try {
                const response = await fetch(url.href, {
                    method: "GET",
                    credentials: "same-origin",
                    redirect: "follow",
                    cache: "no-store"
                });

                if (!response.ok) return;

                const content = await response.text();

                if (!content.trim()) return;

                this.fileUrl = response.url || url.href;
                this.fileContent = content;
                this.available = true;

            } catch (error) {
                console.error("[EnvFile Viewer]", error);
            }
        }

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

        render() {
            const container = Framework.createElement("div");

            const heading = Framework.createElement("h3", {
                textContent: ".env"
            });

            const downloadLink = Framework.createElement("a", {
                textContent: "Download .env",
                href: this.fileUrl,
                download: ".env",
                target: "_blank",
                rel: "noopener noreferrer"
            });

            downloadLink.style.display = "inline-block";
            downloadLink.style.marginBottom = "15px";
            downloadLink.style.color = "#8ab4f8";
            downloadLink.style.cursor = "pointer";

            const content = Framework.createElement("pre", {
                textContent: this.fileContent
            });

            content.style.whiteSpace = "pre-wrap";
            content.style.overflowWrap = "anywhere";
            content.style.padding = "15px";
            content.style.background = "#222";
            content.style.border = "1px solid #444";
            content.style.borderRadius = "6px";
            content.style.color = "#eee";
            content.style.overflowX = "auto";

            container.append(
                heading,
                downloadLink,
                content
            );

            return container;
        }
    }

    Framework.register(
        EnvFileViewer.id,
        EnvFileViewer
    );

})(Framework);