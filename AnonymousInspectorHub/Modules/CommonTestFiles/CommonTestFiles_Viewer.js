(function(Framework){"use strict";class CommonTestFilesViewer extends Framework.BaseModule{

        static id = "CommonTestFiles_Viewer";
        static title = "Common Test Files";
        static description = "Find common test pages and files";
        static icon = "🧪";
        static scanPolicy = {
            scope: "origin-root",
            defaultTTL: "7d"
        };


static providerId="CommonTestFiles_Provider";async init(context={}){const result=context&&context.result;this.available=Boolean(result&&this.restoreResult(result,context));}
        destroy() {
            this.foundFiles = [];
        }

        render() {
            const container = Framework.createElement("div");

            container.appendChild(
                Framework.createElement("h2", {
                    textContent: "Common Test Files"
                })
            );

            container.appendChild(
                Framework.createElement("p", {
                    textContent:
                        this.foundFiles.length + " accessible paths found."
                })
            );

            const table = Framework.createElement("table", {
                style: "width:100%;border-collapse:collapse;"
            });

            const header = Framework.createElement("tr");

            for (const label of ["Path", "Status", "Action"]) {
                header.appendChild(
                    Framework.createElement("th", {
                        textContent: label,
                        style: "padding:9px;border-bottom:1px solid #555;text-align:left;"
                    })
                );
            }

            table.appendChild(header);

            for (const file of this.foundFiles) {
                const row = Framework.createElement("tr");

                const pathCell = Framework.createElement("td", {
                    textContent: file.path,
                    style: "padding:9px;border-bottom:1px solid #333;"
                });

                const statusCell = Framework.createElement("td", {
                    textContent: "Accessible",
                    style: "padding:9px;border-bottom:1px solid #333;"
                });

                const actionCell = Framework.createElement("td", {
                    style: "padding:9px;border-bottom:1px solid #333;"
                });

                const openLink = Framework.createElement("a", {
                    href: file.url,
                    target: "_blank",
                    rel: "noopener noreferrer",
                    textContent: "Open"
                });

                const copyButton = Framework.createElement("button", {
                    type: "button",
                    textContent: "Copy URL",
                    style: "margin-left:8px;"
                });

                copyButton.addEventListener("click", () => {
                    Framework.copy(file.url);
                    copyButton.textContent = "Copied";
                });

                actionCell.append(openLink, copyButton);
                row.append(pathCell, statusCell, actionCell);
                table.appendChild(row);
            }

            container.appendChild(table);

            container.appendChild(
                Framework.createElement("p", {
                    textContent:
                        "Detection uses HEAD responses only. A successful response does not guarantee that the path contains a real test page; custom error pages and application routing can produce false positives.",
                    style: "margin-top:15px;color:#aaa;font-size:12px;"
                })
            );

            return container;
        }

        restoreResult(data) {
            if (
                !data ||
                !Array.isArray(data.foundFiles) ||
                !data.foundFiles.every(file =>
                    file &&
                    typeof file.path === "string" &&
                    typeof file.url === "string"
                )
            ) {
                return false;
            }

            this.foundFiles = data.foundFiles.map(file => ({
                path: file.path,
                url: file.url
            }));

            this.scannedAt = data.scannedAt || null;
            this.available = true;

            return true;
        }

        getMetadata() {
            return {
                id: CommonTestFilesViewer.id,
                title: CommonTestFilesViewer.title,
                description: CommonTestFilesViewer.description,
                icon: CommonTestFilesViewer.icon
            };
        }

        constructor() {
            super();
            this.foundFiles = [];
            this.scannedAt = null;
        }
}Framework.register(CommonTestFilesViewer.id,CommonTestFilesViewer);})(Framework);