(function (Framework) {
    "use strict";

    class MetricsModule extends Framework.BaseModule {
        static id = "MetricsModule";
        static title = "Metrics Inspector";

        async init() {
            this.available = true;
        }

        render() {
            return null;
        }
    }

    Framework.register(MetricsModule.id, MetricsModule);

    Framework.registerDescriptor(MetricsModule.id, {
        components: [
            {
                id: "Metrics_Scanner",
                type: "module",
                path: "Metrics/Metrics_Scanner.js"
            },
            {
                id: "Metrics_Viewer",
                type: "module",
                path: "Metrics/Metrics_Viewer.js"
            },
            {
                id: "Metrics_Provider",
                type: "provider",
                path: "Metrics/Metrics_Provider.js"
            }
        ]
    });
})(Framework);
