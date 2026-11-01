
(function (Framework) {
    "use strict";

    class DSStoreViewer extends Framework.BaseModule {

        static id = "DS_Store_Viewer";
        static title = "DS_Store Viewer";
        static description = "Inspect exposed macOS directory metadata";
        static icon = "📁";

        constructor() {
            super();

            this.buffer = null;
            this.records = [];
            this.fileUrl = null;
        }

        getMetadata() {
            return {
                id: DSStoreViewer.id,
                title: DSStoreViewer.title,
                description: DSStoreViewer.description,
                icon: DSStoreViewer.icon
            };
        }

        async init() {
            this.available = false;

            this.fileUrl = new URL(
                ".DS_Store",
                Framework.getCurrentDirectory()
            ).href;

            try {
                this.buffer = await Framework.requestArrayBuffer(
                    this.fileUrl
                );

                if (!this.buffer || this.buffer.byteLength < 36) {
                    return;
                }

                await this.loadParser();

                this.records = this.parseFile(this.buffer);

                this.available = true;

            } catch (error) {
                this.error = error;
                console.warn("[DS_Store Viewer]", error);
            }
        }

        async loadParser() {
            if (
                typeof globalThis.KaitaiStream !== "undefined" &&
                typeof globalThis.DsStore !== "undefined"
            ) {
                return;
            }

            const runtimeUrl =
                "https://cdn.jsdelivr.net/npm/kaitai-struct@0.10.0/KaitaiStream.js";

            const parserUrl =
                "https://formats.kaitai.io/ds_store/src/javascript/DsStore.js";

            const runtimeSource = await Framework.requestText(runtimeUrl);
            const parserSource = await Framework.requestText(parserUrl);

            const runtimeRoot = {};
            runtimeRoot.self = runtimeRoot;

            new Function(
                "self",
                runtimeSource
            )(runtimeRoot);

            if (!runtimeRoot.KaitaiStream) {
                throw new Error("KaitaiStream runtime could not be loaded");
            }

            const parserRoot = {
                KaitaiStream: runtimeRoot.KaitaiStream
            };

            parserRoot.self = parserRoot;

            new Function(
                "self",
                parserSource
            )(parserRoot);

            if (!parserRoot.DsStore) {
                throw new Error("DS_Store parser could not be loaded");
            }

            this.KaitaiStream = runtimeRoot.KaitaiStream;
            this.DsStore = parserRoot.DsStore;
        }

        parseFile(buffer) {
            const stream = new this.KaitaiStream(buffer);
            const ds = new this.DsStore(stream);

            return this.collectRecords(ds);
        }

        collectRecords(ds) {
            const results = [];

            const body = ds.buddyAllocatorBody;

            if (!body || !body.directoryEntries || !body.directories) {
                throw new Error("Unexpected DS_Store structure");
            }

            const directoryIndex = body.directoryEntries.findIndex(
                entry => entry.name === "DSDB"
            );

            if (directoryIndex < 0) {
                throw new Error("DSDB directory was not found");
            }

            const directory = body.directories[directoryIndex];

            if (!directory || !directory.masterBlock) {
                throw new Error("DSDB master block was not found");
            }

            const master = directory.masterBlock;

            const visited = new Set();

            const readBlock = block => {
                if (!block || visited.has(block)) {
                    return;
                }

                visited.add(block);

                if (Array.isArray(block.data)) {
                    for (const item of block.data) {
                        if (item && item.record) {
                            const record = item.record;

                            const filename =
                                record.filename &&
                                record.filename.value;

                            const property =
                                record.structureType &&
                                record.structureType.value;

                            if (filename) {
                                results.push({
                                    name: String(filename),
                                    property: property
                                        ? String(property)
                                        : ""
                                });
                            }
                        }

                        if (item && item.block) {
                            readBlock(item.block);
                        }
                    }
                }

                if (block.rightmostBlock) {
                    readBlock(block.rightmostBlock);
                }
            };

            readBlock(master.rootBlock);

            return results;
        }

        render() {
            const container = Framework.createElement("div");

            const heading = Framework.createElement("h2", {
                textContent: "DS_Store Contents"
            });

            const description = Framework.createElement("p", {
                textContent: "Directory metadata extracted from the exposed DS_Store file."
            });

            const fileLink = Framework.createElement("a", {
                href: this.fileUrl,
                target: "_blank",
                rel: "noopener noreferrer",
                textContent: "Open .DS_Store file"
            });

            const copyButton = Framework.createElement("button", {
                type: "button",
                textContent: "Copy Names"
            });

            copyButton.addEventListener("click", () => {
                const names = this.records
                    .map(record => record.name)
                    .join("\n");

                Framework.copy(names);
                copyButton.textContent = "Copied";
            });

            const table = Framework.createElement("table", {
                style: "width:100%;border-collapse:collapse;margin-top:15px;"
            });

            const header = Framework.createElement("tr");

            for (const label of ["Name", "Property", "Action"]) {
                const cell = Framework.createElement("th", {
                    textContent: label,
                    style: "padding:9px;border-bottom:1px solid #555;text-align:left;"
                });

                header.appendChild(cell);
            }

            table.appendChild(header);

            for (const record of this.records) {
                const row = Framework.createElement("tr");

                const nameCell = Framework.createElement("td", {
                    style: "padding:9px;border-bottom:1px solid #333;"
                });

                const nameLink = Framework.createElement("a", {
                    href: new URL(
                        encodeURIComponent(record.name),
                        Framework.getCurrentDirectory()
                    ).href,
                    target: "_blank",
                    rel: "noopener noreferrer",
                    textContent: record.name
                });

                nameCell.appendChild(nameLink);

                const propertyCell = Framework.createElement("td", {
                    textContent: record.property,
                    style: "padding:9px;border-bottom:1px solid #333;"
                });

                const actionCell = Framework.createElement("td", {
                    style: "padding:9px;border-bottom:1px solid #333;"
                });

                const openButton = Framework.createElement("button", {
                    type: "button",
                    textContent: "Open"
                });

                openButton.addEventListener("click", () => {
                    Framework.open(nameLink.href);
                });

                actionCell.appendChild(openButton);

                row.append(nameCell, propertyCell, actionCell);
                table.appendChild(row);
            }

            const warning = Framework.createElement("p", {
                textContent:
                    "Note: DS_Store records may contain stale directory entries. File availability is not guaranteed.",
                style: "margin-top:15px;color:#aaa;font-size:12px;"
            });

            container.append(
                heading,
                description,
                fileLink,
                document.createTextNode(" "),
                copyButton,
                table,
                warning
            );

            return container;
        }

        destroy() {
            this.buffer = null;
            this.records = [];
        }
    }

    Framework.register(
        DSStoreViewer.id,
        DSStoreViewer
    );

})(Framework);
