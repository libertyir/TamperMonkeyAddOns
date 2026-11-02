
(function (root) {
    "use strict";

    class Application {
        constructor(options = {}) {
            this.version = options.version || "1.0.0";

            this.services = new Map();
            this.initializedServices = [];

            this.state = "created";
            this.startPromise = null;
            this.stopPromise = null;

            this.context = {};
        }

        // --------------------------------------------------
        // SERVICE REGISTRATION
        // --------------------------------------------------

        registerService(name, service) {
            if (this.state !== "created") {
                throw new Error(
                    "Services can only be registered before application startup."
                );
            }

            if (
                typeof name !== "string" ||
                !name.trim()
            ) {
                throw new Error("Invalid service name.");
            }

            if (
                !service ||
                typeof service !== "object"
            ) {
                throw new Error(
                    "Service must be an object."
                );
            }

            if (this.services.has(name)) {
                throw new Error(
                    "Service already registered: " + name
                );
            }

            this.services.set(name, service);

            return service;
        }

        getService(name) {
            return this.services.get(name) || null;
        }

        hasService(name) {
            return this.services.has(name);
        }

        getServiceNames() {
            return [...this.services.keys()];
        }

        // --------------------------------------------------
        // APPLICATION CONTEXT
        // --------------------------------------------------

        createContext(context = {}) {
            return {
                ...context,

                application: this,

                getService: name =>
                    this.getService(name),

                hasService: name =>
                    this.hasService(name)
            };
        }

        // --------------------------------------------------
        // APPLICATION STARTUP
        // --------------------------------------------------

        async start(context = {}) {
            if (this.state === "running") {
                return this;
            }

            if (this.state === "starting") {
                return this.startPromise;
            }

            if (this.state === "stopping") {
                throw new Error(
                    "Application is currently stopping."
                );
            }

            this.state = "starting";
            this.context = this.createContext(context);

            this.startPromise = this.initializeServices();

            try {
                await this.startPromise;

                this.state = "running";

                return this;

            } catch (error) {
                this.state = "failed";
                throw error;

            } finally {
                this.startPromise = null;
            }
        }

        async initializeServices() {
            for (const [name, service] of this.services) {
                try {
                    if (
                        typeof service.initialize === "function"
                    ) {
                        await service.initialize(this.context);
                    }

                    this.initializedServices.push({
                        name,
                        service
                    });

                } catch (error) {
                    throw new Error(
                        "Service initialization failed: " +
                        name +
                        " - " +
                        error.message
                    );
                }
            }
        }

        // --------------------------------------------------
        // APPLICATION SHUTDOWN
        // --------------------------------------------------

        async stop() {
            if (this.state === "stopped") {
                return;
            }

            if (this.state === "stopping") {
                return this.stopPromise;
            }

            if (this.state === "starting") {
                try {
                    await this.startPromise;
                } catch {
                    // Continue shutdown after startup failure.
                }
            }

            this.state = "stopping";

            this.stopPromise = this.destroyServices();

            try {
                await this.stopPromise;
            } finally {
                this.state = "stopped";
                this.stopPromise = null;
            }
        }

        async destroyServices() {
            const services = [
                ...this.initializedServices
            ].reverse();

            this.initializedServices = [];

            for (const { name, service } of services) {
                if (
                    typeof service.destroy !== "function"
                ) {
                    continue;
                }

                try {
                    await service.destroy(this.context);

                } catch (error) {
                    console.error(
                        "[Anonymous Inspector] Service shutdown failed:",
                        name,
                        error
                    );
                }
            }
        }

        // --------------------------------------------------
        // APPLICATION STATUS
        // --------------------------------------------------

        getStatus() {
            return {
                version: this.version,
                state: this.state,
                registeredServices: this.getServiceNames(),
                initializedServices:
                    this.initializedServices.map(
                        item => item.name
                    )
            };
        }
    }

    // --------------------------------------------------
    // GLOBAL EXPORT
    // --------------------------------------------------

    root.AnonymousInspectorApplication = Application;

})(globalThis);
