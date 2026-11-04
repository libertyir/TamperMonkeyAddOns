
(function (root) {
    "use strict";

    class ResourceRepository {
        constructor(options = {}) {
            if (!options.storage) {
                throw new Error(
                    "ResourceRepository requires StorageManager."
                );
            }

            this.storage = options.storage;

            this.origin = null;
            this.storageKey = null;

            this.records = new Map();

            this.initialized = false;
            this.initializePromise = null;
            this.writeQueue = Promise.resolve();
            this.pendingWrites = 0;
        }

        // --------------------------------------------------
        // INITIALIZATION
        // --------------------------------------------------

        async initialize(options = {}) {
            if (this.initialized) {
                return this;
            }

            if (this.initializePromise) {
                return this.initializePromise;
            }

            this.initializePromise =
                this.initializeRepository(options);

            try {
                return await this.initializePromise;
            } finally {
                this.initializePromise = null;
            }
        }

        async initializeRepository(options) {
            const origin =
                options.origin ||
                (
                    typeof location !== "undefined"
                        ? location.origin
                        : null
                );

            if (!origin) {
                throw new Error(
                    "ResourceRepository requires a valid origin."
                );
            }

            let normalizedOrigin;

            try {
                normalizedOrigin = new URL(origin).origin;
            } catch {
                throw new Error("Invalid repository origin.");
            }

            this.origin = normalizedOrigin;

            this.storageKey =
                "site-intelligence:resources:" +
                encodeURIComponent(this.origin);

            const saved = await this.storage.getMetadata(
                this.storageKey
            );

            if (
                saved &&
                typeof saved === "object" &&
                !Array.isArray(saved)
            ) {
                for (const [key, record] of Object.entries(saved)) {
                    if (
                        record &&
                        typeof record === "object" &&
                        record.url &&
                        this.normalizeUrl(record.url) === key
                    ) {
                        this.records.set(
                            key,
                            this.cloneRecord(record)
                        );
                    }
                }
            }

            this.initialized = true;

            return this;
        }

        ensureInitialized() {
            if (!this.initialized) {
                throw new Error(
                    "ResourceRepository has not been initialized."
                );
            }
        }

        // --------------------------------------------------
        // URL NORMALIZATION
        // --------------------------------------------------

        normalizeUrl(value) {
            if (
                typeof value !== "string" ||
                !value.trim()
            ) {
                throw new Error("Invalid resource URL.");
            }

            let url;

            try {
                url = new URL(value, this.origin + "/");
            } catch {
                throw new Error("Invalid resource URL.");
            }

            if (!["http:", "https:"].includes(url.protocol)) {
                throw new Error("Only HTTP and HTTPS resources are allowed.");
            }

            if (url.username || url.password) {
                throw new Error("Resource URLs containing credentials are not allowed.");
            }

            url.hash = "";

            return url.href;
        }

        validateOrigin(url) {
            const parsed = new URL(url);

            if (parsed.origin !== this.origin) {
                throw new Error(
                    "Resource URL is outside the repository origin."
                );
            }

            return true;
        }

        // --------------------------------------------------
        // RECORD HELPERS
        // --------------------------------------------------

        cloneRecord(record) {
            const cloneValue = value => {
                if (
                    value === null ||
                    typeof value !== "object"
                ) {
                    return value;
                }

                if (typeof structuredClone === "function") {
                    try {
                        return structuredClone(value);
                    } catch {
                        // Fall through to JSON cloning.
                    }
                }

                try {
                    return JSON.parse(JSON.stringify(value));
                } catch {
                    return Array.isArray(value)
                        ? [...value]
                        : { ...value };
                }
            };

            return {
                ...record,

                tags: Array.isArray(record.tags)
                    ? [...record.tags]
                    : [],

                sources: Array.isArray(record.sources)
                    ? [...record.sources]
                    : [],

                headers: cloneValue(record.headers || {}),
                metadata: cloneValue(record.metadata || {}),
                analysis: cloneValue(record.analysis ?? null)
            };
        }

        createRecord(url, data = {}) {
            const now = new Date().toISOString();

            return {
                ...data,

                url,
                origin: this.origin,

                discoveredAt:
                    data.discoveredAt || now,

                validatedAt:
                    data.validatedAt || null,

                analyzedAt:
                    data.analyzedAt || null,

                lastSeenAt: now,

                status:
                    data.status || "discovered",

                httpStatus:
                    data.httpStatus ?? null,

                contentType:
                    data.contentType ?? null,

                contentLength:
                    data.contentLength ?? null,

                headers:
                    data.headers || {},

                tags:
                    Array.isArray(data.tags)
                        ? [...new Set(data.tags)]
                        : [],

                sources:
                    Array.isArray(data.sources)
                        ? [...new Set(data.sources)]
                        : [],

                analysis:
                    data.analysis ?? null,

                metadata:
                    data.metadata || {}
            };
        }

        // --------------------------------------------------
        // PERSISTENCE
        // --------------------------------------------------

        persist() {
            this.ensureInitialized();

            const operation = async () => {
                const snapshot = {};

                for (const [key, record] of this.records) {
                    snapshot[key] = this.cloneRecord(record);
                }

                await this.storage.saveMetadata(
                    this.storageKey,
                    snapshot
                );
            };

            this.pendingWrites++;

            const queuedOperation =
                this.writeQueue.then(
                    operation,
                    operation
                );

            this.writeQueue = queuedOperation.finally(() => {
                this.pendingWrites = Math.max(
                    0,
                    this.pendingWrites - 1
                );
            });

            return this.writeQueue;
        }

        // --------------------------------------------------
        // RESOURCE ACCESS
        // --------------------------------------------------

        async get(url) {
            this.ensureInitialized();

            const normalizedUrl = this.normalizeUrl(url);

            this.validateOrigin(normalizedUrl);

            const record = this.records.get(normalizedUrl);

            return record
                ? this.cloneRecord(record)
                : null;
        }

        async getAll() {
            this.ensureInitialized();

            return [...this.records.values()].map(
                record => this.cloneRecord(record)
            );
        }

        async has(url) {
            return Boolean(await this.get(url));
        }

        // --------------------------------------------------
        // RESOURCE INSERT / UPDATE
        // --------------------------------------------------

        async upsert(url, updates = {}) {
            this.ensureInitialized();

            if (
                !updates ||
                typeof updates !== "object" ||
                Array.isArray(updates)
            ) {
                throw new Error("Invalid resource updates.");
            }

            const normalizedUrl = this.normalizeUrl(url);

            this.validateOrigin(normalizedUrl);

            const existing =
                this.records.get(normalizedUrl);

            const now = new Date().toISOString();

            const record = existing
                ? {
                    ...existing,
                    ...updates,

                    url: normalizedUrl,
                    origin: this.origin,
                    lastSeenAt: now,

                    metadata: {
                        ...(existing.metadata || {}),
                        ...(updates.metadata || {})
                    },

                    analysis:
                        Object.prototype.hasOwnProperty.call(
                            updates,
                            "analysis"
                        )
                            ? updates.analysis
                            : existing.analysis
                }
                : this.createRecord(
                    normalizedUrl,
                    updates
                );

            record.tags = [
                ...new Set([
                    ...(existing?.tags || []),
                    ...(updates.tags || [])
                ])
            ];

            record.sources = [
                ...new Set([
                    ...(existing?.sources || []),
                    ...(updates.sources || [])
                ])
            ];

            record.headers = {
                ...(existing?.headers || {}),
                ...(updates.headers || {})
            };

            this.records.set(normalizedUrl, record);

            await this.persist();

            return this.cloneRecord(record);
        }

        async remove(url) {
            this.ensureInitialized();

            const normalizedUrl = this.normalizeUrl(url);

            this.validateOrigin(normalizedUrl);

            const removed = this.records.delete(normalizedUrl);

            if (removed) {
                await this.persist();
            }

            return removed;
        }

        async clear() {
            this.ensureInitialized();

            this.records.clear();

            await this.storage.deleteMetadata(
                this.storageKey
            );

            return true;
        }

        // --------------------------------------------------
        // DISCOVERY
        // --------------------------------------------------

        async registerDiscovery(url, options = {}) {
            return this.upsert(url, {
                status: "discovered",

                sources: options.source
                    ? [options.source]
                    : [],

                tags: options.tags || [],
                metadata: options.metadata || {}
            });
        }

        // --------------------------------------------------
        // VALIDATION
        // --------------------------------------------------

        async registerValidation(url, result = {}) {
            const now = new Date().toISOString();

            return this.upsert(url, {
                status: result.status || "validated",
                validatedAt: now,

                httpStatus:
                    result.httpStatus ?? null,

                contentType:
                    result.contentType ?? null,

                contentLength:
                    result.contentLength ?? null,

                headers:
                    result.headers || {},

                tags: result.tags || [],

                metadata: result.metadata || {},

                sources: result.source
                    ? [result.source]
                    : []
            });
        }

        // --------------------------------------------------
        // ANALYSIS
        // --------------------------------------------------

        async registerAnalysis(url, result = {}) {
            return this.upsert(url, {
                status: "analyzed",
                analyzedAt: new Date().toISOString(),

                analysis: result.analysis ?? null,

                tags: result.tags || [],

                metadata: result.metadata || {}
            });
        }

        // --------------------------------------------------
        // EXPIRATION
        // --------------------------------------------------

        parseTTL(ttl) {
            const values = {
                "1h": 60 * 60 * 1000,
                "6h": 6 * 60 * 60 * 1000,
                "12h": 12 * 60 * 60 * 1000,
                "1d": 24 * 60 * 60 * 1000,
                "3d": 3 * 24 * 60 * 60 * 1000,
                "7d": 7 * 24 * 60 * 60 * 1000,
                "30d": 30 * 24 * 60 * 60 * 1000,
                "90d": 90 * 24 * 60 * 60 * 1000
            };

            if (
                ttl === "always" ||
                ttl === "permanent"
            ) {
                return ttl;
            }

            if (
                Object.prototype.hasOwnProperty.call(
                    values,
                    ttl
                )
            ) {
                return values[ttl];
            }

            throw new Error("Invalid resource TTL: " + ttl);
        }

        isFresh(record, stage = "validation", ttl = "7d") {
            if (!record || typeof record !== "object") {
                return false;
            }

            const timestampField = {
                discovery: "discoveredAt",
                validation: "validatedAt",
                analysis: "analyzedAt"
            }[stage];

            if (!timestampField) {
                throw new Error(
                    "Unknown resource stage: " + stage
                );
            }

            const timestamp = record[timestampField];

            if (!timestamp) {
                return false;
            }

            const parsedTime = Date.parse(timestamp);

            if (!Number.isFinite(parsedTime)) {
                return false;
            }

            const duration = this.parseTTL(ttl);

            if (duration === "always") {
                return false;
            }

            if (duration === "permanent") {
                return true;
            }

            return Date.now() - parsedTime < duration;
        }

        async isResourceFresh(
            url,
            stage = "validation",
            ttl = "7d"
        ) {
            const record = await this.get(url);

            return this.isFresh(
                record,
                stage,
                ttl
            );
        }

        // --------------------------------------------------
        // STATUS
        // --------------------------------------------------

        getStatus() {
            this.ensureInitialized();

            return {
                initialized: this.initialized,
                origin: this.origin,
                totalResources: this.records.size,
                pendingWrites: this.pendingWrites
            };
        }

        // --------------------------------------------------
        // SHUTDOWN
        // --------------------------------------------------

        async destroy() {
            if (!this.initialized) {
                return;
            }

            await this.writeQueue;

            this.records.clear();

            this.origin = null;
            this.storageKey = null;
            this.initialized = false;
        }
    }

    root.AnonymousInspectorResourceRepository =
        ResourceRepository;

})(globalThis);
