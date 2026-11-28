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

        isAddressType(type) {
            return type === "endpoint" ||
                type === "page" ||
                type === "web-address" ||
                type === "route";
        }

        isFileType(type) {
            return Boolean(type) &&
                type !== "directory" &&
                !this.isAddressType(type);
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
            node.record = { ...record };
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

                const terminalType = record.type || "endpoint";
                const terminalIsDirectory = terminalType === "directory";
                const terminalIsAddress = this.isAddressType(terminalType);
                const terminalIsFile = !terminalIsDirectory && !terminalIsAddress;

                let current = rootNode;
                let currentPath = "";

                for (let i = 0; i < segments.length; i++) {
                    const segment = segments[i];
                    currentPath += "/" + segment;

                    const isLast = i === segments.length - 1;
                    const nodeType = isLast
                        ? terminalType
                        : (terminalIsFile || terminalIsDirectory
                            ? "directory"
                            : "endpoint");

                    let child = current.children.get(segment);

                    if (!child) {
                        const isDirectory = nodeType === "directory";
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
                    } else if (
                        nodeType === "directory" ||
                        (child.type === "endpoint" && terminalIsFile)
                    ) {
                        // A path becomes a real directory only when a
                        // discovered file or directory proves that role.
                        child.type = "directory";
                        if (!child.url.endsWith("/")) child.url += "/";
                    } else if (
                        isLast &&
                        child.type === "endpoint" &&
                        !terminalIsAddress
                    ) {
                        child.type = terminalType;
                    }

                    if (isLast) {
                        child.type = terminalType;
                        this.mergeNode(child, record);
                    }

                    current = child;
                }
            }

            return this.sort(rootNode);
        }

        sort(node) {
            const children = [...node.children.values()];

            const priority = child => {
                if (child.type === "directory") return 0;
                if (this.isFileType(child.type)) return 1;
                return 2;
            };

            children.sort((a, b) => {
                const difference = priority(a) - priority(b);
                if (difference) return difference;
                return a.name.localeCompare(b.name);
            });

            for (const child of children) this.sort(child);

            node.children = new Map(
                children.map(child => [child.name, child])
            );

            return node;
        }
    }

    ns.TreeBuilder = TreeBuilder;

})(globalThis);
