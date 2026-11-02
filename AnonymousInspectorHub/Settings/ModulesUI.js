
class ModulesUI extends Framework.BaseSettings {

    static get id() {
        return "ModulesUI";
    }

    static get title() {
        return "Modules";
    }

    static get description() {
        return "Manage application modules";
    }

    static get icon() {
        return "🧩";
    }

    static get STORAGE_KEY() {
        return "aih_modules_config";
    }

    constructor() {
        super();

        this.modules = [];
        this.available = true;
    }

    async init() {
        this.loadModules();
        this.available = true;
    }

    loadModules() {
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

            this.modules = Array.isArray(saved)
                ? saved.filter(module =>
                    module &&
                    typeof module.id === "string" &&
                    typeof module.enabled === "boolean"
                )
                : [];

        } catch (error) {
            console.error(
                "[Anonymous Inspector] Modules load failed:",
                error
            );

            this.modules = [];
        }
    }

    saveModules() {
        try {
            if (typeof GM_setValue === "function") {
                GM_setValue(
                    this.constructor.STORAGE_KEY,
                    this.modules
                );
            } else {
                localStorage.setItem(
                    this.constructor.STORAGE_KEY,
                    JSON.stringify(this.modules)
                );
            }

            return true;

        } catch (error) {
            throw new Error("Storage failed: " + error.message);
        }
    }

    normalizeId(value) {
        const id = String(value || "").trim();

        if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
            throw new Error("Invalid module ID.");
        }

        return id;
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
            style: "margin-top:12px;font-size:12px;"
        });

        const moduleInput = this.createElement("input", {
            type: "text",
            placeholder: "Example: SwaggerUI_Viewer",
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

        const descriptionInput = this.createElement("input", {
            type: "text",
            placeholder: "Module description",
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

        const moduleList = this.createElement("div", {
            style: "margin-top:20px;"
        });

        const showStatus = (message, success = false) => {
            status.style.color = success ? "#8bcf91" : "#ff7777";
            status.textContent = message;
        };

        const renderModules = () => {
            moduleList.replaceChildren();

            if (!this.modules.length) {
                moduleList.appendChild(this.createElement("div", {
                    textContent: "No modules have been configured.",
                    style: "padding:15px 0;color:#aaa;font-size:13px;"
                }));

                return;
            }

            this.modules.forEach((module, index) => {
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
                        textContent: module.description || "No description",
                        style: "margin-top:5px;color:#aaa;font-size:12px;"
                    }),
                    this.createElement("div", {
                        textContent: module.enabled ? "Enabled" : "Disabled",
                        style: `
                            margin-top:5px;
                            color:${module.enabled ? "#8bcf91" : "#ff7777"};
                            font-size:11px;
                        `
                    })
                );

                const actions = this.createElement("div", {
                    style: "display:flex;gap:6px;flex-wrap:wrap;"
                });

                const toggleButton = this.createButton(
                    module.enabled ? "Disable" : "Enable",
                    () => {
                        module.enabled = !module.enabled;

                        try {
                            this.saveModules();
                            renderModules();
                            showStatus("Module configuration updated.", true);
                        } catch (error) {
                            showStatus(error.message);
                        }
                    }
                );

                const deleteButton = this.createButton(
                    "Delete",
                    () => {
                        this.modules.splice(index, 1);

                        try {
                            this.saveModules();
                            renderModules();
                            showStatus("Module configuration deleted.", true);
                        } catch (error) {
                            showStatus(error.message);
                        }
                    },
                    "#542929"
                );

                actions.append(toggleButton, deleteButton);
                row.append(details, actions);

                moduleList.appendChild(row);
            });
        };

        const addButton = this.createButton(
            "Add Module",
            () => {
                try {
                    const id = this.normalizeId(moduleInput.value);

                    if (this.modules.some(module => module.id === id)) {
                        throw new Error("This module already exists.");
                    }

                    this.modules.push({
                        id,
                        description: descriptionInput.value.trim(),
                        enabled: true
                    });

                    this.saveModules();

                    moduleInput.value = "";
                    descriptionInput.value = "";

                    renderModules();
                    showStatus("Module added successfully.", true);

                } catch (error) {
                    showStatus(error.message);
                }
            },
            "#285238"
        );

        container.append(
            this.createElement("h3", {
                textContent: "Add Module",
                style: "font-size:16px;margin-bottom:10px;"
            }),

            this.createElement("div", {
                textContent: "Module ID",
                style: "font-size:13px;margin-bottom:6px;"
            }),

            moduleInput,

            this.createElement("div", {
                textContent: "Description",
                style: "font-size:13px;margin:12px 0 6px;"
            }),

            descriptionInput,

            this.createElement("div", {
                style: "margin-top:15px;"
            }, [addButton]),

            this.createElement("h3", {
                textContent: "Configured Modules",
                style: "font-size:16px;margin-top:30px;"
            }),

            moduleList,
            status
        );

        renderModules();

        return container;
    }
}

Framework.registerSettings("ModulesUI", ModulesUI);
