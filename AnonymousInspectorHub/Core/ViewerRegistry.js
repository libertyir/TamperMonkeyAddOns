(function (root) {
    "use strict";
    class ViewerRegistry {
        constructor(options = {}) {
            if (!options.moduleManager) throw new Error("ViewerRegistry requires ModuleManager.");
            this.moduleManager = options.moduleManager;
        }
        getCandidates() {
            const viewers = [];
            for (const id of this.moduleManager.getRegisteredIds()) {
                try {
                    const ModuleClass = this.moduleManager.get(id);
                    if (typeof ModuleClass !== "function") continue;
                    const prototype = ModuleClass.prototype || {};
                    if (!/(?:_Viewer|Viewer)$/i.test(id) ||
                        typeof prototype.init !== "function" ||
                        typeof prototype.render !== "function") continue;
                    const metadata = typeof ModuleClass.getMetadata === "function"
                        ? ModuleClass.getMetadata() : {};
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
            return this.getCandidates().filter(viewer => {
                const providerId = viewer.ModuleClass.providerId;
                if (typeof providerId !== "string" || !providerId.trim()) return false;
                const provider = this.moduleManager.getProvider(providerId);
                if (!provider || typeof provider.matchesResource !== "function") return false;
                try {
                    return provider.matchesResource(resource) === true;
                } catch (error) {
                    console.warn("[Anonymous Inspector] Provider matching failed:", providerId, error);
                    return false;
                }
            }).map(({ ModuleClass, ...metadata }) => metadata);
        }
    }
    root.AnonymousInspectorViewerRegistry = ViewerRegistry;
})(globalThis);
