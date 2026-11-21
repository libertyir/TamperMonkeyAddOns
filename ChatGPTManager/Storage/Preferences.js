import { CONFIG } from "../Core/Config.js";

export class Preferences {
  constructor(bridge) { this.bridge = bridge; }
  async get() {
    if (this.bridge.connected) {
      try { return await this.bridge.request("storage.get",{key:CONFIG.storageKey}); } catch {}
    }
    try { return JSON.parse(localStorage.getItem(CONFIG.storageKey) || "{}"); } catch { return {}; }
  }
  async set(value) {
    localStorage.setItem(CONFIG.storageKey,JSON.stringify(value));
    if (this.bridge.connected) await this.bridge.request("storage.set",{key:CONFIG.storageKey,value});
  }
}
