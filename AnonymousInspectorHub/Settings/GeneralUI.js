
class GeneralUI extends Framework.BaseSettings {

    static get id() {
        return "GeneralUI";
    }

    static get title() {
        return "General";
    }

    static get description() {
        return "General application settings";
    }

    static get icon() {
        return "⚙";
    }

    constructor() {
        super();
        this.available = true;
    }

    createField(title, description, input) {
        const row = Framework.createElement("div", {
            style: "padding:14px 0;border-bottom:1px solid #383838;"
        });

        const label = Framework.createElement("div", {
            textContent: title,
            style: "font-size:14px;font-weight:bold;margin-bottom:5px;"
        });

        const help = Framework.createElement("div", {
            textContent: description,
            style: "font-size:12px;color:#aaa;margin-bottom:10px;"
        });

        row.append(label, help, input);

        return row;
    }

    createNumberInput(value, min, max) {
        return Framework.createElement("input", {
            type: "number",
            value: String(value),
            min: String(min),
            max: String(max),
            style: `
                width:100px;
                padding:7px;
                border:1px solid #555;
                border-radius:4px;
                background:#222;
                color:#fff;
            `
        });
    }

    createCheckbox(checked) {
        const input = Framework.createElement("input", {
            type: "checkbox"
        });

        input.checked = Boolean(checked);

        return input;
    }

    render() {
        const config = Framework.getConfig();

        const container = Framework.createElement("div", {
            style: "max-width:650px;"
        });

        const status = Framework.createElement("div", {
            style: "margin-top:15px;color:#8bcf91;font-size:12px;"
        });

        const concurrency = this.createNumberInput(
            config.maxConcurrentModules,
            1,
            10
        );

        const timeout = this.createNumberInput(
            config.requestTimeout,
            5000,
            120000
        );

        const summary = this.createCheckbox(
            config.showInitializationSummary
        );

        const saveButton = Framework.createElement("button", {
            type: "button",
            textContent: "Save Settings",
            style: `
                margin-top:20px;
                padding:9px 16px;
                border:1px solid #555;
                border-radius:5px;
                background:#303030;
                color:#fff;
                cursor:pointer;
            `
        });

        saveButton.addEventListener("click", () => {
            const concurrencyValue = Number(concurrency.value);
            const timeoutValue = Number(timeout.value);

            if (
                !Number.isInteger(concurrencyValue) ||
                concurrencyValue < 1 ||
                concurrencyValue > 10
            ) {
                status.style.color = "#ff7777";
                status.textContent =
                    "Concurrent modules must be between 1 and 10.";
                return;
            }

            if (
                !Number.isInteger(timeoutValue) ||
                timeoutValue < 5000 ||
                timeoutValue > 120000
            ) {
                status.style.color = "#ff7777";
                status.textContent =
                    "Timeout must be between 5000 and 120000 ms.";
                return;
            }

            try {
                Framework.setConfig({
                    maxConcurrentModules: concurrencyValue,
                    requestTimeout: timeoutValue,
                    showInitializationSummary: summary.checked
                });

                status.style.color = "#8bcf91";
                status.textContent =
                    "Settings saved successfully. " +
                    "Request timeout applies to subsequent requests. " +
                    "Other changes apply on the next page load.";

            } catch (error) {
                status.style.color = "#ff7777";
                status.textContent =
                    "Failed to save settings: " + error.message;
            }
        });

        container.append(
            this.createField(
                "Maximum Concurrent Modules",
                "Maximum number of modules initialized simultaneously. Range: 1–10. Applies on the next page load.",
                concurrency
            ),

            this.createField(
                "Request Timeout",
                "Maximum waiting time for network requests, in milliseconds. Range: 5000–120000. Applies to subsequent requests.",
                timeout
            ),

            this.createField(
                "Show Initialization Summary",
                "Write the initialization summary to the browser console. Applies on the next page load.",
                summary
            ),

            saveButton,
            status
        );

        return container;
    }
}

Framework.registerSettings("GeneralUI", GeneralUI);
