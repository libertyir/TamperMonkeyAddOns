(function (root) {
    "use strict";

    class Kernel {
        constructor(options = {}) {
            this.version = options.version || "2.0.0";

            this.baseUrl = (
                options.baseUrl ||
                "https://libertyir.github.io/TamperMonkeyAddOns/AnonymousInspectorHub/"
            ).replace(/\/?$/, "/");

            // Tampermonkey APIs injected by main.js
            this.gm = options.gm || {};

            this.configKey = "aih_general_config";
            this.modulesConfigKey = "aih_modules_config";
            this.sitesConfigKey = "aih_sites_config";
            this.cryptoKey = "aih_encryption_key";

            this.defaultConfig = Object.freeze({
                maxConcurrentModules: 4,
                requestTimeout: 20000,
                showInitializationSummary: true
            });

            this.config = { ...this.defaultConfig };
            this.configuredModuleIds = [];

            this.started = false;
            this.startPromise = null;
            this.state = "created";

            this.application = null;
            this.frameworkFactory = null;
            this.Framework = null;

            this.moduleManager = null;
            this.settingsManager = null;
            this.siteManager = null;
            this.cryptoManager = null;
            this.storageManager = null;
            this.indexedDBAdapter = null;
            this.uiManager = null;

            this.services = {};
        }

        // --------------------------------------------------
        // TAMPERMONKEY API
        // --------------------------------------------------

        get GM() {
            const api = this.gm;

            return {
                getValue: (key, fallback) => {
                    if (typeof api.getValue !== "function") {
                        throw new Error(
                            "GM_getValue is unavailable. Check userscript @grant."
                        );
                    }

                    return api.getValue(key, fallback);
                },

                setValue: (key, value) => {
                    if (typeof api.setValue !== "function") {
                        throw new Error(
                            "GM_setValue is unavailable. Check userscript @grant."
                        );
                    }

                    return api.setValue(key, value);
                },

                deleteValue: key => {
                    if (typeof api.deleteValue === "function") {
                        return api.deleteValue(key);
                    }

                    if (typeof api.setValue === "function") {
                        return api.setValue(key, null);
                    }

                    throw new Error("GM storage is unavailable.");
                },

                get api() {
                    return {
                        getValue: this.getValue,
                        setValue: this.setValue,
                        deleteValue: this.deleteValue,

                        xmlHttpRequest: api.xmlHttpRequest || undefined,
                        setClipboard: api.setClipboard || undefined
                    };
                }
            };
        }

        // --------------------------------------------------
        // CONFIGURATION
        // --------------------------------------------------

        normalizeConfig(config = {}) {
            const result = { ...this.defaultConfig };

            if (
                Number.isInteger(config.maxConcurrentModules) &&
                config.maxConcurrentModules >= 1 &&
                config.maxConcurrentModules <= 10
            ) {
                result.maxConcurrentModules =
                    config.maxConcurrentModules;
            }

            if (
                Number.isInteger(config.requestTimeout) &&
                config.requestTimeout >= 5000 &&
                config.requestTimeout <= 120000
            ) {
                result.requestTimeout = config.requestTimeout;
            }

            if (
                typeof config.showInitializationSummary === "boolean"
            ) {
                result.showInitializationSummary =
                    config.showInitializationSummary;
            }

            return result;
        }

        loadConfig() {
            const saved = this.GM.getValue(
                this.configKey,
                null
            );

            this.config = saved && typeof saved === "object"
                ? this.normalizeConfig(saved)
                : { ...this.defaultConfig };
        }

        getConfig() {
            return { ...this.config };
        }

        setConfig(updates) {
            if (
                !updates ||
                typeof updates !== "object" ||
                Array.isArray(updates)
            ) {
                throw new Error("Invalid configuration.");
            }

            const allowed = Object.keys(this.defaultConfig);

            for (const key of Object.keys(updates)) {
                if (!allowed.includes(key)) {
                    throw new Error(
                        "Unknown configuration key: " + key
                    );
                }
            }

            const normalized = this.normalizeConfig({
                ...this.config,
                ...updates
            });

            for (const key of Object.keys(updates)) {
                if (normalized[key] !== updates[key]) {
                    throw new Error(
                        "Invalid configuration value: " + key
                    );
                }
            }

            this.GM.setValue(this.configKey, normalized);
            this.config = normalized;

            return this.getConfig();
        }

        getDisabledModules() {
            const saved = this.GM.getValue(
                this.modulesConfigKey,
                []
            );

            if (!Array.isArray(saved)) {
                return [];
            }

            return [...new Set(
                saved.filter(id =>
                    typeof id === "string" &&
                    /^[a-zA-Z0-9_-]+$/.test(id)
                )
            )];
        }

        getConfiguredModules() {
            const disabled = new Set(
                this.getDisabledModules()
            );

            return this.configuredModuleIds.map(id => ({
                id,
                enabled: !disabled.has(id)
            }));
        }

        setModuleEnabled(id, enabled) {
            if (!this.configuredModuleIds.includes(id)) {
                throw new Error("Unknown module: " + id);
            }

            if (typeof enabled !== "boolean") {
                throw new Error("Invalid module state.");
            }

            const disabled = new Set(
                this.getDisabledModules()
            );

            if (enabled) {
                disabled.delete(id);
            } else {
                disabled.add(id);
            }

            this.GM.setValue(
                this.modulesConfigKey,
                [...disabled]
            );

            return enabled;
        }

        // --------------------------------------------------
        // NETWORK
        // --------------------------------------------------

        createCacheBustedUrl(url) {
            const separator = url.includes("?") ? "&" : "?";

            return url +
                separator +
                "_aih=" +
                Date.now() +
                "_" +
                Math.random().toString(36).slice(2);
        }

        request(url, responseType = "text") {
            return new Promise((resolve, reject) => {
                const requestAPI = this.gm.xmlHttpRequest;

                if (typeof requestAPI !== "function") {
                    reject(
                        new Error(
                            "GM_xmlhttpRequest is unavailable. Check userscript @grant."
                        )
                    );
                    return;
                }

                requestAPI({
                    method: "GET",
                    url: this.createCacheBustedUrl(url),

                    responseType:
                        responseType === "arraybuffer"
                            ? "arraybuffer"
                            : "text",

                    timeout: this.config.requestTimeout,

                    headers: {
                        "Cache-Control": "no-cache, no-store",
                        "Pragma": "no-cache",
                        "Expires": "0"
                    },

                    onload: response => {
                        if (
                            response.status >= 200 &&
                            response.status < 300
                        ) {
                            resolve(
                                responseType === "arraybuffer"
                                    ? response.response
                                    : response.responseText
                            );

                            return;
                        }

                        if ([401, 403, 404].includes(response.status)) {
                            resolve(null);
                            return;
                        }

                        reject(
                            new Error("HTTP " + response.status)
                        );
                    },

                    onerror: () => {
                        reject(
                            new Error("Network request failed.")
                        );
                    },

                    ontimeout: () => {
                        reject(
                            new Error("Request timed out.")
                        );
                    }
                });
            });
        }

        requestText(url) {
            return this.request(url, "text");
        }

        requestArrayBuffer(url) {
            return this.request(url, "arraybuffer");
        }

        // --------------------------------------------------
        // DOM AND BROWSER UTILITIES
        // --------------------------------------------------

        createElement(tag, attributes = {}, children = []) {
            const element = document.createElement(tag);

            for (const [key, value] of Object.entries(attributes)) {
                if (key === "className") {
                    element.className = value;

                } else if (key === "textContent") {
                    element.textContent = value;

                } else if (key === "innerHTML") {
                    element.innerHTML = value;

                } else if (
                    key.startsWith("on") &&
                    typeof value === "function"
                ) {
                    element.addEventListener(
                        key.slice(2).toLowerCase(),
                        value
                    );

                } else if (
                    value !== null &&
                    value !== undefined
                ) {
                    element.setAttribute(key, value);
                }
            }

            for (const child of children) {
                if (child instanceof Node) {
                    element.appendChild(child);

                } else if (
                    child !== null &&
                    child !== undefined
                ) {
                    element.appendChild(
                        document.createTextNode(String(child))
                    );
                }
            }

            return element;
        }

        copy(value) {
            const clipboardAPI = this.gm.setClipboard;

            if (typeof clipboardAPI === "function") {
                clipboardAPI(String(value));
                return;
            }

            return navigator.clipboard.writeText(String(value));
        }

        open(url) {
            window.open(
                url,
                "_blank",
                "noopener,noreferrer"
            );
        }

        getCurrentDirectory() {
            return new URL(".", window.location.href).href;
        }

        // --------------------------------------------------
        // CORE LOADER
        // --------------------------------------------------

        async loadCore() {
            const files = [
                "Core/Application.js",
                "Core/Framework.js",
                "Core/ModuleManager.js",
                "Core/SettingsManager.js",
                "Core/SiteManager.js",
                "Core/CryptoManager.js",
                "Core/StorageManager.js",
                "Storage/IndexedDBAdapter.js",
                "Core/UIManager.js"
            ];

            for (const path of files) {
                const url = this.baseUrl + path;
                const source = await this.requestText(url);

                if (
                    typeof source !== "string" ||
                    !source.trim()
                ) {
                    throw new Error(
                        "Core file unavailable: " + path
                    );
                }

                new Function(
                    source + "\n//# sourceURL=" + url
                )();
            }

            const required = [
                "AnonymousInspectorApplication",
                "AnonymousInspectorFrameworkFactory",
                "AnonymousInspectorModuleManager",
                "AnonymousInspectorSettingsManager",
                "AnonymousInspectorSiteManager",
                "AnonymousInspectorCryptoManager",
                "AnonymousInspectorStorageManager",
                "AnonymousInspectorIndexedDBAdapter",
                "AnonymousInspectorUIManager"
            ];

            for (const name of required) {
                if (typeof root[name] !== "function") {
                    throw new Error(
                        "Core component not loaded: " + name
                    );
                }
            }
        }

        // --------------------------------------------------
        // SERVICE CONSTRUCTION
        // --------------------------------------------------

        createServices() {
            const GM = this.GM;

            let moduleManager;
            let settingsManager;
            let uiManager;

            const Application =
                root.AnonymousInspectorApplication;

            const FrameworkFactory =
                root.AnonymousInspectorFrameworkFactory;

            this.application = new Application({
                version: this.version
            });

            this.siteManager =
                new root.AnonymousInspectorSiteManager({
                    storageKey: this.sitesConfigKey,
                    getValue: GM.getValue,
                    setValue: GM.setValue
                });

            this.cryptoManager =
                new root.AnonymousInspectorCryptoManager({
                    storageKey: this.cryptoKey,
                    getValue: GM.getValue,
                    setValue: GM.setValue
                });

            this.indexedDBAdapter =
                new root.AnonymousInspectorIndexedDBAdapter({
                    databaseName: "AnonymousInspectorHub",
                    databaseVersion: 2
                });

            this.storageManager =
                new root.AnonymousInspectorStorageManager({
                    defaultAdapter: "indexedDB"
                });

            this.storageManager.registerAdapter(
                "indexedDB",
                this.indexedDBAdapter
            );

            this.frameworkFactory = new FrameworkFactory({
                version: this.version,

                registerModule: (id, ModuleClass) =>
                    moduleManager.register(id, ModuleClass),

                registerSettings: (id, SettingsClass) =>
                    settingsManager.register(id, SettingsClass),

                requestText: url => this.requestText(url),
                requestArrayBuffer: url =>
                    this.requestArrayBuffer(url),

                createElement: (tag, attributes, children) =>
                    this.createElement(tag, attributes, children),

                getCurrentDirectory: () =>
                    this.getCurrentDirectory(),

                copy: value => this.copy(value),
                open: url => this.open(url),

                // CRYPTO API
                getEncryptionKey: () =>
                    this.cryptoManager.getKey(),

                getCryptoAlgorithm: () =>
                    this.cryptoManager.getAlgorithm(),

                getCryptoStatus: () =>
                    this.cryptoManager.getStatus(),

                encrypt: data =>
                    this.cryptoManager.encrypt(data),

                decrypt: payload =>
                    this.cryptoManager.decrypt(payload),

                // STORAGE API
                storageGet: (store, key) =>
                    this.storageManager.get(store, key),

                storagePut: (store, key, value) =>
                    this.storageManager.put(store, key, value),

                storageDelete: (store, key) =>
                    this.storageManager.delete(store, key),

                storageGetAll: store =>
                    this.storageManager.getAll(store),

                storageClear: store =>
                    this.storageManager.clear(store),

                // Website storage
                storageGetWebsite: guid =>
                    this.storageManager.getWebsite(guid),

                storageSaveWebsite: website =>
                    this.storageManager.saveWebsite(website),

                storageUpsertWebsite: website =>
                    this.storageManager.upsertWebsite(website),

                storageDeleteWebsite: guid =>
                    this.storageManager.deleteWebsite(guid),

                storageGetAllWebsites: () =>
                    this.storageManager.getAllWebsites(),

                // Result storage
                storageGetResult: guid =>
                    this.storageManager.getResult(guid),

                storageSaveResult: result =>
                    this.storageManager.saveResult(result),

                storageDeleteResult: guid =>
                    this.storageManager.deleteResult(guid),

                storageGetAllResults: () =>
                    this.storageManager.getAllResults(),

                // Execution storage
                storageGetExecution: guid =>
                    this.storageManager.getExecution(guid),

                storageSaveExecution: record =>
                    this.storageManager.saveExecution(record),

                storageDeleteExecution: guid =>
                    this.storageManager.deleteExecution(guid),

                storageGetAllExecutions: () =>
                    this.storageManager.getAllExecutions(),

                storageGetExecutionsByModule: moduleId =>
                    this.storageManager.getExecutionsByModule(moduleId),

                // Metadata storage
                storageGetMetadata: key =>
                    this.storageManager.getMetadata(key),

                storageSaveMetadata: (key, value) =>
                    this.storageManager.saveMetadata(key, value),

                storageDeleteMetadata: key =>
                    this.storageManager.deleteMetadata(key),

                // Import / Export
                storageExportAll: () =>
                    this.storageManager.exportAll(),

                storageImportAll: (payload, options) =>
                    this.storageManager.importAll(payload, options),

                storageGetStatus: () =>
                    this.storageManager.getStatus(),

                // CONFIGURATION
                getConfig: () => this.getConfig(),
                setConfig: updates => this.setConfig(updates),

                getSitesConfig: () => this.siteManager.getAll(),
                setSitesConfig: sites => this.siteManager.setAll(sites),

                getConfiguredModules: () =>
                    this.getConfiguredModules(),

                setModuleEnabled: (id, enabled) =>
                    this.setModuleEnabled(id, enabled),

                openSettings: () => {
                    if (uiManager) {
                        uiManager.openSettings();
                    }
                },

                closeSettings: () => {
                    if (uiManager) {
                        uiManager.closePanel();
                    }
                }
            });

            this.Framework = this.frameworkFactory.create();

            moduleManager =
                new root.AnonymousInspectorModuleManager({
                    baseUrl: this.baseUrl + "Modules/",
                    requestText: url => this.requestText(url),
                    Framework: this.Framework,
                    BaseModule: this.Framework.BaseModule,
                    gm: GM.api
                });

            settingsManager =
                new root.AnonymousInspectorSettingsManager({
                    manifestUrl:
                        this.baseUrl + "Settings/manifest.json",

                    baseUrl: this.baseUrl + "Settings/",
                    requestText: url => this.requestText(url),
                    Framework: this.Framework,
                    BaseSettings: this.Framework.BaseSettings,
                    gm: GM.api,

                    onRefresh: () => {
                        if (uiManager) {
                            uiManager.refreshMenu();
                        }
                    }
                });

            uiManager =
                new root.AnonymousInspectorUIManager({
                    version: this.version,

                    createElement: (tag, attributes, children) =>
                        this.createElement(tag, attributes, children),

                    onOpenSettings: () =>
                        uiManager.openSettings(),

                    getModules: () =>
                        moduleManager.getActiveInstances(),

                    getSettings: () =>
                        settingsManager.getActiveInstances()
                });

            this.moduleManager = moduleManager;
            this.settingsManager = settingsManager;
            this.uiManager = uiManager;

            this.services = {
                application: this.application,
                frameworkFactory: this.frameworkFactory,
                Framework: this.Framework,
                moduleManager,
                settingsManager,
                siteManager: this.siteManager,
                cryptoManager: this.cryptoManager,
                storageManager: this.storageManager,
                indexedDBAdapter: this.indexedDBAdapter,
                uiManager
            };

            this.registerApplicationServices();

            return this.services;
        }

        // --------------------------------------------------
        // APPLICATION LIFECYCLE
        // --------------------------------------------------

        registerApplicationServices() {
            const app = this.application;

            app.registerService("sites", this.siteManager);
            app.registerService("crypto", this.cryptoManager);
            app.registerService("storage", this.storageManager);

            app.registerService("settings", {
                initialize: () => this.settingsManager.loadAll(),
                destroy: () => this.settingsManager.destroyAll()
            });

            app.registerService("ui", this.uiManager);
        }

        // --------------------------------------------------
        // MODULE EXECUTION
        // --------------------------------------------------

        async runModules(moduleIds) {
            const ids = [...new Set(moduleIds)];

            this.uiManager.showProgress(
                ids.length
                    ? "Initializing modules..."
                    : "No modules to initialize."
            );

            if (!ids.length) {
                this.uiManager.hideProgress();

                return {
                    results: [],
                    total: 0,
                    completed: 0,
                    failed: 0,
                    loaded: 0
                };
            }

            const result = await this.moduleManager.initializeMany(
                ids,
                {
                    concurrency: this.config.maxConcurrentModules,

                    onProgress: progress => {
                        this.uiManager.setProgress(progress);
                        this.uiManager.refreshMenu();
                    }
                }
            );

            this.uiManager.refreshMenu();
            this.uiManager.hideProgress();

            return result;
        }

        // --------------------------------------------------
        // TAMPERMONKEY MENU
        // --------------------------------------------------

        registerTampermonkeyMenu() {
            const registerMenuCommand =
                this.gm.registerMenuCommand;

            if (typeof registerMenuCommand !== "function") {
                return;
            }

            registerMenuCommand(
                "Anonymous Inspector Hub - Settings",
                () => this.uiManager.openSettings()
            );
        }

        // --------------------------------------------------
        // STARTUP
        // --------------------------------------------------

        async start(...moduleArguments) {
            if (this.state === "running") {
                return this;
            }

            if (this.startPromise) {
                return this.startPromise;
            }

            const moduleIds =
                moduleArguments.length === 1 &&
                Array.isArray(moduleArguments[0])
                    ? moduleArguments[0]
                    : moduleArguments;

            this.startPromise = this.startApplication(moduleIds);

            try {
                return await this.startPromise;
            } finally {
                this.startPromise = null;
            }
        }

        async startApplication(moduleIds) {
            this.state = "starting";

            try {
                this.loadConfig();

                this.configuredModuleIds = [
                    ...new Set(moduleIds)
                ];

                await this.loadCore();

                this.createServices();

                await this.application.start({
                    kernel: this,
                    hostname: window.location.hostname
                });

                const disabled = new Set(
                    this.getDisabledModules()
                );

                const globallyEnabled =
                    this.configuredModuleIds.filter(
                        id => !disabled.has(id)
                    );

                const allowed =
                    this.siteManager.getAllowedModules(
                        globallyEnabled,
                        window.location.hostname
                    );

                await this.runModules(allowed);

                this.uiManager.refreshMenu();
                this.registerTampermonkeyMenu();

                this.started = true;
                this.state = "running";

                if (this.config.showInitializationSummary) {
                    console.info(
                        "[Anonymous Inspector] Initialization complete:",
                        {
                            version: this.version,
                            totalModules: allowed.length,
                            loaded: this.moduleManager.getActiveIds().length,
                            settings:
                                this.settingsManager.getActiveIds().length,
                            hostname: window.location.hostname,
                            allowedModules: allowed
                        }
                    );
                }

                return this;

            } catch (error) {
                this.state = "failed";

                console.error(
                    "[Anonymous Inspector] Startup failed:",
                    error
                );

                if (this.uiManager) {
                    this.uiManager.showProgress(
                        "Initialization failed: " + error.message
                    );
                }

                throw error;
            }
        }

        // --------------------------------------------------
        // SHUTDOWN AND STATUS
        // --------------------------------------------------

        async stop() {
            if (this.application) {
                await this.application.stop();
            }

            this.started = false;
            this.state = "stopped";
        }

        getStatus() {
            return {
                version: this.version,
                state: this.state,
                started: this.started,

                application: this.application
                    ? this.application.getStatus()
                    : null,

                modules: this.moduleManager
                    ? this.moduleManager.getActiveIds()
                    : [],

                settings: this.settingsManager
                    ? this.settingsManager.getActiveIds()
                    : [],

                ui: this.uiManager
                    ? this.uiManager.getStatus()
                    : null
            };
        }
    }

    root.AnonymousInspectorKernel = Kernel;

})(globalThis);