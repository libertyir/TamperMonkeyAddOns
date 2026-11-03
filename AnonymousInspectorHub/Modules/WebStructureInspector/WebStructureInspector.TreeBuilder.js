(function (root) {
    "use strict";

    const ns = root.AnonymousInspectorWebStructure =
        root.AnonymousInspectorWebStructure || {};

    class TreeBuilder {
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

                const segments = record.path.split("/").filter(Boolean);
                let current = rootNode;
                let currentPath = "";

                if (!segments.length) continue;

                for (let i = 0; i < segments.length; i++) {
                    const segment = segments[i];
                    currentPath += "/" + segment;

                    const isLast = i === segments.length - 1;
                    const isDirectory =
                        !isLast || record.type === "directory";

                    const nodeType = isDirectory
                        ? "directory"
                        : "file";

                    const key = segment;

                    if (!current.children.has(key)) {
                        const nodeUrl = location.origin +
                            currentPath +
                            (isDirectory ? "/" : "");

                        current.children.set(
                            key,
                            this.createNode(
                                segment,
                                currentPath,
                                nodeType,
                                nodeUrl
                            )
                        );
                    }

                    const child = current.children.get(key);

                    if (isLast) {
                        child.type = record.type || nodeType;
                        child.url = record.url || child.url;
                        child.status = record.status || child.status;
                        child.sources = [
                            ...new Set([
                                ...child.sources,
                                ...(record.sources || [])
                            ])
                        ];
                        child.tags = [
                            ...new Set([
                                ...child.tags,
                                ...(record.tags || [])
                            ])
                        ];
                        child.record = record;
                    }

                    current = child;
                }
            }

            return rootNode;
        }

        sort(node) {
            const children = [...node.children.values()];

            children.sort((a, b) => {
                if (a.type === "directory" && b.type !== "directory") {
                    return -1;
                }

                if (a.type !== "directory" && b.type === "directory") {
                    return 1;
                }

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