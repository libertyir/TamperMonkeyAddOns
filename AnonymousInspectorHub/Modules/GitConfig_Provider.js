(function (Framework) {
    "use strict";
    class GitConfigProvider {
        matchesResource(resource) {
            const raw = typeof resource === "string" ? resource :
                resource && (resource.url || resource.path || resource.name || "");
            if (!raw) return false;
            let pathname = String(raw).split(/[?#]/, 1)[0];
            try { pathname = new URL(pathname, window.location.href).pathname; } catch { }
            const normalized = pathname.replace(/\\/g, "/").toLowerCase();
            return normalized.endsWith("/.git/config") || normalized === ".git/config";
        }
    }
    Framework.registerProvider("GitConfig_Provider", GitConfigProvider);
})(Framework);
