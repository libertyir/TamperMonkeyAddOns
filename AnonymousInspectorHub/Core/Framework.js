
(function (root) {
    "use strict";

    class FrameworkFactory {
        constructor(options = {}) {
            this.version = options.version || "1.5.0";
            this.options = options;

            this.framework = null;
            this.BaseModule = this.createBaseModule();
            this.BaseSettings = this.createBaseSettings();
        }

        // --------------------------------------------------
        // BASE MODULE
        // --------------------------------------------------

        createBaseModule() {
            return class BaseModule {
                constructor() {
                    this.available = false;
                    this.error = null;
                }

                static get scanPolicy() {
                    return {
                        scope: "origin-root",
                        defaultTTL: "7d"
                    };
                }

                static getMetadata() {
                    return {
                        id: this.id,
                        title: this.title,
                        description: this.description,
                        icon: this.icon
                    };
                }

                getMetadata() {
                    return this.constructor.getMetadata();
                }

                async init() {
                    throw new Error("Module must implement init()");
                }

                render() {
                    throw new Error("Module must implement render()");
                }

                getResult() {
                    return null;
                }

                destroy() { }
            };
        }

        // --------------------------------------------------
        // BASE SETTINGS
        // --------------------------------------------------

        createBaseSettings() {
            const factory = this;

            return class BaseSettings {
                constructor() {
                    this.available = true;
                    this.error = null;
                }

                static getMetadata() {
                    return {
                        id: this.id,
                        title: this.title,
                        description: this.description,
                        icon: this.icon
                    };
                }

                getMetadata() {
                    return this.constructor.getMetadata();
                }

                async init() {
                    this.available = true;
                }

                createElement(tag, attributes = {}, children = []) {
                    return factory.requireFramework().createElement(
                        tag,
                        attributes,
                        children
                    );
                }

                render() {
                    throw new Error(
                        "Settings module must implement render()"
                    );
                }

                destroy() { }
            };
        }

        // --------------------------------------------------
        // INTERNAL HELPERS
        // --------------------------------------------------

        requireFramework() {
            if (!this.framework) {
                throw new Error(
                    "Framework has not been initialized."
                );
            }

            return this.framework;
        }

        requireFunction(name) {
            const fn = this.options[name];

            if (typeof fn !== "function") {
                throw new Error(
                    "Framework service is unavailable: " + name
                );
            }

            return fn;
        }

        invoke(name, args) {
            return this.requireFunction(name)(...args);
        }

        // --------------------------------------------------
        // CRYPTO API
        // --------------------------------------------------

        createCryptoAPI() {
            const factory = this;

            return Object.freeze({
                getKey() {
                    return factory.invoke(
                        "getEncryptionKey",
                        []
                    );
                },

                getAlgorithm() {
                    return factory.invoke(
                        "getCryptoAlgorithm",
                        []
                    );
                },

                getStatus() {
                    return factory.invoke(
                        "getCryptoStatus",
                        []
                    );
                },

                encrypt(data) {
                    return factory.invoke(
                        "encrypt",
                        [data]
                    );
                },

                decrypt(payload) {
                    return factory.invoke(
                        "decrypt",
                        [payload]
                    );
                }
            });
        }

        // --------------------------------------------------
        // STORAGE API
        // --------------------------------------------------

        createStorageAPI() {
            const factory = this;

            return Object.freeze({
                // Generic operations

                get(store, key) {
                    return factory.invoke(
                        "storageGet",
                        [store, key]
                    );
                },

                put(store, key, value) {
                    return factory.invoke(
                        "storagePut",
                        [store, key, value]
                    );
                },

                delete(store, key) {
                    return factory.invoke(
                        "storageDelete",
                        [store, key]
                    );
                },

                getAll(store) {
                    return factory.invoke(
                        "storageGetAll",
                        [store]
                    );
                },

                clear(store) {
                    return factory.invoke(
                        "storageClear",
                        [store]
                    );
                },

                // Website operations

                getWebsite(guid) {
                    return factory.invoke(
                        "storageGetWebsite",
                        [guid]
                    );
                },

                saveWebsite(website) {
                    return factory.invoke(
                        "storageSaveWebsite",
                        [website]
                    );
                },

                upsertWebsite(website) {
                    return factory.invoke(
                        "storageUpsertWebsite",
                        [website]
                    );
                },

                deleteWebsite(guid) {
                    return factory.invoke(
                        "storageDeleteWebsite",
                        [guid]
                    );
                },

                getAllWebsites() {
                    return factory.invoke(
                        "storageGetAllWebsites",
                        []
                    );
                },

                // Result operations

                getResult(resultGuid) {
                    return factory.invoke(
                        "storageGetResult",
                        [resultGuid]
                    );
                },

                saveResult(result) {
                    return factory.invoke(
                        "storageSaveResult",
                        [result]
                    );
                },

                deleteResult(resultGuid) {
                    return factory.invoke(
                        "storageDeleteResult",
                        [resultGuid]
                    );
                },

                getAllResults() {
                    return factory.invoke(
                        "storageGetAllResults",
                        []
                    );
                },

                // Execution operations

                getExecution(guid) {
                    return factory.invoke(
                        "storageGetExecution",
                        [guid]
                    );
                },

                saveExecution(record) {
                    return factory.invoke(
                        "storageSaveExecution",
                        [record]
                    );
                },

                deleteExecution(guid) {
                    return factory.invoke(
                        "storageDeleteExecution",
                        [guid]
                    );
                },

                getAllExecutions() {
                    return factory.invoke(
                        "storageGetAllExecutions",
                        []
                    );
                },

                getExecutionsByModule(moduleId) {
                    return factory.invoke(
                        "storageGetExecutionsByModule",
                        [moduleId]
                    );
                },

                // Metadata operations

                getMetadata(key) {
                    return factory.invoke(
                        "storageGetMetadata",
                        [key]
                    );
                },

                saveMetadata(key, value) {
                    return factory.invoke(
                        "storageSaveMetadata",
                        [key, value]
                    );
                },

                deleteMetadata(key) {
                    return factory.invoke(
                        "storageDeleteMetadata",
                        [key]
                    );
                },

                // Import / Export

                exportAll() {
                    return factory.invoke(
                        "storageExportAll",
                        []
                    );
                },

                importAll(payload, options = {}) {
                    return factory.invoke(
                        "storageImportAll",
                        [payload, options]
                    );
                },

                // Status

                getStatus() {
                    return factory.invoke(
                        "storageGetStatus",
                        []
                    );
                }
            });
        }

        // --------------------------------------------------
        // SITE INTELLIGENCE API
        // --------------------------------------------------

        createSiteIntelligenceAPI() {
            const factory = this;

            return Object.freeze({

                // Resource discovery

                discover(url, options = {}) {
                    return factory.invoke(
                        "siteIntelligenceDiscover",
                        [url, options]
                    );
                },

                discoverMany(urls, options = {}) {
                    return factory.invoke(
                        "siteIntelligenceDiscoverMany",
                        [urls, options]
                    );
                },

                // Resource scanning

                scan(url, options = {}) {
                    return factory.invoke(
                        "siteIntelligenceScan",
                        [url, options]
                    );
                },

                async fetch(url, requestOptions = {}) {
                    const method = String(requestOptions.method || "GET").toUpperCase();
                    if (method !== "GET" && method !== "HEAD") {
                        throw new Error("Site Intelligence fetch supports GET/HEAD only.");
                    }
                    const result = await factory.invoke("siteIntelligenceScan", [url, {
                        needContent: method !== "HEAD",
                        source: "Module",
                        force: true
                    }]);
                    const headers = result.record?.headers || {};
                    const body = method === "HEAD" ? "" : (result.content || "");
                    const headerBag = {
                        get(name) { return headers[String(name).toLowerCase()] ?? null; },
                        entries() { return Object.entries(headers)[Symbol.iterator](); },
                        forEach(callback) {
                            Object.entries(headers).forEach(([key, value]) => callback(value, key));
                        }
                    };
                    return {
                        ok: result.status >= 200 && result.status < 300,
                        status: result.status || 0,
                        statusText: "",
                        url: result.url || String(url),
                        redirected: false,
                        type: "basic",
                        headers: headerBag,
                        async text() { return body; },
                        async json() { return JSON.parse(body); },
                        async arrayBuffer() { return new TextEncoder().encode(body).buffer; },
                        async blob() { return new Blob([body], { type: headers["content-type"] || "" }); },
                        clone() { return this; }
                    };
                },

                scanMany(urls, options = {}) {
                    return factory.invoke(
                        "siteIntelligenceScanMany",
                        [urls, options]
                    );
                },

                scanForModule(moduleId, ModuleClass, url, options = {}) {
                    return factory.invoke(
                        "siteIntelligenceScanForModule",
                        [moduleId, ModuleClass, url, options]
                    );
                },

                // Resource access

                getResource(url) {
                    return factory.invoke(
                        "siteIntelligenceGetResource",
                        [url]
                    );
                },

                getAllResources() {
                    return factory.invoke(
                        "siteIntelligenceGetAllResources",
                        []
                    );
                },

                hasResource(url) {
                    return factory.invoke(
                        "siteIntelligenceHasResource",
                        [url]
                    );
                },

                isResourceFresh(url, ttl) {
                    return factory.invoke(
                        "siteIntelligenceIsResourceFresh",
                        [url, ttl]
                    );
                },

                // Site structure

                getStructure(options = {}) {
                    return factory.invoke(
                        "siteIntelligenceGetStructure",
                        [options]
                    );
                },

                getNode(path) {
                    return factory.invoke(
                        "siteIntelligenceGetNode",
                        [path]
                    );
                },

                getChildren(path) {
                    return factory.invoke(
                        "siteIntelligenceGetChildren",
                        [path]
                    );
                },

                getParent(path) {
                    return factory.invoke(
                        "siteIntelligenceGetParent",
                        [path]
                    );
                },

                getAncestors(path) {
                    return factory.invoke(
                        "siteIntelligenceGetAncestors",
                        [path]
                    );
                },

                // Resource filtering

                getResourcesByStatus(status) {
                    return factory.invoke(
                        "siteIntelligenceGetResourcesByStatus",
                        [status]
                    );
                },

                getResourcesBySource(source) {
                    return factory.invoke(
                        "siteIntelligenceGetResourcesBySource",
                        [source]
                    );
                },

                // Statistics and status

                getStatistics() {
                    return factory.invoke(
                        "siteIntelligenceGetStatistics",
                        []
                    );
                },

                getStatus() {
                    return factory.invoke(
                        "siteIntelligenceGetStatus",
                        []
                    );
                },

                // Events

                on(event, callback) {
                    return factory.invoke(
                        "siteIntelligenceOn",
                        [event, callback]
                    );
                },

                off(event, callback) {
                    return factory.invoke(
                        "siteIntelligenceOff",
                        [event, callback]
                    );
                }
            });
        }

        // --------------------------------------------------
        // MODULE SCAN POLICY
        // --------------------------------------------------

        async getModuleScanPolicy(id, ModuleClass) {
            const validTTLs = [
                "always",
                "1h",
                "6h",
                "12h",
                "1d",
                "3d",
                "7d",
                "30d",
                "90d",
                "permanent"
            ];

            const declared =
                ModuleClass &&
                ModuleClass.scanPolicy &&
                typeof ModuleClass.scanPolicy === "object"
                    ? ModuleClass.scanPolicy
                    : {};

            const scope = [
                "origin-root",
                "directory"
            ].includes(declared.scope)
                ? declared.scope
                : "origin-root";

            const defaultTTL = validTTLs.includes(
                declared.defaultTTL
            )
                ? declared.defaultTTL
                : "7d";

            let settings = {};

            try {
                settings = await this.framework.Storage.getMetadata(
                    "module-settings:" + id
                ) || {};
            } catch (error) {
                console.error(
                    "[Anonymous Inspector] Module settings read failed:",
                    id,
                    error
                );
            }

            const ttl = Object.prototype.hasOwnProperty.call(
                settings,
                "ttl"
            ) && validTTLs.includes(settings.ttl)
                ? settings.ttl
                : defaultTTL;

            return {
                scope,
                defaultTTL,
                ttl
            };
        }

        // --------------------------------------------------
        // VIEWER API
        // --------------------------------------------------

        createViewerAPI() {
            const factory = this;

            return Object.freeze({
                getAll() {
                    return factory.invoke("viewerGetAll", []);
                },

                find(resource) {
                    return factory.invoke("viewerFind", [resource]);
                },

                get(id) {
                    return factory.invoke("viewerGet", [id]);
                },

                isAvailable(id) {
                    return factory.invoke("viewerIsAvailable", [id]);
                },

                open(id, context = {}) {
                    return factory.invoke("viewerOpen", [id, context]);
                },

                close() {
                    return factory.invoke("viewerClose", []);
                },

                getCurrent() {
                    return factory.invoke("viewerGetCurrent", []);
                }
            });
        }

        // --------------------------------------------------
        // FRAMEWORK CREATION
        // --------------------------------------------------

        create() {
            if (this.framework) {
                return this.framework;
            }

            const factory = this;

            const api = {
                version: this.version,

                // Base classes
                BaseModule: this.BaseModule,
                BaseSettings: this.BaseSettings,

                // Module registration
                register(id, ModuleClass) {
                    return factory.invoke(
                        "registerModule",
                        [id, ModuleClass]
                    );
                },

                registerSettings(id, SettingsClass) {
                    return factory.invoke(
                        "registerSettings",
                        [id, SettingsClass]
                    );
                },

                // Network
                requestText(url) {
                    return factory.invoke(
                        "requestText",
                        [url]
                    );
                },

                requestArrayBuffer(url) {
                    return factory.invoke(
                        "requestArrayBuffer",
                        [url]
                    );
                },

                // Utilities
                createElement(tag, attributes = {}, children = []) {
                    return factory.invoke(
                        "createElement",
                        [tag, attributes, children]
                    );
                },

                getCurrentDirectory() {
                    return factory.invoke(
                        "getCurrentDirectory",
                        []
                    );
                },

                copy(text) {
                    return factory.invoke(
                        "copy",
                        [text]
                    );
                },

                open(url) {
                    return factory.invoke(
                        "open",
                        [url]
                    );
                },

                // General configuration
                getConfig() {
                    return factory.invoke(
                        "getConfig",
                        []
                    );
                },

                setConfig(updates) {
                    return factory.invoke(
                        "setConfig",
                        [updates]
                    );
                },

                // Site configuration
                getSitesConfig() {
                    return factory.invoke(
                        "getSitesConfig",
                        []
                    );
                },

                setSitesConfig(sites) {
                    return factory.invoke(
                        "setSitesConfig",
                        [sites]
                    );
                },

                // Configured modules
                getConfiguredModules() {
                    return factory.invoke(
                        "getConfiguredModules",
                        []
                    );
                },

                setModuleEnabled(id, enabled) {
                    return factory.invoke(
                        "setModuleEnabled",
                        [id, enabled]
                    );
                },

                getModuleTTL(id) {
                    return factory.invoke(
                        "getModuleTTL",
                        [id]
                    );
                },

                setModuleTTL(id, ttl) {
                    return factory.invoke(
                        "setModuleTTL",
                        [id, ttl]
                    );
                },

                getModuleScanPolicy(id, ModuleClass) {
                    return factory.getModuleScanPolicy(
                        id,
                        ModuleClass
                    );
                },

                // Settings UI
                openSettings() {
                    return factory.invoke(
                        "openSettings",
                        []
                    );
                },

                closeSettings() {
                    return factory.invoke(
                        "closeSettings",
                        []
                    );
                },

                // Encryption services
                Crypto: factory.createCryptoAPI(),

                // Storage services
                Storage: factory.createStorageAPI(),

                // Site Intelligence service
                SiteIntelligence:
                    factory.createSiteIntelligenceAPI(),

                // Viewer infrastructure
                Viewers: factory.createViewerAPI()
            };

            this.framework = Object.freeze(api);

            return this.framework;
        }
    }

    // --------------------------------------------------
    // GLOBAL EXPORT
    // --------------------------------------------------

    root.AnonymousInspectorFrameworkFactory = FrameworkFactory;

})(globalThis);
