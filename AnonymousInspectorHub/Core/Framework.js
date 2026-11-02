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
                Storage: factory.createStorageAPI()
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