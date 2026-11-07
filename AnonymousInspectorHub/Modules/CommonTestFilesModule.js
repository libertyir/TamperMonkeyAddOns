(function (Framework) {
    "use strict";

    class CommonTestFilesModule extends Framework.BaseModule {
        static id = "CommonTestFilesModule";
        static title = "CommonTestFiles Inspector";

        async init() {
            this.available = true;
        }

        render() {
            return null;
        }
    }

    Framework.register(CommonTestFilesModule.id, CommonTestFilesModule);

    Framework.registerDescriptor(CommonTestFilesModule.id, {
        components: [
            {
                id: "CommonTestFiles_Scanner",
                type: "module",
                path: "CommonTestFiles/CommonTestFiles_Scanner.js"
            },
            {
                id: "CommonTestFiles_Viewer",
                type: "module",
                path: "CommonTestFiles/CommonTestFiles_Viewer.js"
            },
            {
                id: "CommonTestFiles_Provider",
                type: "provider",
                path: "CommonTestFiles/CommonTestFiles_Provider.js"
            }
        ]
    });
})(Framework);
