
(function (Framework) {
    "use strict";

    class ServerInfoViewer extends Framework.BaseModule {
        static id = "ServerInfo_Viewer";
        static title = "Server Info Viewer";
        static description = "Inspect web server headers and technology fingerprints";
        static icon = "🖥";

        constructor() {
            super();
            this.available = false;
            this.info = null;
            this.error = null;
        }

        getMetadata() {
            return {
                id: ServerInfoViewer.id,
                title: ServerInfoViewer.title,
                description: ServerInfoViewer.description,
                icon: ServerInfoViewer.icon
            };
        }

        async init() {
            this.available = false;
            this.info = null;
            this.error = null;

            try {
                const response = await fetch(location.href, {
                    method: "HEAD",
                    credentials: "same-origin",
                    cache: "no-store",
                    redirect: "follow"
                });

                const finalUrl = new URL(response.url);

                if (finalUrl.origin !== location.origin) {
                    this.error = "Request redirected outside the current origin.";
                    return;
                }

                const headers = {};

                response.headers.forEach((value, name) => {
                    headers[name.toLowerCase()] = value;
                });

                this.info = {
                    url: location.href,
                    finalUrl: response.url,
                    status: response.status,
                    statusText: response.statusText,
                    headers,
                    server: headers.server || null,
                    poweredBy: headers["x-powered-by"] || null,
                    contentType: headers["content-type"] || null,
                    technologies: this.detectTechnologies(headers),
                    security: this.inspectSecurityHeaders(headers),
                    infrastructure: this.detectInfrastructure(headers)
                };

                this.available = true;

            } catch (error) {
                this.error = error.message || "Unable to inspect server response.";
            }
        }

        detectTechnologies(headers) {
            const technologies = [];

            const server = headers.server || "";
            const poweredBy = headers["x-powered-by"] || "";
            const via = headers.via || "";

            const signatures = [
                {
                    name: "Apache",
                    pattern: /apache/i,
                    source: server
                },
                {
                    name: "Nginx",
                    pattern: /nginx/i,
                    source: server
                },
                {
                    name: "Microsoft IIS",
                    pattern: /microsoft-iis/i,
                    source: server
                },
                {
                    name: "LiteSpeed",
                    pattern: /litespeed/i,
                    source: server
                },
                {
                    name: "Caddy",
                    pattern: /caddy/i,
                    source: server
                },
                {
                    name: "PHP",
                    pattern: /php/i,
                    source: poweredBy
                },
                {
                    name: "ASP.NET",
                    pattern: /asp\.net/i,
                    source: poweredBy
                },
                {
                    name: "Express",
                    pattern: /express/i,
                    source: poweredBy
                },
                {
                    name: "Cloudflare",
                    pattern: /cloudflare/i,
                    source: server + " " + (headers["cf-ray"] || "")
                },
                {
                    name: "Varnish",
                    pattern: /varnish/i,
                    source: via + " " + (headers["x-varnish"] || "")
                }
            ];

            for (const signature of signatures) {
                if (signature.pattern.test(signature.source)) {
                    technologies.push(signature.name);
                }
            }

            return [...new Set(technologies)];
        }

        inspectSecurityHeaders(headers) {
            const definitions = [
                {
                    name: "Strict-Transport-Security",
                    key: "strict-transport-security"
                },
                {
                    name: "Content-Security-Policy",
                    key: "content-security-policy"
                },
                {
                    name: "X-Content-Type-Options",
                    key: "x-content-type-options"
                },
                {
                    name: "X-Frame-Options",
                    key: "x-frame-options"
                },
                {
                    name: "Referrer-Policy",
                    key: "referrer-policy"
                },
                {
                    name: "Permissions-Policy",
                    key: "permissions-policy"
                },
                {
                    name: "Cross-Origin-Opener-Policy",
                    key: "cross-origin-opener-policy"
                },
                {
                    name: "Cross-Origin-Resource-Policy",
                    key: "cross-origin-resource-policy"
                }
            ];

            return definitions.map(item => ({
                name: item.name,
                value: headers[item.key] || null,
                present: Boolean(headers[item.key])
            }));
        }

        detectInfrastructure(headers) {
            const result = [];

            const signatures = [
                {
                    name: "Cloudflare",
                    keys: ["cf-ray", "cf-cache-status"]
                },
                {
                    name: "Akamai",
                    keys: ["akamai-grn", "x-akamai-transformed"]
                },
                {
                    name: "Amazon CloudFront",
                    keys: ["x-amz-cf-id", "x-amz-cf-pop"]
                },
                {
                    name: "Fastly",
                    keys: ["x-served-by", "fastly-debug-digest"]
                },
                {
                    name: "Varnish Cache",
                    keys: ["x-varnish"]
                },
                {
                    name: "Microsoft Azure",
                    keys: ["x-azure-ref", "x-ms-routing-name"]
                }
            ];

            for (const signature of signatures) {
                const matched = signature.keys.filter(
                    key => headers[key]
                );

                if (matched.length) {
                    result.push({
                        name: signature.name,
                        indicators: matched
                    });
                }
            }

            return result;
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
    }

    Framework.register(ServerInfoViewer.id, ServerInfoViewer);

})(Framework);
