
class SitesUI extends Framework.BaseSettings {

    static get id() {
        return "SitesUI";
    }

    static get title() {
        return "Sites";
    }

    static get description() {
        return "Manage site-specific settings";
    }

    static get icon() {
        return "🌐";
    }

    static get STORAGE_KEY() {
        return "aih_sites_config";
    }

    constructor() {
        super();

        this.sites = [];
        this.available = true;
        this.searchQuery = "";
    }

    async init() {
        this.loadSites();
        this.available = true;
    }

    // --------------------------------------------------
    // STORAGE
    // --------------------------------------------------

    loadSites() {
        try {
            const saved = Framework.getSitesConfig();

            this.sites = Array.isArray(saved)
                ? saved.filter(site =>
                    site &&
                    typeof site.domain === "string" &&
                    typeof site.enabled === "boolean" &&
                    Array.isArray(site.modules)
                )
                : [];

            return this.sites;

        } catch (error) {
            console.error(
                "[Anonymous Inspector] Sites load failed:",
                error
            );

            throw new Error(
                "Unable to load shared site configuration: " +
                error.message
            );
        }
    }

    saveSites() {
        try {
            Framework.setSitesConfig(this.sites);
            return true;

        } catch (error) {
            throw new Error(
                "Shared storage failed: " + error.message
            );
        }
    }

    // --------------------------------------------------
    // DOMAIN VALIDATION
    // --------------------------------------------------

    normalizeDomain(value) {
        let domain = String(value || "")
            .trim()
            .toLowerCase();

        domain = domain.replace(/^https?:\/\//, "");

        // Both example.com and *.example.com
        // are stored as the same canonical domain.
        domain = domain.replace(/^\*\./, "");

        domain = domain.split("/")[0];
        domain = domain.split(":")[0];

        if (!domain || domain.length > 253) {
            throw new Error("Invalid domain.");
        }

        if (
            !/^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/.test(domain)
        ) {
            throw new Error("Invalid domain format.");
        }

        return domain;
    }

    normalizeModules(value) {
        const modules = String(value || "")
            .split(",")
            .map(item => item.trim())
            .filter(Boolean);

        const unique = [...new Set(modules)];

        for (const id of unique) {
            if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
                throw new Error("Invalid module ID: " + id);
            }
        }

        return unique;
    }

    // --------------------------------------------------
    // UI HELPERS
    // --------------------------------------------------

    createElement(tag, attributes = {}, children = []) {
        return Framework.createElement(tag, attributes, children);
    }

    createButton(text, callback, color = "#303030") {
        const button = this.createElement("button", {
            type: "button",
            textContent: text,
            style: `
                padding:7px 12px;
                border:1px solid #555;
                border-radius:4px;
                background:${color};
                color:#fff;
                cursor:pointer;
            `
        });

        button.addEventListener("click", callback);

        return button;
    }

    createField(title, description, input) {
        const row = this.createElement("div", {
            style: `
                padding:12px 0;
                border-bottom:1px solid #383838;
            `
        });

        row.append(
            this.createElement("div", {
                textContent: title,
                style: "font-size:14px;font-weight:bold;margin-bottom:5px;"
            }),

            this.createElement("div", {
                textContent: description,
                style: "font-size:12px;color:#aaa;margin-bottom:9px;"
            }),

            input
        );

        return row;
    }

    createInput(placeholder) {
        return this.createElement("input", {
            type: "text",
            placeholder,
            style: `
                width:100%;
                max-width:350px;
                padding:8px;
                box-sizing:border-box;
                border:1px solid #555;
                border-radius:4px;
                background:#222;
                color:#fff;
            `
        });
    }

    // --------------------------------------------------
    // RENDER
    // --------------------------------------------------

