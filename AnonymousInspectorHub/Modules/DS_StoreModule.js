(function (Framework) {
    "use strict";

    class DSStoreModule extends Framework.BaseModule {
        static id = "DS_StoreModule";
        static title = "DS_Store Inspector";
        static description = "DS_Store scanner, viewer and data provider";
        static icon = "📁";

        async init() {
            this.available = true;
        }

        render() {
            return null;
        }
    }

    Framework.register(DSStoreModule.id, DSStoreModule);

    Framework.registerDescriptor(DSStoreModule.id, {
        components: [
            {
                id: "DS_Store_Scanner",
                type: "module",
                path: "DS_Store/DS_Store_Scanner.js"
            },
            {
                id: "DS_Store_Viewer",
                type: "module",
                path: "DS_Store/DS_Store_Viewer.js"
            },
            {
                id: "DS_Store_Provider",
                type: "provider",
                path: "DS_Store/DS_Store_Provider.js"
            }
        ]
    });
})(Framework);
