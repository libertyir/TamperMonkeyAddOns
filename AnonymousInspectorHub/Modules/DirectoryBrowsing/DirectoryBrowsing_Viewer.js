(function(Framework){"use strict";class DirectoryBrowsingViewer extends Framework.BaseModule{
        static id = "DirectoryBrowsing_Viewer";
        static title = "Directory Browsing Viewer";
        static description = "Discover publicly accessible directory listings from page resources";
        static icon = "📂";
        static scanPolicy = {
            scope: "directory",
            defaultTTL: "7d"
        };


static providerId="DirectoryBrowsing_Provider";async init(context={}){const result=context&&context.result;this.available=Boolean(result&&this.restoreResult(result,context));}
        render() {
            const root = this.createElement(
                "div",
                "aih-directory-viewer"
            );

            const style = this.createElement("style");

            style.textContent = `
                .aih-directory-viewer {
                    color: inherit;
                    font-size: 13px;
                }

                .aih-directory-summary {
                    display: flex;
                    gap: 10px;
                    flex-wrap: wrap;
                    margin-bottom: 14px;
                }

                .aih-directory-stat {
                    border: 1px solid rgba(128,128,128,.3);
                    border-radius: 6px;
                    padding: 10px 14px;
                }

                .aih-directory-stat strong {
                    display: block;
                    font-size: 19px;
                }

                .aih-directory-card {
                    border: 1px solid rgba(128,128,128,.3);
                    border-radius: 7px;
                    padding: 12px;
                    margin: 12px 0;
                }

                .aih-directory-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    flex-wrap: wrap;
                    gap: 8px;
                    margin-bottom: 8px;
                }

                .aih-directory-url {
                    overflow-wrap: anywhere;
                    font-weight: 600;
                }

                .aih-directory-meta {
                    opacity: .7;
                    margin: 6px 0 10px;
                }

                .aih-directory-entry {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 10px;
                    padding: 7px 4px;
                    border-top: 1px solid rgba(128,128,128,.18);
                }

                .aih-directory-entry-name {
                    overflow-wrap: anywhere;
                    min-width: 0;
                }

                .aih-directory-entry-type {
                    opacity: .65;
                    white-space: nowrap;
                    font-size: 11px;
                }

                .aih-directory-button {
                    cursor: pointer;
                    padding: 6px 10px;
                    border: 1px solid rgba(128,128,128,.4);
                    border-radius: 4px;
                    background: transparent;
                    color: inherit;
                }

                .aih-directory-button:hover {
                    background: rgba(128,128,128,.15);
                }

                .aih-directory-actions {
                    display: flex;
                    gap: 7px;
                    flex-wrap: wrap;
                    margin-top: 10px;
                }
            `;

            root.appendChild(style);

            const summary = this.createElement(
                "div",
                "aih-directory-summary"
            );

            const stats = [
                ["Directories Checked", this.candidates.length],
                ["Open Listings", this.results.length],
                [
                    "Listed Entries",
                    this.results.reduce(
                        (sum, item) => sum + item.entries.length,
                        0
                    )
                ]
            ];

            for (const [label, value] of stats) {
                const stat = this.createElement(
                    "div",
                    "aih-directory-stat"
                );

                stat.appendChild(
                    this.createElement("strong", "", String(value))
                );

                stat.appendChild(
                    this.createElement("span", "", label)
                );

                summary.appendChild(stat);
            }

            root.appendChild(summary);

            root.appendChild(
                this.createButton(
                    "Copy Full Report",
                    () => Framework.copy(this.buildReport())
                )
            );

            for (const result of this.results) {
                root.appendChild(this.renderDirectory(result));
            }

            return root;
        }

        renderDirectory(result) {
            const card = this.createElement(
                "div",
                "aih-directory-card"
            );

            const header = this.createElement(
                "div",
                "aih-directory-header"
            );

            header.appendChild(
                this.createElement(
                    "span",
                    "aih-directory-url",
                    result.url
                )
            );

            header.appendChild(
                this.createElement(
                    "span",
                    "",
                    result.entries.length + " entries"
                )
            );

            card.appendChild(header);

            card.appendChild(
                this.createElement(
                    "div",
                    "aih-directory-meta",
                    result.format +
                    " | HTTP " + result.status +
                    " | " + result.responseTime + " ms" +
                    " | Source: " + result.source
                )
            );

            for (const entry of result.entries) {
                const row = this.createElement(
                    "div",
                    "aih-directory-entry"
                );

                const name = this.createElement(
                    "span",
                    "aih-directory-entry-name",
                    (entry.type === "Directory" ? "📁 " : "📄 ") +
                    entry.name
                );

                const actions = this.createElement(
                    "div",
                    "aih-directory-actions"
                );

                actions.appendChild(
                    this.createButton(
                        "Open",
                        () => Framework.open(entry.url)
                    )
                );

                actions.appendChild(
                    this.createButton(
                        "Copy URL",
                        () => Framework.copy(entry.url)
                    )
                );

                row.appendChild(name);

                const type = this.createElement(
                    "span",
                    "aih-directory-entry-type",
                    entry.type
                );

                row.appendChild(type);
                row.appendChild(actions);

                card.appendChild(row);
            }

            const footer = this.createElement(
                "div",
                "aih-directory-actions"
            );

            footer.appendChild(
                this.createButton(
                    "Open Directory",
                    () => Framework.open(result.url)
                )
            );

            footer.appendChild(
                this.createButton(
                    "Copy Directory URL",
                    () => Framework.copy(result.url)
                )
            );

            card.appendChild(footer);

            return card;
        }

        createButton(label, callback) {
            const button = this.createElement(
                "button",
                "aih-directory-button",
                label
            );

            button.type = "button";
            button.addEventListener("click", callback);

            return button;
        }

        createElement(tag, className, text) {
            const element = document.createElement(tag);

            if (className) {
                element.className = className;
            }

            if (text !== undefined) {
                element.textContent = text;
            }

            return element;
        }

        buildReport() {
            return JSON.stringify({
                page: location.href,
                scannedAt: this.scannedAt,
                baseDomain: this.getBaseDomain(location.hostname),
                checkedDirectories: this.candidates.length,
                openListings: this.results.length,
                results: this.results
            }, null, 2);
        }

        getBaseDomain(hostname) {
            const host = hostname.toLowerCase().replace(/\.$/, "");

            if (
                host === "localhost" ||
                /^\d{1,3}(\.\d{1,3}){3}$/.test(host) ||
                host.includes(":")
            ) {
                return host;
            }

            const labels = host.split(".");
            if (labels.length <= 2) return host;

            const multiPartSuffixes = [
                "co.uk", "org.uk", "gov.uk", "ac.uk",
                "com.au", "net.au", "org.au",
                "co.nz", "org.nz",
                "com.br", "com.cn", "com.hk",
                "co.jp", "co.in", "co.za",
                "com.sg", "com.mx", "com.ar",
                "com.tr", "com.ir", "co.kr",
                "com.tw", "co.id", "co.il",
                "com.ua", "com.pl"
            ];

            const lastTwo = labels.slice(-2).join(".");
            const suffixLength = multiPartSuffixes.includes(lastTwo) ? 3 : 2;

            return labels.slice(-suffixLength).join(".");
        }

        restoreResult(data, context = {}) {
            const expectedDirectory =
                context.directoryUrl ||
                context.scope;

            if (
                !expectedDirectory ||
                !data ||
                !Array.isArray(data.candidates) ||
                data.candidates.length !== 1
            ) {
                return false;
            }

            try {
                const expectedUrl = new URL(expectedDirectory);
                const cachedUrl = new URL(data.candidates[0].url);

                expectedUrl.search = "";
                expectedUrl.hash = "";
                cachedUrl.search = "";
                cachedUrl.hash = "";

                if (!expectedUrl.pathname.endsWith("/")) {
                    expectedUrl.pathname += "/";
                }

                if (!cachedUrl.pathname.endsWith("/")) {
                    cachedUrl.pathname += "/";
                }

                if (expectedUrl.href !== cachedUrl.href) {
                    return false;
                }
            } catch (error) {
                return false;
            }

            if (
                !Array.isArray(data.results) ||
                !data.candidates.every(candidate =>
                    candidate &&
                    typeof candidate.url === "string" &&
                    typeof candidate.source === "string"
                ) ||
                !data.results.every(result =>
                    result &&
                    typeof result.url === "string" &&
                    typeof result.requestedUrl === "string" &&
                    typeof result.source === "string" &&
                    typeof result.status === "number" &&
                    typeof result.responseTime === "number" &&
                    typeof result.title === "string" &&
                    typeof result.format === "string" &&
                    Array.isArray(result.entries) &&
                    result.entries.every(entry =>
                        entry &&
                        typeof entry.name === "string" &&
                        typeof entry.url === "string" &&
                        typeof entry.type === "string"
                    )
                )
            ) {
                return false;
            }

            try {
                const candidates = data.candidates.map(candidate => {
                    const url = new URL(candidate.url);

                    if (!this.isAllowedUrl(url)) {
                        throw new Error("Invalid candidate URL");
                    }

                    return {
                        url: url.href,
                        source: candidate.source
                    };
                });

                const results = data.results.map(result => {
                    const url = new URL(result.url);
                    const requestedUrl = new URL(result.requestedUrl);

                    if (
                        !this.isAllowedUrl(url) ||
                        !this.isAllowedUrl(requestedUrl)
                    ) {
                        throw new Error("Invalid result URL");
                    }

                    return {
                        url: url.href,
                        requestedUrl: requestedUrl.href,
                        source: result.source,
                        status: result.status,
                        responseTime: result.responseTime,
                        title: result.title,
                        format: result.format,
                        entries: result.entries.map(entry => {
                            const entryUrl = new URL(entry.url);

                            if (
                                !this.isAllowedUrl(entryUrl) ||
                                entryUrl.origin !== url.origin
                            ) {
                                throw new Error("Invalid entry URL");
                            }

                            return {
                                name: entry.name,
                                url: entryUrl.href,
                                type: entry.type
                            };
                        })
                    };
                });

                this.candidates = candidates;
                this.results = results;
                this.scannedAt = data.scannedAt || null;
                this.available = true;

                return true;

            } catch (error) {
                return false;
            }
        }

        isAllowedUrl(url) {
            return (
                ["http:", "https:"].includes(url.protocol) &&
                this.isAllowedHost(url.hostname)
            );
        }

        isAllowedHost(hostname) {
            const host = hostname.toLowerCase().replace(/\.$/, "");
            const currentHost = location.hostname.toLowerCase().replace(/\.$/, "");

            return host === currentHost;
        }

        getMetadata() {
            return {
                id: DirectoryBrowsingViewer.id,
                title: DirectoryBrowsingViewer.title,
                description: DirectoryBrowsingViewer.description,
                icon: DirectoryBrowsingViewer.icon
            };
        }

        constructor(...args) {
            super(...args);
            this.available = false;
            this.results = [];
            this.candidates = [];
            this.maxCandidates = 60;
            this.maxResponseSize = 256 * 1024;
            this.timeout = 5000;
            this.scannedAt = null;
        }
}Framework.register(DirectoryBrowsingViewer.id,DirectoryBrowsingViewer);})(Framework);