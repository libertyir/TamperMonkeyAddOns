
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

    // --------------------------------------------------
    // UI HELPERS
    // --------------------------------------------------

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

    createReadOnlyInput(value) {
        return Framework.createElement("input", {
            type: "text",
            value: String(value),
            readOnly: true,
            spellcheck: "false",
            style: `
                width:100%;
                max-width:420px;
                padding:9px;
                border:1px solid #555;
                border-radius:4px;
                background:#181818;
                color:#ddd;
                font-family:monospace;
                font-size:13px;
                box-sizing:border-box;
                user-select:all;
            `
        });
    }

    createInfoLine(label, value) {
        const row = Framework.createElement("div", {
            style: `
                display:flex;
                justify-content:space-between;
                gap:15px;
                padding:7px 0;
                border-bottom:1px solid #303030;
                font-size:12px;
            `
        });

        const name = Framework.createElement("span", {
            textContent: label,
            style: "color:#aaa;"
        });

        const content = Framework.createElement("span", {
            textContent: String(value),
            style: `
                color:#ddd;
                text-align:right;
                font-family:monospace;
                overflow-wrap:anywhere;
            `
        });

        row.append(name, content);

        return row;
    }

    // --------------------------------------------------
    // CRYPTO SECTION
    // --------------------------------------------------

    createCryptoSection() {
        const cryptoStatus = Framework.Crypto.getStatus();
        const algorithm = Framework.Crypto.getAlgorithm();
        const encryptionKey = Framework.Crypto.getKey();

        if (!cryptoStatus.initialized || !cryptoStatus.keyAvailable) {
            throw new Error("Encryption service is not initialized.");
        }

        const section = Framework.createElement("div", {
            style: `
                margin-top:30px;
                padding:16px;
                border:1px solid #444;
                border-radius:6px;
                background:#202020;
            `
        });

        const heading = Framework.createElement("div", {
            textContent: "Encryption",
            style: `
                font-size:16px;
                font-weight:bold;
                margin-bottom:8px;
                color:#fff;
            `
        });

        const description = Framework.createElement("div", {
            textContent:
                "Application-wide encryption key and cryptographic configuration.",
            style: `
                font-size:12px;
                color:#aaa;
                margin-bottom:18px;
            `
        });

        const keyInput = this.createReadOnlyInput(encryptionKey);

        const keyContainer = Framework.createElement("div", {
            style: `
                display:flex;
                align-items:center;
                flex-wrap:wrap;
                gap:8px;
            `
        });

        const copyButton = Framework.createElement("button", {
            type: "button",
            textContent: "Copy Key",
            style: `
                padding:9px 14px;
                border:1px solid #555;
                border-radius:5px;
                background:#303030;
                color:#fff;
                cursor:pointer;
            `
        });

        const copyStatus = Framework.createElement("span", {
            style: "font-size:12px;color:#8bcf91;"
        });

        copyButton.addEventListener("click", async () => {
            try {
                await Framework.copy(encryptionKey);

                copyStatus.style.color = "#8bcf91";
                copyStatus.textContent = "Key copied.";

            } catch (error) {
                copyStatus.style.color = "#ff7777";
                copyStatus.textContent =
                    "Copy failed: " + error.message;
            }
        });

        keyContainer.append(
            keyInput,
            copyButton,
            copyStatus
        );

        const keyField = this.createField(
            "Encryption Key",
            "Fixed 12-character application key. Read-only. Keep this key safe; encrypted data cannot be recovered without it.",
            keyContainer
        );

        const algorithmContainer = Framework.createElement("div", {
            style: "margin-top:18px;"
        });

        const algorithmHeading = Framework.createElement("div", {
            textContent: "Algorithm Configuration",
            style: `
                font-size:13px;
                font-weight:bold;
                color:#ddd;
                margin-bottom:10px;
            `
        });

        algorithmContainer.append(
            algorithmHeading,

            this.createInfoLine(
                "Encryption",
                algorithm.encryption
            ),

            this.createInfoLine(
                "Key Derivation",
                algorithm.keyDerivation
            ),

            this.createInfoLine(
                "Hash",
                algorithm.hash
            ),

            this.createInfoLine(
                "PBKDF2 Iterations",
                algorithm.iterations.toLocaleString()
            ),

            this.createInfoLine(
                "Key Length",
                algorithm.keyLength + " bits"
            ),

            this.createInfoLine(
                "Key Characters",
                algorithm.keyCharacters
            )
        );

        const warning = Framework.createElement("div", {
            textContent:
                "Warning: Losing this key means losing access to data encrypted with it.",
            style: `
                margin-top:16px;
                padding:10px;
                border-left:3px solid #d69a43;
                background:#30291f;
                color:#e7c58d;
                font-size:12px;
                line-height:1.6;
            `
        });

        section.append(
            heading,
            description,
            keyField,
            algorithmContainer,
            warning
        );

        return section;
    }

    // --------------------------------------------------
    // SETTINGS
    // --------------------------------------------------

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
            status,
            this.createCryptoSection()
        );

        return container;
    }
}

Framework.registerSettings("GeneralUI", GeneralUI);
