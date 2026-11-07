(function (Framework) {
    "use strict";

    class ApachiServerStatusModule extends Framework.BaseModule {
        static id = "ApachiServerStatusModule";
        static title = "ApachiServerStatus Inspector";

        async init() {
            this.available = true;
        }

        render() {
            return null;
        }
    }

    Framework.register(ApachiServerStatusModule.id, ApachiServerStatusModule);

    Framework.registerDescriptor(ApachiServerStatusModule.id, {
        components: [
            {
                id: "ApachiServerStatus_Scanner",
                type: "module",
                path: "ApachiServerStatus/ApachiServerStatus_Scanner.js"
            },
            {
                id: "ApachiServerStatus_Viewer",
                type: "module",
                path: "ApachiServerStatus/ApachiServerStatus_Viewer.js"
            },
            {
                id: "ApachiServerStatus_Provider",
                type: "provider",
                path: "ApachiServerStatus/ApachiServerStatus_Provider.js"
            }
        ]
    });
})(Framework);
