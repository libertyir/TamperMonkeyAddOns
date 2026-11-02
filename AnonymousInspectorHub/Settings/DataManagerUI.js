
class DataManagerUI extends Framework.BaseSettings {

    static get id() {
        return "DataManagerUI";
    }

    static get title() {
        return "Data Manager";
    }

    static get description() {
        return "Backup and restore application settings";
    }

    static get icon() {
        return "💾";
    }

    static get BACKUP_VERSION() {
        return 1;
    }

    static get STORAGE_KEYS() {
        return {
            sites: "aih_sites_config",
            modules: "aih_modules_config"
        };
    }

    constructor() {
        super();
        this.available = true;
    }

    readStorage(key) {
        if (typeof GM_getValue === "function") {
            return GM_getValue(key, null);
        }

        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
    }

    writeStorage(key, value) {
        if (typeof GM_setValue === "function") {
            GM_setValue(key, value);
        } else {
            localStorage.setItem(key, JSON.stringify(value));
        }
    }

    createButton(text, callback, color = "#303030") {
        const button = Framework.createElement("button", {
            type: "button",
            textContent: text,
            style: `
                padding:9px 14px;
                border:1px solid #555;
                border-radius:5px;
                background:${color};
                color:#fff;
                cursor:pointer;
            `
        });

        button.addEventListener("click", callback);

        return button;
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

    collectBackup() {
        return {
            application: "AnonymousInspectorHub",
            backupVersion: this.constructor.BACKUP_VERSION,
            createdAt: new Date().toISOString(),

            settings: {
                general: Framework.getConfig(),
                sites: this.readStorage(
                    this.constructor.STORAGE_KEYS.sites
                ),
                modules: this.readStorage(
                    this.constructor.STORAGE_KEYS.modules
                )
            }
        };
    }

    validateBackup(data) {
        if (!data || typeof data !== "object") {
            throw new Error("Invalid backup file.");
        }

        if (data.application !== "AnonymousInspectorHub") {
            throw new Error("This file is not an application backup.");
        }

        if (data.backupVersion !== this.constructor.BACKUP_VERSION) {
            throw new Error("Unsupported backup version.");
        }

        if (!data.settings || typeof data.settings !== "object") {
            throw new Error("Backup settings are missing.");
        }

        if (
            data.settings.sites !== null &&
            data.settings.sites !== undefined &&
            !Array.isArray(data.settings.sites)
        ) {
            throw new Error("Invalid sites configuration.");
        }

        if (
            data.settings.modules !== null &&
            data.settings.modules !== undefined &&
            !Array.isArray(data.settings.modules)
        ) {
            throw new Error("Invalid modules configuration.");
        }

        if (
            data.settings.general !== null &&
            data.settings.general !== undefined &&
            (
                typeof data.settings.general !== "object" ||
                Array.isArray(data.settings.general)
            )
        ) {
            throw new Error("Invalid general configuration.");
        }

        return true;
    }

    downloadBackup() {
        const backup = this.collectBackup();
        const content = JSON.stringify(backup, null, 4);

        const blob = new Blob(
            [content],
            { type: "application/json" }
        );

        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");

        const date = new Date()
            .toISOString()
            .replace(/[:.]/g, "-");

        link.href = url;
        link.download = `AIH-Backup-${date}.json`;

        document.body.appendChild(link);
        link.click();
        link.remove();

        URL.revokeObjectURL(url);
    }

    async restoreBackup(file) {
        const content = await file.text();
        const backup = JSON.parse(content);

        this.validateBackup(backup);

        const settings = backup.settings;

        if (settings.general !== undefined) {
            Framework.setConfig(settings.general);
        }

        if (settings.sites !== undefined) {
            this.writeStorage(
                this.constructor.STORAGE_KEYS.sites,
                settings.sites
            );
        }

        if (settings.modules !== undefined) {
            this.writeStorage(
                this.constructor.STORAGE_KEYS.modules,
                settings.modules
            );
        }
    }

    render() {
        const container = Framework.createElement("div", {
            style: "max-width:650px;"
        });

        const status = Framework.createElement("div", {
            style: "margin-top:15px;font-size:12px;"
        });

        const showStatus = (message, success = false) => {
            status.style.color = success ? "#8bcf91" : "#ff7777";
            status.textContent = message;
        };

        const exportButton = this.createButton(
            "Export Backup",
            () => {
                try {
                    this.downloadBackup();
                    showStatus("Backup exported successfully.", true);
                } catch (error) {
                    showStatus("Export failed: " + error.message);
                }
            },
            "#285238"
        );

        const fileInput = Framework.createElement("input", {
            type: "file",
            accept: ".json,application/json",
            style: `
                display:block;
                width:100%;
                max-width:350px;
                color:#ccc;
            `
        });

        const restoreButton = this.createButton(
            "Restore Backup",
            async () => {
                const file = fileInput.files[0];

                if (!file) {
                    showStatus("Select a backup file first.");
                    return;
                }

                if (!confirm(
                    "Restoring a backup will overwrite current settings. Continue?"
                )) {
                    return;
                }

                try {
                    await this.restoreBackup(file);

                    showStatus(
                        "Backup restored successfully. Reload the page to apply all changes.",
                        true
                    );

                    fileInput.value = "";

                } catch (error) {
                    showStatus(
                        "Restore failed: " + error.message
                    );
                }
            },
            "#285238"
        );

        container.append(
            this.createElement("h3", {
                textContent: "Backup",
                style: "font-size:16px;margin-bottom:10px;"
            }),

            this.createField(
                "Export Settings",
                "Download a JSON backup containing general settings, site configurations and module configurations.",
                exportButton
            ),

            this.createElement("h3", {
                textContent: "Restore",
                style: "font-size:16px;margin-top:25px;margin-bottom:10px;"
            }),

            this.createField(
                "Backup File",
                "Select a previously exported Anonymous Inspector Hub JSON backup.",
                fileInput
            ),

            restoreButton,
            status
        );

        return container;
    }
}

Framework.registerSettings("DataManagerUI", DataManagerUI);
