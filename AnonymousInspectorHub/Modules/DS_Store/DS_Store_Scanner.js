(function (Framework) {
    "use strict";

    class DSStoreScanner extends Framework.BaseModule {
        static id = "DS_Store_Scanner";
        static title = "DS_Store Scanner";
        static description = "Fetch and parse exposed macOS directory metadata";

        constructor() {
            super();
            this.KaitaiStream = null;
            this.DsStore = null;
        }

        async scan(context = {}) {
            this.available = false;

            const pageUrl = typeof context.url === "string"
                ? context.url
                : window.location.href;

            const directoryUrl = context.directoryUrl
                ? new URL(context.directoryUrl, pageUrl).href
                : new URL(".", pageUrl).href;

            const fileUrl = context.fileUrl
                ? new URL(context.fileUrl, directoryUrl).href
                : new URL(".DS_Store", directoryUrl).href;

            let buffer = null;

            try {
                buffer = await Framework.requestArrayBuffer(fileUrl);

                if (!buffer || buffer.byteLength < 36) {
                    throw new Error("The .DS_Store file is unavailable or too small.");
                }

                await this.loadParser();

                const records = this.parseFile(buffer);

                this.available = true;

                return {
                    page: pageUrl,
                    directoryUrl,
                    fileUrl,
                    scannedAt: new Date().toISOString(),
                    fileSize: buffer.byteLength,
                    totalRecords: records.length,
                    records: records.map(record => ({
                        name: record.name,
                        property: record.property
                    }))
                };
            } finally {
                buffer = null;
                this.KaitaiStream = null;
                this.DsStore = null;
            }
        }

        async loadParser() {
            let KaitaiStream = globalThis.KaitaiStream;

            if (typeof KaitaiStream !== "function") {
                const runtimeUrl =
                    "https://cdn.jsdelivr.net/npm/kaitai-struct@0.10.0/KaitaiStream.js";

                const runtimeSource =
                    await Framework.requestText(runtimeUrl);

                if (!runtimeSource) {
                    throw new Error("KaitaiStream runtime source is empty.");
                }

                const runtimeRoot = {};
                runtimeRoot.self = runtimeRoot;

                new Function(
                    "self",
                    "define",
                    "exports",
                    "require",
                    runtimeSource
                )(
                    runtimeRoot,
                    undefined,
                    undefined,
                    undefined
                );

                KaitaiStream = runtimeRoot.KaitaiStream;
            }

            if (typeof KaitaiStream !== "function") {
                throw new Error("KaitaiStream constructor was not found.");
            }

            let Parser = globalThis.DsStore;

            if (Parser && typeof Parser.DsStore === "function") {
                Parser = Parser.DsStore;
            }

            if (typeof Parser !== "function") {
                const parserUrl =
                    "https://formats.kaitai.io/ds_store/src/javascript/DsStore.js";

                const parserSource =
                    await Framework.requestText(parserUrl);

                if (!parserSource) {
                    throw new Error("DS_Store parser source is empty.");
                }

                const parserRoot = {
                    KaitaiStream
                };

                parserRoot.self = parserRoot;

                new Function(
                    "self",
                    "define",
                    "exports",
                    "require",
                    parserSource
                )(
                    parserRoot,
                    undefined,
                    undefined,
                    undefined
                );

                const namespace = parserRoot.DsStore;

                if (typeof namespace === "function") {
                    Parser = namespace;
                } else if (
                    namespace &&
                    typeof namespace.DsStore === "function"
                ) {
                    Parser = namespace.DsStore;
                }
            }

            if (typeof Parser !== "function") {
                throw new Error("DS_Store constructor was not found.");
            }

            this.KaitaiStream = KaitaiStream;
            this.DsStore = Parser;
        }

        parseFile(buffer) {
            if (typeof this.KaitaiStream !== "function") {
                throw new Error("KaitaiStream is not initialized.");
            }

            if (typeof this.DsStore !== "function") {
                throw new Error("DsStore is not a valid constructor.");
            }

            const stream = new this.KaitaiStream(buffer);
            const ds = new this.DsStore(stream);

            return this.collectRecords(ds);
        }

        collectRecords(ds) {
            const results = [];
            const body = ds.buddyAllocatorBody;

            if (!body || !body.directoryEntries || !body.directories) {
                throw new Error("Unexpected DS_Store structure.");
            }

            const directoryIndex = body.directoryEntries.findIndex(
                entry => entry.name === "DSDB"
            );

            if (directoryIndex < 0) {
                throw new Error("DSDB directory was not found.");
            }

            const directory = body.directories[directoryIndex];

            if (!directory || !directory.masterBlock) {
                throw new Error("DSDB master block was not found.");
            }

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
                                record.filename && record.filename.value;
                            const property =
                                record.structureType && record.structureType.value;

                            if (filename) {
                                results.push({
                                    name: String(filename),
                                    property: property ? String(property) : ""
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

            readBlock(directory.masterBlock.rootBlock);

            return results;
        }

        destroy() {
            this.KaitaiStream = null;
            this.DsStore = null;
        }
    }

    Framework.register(DSStoreScanner.id, DSStoreScanner);
})(Framework);