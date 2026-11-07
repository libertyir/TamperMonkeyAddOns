(function(Framework){"use strict";class OpenAPIViewer extends Framework.BaseModule{
        static id = "OpenAPI_Viewer";
        static title = "OpenAPI Viewer";
        static description = "Discover and inspect OpenAPI specifications";
        static icon = "📋";
        static scanPolicy = {
            scope: "origin-root",
            defaultTTL: "7d"
        };


static providerId="OpenAPI_Provider";async init(context={}){const result=context&&context.result;this.available=Boolean(result&&this.restoreResult(result,context));}
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

        copy(text) {
            Framework.copy(
                typeof text === "string"
                    ? text
                    : JSON.stringify(text, null, 2)
            );
        }

        createButton(label, handler) {
            const button = Framework.createElement("button", {
                textContent: label,
                style: "margin:4px;padding:6px 10px;cursor:pointer;"
            });

            button.addEventListener("click", handler);
            return button;
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

        restoreResult(data) {
            if (
                !data ||
                !Array.isArray(data.specifications) ||
                data.specifications.length === 0
            ) {
                return false;
            }

            const restored = [];

            try {
                for (const spec of data.specifications) {
                    if (
                        !spec ||
                        typeof spec.url !== "string" ||
                        typeof spec.version !== "string" ||
                        typeof spec.title !== "string" ||
                        typeof spec.description !== "string" ||
                        !Array.isArray(spec.servers) ||
                        !spec.paths ||
                        typeof spec.paths !== "object" ||
                        Array.isArray(spec.paths) ||
                        !spec.schemas ||
                        typeof spec.schemas !== "object" ||
                        Array.isArray(spec.schemas) ||
                        !spec.securitySchemes ||
                        typeof spec.securitySchemes !== "object" ||
                        Array.isArray(spec.securitySchemes) ||
                        !spec.raw ||
                        typeof spec.raw !== "object" ||
                        Array.isArray(spec.raw)
                    ) {
                        return false;
                    }

                    const url = new URL(spec.url);

                    if (url.origin !== location.origin) {
                        return false;
                    }

                    if (
                        !spec.servers.every(
                            server => typeof server === "string"
                        )
                    ) {
                        return false;
                    }

                    restored.push({
                        ...spec,
                        url: url.href,
                        servers: [...spec.servers],
                        paths: { ...spec.paths },
                        schemas: { ...spec.schemas },
                        securitySchemes: {
                            ...spec.securitySchemes
                        },
                        raw: spec.raw
                    });
                }

                this.specifications = restored;
                this.scannedAt = data.scannedAt || null;
                this.available = true;

                return true;

            } catch (error) {
                return false;
            }
        }

        getMetadata() {
            return {
                id: OpenAPIViewer.id,
                title: OpenAPIViewer.title,
                description: OpenAPIViewer.description,
                icon: OpenAPIViewer.icon
            };
        }

        constructor() {
            super();
            this.specifications = [];
            this.available = false;
            this.scannedAt = null;
        }
}Framework.register(OpenAPIViewer.id,OpenAPIViewer);})(Framework);