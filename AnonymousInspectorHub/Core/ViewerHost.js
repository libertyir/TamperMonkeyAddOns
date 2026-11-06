(function (root) {
    "use strict";
    class ViewerHost {
        constructor(options = {}) {
            if (!options.registry || !options.moduleManager) {
                throw new Error("ViewerHost requires ViewerRegistry and ModuleManager.");
            }
            this.registry = options.registry;
            this.moduleManager = options.moduleManager;
            this.current = null;
        }
        async open(id, context = {}) {
            if (this.current) await this.close();
            const viewer = this.registry.get(id);
            if (!viewer) throw new Error("Viewer is not available: " + id);
            let instance = null;
            let managed = true;
            try {
                const providerId = viewer.ModuleClass.providerId;
                let result = context.result || null;
                const provider = typeof providerId === "string" && providerId.trim()
                    ? this.moduleManager.getProvider(providerId)
                    : null;

                if (!result && provider && typeof provider.getResult === "function") {
                    result = await provider.getResult(context);
                }

                if (result) {
                    managed = false;
                    instance = new viewer.ModuleClass();
                    await instance.init({ ...context, result });
                } else {
                    instance = await this.moduleManager.initialize(id, context);
                }
                if (!instance || instance.available === false) {
                    throw new Error("Viewer initialization failed: " + id);
                }
                this.current = { id, instance, context, managed };
                return {
                    id,
                    metadata: {
                        id: viewer.id,
                        title: viewer.title,
                        description: viewer.description,
                        icon: viewer.icon
                    },
                    instance,
                    content: typeof instance.render === "function" ? instance.render() : null
                };
            } catch (error) {
                if (instance && typeof instance.destroy === "function") {
                    try { await instance.destroy(); } catch { }
                }
                throw error;
            }
        }
        async close() {
            const current = this.current;
            this.current = null;
            if (!current) return false;
            if (!current.managed && current.instance &&
                typeof current.instance.destroy === "function") {
                await current.instance.destroy();
            }
            return true;
        }
        getCurrent() {
            return this.current ? { id: this.current.id, context: this.current.context } : null;
        }
    }
    root.AnonymousInspectorViewerHost = ViewerHost;
})(globalThis);
