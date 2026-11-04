(function (root) {
    "use strict";

    class ViewerRegistry {
        constructor(options = {}) {
            if (!options.moduleManager) {
                throw new Error("ViewerRegistry requires ModuleManager.");
            }

            this.moduleManager = options.moduleManager;
        }

        getCandidates() {
            const ids = this.moduleManager.getRegisteredIds();
            const viewers = [];

            for (const id of ids) {
                try {
                    const ModuleClass = this.moduleManager.get(id);

                    if (typeof ModuleClass !== "function") continue;

                    const prototype = ModuleClass.prototype || {};
                    const isViewerId = /(?:_Viewer|Viewer)$/i.test(id);
                    const hasViewerMethods =
                        typeof prototype.init === "function" &&
                        typeof prototype.render === "function";

                    if (!isViewerId || !hasViewerMethods) continue;

                    const metadata = typeof ModuleClass.getMetadata === "function"
                        ? ModuleClass.getMetadata()
                        : {};

                    viewers.push(Object.freeze({
                        id,
                        title: metadata.title || ModuleClass.title || id,
                        description: metadata.description || ModuleClass.description || "",
                        icon: metadata.icon || ModuleClass.icon || null,
                        ModuleClass
                    }));
                } catch (error) {
                    console.warn("[Anonymous Inspector] Viewer discovery skipped:", id, error);
                }
            }

            return viewers;
        }

        getAll() {
            return this.getCandidates().map(({ ModuleClass, ...metadata }) => metadata);
        }

        get(id) {
            return this.getCandidates().find(viewer => viewer.id === id) || null;
        }

        isAvailable(id) {
            return Boolean(this.get(id));
        }

        find(resource) {
            if (!resource) return [];

            const rawUrl = typeof resource === "string"
                ? resource
                : resource.url || resource.path || resource.name || "";

            let pathname = String(rawUrl);

            try {
                pathname = new URL(pathname, root.location?.href || "https://localhost/").pathname;
            } catch {
                pathname = pathname.split(/[?#]/, 1)[0];
            }

            const normalized = pathname.replace(/\\/g, "/").toLowerCase();
            const basename = normalized.split("/").pop();

            return this.getCandidates().filter(viewer => {
                const id = viewer.id.toLowerCase();

                if (typeof viewer.ModuleClass.matchesResource === "function") {
                    try {
                        return viewer.ModuleClass.matchesResource(resource) === true;
                    } catch {
                        return false;
                    }
                }

                if (id === "ds_store_viewer") return basename === ".ds_store";
                if (id === "gitconfig_viewer") return /\\.git\\/config$/.test(normalized);
                if (id === "text_viewer") return /\\.(txt|log|md|json|xml|ya?ml|ini|conf|cfg|html?|css|js|mjs|cjs|py|php|sh|sql|csv|env)$/i.test(basename);

                return false;
            }).map(({ ModuleClass, ...metadata }) => metadata);
        }
    }

    root.AnonymousInspectorViewerRegistry = ViewerRegistry;

})(globalThis);
