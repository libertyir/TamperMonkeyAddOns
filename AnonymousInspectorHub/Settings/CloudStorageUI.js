
class CloudStorageUI extends Framework.BaseSettings {

    static get id() {
        return "CloudStorageUI";
    }

    static get title() {
        return "Cloud Storage";
    }

    static get description() {
        return "MongoDB cloud synchronization";
    }

    static get icon() {
        return "☁";
    }

    constructor() {
        super();

        this.available = true;
        this.configKey = "aih_cloud_config";
        this.stateKey = "aih_cloud_sync_state";

        this.localCollections = {
            general_config: "aih_general_config",
            sites_config: "aih_sites_config",
            modules_config: "aih_modules_config"
        };

        this.config = this.readValue(this.configKey, {
            enabled: false,
            endpoint: "",
            apiKey: ""
        });
    }

    // --------------------------------------------------
    // STORAGE
    // --------------------------------------------------

    readValue(key, fallback = null) {
        try {
            if (typeof GM_getValue === "function") {
                const value = GM_getValue(key, fallback);
                return value === undefined ? fallback : value;
            }

            const raw = localStorage.getItem(key);

            return raw === null
                ? fallback
                : JSON.parse(raw);

        } catch (error) {
            console.error("[AIH Cloud] Storage read failed:", error);
            return fallback;
        }
    }

    writeValue(key, value) {
        if (typeof GM_setValue === "function") {
            GM_setValue(key, value);
            return;
        }

        localStorage.setItem(key, JSON.stringify(value));
    }

    deleteValue(key) {
        if (typeof GM_deleteValue === "function") {
            GM_deleteValue(key);
            return;
        }

        localStorage.removeItem(key);
    }

    // --------------------------------------------------
    // HELPERS
    // --------------------------------------------------

    createElement(tag, attributes = {}, children = []) {
        return Framework.createElement(tag, attributes, children);
    }

    stableStringify(value) {
        if (value === null || typeof value !== "object") {
            return JSON.stringify(value);
        }

        if (Array.isArray(value)) {
            return "[" + value.map(item =>
                this.stableStringify(item)
            ).join(",") + "]";
        }

        const keys = Object.keys(value).sort();

        return "{" + keys.map(key =>
            JSON.stringify(key) + ":" +
            this.stableStringify(value[key])
        ).join(",") + "}";
    }

    getHash(value, deleted = false) {
        return deleted
            ? "DELETED"
            : this.stableStringify(value);
    }

    getLocalRecord(name) {
        const key = this.localCollections[name];
        const value = this.readValue(key, null);

        return {
            exists: value !== null,
            value
        };
    }

    saveLocalRecord(name, record) {
        const key = this.localCollections[name];

        if (record.deleted) {
            this.deleteValue(key);
        } else {
            this.writeValue(key, record.value);
        }
    }

    // --------------------------------------------------
    // HTTP
    // --------------------------------------------------

    request(method, endpoint, apiKey, body = null) {
        return new Promise((resolve, reject) => {

            if (typeof GM_xmlhttpRequest !== "function") {
                reject(new Error(
                    "GM_xmlhttpRequest is unavailable."
                ));
                return;
            }

            const headers = {
                "Accept": "application/json",
                "x-api-key": apiKey
            };

            if (body !== null) {
                headers["Content-Type"] = "application/json";
            }

            GM_xmlhttpRequest({
                method,
                url: endpoint,
                headers,
                data: body === null
                    ? undefined
                    : JSON.stringify(body),
                timeout: 30000,

                onload: response => {
                    if (
                        response.status < 200 ||
                        response.status >= 300
                    ) {
                        reject(new Error(
                            "HTTP " + response.status +
                            ": " + response.responseText
                        ));
                        return;
                    }

                    try {
                        resolve(JSON.parse(response.responseText));
                    } catch {
                        reject(new Error(
                            "Invalid server response."
                        ));
                    }
                },

                onerror: () => {
                    reject(new Error("Network request failed."));
                },

                ontimeout: () => {
                    reject(new Error("Request timed out."));
                }
            });
        });
    }

    // --------------------------------------------------
    // CLOUD API
    // --------------------------------------------------

