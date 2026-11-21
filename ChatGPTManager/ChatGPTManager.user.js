// ==UserScript==
// @name         ChatGPT Manager
// @namespace    https://github.com/libertyir/TamperMonkeyAddOns
// @version      0.3.0
// @description  In-page ChatGPT manager dialog with conversation and project tools
// @match        https://chatgpt.com/*
// @match        https://chat.openai.com/*
// @run-at       document-idle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @connect      libertyir.github.io
// ==/UserScript==

(function () {
  "use strict";

  const BASE_URL = "https://libertyir.github.io/TamperMonkeyAddOns/ChatGPTManager/";
  const VERSION = "0.3.0";
  let host = null;
  let shadow = null;
  let closed = false;

  function requestText(url) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: "GET",
        url: url + (url.includes("?") ? "&" : "?") + "v=" + VERSION,
        onload: response => response.status >= 200 && response.status < 300
          ? resolve(response.responseText)
          : reject(new Error("HTTP " + response.status + " while loading " + url)),
        onerror: () => reject(new Error("Could not load " + url))
      });
    });
  }

  function createShell() {
    host = document.createElement("div");
    host.id = "cgm-host";
    shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <style>
        :host{all:initial}
        .cgm-backdrop{position:fixed;inset:0;z-index:2147483646;background:#0009;display:grid;place-items:center;padding:3vh 3vw}
        .cgm-dialog{position:relative;width:min(1500px,96vw);height:min(940px,94vh);background:#171717;border:1px solid #555;border-radius:16px;overflow:hidden;box-shadow:0 20px 80px #0009;display:flex;flex-direction:column}
        .cgm-titlebar{height:38px;flex:none;background:#222;display:flex;align-items:center;justify-content:space-between;padding:0 12px;color:#eee;font:13px system-ui}
        .cgm-close{border:0;background:transparent;color:#ddd;font-size:24px;cursor:pointer;line-height:1}
        #cgm-app{height:calc(100% - 38px);min-height:0;overflow:hidden}
        .cgm-load-error{padding:24px;color:#eee;font:14px/1.7 system-ui;direction:rtl}
        .cgm-load-error button{margin-top:12px;padding:8px 16px;border:1px solid #777;border-radius:8px;background:#333;color:#fff;cursor:pointer}
        @media(max-width:700px){.cgm-backdrop{padding:0}.cgm-dialog{width:100vw;height:100vh;border-radius:0}}
      </style>
      <div class="cgm-backdrop">
        <section class="cgm-dialog" role="dialog" aria-modal="true" aria-label="ChatGPT Manager">
          <header class="cgm-titlebar"><span>ChatGPT Manager</span><button class="cgm-close" aria-label="Close">×</button></header>
          <div id="cgm-app"><div class="cgm-load-error">در حال بارگذاری ChatGPT Manager…</div></div>
        </section>
      </div>`;
    shadow.querySelector(".cgm-close").addEventListener("click", closeDialog);
    shadow.querySelector(".cgm-backdrop").addEventListener("click", event => {
      if (event.target.classList.contains("cgm-backdrop")) closeDialog();
    });
    document.addEventListener("keydown", onKeydown, true);
    document.documentElement.appendChild(host);
  }

  function onKeydown(event) {
    if (event.key === "Escape" && host) {
      event.stopPropagation();
      closeDialog();
    }
  }

  function closeDialog() {
    closed = true;
    host?.remove();
    host = null;
    shadow = null;
    delete globalThis.__CGM_ROOT__;
    delete globalThis.__CGM_HOST__;
    delete globalThis.__CGM_BRIDGE__;
    document.removeEventListener("keydown", onKeydown, true);
  }

  async function api(path, options = {}) {
    const response = await fetch("/backend-api" + path, {
      credentials: "include",
      headers: { "Accept": "application/json", "Content-Type": "application/json", ...(options.headers || {}) },
      ...options
    });
    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!response.ok) {
      throw new Error(data?.detail?.message || data?.message || data?.error || `HTTP ${response.status}: ${response.statusText}`);
    }
    return data;
  }

  async function listConversations({ archived = false, offset = 0, limit = 28 } = {}) {
    const query = new URLSearchParams({ offset: String(offset), limit: String(limit), order: "updated" });
    if (archived) query.set("is_archived", "true");
    return api("/conversations?" + query);
  }

  const operations = {
    "storage.get": ({ key }) => GM_getValue(key, null),
    "storage.set": ({ key, value }) => GM_setValue(key, value),
    "api.conversations": params => listConversations(params),
    "api.projects": () => api("/gizmos/snorlax/sidebar?owned_only=true&conversations_per_gizmo=0"),
    "api.projectConversations": ({ projectId }) => api(`/gizmos/${encodeURIComponent(projectId)}/conversations?cursor=0`),
    "api.conversation": ({ id }) => api("/conversation/" + encodeURIComponent(id)),
    "api.archive": ({ id, archived }) => api("/conversation/" + encodeURIComponent(id), {
      method: "PATCH", body: JSON.stringify({ is_archived: archived })
    }),
    "api.deleteConversation": ({ id }) => api("/conversation/" + encodeURIComponent(id), {
      method: "PATCH", body: JSON.stringify({ is_visible: false })
    }),
    "api.renameConversation": ({ id, title }) => api("/conversation/id/" + encodeURIComponent(id) + "/rename", {
      method: "POST", body: JSON.stringify({ title })
    }),
    "api.moveConversation": ({ id, projectId }) => api("/conversation/" + encodeURIComponent(id), {
      method: "PATCH", body: JSON.stringify({ gizmo_id: projectId })
    }),
    "api.createProject": ({ name }) => api("/projects", {
      method: "POST", body: JSON.stringify({ name, instructions: "", memory_scope: "unset" })
    }),
    "api.renameProject": ({ id, name }) => api("/projects/" + encodeURIComponent(id), {
      method: "PATCH", body: JSON.stringify({ name })
    }),
    "api.deleteProject": ({ id }) => api("/gizmos/" + encodeURIComponent(id), { method: "DELETE" }),
    "api.sendMessage": () => {
      throw new Error("ارسال پیام هنوز به جریان بومی ارسال ChatGPT متصل نشده است.");
    }
  };

  async function loadApplication() {
    const html = await requestText(BASE_URL + "Index.html");
    const parsed = new DOMParser().parseFromString(html, "text/html");
    const stylesheet = parsed.querySelector('link[rel="stylesheet"]')?.getAttribute("href");
    const modulePath = parsed.querySelector('script[type="module"]')?.getAttribute("src");
    const appMarkup = parsed.querySelector("#app")?.outerHTML;
    if (!stylesheet || !modulePath || !appMarkup) throw new Error("Index.html is missing app, stylesheet, or module entry.");

    const cssUrl = new URL(stylesheet, BASE_URL).href;
    const moduleUrl = new URL(modulePath, BASE_URL).href;
    const css = await requestText(cssUrl);
    if (closed || !shadow) return;

    const style = document.createElement("style");
    style.textContent = css;
    shadow.appendChild(style);
    const appHost = shadow.querySelector("#cgm-app");
    appHost.innerHTML = appMarkup;
    globalThis.__CGM_ROOT__ = shadow;
    globalThis.__CGM_HOST__ = host;
    globalThis.__CGM_BRIDGE__ = {
      connected: true,
      request: async (action, params = {}) => {
        if (action === "ui.close") return closeDialog();
        const operation = operations[action];
        if (!operation) throw new Error("Unknown manager operation: " + action);
        return operation(params);
      }
    };
    await import(moduleUrl + "?v=" + VERSION);
  }

  async function openDialog() {
    if (host) return;
    closed = false;
    createShell();
    try {
      await loadApplication();
    } catch (error) {
      if (!shadow) return;
      const app = shadow.querySelector("#cgm-app");
      app.innerHTML = `<div class="cgm-load-error"><strong>بارگذاری برنامه ناموفق بود</strong><br>${String(error.message || error)}<br>صفحه را Refresh کن یا خطای Console را بررسی کن.<br><button type="button">بستن</button></div>`;
      app.querySelector("button").addEventListener("click", closeDialog);
      console.error("[ChatGPT Manager] Bootstrap failed:", error);
    }
  }

  GM_registerMenuCommand("✳ ChatGPT Manager", openDialog, { accessKey: "m" });
})();
