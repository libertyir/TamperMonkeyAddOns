import { BridgeClient } from "./Core/BridgeClient.js";
import { I18n } from "./Core/I18n.js";
import { Preferences } from "./Storage/Preferences.js";
import { ChatGPTApi } from "./API/ChatGPTApi.js";
import { ConversationService } from "./Modules/Conversations/ConversationService.js";
import { ProjectService } from "./Modules/Projects/ProjectService.js";
import { ManagerApp } from "./UI/App.js";

const root = globalThis.__CGM_ROOT__?.querySelector("#app") || document.querySelector("#cgm-dialog-host")?.shadowRoot?.querySelector("#app") || document.querySelector("#app");

function showStartupError(error) {
  if (!root) return;
  root.innerHTML = `<main style="min-height:100vh;display:grid;place-items:center;padding:24px;background:#212121;color:#eee;font:14px/1.8 system-ui;direction:rtl"><section style="max-width:760px;width:100%;padding:24px;border:1px solid #744;border-radius:12px;background:#171717"><h2>راه‌اندازی ChatGPT Manager ناموفق بود</h2><pre style="white-space:pre-wrap;overflow-wrap:anywhere;color:#ffaaaa">${String(error?.stack || error?.message || error)}</pre><button onclick="location.reload()" style="padding:8px 16px">بارگذاری دوباره</button></section></main>`;
  console.error("[ChatGPT Manager] Startup failed:", error);
}

try {
  if (!root) throw new Error("عنصر #app در Index.html پیدا نشد.");

  const bridge = new BridgeClient();
  const i18n = new I18n();
  const preferences = new Preferences(bridge);
  const api = new ChatGPTApi(bridge);
  const conversations = new ConversationService(api);
  const projects = new ProjectService(api);
  const app = new ManagerApp({ api, bridge, preferences, i18n, conversations, projects });

  await app.init();
  bridge.ready.then(async connected => {
    app.authStatus.bridgeConnected = connected;
    if (connected) {
      try {
        app.authStatus = await api.authStatus();
        if (app.authStatus.accountAuthenticated) await app.refresh();
        else app.render();
      } catch (error) {
        app.authStatus = { ...app.authStatus, bridgeConnected: true, error: error.message };
        app.render();
      }
    } else {
      app.render();
    }
  }).catch(error => console.warn("[ChatGPT Manager] Bridge connection failed:", error));
} catch (error) {
  showStartupError(error);
}
