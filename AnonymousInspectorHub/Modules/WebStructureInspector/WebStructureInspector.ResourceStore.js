(function (root) {
    "use strict";

    const ns = root.AnonymousInspectorWebStructure =
        root.AnonymousInspectorWebStructure || {};

    class ResourceStore {
        constructor(Framework, origin) {
            this.Framework = Framework;
            this.origin = new URL(origin).origin;
            this.storageKey = "web-structure-tree:" + this.origin;
            this.records = new Map();
            this.version = 1;
            this.maxRecords = 5000;
            this.statusPriority = {
                observed: 1,
                guessed: 2,
                verified: 3,
                confirmed: 4
            };
        }

        normalizeUrl(rawUrl) {
            try {
                const url = new URL(rawUrl, this.origin);

                if (url.origin !== this.origin) return null;
                if (!["http:", "https:"].includes(url.protocol)) return null;
                if (url.username || url.password) return null;

                url.search = "";
                url.hash = "";

                return url.href;
            } catch {
                return null;
            }
        }

        getKey(url) {
            const normalized = this.normalizeUrl(url);
            if (!normalized) return null;

            return new URL(normalized).pathname;
        }

        normalizeArray(value) {
            if (!Array.isArray(value)) return [];

            return [...new Set(
                value.filter(item =>
                    typeof item === "string" && item.length > 0
                )
            )];
        }

        loadRecord(record) {
            if (!record || typeof record.url !== "string") return;

            const url = this.normalizeUrl(record.url);
            if (!url) return;

            const key = this.getKey(url);
            if (!key) return;

            const previous = this.records.get(key) || {};
            const sources = new Set([
                ...this.normalizeArray(previous.sources),
                ...this.normalizeArray(record.sources)
            ]);

            const tags = new Set([
                ...this.normalizeArray(previous.tags),
                ...this.normalizeArray(record.tags)
            ]);

            const now = new Date().toISOString();

            const normalized = {
                ...previous,
                ...record,
                url,
                path: key,
                sources: [...sources],
                tags: [...tags],
                firstSeen: previous.firstSeen || record.firstSeen || now,
                lastSeen: record.lastSeen || previous.lastSeen || now
            };

            this.records.delete(key);
            this.records.set(key, normalized);
        }

        async load() {
            const saved = await this.Framework.Storage.getMetadata(
                this.storageKey
            );

            if (
                !saved ||
                saved.version !== this.version ||
                !Array.isArray(saved.records)
            ) {
                return;
            }

            this.records.clear();

            for (const record of saved.records.slice(-this.maxRecords)) {
                this.loadRecord(record);
            }
        }

        async save() {
            const records = [...this.records.values()];

            await this.Framework.Storage.saveMetadata(
                this.storageKey,
                {
                    version: this.version,
                    origin: this.origin,
                    updatedAt: new Date().toISOString(),
                    records
                }
            );
        }

        async upsertMany(items) {
            if (!Array.isArray(items) || !items.length) return;

            for (const item of items) {
                this.upsert(item, false);
            }

            await this.save();
        }

        upsert(item, persist = true) {
            if (!item || typeof item.url !== "string") return null;

            const url = this.normalizeUrl(item.url);
            if (!url) return null;

            const key = this.getKey(url);
            if (!key) return null;

            const previous = this.records.get(key) || {};
            const sources = new Set([
                ...this.normalizeArray(previous.sources),
                ...this.normalizeArray(item.sources)
            ]);

            const tags = new Set([
                ...this.normalizeArray(previous.tags),
                ...this.normalizeArray(item.tags)
            ]);

            const previousPriority =
                this.statusPriority[previous.status] || 0;

            const incomingPriority =
                this.statusPriority[item.status] || 0;

            const status = incomingPriority >= previousPriority
                ? item.status || previous.status || "observed"
                : previous.status;

            const now = new Date().toISOString();

            const record = {
                ...previous,
                ...item,
                url,
                path: key,
                status,
                sources: [...sources],
                tags: [...tags],
                firstSeen: previous.firstSeen || now,
                lastSeen: now
            };

            this.records.delete(key);
            this.records.set(key, record);

            while (this.records.size > this.maxRecords) {
                const oldestKey = this.records.keys().next().value;
                this.records.delete(oldestKey);
            }

            if (persist) {
                this.save().catch(error =>
                    console.error(
                        "[WebStructureInspector] Storage error:",
                        error
                    )
                );
            }

            return record;
        }

        get(url) {
            const key = this.getKey(url);
            return key ? this.records.get(key) || null : null;
        }

        getAll() {
            return [...this.records.values()];
        }

        getByPath(path) {
            return this.records.get(path) || null;
        }

        getSensitive() {
            return this.getAll().filter(record =>
                (record.tags || []).some(tag =>
                    tag.startsWith("sensitive")
                )
            );
        }
    }

    ns.ResourceStore = ResourceStore;

})(globalThis);