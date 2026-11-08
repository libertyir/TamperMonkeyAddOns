(function (root) {
    "use strict";

    const ns = root.AnonymousInspectorWebStructure =
        root.AnonymousInspectorWebStructure || {};

    class UIManager {
        constructor(module) {
            this.module = module;
            this.filter = "all";
            this.search = "";
            this.expanded = new Set(["/"]);
            this.currentDirectory = module.currentDirectory;
            this.lastRoot = null;
            this.busy = false;
            this.activeViewer = null;
        }

        el(tag, attributes = {}, text = null) {
            const element = Framework.createElement(tag, attributes);

            if (text !== null) {
                element.textContent = String(text);
            }

            return element;
        }

        button(label, callback, className = "") {
            const attributes = {
                type: "button",
                className: "wsi-button " + className
            };

            if (this.busy || this.module.operation) {
                attributes.disabled = true;
            }

            const button = this.el("button", attributes, label);
            button.addEventListener("click", callback);
            return button;
        }

        async execute(callback) {
            if (this.busy) return;

            this.busy = true;
            this.refresh();

            try {
                await callback();
            } catch (error) {
                this.module.lastError =
                    error && error.message
                        ? error.message
                        : "Operation failed.";
            } finally {
                this.busy = false;
                this.refresh();
            }
        }

        hasSensitive(node) {
            return (node.tags || []).some(tag =>
                tag.startsWith("sensitive")
            );
        }

        containsSensitive(node) {
            if (this.hasSensitive(node)) return true;

            for (const child of node.children.values()) {
                if (this.containsSensitive(child)) return true;
            }

            return false;
        }

        containsSearch(node) {
            if (node.name.toLowerCase().includes(
                this.search.toLowerCase()
            )) {
                return true;
            }

            for (const child of node.children.values()) {
                if (this.containsSearch(child)) return true;
            }

            return false;
        }

        getIcon(node) {
            if (this.containsSensitive(node)) return "⚠";
            if (node.type === "directory") return "📁";
            if (node.type === "javascript") return "📜";
            if (node.type === "stylesheet") return "🎨";
            if (node.type === "image") return "🖼";
            if (node.type === "font") return "🔤";
            if (node.type === "executable") return "⚙";

            return "📄";
        }

        getStatusLabel(node) {
            if ((node.tags || []).includes("sensitive-confirmed")) {
                return "Sensitive Confirmed";
            }

            if (this.hasSensitive(node)) {
                return "Sensitive Type";
            }

            if ((node.tags || []).includes("directory-listing")) {
                return "Directory Listing";
            }

            if (node.status === "confirmed") return "Confirmed";
            if (node.status === "verified") return "Verified";
            if (node.status === "guessed") return "Guessed";
            if (node.status === "inferred") return "Inferred";

            return "Observed";
        }

        getStatusClass(node) {
            if ((node.tags || []).includes("sensitive-confirmed")) {
                return "wsi-danger";
            }

            if (this.hasSensitive(node)) return "wsi-warning";
            if (node.status === "confirmed") return "wsi-success";
            if (node.status === "verified") return "wsi-success";
            if (node.status === "guessed") return "wsi-info";
            if (node.status === "inferred") return "wsi-info";

            return "wsi-muted";
        }

        createStyles() {
            const style = this.el("style");

            style.textContent = `
                .wsi-root {
                    color:inherit;
                    font-size:13px;
                    line-height:1.5;
                }

                .wsi-toolbar {
                    display:flex;
                    flex-wrap:wrap;
                    align-items:center;
                    gap:7px;
                    margin:10px 0;
                }

                .wsi-button {
                    border:1px solid rgba(128,128,128,.45);
                    border-radius:5px;
                    padding:7px 10px;
                    color:inherit;
                    background:transparent;
                    cursor:pointer;
                }

                .wsi-button:hover {
                    background:rgba(128,128,128,.15);
                }

                .wsi-button:disabled {
                    opacity:.5;
                    cursor:wait;
                }

                .wsi-small {
                    padding:3px 6px;
                    font-size:11px;
                }

                .wsi-path {
                    overflow-wrap:anywhere;
                    opacity:.75;
                    margin:8px 0;
                    font-family:monospace;
                }

                .wsi-alert,.wsi-review {
                    padding:10px;
                    margin:10px 0;
                    border-radius:5px;
                    font-weight:600;
                }

                .wsi-alert {
                    border:1px solid #c44;
                    background:rgba(190,35,35,.12);
                    color:#e77;
                }

                .wsi-review {
                    border:1px solid #c99a37;
                    background:rgba(190,145,35,.10);
                    color:#d9b45d;
                }

                .wsi-node-row {
                    display:flex;
                    align-items:center;
                    flex-wrap:wrap;
                    gap:5px;
                    min-height:30px;
                    border-bottom:1px solid rgba(128,128,128,.12);
                }

                .wsi-toggle {
                    width:20px;
                    border:0;
                    background:transparent;
                    color:inherit;
                    cursor:pointer;
                }

                .wsi-name {
                    border:0;
                    background:transparent;
                    color:inherit;
                    cursor:pointer;
                    text-align:left;
                    overflow-wrap:anywhere;
                }

                .wsi-tag {
                    display:inline-block;
                    padding:1px 5px;
                    border-radius:4px;
                    font-size:10px;
                    border:1px solid currentColor;
                }

                .wsi-danger { color:#ff6666; }
                .wsi-warning { color:#d7a63d; }
                .wsi-success { color:#69b77a; }
                .wsi-info { color:#69a8df; }
                .wsi-muted { color:#999; }

                .wsi-search {
                    min-width:150px;
                    flex:1;
                    padding:7px;
                    border:1px solid rgba(128,128,128,.4);
                    border-radius:5px;
                    background:transparent;
                    color:inherit;
                }

                .wsi-tree {
                    margin-top:10px;
                    overflow:auto;
                    max-height:65vh;
                }

                .wsi-error {
                    color:#ff7777;
                    margin:8px 0;
                }

                .wsi-operation {
                    opacity:.75;
                    margin:8px 0;
                }
            `;

            return style;
        }

        getDisplayName(value) {
            let fullName = String(value || "");
            try { fullName = decodeURIComponent(fullName); } catch { }
            const characters = Array.from(fullName);
            return { fullName, displayName: characters.length > 25 ? characters.slice(0, 24).join("") + "…" : fullName };
        }

        renderNode(node, depth = 0) {
            const wrapper = this.el("div", {
                className: "wsi-node"
            });

            const row = this.el("div", {
                className: "wsi-node-row",
                style: "padding-left:" + (depth * 18) + "px"
            });

            const isDirectory = node.type === "directory";
            const hasChildren = node.children.size > 0;
            const expanded = this.expanded.has(node.path);

            const toggle = this.el("button", {
                type: "button",
                className: "wsi-toggle"
            }, isDirectory && hasChildren
                ? (expanded ? "▾" : "▸")
                : " ");

            if (isDirectory && hasChildren) {
                toggle.addEventListener("click", () => {
                    if (expanded) {
                        this.expanded.delete(node.path);
                    } else {
                        this.expanded.add(node.path);
                    }

                    this.refresh();
                });
            } else {
                toggle.disabled = true;
            }

            const display = this.getDisplayName(node.name);
            const name = this.el("button", {
                type: "button",
                className: "wsi-name",
                title: display.fullName
            }, this.getIcon(node) + " " + display.displayName);

            name.addEventListener("click", () => {
                if (isDirectory) {
                    this.currentDirectory = node.url;
                    this.module.currentDirectory = node.url;
                    this.expanded.add(node.path);
                    this.refresh();
                } else {
                    window.open(node.url, "_blank", "noopener");
                }
            });

            const status = this.el("span", {
                className: "wsi-tag " + this.getStatusClass(node)
            }, this.getStatusLabel(node));

            row.append(toggle, name, status);

            if (isDirectory) {
                row.append(
                    this.button(
                        "Scan",
                        () => this.execute(() =>
                            this.module.scanDirectory(node.url)
                        ),
                        "wsi-small"
                    ),
                    this.button(
                        "Sensitive",
                        () => this.execute(() =>
                            this.module.scanSensitive(node.url)
                        ),
                        "wsi-small"
                    )
                );
            } else {
                const matchingViewers = Framework.Viewers.find({
                    url: node.url,
                    path: node.path,
                    name: node.name,
                    type: node.type,
                    extension: node.record?.extension || "",
                    tags: node.tags || [],
                    contentType: node.record?.contentType || null
                });

                for (const viewer of matchingViewers) {
                    row.appendChild(
                        this.button(
                            "View",
                            () => this.execute(async () => {
                                const result = await Framework.Viewers.open(
                                    viewer.id,
                                    {
                                        url: node.url,
                                        fileUrl: node.url,
                                        directoryUrl: new URL(".", node.url).href
                                    }
                                );

                                this.activeViewer = result;
                            }),
                            "wsi-small"
                        )
                    );
                }
            }

            wrapper.appendChild(row);

            if (isDirectory && hasChildren && expanded) {
                for (const child of node.children.values()) {
                    if (
                        this.filter === "sensitive" &&
                        !this.containsSensitive(child)
                    ) {
                        continue;
                    }

                    if (
                        this.search &&
                        !this.containsSearch(child)
                    ) {
                        continue;
                    }

                    wrapper.appendChild(
                        this.renderNode(child, depth + 1)
                    );
                }
            }

            return wrapper;
        }

        async runSensitiveSearch() {
            const scope = this.module.settings.sensitiveScope;
            const targets = [];

            if (scope === "root" || scope === "both") {
                targets.push(location.origin + "/");
            }

            if (scope === "current" || scope === "both") {
                targets.push(this.currentDirectory);
            }

            for (const target of [...new Set(targets)]) {
                await this.module.scanSensitive(target);
            }
        }

        render() {
            const rootElement = this.el("div", {
                className: "wsi-root"
            });

            rootElement.appendChild(this.createStyles());

            const records = this.module.getRecords();

            const sensitiveCount = records.filter(record =>
                (record.tags || []).some(tag =>
                    tag.startsWith("sensitive")
                )
            ).length;

            const confirmedCount = records.filter(record =>
                (record.tags || []).includes("sensitive-confirmed")
            ).length;

            if (confirmedCount > 0) {
                rootElement.appendChild(
                    this.el("div", {
                        className: "wsi-alert"
                    },
                    "Security Alert: " + confirmedCount +
                    " confirmed sensitive resource(s) detected.")
                );
            } else if (sensitiveCount > 0) {
                rootElement.appendChild(
                    this.el("div", {
                        className: "wsi-review"
                    },
                    "Review Required: " + sensitiveCount +
                    " potentially sensitive resource(s) detected.")
                );
            }

            rootElement.appendChild(
                this.el("div", {
                    className: "wsi-path"
                },
                "Origin: " + location.origin +
                " | Resources: " + records.length +
                " | Sensitive: " + sensitiveCount)
            );

            const toolbar = this.el("div", {
                className: "wsi-toolbar"
            });

            toolbar.append(
                this.button(
                    "Scan Current",
                    () => this.execute(() =>
                        this.module.scanDirectory(this.currentDirectory)
                    )
                ),
                this.button(
                    "Scan Root",
                    () => this.execute(() =>
                        this.module.scanDirectory(location.origin + "/")
                    )
                ),
                this.button(
                    "Sensitive Search",
                    () => this.execute(() =>
                        this.runSensitiveSearch()
                    )
                ),
                this.button(
                    "Grabber",
                    () => this.execute(() =>
                        this.module.runGrabber(location.href)
                    )
                )
            );

            const search = this.el("input", {
                type: "search",
                className: "wsi-search",
                placeholder: "Search files and directories..."
            });

            search.value = this.search;

            search.addEventListener("input", () => {
                this.search = search.value;
                this.refresh();
            });

            const filter = this.el("select", {
                className: "wsi-button"
            });

            for (const [value, label] of [
                ["all", "All Resources"],
                ["sensitive", "Sensitive Only"]
            ]) {
                const option = this.el("option", { value }, label);
                option.selected = this.filter === value;
                filter.appendChild(option);
            }

            filter.addEventListener("change", () => {
                this.filter = filter.value;
                this.refresh();
            });

            toolbar.append(search, filter);
            rootElement.appendChild(toolbar);

            if (this.module.operation) {
                rootElement.appendChild(
                    this.el("div", {
                        className: "wsi-operation"
                    }, "Running: " + this.module.operation + "...")
                );
            }

            if (this.module.lastError) {
                rootElement.appendChild(
                    this.el("div", {
                        className: "wsi-error"
                    }, this.module.lastError)
                );
            }

            const tree = this.module.treeBuilder.build(records);

            this.expanded.add("/");

            const treeContainer = this.el("div", {
                className: "wsi-tree"
            });

            for (const child of tree.children.values()) {
                if (
                    this.filter === "sensitive" &&
                    !this.containsSensitive(child)
                ) {
                    continue;
                }

                if (
                    this.search &&
                    !this.containsSearch(child)
                ) {
                    continue;
                }

                treeContainer.appendChild(
                    this.renderNode(child, 0)
                );
            }

            rootElement.appendChild(treeContainer);

            if (this.activeViewer) {
                const viewerPanel = this.el("section", {
                    className: "wsi-viewer-panel"
                });

                const viewerHeader = this.el("div", {
                    className: "wsi-toolbar"
                });

                viewerHeader.append(
                    this.el("strong", {}, this.activeViewer.metadata.title),
                    this.button("Close Viewer", () => this.execute(async () => {
                        await Framework.Viewers.close();
                        this.activeViewer = null;
                    }), "wsi-small")
                );

                viewerPanel.appendChild(viewerHeader);

                if (this.activeViewer.content) {
                    viewerPanel.appendChild(this.activeViewer.content);
                }

                rootElement.appendChild(viewerPanel);
            }

            this.lastRoot = rootElement;

            return rootElement;
        }

        refresh() {
            if (!this.lastRoot || !this.lastRoot.isConnected) return;

            const previous = this.lastRoot;
            const fresh = this.render();

            previous.replaceWith(fresh);
            this.lastRoot = fresh;
        }
    }

    ns.UIManager = UIManager;

})(globalThis);