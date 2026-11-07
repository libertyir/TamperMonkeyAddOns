(function(Framework){"use strict";class DirectoryBrowsingViewerScanner extends Framework.BaseModule{
        static id = "DirectoryBrowsing_Scanner";
        static title = "Directory Browsing Viewer";
        static description = "Discover publicly accessible directory listings from page resources";
        static icon = "📂";
        static scanPolicy = {
            scope: "directory",
            defaultTTL: "7d"
        };


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

        async runScan(context = {}) {
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
async scan(context={}){await this.runScan(context);if(!this.available)return null;const result=await this.getResult();if(!result||typeof result!=="object")return null;const origin=new URL(context.url||context.currentUrl||location.href).origin;return {...result,directoryUrl:context.directoryUrl||context.scope||origin+"/"};}}
Framework.register(DirectoryBrowsingViewerScanner.id,DirectoryBrowsingViewerScanner);})(Framework);