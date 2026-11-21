export const CONFIG = {
  appName: "ChatGPT Manager",
  bridgeTimeout: 30000,
  pageSize: 28,
  storageKey: "cgm.preferences.v1",
  embedded: new URLSearchParams(location.search).has("embedded")
};
export const EVENTS = {
  state: "state:change",
  toast: "ui:toast",
  navigate: "ui:navigate"
};
