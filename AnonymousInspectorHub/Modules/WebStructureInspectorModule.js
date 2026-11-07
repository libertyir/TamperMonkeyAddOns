(function (Framework) {
    "use strict";

    class WebStructureInspectorModule extends Framework.BaseModule {
        static id = "WebStructureInspectorModule";
        static title = "Web Structure Inspector";
        static description = "Persistent website resource and directory explorer";
        static icon = "📁";

        async init() {
            this.available = true;
        }

        render() {
            return null;
        }
    }

    Framework.register(
        WebStructureInspectorModule.id,
        WebStructureInspectorModule
    );

    Framework.registerDescriptor(WebStructureInspectorModule.id, {
        components: [
            {
                id: "WebStructureInspector_Scanner",
                type: "module",
                path: "WebStructureInspector/WebStructureInspector_Scanner.js"
            },
            {
                id: "WebStructureInspector",
                type: "module",
                path: "WebStructureInspector/WebStructureInspector.js"
            },
            {
                id: "WebStructureInspector_Provider",
                type: "provider",
                path: "WebStructureInspector/WebStructureInspector_Provider.js"
            }
        ]
    });
})(Framework);
