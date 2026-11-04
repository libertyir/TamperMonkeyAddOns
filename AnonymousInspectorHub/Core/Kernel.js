(function (root) {
    "use strict";

    // --------------------------------------------------
    // STORAGE ADAPTER CONFIGURATION
    // --------------------------------------------------

    const STORAGE_ADAPTER = "gm";

    const STORAGE_ADAPTER_REGISTRY = Object.freeze({
        gm: {
            path: "Storage/GMStorageAdapter.js",
            className: "AnonymousInspectorGMStorageAdapter",

            create: (AdapterClass, kernel) =>
                new AdapterClass({
                    gm: kernel.gm
                })
        },

        indexedDB: {
            path: "Storage/IndexedDBAdapter.js",
            className: "AnonymousInspectorIndexedDBAdapter",

            create: AdapterClass =>
                new AdapterClass({
                    databaseName: "AnonymousInspectorHub",
                    databaseVersion: 2
                })
        }
    });

    class Kernel {
        constructor(options = {}) {
            this.version = options.version || "2.0.0";

            this.baseUrl = (
                options.baseUrl ||
                "https://libertyir.github.io/TamperMonkeyAddOns/AnonymousInspectorHub/"
            ).replace(/\/?$/, "/");

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
            this.storageAdapter = null;
            this.siteIntelligenceService = null;
            this.uiManager = null;

            this.coreLoader = null;
            this.serviceFactory = null;
            this.serviceRegistrar = null;

            this.storageAdapterName = STORAGE_ADAPTER;
            this.websiteGuid = null;

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

                listValues: () => {
                    if (typeof api.listValues !== "function") {
                        throw new Error(
                            "GM_listValues is unavailable. Check userscript @grant."
                        );
                    }

                    return api.listValues();
                },

                get api() {
                    return {
                        getValue: this.getValue,
                        setValue: this.setValue,
                        deleteValue: this.deleteValue,
                        listValues: this.listValues,

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

        async setModuleEnabled(id, enabled) {
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

            if (!enabled && this.moduleManager) {
                await this.moduleManager.destroy(id);
            }

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
        // STORAGE ADAPTER REGISTRY
        // --------------------------------------------------

        getStorageAdapterDefinition() {
            const definition =
                STORAGE_ADAPTER_REGISTRY[this.storageAdapterName];

            if (!definition) {
                throw new Error(
                    "Unknown storage adapter: " +
                    this.storageAdapterName
                );
            }

            return definition;
        }

        // --------------------------------------------------
        // SCRIPT LOADING
        // --------------------------------------------------

        async loadScript(path) {
            const url = this.baseUrl + path;
            const source = await this.requestText(url);

            if (
                typeof source !== "string" ||
                !source.trim()
            ) {
                throw new Error(
                    "Script file unavailable: " + path
                );
            }

            new Function(
                source + "\n//# sourceURL=" + url
            )();
        }

        // --------------------------------------------------
        // BOOTSTRAP
        // --------------------------------------------------

        async loadBootstrap() {
            // CoreLoader must be loaded first because it loads
            // the application Core components.

            await this.loadScript("Core/CoreLoader.js");

            if (
                typeof root.AnonymousInspectorCoreLoader !== "function"
            ) {
                throw new Error(
                    "CoreLoader component could not be loaded."
                );
            }

            this.coreLoader =
                new root.AnonymousInspectorCoreLoader({
                    requestText: url => this.requestText(url),
                    baseUrl: this.baseUrl,

                    getStorageAdapterDefinition: () =>
                        this.getStorageAdapterDefinition()
                });

            await this.coreLoader.load();

            // These files depend on the Kernel instance but do not
            // require the application Core classes during evaluation.

            await this.loadScript("Core/ServiceFactory.js");
            await this.loadScript("Core/ServiceRegistrar.js");

            if (
                typeof root.AnonymousInspectorServiceFactory !== "function"
            ) {
                throw new Error(
                    "ServiceFactory component could not be loaded."
                );
            }

            if (
                typeof root.AnonymousInspectorServiceRegistrar !== "function"
            ) {
                throw new Error(
                    "ServiceRegistrar component could not be loaded."
                );
            }
        }

        // --------------------------------------------------
        // SERVICE CONSTRUCTION
        // --------------------------------------------------

        createServices() {
            this.serviceFactory =
                new root.AnonymousInspectorServiceFactory(this);

            this.services = this.serviceFactory.create();

            return this.services;
        }

        // --------------------------------------------------
        // SERVICE REGISTRATION
        // --------------------------------------------------

        registerApplicationServices() {
            this.serviceRegistrar =
                new root.AnonymousInspectorServiceRegistrar(this);

            this.serviceRegistrar.register();

            return this.application;
        }

        // --------------------------------------------------
        // WEBSITE REGISTRATION
        // --------------------------------------------------

        async registerCurrentWebsite() {
            const hostname = window.location.hostname;

            const website = await this.storageManager.upsertWebsite({
                domain: hostname
            });

            this.websiteGuid = website.guid;

            this.moduleManager.websiteGuid = website.guid;

            return website;
        }

        // --------------------------------------------------
        // MODULE EXECUTION
        // --------------------------------------------------

        async runModules(moduleIds) {
            const requestedIds = [...new Set(moduleIds)];

            const disabled = new Set(
                this.getDisabledModules()
            );

            const ids = requestedIds.filter(
                id => !disabled.has(id)
            );

            // Remove instances of modules that are now disabled.
            const activeIds = this.moduleManager.getActiveIds();

            const disabledActiveIds = activeIds.filter(
                id => disabled.has(id)
            );

            for (const id of disabledActiveIds) {
                await this.moduleManager.destroy(id);
            }

            this.uiManager.showProgress(
                ids.length
                    ? "Initializing modules..."
                    : "No modules to initialize."
            );

            if (!ids.length) {
                this.uiManager.refreshMenu();
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

                // Load CoreLoader, application Core files,
                // ServiceFactory and ServiceRegistrar.
                await this.loadBootstrap();

                // Construct service instances.
                this.createServices();

                // Register services in Application.
                this.registerApplicationServices();

                // Initialize registered services.
                await this.application.start({
                    kernel: this,
                    hostname: window.location.hostname
                });

                // Register the current website after storage is ready.
                await this.registerCurrentWebsite();

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

                this.started = true;
                this.state = "running";

                if (this.config.showInitializationSummary) {
                    console.info(
                        "[Anonymous Inspector] Initialization complete:",
                        {
                            version: this.version,
                            storageAdapter: this.storageAdapterName,
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

                siteIntelligence: this.siteIntelligenceService
                    ? this.siteIntelligenceService.getStatus()
                    : null,

                ui: this.uiManager
                    ? this.uiManager.getStatus()
                    : null
            };
        }
    }

    root.AnonymousInspectorKernel = Kernel;

})(globalThis);