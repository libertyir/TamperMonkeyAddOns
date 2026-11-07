(function (Framework) {
    "use strict";
    class GitConfigScanner extends Framework.BaseModule {
        static id = "GitConfig_Scanner";
        static title = "Git Config Scanner";
        static description = "Fetch and validate an exposed Git configuration";
        static scanPolicy = { scope: "origin-root", defaultTTL: "7d" };
        constructor() { super(); this.cancelled = false; }
        async scan(context = {}) {
            this.cancelled = false;
            const pageUrl = typeof context.url === "string" ? context.url : window.location.href;
            const origin = new URL(pageUrl).origin;
            const directoryUrl = origin + "/";
            const fileUrl = new URL("/.git/config", origin).href;
            const content = await Framework.requestText(fileUrl);
            if (this.cancelled) throw new Error("Git Config scan was cancelled.");
            if (typeof content !== "string" || !content.trim() || content.length > 262144)
                throw new Error("The .git/config file is unavailable or invalid.");
            if (!/^\s*\[[^\]]+\]/m.test(content) || !/^\s*[\w.-]+\s*=/m.test(content))
                throw new Error("The response is not a valid Git configuration.");
            return {
                page: pageUrl, directoryUrl, fileUrl, fileName: ".git/config",
                scannedAt: new Date().toISOString(), contentLength: content.length, content
            };
        }
        stop() { this.cancelled = true; }
        destroy() { this.cancelled = true; }
    }
    Framework.register(GitConfigScanner.id, GitConfigScanner);
})(Framework);
