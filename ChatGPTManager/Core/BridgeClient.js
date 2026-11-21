import { CONFIG } from "./Config.js";

export class BridgeClient {
  constructor() {
    this.pending = new Map();
    this.preview = window.parent === window;
    window.addEventListener("message", event => this.onMessage(event));
  }
  onMessage(event) {
    const message = event.data;
    if (!message || message.channel !== "cgm:response") return;
    const task = this.pending.get(message.id);
    if (!task) return;
    clearTimeout(task.timer);
    this.pending.delete(message.id);
    message.error ? task.reject(new Error(message.error)) : task.resolve(message.result);
  }
  request(action, params={}) {
    if (this.preview) return Promise.reject(new Error("Standalone preview has no ChatGPT session bridge."));
    const id = crypto.randomUUID();
    return new Promise((resolve,reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error("Bridge request timed out: " + action));
      }, CONFIG.bridgeTimeout);
      this.pending.set(id,{resolve,reject,timer});
      window.parent.postMessage({channel:"cgm:request",id,action,params},"*");
    });
  }
  get connected() { return !this.preview; }
}
