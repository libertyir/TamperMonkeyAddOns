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
            { id: "GitConfig_Scanner", type: "module", path: "GitConfig/GitConfig_Scanner.js" },
            { id: "GitConfig_Viewer", type: "module", path: "GitConfig/GitConfig_Viewer.js" },
            { id: "GitConfig_Provider", type: "provider", path: "GitConfig/GitConfig_Provider.js" }
        ]
    });
})(Framework);
