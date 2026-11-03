(function (root) {
    "use strict";

    class SettingsManager {
        constructor(options = {}) {
            this.manifestUrl = options.manifestUrl || "";
            this.baseUrl = options.baseUrl || "";

            this.requestText = options.requestText;
            this.Framework = options.Framework;
            this.BaseSettings = options.BaseSettings;

            this.gm = options.gm || {};

            this.settings = new Map();
            this.activeSettings = [];

            this.loadingPromises = new Map();
            this.loadPromise = null;

            this.loaded = false;
            this.loading = false;
            this.destroyed = false;

            this.onRefresh = options.onRefresh || (() => { });

            this.onError = options.onError || (
                (id, error) => {
                    console.error(
                        "[Anonymous Inspector] Settings error:",
                        id,
                        error
                    );
                }
            );
        }

        // --------------------------------------------------
        // VALIDATION
        // --------------------------------------------------

        validateId(id) {
            if (
                typeof id !== "string" ||
                !/^[a-zA-Z0-9_-]+$/.test(id)
            ) {
                throw new Error("Invalid settings ID.");
            }
        }

        validateSettingsClass(SettingsClass) {
            if (typeof SettingsClass !== "function") {
                throw new Error("Invalid settings class.");
            }

            if (
                !this.BaseSettings ||
                !(SettingsClass.prototype instanceof this.BaseSettings)
            ) {
                throw new Error(
                    "Settings must extend BaseSettings."
                );
            }
        }

        // --------------------------------------------------
        // REGISTRATION
        // --------------------------------------------------

        register(id, SettingsClass) {
            this.validateId(id);
            this.validateSettingsClass(SettingsClass);

            this.settings.set(id, SettingsClass);

            return SettingsClass;
        }

        has(id) {
            return this.settings.has(id);
        }

        get(id) {
            return this.settings.get(id) || null;
        }

        getRegisteredIds() {
            return [...this.settings.keys()];
        }

        // --------------------------------------------------
        // DYNAMIC SOURCE EXECUTION
        // --------------------------------------------------

        executeSource(source, url) {
            if (typeof source !== "string") {
                throw new Error(
                    "Invalid settings source."
                );
            }

            if (!this.Framework) {
                throw new Error(
                    "Framework is unavailable."
                );
            }

            const gmGetValue =
                typeof this.gm.getValue === "function"
                    ? this.gm.getValue
                    : undefined;

            const gmSetValue =
                typeof this.gm.setValue === "function"
                    ? this.gm.setValue
                    : undefined;

            const gmDeleteValue =
                typeof this.gm.deleteValue === "function"
                    ? this.gm.deleteValue
                    : typeof gmSetValue === "function"
                        ? key => gmSetValue(key, null)
                        : undefined;

            const execute = new Function(
                "Framework",
                "GM_getValue",
                "GM_setValue",
                "GM_deleteValue",
                "GM_xmlhttpRequest",
                "GM_setClipboard",
                source + "\n//# sourceURL=" + url
            );

            execute(
                this.Framework,
                gmGetValue,
                gmSetValue,
                gmDeleteValue,
                typeof this.gm.xmlHttpRequest === "function"
                    ? this.gm.xmlHttpRequest
                    : undefined,
                typeof this.gm.setClipboard === "function"
                    ? this.gm.setClipboard
                    : undefined
            );
        }

        // --------------------------------------------------
        // SETTINGS CLASS LOADING
        // --------------------------------------------------

        async load(id) {
            this.validateId(id);

            if (this.settings.has(id)) {
                return this.settings.get(id);
            }

            if (this.loadingPromises.has(id)) {
                return this.loadingPromises.get(id);
            }

            const promise = this.loadSource(id);

            this.loadingPromises.set(id, promise);

            try {
                return await promise;
            } finally {
                this.loadingPromises.delete(id);
            }
        }

        async loadSource(id) {
            if (typeof this.requestText !== "function") {
                throw new Error(
                    "Settings source loader is unavailable."
                );
            }

            const url = this.baseUrl + id + ".js";
            const source = await this.requestText(url);

            if (source === null || source === undefined) {
                throw new Error(
                    "Settings file unavailable: " + id
                );
            }

            this.executeSource(source, url);

            if (!this.settings.has(id)) {
                throw new Error(
                    "Settings did not register: " + id
                );
            }

            return this.settings.get(id);
        }

        // --------------------------------------------------
        // SETTINGS INITIALIZATION
        // --------------------------------------------------

        async initialize(id) {
            if (this.destroyed) {
                throw new Error(
                    "SettingsManager has been destroyed."
                );
            }

            this.validateId(id);

            const existing = this.activeSettings.find(
                item => item.id === id
            );

            if (existing) {
                return existing.instance;
            }

            const SettingsClass = await this.load(id);
            const instance = new SettingsClass();

            try {
                if (typeof instance.init === "function") {
                    await instance.init();
                }

                if (!instance.available) {
                    await this.destroyInstance(instance);
                    return null;
                }

                this.activeSettings.push({
                    id,
                    instance
                });

                return instance;

            } catch (error) {
                await this.destroyInstance(instance);
                throw error;
            }
        }

        // --------------------------------------------------
        // MANIFEST
        // --------------------------------------------------

        async readManifest() {
            if (!this.manifestUrl) {
                throw new Error(
                    "Settings manifest URL is not configured."
                );
            }

            if (typeof this.requestText !== "function") {
                throw new Error(
                    "Settings source loader is unavailable."
                );
            }

            const source = await this.requestText(
                this.manifestUrl
            );

            if (!source) {
                return [];
            }

            let manifest;

            try {
                manifest = JSON.parse(source);
            } catch {
                throw new Error(
                    "Invalid settings manifest JSON."
                );
            }

            const ids = Array.isArray(manifest)
                ? manifest
                : manifest.modules;

            if (!Array.isArray(ids)) {
                throw new Error(
                    "Invalid settings manifest structure."
                );
            }

            return [...new Set(ids)];
        }

        // --------------------------------------------------
        // LOAD ALL SETTINGS
        // --------------------------------------------------

        async loadAll() {
            if (this.loaded) {
                return this.getActiveInstances();
            }

            if (this.loadPromise) {
                return this.loadPromise;
            }

            if (this.destroyed) {
                throw new Error(
                    "SettingsManager has been destroyed."
                );
            }

            this.loadPromise = this.initializeAll();

            try {
                return await this.loadPromise;
            } finally {
                this.loadPromise = null;
            }
        }

        async initializeAll() {
            this.loading = true;

            try {
                this.onRefresh();

                const ids = await this.readManifest();

                // Load all settings source files concurrently.
                const results = await Promise.all(
                    ids.map(async id => {
                        try {
                            await this.load(id);

                            return {
                                id,
                                success: true
                            };

                        } catch (error) {
                            this.onError(id, error);

                            return {
                                id,
                                success: false
                            };
                        }
                    })
                );

                // Initialize settings in manifest order.
                for (const result of results) {
                    if (!result.success) {
                        continue;
                    }

                    try {
                        await this.initialize(result.id);

                    } catch (error) {
                        this.onError(result.id, error);
                    }
                }

                return this.getActiveInstances();

            } catch (error) {
                this.onError("manifest", error);

                return this.getActiveInstances();

            } finally {
                this.loaded = true;
                this.loading = false;

                try {
                    this.onRefresh();

                } catch (error) {
                    console.error(
                        "[Anonymous Inspector] Settings refresh failed:",
                        error
                    );
                }
            }
        }

        // --------------------------------------------------
        // ACTIVE SETTINGS
        // --------------------------------------------------

        getActive(id) {
            const item = this.activeSettings.find(
                entry => entry.id === id
            );

            return item ? item.instance : null;
        }

        getActiveInstances() {
            return this.activeSettings.map(
                item => item.instance
            );
        }

        getActiveIds() {
            return this.activeSettings.map(
                item => item.id
            );
        }

        getCount() {
            return this.activeSettings.length;
        }

        // --------------------------------------------------
        // DESTRUCTION
        // --------------------------------------------------

        async destroyInstance(instance) {
            if (
                !instance ||
                typeof instance.destroy !== "function"
            ) {
                return;
            }

            try {
                await instance.destroy();

            } catch (error) {
                console.error(
                    "[Anonymous Inspector] Settings destroy failed:",
                    error
                );
            }
        }

        async destroy(id) {
            const index = this.activeSettings.findIndex(
                item => item.id === id
            );

            if (index === -1) {
                return false;
            }

            const [item] = this.activeSettings.splice(
                index,
                1
            );

            await this.destroyInstance(item.instance);

            return true;
        }

        async destroyAll() {
            this.destroyed = true;

            const entries = [
                ...this.activeSettings
            ].reverse();

            this.activeSettings = [];

            for (const item of entries) {
                await this.destroyInstance(item.instance);
            }
        }

        // --------------------------------------------------
        // STATUS
        // --------------------------------------------------

        getStatus() {
            return {
                loaded: this.loaded,
                loading: this.loading,
                destroyed: this.destroyed,
                registered: this.settings.size,
                active: this.activeSettings.length,
                registeredIds: this.getRegisteredIds(),
                activeIds: this.getActiveIds()
            };
        }
    }

    root.AnonymousInspectorSettingsManager = SettingsManager;

})(globalThis);