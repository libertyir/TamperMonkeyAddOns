(function (Framework) {
    "use strict";

    class GitConfigViewer extends Framework.BaseModule {

        static id = "GitConfig_Viewer";
        static title = "Git Config Viewer";
        static description = "Inspect exposed Git configuration";
        static icon = "⑂";
        static providerId = "GitConfig_Provider";
constructor() {
            super();

            this.content = "";
            this.fileUrl = null;
            this.scannedAt = null;
        }

        getMetadata() {
            return {
                id: GitConfigViewer.id,
                title: GitConfigViewer.title,
                description: GitConfigViewer.description,
                icon: GitConfigViewer.icon
            };
        }

        async init(context = {}) {
            const result = context.result;
            if (!result || typeof result.content !== "string" ||
                typeof result.fileUrl !== "string" || result.fileName !== ".git/config" ||
                result.content.length > 262144) {
                this.available = false;
                return;
            }
            try {
                const fileUrl = new URL(result.fileUrl);
                const expectedOrigin = new URL(context.url || window.location.href).origin;
                if (fileUrl.origin !== expectedOrigin || fileUrl.pathname !== "/.git/config" ||
                    !/^\s*\[[^\]]+\]/m.test(result.content) ||
                    !/^\s*[\w.-]+\s*=/m.test(result.content)) {
                    this.available = false;
                    return;
                }
                this.content = result.content;
                this.fileUrl = fileUrl.href;
                this.scannedAt = result.scannedAt || null;
                this.available = true;
            } catch {
                this.available = false;
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

            const checkButton = Framework.createElement("button", {
                type: "button",
                textContent: "Check GitHub Connection",
                style: "margin-left:8px"
            });

            const checkResult = Framework.createElement("div", {
                role: "status",
                "aria-live": "polite",
                style: "margin:10px 0;white-space:pre-wrap"
            });

            const repositories = this.getGitHubRepositories();
            checkButton.disabled = repositories.length === 0;
            if (!repositories.length) {
                checkResult.textContent = "No GitHub remote URL was found in this config.";
            }

            checkButton.addEventListener("click", async () => {
                checkButton.disabled = true;
                checkResult.textContent = "Checking GitHub access…";
                try {
                    const results = await Promise.all(repositories.map(async repository => {
                        const response = await Framework.requestText(
                            "https://api.github.com/repos/" +
                            encodeURIComponent(repository.owner) + "/" +
                            encodeURIComponent(repository.name)
                        );

                        if (typeof response !== "string") {
                            return repository.owner + "/" + repository.name +
                                ": unavailable, private, or authentication is required.";
                        }

                        let data;
                        try {
                            data = JSON.parse(response);
                        } catch {
                            return repository.owner + "/" + repository.name +
                                ": GitHub returned an unreadable response.";
                        }

                        if (!data || !data.full_name) {
                            return repository.owner + "/" + repository.name +
                                ": GitHub did not confirm this repository.";
                        }

                        return [
                            "Access OK: " + data.full_name,
                            "Title: " + (data.name || data.full_name),
                            "Visibility: " + (data.private ? "private" : "public"),
                            "Description: " + (data.description || "(none)"),
                            "URL: " + (data.html_url || repository.url)
                        ].join("\n");
                    }));
                    checkResult.textContent = results.join("\n\n");
                } catch (error) {
                    checkResult.textContent = "GitHub check failed: " +
                        (error && error.message ? error.message : String(error));
                } finally {
                    checkButton.disabled = false;
                }
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
                checkButton,
                checkResult,
                contentBox
            );

            return container;
        }

        getGitHubRepositories() {
            const repositories = new Map();
            const remoteSection = /^\s*\[remote\s+"[^"]+"\]\s*$([\s\S]*?)(?=^\s*\[|$(?![\s\S]))/gim;
            let section;

            while ((section = remoteSection.exec(this.content)) !== null) {
                const urlMatch = section[1].match(/^\s*url\s*=\s*(.*?)\s*$/im);
                if (!urlMatch) continue;

                const raw = urlMatch[1].replace(/^['"]|['"]$/g, "");
                let match = raw.match(/^(?:https?:\/\/|git:\/\/)(?:[^/@]+@)?github\.com\/([^/]+)\/([^/#?]+?)(?:\.git)?\/?(?:[#?].*)?$/i);
                if (!match) {
                    match = raw.match(/^(?:[^@/]+@)?github\.com:([^/]+)\/([^/#?]+?)(?:\.git)?\/?$/i);
                }
                if (!match) continue;

                const owner = match[1];
                const name = match[2];
                if (!owner || !name || owner.includes("%") || name.includes("%")) continue;
                repositories.set(owner.toLowerCase() + "/" + name.toLowerCase(), {
                    owner,
                    name,
                    url: "https://github.com/" + owner + "/" + name
                });
            }

            return [...repositories.values()];
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
