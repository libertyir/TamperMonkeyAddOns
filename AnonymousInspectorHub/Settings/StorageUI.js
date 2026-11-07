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

    getGMStorage() {
        const storage = Framework.GM;
        if (!storage ||
            typeof storage.getValue !== "function" ||
            typeof storage.listValues !== "function" ||
            typeof storage.deleteValue !== "function") {
            throw new Error("Tampermonkey storage bridge is unavailable.");
        }
        return storage;
    }

    async readGMEntries() {
        const gm = this.getGMStorage();
        const listedKeys = await gm.listValues();
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

            const value = await gm.getValue(key, undefined);

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
        const gm = this.getGMStorage();
        const keys = await gm.listValues();
        const entries = [];
        for (const key of keys) {
            if (typeof key !== "string" || !key.startsWith("aih_temp_")) continue;
            const match = key.match(/^aih_temp_(\d+)_(\d+)_([a-f0-9]+)$/i);
            if (!match || Number(match[1]) <= Date.now()) {
                await gm.deleteValue(key);
                continue;
            }
            entries.push({ key, expiresAt: Number(match[1]), size: Number(match[2]) });
        }
        return entries;
    }

    async clearTemporaryData() {
        const gm = this.getGMStorage();
        const keys = await gm.listValues();
        const temporaryKeys = keys.filter(key => typeof key === "string" && key.startsWith("aih_temp_"));
        await Promise.all(temporaryKeys.map(key => gm.deleteValue(key)));
        return temporaryKeys.length;
    }

    async deleteGMEntry(key) {
        const gm = this.getGMStorage();
        await gm.deleteValue(key);
    }

    async deleteStoreEntry(store, key) {
        await Framework.Storage.delete(store, key);
    }

    async clearAllData() {
        for (const store of this.constructor.STORES) {
            await Framework.Storage.clear(store.id);
        }

        const gm = this.getGMStorage();
        if (gm && typeof gm.listValues === "function") {
            const keys = await gm.listValues();

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
            summary.textContent = "Calculating storage usage...";
            status.textContent = "";

            try {
                const [gmEntries, stores, temporaryEntries] = await Promise.all([
                    this.readGMEntries(),
                    this.readStores(),
                    this.readTemporaryEntries()
                ]);

                let totalBytes = 0;
                let totalEntries = 0;

                const appendSummary = (
                    title,
                    description,
                    count,
                    size
                ) => {
                    const section = this.createSection(
                        title,
                        description
                    );

                    section.list.style.fontSize = "12px";
                    section.list.style.color = "#ccc";
                    section.list.textContent =
                        count + " record(s) | " +
                        this.formatSize(size);

                    storageList.appendChild(section.section);

                    totalBytes += size;
                    totalEntries += count;
                };

                const gmBytes = gmEntries.reduce(
                    (total, entry) =>
                        total + this.getSize(entry.value),
                    0
                );

                appendSummary(
                    "Userscript Configuration",
                    "Tampermonkey configuration and application settings.",
                    gmEntries.length,
                    gmBytes
                );

                const temporaryBytes = temporaryEntries.reduce(
                    (total, entry) => total + entry.size,
                    0
                );

                appendSummary(
                    "Temporary Resource Cache",
                    "Temporary cached resources stored by the userscript.",
                    temporaryEntries.length,
                    temporaryBytes
                );

                for (const store of this.constructor.STORES) {
                    const records = stores[store.id] || [];
                    const storeBytes = records.reduce(
                        (total, record) =>
                            total + this.getSize(record),
                        0
                    );

                    appendSummary(
                        store.title,
                        "Stored data size for this section.",
                        records.length,
                        storeBytes
                    );
                }

                summary.textContent =
                    "Total stored entries: " + totalEntries +
                    " | Estimated total size: " +
                    this.formatSize(totalBytes);

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
                textContent: "Storage usage totals by section. Individual records and their contents are not displayed.",
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
