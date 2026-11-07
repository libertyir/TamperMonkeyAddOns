(function (Framework) {
    "use strict";

    class AdminPanelModule extends Framework.BaseModule {
        static id = "AdminPanelModule";
        static title = "AdminPanel Inspector";

        async init() {
            this.available = true;
        }

        render() {
            return null;
        }
    }

    Framework.register(AdminPanelModule.id, AdminPanelModule);

    Framework.registerDescriptor(AdminPanelModule.id, {
        components: [
            {
                id: "AdminPanel_Scanner",
                type: "module",
                path: "AdminPanel/AdminPanel_Scanner.js"
            },
            {
                id: "AdminPanel_Viewer",
                type: "module",
                path: "AdminPanel/AdminPanel_Viewer.js"
            },
            {
                id: "AdminPanel_Provider",
                type: "provider",
                path: "AdminPanel/AdminPanel_Provider.js"
            }
        ]
    });
})(Framework);
