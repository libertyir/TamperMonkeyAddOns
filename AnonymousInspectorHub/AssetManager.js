(function (root) {
    "use strict";

    const VERSION = "1.0.1";
    const BASE_URL =
        "https://libertyir.github.io/TamperMonkeyAddOns/AnonymousInspectorHub/";
    const MANIFEST_URL = BASE_URL + "AssetManifest.json";
    const MANIFEST_CACHE_KEY = "aih_asset_manager_v1:manifest";
    const ASSET_CACHE_PREFIX = "aih_asset_manager_v1:asset:";
    const REQUEST_TIMEOUT = 20000;

    const gm = {
        get: typeof GM_getValue === "function" ? GM_getValue : null,
        set: typeof GM_setValue === "function" ? GM_setValue : null,
        request: typeof GM_xmlhttpRequest === "function"
            ? GM_xmlhttpRequest
            : null,
        list: typeof GM_listValues === "function"
            ? GM_listValues
            : null,
        delete: typeof GM_deleteValue === "function"
            ? GM_deleteValue
            : null
    };

    class AssetManager {
        constructor() {
            this.version = VERSION;
            this.assets = new Map();
            this.manifest = null;
            this.initializePromise = null;
            this.initialized = false;
            this.stats = {
                total: 0,
                downloaded: 0,
                cacheHits: 0,
                failed: 0
            };
        }

        request(url, timeout = REQUEST_TIMEOUT, headers = {}) {
            return new Promise((resolve, reject) => {
                if (!gm.request) {
                    reject(new Error("GM_xmlhttpRequest is unavailable."));
                    return;
                }

                gm.request({
                    method: "GET",
                    url,
                    responseType: "text",
                    timeout,
                    headers,
                    onload: response => {
                        if (response.status >= 200 && response.status < 300) {
                            resolve(response.responseText);
                            return;
                        }
                        reject(new Error("HTTP " + response.status + ": " + url));
                    },
                    onerror: () => reject(new Error("Network request failed: " + url)),
                    ontimeout: () => reject(new Error("Request timed out: " + url))
                });
            });
        }

        async readCache(key) {
            try {
                const value = await gm.get(key, null);
                if (typeof value === "string") {
                    return JSON.parse(value);
                }
            } catch (error) {
                console.warn("[AIH AssetManager] Cache read failed:", key, error);
            }
            return null;
        }

        async writeCache(key, value) {
            await gm.set(key, JSON.stringify(value));
        }

        async loadManifest() {
            let source = null;

            try {
                source = await this.request(
                    MANIFEST_URL + "?_aih=" + Date.now(),
                    REQUEST_TIMEOUT,
                    {
                        "Cache-Control": "no-cache, no-store",
                        "Pragma": "no-cache",
                        "Expires": "0"
                    }
                );
            } catch (error) {
                console.warn(
                    "[AIH AssetManager] Manifest download failed; trying last known manifest.",
                    error
                );
            }

            if (source !== null) {
                const manifest = JSON.parse(source);
                this.validateManifest(manifest);
                await this.writeCache(MANIFEST_CACHE_KEY, {
                    content: source,
                    savedAt: Date.now()
                });
                return manifest;
            }

            const cached = await this.readCache(MANIFEST_CACHE_KEY);
            if (!cached || typeof cached.content !== "string") {
                throw new Error(
                    "AssetManifest.json is unavailable and no cached manifest exists."
                );
            }

            const manifest = JSON.parse(cached.content);
            this.validateManifest(manifest);
            return manifest;
        }

        validateManifest(manifest) {
            if (!manifest || !Array.isArray(manifest.Assets)) {
                throw new Error("Invalid AssetManifest.json structure.");
            }

            const paths = new Set();

            for (const asset of manifest.Assets) {
                if (
                    !asset ||
                    typeof asset.path !== "string" ||
                    typeof asset.version !== "string" ||
                    !asset.version.trim()
                ) {
                    throw new Error("Invalid asset entry in AssetManifest.json.");
                }

                const path = asset.path.replace(/^\/+/, "");
                if (path.split("/").some(part =>
                    !part || part === "." || part === ".."
                )) {
                    throw new Error("Invalid asset path: " + asset.path);
                }
                if (paths.has(path)) {
                    throw new Error("Duplicate asset path: " + path);
                }

                paths.add(path);
                asset.path = path;
            }
        }

        getAssetCacheKey(path) {
            return ASSET_CACHE_PREFIX + encodeURIComponent(path);
        }

        async downloadAsset(asset, forceLoad) {
            const cacheKey = this.getAssetCacheKey(asset.path);
            const cached = await this.readCache(cacheKey);

            if (
                !forceLoad &&
                cached &&
                cached.version === asset.version &&
                typeof cached.content === "string"
            ) {
                this.assets.set(asset.path, cached.content);
                this.stats.cacheHits++;
                return;
            }

            const url = BASE_URL + asset.path +
                "?v=" + encodeURIComponent(asset.version) +
                (forceLoad ? "&_aih=" + Date.now() : "");

            try {
                const content = await this.request(
                    url,
                    this.manifest.RequestTimeout || REQUEST_TIMEOUT,
                    forceLoad
                        ? {
                            "Cache-Control": "no-cache, no-store",
                            "Pragma": "no-cache",
                            "Expires": "0"
                        }
                        : {}
                );

                if (typeof content !== "string") {
                    throw new Error("Empty asset response.");
                }

                this.assets.set(asset.path, content);
                this.stats.downloaded++;

                try {
                    await this.writeCache(cacheKey, {
                        version: asset.version,
                        content,
                        savedAt: Date.now()
                    });
                } catch (cacheError) {
                    console.warn(
                        "[AIH AssetManager] GM cache write failed:",
                        asset.path,
                        cacheError
                    );
                }
            } catch (error) {
                this.stats.failed++;

                if (cached && typeof cached.content === "string") {
                    this.assets.set(asset.path, cached.content);
                    console.warn(
                        "[AIH AssetManager] Using previous cached copy:",
                        asset.path,
                        error
                    );
                    return;
                }

                if (asset.required === true) {
                    throw error;
                }

                console.warn(
                    "[AIH AssetManager] Optional asset unavailable:",
                    asset.path,
                    error
                );
            }
        }

        async cleanupRemovedAssets() {
            if (!gm.list || !gm.delete) return;

            const activeKeys = new Set(
                this.manifest.Assets.map(asset =>
                    this.getAssetCacheKey(asset.path)
                )
            );

            try {
                const keys = await gm.list();
                const staleKeys = keys.filter(key =>
                    key.startsWith(ASSET_CACHE_PREFIX) &&
                    !activeKeys.has(key)
                );

                await Promise.all(
                    staleKeys.map(key => gm.delete(key))
                );
            } catch (error) {
                console.warn(
                    "[AIH AssetManager] Removed-asset cleanup failed:",
                    error
                );
            }
        }

        async loadAssets() {
            const assets = this.manifest.Assets;
            const forceLoad = this.manifest.ForceLoad === true;
            const concurrency = Math.max(
                1,
                Math.min(32, Number(this.manifest.MaxConcurrency) || 16)
            );

            this.stats.total = assets.length;
            let nextIndex = 0;
            const failures = [];

            const worker = async () => {
                while (true) {
                    const index = nextIndex++;
                    if (index >= assets.length) return;

                    const asset = assets[index];
                    try {
                        await this.downloadAsset(asset, forceLoad);
                    } catch (error) {
                        failures.push({
                            path: asset.path,
                            error: error.message
                        });
                    }
                }
            };

            await Promise.all(
                Array.from(
                    { length: Math.min(concurrency, assets.length) },
                    () => worker()
                )
            );

            if (failures.length) {
                throw new Error(
                    "Required project assets failed: " +
                    failures.map(item => item.path).join(", ")
                );
            }
        }

        initialize() {
            if (this.initializePromise) return this.initializePromise;

            this.initializePromise = (async () => {
                if (!gm.get || !gm.set || !gm.request) {
                    throw new Error(
                        "AssetManager requires GM_getValue, GM_setValue and GM_xmlhttpRequest."
                    );
                }

                this.manifest = await this.loadManifest();
                await this.cleanupRemovedAssets();
                await this.loadAssets();
                this.initialized = true;

                console.info("[AIH AssetManager] Ready.", this.getStatus());
                return this;
            })().catch(error => {
                this.initializePromise = null;
                this.initialized = false;
                throw error;
            });

            return this.initializePromise;
        }

        getText(path) {
            const normalized = String(path || "").replace(/^\/+/, "");
            return this.assets.has(normalized)
                ? this.assets.get(normalized)
                : null;
        }

        handleRequest(details) {
            if (!this.initialized || !details || typeof details.url !== "string") {
                return false;
            }

            let url;
            try {
                url = new URL(details.url);
            } catch {
                return false;
            }

            const base = new URL(BASE_URL);
            if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) {
                return false;
            }

            const path = decodeURIComponent(
                url.pathname.slice(base.pathname.length)
            );
            const content = this.getText(path);

            const respond = () => {
                if (typeof details.onload !== "function") return;

                if (content === null) {
                    details.onload({
                        status: 404,
                        statusText: "Not Found",
                        responseText: "",
                        response: null,
                        finalUrl: details.url
                    });
                    return;
                }

                const isArrayBuffer = details.responseType === "arraybuffer";
                const response = isArrayBuffer
                    ? new TextEncoder().encode(content).buffer
                    : content;

                details.onload({
                    status: 200,
                    statusText: "OK",
                    responseText: isArrayBuffer ? "" : content,
                    response,
                    finalUrl: details.url,
                    readyState: 4
                });
            };

            Promise.resolve().then(respond);
            return { abort() {} };
        }

        getStatus() {
            return {
                version: this.version,
                manifestVersion: this.manifest ? this.manifest.Version : null,
                forceLoad: this.manifest ? this.manifest.ForceLoad === true : null,
                initialized: this.initialized,
                ...this.stats
            };
        }
    }

    root.AnonymousInspectorAssetManager = new AssetManager();
})(globalThis);
