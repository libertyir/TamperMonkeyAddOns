(function (root) {
    "use strict";

    const ns = root.AnonymousInspectorWebStructure =
        root.AnonymousInspectorWebStructure || {};

    class DirectoryScanner {
        constructor(module) {
            this.module = module;
            this.maxResponseSize = 256 * 1024;
            this.timeout = 7000;
            this.maxEntries = 500;
        }

        normalizeDirectory(rawUrl) {
            const url = new URL(rawUrl, location.href);

            if (url.origin !== location.origin) {
                throw new Error("Directory must belong to the current origin.");
            }

            if (url.username || url.password) {
                throw new Error("URLs containing credentials are not allowed.");
            }

            if (!url.pathname.endsWith("/")) {
                url.pathname += "/";
            }

            url.search = "";
            url.hash = "";

            return url;
        }

        async readLimited(response) {
            if (!response.body) return "";

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            let output = "";
            let total = 0;
            let truncated = false;

            try {
                while (total < this.maxResponseSize) {
                    const { done, value } = await reader.read();

                    if (done) break;
                    if (!value) continue;

                    const remaining = this.maxResponseSize - total;
                    const chunk = value.subarray(0, remaining);

                    output += decoder.decode(chunk, { stream: true });
                    total += chunk.length;

                    if (chunk.length < value.length) {
                        truncated = true;
                        break;
                    }
                }

                if (!truncated && total >= this.maxResponseSize) {
                    truncated = true;
                }

                output += decoder.decode();

                if (truncated) {
                    throw new Error("Directory response exceeds the maximum allowed size.");
                }
            } finally {
                reader.cancel().catch(() => {});
            }

            return output;
        }

        detectListing(doc) {
            const heading = [
                doc.title || "",
                ...Array.from(doc.querySelectorAll("h1,h2"))
                    .map(item => item.textContent || "")
            ].join(" ");

            if (
                /\bindex of\b/i.test(heading) ||
                /\bdirectory listing\b/i.test(heading) ||
                /\bdirectory contents\b/i.test(heading)
            ) {
                return true;
            }

            const parentLink = Array.from(
                doc.querySelectorAll("a[href]")
            ).some(anchor =>
                /parent directory|^\s*\.\.\/?\s*$/i.test(
                    anchor.textContent.trim()
                )
            );

            const tableHeaders = Array.from(
                doc.querySelectorAll("th")
            ).map(item => item.textContent.trim().toLowerCase());

            const hasListingHeaders =
                tableHeaders.some(value => value === "name") &&
                tableHeaders.some(value =>
                    value.includes("last modified") ||
                    value === "size"
                );

            return parentLink && hasListingHeaders;
        }

        extractEntries(doc, directoryUrl) {
            const entries = [];
            const seen = new Set();

            for (const anchor of doc.querySelectorAll("a[href]")) {
                if (entries.length >= this.maxEntries) break;

                const label = anchor.textContent.trim();
                const href = anchor.getAttribute("href");

                if (!href || !label) continue;
                if (/^(?:\?|#|javascript:|mailto:|data:|blob:)/i.test(href)) continue;
                if (/parent directory|^\.\.\/?$/i.test(label)) continue;

                let url;

                try {
                    url = new URL(href, directoryUrl);
                } catch {
                    continue;
                }

                if (url.origin !== directoryUrl.origin) continue;
                if (url.username || url.password) continue;
                if (!url.pathname.startsWith(directoryUrl.pathname)) continue;

                url.search = "";
                url.hash = "";

                if (url.href === directoryUrl.href) continue;
                if (seen.has(url.href)) continue;

                seen.add(url.href);

                const isDirectory = url.pathname.endsWith("/");
                const record = this.module.analyzer.analyze(
                    url.href,
                    "directory-listing",
                    {
                        status: "observed"
                    }
                );

                if (!record) continue;

                record.status = "observed";
                record.directoryListing = true;
                record.type = isDirectory ? "directory" : record.type;
                record.tags.push("directory-listing");

                entries.push(record);
            }

            return entries;
        }

        async scan(rawUrl) {
            const directoryUrl = this.normalizeDirectory(rawUrl);
            const controller = new AbortController();

            const timeoutId = setTimeout(
                () => controller.abort(),
                this.timeout
            );

            try {
                const response = await fetch(directoryUrl.href, {
                    method: "GET",
                    credentials: "same-origin",
                    redirect: "manual",
                    cache: "no-store",
                    signal: controller.signal,
                    headers: {
                        "Accept": "text/html"
                    }
                });

                if (response.type === "opaqueredirect") {
                    throw new Error("Redirect could not be inspected.");
                }

                if (!response.ok) {
                    throw new Error("Directory request returned HTTP " + response.status);
                }

                const finalUrl = new URL(response.url || directoryUrl.href);

                if (finalUrl.origin !== location.origin) {
                    throw new Error("Cross-origin response rejected.");
                }

                if (finalUrl.username || finalUrl.password) {
                    throw new Error("Response URL contains credentials.");
                }

                const contentType =
                    response.headers.get("content-type") || "";

                if (!/text\/html/i.test(contentType)) {
                    throw new Error("Response is not an HTML directory listing.");
                }

                const html = await this.readLimited(response);

                if (!html) {
                    throw new Error("Directory response is empty.");
                }

                const doc = new DOMParser().parseFromString(
                    html,
                    "text/html"
                );

                if (!this.detectListing(doc)) {
                    throw new Error("Directory listing was not detected.");
                }

                const entries = this.extractEntries(doc, finalUrl);

                const directoryRecord = this.module.analyzer.analyze(
                    finalUrl.href,
                    "directory-scan",
                    {
                        status: "confirmed",
                        contentType
                    }
                );

                if (!directoryRecord) {
                    throw new Error("Directory record could not be created.");
                }

                directoryRecord.status = "confirmed";
                directoryRecord.directoryListing = true;
                directoryRecord.tags.push("directory-listing");

                const service = Framework.SiteIntelligence;

                if (!service || typeof service.discoverMany !== "function") {
                    throw new Error("Central Site Intelligence service is unavailable.");
                }

                const discovered = [directoryRecord, ...entries];

                await service.discoverMany(
                    discovered.map(record => ({
                        url: record.url,
                        source: "WebStructureInspector.DirectoryScanner",
                        tags: [...(record.tags || []), "directory-listing"],
                        metadata: {
                            resourceType: record.type,
                            directoryListing: true
                        }
                    }))
                );

                const validation = await service.scanMany(
                    entries.map(record => ({
                        url: record.url,
                        source: "WebStructureInspector.DirectoryScanner",
                        needContent: false
                    })),
                    { source: "WebStructureInspector.DirectoryScanner" }
                );

                const validatedByUrl = new Map(
                    validation.map(result => [result.url, result])
                );

                for (const entry of entries) {
                    const result = validatedByUrl.get(entry.url);
                    if (result?.record) {
                        entry.status = result.record.status === "accessible"
                            ? "verified"
                            : result.record.status;
                        entry.httpStatus = result.record.httpStatus;
                        entry.contentType = result.record.contentType || null;
                    }
                }

                await this.module.store.upsertMany(discovered);

                return {
                    directory: finalUrl.href,
                    entries: entries.length,
                    scannedAt: new Date().toISOString()
                };
            } finally {
                clearTimeout(timeoutId);
            }
        }
    }

    ns.DirectoryScanner = DirectoryScanner;

})(globalThis);