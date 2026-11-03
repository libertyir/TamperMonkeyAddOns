
(function (root) {
    "use strict";

    class UIManager {
        constructor(options = {}) {
            this.version = options.version || "1.0.0";

            this.createElement =
                options.createElement || this.defaultCreateElement.bind(this);

            this.onOpenSettings =
                options.onOpenSettings || (() => { });

            this.getModules =
                options.getModules || (() => []);

            this.getSettings =
                options.getSettings || (() => []);

            this.root = null;
            this.menu = null;
            this.panel = null;
            this.panelContent = null;
            this.progress = null;
            this.progressLabel = null;
            this.progressBar = null;

            this.initialized = false;
            this.destroyed = false;

            this.boundKeydown = this.handleKeydown.bind(this);
            this.boundDocumentClick =
                this.handleDocumentClick.bind(this);
        }

        // --------------------------------------------------
        // DOM HELPER
        // --------------------------------------------------

        defaultCreateElement(tag, attributes = {}, children = []) {
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

        // --------------------------------------------------
        // STYLES
        // --------------------------------------------------

        injectStyles() {
            if (document.getElementById("aih-styles")) {
                return;
            }

            const style = this.createElement("style", {
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

                    .aih-menu-details {
                        flex: 1;
                        min-width: 0;
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
                        pointer-events: none;
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
        // INITIALIZATION
        // --------------------------------------------------

        async initialize() {
            if (this.initialized) {
                return this;
            }

            if (this.destroyed) {
                throw new Error("UIManager has been destroyed.");
            }

            this.injectStyles();
            this.createUI();

            document.addEventListener(
                "keydown",
                this.boundKeydown
            );

            document.addEventListener(
                "click",
                this.boundDocumentClick
            );

            this.initialized = true;

            this.refreshMenu();

            return this;
        }

        createUI() {
            this.root = this.createElement("div", {
                id: "aih-root"
            });

            const button = this.createElement("button", {
                id: "aih-button",
                type: "button",
                title: "Anonymous Inspector",
                textContent: "◉"
            });

            this.menu = this.createElement("div", {
                id: "aih-menu"
            });

            this.progress = this.createElement("div", {
                id: "aih-progress"
            });

            this.progressLabel = this.createElement("div", {
                id: "aih-progress-label",
                textContent: "Initializing..."
            });

            const progressTrack = this.createElement("div", {
                id: "aih-progress-track"
            });

            this.progressBar = this.createElement("div", {
                id: "aih-progress-bar"
            });

            progressTrack.appendChild(this.progressBar);

            this.progress.append(
                this.progressLabel,
                progressTrack
            );

            this.panel = this.createElement("div", {
                id: "aih-panel"
            });

            const closeButton = this.createElement("button", {
                id: "aih-panel-close",
                type: "button",
                textContent: "Close"
            });

            this.panelContent = this.createElement("div", {
                id: "aih-panel-content"
            });

            closeButton.addEventListener(
                "click",
                () => this.closePanel()
            );

            button.addEventListener("click", () => {
                this.toggleMenu();
            });

            this.panel.append(
                closeButton,
                this.panelContent
            );

            this.root.append(
                button,
                this.menu,
                this.progress
            );

            document.body.append(
                this.root,
                this.panel
            );
        }

        // --------------------------------------------------
        // MENU
        // --------------------------------------------------

        toggleMenu() {
            if (!this.menu) return;

            this.menu.style.display =
                this.menu.style.display === "block"
                    ? "none"
                    : "block";
        }

        closeMenu() {
            if (this.menu) {
                this.menu.style.display = "none";
            }
        }

        refreshMenu() {
            if (!this.menu) return;

            this.menu.replaceChildren();

            const settingsButton = this.createElement("button", {
                className: "aih-menu-item",
                type: "button"
            });

            settingsButton.append(
                this.createElement("span", {
                    className: "aih-menu-icon",
                    textContent: "⚙"
                }),
                this.createElement("div", {
                    className: "aih-menu-details"
                }, [
                    this.createElement("div", {
                        className: "aih-menu-title",
                        textContent: "Settings"
                    }),
                    this.createElement("div", {
                        className: "aih-menu-description",
                        textContent: "Configure Anonymous Inspector"
                    })
                ])
            );

            settingsButton.addEventListener(
                "click",
                () => {
                    this.onOpenSettings();
                    this.closeMenu();
                }
            );

            this.menu.appendChild(settingsButton);

            const modules = this.getModules() || [];

            if (modules.length) {
                this.menu.appendChild(
                    this.createElement("div", {
                        className: "aih-menu-divider"
                    })
                );
            }

            for (const module of modules) {
                const metadata = module.getMetadata();

                const item = this.createElement("button", {
                    className: "aih-menu-item",
                    type: "button"
                });

                const icon = this.createElement("span", {
                    className: "aih-menu-icon",
                    textContent: metadata.icon || "◉"
                });

                const details = this.createElement("div", {
                    className: "aih-menu-details"
                });

                details.append(
                    this.createElement("div", {
                        className: "aih-menu-title",
                        textContent: metadata.title || metadata.id
                    }),
                    this.createElement("div", {
                        className: "aih-menu-description",
                        textContent: metadata.description || ""
                    })
                );

                item.append(icon, details);

                item.addEventListener("click", () => {
                    this.showModule(module);
                });

                this.menu.appendChild(item);
            }
        }

        // --------------------------------------------------
        // MODULE PANEL
        // --------------------------------------------------

        renderInstance(instance, target) {
            target.replaceChildren();

            try {
                const result = instance.render();

                if (result === null || result === undefined) {
                    return;
                }

                if (result instanceof Node) {
                    target.appendChild(result);
                } else {
                    target.textContent = String(result);
                }
            } catch (error) {
                target.textContent =
                    "Rendering failed: " + error.message;
            }
        }

        showModule(module) {
            if (!this.panelContent || !this.panel) return;

            this.renderInstance(module, this.panelContent);

            this.panel.style.display = "block";
            this.closeMenu();
        }

        closePanel() {
            if (this.panel) {
                this.panel.style.display = "none";
            }

            if (this.panelContent) {
                this.panelContent.replaceChildren();
            }
        }

        // --------------------------------------------------
        // SETTINGS PANEL
        // --------------------------------------------------

        openSettings() {
            if (!this.panel || !this.panelContent) return;

            this.panelContent.replaceChildren();

            this.panelContent.appendChild(
                this.createElement("h2", {
                    className: "aih-settings-header",
                    textContent: "Anonymous Inspector Settings"
                })
            );

            const settings = this.getSettings() || [];

            if (!settings.length) {
                this.panelContent.appendChild(
                    this.createElement("div", {
                        className: "aih-settings-empty",
                        textContent: "No settings modules are available."
                    })
                );

                this.panel.style.display = "block";
                this.closeMenu();
                return;
            }

            const layout = this.createElement("div", {
                className: "aih-settings-layout"
            });

            const nav = this.createElement("div", {
                className: "aih-settings-nav"
            });

            const view = this.createElement("div", {
                className: "aih-settings-view"
            });

            layout.append(nav, view);
            this.panelContent.appendChild(layout);

            settings.forEach((instance, index) => {
                const metadata = instance.getMetadata();

                const button = this.createElement("button", {
                    type: "button",
                    textContent:
                        (metadata.icon ? metadata.icon + "  " : "") +
                        (metadata.title || metadata.id)
                });

                button.addEventListener("click", () => {
                    this.showSettingsInstance(
                        instance,
                        button,
                        nav,
                        view
                    );
                });

                nav.appendChild(button);

                if (index === 0) {
                    this.showSettingsInstance(
                        instance,
                        button,
                        nav,
                        view
                    );
                }
            });

            this.panel.style.display = "block";
            this.closeMenu();
        }

        showSettingsInstance(instance, button, nav, view) {
            nav.querySelectorAll("button").forEach(item => {
                item.classList.remove("active");
            });

            button.classList.add("active");

            this.renderInstance(instance, view);
        }

        // --------------------------------------------------
        // PROGRESS
        // --------------------------------------------------

        setProgress(progress = {}) {
            if (!this.progressLabel || !this.progressBar) {
                return;
            }

            const total = Math.max(
                0,
                Number(progress.total) || 0
            );

            const completed = Math.max(
                0,
                Math.min(total, Number(progress.completed) || 0)
            );

            const failed = Math.max(
                0,
                Number(progress.failed) || 0
            );

            const percent = total
                ? Math.round(completed / total * 100)
                : 100;

            const currentModule =
                typeof progress.id === "string"
                    ? progress.id
                    : "";

            const phase = progress.phase || "";

            let message =
                "Scanning modules: " +
                completed + " / " + total +
                " (" + percent + "%)";

            if (currentModule && phase === "started") {
                message += " | Running: " + currentModule;
            } else if (currentModule && phase === "completed") {
                message += " | Completed: " + currentModule;
            }

            if (failed) {
                message += " | Failed: " + failed;
            }

            this.progressLabel.textContent = message;
            this.progressBar.style.width = percent + "%";

            this.progress.style.display =
                completed >= total ? "none" : "block";
        }

        showProgress(message = "Initializing...") {
            if (!this.progress) return;

            this.progressLabel.textContent = message;
            this.progressBar.style.width = "0%";
            this.progress.style.display = "block";
        }

        hideProgress() {
            if (this.progress) {
                this.progress.style.display = "none";
            }
        }

        // --------------------------------------------------
        // DOCUMENT EVENTS
        // --------------------------------------------------

        handleKeydown(event) {
            if (event.key === "Escape") {
                this.closePanel();
                this.closeMenu();
            }
        }

        handleDocumentClick(event) {
            if (
                this.root &&
                this.panel &&
                !this.root.contains(event.target) &&
                !this.panel.contains(event.target)
            ) {
                this.closeMenu();
            }
        }

        // --------------------------------------------------
        // STATUS
        // --------------------------------------------------

        getStatus() {
            return {
                initialized: this.initialized,
                destroyed: this.destroyed,
                visiblePanel:
                    !!this.panel &&
                    this.panel.style.display === "block",
                menuVisible:
                    !!this.menu &&
                    this.menu.style.display === "block"
            };
        }

        // --------------------------------------------------
        // DESTRUCTION
        // --------------------------------------------------

        async destroy() {
            if (this.destroyed) return;

            document.removeEventListener(
                "keydown",
                this.boundKeydown
            );

            document.removeEventListener(
                "click",
                this.boundDocumentClick
            );

            if (this.root) {
                this.root.remove();
            }

            if (this.panel) {
                this.panel.remove();
            }

            const styles = document.getElementById("aih-styles");

            if (styles) {
                styles.remove();
            }

            this.root = null;
            this.menu = null;
            this.panel = null;
            this.panelContent = null;
            this.progress = null;
            this.progressLabel = null;
            this.progressBar = null;

            this.initialized = false;
            this.destroyed = true;
        }
    }

    root.AnonymousInspectorUIManager = UIManager;

})(globalThis);
