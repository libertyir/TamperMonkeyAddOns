
(function (root) {
    "use strict";

    class SiteIntelligenceDialog {
        static preferredMode = "open";

        constructor() {
            this.service = null;
            this.unsubscribe = null;

            this.host = null;
            this.shadow = null;
            this.dialog = null;
            this.minimizedButton = null;

            this.currentStatus = null;
            this.destroyed = false;
        }

        // --------------------------------------------------
        // INITIALIZATION
        // --------------------------------------------------

        initialize(siteIntelligenceAPI) {
            if (
                !siteIntelligenceAPI ||
                typeof siteIntelligenceAPI.getStatus !== "function" ||
                typeof siteIntelligenceAPI.on !== "function"
            ) {
                throw new Error(
                    "SiteIntelligenceDialog requires the SiteIntelligence API."
                );
            }

            if (this.service) {
                return this;
            }

            this.service = siteIntelligenceAPI;
            this.destroyed = false;

            this.createHost();

            this.unsubscribe = this.service.on(
                "scanner:updated",
                event => {
                    if (this.destroyed) {
                        return;
                    }

                    this.update(
                        event?.data?.snapshot || null
                    );
                }
            );

            const status = this.service.getStatus();

            this.update(status?.scanner || null);

            return this;
        }

        // --------------------------------------------------
        // DOM
        // --------------------------------------------------

        createHost() {
            if (this.host) {
                return;
            }

            this.host = document.createElement("div");

            this.host.id =
                "aih-site-intelligence-dialog-host";

            this.host.style.position = "fixed";
            this.host.style.zIndex = "2147483000";
            this.host.style.inset = "0";
            this.host.style.pointerEvents = "none";

            this.shadow = this.host.attachShadow({
                mode: "open"
            });

            const style = document.createElement("style");

            style.textContent = `
                :host {
                    all: initial;
                    font-family: Arial, sans-serif;
                    color-scheme: dark;
                }

                * {
                    box-sizing: border-box;
                }

                .aih-dialog {
                    position: fixed;
                    right: 24px;
                    bottom: 24px;
                    width: min(560px, calc(100vw - 32px));
                    max-height: min(620px, calc(100vh - 48px));
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                    pointer-events: auto;
                    color: #e8e8e8;
                    background: #202124;
                    border: 1px solid #45474b;
                    border-radius: 10px;
                    box-shadow: 0 8px 32px rgba(0,0,0,.45);
                    font-size: 13px;
                }

                .aih-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 12px;
                    padding: 13px 15px;
                    background: #292b2f;
                    border-bottom: 1px solid #414348;
                }

                .aih-title {
                    font-size: 14px;
                    font-weight: 600;
                }

                .aih-header-actions {
                    display: flex;
                    gap: 7px;
                }

                .aih-button {
                    border: 1px solid #55585e;
                    border-radius: 5px;
                    padding: 5px 9px;
                    color: #eee;
                    background: #36383d;
                    cursor: pointer;
                    font-size: 12px;
                }

                .aih-button:hover {
                    background: #484b51;
                }

                .aih-summary {
                    display: flex;
                    gap: 18px;
                    padding: 12px 15px;
                    border-bottom: 1px solid #414348;
                    color: #c5c7ca;
                }

                .aih-summary strong {
                    color: #fff;
                    margin-left: 4px;
                }

                .aih-progress {
                    height: 3px;
                    background: #414348;
                }

                .aih-progress-bar {
                    height: 100%;
                    width: 0;
                    background: #54b8d2;
                    transition: width .2s ease;
                }

                .aih-list {
                    overflow-y: auto;
                    min-height: 80px;
                    max-height: 430px;
                }

                .aih-task {
                    padding: 10px 15px;
                    border-bottom: 1px solid #36383c;
                }

                .aih-task-top {
                    display: flex;
                    justify-content: space-between;
                    gap: 10px;
                    margin-bottom: 5px;
                }

                .aih-url {
                    min-width: 0;
                    overflow-wrap: anywhere;
                    color: #e5e5e5;
                }

                .aih-status {
                    flex-shrink: 0;
                    font-size: 11px;
                    color: #aeb2b8;
                }

                .aih-details {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 12px;
                    color: #969ba2;
                    font-size: 11px;
                }

                .aih-empty {
                    padding: 25px 15px;
                    text-align: center;
                    color: #aeb2b8;
                }

                .aih-minimized {
                    position: fixed;
                    right: 24px;
                    bottom: 24px;
                    width: 38px;
                    height: 38px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    pointer-events: auto;
                    border: 1px solid #55585e;
                    border-radius: 50%;
                    color: #fff;
                    background: #292b2f;
                    box-shadow: 0 3px 12px rgba(0,0,0,.4);
                    cursor: pointer;
                }

                .aih-spinner {
                    width: 19px;
                    height: 19px;
                    border: 2px solid #666;
                    border-top-color: #54c5df;
                    border-radius: 50%;
                    animation: aih-spin .8s linear infinite;
                }

                @keyframes aih-spin {
                    to { transform: rotate(360deg); }
                }

                [hidden] {
                    display: none !important;
                }
            `;

            this.shadow.appendChild(style);

            this.dialog = document.createElement("section");
            this.dialog.className = "aih-dialog";
            this.dialog.hidden = true;

            this.dialog.innerHTML = `
                <div class="aih-header">
                    <div class="aih-title">
                        Site Intelligence - Processing Queue
                    </div>

                    <div class="aih-header-actions">
                        <button
                            type="button"
                            class="aih-button"
                            data-action="minimize"
                        >Minimize</button>
                    </div>
                </div>

                <div class="aih-summary">
                    <span>Active: <strong data-count="active">0</strong></span>
                    <span>Queued: <strong data-count="queued">0</strong></span>
                    <span>Total: <strong data-count="total">0</strong></span>
                </div>

                <div class="aih-progress">
                    <div class="aih-progress-bar"></div>
                </div>

                <div class="aih-list"></div>
            `;

            this.minimizedButton =
                document.createElement("button");

            this.minimizedButton.type = "button";
            this.minimizedButton.className = "aih-minimized";
            this.minimizedButton.title =
                "Show Site Intelligence processing";

            this.minimizedButton.innerHTML = `
                <span class="aih-spinner"></span>
            `;

            this.minimizedButton.hidden = true;

            this.dialog
                .querySelector('[data-action="minimize"]')
                .addEventListener("click", () => {
                    this.minimize();
                });

            this.minimizedButton.addEventListener(
                "click",
                () => {
                    this.restore();
                }
            );

            this.shadow.appendChild(this.dialog);
            this.shadow.appendChild(this.minimizedButton);

            (document.body || document.documentElement)
                .appendChild(this.host);
        }

        // --------------------------------------------------
        // STATE
        // --------------------------------------------------

        update(snapshot) {
            if (!snapshot || this.destroyed) {
                return;
            }

            this.currentStatus = snapshot;

            const active = snapshot.activeTasks || [];
            const queued = snapshot.queuedTasks || [];

            const processing =
                snapshot.processing === true ||
                active.length > 0 ||
                queued.length > 0;

            if (!processing) {
                this.hide();
                return;
            }

            if (SiteIntelligenceDialog.preferredMode === "minimized") {
                this.showMinimized();
            } else {
                this.showDialog();
            }

            this.render(snapshot);
        }

        // --------------------------------------------------
        // DISPLAY MODES
        // --------------------------------------------------

        showDialog() {
            this.dialog.hidden = false;
            this.minimizedButton.hidden = true;
        }

        showMinimized() {
            this.dialog.hidden = true;
            this.minimizedButton.hidden = false;
        }

        minimize() {
            SiteIntelligenceDialog.preferredMode = "minimized";
            this.showMinimized();
        }

        restore() {
            SiteIntelligenceDialog.preferredMode = "open";
            this.showDialog();

            if (this.currentStatus) {
                this.render(this.currentStatus);
            }
        }

        hide() {
            this.dialog.hidden = true;
            this.minimizedButton.hidden = true;
        }

        // --------------------------------------------------
        // RENDERING
        // --------------------------------------------------

        render(snapshot) {
            const active = snapshot.activeTasks || [];
            const queued = snapshot.queuedTasks || [];
            const recent = snapshot.recentTasks || [];

            const activeCount = active.length;
            const queuedCount = queued.length;

            const total = activeCount + queuedCount;

            this.dialog.querySelector(
                '[data-count="active"]'
            ).textContent = activeCount;

            this.dialog.querySelector(
                '[data-count="queued"]'
            ).textContent = queuedCount;

            this.dialog.querySelector(
                '[data-count="total"]'
            ).textContent = total;

            const completed = recent.filter(
                task => task.status === "completed"
            ).length;

            const failed = recent.filter(
                task => task.status === "failed"
            ).length;

            const processed = completed + failed + total;

            const percentage = processed > 0
                ? Math.round(
                    ((completed + failed) / processed) * 100
                )
                : 0;

            this.dialog.querySelector(
                ".aih-progress-bar"
            ).style.width = percentage + "%";

            const list = this.dialog.querySelector(".aih-list");
            list.replaceChildren();

            const visibleTasks = [
                ...active,
                ...queued
            ];

            if (!visibleTasks.length) {
                const empty = document.createElement("div");
                empty.className = "aih-empty";
                empty.textContent = "No pending tasks.";
                list.appendChild(empty);
                return;
            }

            for (const task of visibleTasks) {
                list.appendChild(this.createTaskElement(task));
            }
        }

        createTaskElement(task) {
            const item = document.createElement("div");
            item.className = "aih-task";

            const top = document.createElement("div");
            top.className = "aih-task-top";

            const url = document.createElement("div");
            url.className = "aih-url";
            url.textContent = task.url || "Unknown resource";

            const status = document.createElement("div");
            status.className = "aih-status";
            status.textContent = task.status || "unknown";

            top.append(url, status);

            const details = document.createElement("div");
            details.className = "aih-details";

            const values = [
                task.method,
                task.phase,
                task.httpStatus
                    ? "HTTP " + task.httpStatus
                    : null,
                task.source
                    ? "Source: " + task.source
                    : null
            ].filter(Boolean);

            for (const value of values) {
                const span = document.createElement("span");
                span.textContent = value;
                details.appendChild(span);
            }

            item.append(top, details);

            if (task.error) {
                const error = document.createElement("div");
                error.className = "aih-details";
                error.style.color = "#e58b8b";
                error.style.marginTop = "5px";
                error.textContent = task.error;
                item.appendChild(error);
            }

            return item;
        }

        // --------------------------------------------------
        // SHUTDOWN
        // --------------------------------------------------

        destroy() {
            if (this.destroyed) {
                return;
            }

            this.destroyed = true;

            if (typeof this.unsubscribe === "function") {
                this.unsubscribe();
            }

            this.unsubscribe = null;
            this.service = null;
            this.currentStatus = null;

            if (this.host) {
                this.host.remove();
            }

            this.host = null;
            this.shadow = null;
            this.dialog = null;
            this.minimizedButton = null;
        }
    }

    root.AnonymousInspectorSiteIntelligenceDialog =
        SiteIntelligenceDialog;

})(globalThis);
