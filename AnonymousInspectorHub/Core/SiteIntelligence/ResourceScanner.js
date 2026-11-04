
(function (root) {
    "use strict";

    class ResourceScanner {
        constructor(options = {}) {
            if (!options.repository) {
                throw new Error(
                    "ResourceScanner requires ResourceRepository."
                );
            }

            this.repository = options.repository;

            this.concurrency = Number.isInteger(options.concurrency)
                ? Math.max(1, options.concurrency)
                : 4;

            this.timeout = Number.isInteger(options.timeout)
                ? Math.max(1000, options.timeout)
                : 15000;

            this.maxContentSize =
                Number.isInteger(options.maxContentSize)
                    ? Math.max(1024, options.maxContentSize)
                    : 256 * 1024;

            this.queue = [];
            this.activeCount = 0;
            this.inFlight = new Map();

            // Read-only processing state for independent UI consumers.
            this.activeTasks = new Map();
            this.taskHistory = [];
            this.taskSequence = 0;
            this.maxTaskHistory = 100;

            this.onStateChange =
                typeof options.onStateChange === "function"
                    ? options.onStateChange
                    : null;

            this.initialized = false;
            this.destroyed = false;
        }

        // --------------------------------------------------
        // INITIALIZATION
        // --------------------------------------------------

        initialize() {
            if (this.destroyed) {
                throw new Error(
                    "ResourceScanner has been destroyed."
                );
            }

            this.initialized = true;

            return this;
        }

        ensureInitialized() {
            if (!this.initialized || this.destroyed) {
                throw new Error(
                    "ResourceScanner is not initialized."
                );
            }
        }

        // --------------------------------------------------
        // URL VALIDATION
        // --------------------------------------------------

        normalizeUrl(value) {
            const url = this.repository.normalizeUrl(value);

            this.repository.validateOrigin(url);

            const parsed = new URL(url);

            if (parsed.username || parsed.password) {
                throw new Error(
                    "URLs containing credentials are not allowed."
                );
            }

            return url;
        }

        validateOptions(options = {}) {
            if (
                !options ||
                typeof options !== "object" ||
                Array.isArray(options)
            ) {
                throw new Error("Invalid scan options.");
            }

            const ttl = options.ttl || "7d";

            this.repository.parseTTL(ttl);

            return {
                force: options.force === true,
                needContent: options.needContent === true,
                ttl,
                source: options.source || null,

                maxContentSize:
                    Number.isInteger(options.maxContentSize)
                        ? Math.max(
                            1024,
                            Math.min(
                                options.maxContentSize,
                                this.maxContentSize
                            )
                        )
                        : this.maxContentSize
            };
        }

        // --------------------------------------------------
        // PROCESSING OBSERVABILITY
        // --------------------------------------------------

        getTaskSnapshot(task) {
            return {
                id: task.id,
                url: task.url,
                source: task.source,
                status: task.status,
                method: task.method,
                phase: task.phase,
                httpStatus: task.httpStatus,
                error: task.error,
                createdAt: task.createdAt,
                startedAt: task.startedAt,
                completedAt: task.completedAt
            };
        }

        getStatus() {
            return {
                initialized: this.initialized,
                destroyed: this.destroyed,
                concurrency: this.concurrency,
                active: this.activeCount,
                queued: this.queue.length,
                inFlight: this.inFlight.size,

                processing:
                    this.activeCount > 0 ||
                    this.queue.length > 0,

                activeTasks: [...this.activeTasks.values()]
                    .map(task => this.getTaskSnapshot(task)),

                queuedTasks: this.queue
                    .map(task => this.getTaskSnapshot(task)),

                recentTasks: this.taskHistory
                    .map(task => this.getTaskSnapshot(task))
            };
        }

        notifyStateChange(reason, task = null) {
            if (typeof this.onStateChange !== "function") {
                return;
            }

            try {
                this.onStateChange({
                    reason,
                    task: task
                        ? this.getTaskSnapshot(task)
                        : null,
                    snapshot: this.getStatus()
                });
            } catch (error) {
                console.error(
                    "[ResourceScanner] State listener failed:",
                    error
                );
            }
        }

        setTaskPhase(url, method, phase, httpStatus = null) {
            const task = [...this.activeTasks.values()].find(
                item => item.url === url
            );

            if (!task) {
                return;
            }

            task.method = method;
            task.phase = phase;

            if (httpStatus !== null) {
                task.httpStatus = httpStatus;
            }

            this.notifyStateChange("request", task);
        }

        // --------------------------------------------------
        // PUBLIC SCAN API
        // --------------------------------------------------

        async scan(url, options = {}) {
            this.ensureInitialized();

            const normalizedUrl = this.normalizeUrl(url);
            const settings = this.validateOptions(options);

            const existing = this.inFlight.get(normalizedUrl);

            if (existing) {
                const result = await existing.promise;

                if (
                    settings.needContent &&
                    !result.contentAvailable &&
                    result.status >= 200 &&
                    result.status < 300
                ) {
                    this.ensureInitialized();

                    return this.scan(normalizedUrl, {
                        ...options,
                        force: true
                    });
                }

                return result;
            }

            const promise = this.enqueue(
                () => this.processResource(
                    normalizedUrl,
                    settings
                ),
                {
                    url: normalizedUrl,
                    source: settings.source
                }
            );

            this.inFlight.set(normalizedUrl, {
                promise,
                needContent: settings.needContent
            });

            try {
                return await promise;
            } finally {
                const current = this.inFlight.get(normalizedUrl);

                if (current?.promise === promise) {
                    this.inFlight.delete(normalizedUrl);
                }
            }
        }

        // --------------------------------------------------
        // QUEUE MANAGEMENT
        // --------------------------------------------------

        enqueue(operation, metadata = {}) {
            return new Promise((resolve, reject) => {
                const task = {
                    id: ++this.taskSequence,
                    operation,
                    resolve,
                    reject,

                    url: metadata.url || null,
                    source: metadata.source || null,

                    status: "queued",
                    method: null,
                    phase: "Waiting in queue",

                    httpStatus: null,
                    error: null,

                    createdAt: new Date().toISOString(),
                    startedAt: null,
                    completedAt: null
                };

                this.queue.push(task);
                this.taskHistory.push(task);

                if (this.taskHistory.length > this.maxTaskHistory) {
                    this.taskHistory.shift();
                }

                this.notifyStateChange("queued", task);

                this.processQueue();
            });
        }

        processQueue() {
            while (
                !this.destroyed &&
                this.activeCount < this.concurrency &&
                this.queue.length
            ) {
                const task = this.queue.shift();

                this.activeCount++;

                task.status = "processing";
                task.phase = "Preparing request";
                task.startedAt = new Date().toISOString();

                this.activeTasks.set(task.id, task);

                this.notifyStateChange("started", task);

                Promise.resolve()
                    .then(() => {
                        if (this.destroyed) {
                            throw new Error(
                                "ResourceScanner has been destroyed."
                            );
                        }

                        return task.operation();
                    })
                    .then(
                        result => {
                            task.status = "completed";
                            task.phase = "Completed";

                            task.httpStatus =
                                result?.status ?? task.httpStatus;

                            task.completedAt =
                                new Date().toISOString();

                            this.notifyStateChange(
                                "completed",
                                task
                            );

                            task.resolve(result);
                        },
                        error => {
                            task.status = "failed";
                            task.phase = "Failed";

                            task.error =
                                error?.message || String(error);

                            task.completedAt =
                                new Date().toISOString();

                            this.notifyStateChange(
                                "failed",
                                task
                            );

                            task.reject(error);
                        }
                    )
                    .finally(() => {
                        this.activeTasks.delete(task.id);

                        this.activeCount--;

                        this.notifyStateChange("queue:updated");

                        this.processQueue();

                        if (
                            this.activeCount === 0 &&
                            this.queue.length === 0
                        ) {
                            this.notifyStateChange("idle");
                        }
                    });
            }
        }

        // --------------------------------------------------
        // RESOURCE PROCESSING
        // --------------------------------------------------

        async processResource(url, options) {
            const previous = await this.repository.get(url);

            if (!options.force && previous) {
                const valid = this.repository.isFresh(
                    previous,
                    "validation",
                    options.ttl
                );

                const contentValid =
                    !options.needContent ||
                    (
                        typeof previous.content === "string" &&
                        previous.contentComplete === true &&
                        this.isTimestampFresh(
                            previous.contentFetchedAt,
                            options.ttl
                        )
                    );

                if (valid && contentValid) {
                    return {
                        url,
                        source: "cache",
                        status: previous.httpStatus,
                        record: previous,
                        content: options.needContent
                            ? previous.content
                            : null,
                        contentAvailable:
                            typeof previous.content === "string" &&
                            previous.contentComplete === true
                    };
                }
            }

            const head = await this.request(url, "HEAD");

            if (
                head.status === 405 ||
                head.status === 501
            ) {
                this.releaseResponse(head);

                return this.processGetFallback(
                    url,
                    options
                );
            }

            return this.processHeadResult(
                url,
                head,
                options
            );
        }

        // --------------------------------------------------
        // HEAD RESULT
        // --------------------------------------------------

        async processHeadResult(url, response, options) {
            try {
                this.validateFinalUrl(response.url || url);

                const status = response.status;
                const headers = response.headers;

                if (status >= 200 && status < 300) {
                    if (options.needContent) {
                        return this.processGet(
                            url,
                            options
                        );
                    }

                    return this.saveResult(
                        url,
                        {
                            status: "accessible",
                            httpStatus: status,
                            headers,
                            contentType:
                                headers["content-type"] || null,
                            contentLength: this.parseLength(
                                headers["content-length"]
                            ),
                            source: options.source
                        },
                        null
                    );
                }

                return this.saveHttpFailure(
                    url,
                    response,
                    options
                );

            } finally {
                this.releaseResponse(response);
            }
        }

        // --------------------------------------------------
        // GET FALLBACK
        // --------------------------------------------------

        async processGetFallback(url, options) {
            return this.processGet(url, options);
        }

        // --------------------------------------------------
        // GET
        // --------------------------------------------------

        async processGet(url, options) {
            const response = await this.request(url, "GET");

            try {
                this.validateFinalUrl(response.url || url);

                const status = response.status;

                if (status < 200 || status >= 300) {
                    return this.saveHttpFailure(
                        url,
                        response,
                        options
                    );
                }

                let content = null;
                let contentComplete = false;

                if (options.needContent) {
                    const result = await this.readLimited(
                        response,
                        options.maxContentSize
                    );

                    content = result.content;
                    contentComplete = !result.truncated;

                } else {
                    await this.cancelResponse(response);
                }

                const headers = response.headers;

                const result = await this.saveResult(
                    url,
                    {
                        status: "accessible",
                        httpStatus: status,
                        headers,
                        contentType:
                            headers["content-type"] || null,
                        contentLength: this.parseLength(
                            headers["content-length"]
                        ),
                        source: options.source
                    },
                    options.needContent
                        ? {
                            content,
                            contentComplete,
                            contentTruncated: !contentComplete,
                            contentFetchedAt:
                                new Date().toISOString()
                        }
                        : null
                );

                return {
                    ...result,
                    content,
                    contentAvailable: contentComplete
                };

            } finally {
                this.releaseResponse(response);
            }
        }

        // --------------------------------------------------
        // HTTP FAILURE
        // --------------------------------------------------

        async saveHttpFailure(url, response, options) {
            const status = response.status;

            await this.cancelResponse(response);

            if (status === 404) {
                return this.saveResult(
                    url,
                    {
                        status: "not-found",
                        httpStatus: status,
                        headers: response.headers,
                        source: options.source
                    },
                    null
                );
            }

            let resourceStatus = "http-error";

            if (status === 403) {
                resourceStatus = "access-denied";

            } else if (status >= 300 && status < 400) {
                resourceStatus = "redirect";
            }

            return this.saveResult(
                url,
                {
                    status: resourceStatus,
                    httpStatus: status,
                    headers: response.headers,
                    source: options.source
                },
                null
            );
        }

        // --------------------------------------------------
        // RESULT PERSISTENCE
        // --------------------------------------------------

        async saveResult(url, validation, contentData) {
            await this.repository.registerValidation(
                url,
                validation
            );

            if (contentData) {
                await this.repository.upsert(
                    url,
                    contentData
                );
            }

            const record = await this.repository.get(url);

            return {
                url,
                source: "network",
                status: validation.httpStatus,
                record,
                content: contentData?.content ?? null,
                contentAvailable:
                    contentData?.contentComplete === true
            };
        }

        // --------------------------------------------------
        // HTTP REQUEST
        // --------------------------------------------------

        async request(url, method) {
            this.setTaskPhase(
                url,
                method,
                method + " request"
            );

            const controller = new AbortController();

            const timeoutId = setTimeout(
                () => controller.abort(),
                this.timeout
            );

            let released = false;

            const release = () => {
                if (released) {
                    return;
                }

                released = true;
                clearTimeout(timeoutId);
            };

            try {
                const response = await fetch(url, {
                    method,
                    credentials: "same-origin",
                    redirect: "manual",
                    cache: "no-store",
                    signal: controller.signal,
                    headers: {
                        "Cache-Control": "no-cache, no-store",
                        "Pragma": "no-cache"
                    }
                });

                this.setTaskPhase(
                    url,
                    method,
                    method + " response: HTTP " + response.status,
                    response.status
                );

                return {
                    status: response.type === "opaqueredirect"
                        ? 0
                        : response.status,
                    responseType: response.type,
                    url: response.url || url,
                    headers: this.extractHeaders(
                        response.headers
                    ),
                    body: response.body,
                    release
                };

            } catch (error) {
                release();

                if (error.name === "AbortError") {
                    throw new Error(
                        "Request timed out: " + url
                    );
                }

                throw error;
            }
        }

        releaseResponse(response) {
            if (
                response &&
                typeof response.release === "function"
            ) {
                response.release();
            }
        }

        async cancelResponse(response) {
            if (!response?.body) {
                return;
            }

            try {
                await response.body.cancel();
            } catch {
                // Ignore cancellation errors.
            }
        }

        // --------------------------------------------------
        // RESPONSE VALIDATION
        // --------------------------------------------------

        validateFinalUrl(value) {
            let finalUrl;

            try {
                finalUrl = new URL(value);
            } catch {
                throw new Error("Invalid final response URL.");
            }

            if (
                finalUrl.origin !== this.repository.origin ||
                finalUrl.username ||
                finalUrl.password
            ) {
                throw new Error(
                    "Cross-origin redirects are not allowed."
                );
            }
        }

        extractHeaders(headers) {
            const result = {};

            for (const [name, value] of headers.entries()) {
                result[name.toLowerCase()] = value;
            }

            return result;
        }

        parseLength(value) {
            if (value === undefined || value === null) {
                return null;
            }

            const length = Number(value);

            return Number.isSafeInteger(length) && length >= 0
                ? length
                : null;
        }

        // --------------------------------------------------
        // LIMITED CONTENT READING
        // --------------------------------------------------

        async readLimited(response, maxSize) {
            if (!response.body) {
                return {
                    content: "",
                    truncated: false
                };
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            let content = "";
            let total = 0;
            let truncated = false;

            try {
                while (true) {
                    const { done, value } = await reader.read();

                    if (done) {
                        break;
                    }

                    if (!value) {
                        continue;
                    }

                    const remaining = maxSize - total;

                    if (remaining <= 0) {
                        truncated = true;
                        break;
                    }

                    const chunk = value.subarray(
                        0,
                        remaining
                    );

                    content += decoder.decode(
                        chunk,
                        { stream: true }
                    );

                    total += chunk.length;

                    if (chunk.length < value.length) {
                        truncated = true;
                        break;
                    }

                    if (total >= maxSize) {
                        const next = await reader.read();

                        if (!next.done) {
                            truncated = true;
                        }

                        break;
                    }
                }

                content += decoder.decode();

                return {
                    content,
                    truncated
                };

            } finally {
                if (truncated) {
                    await reader.cancel().catch(() => {});
                }

                reader.releaseLock();
            }
        }

        // --------------------------------------------------
        // CACHE FRESHNESS
        // --------------------------------------------------

        isTimestampFresh(timestamp, ttl) {
            if (!timestamp) {
                return false;
            }

            const parsed = Date.parse(timestamp);

            if (!Number.isFinite(parsed)) {
                return false;
            }

            const duration = this.repository.parseTTL(ttl);

            if (duration === "always") {
                return false;
            }

            if (duration === "permanent") {
                return true;
            }

            return Date.now() - parsed < duration;
        }

        // --------------------------------------------------
        // SHUTDOWN
        // --------------------------------------------------

        destroy() {
            this.destroyed = true;
            this.initialized = false;

            const pending = this.queue.splice(0);

            for (const task of pending) {
                task.status = "failed";
                task.phase = "Cancelled";
                task.error = "ResourceScanner has been destroyed.";
                task.completedAt = new Date().toISOString();

                this.notifyStateChange("failed", task);

                task.reject(
                    new Error(
                        "ResourceScanner has been destroyed."
                    )
                );
            }

            this.notifyStateChange("destroyed");

            // Active fetch operations finish or timeout naturally.
        }
    }

    root.AnonymousInspectorResourceScanner =
        ResourceScanner;

})(globalThis);
