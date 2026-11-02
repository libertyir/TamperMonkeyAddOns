(function (Framework) {
    "use strict";

    class OpenAPIViewer extends Framework.BaseModule {
        static id = "OpenAPI_Viewer";
        static title = "OpenAPI Viewer";
        static description = "Discover and inspect OpenAPI specifications";
        static icon = "📋";

        constructor() {
            super();
            this.specifications = [];
            this.available = false;
            this.scannedAt = null;
        }

        getMetadata() {
            return {
                id: OpenAPIViewer.id,
                title: OpenAPIViewer.title,
                description: OpenAPIViewer.description,
                icon: OpenAPIViewer.icon
            };
        }

        async init() {
            this.available = false;
            this.specifications = [];
            this.scannedAt = new Date().toISOString();

            const paths = [
                "openapi.json",
                "openapi.yaml",
                "openapi.yml",
                "swagger.json",
                "swagger.yaml",
                "swagger.yml",
                "v1/openapi.json",
                "v2/openapi.json",
                "v3/openapi.json",
                "api/openapi.json",
                "api/openapi.yaml",
                "api/swagger.json",
                "api/swagger.yaml",
                "api-docs",
                "v3/api-docs",
                "v2/api-docs",
                "swagger/v1/swagger.json",
                "swagger/v2/swagger.json"
            ];

            const base = new URL(".", location.href);

            for (const path of paths) {
                const url = new URL(path, base);

                if (url.origin !== location.origin) {
                    continue;
                }

                try {
                    const response = await fetch(url.href, {
                        method: "GET",
                        credentials: "same-origin",
                        cache: "no-store",
                        redirect: "follow"
                    });

                    if (!response.ok) continue;

                    const finalUrl = new URL(response.url);

                    if (finalUrl.origin !== location.origin) continue;

                    const content = await response.text();

                    if (!content || content.length > 10 * 1024 * 1024) {
                        continue;
                    }

                    const spec = this.parseSpecification(content);

                    if (!spec) continue;

                    const exists = this.specifications.some(
                        item => item.url === finalUrl.href
                    );

                    if (exists) continue;

                    this.specifications.push({
                        url: finalUrl.href,
                        path,
                        version: spec.version,
                        title: spec.title,
                        description: spec.description,
                        servers: spec.servers,
                        paths: spec.paths,
                        schemas: spec.schemas,
                        securitySchemes: spec.securitySchemes,
                        raw: spec.raw
                    });

                    this.available = true;

                } catch (error) {
                    // Ignore unavailable or invalid specification paths.
                }
            }
        }

        getResult() {
            if (!this.available || !this.specifications.length) {
                return null;
            }

            return {
                page: window.location.href,
                scannedAt: this.scannedAt,
                totalSpecifications: this.specifications.length,
                specifications: this.specifications.map(spec => ({
                    ...spec
                }))
            };
        }

        parseSpecification(content) {
            let data;

            try {
                data = JSON.parse(content);
            } catch {
                return null;
            }

            if (!data || typeof data !== "object") {
                return null;
            }

            const isOpenAPI =
                typeof data.openapi === "string" &&
                data.openapi.startsWith("3.");

            const isSwagger =
                data.swagger === "2.0";

            if (!isOpenAPI && !isSwagger) {
                return null;
            }

            const paths = data.paths && typeof data.paths === "object"
                ? data.paths
                : {};

            const schemas = isOpenAPI
                ? data.components?.schemas || {}
                : data.definitions || {};

            const securitySchemes = isOpenAPI
                ? data.components?.securitySchemes || {}
                : data.securityDefinitions || {};

            return {
                version: data.openapi || data.swagger,
                title: data.info?.title || "Untitled API",
                description: data.info?.description || "",
                servers: isOpenAPI
                    ? (data.servers || []).map(item => item.url)
                    : [data.host ? `${data.schemes?.[0] || "https"}://${data.host}${data.basePath || ""}` : ""].filter(Boolean),
                paths,
                schemas,
                securitySchemes,
                raw: data
            };
        }

        createButton(label, handler) {
            const button = Framework.createElement("button", {
                textContent: label,
                style: "margin:4px;padding:6px 10px;cursor:pointer;"
            });

            button.addEventListener("click", handler);
            return button;
        }

        copy(text) {
            Framework.copy(
                typeof text === "string"
                    ? text
                    : JSON.stringify(text, null, 2)
            );
        }

        createSection(title) {
            const section = Framework.createElement("section", {
                style: "margin:16px 0;padding:10px;border:1px solid #888;border-radius:6px;"
            });

            section.appendChild(
                Framework.createElement("h3", {
                    textContent: title
                })
            );

            return section;
        }

        render() {
            const root = Framework.createElement("div", {
                className: "openapi-viewer",
                style: "padding:12px;overflow:auto;max-height:75vh;"
            });

            const heading = Framework.createElement("h2", {
                textContent: "OpenAPI Specifications"
            });

            root.appendChild(heading);

            if (!this.specifications.length) {
                root.appendChild(
                    Framework.createElement("p", {
                        textContent: "No valid OpenAPI or Swagger JSON specifications found."
                    })
                );
                return root;
            }

            for (const spec of this.specifications) {
                const container = this.createSection(spec.title);

                container.appendChild(
                    Framework.createElement("p", {
                        textContent: `Version: ${spec.version}`
                    })
                );

                container.appendChild(
                    Framework.createElement("p", {
                        textContent: spec.description || "No description available."
                    })
                );

                const link = Framework.createElement("a", {
                    textContent: spec.url,
                    href: spec.url,
                    target: "_blank",
                    rel: "noopener noreferrer"
                });

                container.appendChild(link);

                container.appendChild(
                    this.createButton("Copy Specification URL", () => {
                        this.copy(spec.url);
                    })
                );

                container.appendChild(
                    this.createButton("Copy Full JSON", () => {
                        this.copy(spec.raw);
                    })
                );

                container.appendChild(
                    this.createButton("Open Specification", () => {
                        Framework.open(spec.url);
                    })
                );

                this.renderServers(container, spec);
                this.renderEndpoints(container, spec);
                this.renderSchemas(container, spec);
                this.renderSecurity(container, spec);

                root.appendChild(container);
            }

            return root;
        }

        renderServers(container, spec) {
            const section = this.createSection("Servers");

            if (!spec.servers.length) {
                section.appendChild(
                    Framework.createElement("p", {
                        textContent: "No server URLs defined."
                    })
                );
            }

            for (const server of spec.servers) {
                const row = Framework.createElement("div", {
                    style: "margin:5px 0;"
                });

                row.appendChild(
                    Framework.createElement("code", {
                        textContent: server
                    })
                );

                row.appendChild(
                    this.createButton("Copy", () => this.copy(server))
                );

                section.appendChild(row);
            }

            container.appendChild(section);
        }

        renderEndpoints(container, spec) {
            const section = this.createSection(
                `Endpoints (${Object.keys(spec.paths).length})`
            );

            const methods = [
                "get", "post", "put", "patch",
                "delete", "options", "head", "trace"
            ];

            for (const [path, definition] of Object.entries(spec.paths)) {
                if (!definition || typeof definition !== "object") continue;

                for (const method of methods) {
                    const operation = definition[method];

                    if (!operation || typeof operation !== "object") {
                        continue;
                    }

                    const row = Framework.createElement("div", {
                        style: "margin:8px 0;padding:8px;border-bottom:1px solid #888;"
                    });

                    const summary = operation.summary || operation.operationId || "";

                    row.appendChild(
                        Framework.createElement("strong", {
                            textContent: `${method.toUpperCase()} ${path}`
                        })
                    );

                    if (summary) {
                        row.appendChild(
                            Framework.createElement("p", {
                                textContent: summary
                            })
                        );
                    }

                    if (operation.description) {
                        row.appendChild(
                            Framework.createElement("p", {
                                textContent: operation.description
                            })
                        );
                    }

                    row.appendChild(
                        this.createButton("Copy Path", () => this.copy(path))
                    );

                    row.appendChild(
                        this.createButton("Copy Operation", () => this.copy(operation))
                    );

                    const parameters = operation.parameters || [];

                    if (parameters.length) {
                        row.appendChild(
                            Framework.createElement("p", {
                                textContent: "Parameters: " + parameters.map(
                                    item => `${item.name} (${item.in})`
                                ).join(", ")
                            })
                        );
                    }

                    section.appendChild(row);
                }
            }

            container.appendChild(section);
        }

        renderSchemas(container, spec) {
            const schemas = spec.schemas;
            const section = this.createSection(
                `Schemas (${Object.keys(schemas).length})`
            );

            for (const [name, schema] of Object.entries(schemas)) {
                const row = Framework.createElement("div", {
                    style: "margin:8px 0;padding:8px;border-bottom:1px solid #888;"
                });

                row.appendChild(
                    Framework.createElement("strong", {
                        textContent: name
                    })
                );

                row.appendChild(
                    Framework.createElement("p", {
                        textContent: `Type: ${schema.type || "object"}`
                    })
                );

                if (schema.description) {
                    row.appendChild(
                        Framework.createElement("p", {
                            textContent: schema.description
                        })
                    );
                }

                if (schema.properties) {
                    const properties = Object.entries(schema.properties)
                        .map(([key, value]) => {
                            return `${key}: ${value.type || value.$ref || "unknown"}`;
                        });

                    row.appendChild(
                        Framework.createElement("pre", {
                            textContent: properties.join("\n")
                        })
                    );
                }

                row.appendChild(
                    this.createButton("Copy Schema", () => this.copy(schema))
                );

                section.appendChild(row);
            }

            container.appendChild(section);
        }

        renderSecurity(container, spec) {
            const section = this.createSection(
                `Security Schemes (${Object.keys(spec.securitySchemes).length})`
            );

            for (const [name, scheme] of Object.entries(spec.securitySchemes)) {
                const row = Framework.createElement("div", {
                    style: "margin:8px 0;padding:8px;border-bottom:1px solid #888;"
                });

                row.appendChild(
                    Framework.createElement("strong", {
                        textContent: name
                    })
                );

                row.appendChild(
                    Framework.createElement("pre", {
                        textContent: JSON.stringify(scheme, null, 2)
                    })
                );

                row.appendChild(
                    this.createButton("Copy", () => this.copy(scheme))
                );

                section.appendChild(row);
            }

            container.appendChild(section);
        }
    }

    Framework.register(OpenAPIViewer.id, OpenAPIViewer);

})(Framework);