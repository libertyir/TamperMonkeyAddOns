(function (root) {
    "use strict";

    const ns = root.AnonymousInspectorWebStructure =
        root.AnonymousInspectorWebStructure || {};

    class TreeBuilder {
        constructor() {
            this.statusPriority = {
                inferred: 0,
                observed: 1,
                guessed: 2,
                verified: 3,
                confirmed: 4,
                root: 5
            };
        }

        createNode(name, path, type, url) {
            return {
                name,
                path,
                type,
                url,
                status: type === "directory" ? "inferred" : "observed",
                sources: [],
                tags: [],
                children: new Map()
            };
        }

        mergeNode(node, record) {
            const status = record.status || "observed";

            if (
                (this.statusPriority[status] || 0) >=
                (this.statusPriority[node.status] || 0)
            ) {
                node.status = status;
            }

            node.sources = [
                ...new Set([
                    ...node.sources,
                    ...(Array.isArray(record.sources) ? record.sources : [])
                ])
            ];

            node.tags = [
                ...new Set([
                    ...node.tags,
                    ...(Array.isArray(record.tags) ? record.tags : [])
                ])
            ];

            if (record.url) node.url = record.url;
            if (record.record) node.record = record;
        }

        build(records) {
            const rootNode = this.createNode(
                location.host,
                "/",
                "directory",
                location.origin + "/"
            );

            rootNode.status = "root";

            for (const record of records) {
                if (!record || typeof record.path !== "string") continue;
                if (!record.path.startsWith("/")) continue;

                const segments = record.path.split("/").filter(Boolean);

                if (!segments.length) continue;

                if (segments.some(segment =>
                    segment === "." ||
                    segment === ".." ||
                    segment.includes("\\")
                )) {
                    continue;
                }

                let current = rootNode;
                let currentPath = "";

                for (let i = 0; i < segments.length; i++) {
                    const segment = segments[i];
                    currentPath += "/" + segment;

                    const isLast = i === segments.length - 1;
                    const isDirectory =
                        !isLast || record.type === "directory";

                    const nodeType = isDirectory
                        ? "directory"
                        : "file";

                    let child = current.children.get(segment);

                    if (!child) {
                        const nodeUrl = location.origin +
                            currentPath +
                            (isDirectory ? "/" : "");

                        child = this.createNode(
                            segment,
                            currentPath,
                            nodeType,
                            nodeUrl
                        );

                        current.children.set(segment, child);
                    } else if (isDirectory) {
                        child.type = "directory";
                        if (!child.url.endsWith("/")) {
                            child.url += "/";
                        }
                    }

                    if (isLast) {
                        if (record.type) {
                            child.type = record.type;
                        }

                        this.mergeNode(child, record);
                        child.record = { ...record };
                    }

                    current = child;
                }
            }

            return this.sort(rootNode);
        }

        sort(node) {
            const children = [...node.children.values()];

            children.sort((a, b) => {
                const aDirectory = a.type === "directory";
                const bDirectory = b.type === "directory";

                if (aDirectory && !bDirectory) return -1;
                if (!aDirectory && bDirectory) return 1;

                return a.name.localeCompare(b.name);
            });

            for (const child of children) {
                this.sort(child);
            }

            node.children = new Map(
                children.map(child => [child.name, child])
            );

            return node;
        }
    }

    ns.TreeBuilder = TreeBuilder;

})(globalThis);