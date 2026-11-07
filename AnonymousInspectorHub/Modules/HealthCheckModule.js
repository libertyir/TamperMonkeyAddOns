(function (Framework) {
    "use strict";

    class HealthCheckModule extends Framework.BaseModule {
        static id = "HealthCheckModule";
        static title = "HealthCheck Inspector";

        async init() {
            this.available = true;
        }

        render() {
            return null;
        }
    }

    Framework.register(HealthCheckModule.id, HealthCheckModule);

    Framework.registerDescriptor(HealthCheckModule.id, {
        components: [
            {
                id: "HealthCheck_Scanner",
                type: "module",
                path: "HealthCheck/HealthCheck_Scanner.js"
            },
            {
                id: "HealthCheck_Viewer",
                type: "module",
                path: "HealthCheck/HealthCheck_Viewer.js"
            },
            {
                id: "HealthCheck_Provider",
                type: "provider",
                path: "HealthCheck/HealthCheck_Provider.js"
            }
        ]
    });
})(Framework);
