
(function (Framework) {
    "use strict";

    class GraphQLViewer extends Framework.BaseModule {

        static id = "GraphQL_Viewer";
        static title = "GraphQL Viewer";
        static description = "Inspect GraphQL endpoints and schemas";
        static icon = "◈";

        constructor() {
            super();

            this.endpoint = null;
            this.schema = null;
            this.types = [];
            this.errors = [];
        }

        getMetadata() {
            return {
                id: GraphQLViewer.id,
                title: GraphQLViewer.title,
                description: GraphQLViewer.description,
                icon: GraphQLViewer.icon
            };
        }

        async init() {
            this.available = false;

            const base = new URL(
                ".",
                window.location.href
            );

            const candidates = [
                "graphql",
                "api/graphql",
                "graphql/",
                "api/graphql/",
                "v1/graphql",
                "v2/graphql",
                "query",
                "gql"
            ];

            for (const path of candidates) {
                const url = new URL(path, base);

                if (url.origin !== window.location.origin) {
                    continue;
                }

                try {
                    const response = await fetch(url.href, {
                        method: "POST",
                        credentials: "same-origin",
                        redirect: "follow",
                        cache: "no-store",
                        headers: {
                            "Content-Type": "application/json",
                            "Accept": "application/json"
                        },
                        body: JSON.stringify({
                            query: this.getIntrospectionQuery()
                        })
                    });

                    if (
                        new URL(response.url).origin !==
                        window.location.origin
                    ) {
                        continue;
                    }

                    const contentType = (
                        response.headers.get("content-type") || ""
                    ).toLowerCase();

                    if (!contentType.includes("json")) {
                        continue;
                    }

                    const result = await response.json();

                    if (
                        !result ||
                        !result.data ||
                        !result.data.__schema
                    ) {
                        continue;
                    }

                    this.endpoint = response.url;
                    this.schema = result.data.__schema;
                    this.errors = result.errors || [];
                    this.types = this.schema.types || [];
                    this.available = true;

                    return;

                } catch (error) {
                    // Ignore unavailable or unsupported endpoints.
                }
            }
        }

        getIntrospectionQuery() {
            return `
                query IntrospectionQuery {
                    __schema {
                        description
                        queryType {
                            name
                        }
                        mutationType {
                            name
                        }
                        subscriptionType {
                            name
                        }
                        types {
                            kind
                            name
                            description
                            fields(includeDeprecated: true) {
                                name
                                description
                                isDeprecated
                                deprecationReason
                                args {
                                    name
                                    description
                                    defaultValue
                                    type {
                                        ...TypeRef
                                    }
                                }
                                type {
                                    ...TypeRef
                                }
                            }
                            inputFields {
                                name
                                description
                                defaultValue
                                type {
                                    ...TypeRef
                                }
                            }
                            interfaces {
                                ...TypeRef
                            }
                            enumValues(includeDeprecated: true) {
                                name
                                description
                                isDeprecated
                                deprecationReason
                            }
                            possibleTypes {
                                ...TypeRef
                            }
                        }
                    }
                }

                fragment TypeRef on __Type {
                    kind
                    name
                    ofType {
                        kind
                        name
                        ofType {
                            kind
                            name
                            ofType {
                                kind
                                name
                                ofType {
                                    kind
                                    name
                                    ofType {
                                        kind
                                        name
                                        ofType {
                                            kind
                                            name
                                            ofType {
                                                kind
                                                name
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            `;
        }

        formatType(type) {
            if (!type) {
                return "Unknown";
            }

            if (type.kind === "NON_NULL") {
                return this.formatType(type.ofType) + "!";
            }

            if (type.kind === "LIST") {
                return "[" + this.formatType(type.ofType) + "]";
            }

            return type.name || "Unknown";
        }

        getRootType(typeName) {
            return this.types.find(type => type.name === typeName);
        }

        getRootFields(typeName) {
            const type = this.getRootType(typeName);

            return type && type.fields
                ? type.fields
                : [];
        }

        createSection(title, description) {
            const section = Framework.createElement("section", {
                style: "margin:20px 0;"
            });

            section.appendChild(
                Framework.createElement("h3", {
                    textContent: title
                })
            );

            if (description) {
                section.appendChild(
                    Framework.createElement("p", {
                        textContent: description,
                        style: "color:#aaa;font-size:12px;"
                    })
                );
            }

            return section;
        }

        createButton(label, callback) {
            const button = Framework.createElement("button", {
                type: "button",
                textContent: label,
                style: [
                    "padding:7px 11px",
                    "margin:4px",
                    "border:1px solid #555",
                    "border-radius:4px",
                    "background:#292929",
                    "color:#fff",
                    "cursor:pointer"
                ].join(";")
            });

            button.addEventListener("click", callback);

            return button;
        }

        renderFields(fields) {
            const table = Framework.createElement("table", {
                style: "width:100%;border-collapse:collapse;"
            });

            const header = Framework.createElement("tr");

            for (const title of [
                "Field",
                "Return Type",
                "Arguments",
                "Description"
            ]) {
                header.appendChild(
                    Framework.createElement("th", {
                        textContent: title,
                        style: "padding:8px;text-align:left;border-bottom:1px solid #555;"
                    })
                );
            }

            table.appendChild(header);

            for (const field of fields) {
                const row = Framework.createElement("tr");

                const args = (field.args || []).map(arg =>
                    arg.name + ": " + this.formatType(arg.type)
                ).join(", ");

                const values = [
                    field.name,
                    this.formatType(field.type),
                    args || "-",
                    field.description || "-"
                ];

                for (const value of values) {
                    row.appendChild(
                        Framework.createElement("td", {
                            textContent: value,
                            style: "padding:8px;border-bottom:1px solid #333;vertical-align:top;"
                        })
                    );
                }

                table.appendChild(row);
            }

            return table;
        }

        renderTypes() {
            const container = Framework.createElement("div");

            const objectTypes = this.types.filter(type =>
                type.kind === "OBJECT" &&
                !type.name.startsWith("__")
            );

            for (const type of objectTypes) {
                if (!type.fields || !type.fields.length) {
                    continue;
                }

                const section = this.createSection(
                    type.name,
                    type.description
                );

                const heading = Framework.createElement("p", {
                    textContent: type.fields.length + " fields",
                    style: "color:#aaa;font-size:11px;"
                });

                section.append(
                    heading,
                    this.renderFields(type.fields)
                );

                container.appendChild(section);
            }

            return container;
        }

        render() {
            const container = Framework.createElement("div");

            container.appendChild(
                Framework.createElement("h2", {
                    textContent: "GraphQL Schema Explorer"
                })
            );

            const endpointLink = Framework.createElement("a", {
                href: this.endpoint,
                target: "_blank",
                rel: "noopener noreferrer",
                textContent: this.endpoint
            });

            container.appendChild(endpointLink);

            const toolbar = Framework.createElement("div", {
                style: "margin:12px 0;"
            });

            const copySchema = this.createButton(
                "Copy Full Schema",
                () => {
                    Framework.copy(
                        JSON.stringify(this.schema, null, 2)
                    );
                }
            );

            const copyEndpoint = this.createButton(
                "Copy Endpoint",
                () => {
                    Framework.copy(this.endpoint);
                }
            );

            toolbar.append(copySchema, copyEndpoint);
            container.appendChild(toolbar);

            const rootInfo = [
                ["Query", this.schema.queryType],
                ["Mutation", this.schema.mutationType],
                ["Subscription", this.schema.subscriptionType]
            ];

            const rootSection = this.createSection(
                "Root Operations",
                "Available GraphQL operation types"
            );

            for (const [label, type] of rootInfo) {
                if (!type) continue;

                rootSection.appendChild(
                    Framework.createElement("p", {
                        textContent: label + ": " + type.name
                    })
                );
            }

            container.appendChild(rootSection);

            const operationTypes = [
                ["Queries", this.schema.queryType],
                ["Mutations", this.schema.mutationType],
                ["Subscriptions", this.schema.subscriptionType]
            ];

            for (const [label, type] of operationTypes) {
                if (!type) continue;

                const fields = this.getRootFields(type.name);

                const section = this.createSection(
                    label,
                    fields.length + " available operations"
                );

                section.appendChild(
                    this.renderFields(fields)
                );

                const copyButton = this.createButton(
                    "Copy " + label,
                    () => {
                        Framework.copy(
                            fields.map(field =>
                                field.name + ": " +
                                this.formatType(field.type)
                            ).join("\n")
                        );
                    }
                );

                section.appendChild(copyButton);
                container.appendChild(section);
            }

            const typesSection = this.createSection(
                "Object Types",
                "Schema object types and their fields"
            );

            typesSection.appendChild(this.renderTypes());

            container.appendChild(typesSection);

            const otherTypes = this.types.filter(type =>
                ["INPUT_OBJECT", "ENUM", "SCALAR", "INTERFACE", "UNION"].includes(type.kind) &&
                !type.name.startsWith("__")
            );

            const otherSection = this.createSection(
                "Other Schema Types",
                "Input objects, enums, scalars, interfaces and unions"
            );

            for (const type of otherTypes) {
                const details = Framework.createElement("details");

                const summary = Framework.createElement("summary", {
                    textContent: type.name + " (" + type.kind + ")",
                    style: "cursor:pointer;padding:7px;"
                });

                details.appendChild(summary);

                if (type.description) {
                    details.appendChild(
                        Framework.createElement("p", {
                            textContent: type.description
                        })
                    );
                }

                let entries = [];

                if (type.inputFields) {
                    entries = type.inputFields.map(field =>
                        field.name + ": " + this.formatType(field.type)
                    );
                } else if (type.enumValues) {
                    entries = type.enumValues.map(value => value.name);
                } else if (type.interfaces) {
                    entries = type.interfaces.map(value =>
                        this.formatType(value)
                    );
                } else if (type.possibleTypes) {
                    entries = type.possibleTypes.map(value =>
                        this.formatType(value)
                    );
                }

                details.appendChild(
                    Framework.createElement("pre", {
                        textContent: entries.join("\n") || "No fields",
                        style: "white-space:pre-wrap;padding:10px;background:#101010;"
                    })
                );

                otherSection.appendChild(details);
            }

            container.appendChild(otherSection);

            const warning = Framework.createElement("p", {
                textContent:
                    "Schema discovery uses GraphQL introspection only. Some servers disable introspection or restrict schema visibility.",
                style: "color:#aaa;font-size:12px;margin-top:20px;"
            });

            container.appendChild(warning);

            return container;
        }

        destroy() {
            this.schema = null;
            this.types = [];
            this.errors = [];
        }
    }

    Framework.register(
        GraphQLViewer.id,
        GraphQLViewer
    );

})(Framework);
