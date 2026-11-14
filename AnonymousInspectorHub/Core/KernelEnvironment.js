(function (root) {
    "use strict";

    const STORAGE_ADAPTER_REGISTRY = Object.freeze({
        gm: {
            path: "Storage/GMStorageAdapter.js",
            className: "AnonymousInspectorGMStorageAdapter",
            create: (AdapterClass, kernel) =>
                new AdapterClass({ gm: kernel.gm })
        },
        indexedDB: {
            path: "Storage/IndexedDBAdapter.js",
            className: "AnonymousInspectorIndexedDBAdapter",
            create: AdapterClass =>
                new AdapterClass({
                    databaseName: "AnonymousInspectorHub",
                    databaseVersion: 2
                })
        }
    });

    class KernelEnvironment {
        constructor(kernel) {
            if (!kernel) {
                throw new Error("KernelEnvironment requires a Kernel instance.");
            }
            this.kernel = kernel;
        }

        get GM() {
            const api = this.kernel.gm;

            const getValue = (key, fallback) => {
                if (typeof api.getValue !== "function") {
                    throw new Error(
                        "GM_getValue is unavailable. Check userscript @grant."
                    );
                }
                return api.getValue(key, fallback);
            };

            const setValue = (key, value) => {
                if (typeof api.setValue !== "function") {
                    throw new Error(
                        "GM_setValue is unavailable. Check userscript @grant."
                    );
                }
                return api.setValue(key, value);
            };

            const deleteValue = key => {
                if (typeof api.deleteValue === "function") {
                    return api.deleteValue(key);
                }
                if (typeof api.setValue === "function") {
                    return api.setValue(key, null);
                }
                throw new Error("GM storage is unavailable.");
            };

            const listValues = () => {
                if (typeof api.listValues !== "function") {
                    throw new Error(
                        "GM_listValues is unavailable. Check userscript @grant."
                    );
                }
                return api.listValues();
            };

            return {
                getValue,
                setValue,
                deleteValue,
                listValues,
                get api() {
                    return {
                        getValue,
                        setValue,
                        deleteValue,
                        listValues,
                        xmlHttpRequest: api.xmlHttpRequest || undefined,
                        setClipboard: api.setClipboard || undefined
                    };
                }
            };
        }

        createCacheBustedUrl(url) {
            const separator = url.includes("?") ? "&" : "?";
            return url + separator + "_aih=" + Date.now() +
                "_" + Math.random().toString(36).slice(2);
        }

        request(url, responseType = "text") {
            const assetManager = this.kernel.assetManager;

            if (
                responseType !== "arraybuffer" &&
                assetManager &&
                assetManager.initialized &&
                typeof assetManager.getText === "function"
            ) {
                try {
                    const requestedUrl = new URL(url, this.kernel.baseUrl);
                    const baseUrl = new URL(this.kernel.baseUrl);

                    if (
                        requestedUrl.origin === baseUrl.origin &&
                        requestedUrl.pathname.startsWith(baseUrl.pathname)
                    ) {
                        const path = decodeURIComponent(
                            requestedUrl.pathname.slice(baseUrl.pathname.length)
                        );
                        const cachedSource = assetManager.getText(path);

                        if (typeof cachedSource === "string") {
                            return Promise.resolve(cachedSource);
                        }
                    }
                } catch (error) {
                    console.warn(
                        "[Anonymous Inspector] Asset cache lookup failed:",
                        error
                    );
                }
            }

            return new Promise((resolve, reject) => {
                const requestAPI = this.kernel.gm.xmlHttpRequest;

                if (typeof requestAPI !== "function") {
                    reject(new Error(
                        "GM_xmlhttpRequest is unavailable. Check userscript @grant."
                    ));
                    return;
                }

                requestAPI({
                    method: "GET",
                    url: this.createCacheBustedUrl(url),
                    responseType:
                        responseType === "arraybuffer" ? "arraybuffer" : "text",
                    timeout: this.kernel.config.requestTimeout,
                    headers: {
                        "Cache-Control": "no-cache, no-store",
                        "Pragma": "no-cache",
                        "Expires": "0"
                    },
                    onload: response => {
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
                    onerror: () => reject(
                        new Error("Network request failed.")
                    ),
                    ontimeout: () => reject(
                        new Error("Request timed out.")
                    )
                });
            });
        }

        requestText(url) {
            return this.request(url, "text");
        }

        requestArrayBuffer(url) {
            return this.request(url, "arraybuffer");
        }

        createElement(tag, attributes = {}, children = []) {
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

        copy(value) {
            const clipboardAPI = this.kernel.gm.setClipboard;
            if (typeof clipboardAPI === "function") {
                clipboardAPI(String(value));
                return;
            }
            return navigator.clipboard.writeText(String(value));
        }

        open(url) {
            window.open(url, "_blank", "noopener,noreferrer");
        }

        getCurrentDirectory() {
            return new URL(".", window.location.href).href;
        }

        getStorageAdapterDefinition() {
            const definition =
                STORAGE_ADAPTER_REGISTRY[this.kernel.storageAdapterName];

            if (!definition) {
                throw new Error(
                    "Unknown storage adapter: " + this.kernel.storageAdapterName
                );
            }
            return definition;
        }
    }

    root.AnonymousInspectorKernelEnvironment = KernelEnvironment;
})(globalThis);
