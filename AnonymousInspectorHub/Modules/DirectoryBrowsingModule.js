(function (Framework) {
    "use strict";

    class DirectoryBrowsingModule extends Framework.BaseModule {
        static id = "DirectoryBrowsingModule";
        static title = "DirectoryBrowsing Inspector";

        async init() {
            this.available = true;
        }

        render() {
            return null;
        }
    }

    Framework.register(DirectoryBrowsingModule.id, DirectoryBrowsingModule);

    Framework.registerDescriptor(DirectoryBrowsingModule.id, {
        components: [
            {
                id: "DirectoryBrowsing_Scanner",
                type: "module",
                path: "DirectoryBrowsing/DirectoryBrowsing_Scanner.js"
            },
            {
                id: "DirectoryBrowsing_Viewer",
                type: "module",
                path: "DirectoryBrowsing/DirectoryBrowsing_Viewer.js"
            },
            {
                id: "DirectoryBrowsing_Provider",
                type: "provider",
                path: "DirectoryBrowsing/DirectoryBrowsing_Provider.js"
            }
        ]
    });
})(Framework);
