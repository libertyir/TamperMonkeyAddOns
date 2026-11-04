
(function (root) {
    "use strict";

    class CoreLoader {
        constructor(options = {}) {
            if (typeof options.requestText !== "function") {
                throw new Error(
                    "CoreLoader requires a requestText function."
                );
            }

            if (typeof options.baseUrl !== "string") {
                throw new Error(
                    "CoreLoader requires a baseUrl."
                );
            }

            if (
                typeof options.getStorageAdapterDefinition !==
                "function"
            ) {
                throw new Error(
                    "CoreLoader requires a storage adapter definition provider."
                );
            }

            this.requestText = options.requestText;
            this.baseUrl = options.baseUrl.replace(/\/?$/, "/");
            this.getStorageAdapterDefinition =
                options.getStorageAdapterDefinition;

            this.loadedFiles = [];
            this.loading = false;
            this.loaded = false;
        }

        getFileList() {
            const files = [
                "Core/Application.js",
                "Core/Framework.js",
                "Core/ModuleManager.js",
                "Core/SettingsManager.js",
                "Core/SiteManager.js",
                "Core/CryptoManager.js",
                "Core/StorageManager.js",

                // Site Intelligence
                "Core/SiteIntelligence/ResourceRepository.js",
                "Core/SiteIntelligence/ResourceScanner.js",
                "Core/SiteIntelligence/SiteStructureManager.js",
                "Core/SiteIntelligence/SiteIntelligenceService.js",

                // Storage
                "Storage/StorageAdapter.js"
            ];

            const adapterDefinition =
                this.getStorageAdapterDefinition();

            if (
                !adapterDefinition ||
                typeof adapterDefinition.path !== "string" ||
                typeof adapterDefinition.className !== "string"
            ) {
                throw new Error(
                    "Invalid storage adapter definition."
                );
            }

            files.push(adapterDefinition.path);
            files.push("Core/UIManager.js");

            return {
                files,
                adapterDefinition
            };
        }

        getRequiredComponents(adapterDefinition) {
            return [
                "AnonymousInspectorApplication",
                "AnonymousInspectorFrameworkFactory",
                "AnonymousInspectorModuleManager",
                "AnonymousInspectorSettingsManager",
                "AnonymousInspectorSiteManager",
                "AnonymousInspectorCryptoManager",
                "AnonymousInspectorStorageManager",
                "AnonymousInspectorStorageAdapter",
                adapterDefinition.className,
                "AnonymousInspectorUIManager",

                // Site Intelligence
                "AnonymousInspectorResourceRepository",
                "AnonymousInspectorResourceScanner",
                "AnonymousInspectorSiteStructureManager",
                "AnonymousInspectorSiteIntelligenceService"
            ];
        }

        async loadFile(path) {
            const url = this.baseUrl + path;
            const source = await this.requestText(url);

            if (
                typeof source !== "string" ||
                !source.trim()
            ) {
                throw new Error(
                    "Core file unavailable: " + path
                );
            }

            try {
                new Function(
                    source + "\n//# sourceURL=" + url
                )();
            } catch (error) {
                throw new Error(
                    "Failed to execute core file: " +
                    path +
                    " - " +
                    error.message
                );
            }

            this.loadedFiles.push(path);
        }

        validateComponents(adapterDefinition) {
            const required =
                this.getRequiredComponents(adapterDefinition);

            const missing = required.filter(
                name => typeof root[name] !== "function"
            );

            if (missing.length) {
                throw new Error(
                    "Core components not loaded: " +
                    missing.join(", ")
                );
            }
        }

        async load() {
            if (this.loaded) {
                return this.getStatus();
            }

            if (this.loading) {
                throw new Error(
                    "CoreLoader is already loading."
                );
            }

            this.loading = true;
            this.loadedFiles = [];

            try {
                const {
                    files,
                    adapterDefinition
                } = this.getFileList();

                for (const path of files) {
                    await this.loadFile(path);
                }

                this.validateComponents(adapterDefinition);

                this.loaded = true;

                return this.getStatus();

            } finally {
                this.loading = false;
            }
        }

        getStatus() {
            return {
                loaded: this.loaded,
                loading: this.loading,
                loadedFiles: [...this.loadedFiles],
                totalFiles: this.loadedFiles.length
            };
        }
    }

    root.AnonymousInspectorCoreLoader = CoreLoader;

})(globalThis);
