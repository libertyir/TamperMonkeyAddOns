(function(Framework){"use strict";class OpenAPIViewerScanner extends Framework.BaseModule{
        static id = "OpenAPI_Scanner";
        static title = "OpenAPI Viewer";
        static description = "Discover and inspect OpenAPI specifications";
        static icon = "📋";
        static scanPolicy = {
            scope: "origin-root",
            defaultTTL: "7d"
        };


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

        async runScan() {
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

            const base = new URL("/", location.origin);

            for (const path of paths) {
                const url = new URL(path, base);

                if (url.origin !== location.origin) {
                    continue;
                }

                try {
                    const response = await Framework.SiteIntelligence.fetch(url.href, {
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

        constructor() {
            super();
            this.specifications = [];
            this.available = false;
            this.scannedAt = null;
        }
async scan(context={}){await this.runScan(context);if(!this.available)return null;const result=await this.getResult();if(!result||typeof result!=="object")return null;const origin=new URL(context.url||context.currentUrl||location.href).origin;return {...result,directoryUrl:context.directoryUrl||context.scope||origin+"/"};}}
Framework.register(OpenAPIViewerScanner.id,OpenAPIViewerScanner);})(Framework);