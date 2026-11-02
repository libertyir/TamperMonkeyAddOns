
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

    createCopyButton(value, label) {
        const container = Framework.createElement("div", {
            style: `
                display:flex;
                align-items:center;
                flex-wrap:wrap;
                gap:8px;
            `
        });

        const input = this.createReadOnlyInput(value);

        const button = Framework.createElement("button", {
            type: "button",
            textContent: label,
            style: `
                padding:9px 14px;
                border:1px solid #555;
                border-radius:5px;
                background:#303030;
                color:#fff;
                cursor:pointer;
            `
        });

        const status = Framework.createElement("span", {
            style: "font-size:12px;color:#8bcf91;"
        });

        button.addEventListener("click", async () => {
            try {
                await Framework.copy(value);
                status.style.color = "#8bcf91";
                status.textContent = "Copied.";

            } catch (error) {
                status.style.color = "#ff7777";
                status.textContent = "Copy failed: " + error.message;
            }
        });

        container.append(input, button, status);

        return container;
    }

    // --------------------------------------------------
    // CRYPTO SECTION
    // --------------------------------------------------

    createCryptoSection() {
        const cryptoStatus = Framework.Crypto.getStatus();
        const algorithm = Framework.Crypto.getAlgorithm();
        const encryptionKey = Framework.Crypto.getKey();
        const iv = Framework.Crypto.getIV();

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
                "Application-wide encryption configuration. The same key is shared across all websites.",
            style: `
                font-size:12px;
                color:#aaa;
                margin-bottom:18px;
            `
        });

        const keyField = this.createField(
            "Encryption Key (Hex)",
            "A randomly generated 128-bit key. Generated once and stored in shared userscript GM Storage. Keep a backup of this key.",
            this.createCopyButton(encryptionKey, "Copy Key")
        );

        const ivField = this.createField(
            "Initialization Vector (IV)",
            "Fixed 16-byte zero IV. This value is included in encrypted payloads.",
            this.createCopyButton(iv, "Copy IV")
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
                "AES-128-CBC"
            ),

            this.createInfoLine(
                "Padding",
                "PKCS7"
            ),

            this.createInfoLine(
                "Key Length",
                "128 bits (16 bytes)"
            ),

            this.createInfoLine(
                "Key Format",
                "32-character hexadecimal"
            ),

            this.createInfoLine(
                "IV Length",
                "128 bits (16 bytes)"
            ),

            this.createInfoLine(
                "IV Format",
                "Fixed zero IV"
            ),

            this.createInfoLine(
                "Key Storage",
                "Userscript GM Storage"
            )
        );

        const opensslCommand =
            "openssl enc -d -aes-128-cbc -a " +
            "-K " + encryptionKey + " " +
            "-iv " + iv;

        const opensslField = this.createField(
            "OpenSSL Decryption Command",
            "Extract the Base64 ciphertext value from the payload and pass it to this command through standard input.",
            this.createCopyButton(opensslCommand, "Copy Command")
        );

        const opensslExample = Framework.createElement("div", {
            textContent:
                "echo \"BASE64_CIPHERTEXT\" | " + opensslCommand,
            style: `
                margin-top:8px;
                padding:10px;
                background:#181818;
                border:1px solid #383838;
                border-radius:4px;
                color:#ddd;
                font-family:monospace;
                font-size:11px;
                overflow-wrap:anywhere;
                line-height:1.6;
            `
        });

        const warning = Framework.createElement("div", {
            textContent:
                "Warning: This encryption is intended for lightweight obfuscation, not strong security. Anyone who can access the userscript source or GM Storage can recover the encryption key. Losing the key means losing access to encrypted data.",
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
            ivField,
            algorithmContainer,
            opensslField,
            opensslExample,
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
