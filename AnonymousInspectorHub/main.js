
(function (root) {
    "use strict";

    const KERNEL_URL =
        "https://libertyir.github.io/TamperMonkeyAddOns/AnonymousInspectorHub/Core/Kernel.js";

    let kernel = null;
    let loading = null;
    let settingsRequested = false;

    // Capture Tampermonkey APIs from the userscript scope.
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
    // SETTINGS COMMAND
    // --------------------------------------------------

    function openSettingsWhenReady() {
        if (!settingsRequested || !kernel) return;

        if (
            kernel.uiManager &&
            kernel.uiManager.initialized
        ) {
            settingsRequested = false;
            kernel.uiManager.openSettings();
        }
    }

    function requestSettings() {
        settingsRequested = true;

        if (kernel && kernel.uiManager) {
            openSettingsWhenReady();
            return;
        }

        // Start Kernel loading if it has not started yet.
        loadKernel().catch(error => {
            console.error(
                "[Anonymous Inspector] Settings initialization failed:",
                error
            );
        });
    }

    // Register the Settings command immediately.
    if (gmAPI.registerMenuCommand) {
        gmAPI.registerMenuCommand(
            "Anonymous Inspector Hub - Settings",
            requestSettings
        );

        // Prevent Kernel from registering the same command again.
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
                                "Kernel class could not be loaded from Kernel.js."
                            );
                        }

                        kernel = new KernelClass({
                            version: "2.0.0",
                            gm: gmAPI
                        });

                        // Kernel calls this after the UI becomes available.
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
    // PUBLIC ENTRY POINT
    // --------------------------------------------------

    async function AnonymousInspector(...moduleIds) {
        try {
            const instance = await loadKernel();

            const result = await instance.start(...moduleIds);

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