    async getCloudRecords() {
        return this.request(
            "GET",
            this.config.endpoint,
            this.config.apiKey
        );
    }

    async uploadRecords(records) {
        if (!records.length) return null;

        return this.request(
            "POST",
            this.config.endpoint,
            this.config.apiKey,
            { records }
        );
    }

    // --------------------------------------------------
    // SYNCHRONIZATION
    // --------------------------------------------------

    async synchronize() {

        if (!this.config.enabled) {
            throw new Error("Cloud Sync is disabled.");
        }

        if (!this.config.endpoint || !this.config.apiKey) {
            throw new Error("Endpoint and API Key are required.");
        }

        const endpoint = this.config.endpoint.trim();

        if (!/^https:\/\/.+\/api\/sync$/i.test(endpoint)) {
            throw new Error(
                "Endpoint must be an HTTPS URL ending with /api/sync."
            );
        }

        const previousState = this.readValue(
            this.stateKey,
            {}
        );

        const cloudResponse = await this.getCloudRecords();

        if (
            !cloudResponse ||
            cloudResponse.success !== true ||
            !cloudResponse.records
        ) {
            throw new Error("Invalid cloud data.");
        }

        const cloudRecords = cloudResponse.records;
        const uploads = [];

        const names = Object.keys(this.localCollections);

        for (const name of names) {

            const local = this.getLocalRecord(name);
            const cloud = cloudRecords[name] || null;
            const previous = previousState[name] || null;

            const localHash = local.exists
                ? this.getHash(local.value)
                : null;

            const cloudHash = cloud
                ? this.getHash(cloud.value, cloud.deleted)
                : null;

            const localChanged = previous
                ? localHash !== previous.hash
                : local.exists;

            const cloudChanged = previous
                ? (
                    !cloud ||
                    cloud.updatedAt !== previous.updatedAt ||
                    cloudHash !== previous.hash
                )
                : Boolean(cloud);

            // Nothing exists on either side.
            if (!local.exists && !cloud && !previous) {
                continue;
            }

            // First synchronization: local data is uploaded.
            if (!previous && local.exists && !cloud) {
                uploads.push({
                    collection: name,
                    value: local.value,
                    updatedAt: Date.now(),
                    deleted: false
                });

                continue;
            }

            // Data exists only in cloud.
            if (!local.exists && cloud) {
                this.saveLocalRecord(name, cloud);
                continue;
            }

            // Data exists only locally.
            if (local.exists && !cloud) {
                uploads.push({
                    collection: name,
                    value: local.value,
                    updatedAt: Date.now(),
                    deleted: false
                });

                continue;
            }

            // No changes.
            if (!localChanged && !cloudChanged) {
                continue;
            }

            // Only cloud changed.
            if (!localChanged && cloudChanged) {
                this.saveLocalRecord(name, cloud);
                continue;
            }

            // Only local changed, including local deletion.
            if (localChanged && !cloudChanged) {

                uploads.push({
                    collection: name,
                    value: local.exists ? local.value : null,
                    updatedAt: Math.max(
                        Date.now(),
                        (cloud?.updatedAt || 0) + 1
                    ),
                    deleted: !local.exists
                });

                continue;
            }

            // Both sides changed: latest timestamp wins.
            const localUpdatedAt = Math.max(
                Date.now(),
                (previous?.updatedAt || 0) + 1
            );

            const cloudUpdatedAt = cloud?.updatedAt || 0;

            if (localUpdatedAt > cloudUpdatedAt) {

                uploads.push({
                    collection: name,
                    value: local.exists ? local.value : null,
                    updatedAt: localUpdatedAt,
                    deleted: !local.exists
                });

            } else {
                this.saveLocalRecord(name, cloud);
            }
        }

        // Upload local changes.
        if (uploads.length) {
            await this.uploadRecords(uploads);
        }

        // Read final cloud state.
        const finalResponse = await this.getCloudRecords();

        if (
            !finalResponse ||
            finalResponse.success !== true
        ) {
            throw new Error("Could not verify synchronization.");
        }

        const finalRecords = finalResponse.records;
        const newState = {};

        for (const name of names) {

            const record = finalRecords[name];

            if (!record) continue;

            this.saveLocalRecord(name, record);

            newState[name] = {
                hash: this.getHash(
                    record.value,
                    record.deleted
                ),
                updatedAt: record.updatedAt
            };
        }

        this.writeValue(this.stateKey, newState);

        return {
            uploaded: uploads.length,
            synchronized: Object.keys(newState).length
        };
    }

