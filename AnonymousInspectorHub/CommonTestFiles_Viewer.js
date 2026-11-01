
(function (Framework) {
    "use strict";

    class CommonTestFilesViewer extends Framework.BaseModule {

        static id = "CommonTestFiles_Viewer";
        static title = "Common Test Files";
        static description = "Find common test pages and files";
        static icon = "🧪";

        constructor() {
            super();
            this.foundFiles = [];
        }

        getMetadata() {
            return {
                id: CommonTestFilesViewer.id,
                title: CommonTestFilesViewer.title,
                description: CommonTestFilesViewer.description,
                icon: CommonTestFilesViewer.icon
            };
        }

        async init() {
            this.available = false;
            this.foundFiles = [];

            const base = new URL(
                ".",
                window.location.href
            );

            const candidates = [
                "test.php",
                "test.aspx",
                "test",
                "test.html",
                "test.asp",
                "testing.php",
                "test/index.html",
                "index2.php",
                "index3.php",
                "index2.aspx",
                "index3.aspx",
            ];

            // Sequential HEAD requests to avoid unnecessary server load.
            for (const path of candidates) {
                const url = new URL(path, base);

                // Only inspect paths on the current origin.
                if (url.origin !== window.location.origin) {
                    continue;
                }

                try {
                    const response = await fetch(url.href, {
                        method: "HEAD",
                        credentials: "same-origin",
                        redirect: "follow",
                        cache: "no-store"
                    });

                    if (
                        response.status >= 200 &&
                        response.status < 300 &&
                        new URL(response.url).origin === window.location.origin
                    ) {
                        this.foundFiles.push({
                            path,
                            url: response.url
                        });
                    }

                } catch (error) {
                    // Unavailable paths are ignored.
                }
            }

            this.available = this.foundFiles.length > 0;
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

        destroy() {
            this.foundFiles = [];
        }
    }

    Framework.register(
        CommonTestFilesViewer.id,
        CommonTestFilesViewer
    );

})(Framework);
