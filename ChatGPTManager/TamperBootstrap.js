function ChatGPTManagerBootstrap() {
  "use strict";

  const APP_URL = "https://libertyir.github.io/TamperMonkeyAddOns/ChatGPTManager/";
  const VERSION = "0.6.6";
  const CHANNEL = "cgm:page-bridge:v1";
  const MANAGER_HOST = "libertyir.github.io";
  const MANAGER_PATH = "/TamperMonkeyAddOns/ChatGPTManager/Index.html";
  let dialogHost = null;
  let shadowRoot = null;
  let dialogClosed = true;
  let dialogGeneration = 0;

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

  const BROKER_PREFIX = "cgm:broker:v1:";
  const BROKER_HEARTBEAT_PREFIX = BROKER_PREFIX + "heartbeat:";
  const BROKER_REQUEST_PREFIX = BROKER_PREFIX + "request:";
  const BROKER_RESPONSE_PREFIX = BROKER_PREFIX + "response:";
  const BROKER_ID = "broker-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
  const BROKER_HEARTBEAT = BROKER_HEARTBEAT_PREFIX + BROKER_ID;
  const MANAGER_CLIENT_ID = "client-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
  const chatGPTHostname = location.hostname.toLowerCase();
  const isChatGPTTab = chatGPTHostname === "chatgpt.com" || chatGPTHostname.endsWith(".chatgpt.com") || chatGPTHostname === "chat.openai.com" || chatGPTHostname.endsWith(".chat.openai.com");
  let sessionCache = null;
  let sessionExpiresAt = 0;
  let backendApiAvailable = null;
  let authBlocked = false;
  let authBlockReason = "";

  function requireReconnect(reason) {
    authBlocked = true;
    authBlockReason = reason || "نشست ChatGPT معتبر نیست. از منوی Tampermonkey اتصال مجدد را اجرا کن.";
    sessionCache = null;
    sessionExpiresAt = 0;
    backendApiAvailable = false;
    if (isChatGPTTab) GM_setValue(BROKER_HEARTBEAT, { id: BROKER_ID, timestamp: Date.now(), authRequired: true, reason: authBlockReason });
    return new Error(authBlockReason);
  }

  async function requestJson(url, options = {}) {
    const pageWindow = typeof unsafeWindow !== "undefined" ? unsafeWindow : window;
    const response = await pageWindow.fetch(url, {
      method: options.method || "GET",
      headers: options.headers || { Accept: "application/json" },
      body: options.body,
      credentials: "include",
      cache: "no-store"
    });
    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = null; }
    return { status: response.status, data };
  }

  async function getAccountSession(force = false) {
    if (authBlocked) throw new Error(authBlockReason);
    if (!force && sessionCache && Date.now() < sessionExpiresAt) return sessionCache;
    const response = await requestJson("/api/auth/session");
    if (response.status === 401 || response.status === 403) throw requireReconnect("نشست ChatGPT رد شد (HTTP " + response.status + "). درخواست‌ها متوقف شدند؛ از منوی Tampermonkey اتصال مجدد را اجرا کن.");
    if (response.status < 200 || response.status >= 300) throw new Error("بررسی نشست ناموفق بود: HTTP " + response.status);
    const data = response.data || {};
    sessionCache = typeof data.accessToken === "string" && data.accessToken
      ? { accessToken: data.accessToken, user: data.user || null }
      : null;
    if (!sessionCache) throw requireReconnect("نشست معتبر ChatGPT پیدا نشد. ابتدا وارد chatgpt.com شو و سپس از منوی Tampermonkey اتصال مجدد را اجرا کن.");
    sessionExpiresAt = Date.now() + 2 * 60 * 1000;
    return sessionCache;
  }

  async function getAuthStatus() {
    if (authBlocked) return { bridgeConnected: true, brokerConnected: true, accountAuthenticated: false, authRequired: true, error: authBlockReason, apiAvailable: false };
    try {
      const session = await getAccountSession(true);
      return { bridgeConnected: true, brokerConnected: true, accountAuthenticated: Boolean(session.accessToken), authRequired: false, apiAvailable: backendApiAvailable, user: session.user ? { name: session.user.name || null } : null };
    } catch (error) {
      return { bridgeConnected: true, brokerConnected: true, accountAuthenticated: false, authRequired: authBlocked, error: error.message, apiAvailable: false };
    }
  }

  async function requestChatGPT(path, options = {}) {
    if (authBlocked) throw new Error(authBlockReason);
    const session = await getAccountSession();
    const response = await requestJson("/backend-api" + path, {
      method: options.method || "GET",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: "Bearer " + session.accessToken,
        ...(options.headers || {})
      },
      body: options.body
    });
    if (response.status === 401 || response.status === 403) {
      throw requireReconnect("ChatGPT دسترسی نشست را رد کرد (HTTP " + response.status + "). همه درخواست‌ها متوقف شدند؛ از منوی Tampermonkey اتصال مجدد را اجرا کن.");
    }
    if (response.status === 429) throw new Error("ChatGPT محدودیت نرخ درخواست اعمال کرد (429). عملیات متوقف شد؛ بعداً دستی دوباره تلاش کن.");
    if (response.status >= 200 && response.status < 300) {
      backendApiAvailable = true;
      return response.data;
    }
    const data = response.data;
    throw new Error(data?.detail?.message || data?.message || data?.error || "ChatGPT request failed: HTTP " + response.status);
  }

  function getBrokerStatus() {
    const brokers = GM_listValues()
      .filter(key => key.startsWith(BROKER_HEARTBEAT_PREFIX))
      .map(key => GM_getValue(key, null))
      .filter(item => item && Date.now() - item.timestamp < 20000)
      .sort((a, b) => b.timestamp - a.timestamp);
    const broker = brokers[0] || null;
    if (broker?.authRequired) throw new Error(broker.reason || "نشست ChatGPT نیاز به اتصال مجدد دارد.");
    return broker;
  }

  let brokerRequestQueue = Promise.resolve();
  function requestBroker(action, params = {}) {
    if (authBlocked) return Promise.reject(new Error(authBlockReason));
    const execute = () => {
      if (isChatGPTTab) {
        if (authBlocked) throw new Error(authBlockReason);
        return Promise.resolve().then(() => chatGPTOperations[action](params));
      }
      const broker = getBrokerStatus();
      if (!broker) throw new Error("تب فعال chatgpt.com پیدا نشد. ChatGPT را در یک تب دیگر باز و وارد حساب شو؛ Manager را می‌توانی همین‌جا نگه داری.");
      return new Promise((resolve, reject) => {
        const id = MANAGER_CLIENT_ID + "-" + Math.random().toString(36).slice(2);
        const requestKey = BROKER_REQUEST_PREFIX + broker.id + ":" + MANAGER_CLIENT_ID;
        const responseKey = BROKER_RESPONSE_PREFIX + id;
        let settled = false;
        const finish = (error, result) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          GM_removeValueChangeListener(listener);
          GM_deleteValue(responseKey);
          GM_deleteValue(requestKey);
          error ? reject(new Error(error)) : resolve(result);
        };
        const listener = GM_addValueChangeListener(responseKey, (_key, _oldValue, value) => {
          if (value && value.id === id) finish(value.error, value.result);
        });
        const timer = setTimeout(() => finish("پاسخی از تب ChatGPT دریافت نشد. تب را باز نگه دار و دوباره تلاش کن."), 30000);
        GM_setValue(requestKey, { id, target: broker.id, action, params, timestamp: Date.now() });
      });
    };
    const task = brokerRequestQueue.then(execute, execute);
    brokerRequestQueue = task.catch(() => {});
    return task;
  }
  const chatGPTOperations = {
    "api.authStatus": () => getAuthStatus(),
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

  function installChatGPTBroker() {
    if (!isChatGPTTab) return;
    GM_setValue(BROKER_HEARTBEAT, { id: BROKER_ID, timestamp: Date.now(), authRequired: false });
    setInterval(() => GM_setValue(BROKER_HEARTBEAT, { id: BROKER_ID, timestamp: Date.now(), authRequired: authBlocked, reason: authBlockReason }), 5000);
    const handled = new Set();
    const processRequests = () => {
      GM_listValues().filter(key => key.startsWith(BROKER_REQUEST_PREFIX + BROKER_ID + ":"))
        .forEach(key => {
          const request = GM_getValue(key, null);
          if (!request || request.target !== BROKER_ID || !request.id || handled.has(request.id)) return;
          handled.add(request.id);
          const action = chatGPTOperations[request.action];
          const task = action
            ? Promise.resolve().then(() => action(request.params || {}))
            : Promise.reject(new Error("Unknown broker operation"));
          task.then(result => GM_setValue(BROKER_RESPONSE_PREFIX + request.id, { id: request.id, result }))
            .catch(error => GM_setValue(BROKER_RESPONSE_PREFIX + request.id, {
              id: request.id, error: error?.message || String(error)
            }))
            .finally(() => {
              GM_deleteValue(key);
              handled.delete(request.id);
            });
        });
    };
    setInterval(processRequests, 250);
    processRequests();
  }

  function listConversations({ archived = false, offset = 0, limit = 28 } = {}) {
    const query = new URLSearchParams({ offset: String(offset), limit: String(limit), order: "updated" });
    if (archived) query.set("is_archived", "true");
    return requestChatGPT("/conversations?" + query);
  }

  const operations = {
    "storage.get": ({ key }) => GM_getValue(key, null),
    "storage.set": ({ key, value }) => GM_setValue(key, value),
    "ui.close": () => closeDialog(),
    "api.authStatus": params => requestBroker("api.authStatus", params),
    "api.conversations": params => requestBroker("api.conversations", params),
    "api.projects": params => requestBroker("api.projects", params),
    "api.projectConversations": params => requestBroker("api.projectConversations", params),
    "api.conversation": params => requestBroker("api.conversation", params),
    "api.archive": params => requestBroker("api.archive", params),
    "api.deleteConversation": params => requestBroker("api.deleteConversation", params),
    "api.renameConversation": params => requestBroker("api.renameConversation", params),
    "api.moveConversation": params => requestBroker("api.moveConversation", params),
    "api.createProject": params => requestBroker("api.createProject", params),
    "api.renameProject": params => requestBroker("api.renameProject", params),
    "api.deleteProject": params => requestBroker("api.deleteProject", params),
    "api.sendMessage": params => requestBroker("api.sendMessage", params)
  };

  function handleBridgeRequest(event) {
    const message = event.data;
    const standalonePage = location.hostname === MANAGER_HOST && location.pathname.toLowerCase() === MANAGER_PATH.toLowerCase();
    if ((!standalonePage && !dialogHost) || event.origin !== location.origin ||
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

  function installBridge() {
    window.addEventListener("message", handleBridgeRequest);
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
    dialogGeneration++;
    dialogHost?.remove();
    dialogHost = null;
    shadowRoot = null;
    delete globalThis.__CGM_ROOT__;
    delete globalThis.__CGM_BRIDGE__;
    document.removeEventListener("keydown", onKeydown, true);
  }

  async function loadDialogApplication(generation) {
    const html = await requestText(APP_URL + "Index.html");
    if (dialogClosed || generation !== dialogGeneration || !shadowRoot) return;
    const parsed = new DOMParser().parseFromString(html, "text/html");
    const cssPath = parsed.querySelector('link[rel="stylesheet"]')?.getAttribute("href");
    const modulePath = parsed.querySelector('script[type="module"]')?.getAttribute("src");
    const appMarkup = parsed.querySelector("#app")?.outerHTML;
    if (!cssPath || !modulePath || !appMarkup) throw new Error("Index.html فاقد #app یا فایل CSS یا ورودی ماژول است.");
    const css = await requestText(new URL(cssPath, APP_URL).href);
    if (dialogClosed || generation !== dialogGeneration || !shadowRoot) return;
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
    await loadModuleGraph(new URL(modulePath, APP_URL).href, () => !dialogClosed && generation === dialogGeneration && Boolean(shadowRoot));
  }

  async function loadModuleGraph(entryUrl, isCurrent) {
    const moduleUrls = new Map();
    const loading = new Map();

    async function loadModule(url) {
      if (moduleUrls.has(url)) return moduleUrls.get(url);
      if (loading.has(url)) return loading.get(url);

      const task = (async () => {
        let source = await requestText(url);
        const imports = [];
        const pattern = /(\b(?:import|export)\s+(?:[^"'\x60;]*?\s+from\s*)?)["']([^"']+)["']/g;
        let match;

        while ((match = pattern.exec(source))) {
          const specifier = match[2];
          if (!specifier.startsWith(".")) throw new Error("وابستگی نامعتبر در ماژول: " + specifier);
          imports.push({ start: match.index + match[1].length, end: match.index + match[1].length + specifier.length + 2, url: new URL(specifier, url).href, quote: match[0].slice(-1) });
        }

        const replacements = await Promise.all(imports.map(async item => ({
          ...item,
          blobUrl: await loadModule(item.url)
        })));

        for (const item of replacements.sort((a, b) => b.start - a.start)) {
          source = source.slice(0, item.start) + item.quote + item.blobUrl + item.quote + source.slice(item.end);
        }

        const blobUrl = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
        moduleUrls.set(url, blobUrl);
        return blobUrl;
      })();

      loading.set(url, task);
      try { return await task; }
      finally { loading.delete(url); }
    }

    const entryBlob = await loadModule(entryUrl);
    try {
      if (!isCurrent()) return;
      await import(entryBlob);
    } finally {
      moduleUrls.forEach(url => URL.revokeObjectURL(url));
      moduleUrls.clear();
    }
  }

  async function openDialog() {
    if (dialogHost) return;
    dialogClosed = false;
    const generation = ++dialogGeneration;
    createDialog();
    try { await loadDialogApplication(generation); }
    catch (error) {
      if (!shadowRoot) return;
      const target = shadowRoot.querySelector("#cgm-app");
      target.innerHTML = '<div class="error"><strong>بارگذاری برنامه ناموفق بود</strong><br>' +
        String(error?.message || error) + '<br><button type="button">بستن</button></div>';
      target.querySelector("button").addEventListener("click", closeDialog);
      console.error("[ChatGPT Manager] Bootstrap failed:", error);
    }
  }

  installBridge();
  installChatGPTBroker();
  GM_registerMenuCommand("ChatGPT Manager", openDialog, { accessKey: "m" });
  GM_registerMenuCommand("اتصال مجدد به ChatGPT", () => {
    if (isChatGPTTab) location.reload();
    else window.open("https://chatgpt.com/", "_blank", "noopener");
  });
}

globalThis.ChatGPTManagerBootstrap = ChatGPTManagerBootstrap;
