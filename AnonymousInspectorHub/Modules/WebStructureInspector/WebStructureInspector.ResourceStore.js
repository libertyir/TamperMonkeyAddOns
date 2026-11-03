(function (root) {
    "use strict";

    const ns = root.AnonymousInspectorWebStructure =
        root.AnonymousInspectorWebStructure || {};

    class ResourceStore {
        constructor(Framework, origin) {
            this.Framework = Framework;
            this.origin = origin;
            this.storageKey = "web-structure-tree:" + origin;
            this.records = new Map();
            this.version = 1;
            this.maxRecords = 5000;
        }

        normalizeUrl(rawUrl) {
            try {
                const url = new URL(rawUrl, this.origin);

                if (url.origin !== this.origin) return null;
                if (!["http:", "https:"].includes(url.protocol)) return null;

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

            for (const record of saved.records) {
                if (!record || typeof record.url !== "string") continue;

                const url = this.normalizeUrl(record.url);
                if (!url) continue;

                const key = this.getKey(url);

                this.records.set(key, {
                    ...record,
                    url,
                    path: new URL(url).pathname,
                    sources: Array.isArray(record.sources)
                        ? [...new Set(record.sources)]
                        : [],
                    tags: Array.isArray(record.tags)
                        ? [...new Set(record.tags)]
                        : []
                });
            }
        }

        async save() {
            const records = [...this.records.values()]
                .slice(-this.maxRecords);

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
            const previous = this.records.get(key) || {};

            const sources = new Set([
                ...(previous.sources || []),
                ...(item.sources || [])
            ]);

            const tags = new Set([
                ...(previous.tags || []),
                ...(item.tags || [])
            ]);

            const now = new Date().toISOString();

            const record = {
                ...previous,
                ...item,
                url,
                path: new URL(url).pathname,
                sources: [...sources],
                tags: [...tags],
                firstSeen: previous.firstSeen || now,
                lastSeen: now
            };

            this.records.set(key, record);

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