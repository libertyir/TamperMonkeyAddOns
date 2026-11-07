(function (Framework) {
    "use strict";

    class SwaggerUIModule extends Framework.BaseModule {
        static id = "SwaggerUIModule";
        static title = "SwaggerUI Inspector";

        async init() {
            this.available = true;
        }

        render() {
            return null;
        }
    }

    Framework.register(SwaggerUIModule.id, SwaggerUIModule);

    Framework.registerDescriptor(SwaggerUIModule.id, {
        components: [
            {
                id: "SwaggerUI_Scanner",
                type: "module",
                path: "SwaggerUI/SwaggerUI_Scanner.js"
            },
            {
                id: "SwaggerUI_Viewer",
                type: "module",
                path: "SwaggerUI/SwaggerUI_Viewer.js"
            },
            {
                id: "SwaggerUI_Provider",
                type: "provider",
                path: "SwaggerUI/SwaggerUI_Provider.js"
            }
        ]
    });
})(Framework);
