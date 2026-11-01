
(function (Framework) {
    "use strict";

    class EnvFileViewer extends Framework.BaseModule {

        static id = "EnvFile_Viewer";
        static title = ".ENV File";
        static description = "Detect exposed environment configuration";
        static icon = "🔐";

        constructor() {
            super();
            this.fileUrl = null;
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

            this.fileUrl = new URL(
                ".env",
                Framework.getCurrentDirectory()
            ).href;

            try {
                const response = await fetch(this.fileUrl, {
                    method: "HEAD",
                    credentials: "same-origin",
                    redirect: "follow",
                    cache: "no-store"
                });

                if (!response.ok) {
                    return;
                }

                const contentType = (
                    response.headers.get("content-type") || ""
                ).toLowerCase();

                // Reject obvious HTML error or fallback pages.
                if (
                    contentType.includes("text/html") &&
                    response.headers.get("content-length") !== "0"
                ) {
                    return;
                }

                this.available = true;

            } catch (error) {
                this.error = error;
            }
        }

        render() {
            const container = Framework.createElement("div");

            container.appendChild(
                Framework.createElement("h2", {
                    textContent: "Exposed .env File Detected"
                })
            );

            container.appendChild(
                Framework.createElement("p", {
                    textContent:
                        "The .env endpoint responded successfully to a HEAD request."
                })
            );

            container.appendChild(
                Framework.createElement("p", {
                    textContent:
                        "Its contents are hidden because environment files commonly contain passwords, API keys and other secrets.",
                    style: "color:#e0a040;"
                })
            );

            container.appendChild(
                Framework.createElement("p", {
                    textContent: "File path: " + this.fileUrl
                })
            );

            return container;
        }
    }

    Framework.register(
        EnvFileViewer.id,
        EnvFileViewer
    );

})(Framework);
