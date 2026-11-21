import { CONFIG } from "./Config.js";

export class BridgeClient {
  constructor() {
    this.transport = globalThis.__CGM_BRIDGE__ || null;
    this.preview = !this.transport?.connected;
  }
  request(action, params = {}) {
    if (!this.transport) return Promise.reject(new Error("Standalone preview has no ChatGPT session bridge."));
    return this.transport.request(action, params);
  }
  get connected() { return Boolean(this.transport?.connected); }
}
