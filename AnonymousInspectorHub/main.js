
(function (root) {
    "use strict";

    const VERSION = "1.4.0";
    const MAX_CONCURRENT_MODULES = 4;

    const BASE_URL =
        "https://libertyir.github.io/TamperMonkeyAddOns/AnonymousInspectorHub/";

    const MODULE_BASE = BASE_URL + "Modules/";
    const SETTINGS_BASE = BASE_URL + "Settings/";
    const SETTINGS_MANIFEST = SETTINGS_BASE + "manifest.json";

    const state = {
        modules: new Map(),
        active: [],

        settings: new Map(),
        activeSettings: [],

        ui: null,
        started: false,
        settingsLoaded: false,

        progress: {
            total: 0,
            completed: 0,
            failed: 0
        }
    };

    // --------------------------------------------------
    // NETWORK
    // --------------------------------------------------

    function createCacheBustedUrl(url) {
        const separator = url.includes("?") ? "&" : "?";

        return url + separator + "_aih=" + Date.now() +
            "_" + Math.random().toString(36).slice(2);
    }

    function requestText(url) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: "GET",
                url: createCacheBustedUrl(url),
                headers: {
                    "Cache-Control": "no-cache, no-store, must-revalidate",
                    "Pragma": "no-cache",
                    "Expires": "0"
                },
                timeout: 20000,

                onload(response) {
                    if (response.status >= 200 && response.status < 300) {
                        resolve(response.responseText);
                        return;
                    }

                    if ([401, 403, 404].includes(response.status)) {
                        resolve(null);
                        return;
                    }

                    reject(new Error("HTTP " + response.status));
                },

                onerror() {
                    reject(new Error("Network request failed"));
                },

                ontimeout() {
                    reject(new Error("Request timed out"));
                }
            });
        });
    }

    function requestArrayBuffer(url) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: "GET",
                url: createCacheBustedUrl(url),
                responseType: "arraybuffer",
                headers: {
                    "Cache-Control": "no-cache, no-store, must-revalidate",
                    "Pragma": "no-cache",
                    "Expires": "0"
                },
                timeout: 20000,

                onload(response) {
                    if (response.status >= 200 && response.status < 300) {
                        resolve(response.response);
                        return;
                    }

                    if ([401, 403, 404].includes(response.status)) {
                        resolve(null);
                        return;
                    }

                    reject(new Error("HTTP " + response.status));
                },

                onerror() {
                    reject(new Error("Network request failed"));
                },

                ontimeout() {
                    reject(new Error("Request timed out"));
                }
            });
        });
    }

    // --------------------------------------------------
    // HELPERS
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
                    key.substring(2).toLowerCase(),
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
                element.appendChild(document.createTextNode(String(child)));
            }
        }

        return element;
    }

    function getCurrentDirectory() {
        return new URL(".", window.location.href).href;
    }

    function copy(text) {
        if (typeof GM_setClipboard === "function") {
            GM_setClipboard(String(text));
            return;
        }

        navigator.clipboard.writeText(String(text));
    }

    function open(url) {
        window.open(url, "_blank", "noopener,noreferrer");
    }

    // --------------------------------------------------
    // MODULE SYSTEM
    // --------------------------------------------------

    class BaseModule {
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
    }

    function register(id, ModuleClass) {
        if (!id || typeof id !== "string") {
            throw new Error("Invalid module ID");
        }

        if (typeof ModuleClass !== "function") {
            throw new Error("Invalid module class");
        }

        if (!(ModuleClass.prototype instanceof BaseModule)) {
            throw new Error("Module must extend BaseModule");
        }

        state.modules.set(id, ModuleClass);
    }

    // --------------------------------------------------
    // SETTINGS SYSTEM
    // --------------------------------------------------

    class BaseSettings {
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

        render() {
            throw new Error("Settings module must implement render()");
        }

        destroy() { }
    }

    function registerSettings(id, SettingsClass) {
        if (!id || typeof id !== "string") {
            throw new Error("Invalid settings ID");
        }

        if (typeof SettingsClass !== "function") {
            throw new Error("Invalid settings class");
        }

        if (!(SettingsClass.prototype instanceof BaseSettings)) {
            throw new Error("Settings must extend BaseSettings");
        }

        state.settings.set(id, SettingsClass);
    }

    async function loadSettingsModule(id) {
        if (state.settings.has(id)) {
            return state.settings.get(id);
        }

        if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
            throw new Error("Invalid settings filename");
        }

        const url = SETTINGS_BASE + id + ".js";
        const source = await requestText(url);

        if (source === null) {
            throw new Error("Settings file unavailable: " + id);
        }

        const executeSettings = new Function(
            "Framework",
            source + "\n//# sourceURL=" + url
        );

        executeSettings(Framework);

        if (!state.settings.has(id)) {
            throw new Error("Settings did not register: " + id);
        }

        return state.settings.get(id);
    }

    async function loadSettings() {
        if (state.settingsLoaded) return;

        state.settingsLoaded = true;

        try {
            const source = await requestText(SETTINGS_MANIFEST);

            if (!source) {
                return;
            }

            const manifest = JSON.parse(source);

            const settingsIds = Array.isArray(manifest)
                ? manifest
                : manifest.modules;

            if (!Array.isArray(settingsIds)) {
                throw new Error("Invalid settings manifest");
            }

            for (const id of settingsIds) {
                try {
                    const SettingsClass = await loadSettingsModule(id);
                    const instance = new SettingsClass();

                    try {
                        if (typeof instance.init === "function") {
                            await instance.init();
                        }

                        if (instance.available) {
                            state.activeSettings.push(instance);
                        } else {
                            safelyDestroy(instance);
                        }
                    } catch (error) {
                        safelyDestroy(instance);
                        throw error;
                    }
                } catch (error) {
                    console.error(
                        "[Anonymous Inspector] Settings load failed:",
                        id,
                        error
                    );
                }
            }

            refreshMenu();

        } catch (error) {
            console.error(
                "[Anonymous Inspector] Settings initialization failed:",
                error
            );
        }
    }

    // --------------------------------------------------
    // FRAMEWORK API
    // --------------------------------------------------

    const Framework = Object.freeze({
        version: VERSION,

        BaseModule,
        BaseSettings,

        register,
        registerSettings,

        requestText,
        requestArrayBuffer,

        createElement,
        getCurrentDirectory,
        copy,
        open,

        openSettings,
        closeSettings
    });

    // --------------------------------------------------
    // STYLES
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
                    color: #fff;
                    font-size: 25px;
                    cursor: pointer;
                    box-shadow: 0 3px 12px rgba(0,0,0,.45);
                }

                #aih-button:disabled {
                    cursor: wait;
                    opacity: .8;
                }

                #aih-menu {
                    display: none;
                    position: absolute;
                    right: 0;
                    bottom: 58px;
                    width: 280px;
                    max-height: 65vh;
                    overflow-y: auto;
                    background: #171717;
                    border: 1px solid #444;
                    border-radius: 8px;
                    box-shadow: 0 5px 20px rgba(0,0,0,.5);
                }

                .aih-menu-item {
                    display: flex;
                    align-items: center;
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

                .aih-menu-icon {
                    width: 28px;
                    font-size: 21px;
                    text-align: center;
                }

                .aih-menu-title {
                    font-size: 13px;
                    font-weight: bold;
                }

                .aih-menu-description {
                    margin-top: 4px;
                    color: #aaa;
                    font-size: 11px;
                }

                .aih-menu-divider {
                    height: 1px;
                    background: #444;
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
                    box-shadow: 0 5px 20px rgba(0,0,0,.5);
                }

                #aih-progress-label {
                    margin-bottom: 8px;
                    color: #ddd;
                    font-size: 12px;
                }

                #aih-progress-track {
                    width: 100%;
                    height: 5px;
                    overflow: hidden;
                    background: #333;
                    border-radius: 5px;
                }

                #aih-progress-bar {
                    width: 0%;
                    height: 100%;
                    background: #4caf50;
                    transition: width .2s ease;
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
                    box-shadow: 0 5px 30px rgba(0,0,0,.7);
                }

                #aih-panel-close {
                    position: sticky;
                    top: 0;
                    float: right;
                    padding: 7px 12px;
                    border: 1px solid #555;
                    border-radius: 5px;
                    background: #333;
                    color: #fff;
                    cursor: pointer;
                    z-index: 2;
                }

                #aih-panel-content {
                    clear: both;
                    padding-top: 15px;
                }

                .aih-settings-header {
                    margin: 0 0 15px;
                    font-size: 20px;
                }

                .aih-settings-layout {
                    display: flex;
                    gap: 20px;
                    min-height: 300px;
                }

                .aih-settings-nav {
                    flex: 0 0 190px;
                    border-right: 1px solid #444;
                    padding-right: 12px;
                }

                .aih-settings-nav button {
                    display: block;
                    width: 100%;
                    padding: 10px;
                    margin-bottom: 5px;
                    border: 0;
                    border-radius: 5px;
                    background: transparent;
                    color: #ddd;
                    text-align: left;
                    cursor: pointer;
                }

                .aih-settings-nav button:hover,
                .aih-settings-nav button.active {
                    background: #303030;
                }

                .aih-settings-view {
                    flex: 1;
                    min-width: 0;
                }

                .aih-settings-empty {
                    padding: 20px;
                    color: #aaa;
                    font-size: 13px;
                }

                @media (max-width: 600px) {
                    #aih-panel {
                        inset: 2%;
                        padding: 12px;
                    }

                    .aih-settings-layout {
                        flex-direction: column;
                    }

                    .aih-settings-nav {
                        flex: none;
                        border-right: 0;
                        border-bottom: 1px solid #444;
                        padding: 0 0 10px;
                    }
                }
            `
        });

        document.head.appendChild(style);
    }

    // --------------------------------------------------
    // PANEL MANAGEMENT
    // --------------------------------------------------

    function closePanel() {
        const panel = document.getElementById("aih-panel");
        const content = document.getElementById("aih-panel-content");

        if (panel) {
            panel.style.display = "none";
        }

        if (content) {
            content.replaceChildren();
        }
    }

    function showPanel(module) {
        const panel = document.getElementById("aih-panel");
        const content = document.getElementById("aih-panel-content");
        const menu = document.getElementById("aih-menu");

        content.replaceChildren();

        try {
            const result = module.render();

            if (result === null || result === undefined) {
                menu.style.display = "none";
                return;
            }

            if (result instanceof Node) {
                content.appendChild(result);
            } else {
                content.textContent = String(result);
            }
        } catch (error) {
            content.textContent =
                "Module rendering failed: " + error.message;
        }

        panel.style.display = "block";
        menu.style.display = "none";
    }

    function showSettingsModule(instance, activeButton, view) {
        view.replaceChildren();

        const buttons = document.querySelectorAll(
            ".aih-settings-nav button"
        );

        buttons.forEach(button => button.classList.remove("active"));
        activeButton.classList.add("active");

        try {
            const result = instance.render();

            if (result === null || result === undefined) {
                return;
            }

            if (result instanceof Node) {
                view.appendChild(result);
            } else {
                view.textContent = String(result);
            }
        } catch (error) {
            view.textContent =
                "Settings rendering failed: " + error.message;
        }
    }

    function openSettings() {
        if (!state.ui) {
            createUI();
        }

        const panel = document.getElementById("aih-panel");
        const content = document.getElementById("aih-panel-content");
        const menu = document.getElementById("aih-menu");

        content.replaceChildren();
        menu.style.display = "none";

        const heading = createElement("h2", {
            className: "aih-settings-header",
            textContent: "Anonymous Inspector Settings"
        });

        content.appendChild(heading);

        if (!state.activeSettings.length) {
            content.appendChild(createElement("div", {
                className: "aih-settings-empty",
                textContent: state.settingsLoaded
                    ? "No settings modules are available."
                    : "Settings are loading or no settings manifest exists."
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
                    (metadata.icon ? metadata.icon + "  " : "") +
                    (metadata.title || metadata.id)
            });

            button.addEventListener("click", () => {
                showSettingsModule(instance, button, view);
            });

            nav.appendChild(button);

            if (index === 0) {
                showSettingsModule(instance, button, view);
            }
        });

        panel.style.display = "block";
    }

    function closeSettings() {
        closePanel();
    }

    // --------------------------------------------------
    // MENU
    // --------------------------------------------------

    function refreshMenu() {
        const menu = document.getElementById("aih-menu");
        if (!menu) return;

        menu.replaceChildren();

        const settingsButton = createElement("button", {
            className: "aih-menu-item",
            type: "button"
        });

        settingsButton.append(
            createElement("span", {
                className: "aih-menu-icon",
                textContent: "⚙"
            }),
            createElement("div", {}, [
                createElement("div", {
                    className: "aih-menu-title",
                    textContent: "Settings"
                }),
                createElement("div", {
                    className: "aih-menu-description",
                    textContent: "Configure Anonymous Inspector"
                })
            ])
        );

        settingsButton.addEventListener("click", openSettings);
        menu.appendChild(settingsButton);

        if (state.active.length) {
            menu.appendChild(createElement("div", {
                className: "aih-menu-divider"
            }));
        }

        for (const module of state.active) {
            const metadata = module.getMetadata();

            const item = createElement("button", {
                className: "aih-menu-item",
                type: "button"
            });

            const icon = createElement("span", {
                className: "aih-menu-icon",
                textContent: metadata.icon || "◉"
            });

            const details = createElement("div");

            details.appendChild(createElement("div", {
                className: "aih-menu-title",
                textContent: metadata.title || metadata.id
            }));

            details.appendChild(createElement("div", {
                className: "aih-menu-description",
                textContent: metadata.description || ""
            }));

            item.append(icon, details);
            item.addEventListener("click", () => showPanel(module));

            menu.appendChild(item);
        }
    }

    // --------------------------------------------------
    // PROGRESS
    // --------------------------------------------------

    function updateProgress() {
        const progress = state.progress;
        const label = document.getElementById("aih-progress-label");
        const bar = document.getElementById("aih-progress-bar");

        if (!label || !bar) return;

        const percent = progress.total
            ? Math.round((progress.completed / progress.total) * 100)
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
        const button = document.getElementById("aih-button");

        if (progress) {
            progress.style.display = "none";
        }

        if (button) {
            button.disabled = false;
            button.textContent = "◉";
            button.title = "Anonymous Inspector";
        }
    }

    // --------------------------------------------------
    // UI CREATION
    // --------------------------------------------------

    function createUI() {
        if (state.ui) return;

        injectStyles();

        const rootElement = createElement("div", {
            id: "aih-root"
        });

        const button = createElement("button", {
            id: "aih-button",
            type: "button",
            title: "Initializing Anonymous Inspector",
            textContent: "..."
        });

        button.disabled = true;

        const menu = createElement("div", {
            id: "aih-menu"
        });

        const progress = createElement("div", {
            id: "aih-progress"
        });

        const progressLabel = createElement("div", {
            id: "aih-progress-label",
            textContent: "Initializing..."
        });

        const progressTrack = createElement("div", {
            id: "aih-progress-track"
        });

        const progressBar = createElement("div", {
            id: "aih-progress-bar"
        });

        progressTrack.appendChild(progressBar);
        progress.append(progressLabel, progressTrack);

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
            if (button.disabled) return;

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
    // MODULE LOADING
    // --------------------------------------------------

    async function loadModule(id) {
        if (state.modules.has(id)) {
            return state.modules.get(id);
        }

        if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
            throw new Error("Invalid module filename");
        }

        const url = MODULE_BASE + id + ".js";
        const source = await requestText(url);

        if (source === null) {
            throw new Error("Module file unavailable: " + id);
        }

        const executeModule = new Function(
            "Framework",
            source + "\n//# sourceURL=" + url
        );

        executeModule(Framework);

        if (!state.modules.has(id)) {
            throw new Error("Module did not register: " + id);
        }

        return state.modules.get(id);
    }

    function safelyDestroy(instance) {
        if (!instance || typeof instance.destroy !== "function") return;

        try {
            instance.destroy();
        } catch (error) {
            console.error(
                "[Anonymous Inspector] Destroy failed:",
                error
            );
        }
    }

    async function initializeModule(id) {
        try {
            const ModuleClass = await loadModule(id);
            const instance = new ModuleClass();

            try {
                await instance.init();

                if (instance.available) {
                    return instance;
                }

                safelyDestroy(instance);
                return null;
            } catch (error) {
                safelyDestroy(instance);
                throw error;
            }
        } catch (error) {
            console.error("[Anonymous Inspector]", id, error);
            return null;
        }
    }

    // --------------------------------------------------
    // TAMPERMONKEY MENU
    // --------------------------------------------------

    function registerTampermonkeyMenu() {
        if (typeof GM_registerMenuCommand !== "function") {
            console.warn(
                "[Anonymous Inspector] GM_registerMenuCommand is unavailable."
            );
            return;
        }

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

        const uniqueIds = [...new Set(moduleIds)];

        state.progress.total = uniqueIds.length;
        state.progress.completed = 0;
        state.progress.failed = 0;

        createUI();
        updateProgress();

        await new Promise(resolve => requestAnimationFrame(resolve));

        const settingsPromise = loadSettings();

        const results = new Array(uniqueIds.length).fill(null);
        let nextIndex = 0;

        async function worker() {
            while (true) {
                const index = nextIndex++;

                if (index >= uniqueIds.length) {
                    return;
                }

                const id = uniqueIds[index];
                const instance = await initializeModule(id);

                results[index] = instance;

                if (!instance) {
                    state.progress.failed++;
                }

                state.progress.completed++;

                state.active = results.filter(Boolean);

                refreshMenu();
                updateProgress();
            }
        }

        const workerCount = Math.min(
            MAX_CONCURRENT_MODULES,
            uniqueIds.length
        );

        const workers = Array.from(
            { length: workerCount },
            () => worker()
        );

        await Promise.all(workers);
        await settingsPromise;

        state.active = results.filter(Boolean);

        refreshMenu();
        updateProgress();
        finishProgress();

        console.info(
            "[Anonymous Inspector] Initialization complete:",
            {
                version: VERSION,
                total: state.progress.total,
                loaded: state.active.length,
                failed: state.progress.failed,
                settings: state.activeSettings.length
            }
        );
    }

    // --------------------------------------------------
    // GLOBAL EXPORTS
    // --------------------------------------------------

    root.AnonymousInspectorFramework = Framework;
    root.AnonymousInspector = AnonymousInspector;

    registerTampermonkeyMenu();

})(globalThis);
