(function (root) {
    "use strict";

    const KERNEL_URL =
        "https://libertyir.github.io/TamperMonkeyAddOns/AnonymousInspectorHub/Core/Kernel.js";

    let kernel = null;
    let loading = null;
    let settingsRequested = false;
    let pendingButtonClick = false;
    let bootstrapButton = null;
    let modulesStarting = false;

    // --------------------------------------------------
    // TAMPERMONKEY API
    // --------------------------------------------------

    const gmAPI = {
        getValue:
            typeof GM_getValue === "function"
                ? GM_getValue
                : null,

        setValue:
            typeof GM_setValue === "function"
                ? GM_setValue
                : null,

        deleteValue:
            typeof GM_deleteValue === "function"
                ? GM_deleteValue
                : null,

        listValues:
            typeof GM_listValues === "function"
                ? GM_listValues
                : null,

        xmlHttpRequest:
            typeof GM_xmlhttpRequest === "function"
                ? GM_xmlhttpRequest
                : null,

        setClipboard:
            typeof GM_setClipboard === "function"
                ? GM_setClipboard
                : null,

        registerMenuCommand:
            typeof GM_registerMenuCommand === "function"
                ? GM_registerMenuCommand
                : null
    };

    // --------------------------------------------------
    // IMMEDIATE FLOATING BUTTON
    // --------------------------------------------------

    function createBootstrapButton() {
        if (bootstrapButton || !document.body) return;

        const style = document.createElement("style");

        style.id = "aih-bootstrap-styles";
        style.textContent = `
            #aih-button {
                position: fixed;
                right: 20px;
                bottom: 20px;
                z-index: 2147483646;
                width: 44px;
                height: 44px;
                display: flex;
                align-items: center;
                justify-content: center;
                border: 1px solid #555;
                border-radius: 50%;
                background: #222;
                color: #fff;
                font-size: 22px;
                font-family: Arial, sans-serif !important;
                direction: ltr !important;
                text-align: center !important;
                color-scheme: dark;
                cursor: pointer;
                box-shadow: 0 2px 10px rgba(0,0,0,.4);
            }
        `;

        document.head.appendChild(style);

        bootstrapButton = document.createElement("button");

        bootstrapButton.id = "aih-button";
        bootstrapButton.type = "button";
        bootstrapButton.title = "Anonymous Inspector";
        bootstrapButton.textContent = "▶";
        bootstrapButton.setAttribute("aria-label", "Start modules");

        bootstrapButton.addEventListener("click", () => {
            if (
                kernel &&
                kernel.uiManager &&
                kernel.uiManager.initialized
            ) {
                if (!kernel.modulesStarted) {
                    startModulesFromButton();
                } else {
                    kernel.uiManager.toggleMenu();
                }
                return;
            }

            pendingButtonClick = true;
        });

        document.body.appendChild(bootstrapButton);
    }

    if (document.body) {
        createBootstrapButton();
    } else {
        document.addEventListener(
            "DOMContentLoaded",
            createBootstrapButton,
            { once: true }
        );
    }

    // --------------------------------------------------
    // SETTINGS COMMAND
    // --------------------------------------------------

    function startModulesFromButton() {
        if (!kernel || modulesStarting || kernel.modulesStarted) return;

        modulesStarting = true;

        if (bootstrapButton) {
            bootstrapButton.textContent = "…";
            bootstrapButton.title = "Starting modules";
            bootstrapButton.setAttribute("aria-label", "Starting modules");
        }

        kernel.startModules()
            .then(() => {
                if (bootstrapButton) {
                    bootstrapButton.textContent = "☰";
                    bootstrapButton.title = "Anonymous Inspector";
                    bootstrapButton.setAttribute("aria-label", "Open menu");
                }
            })
            .catch(error => {
                console.error(
                    "[Anonymous Inspector] Module startup failed:",
                    error
                );

                if (bootstrapButton) {
                    bootstrapButton.textContent = "▶";
                    bootstrapButton.title = "Retry module startup";
                    bootstrapButton.setAttribute("aria-label", "Retry module startup");
                }
            })
            .finally(() => {
                modulesStarting = false;
            });
    }

    function openSettingsWhenReady() {
        if (!kernel) return;

        if (
            kernel.uiManager &&
            kernel.uiManager.initialized
        ) {
            if (settingsRequested) {
                settingsRequested = false;
                kernel.uiManager.openSettings();
                return;
            }

            if (pendingButtonClick && kernel.state === "running") {
                pendingButtonClick = false;
                startModulesFromButton();
            }
        }
    }

    function requestSettings() {
        settingsRequested = true;

        if (
            kernel &&
            kernel.uiManager &&
            kernel.uiManager.initialized
        ) {
            openSettingsWhenReady();
            return;
        }

        startApplication().catch(error => {
            console.error(
                "[Anonymous Inspector] Settings initialization failed:",
                error
            );
        });
    }

    // Register Settings immediately.
    if (gmAPI.registerMenuCommand) {
        gmAPI.registerMenuCommand(
            "Anonymous Inspector Hub - Settings",
            requestSettings
        );

        gmAPI.registerMenuCommand = null;
    }

    // --------------------------------------------------
    // KERNEL LOADER
    // --------------------------------------------------

    async function loadKernel() {
        if (kernel) return kernel;
        if (loading) return loading;

        loading = new Promise((resolve, reject) => {
            if (!gmAPI.xmlHttpRequest) {
                reject(
                    new Error("GM_xmlhttpRequest is unavailable.")
                );
                return;
            }

            gmAPI.xmlHttpRequest({
                method: "GET",
                url: KERNEL_URL + "?_aih=" + Date.now(),
                timeout: 20000,

                headers: {
                    "Cache-Control": "no-cache, no-store",
                    "Pragma": "no-cache"
                },

                onload(response) {
                    if (
                        response.status < 200 ||
                        response.status >= 300 ||
                        !response.responseText
                    ) {
                        reject(
                            new Error(
                                "Kernel loading failed: HTTP " +
                                response.status
                            )
                        );
                        return;
                    }

                    try {
                        const KernelClass = new Function(
                            response.responseText +
                            "\nreturn globalThis.AnonymousInspectorKernel;" +
                            "\n//# sourceURL=" + KERNEL_URL
                        )();

                        if (typeof KernelClass !== "function") {
                            throw new Error(
                                "Kernel class could not be loaded."
                            );
                        }

                        kernel = new KernelClass({
                            version: "2.0.0",
                            gm: gmAPI
                        });

                        kernel.onUIReady = openSettingsWhenReady;

                        root.AIHKernel = kernel;

                        resolve(kernel);

                    } catch (error) {
                        reject(error);
                    }
                },

                onerror() {
                    reject(
                        new Error("Kernel network request failed.")
                    );
                },

                ontimeout() {
                    reject(
                        new Error("Kernel request timed out.")
                    );
                }
            });
        });

        try {
            return await loading;
        } catch (error) {
            loading = null;
            throw error;
        }
    }

    // --------------------------------------------------
    // APPLICATION STARTUP
    // --------------------------------------------------

    let startupPromise = null;
    let configuredModuleIds = [];

    async function startApplication() {
        if (startupPromise) return startupPromise;

        startupPromise = (async () => {
            const instance = await loadKernel();

            return instance.start(...configuredModuleIds);
        })();

        try {
            return await startupPromise;
        } catch (error) {
            startupPromise = null;
            throw error;
        }
    }

    // --------------------------------------------------
    // PUBLIC ENTRY POINT
    // --------------------------------------------------

    async function AnonymousInspector(...moduleIds) {
        configuredModuleIds =
            moduleIds.length === 1 &&
            Array.isArray(moduleIds[0])
                ? moduleIds[0]
                : moduleIds;

        try {
            const result = await startApplication();

            openSettingsWhenReady();

            return result;

        } catch (error) {
            console.error(
                "[Anonymous Inspector] Startup failed:",
                error
            );

            throw error;
        }
    }

    root.AnonymousInspector = AnonymousInspector;

})(globalThis);