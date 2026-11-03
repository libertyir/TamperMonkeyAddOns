(function (Framework) {
    "use strict";

    class GitConfigViewer extends Framework.BaseModule {

        static id = "GitConfig_Viewer";
        static title = "Git Config Viewer";
        static description = "Inspect exposed Git configuration";
        static icon = "⑂";
        static scanPolicy = {
            scope: "origin-root",
            defaultTTL: "7d"
        };

        constructor() {
            super();

            this.content = "";
            this.fileUrl = null;
            this.scannedAt = null;
            this.error = null;
        }

        getMetadata() {
            return {
                id: GitConfigViewer.id,
                title: GitConfigViewer.title,
                description: GitConfigViewer.description,
                icon: GitConfigViewer.icon
            };
        }

        async init() {
            this.available = false;
            this.content = "";
            this.error = null;
            this.scannedAt = new Date().toISOString();

            this.fileUrl = new URL(
                "/.git/config",
                window.location.origin
            ).href;

            try {
                const content = await Framework.requestText(this.fileUrl);

                if (!content || content.length > 262144) {
                    return;
                }

                if (
                    !/^\s*\[[^\]]+\]/m.test(content) ||
                    !/^\s*[\w.-]+\s*=/m.test(content)
                ) {
                    return;
                }

                this.content = content;
                this.available = true;

            } catch (error) {
                this.error = error;
                console.warn("[Git Config Viewer]", error);
            }
        }

        getResult() {
            if (!this.available) {
                return null;
            }

            return {
                page: window.location.href,
                fileUrl: this.fileUrl,
                fileName: ".git/config",
                scannedAt: this.scannedAt,
                contentLength: this.content.length,
                content: this.content
            };
        }

        restoreResult(data) {
            if (
                !data ||
                typeof data.content !== "string" ||
                typeof data.fileUrl !== "string" ||
                data.fileName !== ".git/config"
            ) {
                return false;
            }

            try {
                const fileUrl = new URL(data.fileUrl);

                if (
                    fileUrl.origin !== window.location.origin ||
                    fileUrl.pathname !== "/.git/config"
                ) {
                    return false;
                }

                if (
                    !/^\s*\[[^\]]+\]/m.test(data.content) ||
                    !/^\s*[\w.-]+\s*=/m.test(data.content)
                ) {
                    return false;
                }

                if (data.content.length > 262144) {
                    return false;
                }

                this.content = data.content;
                this.fileUrl = fileUrl.href;
                this.scannedAt = data.scannedAt || null;
                this.available = true;

                return true;

            } catch (error) {
                return false;
            }
        }

        render() {
            const container = Framework.createElement("div");

            const heading = Framework.createElement("h2", {
                textContent: "Git Configuration"
            });

            const description = Framework.createElement("p", {
                textContent: "Exposed .git/config file contents."
            });

            const fileLink = Framework.createElement("a", {
                href: this.fileUrl,
                target: "_blank",
                rel: "noopener noreferrer",
                textContent: "Open raw config file"
            });

            const copyButton = Framework.createElement("button", {
                type: "button",
                textContent: "Copy Config"
            });

            copyButton.addEventListener("click", () => {
                Framework.copy(this.content);
                copyButton.textContent = "Copied";
            });

            const contentBox = Framework.createElement("pre", {
                style: [
                    "white-space:pre-wrap",
                    "overflow-wrap:anywhere",
                    "padding:15px",
                    "margin-top:15px",
                    "background:#101010",
                    "border:1px solid #444",
                    "border-radius:5px",
                    "color:#ddd",
                    "font-size:13px"
                ].join(";")
            });

            this.renderConfigContent(contentBox);

            container.append(
                heading,
                description,
                fileLink,
                document.createTextNode(" "),
                copyButton,
                contentBox
            );

            return container;
        }

        renderConfigContent(container) {
            const urlPattern = /https?:\/\/[^\s"'<>]+/gi;

            let lastIndex = 0;
            let match;

            while ((match = urlPattern.exec(this.content)) !== null) {
                const start = match.index;
                const rawUrl = match[0];

                const trailingMatch = rawUrl.match(/[),.;]+$/);
                const trailing = trailingMatch
                    ? trailingMatch[0]
                    : "";

                const url = trailing
                    ? rawUrl.slice(0, -trailing.length)
                    : rawUrl;

                container.appendChild(
                    document.createTextNode(
                        this.content.slice(lastIndex, start)
                    )
                );

                const link = Framework.createElement("a", {
                    href: url,
                    target: "_blank",
                    rel: "noopener noreferrer",
                    textContent: url
                });

                container.appendChild(link);

                if (trailing) {
                    container.appendChild(
                        document.createTextNode(trailing)
                    );
                }

                lastIndex = start + rawUrl.length;
            }

            container.appendChild(
                document.createTextNode(
                    this.content.slice(lastIndex)
                )
            );
        }

        destroy() {
            this.content = "";
        }
    }

    Framework.register(
        GitConfigViewer.id,
        GitConfigViewer
    );

})(Framework);