
(function (root) {
    "use strict";

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

            this.storageAdapterName = "gm";
            this.websiteGuid = null;

            this.started = false;
            this.state = "created";
            this.startPromise = null;
            this.bootstrapPromise = null;

            // Runtime services
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

            // Infrastructure components
            this.coreLoader = null;
            this.serviceFactory = null;
            this.serviceRegistrar = null;

            // Kernel components
            this.environment = null;
            this.kernelConfig = null;
            this.applicationStartup = null;
            this.siteInitializer = null;
            this.moduleRunner = null;

            this.services = {};
            this.onUIReady = null;
        }

        // --------------------------------------------------
        // COMPONENT LOADING
        // --------------------------------------------------

        async fetchBootstrapFile(path) {
            return new Promise((resolve, reject) => {
                const request = this.gm.xmlHttpRequest;

                if (typeof request !== "function") {
                    reject(new Error(
                        "GM_xmlhttpRequest is unavailable."
                    ));
                    return;
                }

                const url = this.baseUrl + path;

                request({
                    method: "GET",
                    url: url + "?_aih=" + Date.now(),
                    responseType: "text",
                    timeout: this.config.requestTimeout,

                    headers: {
                        "Cache-Control": "no-cache, no-store",
                        "Pragma": "no-cache"
                    },

                    onload: response => {
                        if (
                            response.status >= 200 &&
                            response.status < 300 &&
                            typeof response.responseText === "string"
                        ) {
                            resolve(response.responseText);
                            return;
                        }

                        reject(new Error(
                            "Unable to load " + path +
                            ": HTTP " + response.status
                        ));
                    },

                    onerror: () => reject(
                        new Error("Network request failed: " + path)
                    ),

                    ontimeout: () => reject(
                        new Error("Request timed out: " + path)
                    )
                });
            });
        }

        async loadComponent(path, globalName) {
            const source = await this.fetchBootstrapFile(path);
            const url = this.baseUrl + path;

            new Function(
                source + "\n//# sourceURL=" + url
            )();

            if (typeof root[globalName] !== "function") {
                throw new Error(
                    "Component was not registered: " + globalName
                );
            }

            return root[globalName];
        }

        async loadKernelComponents() {
            if (
                this.environment &&
                this.kernelConfig &&
                this.applicationStartup &&
                this.siteInitializer &&
                this.moduleRunner
            ) {
                return;
            }

            await this.loadComponent(
                "Core/KernelEnvironment.js",
                "AnonymousInspectorKernelEnvironment"
            );

            this.environment =
                new root.AnonymousInspectorKernelEnvironment(this);

            await this.loadComponent(
                "Core/KernelConfig.js",
                "AnonymousInspectorKernelConfig"
            );

            await this.loadComponent(
                "Core/SiteInitializer.js",
                "AnonymousInspectorSiteInitializer"
            );

            await this.loadComponent(
                "Core/ModuleRunner.js",
                "AnonymousInspectorModuleRunner"
            );

            await this.loadComponent(
                "Core/ApplicationStartup.js",
                "AnonymousInspectorApplicationStartup"
            );

            this.kernelConfig =
                new root.AnonymousInspectorKernelConfig(this);

            this.siteInitializer =
                new root.AnonymousInspectorSiteInitializer(this);

            this.moduleRunner =
                new root.AnonymousInspectorModuleRunner(this);

            this.applicationStartup =
                new root.AnonymousInspectorApplicationStartup(this);
        }

        // --------------------------------------------------
        // ENVIRONMENT FACADE
        // --------------------------------------------------

        get GM() {
            if (!this.environment) {
                throw new Error(
                    "KernelEnvironment has not been initialized."
                );
            }

            return this.environment.GM;
        }

        request(url, responseType = "text") {
            return this.environment.request(url, responseType);
        }

        requestText(url) {
            return this.environment.requestText(url);
        }

        requestArrayBuffer(url) {
            return this.environment.requestArrayBuffer(url);
        }

        createCacheBustedUrl(url) {
            return this.environment.createCacheBustedUrl(url);
        }

        createElement(tag, attributes = {}, children = []) {
            return this.environment.createElement(
                tag,
                attributes,
                children
            );
        }

        copy(value) {
            return this.environment.copy(value);
        }

        open(url) {
            return this.environment.open(url);
        }

        getCurrentDirectory() {
            return this.environment.getCurrentDirectory();
        }

        getStorageAdapterDefinition() {
            return this.environment.getStorageAdapterDefinition();
        }

        loadScript(path) {
            return this.environment.loadScript(path);
        }

        // --------------------------------------------------
        // CONFIGURATION FACADE
        // --------------------------------------------------

        normalizeConfig(config = {}) {
            return this.kernelConfig.normalizeConfig(config);
        }

        loadConfig() {
            return this.kernelConfig.loadConfig();
        }

        getConfig() {
            return this.kernelConfig.getConfig();
        }

        setConfig(updates) {
            return this.kernelConfig.setConfig(updates);
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
            const disabled = new Set(this.getDisabledModules());

            return this.configuredModuleIds.map(id => ({
                id,
                enabled: !disabled.has(id)
            }));
        }

        setModuleEnabled(id, enabled) {
            return this.kernelConfig.setModuleEnabled(id, enabled);
        }

        // --------------------------------------------------
        // CORE BOOTSTRAP
        // --------------------------------------------------

        async loadBootstrap() {
            if (this.bootstrapPromise) {
                return this.bootstrapPromise;
            }

            this.bootstrapPromise = (async () => {
                await this.loadKernelComponents();

                await this.loadComponent(
                    "Core/CoreLoader.js",
                    "AnonymousInspectorCoreLoader"
                );

                this.coreLoader =
                    new root.AnonymousInspectorCoreLoader({
                        requestText: url => this.requestText(url),
                        baseUrl: this.baseUrl,

                        getStorageAdapterDefinition: () =>
                            this.getStorageAdapterDefinition()
                    });

                await this.coreLoader.load();

                await this.loadComponent(
                    "Core/ServiceFactory.js",
                    "AnonymousInspectorServiceFactory"
                );

                await this.loadComponent(
                    "Core/ServiceRegistrar.js",
                    "AnonymousInspectorServiceRegistrar"
                );

                return this.coreLoader.getStatus();
            })();

            try {
                return await this.bootstrapPromise;
            } catch (error) {
                this.bootstrapPromise = null;
                throw error;
            }
        }

        // --------------------------------------------------
        // SERVICE LIFECYCLE
        // --------------------------------------------------

        createServices() {
            if (
                typeof root.AnonymousInspectorServiceFactory !==
                "function"
            ) {
                throw new Error("ServiceFactory is unavailable.");
            }

            this.serviceFactory =
                new root.AnonymousInspectorServiceFactory(this);

            this.services = this.serviceFactory.create();

            return this.services;
        }

        registerApplicationServices() {
            if (
                typeof root.AnonymousInspectorServiceRegistrar !==
                "function"
            ) {
                throw new Error("ServiceRegistrar is unavailable.");
            }

            this.serviceRegistrar =
                new root.AnonymousInspectorServiceRegistrar(this);

            this.serviceRegistrar.register();

            return this.application;
        }

        // --------------------------------------------------
        // SITE INITIALIZATION
        // --------------------------------------------------

        async registerCurrentWebsite() {
            const result = await this.siteInitializer.initialize(
                window.location.hostname
            );

            return result.website;
        }

        // --------------------------------------------------
        // MODULE EXECUTION
        // --------------------------------------------------

        runModules(moduleIds) {
            return this.moduleRunner.run(moduleIds);
        }

        // --------------------------------------------------
        // APPLICATION STARTUP
        // --------------------------------------------------

        start(...moduleArguments) {
            if (this.state === "running") {
                return Promise.resolve(this);
            }

            if (this.startPromise) {
                return this.startPromise;
            }

            const moduleIds =
                moduleArguments.length === 1 &&
                Array.isArray(moduleArguments[0])
                    ? moduleArguments[0]
                    : moduleArguments;

            this.startPromise =
                this.applicationStartup
                    ? this.applicationStartup.start(moduleIds)
                    : this.loadKernelComponents().then(() => {
                        return this.applicationStartup.start(moduleIds);
                    });

            return this.startPromise.finally(() => {
                this.startPromise = null;
            });
        }

        startApplication(moduleIds = []) {
            return this.applicationStartup.start(moduleIds);
        }

        // --------------------------------------------------
        // SHUTDOWN
        // --------------------------------------------------

        async stop() {
            if (this.application) {
                await this.application.stop();
            }

            this.started = false;
            this.state = "stopped";

            return this;
        }

        // --------------------------------------------------
        // STATUS
        // --------------------------------------------------

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
                    : null,

                coreLoader: this.coreLoader
                    ? this.coreLoader.getStatus()
                    : null
            };
        }
    }

    root.AnonymousInspectorKernel = Kernel;

})(globalThis);
