(function(Framework){"use strict";class ServerInfoViewer extends Framework.BaseModule{
        static id = "ServerInfo_Viewer";
        static title = "Server Info Viewer";
        static description = "Inspect web server headers and technology fingerprints";
        static icon = "🖥";

        static scanPolicy = {
            scope: "origin-root",
            defaultTTL: "permanent"
        };


static providerId="ServerInfo_Provider";async init(context={}){const result=context&&context.result;this.available=Boolean(result&&this.restoreResult(result,context));}
        render() {
            const root = Framework.createElement("div", {
                className: "server-info-viewer",
                style: "padding:12px;overflow:auto;max-height:75vh;"
            });

            root.appendChild(
                Framework.createElement("h2", {
                    textContent: "Server Information"
                })
            );

            if (this.error || !this.info) {
                root.appendChild(
                    Framework.createElement("p", {
                        textContent: this.error || "Server information unavailable."
                    })
                );

                return root;
            }

            const info = this.info;

            const general = this.createSection("General Information");

            this.addRow(general, "URL", info.url);
            this.addRow(general, "HTTP Status", `${info.status} ${info.statusText}`);
            this.addRow(general, "Final URL", info.finalUrl);
            this.addRow(general, "Content-Type", info.contentType);

            this.addCopyButton(general, "Copy URL", info.url);

            root.appendChild(general);

            const server = this.createSection("Server Fingerprint");

            this.addRow(server, "Server", info.server);
            this.addRow(server, "X-Powered-By", info.poweredBy);

            this.addRow(
                server,
                "Detected Technologies",
                info.technologies.length
                    ? info.technologies.join(", ")
                    : "No identifiable technology"
            );

            root.appendChild(server);

            const infrastructure = this.createSection("Infrastructure");

            if (!info.infrastructure.length) {
                this.addRow(
                    infrastructure,
                    "Detection",
                    "No known infrastructure signatures found"
                );
            }

            for (const item of info.infrastructure) {
                this.addRow(
                    infrastructure,
                    item.name,
                    item.indicators.join(", ")
                );
            }

            root.appendChild(infrastructure);

            const security = this.createSection("Security Headers");

            for (const item of info.security) {
                this.addRow(
                    security,
                    item.name,
                    item.value || "Missing"
                );
            }

            root.appendChild(security);

            const headers = this.createSection(
                `Response Headers (${Object.keys(info.headers).length})`
            );

            for (const [name, value] of Object.entries(info.headers)) {
                this.addRow(headers, name, value);
            }

            this.addCopyButton(
                headers,
                "Copy All Headers",
                JSON.stringify(info.headers, null, 2)
            );

            root.appendChild(headers);

            return root;
        }

        addCopyButton(container, label, value) {
            const button = Framework.createElement("button", {
                textContent: label,
                style: "margin:4px;padding:6px 10px;cursor:pointer;"
            });

            button.addEventListener("click", () => {
                Framework.copy(String(value));
            });

            container.appendChild(button);
        }

        addRow(container, name, value) {
            const row = Framework.createElement("div", {
                style: "display:flex;flex-wrap:wrap;gap:8px;margin:7px 0;padding:5px 0;border-bottom:1px solid #888;"
            });

            row.appendChild(
                Framework.createElement("strong", {
                    textContent: name + ":"
                })
            );

            row.appendChild(
                Framework.createElement("span", {
                    textContent: value === null || value === undefined || value === ""
                        ? "Not disclosed"
                        : String(value),
                    style: "overflow-wrap:anywhere;"
                })
            );

            container.appendChild(row);
        }

        createSection(title) {
            const section = Framework.createElement("section", {
                style: "margin:14px 0;padding:10px;border:1px solid #888;border-radius:6px;"
            });

            section.appendChild(
                Framework.createElement("h3", {
                    textContent: title
                })
            );

            return section;
        }

        restoreResult(data) {
            if (
                !data ||
                !data.info ||
                typeof data.info !== "object" ||
                typeof data.info.url !== "string" ||
                typeof data.info.finalUrl !== "string" ||
                typeof data.info.status !== "number" ||
                typeof data.info.statusText !== "string" ||
                !data.info.headers ||
                typeof data.info.headers !== "object" ||
                Array.isArray(data.info.headers) ||
                !Array.isArray(data.info.technologies) ||
                !Array.isArray(data.info.security) ||
                !Array.isArray(data.info.infrastructure)
            ) {
                return false;
            }

            try {
                const url = new URL(data.info.url);
                const finalUrl = new URL(data.info.finalUrl);

                if (
                    url.origin !== location.origin ||
                    finalUrl.origin !== location.origin
                ) {
                    return false;
                }

                if (
                    !data.info.technologies.every(
                        item => typeof item === "string"
                    ) ||
                    !data.info.security.every(
                        item =>
                            item &&
                            typeof item.name === "string" &&
                            typeof item.present === "boolean" &&
                            (
                                item.value === null ||
                                typeof item.value === "string"
                            )
                    ) ||
                    !data.info.infrastructure.every(
                        item =>
                            item &&
                            typeof item.name === "string" &&
                            Array.isArray(item.indicators) &&
                            item.indicators.every(
                                indicator => typeof indicator === "string"
                            )
                    )
                ) {
                    return false;
                }

                const headers = {};

                for (const [name, value] of Object.entries(data.info.headers)) {
                    if (
                        typeof name !== "string" ||
                        typeof value !== "string"
                    ) {
                        return false;
                    }

                    headers[name.toLowerCase()] = value;
                }

                this.info = {
                    ...data.info,
                    url: url.href,
                    finalUrl: finalUrl.href,
                    headers,
                    technologies: [...data.info.technologies],
                    security: data.info.security.map(item => ({ ...item })),
                    infrastructure: data.info.infrastructure.map(item => ({
                        ...item,
                        indicators: [...item.indicators]
                    }))
                };

                this.scannedAt = data.scannedAt || null;
                this.error = null;
                this.available = true;

                return true;

            } catch (error) {
                return false;
            }
        }

        getMetadata() {
            return {
                id: ServerInfoViewer.id,
                title: ServerInfoViewer.title,
                description: ServerInfoViewer.description,
                icon: ServerInfoViewer.icon
            };
        }

        constructor() {
            super();
            this.available = false;
            this.info = null;
            this.error = null;
            this.scannedAt = null;
        }
}Framework.register(ServerInfoViewer.id,ServerInfoViewer);})(Framework);