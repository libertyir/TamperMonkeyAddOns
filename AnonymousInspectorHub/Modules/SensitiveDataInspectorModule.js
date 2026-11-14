(function (Framework) {
    "use strict";

    class SensitiveDataInspectorModule extends Framework.BaseModule {
        static id = "SensitiveDataInspectorModule";
        static title = "Sensitive Data Inspector";
        static description = "Monitor the current page for exposed secrets and credentials";
        static icon = "🔐";
        static autoInitialize = true;

        constructor() {
            super();
            this.findingsByPage = new Map();
            this.observer = null;
            this.scanTimer = null;
            this.running = false;
            this.maxFindings = 500;
            this.maxTextLength = 2 * 1024 * 1024;
        }

        async init() {
            this.available = true;
            this.running = true;
            this.scanPage();
            this.observer = new MutationObserver(records => {
                const pageChanged = records.some(record => {
                    if (record.type === "characterData") {
                        return !record.target.parentElement?.closest(
                            "#aih-sensitive-inspector"
                        );
                    }
                    return [...record.addedNodes, ...record.removedNodes].some(node =>
                        !(node.nodeType === Node.ELEMENT_NODE &&
                            (node.matches("#aih-sensitive-inspector") ||
                                node.querySelector("#aih-sensitive-inspector")))
                    );
                });
                if (pageChanged) {
                    this.scheduleScan();
                }
            });
            this.observer.observe(document.documentElement, {
                subtree: true,
                childList: true,
                characterData: true
            });
            window.addEventListener("popstate", this.onNavigation);
            window.addEventListener("hashchange", this.onNavigation);
        }

        onNavigation = () => this.scheduleScan();

        scheduleScan() {
            if (!this.running) return;
            clearTimeout(this.scanTimer);
            this.scanTimer = setTimeout(() => this.scanPage(), 700);
        }

        scanPage() {
            if (!this.running || !document.documentElement) return;
            const pageUrl = location.href;
            let pageFindings = this.findingsByPage.get(pageUrl);
            if (!pageFindings) {
                pageFindings = new Map();
                this.findingsByPage.set(pageUrl, pageFindings);
            }

            const walker = document.createTreeWalker(
                document.documentElement,
                NodeFilter.SHOW_TEXT | NodeFilter.SHOW_COMMENT
            );
            let node;
            let scanned = 0;
            while ((node = walker.nextNode()) && scanned < this.maxTextLength) {
                if (node.parentElement?.closest("#aih-sensitive-inspector")) continue;
                const content = String(node.nodeValue || "");
                if (!content.trim()) continue;
                scanned += content.length;
                const source = node.nodeType === Node.COMMENT_NODE
                    ? "HTML comment"
                    : node.parentElement?.tagName === "SCRIPT"
                        ? "Inline script"
                        : node.parentElement?.tagName === "STYLE"
                            ? "Inline style"
                            : "Page text";
                this.inspectText(content, source, pageFindings);
                if (pageFindings.size >= this.maxFindings) break;
            }
            this.refreshPanel();
        }

        inspectText(text, source, findings) {
            const rules = [
                { type: "Private key", regex: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----[\s\S]{20,4096}?-----END (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g },
                { type: "GitHub token", regex: /\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g },
                { type: "AWS access key", regex: /\bAKIA[0-9A-Z]{16}\b/g },
                { type: "Slack token", regex: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/g },
                { type: "Stripe secret key", regex: /\b(?:sk_live|rk_live)_[A-Za-z0-9]{16,}\b/g },
                { type: "JWT", regex: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g },
                { type: "Credential assignment", regex: /\b(?:password|passwd|secret|client_secret|api[_-]?key|access[_-]?token|auth[_-]?token)\b\s*[:=]\s*["']?([^\s"'<>;,]{8,})/gi, group: 1 }
            ];

            for (const rule of rules) {
                rule.regex.lastIndex = 0;
                let match;
                while ((match = rule.regex.exec(text)) !== null) {
                    const value = match[rule.group || 0];
                    if (!value || value.length < 8 || value.length > 8192) continue;
                    const key = rule.type + "\0" + value;
                    if (!findings.has(key)) {
                        findings.set(key, {
                            type: rule.type,
                            source,
                            value,
                            foundAt: new Date().toISOString()
                        });
                    }
                    if (!match[0].length) rule.regex.lastIndex++;
                }
            }
        }

        render() {
            const root = Framework.createElement("section", {
                id: "aih-sensitive-inspector",
                style: "color:#ddd;font:13px sans-serif;max-height:70vh;overflow:auto"
            });
            const header = Framework.createElement("div", {
                style: "display:flex;align-items:center;gap:10px;position:sticky;top:0;background:#181818;padding:10px;z-index:2"
            });
            const state = Framework.createElement("span");
            state.textContent = this.running ? "Monitoring current page" : "Monitoring paused";
            const toggle = Framework.createElement("button", {
                type: "button",
                textContent: this.running ? "Stop monitoring" : "Resume monitoring"
            });
            toggle.addEventListener("click", () => {
                if (this.running) this.stopMonitoring();
                else this.startMonitoring();
                state.textContent = this.running ? "Monitoring current page" : "Monitoring paused";
                toggle.textContent = this.running ? "Stop monitoring" : "Resume monitoring";
                this.refreshPanel();
            });
            const clear = Framework.createElement("button", {
                type: "button",
                textContent: "Clear results"
            });
            clear.addEventListener("click", () => {
                this.findingsByPage.clear();
                this.refreshPanel();
                if (this.running) this.scanPage();
            });
            header.append(state, toggle, clear);
            root.appendChild(header);

            const total = [...this.findingsByPage.values()]
                .reduce((sum, records) => sum + records.size, 0);
            const summary = Framework.createElement("p", {
                textContent: total
                    ? total + " sensitive finding(s). Values are hidden until clicked."
                    : "No matching secrets or credentials found on this page yet."
            });
            summary.style.padding = "0 10px";
            root.appendChild(summary);

            for (const [pageUrl, records] of [...this.findingsByPage.entries()].reverse()) {
                const group = Framework.createElement("details", {
                    open: pageUrl === location.href
                });
                group.style.cssText = "margin:8px;border:1px solid #444;border-radius:5px;padding:8px;overflow-wrap:anywhere";
                const title = Framework.createElement("summary", {
                    textContent: pageUrl + " · " + records.size + " finding(s)"
                });
                group.appendChild(title);

                for (const finding of records.values()) {
                    const row = Framework.createElement("div", {
                        style: "padding:9px;margin:8px 0;background:#202020;border-radius:4px"
                    });
                    const meta = Framework.createElement("div", {
                        textContent: finding.type + " · " + finding.source
                    });
                    const value = Framework.createElement("code", {
                        textContent: this.maskValue(finding.value),
                        style: "display:block;margin-top:6px;white-space:pre-wrap;overflow-wrap:anywhere"
                    });
                    const reveal = Framework.createElement("button", {
                        type: "button",
                        textContent: "Reveal"
                    });
                    reveal.style.marginTop = "6px";
                    reveal.addEventListener("click", () => {
                        const showing = reveal.textContent === "Hide";
                        value.textContent = showing
                            ? this.maskValue(finding.value)
                            : finding.value;
                        reveal.textContent = showing ? "Reveal" : "Hide";
                    });
                    row.append(meta, value, reveal);
                    group.appendChild(row);
                }
                root.appendChild(group);
            }
            this.panelRoot = root;
            return root;
        }

        maskValue(value) {
            if (value.length <= 12) return "•".repeat(value.length);
            return value.slice(0, 4) + "•".repeat(Math.min(24, value.length - 8)) + value.slice(-4);
        }

        refreshPanel() {
            if (!this.panelRoot?.isConnected) return;
            const fresh = this.render();
            this.panelRoot.replaceWith(fresh);
            this.panelRoot = fresh;
        }

        startMonitoring() {
            if (this.running) return;
            this.running = true;
            this.scanPage();
            this.observer?.observe(document.documentElement, {
                subtree: true,
                childList: true,
                characterData: true
            });
        }

        stopMonitoring() {
            this.running = false;
            clearTimeout(this.scanTimer);
            this.observer?.disconnect();
        }

        destroy() {
            this.stopMonitoring();
            window.removeEventListener("popstate", this.onNavigation);
            window.removeEventListener("hashchange", this.onNavigation);
            this.findingsByPage.clear();
        }
    }

    Framework.register(SensitiveDataInspectorModule.id, SensitiveDataInspectorModule);
})(Framework);
