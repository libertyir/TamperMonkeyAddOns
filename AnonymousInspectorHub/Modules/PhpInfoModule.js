(function (Framework) {
    "use strict";

    class PhpInfoModule extends Framework.BaseModule {
        static id = "PhpInfoModule";
        static title = "PhpInfo Inspector";

        async init() {
            this.available = true;
        }

        render() {
            return null;
        }
    }

    Framework.register(PhpInfoModule.id, PhpInfoModule);

    Framework.registerDescriptor(PhpInfoModule.id, {
        components: [
            {
                id: "PhpInfo_Scanner",
                type: "module",
                path: "PhpInfo/PhpInfo_Scanner.js"
            },
            {
                id: "PhpInfo_Viewer",
                type: "module",
                path: "PhpInfo/PhpInfo_Viewer.js"
            },
            {
                id: "PhpInfo_Provider",
                type: "provider",
                path: "PhpInfo/PhpInfo_Provider.js"
            }
        ]
    });
})(Framework);
