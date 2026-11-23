import { CONFIG } from "./Config.js";

const CHANNEL = "cgm:page-bridge:v1";

export class BridgeClient {
  constructor() {
    this.pending = new Map();
    this.sequence = 0;
    this.pageConnected = false;
    this.localBridge = globalThis.__CGM_BRIDGE__ || null;
    this.ready = this.connectPageBridge();
  }

  connectPageBridge() {
    if (this.localBridge?.connected) {
      this.pageConnected = true;
      return Promise.resolve(true);
    }

    return new Promise(resolve => {
      const timer = setTimeout(() => {
        window.removeEventListener("message", onMessage);
        resolve(false);
      }, 3000);
      const onMessage = event => {
        if (event.origin !== location.origin || event.data?.channel !== CHANNEL) return;
        const message = event.data;
        if (message.type === "ready") {
          this.pageConnected = true;
          clearTimeout(timer);
          resolve(true);
          return;
        }
        if (message.type !== "response") return;
        const task = this.pending.get(message.id);
        if (!task) return;
        clearTimeout(task.timer);
        this.pending.delete(message.id);
        message.error ? task.reject(new Error(message.error)) : task.resolve(message.result);
      };
      window.addEventListener("message", onMessage);
      this.pageListener = onMessage;
      window.postMessage({ channel: CHANNEL, type: "hello" }, location.origin);
    });
  }

  request(action, params = {}) {
    if (this.localBridge?.connected) {
      return Promise.resolve().then(() => this.localBridge.request(action, params));
    }
    if (!this.pageConnected) {
      return Promise.reject(new Error("پل Tampermonkey در دسترس نیست. Userscript را به‌روزرسانی و صفحه را بازآوری کن."));
    }
    const id = "cgm-" + (++this.sequence) + "-" + Date.now();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error("Bridge timeout: " + action));
      }, CONFIG.bridgeTimeout);
      this.pending.set(id, { resolve, reject, timer });
      window.postMessage({ channel: CHANNEL, type: "request", id, action, params }, location.origin);
    });
  }

  get connected() {
    return Boolean(this.localBridge?.connected || this.pageConnected);
  }
}
