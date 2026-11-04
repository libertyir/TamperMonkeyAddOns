(function (root) {
    "use strict";

    class KernelConfig {
        constructor(kernel) {
            if (!kernel) {
                throw new Error(
                    "KernelConfig requires a kernel instance."
                );
            }

            this.kernel = kernel;
        }

        normalizeConfig(config = {}) {
            const defaults = this.kernel.defaultConfig;

            const maxConcurrentModules =
                Number.isInteger(config.maxConcurrentModules) &&
                config.maxConcurrentModules >= 1 &&
                config.maxConcurrentModules <= 10
                    ? config.maxConcurrentModules
                    : defaults.maxConcurrentModules;

            const requestTimeout =
                Number.isInteger(config.requestTimeout) &&
                config.requestTimeout >= 5000 &&
                config.requestTimeout <= 120000
                    ? config.requestTimeout
                    : defaults.requestTimeout;

            const showInitializationSummary =
                typeof config.showInitializationSummary === "boolean"
                    ? config.showInitializationSummary
                    : defaults.showInitializationSummary;

            return {
                maxConcurrentModules,
                requestTimeout,
                showInitializationSummary
            };
        }

        async loadConfig() {
            const savedConfig = await this.kernel.GM.getValue(
                this.kernel.configKey,
                null
            );

            if (
                savedConfig &&
                typeof savedConfig === "object" &&
                !Array.isArray(savedConfig)
            ) {
                this.kernel.config = this.normalizeConfig(savedConfig);
            } else {
                this.kernel.config = {
                    ...this.kernel.defaultConfig
                };
            }

            return this.getConfig();
        }

        getConfig() {
            return {
                ...this.kernel.config
            };
        }

        async setConfig(updates) {
            if (
                !updates ||
                typeof updates !== "object" ||
                Array.isArray(updates)
            ) {
                throw new Error(
                    "Configuration updates must be an object."
                );
            }

            const allowedKeys = Object.keys(
                this.kernel.defaultConfig
            );

            const unknownKeys = Object.keys(updates).filter(
                key => !allowedKeys.includes(key)
            );

            if (unknownKeys.length) {
                throw new Error(
                    "Unknown configuration keys: " +
                    unknownKeys.join(", ")
                );
            }

            const mergedConfig = {
                ...this.kernel.config,
                ...updates
            };

            const normalizedConfig =
                this.normalizeConfig(mergedConfig);

            for (const key of Object.keys(updates)) {
                if (normalizedConfig[key] !== updates[key]) {
                    throw new Error(
                        "Invalid configuration value: " + key
                    );
                }
            }

            await this.kernel.GM.setValue(
                this.kernel.configKey,
                normalizedConfig
            );

            this.kernel.config = normalizedConfig;

            return this.getConfig();
        }

        async getDisabledModules() {
            const disabled = await this.kernel.GM.getValue(
                this.kernel.modulesConfigKey,
                []
            );

            if (!Array.isArray(disabled)) {
                return [];
            }

            return [
                ...new Set(
                    disabled.filter(
                        id =>
                            typeof id === "string" &&
                            /^[a-zA-Z0-9_-]+$/.test(id)
                    )
                )
            ];
        }

        async getConfiguredModules() {
            const disabled = await this.getDisabledModules();

            return this.kernel.configuredModuleIds.map(id => ({
                id,
                enabled: !disabled.includes(id)
            }));
        }

        async setModuleEnabled(id, enabled) {
            if (
                !this.kernel.configuredModuleIds.includes(id)
            ) {
                throw new Error(
                    "Module is not configured: " + id
                );
            }

            if (typeof enabled !== "boolean") {
                throw new Error(
                    "Module enabled state must be a boolean."
                );
            }

            const disabled = await this.getDisabledModules();

            const updated = enabled
                ? disabled.filter(moduleId => moduleId !== id)
                : [...new Set([...disabled, id])];

            await this.kernel.GM.setValue(
                this.kernel.modulesConfigKey,
                updated
            );

            if (
                !enabled &&
                this.kernel.moduleManager
            ) {
                await this.kernel.moduleManager.destroy(id);
            }

            return enabled;
        }
    }

    root.AnonymousInspectorKernelConfig = KernelConfig;

})(globalThis);