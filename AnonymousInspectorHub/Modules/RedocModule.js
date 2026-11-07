(function (Framework) {
    "use strict";

    class RedocModule extends Framework.BaseModule {
        static id = "RedocModule";
        static title = "Redoc Inspector";

        async init() {
            this.available = true;
        }

        render() {
            return null;
        }
    }

    Framework.register(RedocModule.id, RedocModule);

    Framework.registerDescriptor(RedocModule.id, {
        components: [
            {
                id: "Redoc_Scanner",
                type: "module",
                path: "Redoc/Redoc_Scanner.js"
            },
            {
                id: "Redoc_Viewer",
                type: "module",
                path: "Redoc/Redoc_Viewer.js"
            },
            {
                id: "Redoc_Provider",
                type: "provider",
                path: "Redoc/Redoc_Provider.js"
            }
        ]
    });
})(Framework);
