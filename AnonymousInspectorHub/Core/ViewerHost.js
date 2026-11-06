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
            if (this.current) {
                await this.close();
            }

            const viewer = this.registry.get(id);

            if (!viewer) {
                throw new Error("Viewer is not available: " + id);
            }

            let instance = null;
            let scanner = null;
            let managed = true;

            try {
                const scannerId = viewer.ModuleClass.scannerId;

                if (typeof scannerId === "string" && scannerId.trim()) {
                    managed = false;

                    const ScannerClass =
                        await this.moduleManager.load(scannerId);

                    scanner = new ScannerClass();

                    if (typeof scanner.scan !== "function") {
                        throw new Error("Scanner does not implement scan(): " + scannerId);
                    }

                    const result = await scanner.scan(context);

                    instance = new viewer.ModuleClass();

                    if (typeof instance.init !== "function") {
                        throw new Error("Viewer does not implement init(): " + id);
                    }

                    await instance.init({
                        ...context,
                        result
                    });
                } else {
                    instance = await this.moduleManager.initialize(id);
                }

                if (!instance || instance.available === false) {
                    throw new Error("Viewer initialization failed: " + id);
                }

                this.current = {
                    id,
                    instance,
                    context,
                    scanner,
                    managed
                };

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
            } catch (error) {
                if (!managed && instance && typeof instance.destroy === "function") {
                    try {
                        await instance.destroy();
                    } catch { }
                }

                if (scanner && typeof scanner.destroy === "function") {
                    try {
                        await scanner.destroy();
                    } catch { }
                }

                throw error;
            }
        }

        async close() {
            const current = this.current;
            this.current = null;

            if (!current) return false;

            if (!current.managed) {
                if (current.instance && typeof current.instance.destroy === "function") {
                    await current.instance.destroy();
                }

                if (current.scanner && typeof current.scanner.destroy === "function") {
                    await current.scanner.destroy();
                }
            }

            // ModuleManager owns lifecycle for legacy module-backed viewers.
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