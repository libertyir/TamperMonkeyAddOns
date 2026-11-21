import { CONFIG } from "../Core/Config.js";

export class Preferences {
  constructor(bridge) {
    this.bridge = bridge;
  }

  async get() {
    if (this.bridge.connected) {
      try {
        const value = await this.bridge.request("storage.get", { key: CONFIG.storageKey });
        if (value && typeof value === "object" && !Array.isArray(value)) return value;
      } catch {}
    }

    try {
      const value = JSON.parse(localStorage.getItem(CONFIG.storageKey) || "{}");
      return value && typeof value === "object" && !Array.isArray(value) ? value : {};
    } catch {
      return {};
    }
  }

  async set(value) {
    const preferences = value && typeof value === "object" && !Array.isArray(value) ? value : {};
    localStorage.setItem(CONFIG.storageKey, JSON.stringify(preferences));
    if (this.bridge.connected) {
      await this.bridge.request("storage.set", { key: CONFIG.storageKey, value: preferences });
    }
  }
}
