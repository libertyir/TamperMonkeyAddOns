class WebStructureInspectorUI extends Framework.BaseSettings {
    static get id() {
        return "WebStructureInspectorUI";
    }

    static get title() {
        return "Web Structure Inspector";
    }

    static get description() {
        return "Web resource discovery and directory explorer settings";
    }

    static get icon() {
        return "📁";
    }

    constructor() {
        super();

        this.available = true;

        this.settings = {
            sensitiveScope: "both",
            grabberScope: "same-origin",
            sensitiveDetection: "both"
        };
    }

    async init() {
        const saved = await Framework.Storage.getMetadata(
            "web-structure-settings:" + location.origin
        );

        if (saved && typeof saved === "object") {
            this.settings = {
                ...this.settings,
                ...saved
            };
        }

        this.settings.sensitiveScope =
            ["current", "root", "both"].includes(
                this.settings.sensitiveScope
            )
                ? this.settings.sensitiveScope
                : "both";

        this.settings.grabberScope =
            ["same-origin", "subdomain"].includes(
                this.settings.grabberScope
            )
                ? this.settings.grabberScope
                : "same-origin";

        this.settings.sensitiveDetection =
            ["extension-name", "content", "both"].includes(
                this.settings.sensitiveDetection
            )
                ? this.settings.sensitiveDetection
                : "both";
    }

    createElement(tag, attributes = {}, text = null) {
        const element = Framework.createElement(tag, attributes);

        if (text !== null) {
            element.textContent = String(text);
        }

        return element;
    }

    createField(title, description, control) {
        const wrapper = this.createElement("div", {
            style: "padding:13px 0;border-bottom:1px solid rgba(128,128,128,.25);"
        });

        wrapper.append(
            this.createElement("div", {
                style: "font-weight:600;margin-bottom:5px;"
            }, title),
            this.createElement("div", {
                style: "font-size:12px;opacity:.7;margin-bottom:9px;"
            }, description),
            control
        );

        return wrapper;
    }

    createSelect(value, options) {
        const select = this.createElement("select", {
            style: `
                min-width:220px;
                max-width:100%;
                padding:8px;
                border:1px solid #777;
                border-radius:5px;
                background:transparent;
                color:inherit;
            `
        });

        for (const optionData of options) {
            const option = this.createElement("option", {
                value: optionData.value
            }, optionData.label);

            option.selected = value === optionData.value;
            select.appendChild(option);
        }

        return select;
    }

    render() {
        const container = this.createElement("div", {
            style: "max-width:650px;"
        });

        const status = this.createElement("div", {
            style: "margin-top:12px;font-size:12px;"
        });

        const sensitiveScope = this.createSelect(
            this.settings.sensitiveScope,
            [
                { value: "current", label: "Current Directory" },
                { value: "root", label: "Website Root" },
                { value: "both", label: "Both" }
            ]
        );

        const grabberScope = this.createSelect(
            this.settings.grabberScope,
            [
                { value: "same-origin", label: "Same Origin" },
                { value: "subdomain", label: "Same Host and Subdomains" }
            ]
        );

        const sensitiveDetection = this.createSelect(
            this.settings.sensitiveDetection,
            [
                { value: "extension-name", label: "Filename and Extension Only" },
                { value: "content", label: "Content Analysis Only" },
                { value: "both", label: "Filename, Extension and Content" }
            ]
        );

        const saveButton = this.createElement("button", {
            type: "button",
            textContent: "Save Settings",
            style: `
                margin-top:18px;
                padding:9px 15px;
                border:1px solid #777;
                border-radius:5px;
                background:rgba(128,128,128,.15);
                color:inherit;
                cursor:pointer;
            `
        });

        saveButton.addEventListener("click", async () => {
            const settings = {
                sensitiveScope: sensitiveScope.value,
                grabberScope: grabberScope.value,
                sensitiveDetection: sensitiveDetection.value
            };

            try {
                await Framework.Storage.saveMetadata(
                    "web-structure-settings:" + location.origin,
                    settings
                );

                this.settings = settings;

                status.style.color = "#72bd82";
                status.textContent = "Settings saved successfully.";

            } catch (error) {
                status.style.color = "#e77";
                status.textContent =
                    "Unable to save settings: " + error.message;
            }
        });

        container.append(
            this.createElement("h3", {}, "Web Structure Inspector"),
            this.createField(
                "Sensitive Search Scope",
                "Select where the Sensitive Search action checks known sensitive filenames.",
                sensitiveScope
            ),
            this.createField(
                "Grabber Scope",
                "Choose whether the Grabber is restricted to the current origin or may visit subdomains.",
                grabberScope
            ),
            this.createField(
                "Sensitive Detection",
                "Choose whether sensitive tagging uses filename patterns, content inspection, or both.",
                sensitiveDetection
            ),
            this.createField(
                "Tree Persistence",
                "Resource tree data is always stored permanently for this origin.",
                this.createElement("div", {
                    style: "font-size:12px;color:#75bd83;"
                }, "Permanent — Always Enabled")
            ),
            saveButton,
            status
        );

        return container;
    }
}

Framework.registerSettings(
    "WebStructureInspectorUI",
    WebStructureInspectorUI
);