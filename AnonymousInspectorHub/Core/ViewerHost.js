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
            const viewer = this.registry.get(id);

            if (!viewer) {
                throw new Error("Viewer is not available: " + id);
            }

            const instance = await this.moduleManager.initialize(id);

            if (!instance || instance.available === false) {
                throw new Error("Viewer initialization failed: " + id);
            }

            this.current = { id, instance, context };

            return {
                id,
                metadata: {
                    id: viewer.id,
                    title: viewer.title,
                    description: viewer.description,
                    icon: viewer.icon
                },
                instance,
                content: typeof instance.render === "function"
                    ? instance.render()
                    : null
            };
        }

        async close() {
            const current = this.current;
            this.current = null;

            if (!current) return false;

            // ModuleManager owns module lifecycle and destruction.
            return true;
        }

        getCurrent() {
            return this.current
                ? { id: this.current.id, context: this.current.context }
                : null;
        }
    }

    root.AnonymousInspectorViewerHost = ViewerHost;

})(globalThis);
