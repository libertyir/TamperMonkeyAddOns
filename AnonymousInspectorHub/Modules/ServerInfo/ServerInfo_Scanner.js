(function(Framework){"use strict";class ServerInfoViewerScanner extends Framework.BaseModule{
        static id = "ServerInfo_Scanner";
        static title = "Server Info Viewer";
        static description = "Inspect web server headers and technology fingerprints";
        static icon = "🖥";

        static scanPolicy = {
            scope: "origin-root",
            defaultTTL: "permanent"
        };


        getResult() {
            if (!this.available || !this.info) {
                return null;
            }

            return {
                page: window.location.href,
                scannedAt: this.scannedAt,
                info: {
                    ...this.info,
                    headers: { ...this.info.headers },
                    technologies: [...this.info.technologies],
                    security: this.info.security.map(item => ({ ...item })),
                    infrastructure: this.info.infrastructure.map(item => ({
                        ...item,
                        indicators: [...item.indicators]
                    }))
                }
            };
        }

        async runScan() {
            this.available = false;
            this.info = null;
            this.error = null;
            this.scannedAt = new Date().toISOString();

            const controller = new AbortController();

            const timeoutId = setTimeout(() => {
                controller.abort();
            }, 8000);

            try {
                const response = await Framework.SiteIntelligence.fetch(
                    new URL("/", location.origin).href,
                    {
                        method: "GET",
                        credentials: "same-origin",
                        cache: "no-store",
                        redirect: "follow",
                        signal: controller.signal
                    }
                );

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
                    url: new URL("/", location.origin).href,
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
                this.error = controller.signal.aborted
                    ? "Server information request timed out."
                    : error.message || "Unable to inspect server response.";

                throw error;

            } finally {
                clearTimeout(timeoutId);
            }
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

        constructor() {
            super();
            this.available = false;
            this.info = null;
            this.error = null;
            this.scannedAt = null;
        }
async scan(context={}){await this.runScan(context);if(!this.available)return null;const result=await this.getResult();if(!result||typeof result!=="object")return null;const origin=new URL(context.url||context.currentUrl||location.href).origin;return {...result,directoryUrl:context.directoryUrl||context.scope||origin+"/"};}}
Framework.register(ServerInfoViewerScanner.id,ServerInfoViewerScanner);})(Framework);