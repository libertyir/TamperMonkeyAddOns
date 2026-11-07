(function(Framework){"use strict";class EnvFileViewer extends Framework.BaseModule{

        static id = "EnvFile_Viewer";
        static title = "Environment File";
        static description = "View and download exposed environment files";
        static icon = "🔐";
        static scanPolicy = {
            scope: "origin-root",
            defaultTTL: "7d"
        };


static providerId="EnvFile_Provider";async init(context={}){const result=context&&context.result;this.available=Boolean(result&&this.restoreResult(result,context));}
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

        restoreResult(data) {
            if (
                !data ||
                typeof data.fileUrl !== "string" ||
                typeof data.content !== "string" ||
                data.fileName !== ".env"
            ) {
                return false;
            }

            try {
                const fileUrl = new URL(data.fileUrl);

                if (
                    fileUrl.origin !== location.origin ||
                    fileUrl.pathname !== "/.env"
                ) {
                    return false;
                }

                this.fileUrl = fileUrl.href;
                this.fileContent = data.content;
                this.scannedAt = data.scannedAt || null;
                this.available = true;

                return true;

            } catch (error) {
                return false;
            }
        }

        getMetadata() {
            return {
                id: EnvFileViewer.id,
                title: EnvFileViewer.title,
                description: EnvFileViewer.description,
                icon: EnvFileViewer.icon
            };
        }

        constructor() {
            super();
            this.available = false;
            this.fileUrl = null;
            this.fileContent = null;
            this.scannedAt = null;
        }
}Framework.register(EnvFileViewer.id,EnvFileViewer);})(Framework);