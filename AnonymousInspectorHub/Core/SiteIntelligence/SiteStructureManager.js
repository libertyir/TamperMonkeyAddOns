
(function (root) {
    "use strict";

    class SiteStructureManager {
        constructor(options = {}) {
            if (!options.repository) {
                throw new Error(
                    "SiteStructureManager requires ResourceRepository."
                );
            }

            this.repository = options.repository;

            this.origin = null;
            this.initialized = false;

            this.records = new Map();
            this.rootNode = null;

            this.lastRefreshAt = null;
        }

        // --------------------------------------------------
        // INITIALIZATION
        // --------------------------------------------------

        initialize(options = {}) {
            if (this.initialized) {
                return this;
            }

            const origin =
                options.origin ||
                this.repository.origin;

            if (!origin) {
                throw new Error(
                    "SiteStructureManager requires a valid origin."
                );
            }

            this.origin = new URL(origin).origin;

            if (this.origin !== this.repository.origin) {
                throw new Error(
                    "SiteStructureManager origin does not match ResourceRepository."
                );
            }

            this.initialized = true;

            return this.refresh();
        }

        ensureInitialized() {
            if (!this.initialized) {
                throw new Error(
                    "SiteStructureManager has not been initialized."
                );
            }
        }

        // --------------------------------------------------
        // URL NORMALIZATION
        // --------------------------------------------------

        normalizeUrl(value) {
            this.ensureInitialized();

            const normalized =
                this.repository.normalizeUrl(value);

            this.repository.validateOrigin(normalized);

            const parsed = new URL(normalized);

            if (parsed.username || parsed.password) {
                throw new Error(
                    "URLs containing credentials are not allowed."
                );
            }

            return normalized;
        }

        getPathParts(pathname) {
            return pathname
                .split("/")
                .filter(Boolean);
        }

        getParentPath(pathname) {
            if (!pathname || pathname === "/") {
                return null;
            }

            const normalized = pathname.endsWith("/")
                ? pathname.slice(0, -1)
                : pathname;

            const index = normalized.lastIndexOf("/");

            if (index <= 0) {
                return "/";
            }

            return normalized.slice(0, index + 1);
        }

        // --------------------------------------------------
        // RESOURCE REGISTRATION
        // --------------------------------------------------

        async registerResource(url, options = {}) {
            this.ensureInitialized();

            const normalizedUrl = this.normalizeUrl(url);

            if (
                !options ||
                typeof options !== "object" ||
                Array.isArray(options)
            ) {
                throw new Error(
                    "Invalid resource registration options."
                );
            }

            const source =
                typeof options.source === "string" &&
                options.source.trim()
                    ? options.source.trim()
                    : null;

            const tags = Array.isArray(options.tags)
                ? options.tags.filter(tag =>
                    typeof tag === "string" && tag.trim()
                )
                : [];

            const existing =
                await this.repository.get(normalizedUrl);

            let record;

            if (existing) {
                record = await this.repository.upsert(
                    normalizedUrl,
                    {
                        sources: source ? [source] : [],
                        tags
                    }
                );
            } else {
                record = await this.repository.registerDiscovery(
                    normalizedUrl,
                    {
                        source,
                        tags,
                        metadata: options.metadata || {}
                    }
                );
            }

            this.records.set(normalizedUrl, record);

            this.rebuildTree();

            return record;
        }

        async registerResources(resources, options = {}) {
            this.ensureInitialized();

            if (!Array.isArray(resources)) {
                throw new Error(
                    "Resources must be an array."
                );
            }

            if (
                !options ||
                typeof options !== "object" ||
                Array.isArray(options)
            ) {
                throw new Error(
                    "Invalid resource registration options."
                );
            }

            const unique = new Map();

            for (const item of resources) {
                const value =
                    typeof item === "string"
                        ? item
                        : item?.url;

                if (typeof value !== "string") {
                    continue;
                }

                const normalized =
                    this.normalizeUrl(value);

                const itemOptions =
                    typeof item === "object" && item !== null
                        ? item
                        : {};

                const previous = unique.get(normalized);

                unique.set(normalized, {
                    ...previous,
                    ...itemOptions,
                    url: normalized
                });
            }

            const results = [];

            try {
                for (const item of unique.values()) {
                    const itemOptions = {
                        ...options,
                        ...item
                    };

                    const source =
                        typeof itemOptions.source === "string" &&
                        itemOptions.source.trim()
                            ? itemOptions.source.trim()
                            : null;

                    const tags = Array.isArray(itemOptions.tags)
                        ? itemOptions.tags.filter(tag =>
                            typeof tag === "string" && tag.trim()
                        )
                        : [];

                    const existing =
                        await this.repository.get(item.url);

                    let record;

                    if (existing) {
                        record = await this.repository.upsert(
                            item.url,
                            {
                                sources: source ? [source] : [],
                                tags
                            }
                        );
                    } else {
                        record =
                            await this.repository.registerDiscovery(
                                item.url,
                                {
                                    source,
                                    tags,
                                    metadata:
                                        itemOptions.metadata || {}
                                }
                            );
                    }

                    this.records.set(item.url, record);

                    results.push(record);
                }

                return results;

            } finally {
                if (unique.size > 0) {
                    this.rebuildTree();
                }
            }
        }

        // --------------------------------------------------
        // REPOSITORY SYNCHRONIZATION
        // --------------------------------------------------

        async refresh() {
            if (!this.initialized) {
                throw new Error(
                    "SiteStructureManager has not been initialized."
                );
            }

            const records =
                await this.repository.getAll();

            this.records.clear();

            for (const record of records) {
                if (!record || typeof record.url !== "string") {
                    continue;
                }

                try {
                    const url = this.normalizeUrl(record.url);

                    this.records.set(url, record);
                } catch {
                    continue;
                }
            }

            this.rebuildTree();

            this.lastRefreshAt = new Date().toISOString();

            return this.getStructure();
        }

        // --------------------------------------------------
        // TREE NODE CREATION
        // --------------------------------------------------

        createNode(name, path, type = "directory") {
            return {
                name,
                path,
                type,
                resources: [],
                children: []
            };
        }

        rebuildTree() {
            this.ensureInitialized();

            const rootNode = this.createNode(
                this.origin,
                "/",
                "directory"
            );

            const nodeIndex = new Map([
                ["/", rootNode]
            ]);

            const records = [...this.records.values()]
                .sort((a, b) =>
                    a.url.localeCompare(b.url)
                );

            for (const record of records) {
                const url = new URL(record.url);

                const parts = this.getPathParts(
                    url.pathname
                );

                let currentNode = rootNode;
                let currentPath = "/";

                for (let i = 0; i < parts.length; i++) {
                    const part = parts[i];

                    currentPath += part;

                    const isLast = i === parts.length - 1;

                    const isDirectory =
                        !isLast ||
                        url.pathname.endsWith("/");

                    if (!nodeIndex.has(currentPath)) {
                        const node = this.createNode(
                            part,
                            currentPath,
                            isDirectory
                                ? "directory"
                                : "resource"
                        );

                        nodeIndex.set(currentPath, node);
                        currentNode.children.push(node);
                    }

                    const node = nodeIndex.get(currentPath);

                    if (isDirectory) {
                        node.type = "directory";
                    }

                    currentNode = node;

                    if (!isLast) {
                        currentPath += "/";
                    }
                }

                currentNode.resources.push(
                    this.cloneRecord(record)
                );
            }

            this.sortTree(rootNode);

            this.rootNode = rootNode;

            return rootNode;
        }

        sortTree(node) {
            node.children.sort((a, b) =>
                a.name.localeCompare(b.name)
            );

            node.resources.sort((a, b) =>
                a.url.localeCompare(b.url)
            );

            for (const child of node.children) {
                this.sortTree(child);
            }
        }

        // --------------------------------------------------
        // NODE LOOKUP
        // --------------------------------------------------

        findNode(pathname) {
            this.ensureInitialized();

            if (!this.rootNode) {
                return null;
            }

            let normalizedPath = pathname || "/";

            if (!normalizedPath.startsWith("/")) {
                normalizedPath = "/" + normalizedPath;
            }

            const parts = this.getPathParts(
                normalizedPath
            );

            let current = this.rootNode;

            for (const part of parts) {
                current = current.children.find(
                    child => child.name === part
                );

                if (!current) {
                    return null;
                }
            }

            return current;
        }

        getNode(url) {
            const normalized = this.normalizeUrl(url);
            const parsed = new URL(normalized);

            return this.findNode(parsed.pathname);
        }

        // --------------------------------------------------
        // STRUCTURE ACCESS
        // --------------------------------------------------

        cloneNode(node) {
            return {
                name: node.name,
                path: node.path,
                type: node.type,

                resources: node.resources.map(record =>
                    this.cloneRecord(record)
                ),

                children: node.children.map(child =>
                    this.cloneNode(child)
                )
            };
        }

        cloneRecord(record) {
            return {
                ...record,
                tags: Array.isArray(record.tags)
                    ? [...record.tags]
                    : [],
                sources: Array.isArray(record.sources)
                    ? [...record.sources]
                    : [],
                headers: record.headers &&
                    typeof record.headers === "object"
                        ? { ...record.headers }
                        : {}
            };
        }

        getStructure() {
            this.ensureInitialized();

            return this.rootNode
                ? this.cloneNode(this.rootNode)
                : null;
        }

        getChildren(url = "/") {
            this.ensureInitialized();

            let pathname = "/";

            if (url !== "/") {
                pathname = new URL(
                    this.normalizeUrl(url)
                ).pathname;
            }

            const node = this.findNode(pathname);

            return node
                ? node.children.map(child =>
                    this.cloneNode(child)
                )
                : [];
        }

        getParent(url) {
            const normalized = this.normalizeUrl(url);
            const parsed = new URL(normalized);

            const parentPath = this.getParentPath(
                parsed.pathname
            );

            if (!parentPath) {
                return null;
            }

            const parent = this.findNode(parentPath);

            return parent
                ? this.cloneNode(parent)
                : null;
        }

        getAncestors(url) {
            const normalized = this.normalizeUrl(url);
            const parsed = new URL(normalized);

            const parts = this.getPathParts(
                parsed.pathname
            );

            const ancestors = [];

            let currentPath = "/";

            for (const part of parts) {
                const node = this.findNode(currentPath);

                if (node) {
                    ancestors.push(
                        this.cloneNode(node)
                    );
                }

                currentPath += part + "/";
            }

            return ancestors;
        }

        // --------------------------------------------------
        // RESOURCE ACCESS
        // --------------------------------------------------

        getResource(url) {
            const normalized = this.normalizeUrl(url);

            const record = this.records.get(normalized);

            return record
                ? this.cloneRecord(record)
                : null;
        }

        getAllResources() {
            this.ensureInitialized();

            return [...this.records.values()].map(record =>
                this.cloneRecord(record)
            );
        }

        findResources(predicate) {
            this.ensureInitialized();

            if (typeof predicate !== "function") {
                throw new Error(
                    "Resource predicate must be a function."
                );
            }

            return [...this.records.values()]
                .filter(predicate)
                .map(record => this.cloneRecord(record));
        }

        getResourcesByStatus(status) {
            return this.findResources(record =>
                record.status === status
            );
        }

        getResourcesBySource(source) {
            return this.findResources(record =>
                Array.isArray(record.sources) &&
                record.sources.includes(source)
            );
        }

        // --------------------------------------------------
        // TREE STATISTICS
        // --------------------------------------------------

        calculateStatistics(node = this.rootNode) {
            if (!node) {
                return {
                    directories: 0,
                    resources: 0,
                    totalNodes: 0
                };
            }

            let directories =
                node.type === "directory" ? 1 : 0;

            let resources = node.resources.length;

            for (const child of node.children) {
                const stats = this.calculateStatistics(child);

                directories += stats.directories;
                resources += stats.resources;
            }

            return {
                directories,
                resources,
                totalNodes: directories + resources
            };
        }

        getStatistics() {
            this.ensureInitialized();

            return {
                ...this.calculateStatistics(),
                lastRefreshAt: this.lastRefreshAt
            };
        }

        // --------------------------------------------------
        // STATUS
        // --------------------------------------------------

        getStatus() {
            this.ensureInitialized();

            return {
                initialized: this.initialized,
                origin: this.origin,
                resources: this.records.size,
                statistics: this.getStatistics(),
                lastRefreshAt: this.lastRefreshAt
            };
        }

        // --------------------------------------------------
        // SHUTDOWN
        // --------------------------------------------------

        destroy() {
            this.records.clear();

            this.rootNode = null;
            this.origin = null;

            this.lastRefreshAt = null;
            this.initialized = false;
        }
    }

    root.AnonymousInspectorSiteStructureManager =
        SiteStructureManager;

})(globalThis);
