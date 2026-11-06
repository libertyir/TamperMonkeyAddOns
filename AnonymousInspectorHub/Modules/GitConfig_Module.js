(function (Framework) {
    "use strict";
    class GitConfigModule extends Framework.BaseModule {
        static id = "GitConfig_Module";
        static title = "Git Config Inspector";
        static description = "Git configuration viewer and resource provider";
        async init() { this.available = true; }
        render() { return null; }
    }
    Framework.register(GitConfigModule.id, GitConfigModule);
    Framework.registerDescriptor(GitConfigModule.id, {
        components: [
            { id: "GitConfig_Viewer", type: "module", path: "GitConfig_Viewer.js" },
            { id: "GitConfig_Provider", type: "provider", path: "GitConfig_Provider.js" }
        ]
    });
})(Framework);
