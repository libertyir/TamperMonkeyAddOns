
(function (root) {
    "use strict";

    class SiteManager {
        constructor(options = {}) {
            this.storageKey = options.storageKey || "aih_sites_config";

            this.getValue = options.getValue;
            this.setValue = options.setValue;

            this.sites = [];
            this.initialized = false;
        }

        // --------------------------------------------------
        // DOMAIN NORMALIZATION
        // --------------------------------------------------

        normalizeDomain(value) {
            let domain = String(value || "")
                .trim()
                .toLowerCase();

            domain = domain.replace(/^https?:\/\//, "");
            domain = domain.replace(/^\*\./, "");
            domain = domain.split("/")[0];
            domain = domain.split(":")[0];

            return domain;
        }

        // --------------------------------------------------
        // DOMAIN MATCHING
        // --------------------------------------------------

        matchesDomain(rule, hostname) {
            const baseDomain = this.normalizeDomain(rule);
            const currentDomain = String(hostname || "")
                .toLowerCase();

            if (!baseDomain || !currentDomain) {
                return false;
            }

            return (
                currentDomain === baseDomain ||
                currentDomain.endsWith("." + baseDomain)
            );
        }

        // --------------------------------------------------
        // VALIDATION
        // --------------------------------------------------

        validateSite(site) {
            return (
                site &&
                typeof site === "object" &&
                typeof site.domain === "string" &&
                typeof site.enabled === "boolean" &&
                Array.isArray(site.modules)
            );
        }

        normalizeSite(site) {
            if (!this.validateSite(site)) {
                throw new Error("Invalid site configuration.");
            }

            return {
                ...site,
                domain: this.normalizeDomain(site.domain),
                modules: [...site.modules]
            };
        }

        // --------------------------------------------------
        // INITIALIZATION
        // --------------------------------------------------

        initialize() {
            if (typeof this.getValue !== "function") {
                throw new Error(
                    "Site configuration storage is unavailable."
                );
            }

            const saved = this.getValue(
                this.storageKey,
                []
            );

            this.sites = Array.isArray(saved)
                ? saved.filter(site => this.validateSite(site))
                : [];

            this.initialized = true;

            return this.getAll();
        }

        ensureInitialized() {
            if (!this.initialized) {
                this.initialize();
            }
        }

        // --------------------------------------------------
        // CONFIGURATION ACCESS
        // --------------------------------------------------

        getAll() {
            this.ensureInitialized();

            return this.sites.map(site => ({
                ...site,
                modules: [...site.modules]
            }));
        }

        setAll(sites) {
            if (!Array.isArray(sites)) {
                throw new Error(
                    "Invalid sites configuration."
                );
            }

            if (typeof this.setValue !== "function") {
                throw new Error(
                    "Site configuration storage is unavailable."
                );
            }

            const normalized = sites.map(site =>
                this.normalizeSite(site)
            );

            this.setValue(
                this.storageKey,
                normalized
            );

            this.sites = normalized;
            this.initialized = true;

            return this.getAll();
        }

        // --------------------------------------------------
        // SITE MANAGEMENT
        // --------------------------------------------------

        add(site) {
            this.ensureInitialized();

            const normalized = this.normalizeSite(site);

            const exists = this.sites.some(item =>
                this.normalizeDomain(item.domain) === normalized.domain
            );

            if (exists) {
                throw new Error(
                    "Site configuration already exists: " +
                    normalized.domain
                );
            }

            return this.setAll([
                ...this.sites,
                normalized
            ]);
        }

        update(domain, updates) {
            this.ensureInitialized();

            if (
                !updates ||
                typeof updates !== "object" ||
                Array.isArray(updates)
            ) {
                throw new Error(
                    "Invalid site updates."
                );
            }

            const normalizedDomain = this.normalizeDomain(domain);

            const index = this.sites.findIndex(site =>
                this.normalizeDomain(site.domain) === normalizedDomain
            );

            if (index === -1) {
                throw new Error(
                    "Site configuration not found: " +
                    normalizedDomain
                );
            }

            const updatedSite = this.normalizeSite({
                ...this.sites[index],
                ...updates
            });

            const nextSites = [...this.sites];
            nextSites[index] = updatedSite;

            return this.setAll(nextSites);
        }

        remove(domain) {
            this.ensureInitialized();

            const normalizedDomain = this.normalizeDomain(domain);

            const nextSites = this.sites.filter(site =>
                this.normalizeDomain(site.domain) !== normalizedDomain
            );

            if (nextSites.length === this.sites.length) {
                return false;
            }

            this.setAll(nextSites);

            return true;
        }

        // --------------------------------------------------
        // MATCHING
        // --------------------------------------------------

        getMatchingSites(hostname) {
            this.ensureInitialized();

            const currentHostname = hostname ||
                (
                    typeof location !== "undefined"
                        ? location.hostname
                        : ""
                );

            return this.sites
                .filter(site =>
                    this.matchesDomain(
                        site.domain,
                        currentHostname
                    )
                )
                .sort((a, b) =>
                    this.normalizeDomain(b.domain).length -
                    this.normalizeDomain(a.domain).length
                );
        }

        getMatchingSite(hostname) {
            const matchingSites = this.getMatchingSites(hostname);

            return matchingSites.length
                ? matchingSites[0]
                : null;
        }

        // --------------------------------------------------
        // MODULE ACCESS CONTROL
        // --------------------------------------------------

        getAllowedModules(moduleIds, hostname) {
            if (!Array.isArray(moduleIds)) {
                throw new Error(
                    "Module IDs must be an array."
                );
            }

            const matchingSites = this.getMatchingSites(hostname);

            // No matching rule: preserve original behavior.
            if (!matchingSites.length) {
                return [...moduleIds];
            }

            // Most specific matching rule takes priority.
            const site = matchingSites[0];

            // Disabled site: no modules allowed.
            if (!site.enabled) {
                return [];
            }

            const allowed = new Set(
                site.modules.filter(id =>
                    typeof id === "string" &&
                    /^[a-zA-Z0-9_-]+$/.test(id)
                )
            );

            // Empty Allowed Modules list means no modules.
            return moduleIds.filter(id =>
                allowed.has(id)
            );
        }

        isModuleAllowed(moduleId, hostname) {
            return this.getAllowedModules(
                [moduleId],
                hostname
            ).length > 0;
        }

        // --------------------------------------------------
        // STATUS
        // --------------------------------------------------

        getStatus() {
            this.ensureInitialized();

            return {
                initialized: this.initialized,
                totalSites: this.sites.length,
                domains: this.sites.map(site => site.domain)
            };
        }

        // --------------------------------------------------
        // SHUTDOWN
        // --------------------------------------------------

        destroy() {
            this.sites = [];
            this.initialized = false;
        }
    }

    root.AnonymousInspectorSiteManager = SiteManager;

})(globalThis);
