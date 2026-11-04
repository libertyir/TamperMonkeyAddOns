
(function (root) {
    "use strict";

    class ServiceFactory {
        constructor(kernel) {
            if (!kernel) {
                throw new Error(
                    "ServiceFactory requires a Kernel instance."
                );
            }

            this.kernel = kernel;
        }

        create() {
            const kernel = this.kernel;
            const GM = kernel.GM;

            let moduleManager;
            let settingsManager;
            let uiManager;

            const Application =
                root.AnonymousInspectorApplication;

            const FrameworkFactory =
                root.AnonymousInspectorFrameworkFactory;

            if (
                typeof Application !== "function" ||
                typeof FrameworkFactory !== "function"
            ) {
                throw new Error(
                    "Application or FrameworkFactory is unavailable."
                );
            }

            kernel.application = new Application({
                version: kernel.version
            });

            // --------------------------------------------------
            // STORAGE
            // --------------------------------------------------

            const adapterDefinition =
                kernel.getStorageAdapterDefinition();

            const AdapterClass =
                root[adapterDefinition.className];

            if (typeof AdapterClass !== "function") {
                throw new Error(
                    "Storage adapter class is unavailable: " +
                    adapterDefinition.className
                );
            }

            kernel.storageAdapter =
                adapterDefinition.create(
                    AdapterClass,
                    kernel
                );

            kernel.storageManager =
                new root.AnonymousInspectorStorageManager({
                    defaultAdapter: kernel.storageAdapterName
                });

            kernel.storageManager.registerAdapter(
                kernel.storageAdapterName,
                kernel.storageAdapter
            );

            // --------------------------------------------------
            // CRYPTO
            // --------------------------------------------------

            kernel.cryptoManager =
                new root.AnonymousInspectorCryptoManager({
                    storageKey: kernel.cryptoKey,
                    getValue: GM.getValue,
                    setValue: GM.setValue
                });

            // --------------------------------------------------
            // SITE MANAGER
            // --------------------------------------------------

            kernel.siteManager =
                new root.AnonymousInspectorSiteManager({
                    storageKey: kernel.sitesConfigKey,
                    getValue: GM.getValue,
                    setValue: GM.setValue
                });

            // --------------------------------------------------
            // SITE INTELLIGENCE
            // --------------------------------------------------

            kernel.siteIntelligenceService =
                new root.AnonymousInspectorSiteIntelligenceService({
                    storage: kernel.storageManager,

                    getModuleScanPolicy: (id, ModuleClass) =>
                        kernel.frameworkFactory.getModuleScanPolicy(
                            id,
                            ModuleClass
                        )
                });

            // --------------------------------------------------
            // FRAMEWORK
            // --------------------------------------------------

            kernel.frameworkFactory = new FrameworkFactory({
                version: kernel.version,

                registerModule: (id, ModuleClass) =>
                    moduleManager.register(id, ModuleClass),

                registerSettings: (id, SettingsClass) =>
                    settingsManager.register(id, SettingsClass),

                requestText: url =>
                    kernel.requestText(url),

                requestArrayBuffer: url =>
                    kernel.requestArrayBuffer(url),

                createElement: (tag, attributes, children) =>
                    kernel.createElement(
                        tag,
                        attributes,
                        children
                    ),

                getCurrentDirectory: () =>
                    kernel.getCurrentDirectory(),

                copy: value => kernel.copy(value),
                open: url => kernel.open(url),

                // CRYPTO API

                getEncryptionKey: () =>
                    kernel.cryptoManager.getKey(),

                getCryptoAlgorithm: () =>
                    kernel.cryptoManager.getAlgorithm(),

                getCryptoStatus: () =>
                    kernel.cryptoManager.getStatus(),

                encrypt: data =>
                    kernel.cryptoManager.encrypt(data),

                decrypt: payload =>
                    kernel.cryptoManager.decrypt(payload),

                // STORAGE API

                storageGet: (store, key) =>
                    kernel.storageManager.get(store, key),

                storagePut: (store, key, value) =>
                    kernel.storageManager.put(
                        store,
                        key,
                        value
                    ),

                storageDelete: (store, key) =>
                    kernel.storageManager.delete(store, key),

                storageGetAll: store =>
                    kernel.storageManager.getAll(store),

                storageClear: store =>
                    kernel.storageManager.clear(store),

                // WEBSITE STORAGE

                storageGetWebsite: guid =>
                    kernel.storageManager.getWebsite(guid),

                storageSaveWebsite: website =>
                    kernel.storageManager.saveWebsite(website),

                storageUpsertWebsite: website =>
                    kernel.storageManager.upsertWebsite(website),

                storageDeleteWebsite: guid =>
                    kernel.storageManager.deleteWebsite(guid),

                storageGetAllWebsites: () =>
                    kernel.storageManager.getAllWebsites(),

                // RESULT STORAGE

                storageGetResult: guid =>
                    kernel.storageManager.getResult(guid),

                storageSaveResult: result =>
                    kernel.storageManager.saveResult(result),

                storageDeleteResult: guid =>
                    kernel.storageManager.deleteResult(guid),

                storageGetAllResults: () =>
                    kernel.storageManager.getAllResults(),

                // EXECUTION STORAGE

                storageGetExecution: guid =>
                    kernel.storageManager.getExecution(guid),

                storageSaveExecution: record =>
                    kernel.storageManager.saveExecution(record),

                storageDeleteExecution: guid =>
                    kernel.storageManager.deleteExecution(guid),

                storageGetAllExecutions: () =>
                    kernel.storageManager.getAllExecutions(),

                storageGetExecutionsByModule: moduleId =>
                    kernel.storageManager.getExecutionsByModule(
                        moduleId
                    ),

                // METADATA STORAGE

                storageGetMetadata: key =>
                    kernel.storageManager.getMetadata(key),

                storageSaveMetadata: (key, value) =>
                    kernel.storageManager.saveMetadata(
                        key,
                        value
                    ),

                storageDeleteMetadata: key =>
                    kernel.storageManager.deleteMetadata(key),

                // IMPORT / EXPORT

                storageExportAll: () =>
                    kernel.storageManager.exportAll(),

                storageImportAll: (payload, options) =>
                    kernel.storageManager.importAll(
                        payload,
                        options
                    ),

                storageGetStatus: () =>
                    kernel.storageManager.getStatus(),

                // CONFIGURATION

                getConfig: () => kernel.getConfig(),

                setConfig: updates =>
                    kernel.setConfig(updates),

                getSitesConfig: () =>
                    kernel.siteManager.getAll(),

                setSitesConfig: sites =>
                    kernel.siteManager.setAll(sites),

                getConfiguredModules: () =>
                    kernel.getConfiguredModules(),

                setModuleEnabled: (id, enabled) =>
                    kernel.setModuleEnabled(id, enabled),

                getModuleTTL: async id => {
                    const ModuleClass = moduleManager.get(id);

                    if (!ModuleClass) {
                        return moduleManager.defaultTTL;
                    }

                    return moduleManager.getEffectiveTTL(
                        id,
                        ModuleClass
                    );
                },

                setModuleTTL: (id, ttl) =>
                    moduleManager.setModuleTTL(id, ttl),

                // SITE INTELLIGENCE API

                siteIntelligenceDiscover: (url, options) =>
                    kernel.siteIntelligenceService.discover(
                        url,
                        options
                    ),

                siteIntelligenceDiscoverMany: (urls, options) =>
                    kernel.siteIntelligenceService.discoverMany(
                        urls,
                        options
                    ),

                siteIntelligenceScan: (url, options) =>
                    kernel.siteIntelligenceService.scan(
                        url,
                        options
                    ),

                siteIntelligenceScanMany: (urls, options) =>
                    kernel.siteIntelligenceService.scanMany(
                        urls,
                        options
                    ),

                siteIntelligenceScanForModule: (
                    moduleId,
                    ModuleClass,
                    url,
                    options
                ) =>
                    kernel.siteIntelligenceService.scanForModule(
                        moduleId,
                        ModuleClass,
                        url,
                        options
                    ),

                siteIntelligenceGetResource: url =>
                    kernel.siteIntelligenceService.getResource(url),

                siteIntelligenceGetAllResources: () =>
                    kernel.siteIntelligenceService.getAllResources(),

                siteIntelligenceHasResource: url =>
                    kernel.siteIntelligenceService.hasResource(url),

                siteIntelligenceIsResourceFresh: (url, ttl) =>
                    kernel.siteIntelligenceService.isResourceFresh(
                        url,
                        ttl
                    ),

                siteIntelligenceGetStructure: options =>
                    kernel.siteIntelligenceService.getStructure(
                        options
                    ),

                siteIntelligenceGetNode: path =>
                    kernel.siteIntelligenceService.getNode(path),

                siteIntelligenceGetChildren: path =>
                    kernel.siteIntelligenceService.getChildren(path),

                siteIntelligenceGetParent: path =>
                    kernel.siteIntelligenceService.getParent(path),

                siteIntelligenceGetAncestors: path =>
                    kernel.siteIntelligenceService.getAncestors(path),

                siteIntelligenceGetResourcesByStatus: status =>
                    kernel.siteIntelligenceService.getResourcesByStatus(
                        status
                    ),

                siteIntelligenceGetResourcesBySource: source =>
                    kernel.siteIntelligenceService.getResourcesBySource(
                        source
                    ),

                siteIntelligenceGetStatistics: () =>
                    kernel.siteIntelligenceService.getStatistics(),

                siteIntelligenceGetStatus: () =>
                    kernel.siteIntelligenceService.getStatus(),

                siteIntelligenceOn: (event, callback) =>
                    kernel.siteIntelligenceService.on(
                        event,
                        callback
                    ),

                siteIntelligenceOff: (event, callback) =>
                    kernel.siteIntelligenceService.off(
                        event,
                        callback
                    ),

                // UI

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

            kernel.Framework =
                kernel.frameworkFactory.create();

            // --------------------------------------------------
            // MODULE MANAGER
            // --------------------------------------------------

            moduleManager =
                new root.AnonymousInspectorModuleManager({
                    baseUrl: kernel.baseUrl + "Modules/",
                    requestText: url => kernel.requestText(url),
                    Framework: kernel.Framework,
                    BaseModule: kernel.Framework.BaseModule,
                    gm: GM.api
                });

            // --------------------------------------------------
            // SETTINGS MANAGER
            // --------------------------------------------------

            settingsManager =
                new root.AnonymousInspectorSettingsManager({
                    manifestUrl:
                        kernel.baseUrl + "Settings/manifest.json",

                    baseUrl: kernel.baseUrl + "Settings/",
                    requestText: url => kernel.requestText(url),
                    Framework: kernel.Framework,
                    BaseSettings: kernel.Framework.BaseSettings,
                    gm: GM.api,

                    onRefresh: () => {
                        if (uiManager) {
                            uiManager.refreshMenu();
                        }
                    }
                });

            // --------------------------------------------------
            // UI MANAGER
            // --------------------------------------------------

            uiManager =
                new root.AnonymousInspectorUIManager({
                    version: kernel.version,

                    createElement: (tag, attributes, children) =>
                        kernel.createElement(
                            tag,
                            attributes,
                            children
                        ),

                    onOpenSettings: () =>
                        uiManager.openSettings(),

                    getModules: () =>
                        moduleManager.getActiveInstances(),

                    getSettings: () =>
                        settingsManager.getActiveInstances(),

                    getSettingsStatus: () =>
                        settingsManager.getStatus()
                });

            kernel.moduleManager = moduleManager;
            kernel.settingsManager = settingsManager;
            kernel.uiManager = uiManager;

            // --------------------------------------------------
            // SERVICES
            // --------------------------------------------------

            kernel.services = {
                application: kernel.application,
                frameworkFactory: kernel.frameworkFactory,
                Framework: kernel.Framework,
                moduleManager,
                settingsManager,
                siteManager: kernel.siteManager,
                cryptoManager: kernel.cryptoManager,
                storageManager: kernel.storageManager,
                storageAdapter: kernel.storageAdapter,
                siteIntelligenceService:
                    kernel.siteIntelligenceService,
                uiManager
            };

            return kernel.services;
        }
    }

    root.AnonymousInspectorServiceFactory = ServiceFactory;

})(globalThis);
