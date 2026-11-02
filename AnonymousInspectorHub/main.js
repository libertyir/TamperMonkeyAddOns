
(function (root) {
    "use strict";

    const KERNEL_URL =
        "https://libertyir.github.io/TamperMonkeyAddOns/AnonymousInspectorHub/Core/Kernel.js";

    let kernel = null;
    let loading = null;

    async function loadKernel() {
        if (kernel) return kernel;
        if (loading) return loading;

        loading = new Promise((resolve, reject) => {
            if (typeof GM_xmlhttpRequest !== "function") {
                reject(new Error("GM_xmlhttpRequest is unavailable."));
                return;
            }

            GM_xmlhttpRequest({
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
                        reject(new Error("Kernel loading failed: HTTP " + response.status));
                        return;
                    }

                    try {
                        new Function(
                            response.responseText +
                            "\n//# sourceURL=" + KERNEL_URL
                        )();

                        if (
                            typeof root.AnonymousInspectorKernel !== "function"
                        ) {
                            throw new Error("Kernel class was not registered.");
                        }

                        kernel = new root.AnonymousInspectorKernel({
                            version: "2.0.0"
                        });

                        root.AIHKernel = kernel;

                        resolve(kernel);

                    } catch (error) {
                        reject(error);
                    }
                },

                onerror() {
                    reject(new Error("Kernel network request failed."));
                },

                ontimeout() {
                    reject(new Error("Kernel request timed out."));
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

    async function AnonymousInspector(...moduleIds) {
        try {
            const instance = await loadKernel();
            return await instance.start(...moduleIds);

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
