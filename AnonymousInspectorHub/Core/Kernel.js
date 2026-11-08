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

            this.environment = null;
            this.kernelConfig = null;
            this.applicationStartup = null;
            this.siteInitializer = null;
            this.moduleRunner = null;
            this.services = {};
            this.onUIReady = null;
        }

        // The environment cannot load itself; this is the one bootstrap request.
        fetchBootstrapFile(path) {
            const assetManager = root.AnonymousInspectorAssetManager;

            if (
                !assetManager ||
                !assetManager.initialized ||
                typeof assetManager.getText !== "function"
            ) {
                return Promise.reject(
                    new Error("AssetManager is not ready.")
                );
            }

            const source = assetManager.getText(path);

            if (typeof source !== "string") {
                return Promise.reject(
                    new Error("Project asset is not cached: " + path)
                );
            }

            return Promise.resolve(source);
        }

        async loadComponent(path, globalName) {
            const source = await this.fetchBootstrapFile(path);
            const url = this.baseUrl + path;

            new Function(source + "\n//# sourceURL=" + url)();

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

        // Environment facade
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
            return this.environment.createElement(tag, attributes, children);
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

        // Configuration facade
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
            return this.kernelConfig.getDisabledModules();
        }

        getConfiguredModules() {
            return this.kernelConfig.getConfiguredModules();
        }

        setModuleEnabled(id, enabled) {
            return this.kernelConfig.setModuleEnabled(id, enabled);
        }

        async loadBootstrap() {
            if (this.bootstrapPromise) {
                return this.bootstrapPromise;
            }

            this.bootstrapPromise = (async () => {
                await this.loadComponent(
                    "Core/CoreLoader.js",
                    "AnonymousInspectorCoreLoader"
                );

                this.coreLoader = new root.AnonymousInspectorCoreLoader({
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

        createServices() {
            if (
                typeof root.AnonymousInspectorServiceFactory !== "function"
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
                typeof root.AnonymousInspectorServiceRegistrar !== "function"
            ) {
                throw new Error("ServiceRegistrar is unavailable.");
            }
            this.serviceRegistrar =
                new root.AnonymousInspectorServiceRegistrar(this);
            this.serviceRegistrar.register();
            return this.application;
        }

        runModules(moduleIds, options = {}) {
            return this.moduleRunner.run(moduleIds, options);
        }

        startModules(options = {}) {
            if (this.modulesStarted) {
                return Promise.resolve(this.moduleRunResult || this);
            }

            if (this.modulesStartPromise) {
                return this.modulesStartPromise;
            }

            if (this.state !== "running") {
                return Promise.reject(
                    new Error("Application shell is not ready.")
                );
            }

            this.modulesStartPromise = (async () => {
                const result = await this.runModules(
                    this.allowedModuleIds || [],
                    options
                );

                if (!options.loadOnly) {
                    this.modulesStarted = true;
                }

                this.moduleRunResult = result;

                return result;
            })();

            return this.modulesStartPromise.finally(() => {
                this.modulesStartPromise = null;
            });
        }

        start(...moduleArguments) {
            if (this.state === "running") {
                return Promise.resolve(this);
            }
            if (this.startPromise) {
                return this.startPromise;
            }
            if (this.state === "stopping") {
                return Promise.reject(
                    new Error("Kernel is currently stopping.")
                );
            }

            const moduleIds =
                moduleArguments.length === 1 &&
                Array.isArray(moduleArguments[0])
                    ? moduleArguments[0]
                    : moduleArguments;

            this.startPromise = (async () => {
                await this.loadKernelComponents();
                return this.applicationStartup.start(moduleIds);
            })();

            return this.startPromise.finally(() => {
                this.startPromise = null;
            });
        }

        startApplication(moduleIds = []) {
            return this.start(...(Array.isArray(moduleIds) ? moduleIds : []));
        }

        async stop() {
            if (this.startPromise) {
                try {
                    await this.startPromise;
                } catch {
                    // Shutdown must continue after a failed startup.
                }
            }

            if (this.application) {
                await this.application.stop();
            }

            this.started = false;
            this.modulesStarted = false;
            this.modulesStartPromise = null;
            this.allowedModuleIds = [];
            this.moduleRunResult = null;
            this.state = "stopped";
            return this;
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
                    : null,
                coreLoader: this.coreLoader
                    ? this.coreLoader.getStatus()
                    : null
            };
        }
    }

    root.AnonymousInspectorKernel = Kernel;
})(globalThis);
