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

    static get CONFIG_KEYS() {
        return {
            aih_general_config: "General Configuration",
            aih_sites_config: "Sites Configuration",
            aih_modules_config: "Modules Configuration",
            aih_encryption_key: "Encryption Key",
            aih_cloud_config: "Cloud Configuration",
            aih_cloud_sync_state: "Cloud Sync State"
        };
    }

    static get STORES() {
        return [
            { id: "websites", title: "Websites" },
            { id: "results", title: "Module Results" },
            { id: "metadata", title: "Metadata and Resource Cache" },
            { id: "executions", title: "Execution History" }
        ];
    }

    static get GM_STORAGE_PREFIX() {
        return "aih_storage_v1:";
    }

    constructor() {
        super();
        this.available = true;
    }

    getSize(value) {
        let serialized;

        try {
            serialized = JSON.stringify(value);
        } catch {
            serialized = String(value);
        }

        if (serialized === undefined) {
            serialized = String(value);
        }

        return new Blob([serialized]).size;
    }

    formatSize(size) {
        if (size < 1024) {
            return size + " bytes";
        }

        if (size < 1024 * 1024) {
            return (size / 1024).toFixed(2) + " KB";
        }

        if (size < 1024 * 1024 * 1024) {
            return (size / (1024 * 1024)).toFixed(2) + " MB";
        }

        return (size / (1024 * 1024 * 1024)).toFixed(2) + " GB";
    }

    getRecordKey(store, record) {
        if (!record || typeof record !== "object") {
            return null;
        }

        const fields = {
            websites: "guid",
            results: "resultGuid",
            metadata: "key",
            executions: "guid"
        };

        const field = fields[store];
        const key = field ? record[field] : null;

        return key === undefined || key === null || key === ""
            ? null
            : key;
    }

    getRecordLabel(store, record, key) {
        if (store === "metadata") {
            return String(key);
        }

        if (store === "websites") {
            return record.domain || String(key);
        }

        if (store === "results") {
            return (record.moduleId || "Unknown module") + " | " + String(key);
        }

        if (store === "executions") {
            return (record.moduleId || "Unknown module") + " | " + String(key);
        }

        return String(key);
    }

    createButton(text, callback, color = "#303030") {
        const button = Framework.createElement("button", {
            type: "button",
            textContent: text,
            style: [
                "padding:7px 12px",
                "border:1px solid #555",
                "border-radius:4px",
                "background:" + color,
                "color:#fff",
                "cursor:pointer"
            ].join(";")
        });

        button.addEventListener("click", callback);

        return button;
    }

    createSection(title, description) {
        const section = Framework.createElement("section", {
            style: "margin-top:20px;padding:12px;border:1px solid #444;border-radius:6px;background:#1c1c1c;"
        });

        const heading = Framework.createElement("div", {
            textContent: title,
            style: "font-size:14px;font-weight:bold;color:#eee;"
        });

        const detail = Framework.createElement("div", {
            textContent: description,
            style: "margin-top:4px;font-size:11px;color:#aaa;"
        });

        const list = Framework.createElement("div", {
            style: "margin-top:12px;"
        });

        section.append(heading, detail, list);

        return { section, list };
    }

    createRow(title, subtitle, size, onDelete, disabled = false) {
        const row = Framework.createElement("div", {
            style: "display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px;padding:10px;margin-bottom:7px;border:1px solid #383838;border-radius:5px;background:#242424;"
        });

        const details = Framework.createElement("div", {
            style: "flex:1;min-width:180px;overflow-wrap:anywhere;"
        });

        details.append(
            Framework.createElement("div", {
                textContent: title,
                style: "font-size:12px;font-weight:bold;color:#eee;"
            }),
            Framework.createElement("div", {
                textContent: subtitle,
                style: "margin-top:4px;font-size:11px;color:#aaa;"
            }),
            Framework.createElement("div", {
                textContent: "Size: " + this.formatSize(size),
                style: "margin-top:4px;font-size:11px;color:#8bcf91;"
            })
        );

        const removeButton = this.createButton(
            "Delete",
            onDelete,
            "#542929"
        );

        removeButton.disabled = disabled;
        if (disabled) {
            removeButton.style.opacity = "0.45";
            removeButton.style.cursor = "not-allowed";
        }

        row.append(details, removeButton);

        return row;
    }

    async readGMEntries() {
        if (
            typeof GM_getValue !== "function" ||
            typeof GM_listValues !== "function"
        ) {
            throw new Error("GM storage APIs are unavailable.");
        }

        const listedKeys = await GM_listValues();
        const keys = new Set([
            ...Object.keys(this.constructor.CONFIG_KEYS),
            ...(Array.isArray(listedKeys) ? listedKeys : [])
        ]);

        const entries = [];

        for (const key of keys) {
            if (
                typeof key !== "string" ||
                !key.startsWith("aih_") ||
                key.startsWith(this.constructor.GM_STORAGE_PREFIX)
            ) {
                continue;
            }

            const value = await GM_getValue(key, undefined);

            if (value === undefined) {
                continue;
            }

            entries.push({
                key,
                value,
                title: this.constructor.CONFIG_KEYS[key] || "Other Application Data"
            });
        }

        return entries;
    }

    async readStores() {
        const stores = {};
        for (const item of this.constructor.STORES) {
            stores[item.id] = await Framework.Storage.getAll(item.id);
        }
        return stores;
    }

    async readTemporaryEntries() {
        if (typeof GM_listValues !== "function") throw new Error("GM_listValues is unavailable.");
        const keys = await GM_listValues();
        const entries = [];
        for (const key of keys) {
            if (typeof key !== "string" || !key.startsWith("aih_temp_")) continue;
            const match = key.match(/^aih_temp_(\d+)_(\d+)_([a-f0-9]+)$/i);
            if (!match || Number(match[1]) <= Date.now()) {
                if (typeof GM_deleteValue === "function") await GM_deleteValue(key);
                continue;
            }
            entries.push({ key, expiresAt: Number(match[1]), size: Number(match[2]) });
        }
        return entries;
    }

    async clearTemporaryData() {
        if (typeof GM_listValues !== "function" || typeof GM_deleteValue !== "function") throw new Error("GM storage APIs are unavailable.");
        const keys = await GM_listValues();
        const temporaryKeys = keys.filter(key => typeof key === "string" && key.startsWith("aih_temp_"));
        await Promise.all(temporaryKeys.map(key => GM_deleteValue(key)));
        return temporaryKeys.length;
    }

    async deleteGMEntry(key) {
        if (typeof GM_deleteValue !== "function") {
            throw new Error("GM_deleteValue is unavailable.");
        }

        await GM_deleteValue(key);
    }

    async deleteStoreEntry(store, key) {
        await Framework.Storage.delete(store, key);
    }

    async clearAllData() {
        for (const store of this.constructor.STORES) {
            await Framework.Storage.clear(store.id);
        }

        if (typeof GM_listValues === "function") {
            const keys = await GM_listValues();

            for (const key of keys) {
                if (
                    typeof key === "string" &&
                    key.startsWith("aih_")
                ) {
                    await this.deleteGMEntry(key);
                }
            }
        } else {
            for (const key of Object.keys(this.constructor.CONFIG_KEYS)) {
                await this.deleteGMEntry(key);
            }
        }
    }

    render() {
        const container = Framework.createElement("div", {
            style: "max-width:850px;"
        });

        const status = Framework.createElement("div", {
            style: "margin-top:15px;font-size:12px;color:#aaa;"
        });

        const summary = Framework.createElement("div", {
            style: "margin-top:15px;padding:12px;border:1px solid #555;border-radius:5px;background:#202020;color:#eee;font-size:13px;"
        });

        const storageList = Framework.createElement("div", {
            style: "margin-top:15px;"
        });

        const showStatus = (message, success = false) => {
            status.style.color = success ? "#8bcf91" : "#ff7777";
            status.textContent = message;
        };

        const renderStorage = async () => {
            storageList.replaceChildren();
            summary.textContent = "Reading stored data...";
            status.textContent = "";

            try {
                const [gmEntries, stores, temporaryEntries] = await Promise.all([
                    this.readGMEntries(),
                    this.readStores(),
                    this.readTemporaryEntries()
                ]);

                let totalBytes = 0;
                let totalEntries = 0;

                const gmSection = this.createSection(
                    "Userscript Configuration",
                    "Tampermonkey storage entries used by the application."
                );

                for (const entry of gmEntries) {
                    const size = this.getSize(entry.value);
                    totalBytes += size;
                    totalEntries++;

                    gmSection.list.appendChild(
                        this.createRow(
                            entry.title,
                            "Key: " + entry.key,
                            size,
                            async () => {
                                if (!confirm("Delete " + entry.key + "?")) return;

                                try {
                                    await this.deleteGMEntry(entry.key);
                                    await renderStorage();
                                    showStatus("Entry deleted.", true);
                                } catch (error) {
                                    showStatus("Delete failed: " + error.message);
                                }
                            }
                        )
                    );
                }

                if (!gmEntries.length) {
                    gmSection.list.textContent = "No userscript configuration entries found.";
                }

                storageList.appendChild(gmSection.section);

                const temporaryBytes = temporaryEntries.reduce((total, entry) => total + entry.size, 0);
                const temporarySection = this.createSection(
                    "Temporary Resource Cache",
                    temporaryEntries.length + " compressed temporary record(s), " + this.formatSize(temporaryBytes) + ". Payloads are not read while listing storage."
                );
                for (const entry of temporaryEntries) {
                    totalBytes += entry.size;
                    totalEntries++;
                    temporarySection.list.appendChild(this.createRow(
                        "Temporary Resource",
                        "Key: " + entry.key + " | Expires: " + new Date(entry.expiresAt).toLocaleString(),
                        entry.size,
                        async () => {
                            if (!confirm("Delete this temporary resource?")) return;
                            try {
                                await this.deleteGMEntry(entry.key);
                                await renderStorage();
                                showStatus("Temporary resource deleted.", true);
                            } catch (error) {
                                showStatus("Delete failed: " + error.message);
                            }
                        }
                    ));
                }
                if (!temporaryEntries.length) temporarySection.list.textContent = "No temporary resources.";
                storageList.appendChild(temporarySection.section);

                for (const store of this.constructor.STORES) {
                    const records = stores[store.id] || [];
                    let storeBytes = 0;

                    const section = this.createSection(
                        store.title,
                        records.length + " stored record(s)."
                    );

                    for (const record of records) {
                        const key = this.getRecordKey(store.id, record);
                        const size = this.getSize(record);
                        storeBytes += size;
                        totalBytes += size;
                        totalEntries++;

                        const label = key === null
                            ? "Unidentified record"
                            : this.getRecordLabel(store.id, record, key);

                        section.list.appendChild(
                            this.createRow(
                                label,
                                "Store: " + store.id + " | Key: " +
                                    (key === null ? "Unavailable" : String(key)),
                                size,
                                async () => {
                                    if (key === null) {
                                        showStatus("This record has no identifiable storage key.");
                                        return;
                                    }

                                    if (!confirm("Delete this record?\n" + String(key))) return;

                                    try {
                                        await this.deleteStoreEntry(store.id, key);
                                        await renderStorage();
                                        showStatus("Record deleted.", true);
                                    } catch (error) {
                                        showStatus("Delete failed: " + error.message);
                                    }
                                },
                                key === null
                            )
                        );
                    }

                    if (!records.length) {
                        section.list.textContent = "No records.";
                    }

                    section.section.firstChild.textContent =
                        store.title + " — " + records.length +
                        " record(s), " + this.formatSize(storeBytes);

                    storageList.appendChild(section.section);
                }

                summary.textContent =
                    "Total stored entries: " + totalEntries +
                    " | Estimated total size: " + this.formatSize(totalBytes);

            } catch (error) {
                summary.textContent = "Unable to read storage.";
                showStatus("Storage read failed: " + error.message);
            }
        };

        const refreshButton = this.createButton(
            "Refresh",
            () => {
                renderStorage().then(() => {
                    showStatus("Storage information refreshed.", true);
                });
            }
        );

        const clearTemporaryButton = this.createButton(
            "Clear Temporary Cache",
            async () => {
                if (!confirm("Delete all temporary resource cache entries?")) return;
                try {
                    const count = await this.clearTemporaryData();
                    await renderStorage();
                    showStatus(count + " temporary record(s) deleted.", true);
                } catch (error) {
                    showStatus("Temporary cache cleanup failed: " + error.message);
                }
            },
            "#493d24"
        );

        const clearAllButton = this.createButton(
            "Clear All Application Data",
            async () => {
                if (!confirm(
                    "This will permanently delete all Anonymous Inspector Hub configuration and stored records. Continue?"
                )) {
                    return;
                }

                try {
                    await this.clearAllData();
                    await renderStorage();
                    showStatus("All application data cleared.", true);
                } catch (error) {
                    showStatus("Clear failed: " + error.message);
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
                textContent: "Stored configuration, websites, results, metadata, resource caches and execution records with estimated sizes. Record contents are not displayed.",
                style: "font-size:12px;color:#aaa;margin-bottom:15px;"
            }),
            Framework.createElement("div", {
                style: "display:flex;gap:8px;flex-wrap:wrap;"
            }, [
                refreshButton,
                clearTemporaryButton,
                clearAllButton
            ]),
            summary,
            storageList,
            status
        );

        renderStorage();

        return container;
    }
}

Framework.registerSettings("StorageUI", StorageUI);
