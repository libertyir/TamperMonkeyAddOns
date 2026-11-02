
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
                    throw new Error(
                        "Module must implement init()"
                    );
                }

                render() {
                    throw new Error(
                        "Module must implement render()"
                    );
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
                }
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
