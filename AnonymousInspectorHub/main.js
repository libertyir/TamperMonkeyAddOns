
(function (root) {
    "use strict";

    const VERSION = "1.1.0";

    const MODULE_BASE =
        "https://libertyir.github.io/TamperMonkeyAddOns/AnonymousInspectorHub/";

    const state = {
        modules: new Map(),
        active: [],
        ui: null,
        started: false
    };

    function requestText(url) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: "GET",
                url,
                timeout: 20000,
                onload(response) {
                    if (response.status >= 200 && response.status < 300) {
                        resolve(response.responseText);
                    } else {
                        reject(new Error("HTTP " + response.status));
                    }
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
                url,
                responseType: "arraybuffer",
                timeout: 20000,
                onload(response) {
                    if (response.status >= 200 && response.status < 300) {
                        resolve(response.response);
                    } else {
                        reject(new Error("HTTP " + response.status));
                    }
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
                element.addEventListener(key.substring(2).toLowerCase(), value);
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

    const Framework = Object.freeze({
        version: VERSION,
        BaseModule,
        register,
        requestText,
        requestArrayBuffer,
        createElement,
        getCurrentDirectory,
        copy,
        open
    });

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
                }

                #aih-panel-content {
                    clear: both;
                    padding-top: 15px;
                }
            `
        });

        document.head.appendChild(style);
    }

    function closePanel() {
        const panel = document.getElementById("aih-panel");

        if (panel) {
            panel.style.display = "none";
            document.getElementById("aih-panel-content").replaceChildren();
        }
    }

    function showPanel(module) {
        const panel = document.getElementById("aih-panel");
        const content = document.getElementById("aih-panel-content");

        content.replaceChildren();

        try {
            const result = module.render();

            if (result instanceof Node) {
                content.appendChild(result);
            } else if (result !== undefined && result !== null) {
                content.textContent = String(result);
            }
        } catch (error) {
            content.textContent = "Module rendering failed: " + error.message;
        }

        panel.style.display = "block";
        document.getElementById("aih-menu").style.display = "none";
    }

    function refreshMenu() {
        const menu = document.getElementById("aih-menu");
        if (!menu) return;

        menu.replaceChildren();

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

        menu.style.display = state.active.length ? "block" : "none";
    }

    function createUI() {
        if (state.ui) return;

        injectStyles();

        const rootElement = createElement("div", { id: "aih-root" });

        const button = createElement("button", {
            id: "aih-button",
            type: "button",
            title: "Anonymous Inspector",
            textContent: "◉"
        });

        const menu = createElement("div", { id: "aih-menu" });

        const panel = createElement("div", { id: "aih-panel" });

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
        rootElement.append(button, menu);
        document.body.append(rootElement);
        document.body.append(panel);

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
    }

    async function loadModule(id) {
        if (state.modules.has(id)) {
            return state.modules.get(id);
        }

        if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
            throw new Error("Invalid module filename");
        }

        const url = MODULE_BASE + id + ".js";
        const source = await requestText(url);

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

    async function AnonymousInspector(...moduleIds) {
        if (state.started) return;

        state.started = true;

        for (const id of moduleIds) {
            try {
                const ModuleClass = await loadModule(id);
                const instance = new ModuleClass();

                await instance.init();

                if (instance.available) {
                    state.active.push(instance);
                } else {
                    instance.destroy();
                }
            } catch (error) {
                console.error("[Anonymous Inspector]", id, error);
            }
        }

        if (state.active.length) {
            createUI();
            refreshMenu();
        }
    }

    root.AnonymousInspectorFramework = Framework;
    root.AnonymousInspector = AnonymousInspector;

})(globalThis);
