(function () {
    "use strict";

    const namespace =
        globalThis.AnonymousInspectorDebugMode;

    if (!namespace) {
        throw new Error(
            "DebugModeInspector namespace is not initialized."
        );
    }

    class RequestManager {

        // ==================================================
        // CONSTRUCTOR
        // ==================================================

        constructor(options = {}) {
            this.Framework = options.Framework;

            this.origin =
                options.origin || location.origin;

            this.timeout =
                options.timeout || 7000;

            this.maxRequests =
                options.maxRequests || 20;

            this.maxResponseSize =
                options.maxResponseSize || 128 * 1024;

            this.allowedMethods =
                new Set(
                    options.allowedMethods || ["GET", "HEAD"]
                );

            this.requestCount = 0;

            this.activeRequests = 0;

            this.completedRequests = 0;

            this.failedRequests = 0;

            this.blockedRequests = 0;

            this.cache = new Map();

            this.history = [];

            this.destroyed = false;
        }

        // ==================================================
        // URL VALIDATION
        // ==================================================

        normalizeUrl(rawUrl) {
            let url;

            try {
                url = new URL(rawUrl, this.origin);
            } catch {
                throw new Error("Invalid request URL.");
            }

            if (
                url.protocol !== "http:" &&
                url.protocol !== "https:"
            ) {
                throw new Error(
                    "Unsupported URL protocol."
                );
            }

            if (url.origin !== this.origin) {
                throw new Error(
                    "Cross-origin requests are not allowed."
                );
            }

            return url;
        }

        // ==================================================
        // REQUEST VALIDATION
        // ==================================================

        validateMethod(method) {
            const normalized =
                String(method || "GET").toUpperCase();

            if (!this.allowedMethods.has(normalized)) {
                throw new Error(
                    "HTTP method is not allowed: " + normalized
                );
            }

            return normalized;
        }

        validateRequest(url, method) {
            if (this.destroyed) {
                throw new Error(
                    "RequestManager has been destroyed."
                );
            }

            if (this.requestCount >= this.maxRequests) {
                throw new Error(
                    "Maximum request limit reached."
                );
            }

            const normalizedUrl =
                this.normalizeUrl(url);

            const normalizedMethod =
                this.validateMethod(method);

            return {
                url: normalizedUrl,
                method: normalizedMethod
            };
        }

        // ==================================================
        // CACHE
        // ==================================================

        getCacheKey(url, method) {
            return method + ":" + url.href;
        }

        getCached(url, method) {
            const key =
                this.getCacheKey(url, method);

            if (!this.cache.has(key)) {
                return null;
            }

            return this.cache.get(key);
        }

        setCached(url, method, result) {
            const key =
                this.getCacheKey(url, method);

            this.cache.set(key, result);
        }

        // ==================================================
        // RESPONSE SIZE
        // ==================================================

        getResponseSize(text) {
            if (typeof text !== "string") {
                return 0;
            }

            return new TextEncoder().encode(text).byteLength;
        }

        validateResponseSize(text) {
            const size = this.getResponseSize(text);

            if (size > this.maxResponseSize) {
                throw new Error(
                    "Response exceeds maximum allowed size."
                );
            }

            return size;
        }

        // ==================================================
        // HISTORY
        // ==================================================

        record(entry) {
            this.history.push({
                timestamp: new Date().toISOString(),
                ...entry
            });

            if (this.history.length > this.maxRequests) {
                this.history.shift();
            }
        }

        // ==================================================
        // RESPONSE NORMALIZATION
        // ==================================================

        normalizeResponse(response, url, method) {
            const body =
                typeof response === "string"
                    ? response
                    : "";

            const size =
                this.validateResponseSize(body);

            return {
                url: url.href,
                method,
                status: 200,
                ok: true,
                body,
                size,
                headers: {},
                redirected: false,
                error: null
            };
        }

        // ==================================================
        // NETWORK REQUEST
        // ==================================================

        async request(rawUrl, options = {}) {
            const method =
                options.method || "GET";

            let request;

            try {
                request = this.validateRequest(
                    rawUrl,
                    method
                );
            } catch (error) {
                this.blockedRequests++;

                this.record({
                    url: String(rawUrl),
                    method,
                    status: "Blocked",
                    error: error.message
                });

                throw error;
            }

            const url = request.url;
            const normalizedMethod = request.method;

            const cacheEnabled =
                options.cache !== false;

            if (cacheEnabled) {
                const cached = this.getCached(
                    url,
                    normalizedMethod
                );

                if (cached) {
                    return {
                        ...cached,
                        cached: true
                    };
                }
            }

            if (this.requestCount >= this.maxRequests) {
                throw new Error(
                    "Maximum request limit reached."
                );
            }

            this.requestCount++;
            this.activeRequests++;

            const startedAt = Date.now();

            try {
                const response =
                    await this.performRequest(
                        url,
                        normalizedMethod,
                        options
                    );

                const duration =
                    Date.now() - startedAt;

                const result = {
                    ...response,
                    duration,
                    cached: false
                };

                this.completedRequests++;

                this.record({
                    url: url.href,
                    method: normalizedMethod,
                    status: result.status,
                    duration,
                    size: result.size,
                    error: null
                });

                if (
                    cacheEnabled &&
                    result.ok
                ) {
                    this.setCached(
                        url,
                        normalizedMethod,
                        result
                    );
                }

                return result;

            } catch (error) {
                this.failedRequests++;

                this.record({
                    url: url.href,
                    method: normalizedMethod,
                    status: "Failed",
                    duration: Date.now() - startedAt,
                    error: error.message
                });

                throw error;

            } finally {
                this.activeRequests--;
            }
        }

        // ==================================================
        // PERFORM REQUEST
        // ==================================================

        async performRequest(url, method, options = {}) {
            const timeout =
                Number.isFinite(options.timeout)
                    ? Math.min(
                        Math.max(options.timeout, 1000),
                        this.timeout
                    )
                    : this.timeout;

            const headers = {
                "Accept": "text/html,application/json,text/plain,*/*",
                "Cache-Control": "no-cache"
            };

            if (method === "HEAD") {
                return this.performHeadRequest(
                    url,
                    timeout,
                    headers
                );
            }

            return this.performGetRequest(
                url,
                timeout,
                headers
            );
        }

        // ==================================================
        // GET REQUEST
        // ==================================================

        async performGetRequest(url, timeout, headers) {
            const responseText =
                await this.Framework.requestText(
                    url.href
                );

            if (responseText === null) {
                return {
                    url: url.href,
                    method: "GET",
                    status: 404,
                    ok: false,
                    body: "",
                    size: 0,
                    headers: {},
                    redirected: false,
                    error: "Resource unavailable."
                };
            }

            if (typeof responseText !== "string") {
                throw new Error(
                    "Unexpected response format."
                );
            }

            const size =
                this.validateResponseSize(responseText);

            return {
                url: url.href,
                method: "GET",
                status: 200,
                ok: true,
                body: responseText,
                size,
                headers: {},
                redirected: false,
                error: null
            };
        }

        // ==================================================
        // HEAD REQUEST
        // ==================================================

        async performHeadRequest(url, timeout, headers) {
            // Framework.requestText only exposes GET.
            // HEAD is not silently converted to GET.

            throw new Error(
                "HEAD requests are not supported by the current Framework network API."
            );
        }

        // ==================================================
        // CONVENIENCE METHODS
        // ==================================================

        async get(url, options = {}) {
            return this.request(url, {
                ...options,
                method: "GET"
            });
        }

        async head(url, options = {}) {
            return this.request(url, {
                ...options,
                method: "HEAD"
            });
        }

        // ==================================================
        // TEXT RESPONSE
        // ==================================================

        async getText(url, options = {}) {
            const result = await this.get(url, options);

            return result.body;
        }

        // ==================================================
        // JSON RESPONSE
        // ==================================================

        async getJSON(url, options = {}) {
            const result = await this.get(url, options);

            try {
                return JSON.parse(result.body);
            } catch {
                throw new Error(
                    "Response is not valid JSON."
                );
            }
        }

        // ==================================================
        // STATISTICS
        // ==================================================

        getStatistics() {
            return {
                requestCount: this.requestCount,
                activeRequests: this.activeRequests,
                completedRequests: this.completedRequests,
                failedRequests: this.failedRequests,
                blockedRequests: this.blockedRequests,
                remainingRequests: Math.max(
                    0,
                    this.maxRequests - this.requestCount
                ),
                maxRequests: this.maxRequests
            };
        }

        // ==================================================
        // REQUEST HISTORY
        // ==================================================

        getHistory() {
            return this.history.map(item => ({
                ...item
            }));
        }

        // ==================================================
        // CACHE MANAGEMENT
        // ==================================================

        clearCache() {
            this.cache.clear();
        }

        // ==================================================
        // DESTROY
        // ==================================================

        destroy() {
            this.destroyed = true;

            this.clearCache();

            this.history = [];
        }
    }

    // ==================================================
    // REGISTER SERVICE
    // ==================================================

    namespace.RequestManager = RequestManager;

})();