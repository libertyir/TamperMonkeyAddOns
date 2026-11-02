
(function (root) {
    "use strict";

    const VERSION = "2.0.0";

    const BASE_URL =
        "https://libertyir.github.io/TamperMonkeyAddOns/AnonymousInspectorHub/";

    const CORE_FILES = [
        "Core/Application.js",
        "Core/Framework.js",
        "Core/ModuleManager.js",
        "Core/SettingsManager.js",
        "Core/SiteManager.js",
        "Core/CryptoManager.js",
        "Core/StorageManager.js",
        "Storage/IndexedDBAdapter.js"
    ];

    const CONFIG_KEY = "aih_general_config";
    const MODULES_CONFIG_KEY = "aih_modules_config";
    const CRYPTO_KEY = "aih_encryption_key";

    const DEFAULT_CONFIG = Object.freeze({
        maxConcurrentModules: 4,
        requestTimeout: 20000,
        showInitializationSummary: true
    });

    const state = {
        started: false,
        config: { ...DEFAULT_CONFIG },
        configuredModuleIds: [],
        activeModules: [],
        activeSettings: [],
        progress: {
            total: 0,
            completed: 0,
            failed: 0
        },
        ui: null,
        application: null,
        services: {},
        Framework: null
    };

    // --------------------------------------------------
    // TAMPERMONKEY STORAGE
    // --------------------------------------------------

    const GM = {
        getValue(key, fallback) {
            if (typeof GM_getValue !== "function") {
                throw new Error("GM_getValue is unavailable.");
            }

            return GM_getValue(key, fallback);
        },

        setValue(key, value) {
            if (typeof GM_setValue !== "function") {
                throw new Error("GM_setValue is unavailable.");
            }

            return GM_setValue(key, value);
        },

        deleteValue(key) {
            if (typeof GM_deleteValue === "function") {
                return GM_deleteValue(key);
            }

            if (typeof GM_setValue === "function") {
                return GM_setValue(key, null);
            }

            throw new Error("GM storage is unavailable.");
        },

        get api() {
            return {
                getValue: this.getValue.bind(this),
                setValue: this.setValue.bind(this),
                deleteValue: this.deleteValue.bind(this),
                xmlHttpRequest:
                    typeof GM_xmlhttpRequest === "function"
                        ? GM_xmlhttpRequest
                        : undefined,
                setClipboard:
                    typeof GM_setClipboard === "function"
                        ? GM_setClipboard
                        : undefined
            };
        }
    };

    // --------------------------------------------------
    // CONFIGURATION
    // --------------------------------------------------

    function normalizeConfig(config = {}) {
        const result = { ...DEFAULT_CONFIG };

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

        if (typeof config.showInitializationSummary === "boolean") {
            result.showInitializationSummary =
                config.showInitializationSummary;
        }

        return result;
    }

    function loadConfig() {
        const saved = GM.getValue(CONFIG_KEY, null);

        state.config = saved && typeof saved === "object"
            ? normalizeConfig(saved)
            : { ...DEFAULT_CONFIG };
    }

    function getConfig() {
        return { ...state.config };
    }

    function setConfig(updates) {
        if (
            !updates ||
            typeof updates !== "object" ||
            Array.isArray(updates)
        ) {
            throw new Error("Invalid configuration.");
        }

        const allowed = Object.keys(DEFAULT_CONFIG);

        for (const key of Object.keys(updates)) {
            if (!allowed.includes(key)) {
                throw new Error("Unknown configuration key: " + key);
            }
        }

        const normalized = normalizeConfig({
            ...state.config,
            ...updates
        });

        for (const key of Object.keys(updates)) {
            if (normalized[key] !== updates[key]) {
                throw new Error("Invalid configuration value: " + key);
            }
        }

        GM.setValue(CONFIG_KEY, normalized);
        state.config = normalized;

        return getConfig();
    }

    // --------------------------------------------------
    // MODULE CONFIGURATION
    // --------------------------------------------------

    function getDisabledModules() {
        const saved = GM.getValue(MODULES_CONFIG_KEY, []);

        if (!Array.isArray(saved)) {
            return [];
        }

        return [...new Set(saved.filter(id =>
            typeof id === "string" &&
            /^[a-zA-Z0-9_-]+$/.test(id)
        ))];
    }

    function getConfiguredModules() {
        const disabled = new Set(getDisabledModules());

        return state.configuredModuleIds.map(id => ({
            id,
            enabled: !disabled.has(id)
        }));
    }

    function setModuleEnabled(id, enabled) {
        if (!state.configuredModuleIds.includes(id)) {
            throw new Error("Unknown module: " + id);
        }

        if (typeof enabled !== "boolean") {
            throw new Error("Invalid module state.");
        }

        const disabled = new Set(getDisabledModules());

        if (enabled) {
            disabled.delete(id);
        } else {
            disabled.add(id);
        }

        GM.setValue(MODULES_CONFIG_KEY, [...disabled]);

        return enabled;
    }

    // --------------------------------------------------
    // NETWORK
    // --------------------------------------------------

    function createCacheBustedUrl(url) {
        const separator = url.includes("?") ? "&" : "?";

        return url + separator +
            "_aih=" + Date.now() +
            "_" + Math.random().toString(36).slice(2);
    }

    function request(url, responseType = "text") {
        return new Promise((resolve, reject) => {
            if (typeof GM_xmlhttpRequest !== "function") {
                reject(new Error("GM_xmlhttpRequest is unavailable."));
                return;
            }

            GM_xmlhttpRequest({
                method: "GET",
                url: createCacheBustedUrl(url),
                responseType:
                    responseType === "arraybuffer"
                        ? "arraybuffer"
                        : "text",
                timeout: state.config.requestTimeout,
                headers: {
                    "Cache-Control": "no-cache, no-store",
                    "Pragma": "no-cache",
                    "Expires": "0"
                },

                onload(response) {
                    if (response.status >= 200 && response.status < 300) {
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

                    reject(new Error("HTTP " + response.status));
                },

                onerror() {
                    reject(new Error("Network request failed."));
                },

                ontimeout() {
                    reject(new Error("Request timed out."));
                }
            });
        });
    }

    function requestText(url) {
        return request(url, "text");
    }

    function requestArrayBuffer(url) {
        return request(url, "arraybuffer");
    }

    // --------------------------------------------------
    // DOM HELPERS
    // --------------------------------------------------

    function createElement(tag, attributes = {}, children = []) {
        const element = document.createElement(tag);

        for (const [key, value] of Object.entries(attributes)) {
            if (key === "className") {
                element.className = value;
            } else if (key === "textContent") {
                element.textContent = value;
            } else if (key === "innerHTML") {
                element.innerHTML = value;
            } else if (key.startsWith("on") && typeof value === "function") {
                element.addEventListener(
                    key.slice(2).toLowerCase(),
                    value
                );
            } else if (value !== null && value !== undefined) {
                element.setAttribute(key, value);
            }
        }

        for (const child of children) {
            if (child instanceof Node) {
                element.appendChild(child);
            } else if (child !== null && child !== undefined) {
                element.appendChild(
                    document.createTextNode(String(child))
                );
            }
        }

        return element;
    }

    function copy(value) {
        if (typeof GM_setClipboard === "function") {
            GM_setClipboard(String(value));
            return;
        }

        return navigator.clipboard.writeText(String(value));
    }

    function open(url) {
        window.open(url, "_blank", "noopener,noreferrer");
    }

    function getCurrentDirectory() {
        return new URL(".", window.location.href).href;
    }

    // --------------------------------------------------
    // CORE LOADER
    // --------------------------------------------------

    async function loadCore() {
        for (const path of CORE_FILES) {
            const url = BASE_URL + path;
            const source = await requestText(url);

            if (typeof source !== "string" || !source.trim()) {
                throw new Error("Core file unavailable: " + path);
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
            "AnonymousInspectorIndexedDBAdapter"
        ];

        for (const name of required) {
            if (typeof root[name] !== "function") {
                throw new Error("Core component not loaded: " + name);
            }
        }
    }

    // --------------------------------------------------
    // SERVICE CONSTRUCTION
    // --------------------------------------------------

    function createServices() {
        const Application = root.AnonymousInspectorApplication;
        const FrameworkFactory = root.AnonymousInspectorFrameworkFactory;

        const application = new Application({
            version: VERSION
        });

        const siteManager = new root.AnonymousInspectorSiteManager({
            storageKey: "aih_sites_config",
            getValue: GM.getValue,
            setValue: GM.setValue
        });

        const cryptoManager = new root.AnonymousInspectorCryptoManager({
            storageKey: CRYPTO_KEY,
            getValue: GM.getValue,
            setValue: GM.setValue
        });

        const indexedDBAdapter =
            new root.AnonymousInspectorIndexedDBAdapter({
                databaseName: "AnonymousInspectorHub",
                databaseVersion: 1
            });

        const storageManager =
            new root.AnonymousInspectorStorageManager({
                defaultAdapter: "indexedDB"
            });

        storageManager.registerAdapter(
            "indexedDB",
            indexedDBAdapter
        );

        const frameworkFactory = new FrameworkFactory({
            version: VERSION,

            registerModule: (id, ModuleClass) =>
                moduleManager.register(id, ModuleClass),

            registerSettings: (id, SettingsClass) =>
                settingsManager.register(id, SettingsClass),

            requestText,
            requestArrayBuffer,
            createElement,
            getCurrentDirectory,
            copy,
            open,

            getConfig,
            setConfig,

            getSitesConfig: () => siteManager.getAll(),
            setSitesConfig: sites => siteManager.setAll(sites),

            getConfiguredModules,
            setModuleEnabled,

            openSettings,
            closeSettings
        });

        const Framework = frameworkFactory.create();

        const moduleManager =
            new root.AnonymousInspectorModuleManager({
                baseUrl: BASE_URL + "Modules/",
                requestText,
                Framework,
                BaseModule: Framework.BaseModule,
                gm: GM.api,
                onError(id, error) {
                    console.error(
                        "[Anonymous Inspector] Module error:",
                        id,
                        error
                    );
                }
            });

        const settingsManager =
            new root.AnonymousInspectorSettingsManager({
                manifestUrl: BASE_URL + "Settings/manifest.json",
                baseUrl: BASE_URL + "Settings/",
                requestText,
                Framework,
                BaseSettings: Framework.BaseSettings,
                gm: GM.api,
                onRefresh: refreshMenu,
                onError(id, error) {
                    console.error(
                        "[Anonymous Inspector] Settings error:",
                        id,
                        error
                    );
                }
            });

        application.registerService("sites", siteManager);
        application.registerService("crypto", cryptoManager);
        application.registerService("storage", storageManager);

        application.registerService("settings", {
            initialize: () => settingsManager.loadAll(),
            destroy: () => settingsManager.destroyAll()
        });

        state.application = application;
        state.Framework = Framework;

        state.services = {
            application,
            frameworkFactory,
            Framework,
            moduleManager,
            settingsManager,
            siteManager,
            cryptoManager,
            storageManager,
            indexedDBAdapter
        };
    }

    // --------------------------------------------------
    // UI
    // --------------------------------------------------

    function injectStyles() {
        if (document.getElementById("aih-styles")) return;

        const style = createElement("style", {
            id: "aih-styles",
            textContent: `
                #aih-root {
                    position: fixed;
                    right: 20px;
                    bottom: 20px;
                    z-index: 2147483647;
                    font-family: Arial, sans-serif;
                    color: #eee;
                }

                #aih-button {
                    width: 48px;
                    height: 48px;
                    border: 1px solid #555;
                    border-radius: 50%;
                    background: #171717;
                    color: white;
                    font-size: 24px;
                    cursor: pointer;
                }

                #aih-menu {
                    display: none;
                    position: absolute;
                    right: 0;
                    bottom: 58px;
                    width: 280px;
                    max-height: 65vh;
                    overflow: auto;
                    background: #171717;
                    border: 1px solid #444;
                    border-radius: 8px;
                }

                .aih-menu-item {
                    display: flex;
                    gap: 12px;
                    width: 100%;
                    padding: 12px;
                    border: 0;
                    border-bottom: 1px solid #333;
                    background: transparent;
                    color: #eee;
                    text-align: left;
                    cursor: pointer;
                }

                .aih-menu-item:hover {
                    background: #292929;
                }

                #aih-progress {
                    position: absolute;
                    right: 0;
                    bottom: 58px;
                    width: 220px;
                    padding: 12px;
                    background: #171717;
                    border: 1px solid #444;
                    border-radius: 8px;
                    pointer-events: none;
                }

                #aih-progress-track {
                    height: 5px;
                    overflow: hidden;
                    background: #333;
                    border-radius: 5px;
                }

                #aih-progress-bar {
                    width: 0;
                    height: 100%;
                    background: #4caf50;
                }

                #aih-panel {
                    display: none;
                    position: fixed;
                    inset: 5%;
                    z-index: 2147483647;
                    overflow: auto;
                    padding: 20px;
                    background: #171717;
                    color: #eee;
                    border: 1px solid #555;
                    border-radius: 8px;
                }

                #aih-panel-close {
                    float: right;
                    padding: 7px 12px;
                    background: #333;
                    color: white;
                    border: 1px solid #555;
                    cursor: pointer;
                }

                #aih-panel-content {
                    clear: both;
                    padding-top: 15px;
                }

                .aih-settings-layout {
                    display: flex;
                    gap: 20px;
                }

                .aih-settings-nav {
                    width: 190px;
                    flex-shrink: 0;
                }

                .aih-settings-nav button {
                    display: block;
                    width: 100%;
                    padding: 10px;
                    margin-bottom: 5px;
                    background: transparent;
                    color: #ddd;
                    border: 0;
                    text-align: left;
                    cursor: pointer;
                }

                .aih-settings-nav button.active,
                .aih-settings-nav button:hover {
                    background: #303030;
                }

                .aih-settings-view {
                    flex: 1;
                    min-width: 0;
                }

                @media(max-width:600px) {
                    #aih-panel { inset: 2%; padding: 12px; }
                    .aih-settings-layout { flex-direction: column; }
                    .aih-settings-nav { width: 100%; }
                }
            `
        });

        document.head.appendChild(style);
    }

    function closePanel() {
        const panel = document.getElementById("aih-panel");
        const content = document.getElementById("aih-panel-content");

        if (panel) panel.style.display = "none";
        if (content) content.replaceChildren();
    }

    function renderModule(instance, target) {
        target.replaceChildren();

        try {
            const result = instance.render();

            if (result instanceof Node) {
                target.appendChild(result);
            } else if (result !== null && result !== undefined) {
                target.textContent = String(result);
            }
        } catch (error) {
            target.textContent = "Rendering failed: " + error.message;
        }
    }

    function showModule(instance) {
        const panel = document.getElementById("aih-panel");
        const content = document.getElementById("aih-panel-content");

        renderModule(instance, content);
        panel.style.display = "block";

        document.getElementById("aih-menu").style.display = "none";
    }

    function showSettings(instance, button, view) {
        document.querySelectorAll(".aih-settings-nav button")
            .forEach(item => item.classList.remove("active"));

        button.classList.add("active");
        renderModule(instance, view);
    }

    function openSettings() {
        if (!state.ui) return;

        const panel = document.getElementById("aih-panel");
        const content = document.getElementById("aih-panel-content");

        content.replaceChildren();

        content.appendChild(createElement("h2", {
            textContent: "Anonymous Inspector Settings"
        }));

        if (!state.activeSettings.length) {
            content.appendChild(createElement("p", {
                textContent: "No settings modules are available."
            }));

            panel.style.display = "block";
            return;
        }

        const layout = createElement("div", {
            className: "aih-settings-layout"
        });

        const nav = createElement("div", {
            className: "aih-settings-nav"
        });

        const view = createElement("div", {
            className: "aih-settings-view"
        });

        layout.append(nav, view);
        content.appendChild(layout);

        state.activeSettings.forEach((instance, index) => {
            const metadata = instance.getMetadata();

            const button = createElement("button", {
                type: "button",
                textContent:
                    (metadata.icon ? metadata.icon + " " : "") +
                    (metadata.title || metadata.id)
            });

            button.addEventListener("click", () => {
                showSettings(instance, button, view);
            });

            nav.appendChild(button);

            if (index === 0) {
                showSettings(instance, button, view);
            }
        });

        panel.style.display = "block";
        document.getElementById("aih-menu").style.display = "none";
    }

    function closeSettings() {
        closePanel();
    }

    function refreshMenu() {
        const menu = document.getElementById("aih-menu");
        if (!menu) return;

        menu.replaceChildren();

        const settingsButton = createElement("button", {
            className: "aih-menu-item",
            textContent: "Settings"
        });

        settingsButton.addEventListener("click", openSettings);
        menu.appendChild(settingsButton);

        for (const instance of state.activeModules) {
            const metadata = instance.getMetadata();

            const button = createElement("button", {
                className: "aih-menu-item"
            });

            button.appendChild(createElement("span", {
                textContent: metadata.icon || "◉"
            }));

            button.appendChild(createElement("span", {
                textContent: metadata.title || metadata.id
            }));

            button.addEventListener("click", () => {
                showModule(instance);
            });

            menu.appendChild(button);
        }
    }

    function updateProgress() {
        const progress = state.progress;
        const label = document.getElementById("aih-progress-label");
        const bar = document.getElementById("aih-progress-bar");

        if (!label || !bar) return;

        const percent = progress.total
            ? Math.round(progress.completed / progress.total * 100)
            : 100;

        label.textContent =
            "Scanning modules: " +
            progress.completed + " / " + progress.total +
            " (" + percent + "%)" +
            (progress.failed ? " | Failed: " + progress.failed : "");

        bar.style.width = percent + "%";
    }

    function finishProgress() {
        const progress = document.getElementById("aih-progress");

        if (progress) progress.style.display = "none";

        const button = document.getElementById("aih-button");

        if (button) {
            button.textContent = "◉";
            button.title = "Anonymous Inspector";
        }
    }

    function createUI() {
        if (state.ui) return;

        injectStyles();

        const rootElement = createElement("div", {
            id: "aih-root"
        });

        const button = createElement("button", {
            id: "aih-button",
            type: "button",
            title: "Anonymous Inspector",
            textContent: "◉"
        });

        const menu = createElement("div", {
            id: "aih-menu"
        });

        const progress = createElement("div", {
            id: "aih-progress"
        });

        const label = createElement("div", {
            id: "aih-progress-label",
            textContent: "Initializing..."
        });

        const track = createElement("div", {
            id: "aih-progress-track"
        });

        const bar = createElement("div", {
            id: "aih-progress-bar"
        });

        track.appendChild(bar);
        progress.append(label, track);

        const panel = createElement("div", {
            id: "aih-panel"
        });

        const closeButton = createElement("button", {
            id: "aih-panel-close",
            type: "button",
            textContent: "Close"
        });

        const content = createElement("div", {
            id: "aih-panel-content"
        });

        closeButton.addEventListener("click", closePanel);

        button.addEventListener("click", () => {
            menu.style.display =
                menu.style.display === "block" ? "none" : "block";
        });

        panel.append(closeButton, content);
        rootElement.append(button, menu, progress);
        document.body.append(rootElement, panel);

        state.ui = rootElement;

        document.addEventListener("keydown", event => {
            if (event.key === "Escape") {
                closePanel();
                menu.style.display = "none";
            }
        });

        document.addEventListener("click", event => {
            if (
                !rootElement.contains(event.target) &&
                !panel.contains(event.target)
            ) {
                menu.style.display = "none";
            }
        });

        refreshMenu();
    }

    // --------------------------------------------------
    // MODULE EXECUTION
    // --------------------------------------------------

    async function runModules(moduleIds) {
        state.progress = {
            total: moduleIds.length,
            completed: 0,
            failed: 0
        };

        updateProgress();

        const result = await state.services.moduleManager.initializeMany(
            moduleIds,
            {
                concurrency: state.config.maxConcurrentModules,

                onProgress(progress) {
                    state.progress.completed = progress.completed;
                    state.progress.failed = progress.failed;

                    state.activeModules =
                        state.services.moduleManager.getActiveInstances();

                    refreshMenu();
                    updateProgress();
                }
            }
        );

        state.activeModules =
            state.services.moduleManager.getActiveInstances();

        finishProgress();

        return result;
    }

    // --------------------------------------------------
    // TAMPERMONKEY MENU
    // --------------------------------------------------

    function registerTampermonkeyMenu() {
        if (typeof GM_registerMenuCommand !== "function") return;

        GM_registerMenuCommand(
            "Anonymous Inspector Hub - Settings",
            openSettings
        );
    }

    // --------------------------------------------------
    // MAIN ENTRY POINT
    // --------------------------------------------------

    async function AnonymousInspector(...moduleIds) {
        if (state.started) return;

        state.started = true;

        try {
            loadConfig();

            state.configuredModuleIds = [
                ...new Set(moduleIds)
            ];

            await loadCore();
            createServices();

            await state.application.start();

            state.activeSettings =
                state.services.settingsManager.getActiveInstances();

            const disabled = new Set(getDisabledModules());

            const globallyEnabled = state.configuredModuleIds.filter(
                id => !disabled.has(id)
            );

            const allowed = state.services.siteManager.getAllowedModules(
                globallyEnabled,
                window.location.hostname
            );

            createUI();

            await new Promise(resolve =>
                requestAnimationFrame(resolve)
            );

            const result = await runModules(allowed);

            refreshMenu();

            if (state.config.showInitializationSummary) {
                console.info(
                    "[Anonymous Inspector] Initialization complete:",
                    {
                        version: VERSION,
                        total: result.total,
                        loaded: result.loaded,
                        failed: result.failed,
                        settings: state.activeSettings.length,
                        hostname: window.location.hostname,
                        allowedModules: allowed
                    }
                );
            }

        } catch (error) {
            console.error(
                "[Anonymous Inspector] Startup failed:",
                error
            );

            const label = document.getElementById(
                "aih-progress-label"
            );

            if (label) {
                label.textContent = "Initialization failed: " +
                    error.message;
            }
        }
    }

    // --------------------------------------------------
    // GLOBAL EXPORTS
    // --------------------------------------------------

    root.AnonymousInspectorFramework = null;
    root.AnonymousInspector = AnonymousInspector;

    registerTampermonkeyMenu();

})(globalThis);
