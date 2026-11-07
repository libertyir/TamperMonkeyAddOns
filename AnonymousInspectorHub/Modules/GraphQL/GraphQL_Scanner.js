(function(Framework){"use strict";class GraphQLViewerScanner extends Framework.BaseModule{

        static id = "GraphQL_Scanner";
        static title = "GraphQL Viewer";
        static description = "Inspect GraphQL endpoints and schemas";
        static icon = "◈";
        static scanPolicy = {
            scope: "origin-root",
            defaultTTL: "7d"
        };


        destroy() {
            this.schema = null;
            this.types = [];
            this.errors = [];
        }

        getResult() {
            if (!this.available || !this.schema) {
                return null;
            }

            return {
                page: window.location.href,
                endpoint: this.endpoint,
                scannedAt: this.scannedAt,
                schema: this.schema,
                errors: this.errors
            };
        }

        async runScan() {
            this.available = false;
            this.endpoint = null;
            this.schema = null;
            this.types = [];
            this.errors = [];
            this.scannedAt = new Date().toISOString();

            const base = new URL("/", window.location.origin);

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

        constructor() {
            super();

            this.endpoint = null;
            this.schema = null;
            this.types = [];
            this.errors = [];
            this.scannedAt = null;
        }
async scan(context={}){await this.runScan(context);if(!this.available)return null;const result=await this.getResult();if(!result||typeof result!=="object")return null;const origin=new URL(context.url||context.currentUrl||location.href).origin;return {...result,directoryUrl:context.directoryUrl||context.scope||origin+"/"};}}
Framework.register(GraphQLViewerScanner.id,GraphQLViewerScanner);})(Framework);