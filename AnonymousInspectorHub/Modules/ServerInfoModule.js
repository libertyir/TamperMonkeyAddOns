(function (Framework) {
    "use strict";

    class ServerInfoModule extends Framework.BaseModule {
        static id = "ServerInfoModule";
        static title = "ServerInfo Inspector";

        async init() {
            this.available = true;
        }

        render() {
            return null;
        }
    }

    Framework.register(ServerInfoModule.id, ServerInfoModule);

    Framework.registerDescriptor(ServerInfoModule.id, {
        components: [
            {
                id: "ServerInfo_Scanner",
                type: "module",
                path: "ServerInfo/ServerInfo_Scanner.js"
            },
            {
                id: "ServerInfo_Viewer",
                type: "module",
                path: "ServerInfo/ServerInfo_Viewer.js"
            },
            {
                id: "ServerInfo_Provider",
                type: "provider",
                path: "ServerInfo/ServerInfo_Provider.js"
            }
        ]
    });
})(Framework);