    // --------------------------------------------------
    // UI
    // --------------------------------------------------

    createField(title, description, input) {

        const row = this.createElement("div", {
            style: `
                padding:14px 0;
                border-bottom:1px solid #383838;
            `
        });

        row.append(
            this.createElement("div", {
                textContent: title,
                style: `
                    font-size:14px;
                    font-weight:bold;
                    margin-bottom:5px;
                `
            }),

            this.createElement("div", {
                textContent: description,
                style: `
                    font-size:12px;
                    color:#aaa;
                    margin-bottom:10px;
                `
            }),

            input
        );

        return row;
    }

    createInput(value, type = "text") {
        return this.createElement("input", {
            type,
            value: value || "",
            style: `
                width:100%;
                max-width:500px;
                box-sizing:border-box;
                padding:9px;
                border:1px solid #555;
                border-radius:4px;
                background:#222;
                color:#fff;
            `
        });
    }

    createButton(title, handler) {

        const button = this.createElement("button", {
            type: "button",
            textContent: title,
            style: `
                padding:9px 16px;
                margin:10px 8px 0 0;
                border:1px solid #555;
                border-radius:5px;
                background:#303030;
                color:#fff;
                cursor:pointer;
            `
        });

        button.addEventListener("click", handler);

        return button;
    }

    render() {

        const container = this.createElement("div", {
            style: "max-width:650px;"
        });

        const enabled = this.createElement("input", {
            type: "checkbox"
        });

        enabled.checked = Boolean(this.config.enabled);

        const endpoint = this.createInput(
            this.config.endpoint
        );

        const apiKey = this.createInput(
            this.config.apiKey,
            "password"
        );

        const status = this.createElement("div", {
            textContent: "Cloud Sync is not running.",
            style: `
                margin-top:18px;
                padding:10px;
                border:1px solid #444;
                border-radius:5px;
                color:#aaa;
                font-size:12px;
                white-space:pre-wrap;
            `
        });

        const saveButton = this.createButton(
            "Save Settings",
            () => {

                this.config = {
                    enabled: enabled.checked,
                    endpoint: endpoint.value.trim(),
                    apiKey: apiKey.value.trim()
                };

                try {
                    this.writeValue(
                        this.configKey,
                        this.config
                    );

                    status.style.color = "#8bcf91";
                    status.textContent = "Settings saved.";

                } catch (error) {
                    status.style.color = "#ff7777";
                    status.textContent = error.message;
                }
            }
        );

        const syncButton = this.createButton(
            "Sync Now",
            async () => {

                this.config = {
                    enabled: enabled.checked,
                    endpoint: endpoint.value.trim(),
                    apiKey: apiKey.value.trim()
                };

                try {
                    this.writeValue(
                        this.configKey,
                        this.config
                    );

                    syncButton.disabled = true;
                    syncButton.textContent = "Synchronizing...";

                    status.style.color = "#ddd";
                    status.textContent = "Connecting to cloud...";

                    const result = await this.synchronize();

                    status.style.color = "#8bcf91";
                    status.textContent =
                        "Synchronization completed.\n" +
                        "Uploaded: " + result.uploaded + "\n" +
                        "Synchronized: " + result.synchronized;

                } catch (error) {

                    status.style.color = "#ff7777";
                    status.textContent =
                        "Synchronization failed:\n" +
                        error.message;

                } finally {
                    syncButton.disabled = false;
                    syncButton.textContent = "Sync Now";
                }
            }
        );

        container.append(

            this.createField(
                "Enable Cloud Sync",
                "When disabled, the application continues working locally.",
                enabled
            ),

            this.createField(
                "API Endpoint",
                "Full HTTPS address of your API endpoint, ending with /api/sync.",
                endpoint
            ),

            this.createField(
                "API Key",
                "Authentication key configured on your API server.",
                apiKey
            ),

            saveButton,
            syncButton,
            status
        );

        return container;
    }
}

Framework.registerSettings("CloudStorageUI", CloudStorageUI);
