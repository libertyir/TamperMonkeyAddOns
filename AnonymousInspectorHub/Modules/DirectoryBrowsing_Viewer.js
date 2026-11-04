(function (Framework) {
    "use strict";

    class DirectoryBrowsingViewer extends Framework.BaseModule {
        static id = "DirectoryBrowsing_Viewer";
        static title = "Directory Browsing Viewer";
        static description = "Discover publicly accessible directory listings from page resources";
        static icon = "📂";
        static scanPolicy = {
            scope: "directory",
            defaultTTL: "7d"
        };

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

        getMetadata() {
            return {
                id: DirectoryBrowsingViewer.id,
                title: DirectoryBrowsingViewer.title,
                description: DirectoryBrowsingViewer.description,
                icon: DirectoryBrowsingViewer.icon
            };
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

        isAllowedHost(hostname) {
            const host = hostname.toLowerCase().replace(/\.$/, "");
            const currentHost = location.hostname.toLowerCase().replace(/\.$/, "");

            return host === currentHost;
        }

        isAllowedUrl(url) {
            return (
                ["http:", "https:"].includes(url.protocol) &&
                this.isAllowedHost(url.hostname)
            );
        }

        addDirectory(url, source) {
            if (!this.isAllowedUrl(url)) return;

            const directoryUrl = new URL(url.href);
            directoryUrl.search = "";
            directoryUrl.hash = "";

            if (!directoryUrl.pathname.endsWith("/")) {
                directoryUrl.pathname += "/";
            }

            const key = directoryUrl.href;

            if (!this.candidates.some(item => item.url === key)) {
                this.candidates.push({
                    url: key,
                    source: source
                });
            }
        }

        collectDirectories() {
            this.candidates = [];

            const selectors = [
                "a[href]",
                "link[href]",
                "script[src]",
                "img[src]",
                "source[src]",
                "iframe[src]",
                "form[action]",
                "video[src]",
                "audio[src]",
                "object[data]",
                "embed[src]"
            ];

            const elements = document.querySelectorAll(
                selectors.join(",")
            );

            for (const element of elements) {
                const raw =
                    element.getAttribute("href") ||
                    element.getAttribute("src") ||
                    element.getAttribute("action") ||
                    element.getAttribute("data");

                if (!raw) continue;

                try {
                    const url = new URL(raw, location.href);

                    if (!this.isAllowedUrl(url)) continue;

                    const path = url.pathname;
                    const segments = path.split("/").filter(Boolean);

                    if (path.endsWith("/")) {
                        this.addDirectory(url, "Page Link");
                    } else {
                        const lastSegment = segments[segments.length - 1] || "";
                        const hasExtension = /\.[a-z0-9]{1,12}$/i.test(lastSegment);

                        let directoryPath;

                        if (hasExtension) {
                            directoryPath = path.substring(
                                0,
                                path.lastIndexOf("/") + 1
                            );
                        } else {
                            directoryPath = path + "/";
                        }

                        const directory = new URL(url.href);
                        directory.pathname = directoryPath;
                        directory.search = "";
                        directory.hash = "";

                        this.addDirectory(
                            directory,
                            hasExtension ? "Resource Parent" : "Page Link"
                        );

                        if (hasExtension) {
                            const parentSegments = directoryPath
                                .split("/")
                                .filter(Boolean);

                            while (parentSegments.length > 0) {
                                parentSegments.pop();

                                const parent = new URL(url.origin);
                                parent.pathname =
                                    "/" + parentSegments.join("/") + "/";

                                this.addDirectory(parent, "Parent Directory");
                            }

                            this.addDirectory(
                                new URL(url.origin + "/"),
                                "Root Directory"
                            );
                        }
                    }
                } catch (error) {
                    // Ignore invalid URLs.
                }

                if (this.candidates.length >= this.maxCandidates) {
                    break;
                }
            }

            this.candidates = this.candidates.slice(
                0,
                this.maxCandidates
            );
        }

        static getScanScopes(context) {
            const collector = new this();

            collector.collectDirectories();

            return collector.candidates.map(candidate => ({
                scope: candidate.url,
                directoryUrl: candidate.url,
                directorySource: candidate.source
            }));
        }

        async init(context = {}) {
            this.available = false;
            this.results = [];
            this.candidates = [];
            this.scannedAt = new Date().toISOString();

            const rawDirectory =
                context.directoryUrl ||
                context.scope;

            if (!rawDirectory) {
                throw new Error("Directory scan scope is missing.");
            }

            let directoryUrl;

            try {
                directoryUrl = new URL(rawDirectory);
            } catch (error) {
                throw new Error("Invalid directory scan scope.");
            }

            if (!this.isAllowedUrl(directoryUrl)) {
                throw new Error("Directory scan scope is not allowed.");
            }

            directoryUrl.search = "";
            directoryUrl.hash = "";

            if (!directoryUrl.pathname.endsWith("/")) {
                directoryUrl.pathname += "/";
            }

            const candidate = {
                url: directoryUrl.href,
                source: context.directorySource || "Page Resource"
            };

            this.candidates = [candidate];

            const result = await this.checkDirectory(candidate);

            if (result) {
                this.results.push(result);
            }

            this.available = this.results.length > 0;
        }

        getResult() {
            return {
                page: location.href,
                scannedAt: this.scannedAt,
                baseDomain: this.getBaseDomain(location.hostname),
                checkedDirectories: this.candidates.length,
                openListings: this.results.length,
                totalEntries: this.results.reduce(
                    (sum, result) => sum + result.entries.length,
                    0
                ),
                candidates: this.candidates.map(candidate => ({
                    url: candidate.url,
                    source: candidate.source
                })),
                results: this.results.map(result => ({
                    url: result.url,
                    requestedUrl: result.requestedUrl,
                    source: result.source,
                    status: result.status,
                    responseTime: result.responseTime,
                    title: result.title,
                    format: result.format,
                    entries: result.entries.map(entry => ({
                        name: entry.name,
                        url: entry.url,
                        type: entry.type
                    }))
                }))
            };
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

        async readLimited(response) {
            if (!response.body) return "";

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            let output = "";
            let total = 0;
            let readCount = 0;

            const maxReads = 256;

            try {
                while (
                    total < this.maxResponseSize &&
                    readCount < maxReads
                ) {
                    readCount++;

                    const { done, value } = await reader.read();

                    if (done) break;
                    if (!value || value.length === 0) continue;

                    const remaining =
                        this.maxResponseSize - total;

                    const chunk = value.subarray(0, remaining);

                    output += decoder.decode(chunk, {
                        stream: true
                    });

                    total += chunk.length;

                    if (chunk.length < value.length) break;
                }

                output += decoder.decode();

            } finally {
                reader.cancel().catch(() => {});
            }

            return output;
        }

        async checkDirectory(candidate) {
            const controller = new AbortController();

            const timeoutId = setTimeout(
                () => controller.abort(),
                this.timeout
            );

            try {
                const startedAt = performance.now();

                const response = await Framework.SiteIntelligence.fetch(candidate.url, {
                    method: "GET",
                    credentials:
                        new URL(candidate.url).origin === location.origin
                            ? "same-origin"
                            : "omit",
                    mode: "cors",
                    redirect: "manual",
                    cache: "no-store",
                    signal: controller.signal,
                    headers: {
                        "Accept": "text/html"
                    }
                });

                const responseTime = Math.round(
                    performance.now() - startedAt
                );

                if (response.type === "opaqueredirect") return null;
                if (!response.ok) return null;

                const finalUrl = new URL(response.url);

                if (!this.isAllowedUrl(finalUrl)) return null;

                const contentType =
                    response.headers.get("content-type") || "";

                if (!contentType.toLowerCase().includes("text/html")) {
                    return null;
                }

                const html = await this.readLimited(response);

                if (!html || !html.trim()) return null;

                const parsed = new DOMParser().parseFromString(
                    html,
                    "text/html"
                );

                const listing = this.detectListing(parsed);

                if (!listing.detected) return null;

                const entries = this.extractEntries(
                    parsed,
                    finalUrl
                );

                if (entries.length === 0) return null;

                return {
                    url: finalUrl.href,
                    requestedUrl: candidate.url,
                    source: candidate.source,
                    status: response.status,
                    responseTime: responseTime,
                    title: parsed.title || "",
                    format: listing.format,
                    entries: entries
                };

            } finally {
                clearTimeout(timeoutId);
            }
        }

        detectListing(document) {
            const title = document.title || "";

            const heading = Array.from(
                document.querySelectorAll("h1, h2")
            ).map(element => element.textContent.trim()).join(" ");

            const headingText = title + " " + heading;

            if (
                /\bindex of\b/i.test(headingText) ||
                /\bdirectory listing\b/i.test(headingText) ||
                /\bdirectory contents\b/i.test(headingText)
            ) {
                return {
                    detected: true,
                    format: "Directory Index"
                };
            }

            const bodyText = document.body
                ? document.body.textContent
                : "";

            const hasParentLink = Array.from(
                document.querySelectorAll("a[href]")
            ).some(anchor =>
                /parent directory|^\s*\.\.\/?\s*$|^\s*\[parent directory\]\s*$/i
                    .test(anchor.textContent.trim())
            );

            const tableText = Array.from(
                document.querySelectorAll("th")
            ).map(item => item.textContent.trim().toLowerCase());

            const hasListingHeaders =
                tableText.includes("name") &&
                (
                    tableText.includes("last modified") ||
                    tableText.includes("size") ||
                    tableText.includes("description")
                );

            if (hasParentLink && hasListingHeaders) {
                return {
                    detected: true,
                    format: "Directory Listing"
                };
            }

            if (
                /directory listing for/i.test(bodyText) &&
                document.querySelectorAll("a[href]").length >= 2
            ) {
                return {
                    detected: true,
                    format: "Directory Listing"
                };
            }

            return {
                detected: false,
                format: "Unknown"
            };
        }

        extractEntries(document, directoryUrl) {
            const entries = [];
            const seen = new Set();

            const base = new URL(directoryUrl);
            let basePath = base.pathname;

            if (!basePath.endsWith("/")) {
                basePath += "/";
            }

            for (const anchor of document.querySelectorAll("a[href]")) {
                const rawHref = anchor.getAttribute("href");

                if (!rawHref) continue;

                try {
                    const url = new URL(rawHref, directoryUrl);

                    if (!this.isAllowedUrl(url)) continue;

                    if (
                        url.origin !== base.origin ||
                        !url.pathname.startsWith(basePath)
                    ) {
                        continue;
                    }

                    const relativePath = url.pathname
                        .substring(basePath.length);

                    if (
                        !relativePath ||
                        relativePath === "." ||
                        relativePath === ".." ||
                        relativePath.startsWith("../") ||
                        relativePath.includes("/")
                    ) {
                        continue;
                    }

                    const name = anchor.textContent.trim() ||
                        relativePath;

                    if (
                        /^(parent directory|\.\.\/?)$/i.test(name) ||
                        /^[?&]?[a-z]=/i.test(relativePath)
                    ) {
                        continue;
                    }

                    const key = url.href;

                    if (seen.has(key)) continue;
                    seen.add(key);

                    const isDirectory =
                        url.pathname.endsWith("/") ||
                        /\/$/.test(rawHref);

                    entries.push({
                        name: name,
                        url: url.href,
                        type: isDirectory ? "Directory" : "File"
                    });

                } catch (error) {
                    // Ignore malformed links.
                }
            }

            entries.sort((a, b) => {
                if (a.type !== b.type) {
                    return a.type === "Directory" ? -1 : 1;
                }

                return a.name.localeCompare(b.name);
            });

            return entries;
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
    }

    Framework.register(
        DirectoryBrowsingViewer.id,
        DirectoryBrowsingViewer
    );

})(Framework);