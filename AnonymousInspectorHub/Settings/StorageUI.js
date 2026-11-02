class StorageUI extends Framework.BaseSettings {

    static get id() {
        return "StorageUI";
    }

    static get title() {
        return "Storage";
    }

    static get description() {
        return "View and manage application storage";
    }

    static get icon() {
        return "▤";
    }

    static get STORAGE_ITEMS() {
        return [
            {
                id: "general",
                title: "General Configuration",
                key: "aih_general_config"
            },
            {
                id: "sites",
                title: "Sites Configuration",
                key: "aih_sites_config"
            },
            {
                id: "modules",
                title: "Modules Configuration",
                key: "aih_modules_config"
            }
        ];
    }

    constructor() {
        super();
        this.available = true;
    }

    readValue(key) {
        if (typeof GM_getValue !== "function") {
            throw new Error(
                "GM_getValue is unavailable. Check userscript @grant."
            );
        }

        return GM_getValue(key, null);
    }

    deleteValue(key) {
        if (typeof GM_deleteValue !== "function") {
            throw new Error(
                "GM_deleteValue is unavailable. Check userscript @grant."
            );
        }

        return GM_deleteValue(key);
    }

    getSize(value) {
        if (value === null || value === undefined) {
            return "0 bytes";
        }

        const size = new Blob([
            JSON.stringify(value)
        ]).size;

        if (size < 1024) {
            return size + " bytes";
        }

        if (size < 1024 * 1024) {
            return (size / 1024).toFixed(2) + " KB";
        }

        return (size / (1024 * 1024)).toFixed(2) + " MB";
    }

    createButton(text, callback, color = "#303030") {
        const button = Framework.createElement("button", {
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

    render() {
        const container = Framework.createElement("div", {
            style: "max-width:750px;"
        });

        const status = Framework.createElement("div", {
            style: "margin-top:15px;font-size:12px;"
        });

        const storageList = Framework.createElement("div", {
            style: "margin-top:20px;"
        });

        const showStatus = (message, success = false) => {
            status.style.color = success ? "#8bcf91" : "#ff7777";
            status.textContent = message;
        };

        const renderStorage = () => {
            storageList.replaceChildren();

            let totalSize = 0;

            for (const item of this.constructor.STORAGE_ITEMS) {
                let value = null;
                let readError = null;

                try {
                    value = this.readValue(item.key);
                } catch (error) {
                    readError = error.message;
                }

                const exists = value !== null && value !== undefined;

                const serialized = exists
                    ? JSON.stringify(value)
                    : "";

                const size = exists
                    ? new Blob([serialized]).size
                    : 0;

                totalSize += size;

                const row = Framework.createElement("div", {
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

                const details = Framework.createElement("div", {
                    style: "flex:1;min-width:180px;"
                });

                details.append(
                    Framework.createElement("div", {
                        textContent: item.title,
                        style: "font-size:14px;font-weight:bold;"
                    }),

                    Framework.createElement("div", {
                        textContent: "Key: " + item.key,
                        style: "margin-top:5px;color:#aaa;font-size:11px;"
                    }),

                    Framework.createElement("div", {
                        textContent: readError
                            ? "Read error: " + readError
                            : exists
                                ? "Stored | Size: " + this.getSize(value)
                                : "Empty",
                        style: `
                            margin-top:5px;
                            color:${readError ? "#ff7777" : exists ? "#8bcf91" : "#aaa"};
                            font-size:12px;
                        `
                    })
                );

                const clearButton = this.createButton(
                    "Clear",
                    () => {
                        if (!exists) {
                            showStatus(
                                "This storage item is already empty."
                            );
                            return;
                        }

                        if (!confirm(
                            "Clear " + item.title + "?"
                        )) {
                            return;
                        }

                        try {
                            this.deleteValue(item.key);
                            renderStorage();

                            showStatus(
                                item.title + " cleared successfully.",
                                true
                            );

                        } catch (error) {
                            showStatus(
                                "Clear failed: " + error.message
                            );
                        }
                    },
                    "#542929"
                );

                clearButton.disabled = !exists || Boolean(readError);

                row.append(details, clearButton);
                storageList.appendChild(row);
            }

            const summary = Framework.createElement("div", {
                textContent: "Total known storage: " +
                    this.getSize(totalSize),
                style: `
                    margin-top:15px;
                    padding:12px;
                    border-top:1px solid #444;
                    color:#ddd;
                    font-size:13px;
                `
            });

            storageList.appendChild(summary);
        };

        const refreshButton = this.createButton(
            "Refresh",
            () => {
                renderStorage();
                showStatus(
                    "Storage information refreshed.",
                    true
                );
            }
        );

        const clearAllButton = this.createButton(
            "Clear All Configurations",
            () => {
                if (!confirm(
                    "This will clear all known AIH configurations. Continue?"
                )) {
                    return;
                }

                try {
                    for (const item of this.constructor.STORAGE_ITEMS) {
                        this.deleteValue(item.key);
                    }

                    renderStorage();

                    showStatus(
                        "All known configurations cleared. Reload the page to apply defaults.",
                        true
                    );

                } catch (error) {
                    showStatus(
                        "Operation failed: " + error.message
                    );
                }
            },
            "#542929"
        );

        container.append(
            Framework.createElement("h3", {
                textContent: "Application Storage",
                style: "font-size:16px;margin-bottom:10px;"
            }),

            Framework.createElement("div", {
                textContent: "View and manage the storage entries currently known to Anonymous Inspector Hub.",
                style: "font-size:12px;color:#aaa;margin-bottom:15px;"
            }),

            Framework.createElement("div", {
                style: "display:flex;gap:8px;flex-wrap:wrap;"
            }, [
                refreshButton,
                clearAllButton
            ]),

            storageList,
            status
        );

        renderStorage();

        return container;
    }
}

Framework.registerSettings("StorageUI", StorageUI);