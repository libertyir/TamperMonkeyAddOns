// ==UserScript==
// @name         ChatGPT Manager
// @namespace    https://github.com/libertyir/TamperMonkeyAddOns
// @version      0.4.0
// @description  Independent ChatGPT manager available from the Tampermonkey menu
// @match        *://*/*
// @run-at       document-idle
// @noframes
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @connect      libertyir.github.io
// @connect      chatgpt.com
// @connect      chat.openai.com
// ==/UserScript==

(function () {
  "use strict";

  const APP_URL = "https://libertyir.github.io/TamperMonkeyAddOns/ChatGPTManager/";
  const VERSION = "0.4.0";
  const CHANNEL = "cgm:page-bridge:v1";
  const MANAGER_HOST = "libertyir.github.io";
  const MANAGER_PATH = "/TamperMonkeyAddOns/ChatGPTManager/Index.html";
  let dialogHost = null;
  let shadowRoot = null;
  let dialogClosed = true;

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

  function requestChatGPT(path, options = {}) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: options.method || "GET",
        url: "https://chatgpt.com/backend-api" + path,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...(options.headers || {})
        },
        data: options.body,
        withCredentials: true,
        onload: response => {
          let data = null;
          try { data = response.responseText ? JSON.parse(response.responseText) : null; }
          catch { data = response.responseText; }
          if (response.status >= 200 && response.status < 300) resolve(data);
          else reject(new Error(data?.detail?.message || data?.message || data?.error ||
            "ChatGPT request failed: HTTP " + response.status));
        },
        onerror: () => reject(new Error("ارتباط با chatgpt.com برقرار نشد؛ دسترسی شبکه یا نشست حساب را بررسی کن."))
      });
    });
  }

  function listConversations({ archived = false, offset = 0, limit = 28 } = {}) {
    const query = new URLSearchParams({ offset: String(offset), limit: String(limit), order: "updated" });
    if (archived) query.set("is_archived", "true");
    return requestChatGPT("/conversations?" + query);
  }

  const operations = {
    "storage.get": ({ key }) => GM_getValue(key, null),
    "storage.set": ({ key, value }) => GM_setValue(key, value),
    "api.conversations": params => listConversations(params),
    "api.projects": () => requestChatGPT("/gizmos/snorlax/sidebar?owned_only=true&conversations_per_gizmo=0"),
    "api.projectConversations": ({ projectId }) => requestChatGPT("/gizmos/" + encodeURIComponent(projectId) + "/conversations?cursor=0"),
    "api.conversation": ({ id }) => requestChatGPT("/conversation/" + encodeURIComponent(id)),
    "api.archive": ({ id, archived }) => requestChatGPT("/conversation/" + encodeURIComponent(id), {
      method: "PATCH", body: JSON.stringify({ is_archived: archived })
    }),
    "api.deleteConversation": ({ id }) => requestChatGPT("/conversation/" + encodeURIComponent(id), {
      method: "PATCH", body: JSON.stringify({ is_visible: false })
    }),
    "api.renameConversation": ({ id, title }) => requestChatGPT("/conversation/id/" + encodeURIComponent(id) + "/rename", {
      method: "POST", body: JSON.stringify({ title })
    }),
    "api.moveConversation": ({ id, projectId }) => requestChatGPT("/conversation/" + encodeURIComponent(id), {
      method: "PATCH", body: JSON.stringify({ gizmo_id: projectId })
    }),
    "api.createProject": ({ name }) => requestChatGPT("/projects", {
      method: "POST", body: JSON.stringify({ name, instructions: "", memory_scope: "unset" })
    }),
    "api.renameProject": ({ id, name }) => requestChatGPT("/projects/" + encodeURIComponent(id), {
      method: "PATCH", body: JSON.stringify({ name })
    }),
    "api.deleteProject": ({ id }) => requestChatGPT("/gizmos/" + encodeURIComponent(id), { method: "DELETE" }),
    "api.sendMessage": () => {
      throw new Error("ارسال پیام هنوز به جریان ارسال امن و استریم بومی ChatGPT متصل نشده است.");
    }
  };

  function handleBridgeRequest(event) {
    const message = event.data;
    if (event.source !== window || event.origin !== location.origin ||
        !message || message.channel !== CHANNEL) return;
    if (message.type === "hello") {
      window.postMessage({ channel: CHANNEL, type: "ready" }, location.origin);
      return;
    }
    if (message.type !== "request") return;
    const operation = operations[message.action];
    if (!operation) {
      window.postMessage({ channel: CHANNEL, type: "response", id: message.id, error: "Unknown action" }, location.origin);
      return;
    }
    Promise.resolve().then(() => operation(message.params || {}))
      .then(result => window.postMessage({ channel: CHANNEL, type: "response", id: message.id, result }, location.origin))
      .catch(error => window.postMessage({
        channel: CHANNEL, type: "response", id: message.id, error: error?.message || String(error)
      }, location.origin));
  }

  function installStandaloneBridge() {
    if (location.hostname !== MANAGER_HOST || location.pathname !== MANAGER_PATH) return;
    window.addEventListener("message", handleBridgeRequest);
    window.postMessage({ channel: CHANNEL, type: "ready" }, location.origin);
  }

  function createDialog() {
    dialogHost = document.createElement("div");
    dialogHost.id = "cgm-dialog-host";
    shadowRoot = dialogHost.attachShadow({ mode: "open" });
    shadowRoot.innerHTML = `
      <style>
        :host{all:initial}
        .backdrop{position:fixed;inset:0;z-index:2147483646;background:#0009;display:grid;place-items:center;padding:3vh 3vw}
        .dialog{width:min(1500px,96vw);height:min(940px,94vh);background:#171717;border:1px solid #555;border-radius:16px;overflow:hidden;box-shadow:0 20px 80px #0009;display:flex;flex-direction:column}
        .titlebar{height:38px;flex:none;background:#222;display:flex;align-items:center;justify-content:space-between;padding:0 12px;color:#eee;font:13px system-ui}
        .close{border:0;background:transparent;color:#ddd;font-size:24px;cursor:pointer}
        #cgm-app{height:calc(100% - 38px);min-height:0;overflow:hidden}
        .error{padding:24px;color:#eee;font:14px/1.7 system-ui;direction:rtl;overflow:auto}
        .error button{margin-top:12px;padding:8px 16px;border:1px solid #777;border-radius:8px;background:#333;color:#fff;cursor:pointer}
        @media(max-width:700px){.backdrop{padding:0}.dialog{width:100vw;height:100vh;border-radius:0}}
      </style>
      <div class="backdrop"><section class="dialog" role="dialog" aria-modal="true" aria-label="ChatGPT Manager">
        <header class="titlebar"><span>ChatGPT Manager</span><button class="close" aria-label="Close">×</button></header>
        <div id="cgm-app"><div class="error">در حال بارگذاری…</div></div>
      </section></div>`;
    shadowRoot.querySelector(".close").addEventListener("click", closeDialog);
    shadowRoot.querySelector(".backdrop").addEventListener("click", event => {
      if (event.target.classList.contains("backdrop")) closeDialog();
    });
    document.addEventListener("keydown", onKeydown, true);
    document.documentElement.appendChild(dialogHost);
  }

  function onKeydown(event) {
    if (event.key === "Escape" && dialogHost) {
      event.stopPropagation();
      closeDialog();
    }
  }

  function closeDialog() {
    dialogClosed = true;
    dialogHost?.remove();
    dialogHost = null;
    shadowRoot = null;
    delete globalThis.__CGM_ROOT__;
    delete globalThis.__CGM_BRIDGE__;
    document.removeEventListener("keydown", onKeydown, true);
  }

  async function loadDialogApplication() {
    const html = await requestText(APP_URL + "Index.html");
    const parsed = new DOMParser().parseFromString(html, "text/html");
    const cssPath = parsed.querySelector('link[rel="stylesheet"]')?.getAttribute("href");
    const modulePath = parsed.querySelector('script[type="module"]')?.getAttribute("src");
    const appMarkup = parsed.querySelector("#app")?.outerHTML;
    if (!cssPath || !modulePath || !appMarkup) throw new Error("Index.html فاقد #app یا فایل CSS یا ورودی ماژول است.");
    const css = await requestText(new URL(cssPath, APP_URL).href);
    if (dialogClosed || !shadowRoot) return;
    const style = document.createElement("style");
    style.textContent = css;
    shadowRoot.appendChild(style);
    shadowRoot.querySelector("#cgm-app").innerHTML = appMarkup;
    globalThis.__CGM_ROOT__ = shadowRoot;
    globalThis.__CGM_BRIDGE__ = {
      connected: true,
      request: async (action, params = {}) => {
        if (action === "ui.close") return closeDialog();
        const operation = operations[action];
        if (!operation) throw new Error("Unknown manager operation: " + action);
        return operation(params);
      }
    };
    await import(new URL(modulePath, APP_URL).href + "?v=" + VERSION);
  }

  async function openDialog() {
    if (dialogHost) return;
    dialogClosed = false;
    createDialog();
    try { await loadDialogApplication(); }
    catch (error) {
      if (!shadowRoot) return;
      const target = shadowRoot.querySelector("#cgm-app");
      target.innerHTML = '<div class="error"><strong>بارگذاری برنامه ناموفق بود</strong><br>' +
        String(error?.message || error) + '<br><button type="button">بستن</button></div>';
      target.querySelector("button").addEventListener("click", closeDialog);
      console.error("[ChatGPT Manager] Bootstrap failed:", error);
    }
  }

  installStandaloneBridge();
  GM_registerMenuCommand("ChatGPT Manager", openDialog, { accessKey: "m" });
})();
