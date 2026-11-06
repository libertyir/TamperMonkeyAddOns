(function (Framework) {
    "use strict";

    class DSStoreViewer extends Framework.BaseModule {
        static id = "DS_Store_Viewer";
        static title = "DS_Store Viewer";
        static description = "Inspect exposed macOS directory metadata";
        static icon = "📁";
        static scannerId = "DS_Store_Scanner";

        constructor() {
            super();
            this.result = null;
        }

        getMetadata() {
            return {
                id: DSStoreViewer.id,
                title: DSStoreViewer.title,
                description: DSStoreViewer.description,
                icon: DSStoreViewer.icon
            };
        }

        async init(context = {}) {
            const result = context.result;

            if (!result || !Array.isArray(result.records)) {
                this.available = false;
                return;
            }

            this.result = {
                page: result.page || window.location.href,
                directoryUrl: result.directoryUrl,
                fileUrl: result.fileUrl,
                scannedAt: result.scannedAt || null,
                fileSize: Number(result.fileSize) || 0,
                totalRecords: result.records.length,
                records: result.records.map(record => ({
                    name: String(record.name || ""),
                    property: String(record.property || "")
                }))
            };

            this.available = true;
        }

        render() {
            if (!this.available || !this.result) {
                return Framework.createElement("div", {
                    textContent: "No DS_Store scan result is available."
                });
            }

            const container = Framework.createElement("div");
            const heading = Framework.createElement("h2", {
                textContent: "DS_Store Contents"
            });

            const description = Framework.createElement("p", {
                textContent:
                    "Directory metadata extracted from the exposed DS_Store file."
            });

            const fileLink = Framework.createElement("a", {
                href: this.result.fileUrl,
                target: "_blank",
                rel: "noopener noreferrer",
                textContent: "Open .DS_Store file"
            });

            const copyButton = Framework.createElement("button", {
                type: "button",
                textContent: "Copy Names"
            });

            copyButton.addEventListener("click", () => {
                const names = this.result.records
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
                    style:
                        "padding:9px;border-bottom:1px solid #555;text-align:left;"
                });

                header.appendChild(cell);
            }

            table.appendChild(header);

            for (const record of this.result.records) {
                const row = Framework.createElement("tr");
                const nameCell = Framework.createElement("td", {
                    style: "padding:9px;border-bottom:1px solid #333;"
                });

                const nameUrl = new URL(
                    encodeURIComponent(record.name),
                    this.result.directoryUrl
                ).href;

                const nameLink = Framework.createElement("a", {
                    href: nameUrl,
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
            this.result = null;
        }
    }

    Framework.register(DSStoreViewer.id, DSStoreViewer);
})(Framework);