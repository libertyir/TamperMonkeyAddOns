(function (root) {
    "use strict";

    class KernelConfig {
        constructor(kernel) {
            if (!kernel) {
                throw new Error("KernelConfig requires a kernel instance.");
            }
            this.kernel = kernel;
        }

        normalizeConfig(config = {}) {
            const defaults = this.kernel.defaultConfig;
            return {
                maxConcurrentModules:
                    Number.isInteger(config.maxConcurrentModules) &&
                    config.maxConcurrentModules >= 1 &&
                    config.maxConcurrentModules <= 10
                        ? config.maxConcurrentModules
                        : defaults.maxConcurrentModules,

                requestTimeout:
                    Number.isInteger(config.requestTimeout) &&
                    config.requestTimeout >= 5000 &&
                    config.requestTimeout <= 120000
                        ? config.requestTimeout
                        : defaults.requestTimeout,

                showInitializationSummary:
                    typeof config.showInitializationSummary === "boolean"
                        ? config.showInitializationSummary
                        : defaults.showInitializationSummary
            };
        }

        loadConfig() {
            const saved = this.kernel.GM.getValue(
                this.kernel.configKey,
                null
            );

            this.kernel.config =
                saved &&
                typeof saved === "object" &&
                !Array.isArray(saved)
                    ? this.normalizeConfig(saved)
                    : { ...this.kernel.defaultConfig };

            return this.getConfig();
        }

        getConfig() {
            return { ...this.kernel.config };
        }

        setConfig(updates) {
            if (
                !updates ||
                typeof updates !== "object" ||
                Array.isArray(updates)
            ) {
                throw new Error("Configuration updates must be an object.");
            }

            const allowedKeys = Object.keys(this.kernel.defaultConfig);
            const unknownKeys = Object.keys(updates).filter(
                key => !allowedKeys.includes(key)
            );

            if (unknownKeys.length) {
                throw new Error(
                    "Unknown configuration keys: " + unknownKeys.join(", ")
                );
            }

            const normalized = this.normalizeConfig({
                ...this.kernel.config,
                ...updates
            });

            for (const key of Object.keys(updates)) {
                if (normalized[key] !== updates[key]) {
                    throw new Error("Invalid configuration value: " + key);
                }
            }

            this.kernel.GM.setValue(this.kernel.configKey, normalized);
            this.kernel.config = normalized;
            return this.getConfig();
        }

        getDisabledModules() {
            const saved = this.kernel.GM.getValue(
                this.kernel.modulesConfigKey,
                []
            );

            if (!Array.isArray(saved)) return [];

            return [...new Set(saved.filter(
                id =>
                    typeof id === "string" &&
                    /^[a-zA-Z0-9_-]+$/.test(id)
            ))];
        }

        getConfiguredModules() {
            const disabled = new Set(this.getDisabledModules());

            return this.kernel.configuredModuleIds.map(id => ({
                id,
                enabled: !disabled.has(id)
            }));
        }

        async setModuleEnabled(id, enabled) {
            if (!this.kernel.configuredModuleIds.includes(id)) {
                throw new Error("Module is not configured: " + id);
            }

            if (typeof enabled !== "boolean") {
                throw new Error("Module enabled state must be a boolean.");
            }

            const disabled = this.getDisabledModules();
            const updated = enabled
                ? disabled.filter(moduleId => moduleId !== id)
                : [...new Set([...disabled, id])];

            this.kernel.GM.setValue(this.kernel.modulesConfigKey, updated);

            if (!enabled && this.kernel.moduleManager) {
                await this.kernel.moduleManager.destroy(id);
            }

            return enabled;
        }
    }

    root.AnonymousInspectorKernelConfig = KernelConfig;
})(globalThis);
