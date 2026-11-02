class ModulesUI extends Framework.BaseSettings {

    static get id() {
        return "ModulesUI";
    }

    static get title() {
        return "Configured Modules";
    }

    static get description() {
        return "Enable or disable configured modules";
    }

    static get icon() {
        return "🧩";
    }

    constructor() {
        super();

        this.modules = [];
        this.searchQuery = "";
        this.available = true;
    }

    async init() {
        this.loadModules();
        this.available = true;
    }

    loadModules() {
        this.modules = Framework.getConfiguredModules();
        return this.modules;
    }

    createElement(tag, attributes = {}, children = []) {
        return Framework.createElement(tag, attributes, children);
    }

    createButton(label, callback, background = "#303030") {
        const button = this.createElement("button", {
            type: "button",
            textContent: label,
            style: `
                padding:7px 12px;
                border:1px solid #555;
                border-radius:4px;
                background:${background};
                color:#fff;
                cursor:pointer;
            `
        });

        button.addEventListener("click", callback);

        return button;
    }

    render() {
        const container = this.createElement("div", {
            style: "max-width:750px;"
        });

        const status = this.createElement("div", {
            style: "margin-top:12px;font-size:12px;color:#aaa;"
        });

        const searchInput = this.createElement("input", {
            type: "text",
            placeholder: "Search modules...",
            style: `
                width:100%;
                padding:9px;
                box-sizing:border-box;
                border:1px solid #555;
                border-radius:4px;
                background:#222;
                color:#fff;
            `
        });

        const moduleList = this.createElement("div", {
            style: "margin-top:15px;"
        });

        const showStatus = (message, success = false) => {
            status.style.color = success
                ? "#8bcf91"
                : "#ff7777";

            status.textContent = message;
        };

        const renderModules = () => {
            moduleList.replaceChildren();

            const query = this.searchQuery.trim().toLowerCase();

            const filtered = this.modules.filter(module =>
                module.id.toLowerCase().includes(query)
            );

            if (!this.modules.length) {
                moduleList.appendChild(this.createElement("div", {
                    textContent: "No modules were registered during initialization.",
                    style: "padding:15px 0;color:#aaa;font-size:13px;"
                }));

                return;
            }

            if (!filtered.length) {
                moduleList.appendChild(this.createElement("div", {
                    textContent: "No matching modules found.",
                    style: "padding:15px 0;color:#aaa;font-size:13px;"
                }));

                return;
            }

            filtered.forEach(module => {
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

                details.append(
                    this.createElement("div", {
                        textContent: module.id,
                        style: "font-size:14px;font-weight:bold;"
                    }),

                    this.createElement("div", {
                        textContent: module.enabled
                            ? "Enabled"
                            : "Disabled",
                        style: `
                            margin-top:5px;
                            color:${module.enabled ? "#8bcf91" : "#ff7777"};
                            font-size:11px;
                        `
                    })
                );

                const toggleButton = this.createButton(
                    module.enabled ? "Disable" : "Enable",
                    () => {
                        const newState = !module.enabled;

                        try {
                            Framework.setModuleEnabled(
                                module.id,
                                newState
                            );

                            module.enabled = newState;

                            renderModules();

                            showStatus(
                                "Module configuration saved. Changes apply after page reload.",
                                true
                            );

                        } catch (error) {
                            showStatus(error.message);
                        }
                    },
                    module.enabled ? "#542929" : "#285238"
                );

                row.append(details, toggleButton);
                moduleList.appendChild(row);
            });
        };

        searchInput.addEventListener("input", () => {
            this.searchQuery = searchInput.value;
            renderModules();
        });

        container.append(
            this.createElement("h3", {
                textContent: "Configured Modules",
                style: "font-size:16px;margin-bottom:10px;"
            }),

            this.createElement("div", {
                textContent: "Modules registered during initial startup. Changes apply after page reload.",
                style: "font-size:12px;color:#aaa;margin-bottom:12px;"
            }),

            searchInput,
            moduleList,
            status
        );

        renderModules();

        return container;
    }
}

Framework.registerSettings("ModulesUI", ModulesUI);