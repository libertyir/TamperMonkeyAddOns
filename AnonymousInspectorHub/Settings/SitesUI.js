
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
    }

    async init() {
        this.loadSites();
        this.available = true;
    }

    loadSites() {
        try {
            let saved = null;

            if (typeof GM_getValue === "function") {
                saved = GM_getValue(this.constructor.STORAGE_KEY, null);
            } else {
                const raw = localStorage.getItem(
                    this.constructor.STORAGE_KEY
                );

                saved = raw ? JSON.parse(raw) : null;
            }

            this.sites = Array.isArray(saved)
                ? saved.filter(site =>
                    site &&
                    typeof site.domain === "string" &&
                    typeof site.enabled === "boolean" &&
                    Array.isArray(site.modules)
                )
                : [];

        } catch (error) {
            console.error("[Anonymous Inspector] Sites load failed:", error);
            this.sites = [];
        }
    }

    saveSites() {
        try {
            const data = JSON.stringify(this.sites);

            if (typeof GM_setValue === "function") {
                GM_setValue(this.constructor.STORAGE_KEY, this.sites);
            } else {
                localStorage.setItem(
                    this.constructor.STORAGE_KEY,
                    data
                );
            }

            return true;

        } catch (error) {
            throw new Error("Storage failed: " + error.message);
        }
    }

    normalizeDomain(value) {
        let domain = String(value || "").trim().toLowerCase();

        domain = domain.replace(/^https?:\/\//, "");
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

    render() {
        const container = this.createElement("div", {
            style: "max-width:750px;"
        });

        const status = this.createElement("div", {
            style: "margin-top:12px;font-size:12px;"
        });

        const domainInput = this.createElement("input", {
            type: "text",
            placeholder: "example.com",
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

        const modulesInput = this.createElement("input", {
            type: "text",
            placeholder: "ModuleOne, ModuleTwo",
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

        const enabledInput = this.createElement("input", {
            type: "checkbox"
        });

        enabledInput.checked = true;

        const siteList = this.createElement("div", {
            style: "margin-top:20px;"
        });

        const showStatus = (message, success = false) => {
            status.style.color = success ? "#8bcf91" : "#ff7777";
            status.textContent = message;
        };

        const renderSites = () => {
            siteList.replaceChildren();

            if (!this.sites.length) {
                siteList.appendChild(this.createElement("div", {
                    textContent: "No sites have been configured.",
                    style: "padding:15px 0;color:#aaa;font-size:13px;"
                }));

                return;
            }

            this.sites.forEach((site, index) => {
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
                        ? "Modules: " + site.modules.join(", ")
                        : "Modules: None",
                    style: "margin-top:5px;color:#aaa;font-size:12px;"
                });

                const enabled = this.createElement("div", {
                    textContent: site.enabled ? "Enabled" : "Disabled",
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
                        site.enabled = !site.enabled;

                        try {
                            this.saveSites();
                            renderSites();
                            showStatus("Site status updated.", true);
                        } catch (error) {
                            showStatus(error.message);
                        }
                    }
                );

                const deleteButton = this.createButton(
                    "Delete",
                    () => {
                        this.sites.splice(index, 1);

                        try {
                            this.saveSites();
                            renderSites();
                            showStatus("Site deleted.", true);
                        } catch (error) {
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

        const addButton = this.createButton(
            "Add Site",
            () => {
                try {
                    const domain = this.normalizeDomain(domainInput.value);
                    const modules = this.normalizeModules(modulesInput.value);

                    if (this.sites.some(site => site.domain === domain)) {
                        throw new Error("This domain already exists.");
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
                    showStatus("Site added successfully.", true);

                } catch (error) {
                    showStatus(error.message);
                }
            },
            "#285238"
        );

        const currentDomain = window.location.hostname;

        const currentButton = this.createButton(
            "Use Current Site",
            () => {
                domainInput.value = currentDomain;
            }
        );

        container.append(
            this.createElement("h3", {
                textContent: "Add New Site",
                style: "font-size:16px;margin-bottom:10px;"
            }),

            this.createField(
                "Domain",
                "Enter a hostname without protocol or path.",
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
                style: "display:flex;gap:8px;margin-top:15px;"
            }, [
                addButton,
                currentButton
            ]),

            this.createElement("h3", {
                textContent: "Configured Sites",
                style: "font-size:16px;margin-top:30px;"
            }),

            siteList,
            status
        );

        renderSites();

        return container;
    }
}

Framework.registerSettings("SitesUI", SitesUI);