    render() {
        const container = this.createElement("div", {
            style: "max-width:750px;"
        });

        const status = this.createElement("div", {
            style: "margin-top:12px;font-size:12px;"
        });

        const domainInput = this.createInput(
            "example.com or *.example.com"
        );

        const modulesInput = this.createInput(
            "ModuleOne, ModuleTwo"
        );

        const searchInput = this.createInput(
            "Search configured domains..."
        );

        searchInput.style.maxWidth = "100%";

        const enabledInput = this.createElement("input", {
            type: "checkbox"
        });

        enabledInput.checked = true;

        const siteList = this.createElement("div", {
            style: "margin-top:15px;"
        });

        const showStatus = (message, success = false) => {
            status.style.color = success
                ? "#8bcf91"
                : "#ff7777";

            status.textContent = message;
        };

        // --------------------------------------------------
        // SHARED DATA REFRESH
        // --------------------------------------------------

        const refreshSites = () => {
            try {
                this.loadSites();
                renderSites();

                return true;

            } catch (error) {
                showStatus(error.message);
                return false;
            }
        };

        // --------------------------------------------------
        // SITE LIST
        // --------------------------------------------------

        const renderSites = () => {
            siteList.replaceChildren();

            const query = this.searchQuery.trim().toLowerCase();

            const filteredSites = this.sites.filter(site => {
                if (!query) return true;

                return (
                    site.domain.toLowerCase().includes(query) ||
                    site.modules.some(module =>
                        module.toLowerCase().includes(query)
                    )
                );
            });

            if (!this.sites.length) {
                siteList.appendChild(this.createElement("div", {
                    textContent: "No sites have been configured.",
                    style: "padding:15px 0;color:#aaa;font-size:13px;"
                }));

                return;
            }

            if (!filteredSites.length) {
                siteList.appendChild(this.createElement("div", {
                    textContent: "No matching sites found.",
                    style: "padding:15px 0;color:#aaa;font-size:13px;"
                }));

                return;
            }

            filteredSites.forEach(site => {
                const row = this.createElement("div", {
                    style: `
                        display:flex;
                        flex-wrap:wrap;
                        align-items:center;
                        justify-content:space-between;
                        gap:12px;
                        padding:12px;
                        margin-bottom:8px;
                        border:1px solid #444;
                        border-radius:5px;
                        background:#202020;
                    `
                });

                const details = this.createElement("div", {
                    style: "flex:1;min-width:180px;"
                });

                const domain = this.createElement("div", {
                    textContent: site.domain,
                    style: "font-size:14px;font-weight:bold;"
                });

                const modules = this.createElement("div", {
                    textContent: site.modules.length
                        ? "Allowed Modules: " + site.modules.join(", ")
                        : "Allowed Modules: None",
                    style: "margin-top:5px;color:#aaa;font-size:12px;"
                });

                const enabled = this.createElement("div", {
                    textContent: site.enabled
                        ? "Enabled"
                        : "Disabled",
                    style: `
                        margin-top:5px;
                        color:${site.enabled ? "#8bcf91" : "#ff7777"};
                        font-size:11px;
                    `
                });

                details.append(domain, modules, enabled);

                const actions = this.createElement("div", {
                    style: "display:flex;gap:6px;flex-wrap:wrap;"
                });

                const toggleButton = this.createButton(
                    site.enabled ? "Disable" : "Enable",
                    () => {
                        const oldValue = site.enabled;

                        try {
                            site.enabled = !site.enabled;

                            this.saveSites();

                            renderSites();

                            showStatus(
                                "Site status updated successfully.",
                                true
                            );

                        } catch (error) {
                            site.enabled = oldValue;
                            showStatus(error.message);
                        }
                    }
                );

                const deleteButton = this.createButton(
                    "Delete",
                    () => {
                        const index = this.sites.indexOf(site);

                        if (index === -1) {
                            showStatus("Site no longer exists.");
                            refreshSites();
                            return;
                        }

                        const removed = this.sites.splice(index, 1)[0];

                        try {
                            this.saveSites();

                            renderSites();

                            showStatus(
                                "Site deleted successfully.",
                                true
                            );

                        } catch (error) {
                            this.sites.splice(index, 0, removed);
                            showStatus(error.message);
                        }
                    },
                    "#542929"
                );

                actions.append(toggleButton, deleteButton);
                row.append(details, actions);

                siteList.appendChild(row);
            });
        };

        // --------------------------------------------------
        // ADD SITE
        // --------------------------------------------------

        const addButton = this.createButton(
            "Add Site",
            () => {
                try {
                    // Reload shared data before modifying it.
                    this.loadSites();

                    const domain = this.normalizeDomain(
                        domainInput.value
                    );

                    const modules = this.normalizeModules(
                        modulesInput.value
                    );

                    if (
                        this.sites.some(site =>
                            this.normalizeDomain(site.domain) === domain
                        )
                    ) {
                        throw new Error(
                            "This domain already exists."
                        );
                    }

                    this.sites.push({
                        domain,
                        enabled: enabledInput.checked,
                        modules
                    });

                    this.saveSites();

                    domainInput.value = "";
                    modulesInput.value = "";
                    enabledInput.checked = true;

                    renderSites();

                    showStatus(
                        "Site added successfully.",
                        true
                    );

                } catch (error) {
                    showStatus(error.message);
                }
            },
            "#285238"
        );

        // --------------------------------------------------
        // CURRENT SITE
        // --------------------------------------------------

        const currentButton = this.createButton(
            "Use Current Site",
            () => {
                domainInput.value = window.location.hostname;
            }
        );

        // --------------------------------------------------
        // SEARCH
        // --------------------------------------------------

        searchInput.addEventListener("input", () => {
            this.searchQuery = searchInput.value;
            renderSites();
        });

        // --------------------------------------------------
        // REFRESH BUTTON
        // --------------------------------------------------

        const refreshButton = this.createButton(
            "Refresh List",
            () => {
                if (refreshSites()) {
                    showStatus(
                        "Site list refreshed from shared storage.",
                        true
                    );
                }
            }
        );

        // --------------------------------------------------
        // PAGE LAYOUT
        // --------------------------------------------------

        container.append(
            this.createElement("h3", {
                textContent: "Add New Site",
                style: "font-size:16px;margin-bottom:10px;"
            }),

            this.createField(
                "Domain",
                "Enter a hostname. Both example.com and *.example.com include the root domain and all subdomains.",
                domainInput
            ),

            this.createField(
                "Allowed Modules",
                "Comma-separated module IDs. Leave empty to allow no modules.",
                modulesInput
            ),

            this.createField(
                "Site Status",
                "Enable or disable this site configuration.",
                enabledInput
            ),

            this.createElement("div", {
                style: "display:flex;gap:8px;margin-top:15px;flex-wrap:wrap;"
            }, [
                addButton,
                currentButton
            ]),

            this.createElement("h3", {
                textContent: "Configured Sites",
                style: "font-size:16px;margin-top:30px;"
            }),

            this.createField(
                "Search",
                "Filter sites by domain or module ID.",
                searchInput
            ),

            this.createElement("div", {
                style: "margin-top:12px;"
            }, [
                refreshButton
            ]),

            siteList,
            status
        );

        refreshSites();

        return container;
    }
}

Framework.registerSettings("SitesUI", SitesUI);
