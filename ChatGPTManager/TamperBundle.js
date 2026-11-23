(function(global){
"use strict";
const __factories={
"Core/Config.js": function(module, exports, __require) {
const CONFIG = {
  appName: "ChatGPT Manager",
  bridgeTimeout: 30000,
  pageSize: 28,
  storageKey: "cgm.preferences.v1",
  embedded: new URLSearchParams(location.search).has("embedded")
};
const EVENTS = {
  state: "state:change",
  toast: "ui:toast",
  navigate: "ui:navigate"
};

exports.CONFIG = CONFIG;
exports.EVENTS = EVENTS;

},
"Core/BridgeClient.js": function(module, exports, __require) {
const { CONFIG } = __require("Core/Config.js");
const CHANNEL = "cgm:page-bridge:v1";

class BridgeClient {
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

exports.BridgeClient = BridgeClient;

},
"Core/I18n.js": function(module, exports, __require) {
const dictionaries = {
  fa: {
    chats:"گفتگوها", projects:"پروژه‌ها", archive:"بایگانی", settings:"تنظیمات",
    newChat:"گفتگوی جدید", refresh:"بروزرسانی", search:"جست‌وجو در گفتگوها",
    all:"همه", active:"فعال", archived:"بایگانی‌شده", title:"عنوان", project:"پروژه",
    updated:"آخرین تغییر", actions:"عملیات", selectAll:"انتخاب همه", clear:"پاک‌کردن انتخاب",
    archiveSelected:"بایگانی", restoreSelected:"بازیابی", deleteSelected:"حذف دائمی",
    moveTo:"انتقال به پروژه", createProject:"پروژه جدید", rename:"تغییر نام",
    delete:"حذف", save:"ذخیره", cancel:"انصراف", close:"بستن", send:"ارسال",
    message:"پیام خود را بنویسید...", loading:"در حال بارگذاری...", empty:"موردی برای نمایش نیست",
    selected:"انتخاب‌شده", confirmDelete:"حذف دائمی موارد انتخاب‌شده؟ این عملیات قابل بازگشت نیست.",
    confirmProjectDelete:"حذف پروژه؟ گفتگوهای آن حذف نمی‌شوند اما ممکن است از فهرست پروژه خارج شوند.",
    projectName:"نام پروژه", chatDetails:"جزئیات گفتگو", loadError:"خطا در دریافت اطلاعات",
    noProject:"بدون پروژه", allProjects:"همه پروژه‌ها", connection:"وضعیت اتصال",
    connected:"متصل به نشست ChatGPT", preview:"پیش‌نمایش مستقل", bridgeOffline:"پل Tampermonkey متصل نیست", brokerOffline:"تب فعال ChatGPT پیدا نشد", accountAuthenticated:"حساب ChatGPT وارد شده", accountUnauthenticated:"ورود به ChatGPT لازم است", apiAvailable:"اتصال API تأیید شد", apiUnavailable:"API پاسخ معتبر نداد", language:"زبان",
    theme:"پوسته", auto:"خودکار", dark:"تیره", light:"روشن", bulk:"عملیات گروهی",
    branches:"شاخه‌های گفتگو", searchHint:"عنوان گفتگو را جست‌وجو کنید",
    refreshDone:"فهرست بروزرسانی شد", operationDone:"عملیات انجام شد", apiError:"درخواست ناموفق بود",
    sendUnsupported:"ارسال پیام از محیط Manager هنوز به جریان بومی ارسال ChatGPT متصل نشده است.",
    selectProject:"یک پروژه انتخاب کنید", renameChat:"تغییر عنوان گفتگو",
    branchNote:"شاخه‌های گفتگو از اطلاعات ساختار گفتگو قابل بررسی‌اند.",
    closeManager:"بستن Manager", openChat:"بازکردن گفتگو", noMessages:"پیامی برای نمایش وجود ندارد",
    loadMore:"بارگذاری بیشتر", retry:"تلاش دوباره", confirm:"تأیید"
  },
  en: {
    chats:"Conversations", projects:"Projects", archive:"Archive", settings:"Settings",
    newChat:"New chat", refresh:"Refresh", search:"Search conversations",
    all:"All", active:"Active", archived:"Archived", title:"Title", project:"Project",
    updated:"Updated", actions:"Actions", selectAll:"Select all", clear:"Clear selection",
    archiveSelected:"Archive", restoreSelected:"Restore", deleteSelected:"Delete permanently",
    moveTo:"Move to project", createProject:"New project", rename:"Rename",
    delete:"Delete", save:"Save", cancel:"Cancel", close:"Close", send:"Send",
    message:"Write a message...", loading:"Loading...", empty:"Nothing to show",
    selected:"selected", confirmDelete:"Permanently delete selected items? This cannot be undone.",
    confirmProjectDelete:"Delete project? Its conversations will not be deleted but may leave the project list.",
    projectName:"Project name", chatDetails:"Conversation details", loadError:"Could not load data",
    noProject:"No project", allProjects:"All projects", connection:"Connection",
    connected:"Connected to ChatGPT session", preview:"Standalone preview", bridgeOffline:"Tampermonkey bridge unavailable", brokerOffline:"No active ChatGPT tab found", accountAuthenticated:"ChatGPT account authenticated", accountUnauthenticated:"ChatGPT sign-in required", apiAvailable:"Backend API verified", apiUnavailable:"Backend API request failed", language:"Language",
    theme:"Theme", auto:"Auto", dark:"Dark", light:"Light", bulk:"Bulk actions",
    branches:"Conversation branches", searchHint:"Search conversation titles",
    refreshDone:"List refreshed", operationDone:"Operation completed", apiError:"Request failed",
    sendUnsupported:"Sending from Manager is not connected to ChatGPT's native send flow yet.",
    selectProject:"Select a project", renameChat:"Rename conversation",
    branchNote:"Conversation branches can be inspected from conversation structure.",
    closeManager:"Close Manager", openChat:"Open conversation", noMessages:"No messages to display",
    loadMore:"Load more", retry:"Retry", confirm:"Confirm"
  }
};
class I18n {
  constructor(language="fa") { this.language = dictionaries[language] ? language : "fa"; }
  setLanguage(language) { if (dictionaries[language]) this.language = language; }
  t(key) { return dictionaries[this.language][key] || key; }
  get dir() { return this.language === "fa" ? "rtl" : "ltr"; }
}

exports.I18n = I18n;

},
"Storage/Preferences.js": function(module, exports, __require) {
const { CONFIG } = __require("Core/Config.js");
class Preferences {
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

exports.Preferences = Preferences;

},
"API/ChatGPTApi.js": function(module, exports, __require) {
class ChatGPTApi {
  constructor(bridge) { this.bridge = bridge; }
  call(action,params={}) { return this.bridge.request("api."+action,params); }
  authStatus() { return this.call("authStatus"); }
  conversations(options={}) { return this.call("conversations",options); }
  projects() { return this.call("projects"); }
  projectConversations(projectId) { return this.call("projectConversations",{projectId}); }
  conversation(id) { return this.call("conversation",{id}); }
  archive(id, archived=true) { return this.call("archive",{id,archived}); }
  removeConversation(id) { return this.call("deleteConversation",{id}); }
  renameConversation(id,title) { return this.call("renameConversation",{id,title}); }
  moveConversation(id,projectId) { return this.call("moveConversation",{id,projectId}); }
  createProject(name) { return this.call("createProject",{name}); }
  renameProject(id,name) { return this.call("renameProject",{id,name}); }
  deleteProject(id) { return this.call("deleteProject",{id}); }
  sendMessage(id,text) { return this.call("sendMessage",{id,text}); }
}

exports.ChatGPTApi = ChatGPTApi;

},
"Modules/Conversations/ConversationService.js": function(module, exports, __require) {
class ConversationService {
  constructor(api) { this.api = api; this.items = []; this.offset = 0; this.total = null; }
  async load({archived=false,reset=true,search=""}={}) {
    if (reset) { this.items=[]; this.offset=0; }
    const result = await this.api.conversations({archived,offset:this.offset,limit:28});
    const rows = (result.items || []).map(item => ({
      id:item.id, title:item.title || "Untitled", projectId:item.gizmo_id || null,
      archived:Boolean(item.is_archived), updatedAt:item.update_time || item.create_time,
      snippet:item.snippet || ""
    }));
    const known = new Set(this.items.map(item=>item.id));
    this.items.push(...rows.filter(item=>!known.has(item.id)));
    this.offset += rows.length;
    this.total = result.total ?? this.total;
    return search ? this.items.filter(item=>item.title.toLowerCase().includes(search.toLowerCase())) : this.items;
  }
  async detail(id) { return this.api.conversation(id); }
  async archiveMany(ids, archived=true) {
    return runSequential(ids, id=>this.api.archive(id,archived));
  }
  async deleteMany(ids) {
    return runSequential(ids, id=>this.api.removeConversation(id));
  }
  async moveMany(ids, projectId) {
    return runSequential(ids, id=>this.api.moveConversation(id,projectId));
  }
}
async function runSequential(ids, operation) {
  let success=0;
  const failed=[];
  for (let i=0;i<ids.length;i++) {
    try { await operation(ids[i]); success++; }
    catch(error) {
      failed.push(error?.message || "Failed");
      if (/HTTP (401|403|429)|اتصال مجدد|نشست|دسترسی را رد کرد/i.test(error?.message || "")) break;
    }
    if (i<ids.length-1) await new Promise(resolve=>setTimeout(resolve,350));
  }
  return {success,failed};
}

exports.ConversationService = ConversationService;

},
"Modules/Projects/ProjectService.js": function(module, exports, __require) {
class ProjectService {
  constructor(api) { this.api=api; this.items=[]; }
  async load() {
    const result=await this.api.projects();
    this.items=(result.items || []).map(row=>{
      const p=row.gizmo?.gizmo || row.gizmo || row;
      return {id:p.id || p.project_id,name:p.display?.name || p.name || "Untitled",description:p.display?.description || "",raw:p};
    }).filter(p=>p.id);
    return this.items;
  }
  create(name) { return this.api.createProject(name); }
  rename(id,name) { return this.api.renameProject(id,name); }
  remove(id) { return this.api.deleteProject(id); }
  conversations(id) { return this.api.projectConversations(id); }
}

exports.ProjectService = ProjectService;

},
"UI/Components.js": function(module, exports, __require) {
const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function getMount() {
  const appRoot = document.querySelector("#cgm-dialog-host")?.shadowRoot?.querySelector("#app")
    || document.querySelector("#app");
  const root = appRoot?.getRootNode();
  return root?.nodeType === 9 ? root.body : root || document.body;
}
function modal({title,body="",input=false,value="",confirmText="Save",cancelText="Cancel"}) {
  return new Promise(resolve=>{
    const host=document.createElement("div");
    host.className="cgm-modal-backdrop";
    host.innerHTML=`<form class="cgm-modal"><h3>${escapeHTML(title)}</h3>${body}${input?`<input class="cgm-modal-input" value="${escapeHTML(value)}" required>`:""}<div class="cgm-actions end"><button type="button" data-cancel>${escapeHTML(cancelText)}</button><button class="primary" type="submit">${escapeHTML(confirmText)}</button></div></form>`;
    getMount().append(host);
    const field=host.querySelector("input"); field?.focus();
    host.querySelector("[data-cancel]").onclick=()=>{host.remove();resolve(null);};
    host.querySelector("form").onsubmit=e=>{e.preventDefault();const result=field?field.value.trim():true;host.remove();resolve(result);};
  });
}
function toast(message,type="info") {
  const item=document.createElement("div");item.className="cgm-toast "+type;item.textContent=message;
  getMount().append(item);setTimeout(()=>item.remove(),3500);
}

exports.escapeHTML = escapeHTML;
exports.modal = modal;
exports.toast = toast;

},
"UI/Views.js": function(module, exports, __require) {
const { escapeHTML } = __require("UI/Components.js");
function sidebar({t,view,projects,conversations,projectId}) {
  return `<aside class="cgm-sidebar">
    <div class="cgm-brand"><span class="cgm-logo">✳</span><span>ChatGPT Manager</span></div>
    <button class="cgm-new primary" data-action="new-chat">＋ ${t("newChat")}</button>
    <nav class="cgm-nav">
      ${["chats","projects","archive","bulk","settings"].map(key=>`<button data-view="${key}" class="${view===key?"active":""}">${t(key)}</button>`).join("")}
    </nav>
    <div class="cgm-side-label">${view==="projects"?t("projects"):t("chats")}</div>
    <div class="cgm-side-list">
      ${view==="projects"?projects.map(p=>`<button class="cgm-side-item ${p.id===projectId?"active":""}" data-project="${p.id}"><span class="cgm-dot"></span><span>${escapeHTML(p.name)}</span></button>`).join(""):conversations.slice(0,60).map(c=>`<button class="cgm-side-item" data-chat="${c.id}"><span>${escapeHTML(c.title)}</span></button>`).join("")}
    </div>
    <div class="cgm-side-footer"><span>${t("connection")}</span><span class="cgm-status"></span></div>
  </aside>`;
}
function conversationTable({t,items,projects,selected,archived}) {
  return `<div class="cgm-toolbar">
    <input id="conversation-search" class="cgm-search" placeholder="${t("searchHint")}">
    <button data-action="select-all">${t("selectAll")}</button><button data-action="clear-selection">${t("clear")}</button>
    <button data-action="archive-selected">${archived?t("restoreSelected"):t("archiveSelected")}</button>
    <button class="danger" data-action="delete-selected">${t("deleteSelected")}</button>
    <select id="bulk-project"><option value="">${t("moveTo")}</option>${projects.map(p=>`<option value="${p.id}">${escapeHTML(p.name)}</option>`).join("")}</select>
  </div>
  <div class="cgm-selection-count">${selected.size} ${t("selected")}</div>
  <div class="cgm-table-wrap"><table class="cgm-table"><thead><tr><th></th><th>${t("title")}</th><th>${t("project")}</th><th>${t("updated")}</th></tr></thead><tbody>
  ${items.length?items.map(c=>`<tr data-row="${c.id}"><td><input type="checkbox" data-select="${c.id}" ${selected.has(c.id)?"checked":""}></td><td><button class="link" data-chat="${c.id}">${escapeHTML(c.title)}</button><small>${escapeHTML(c.snippet)}</small></td><td>${escapeHTML(projects.find(p=>p.id===c.projectId)?.name || t("noProject"))}</td><td>${escapeHTML(formatDate(c.updatedAt))}</td></tr>`).join(""):`<tr><td colspan="4" class="cgm-empty">${t("empty")}</td></tr>`}
  </tbody></table></div>`;
}
function projectsTable({t,projects}) {
  return `<div class="cgm-toolbar"><button class="primary" data-action="create-project">＋ ${t("createProject")}</button></div>
  <div class="cgm-project-grid">${projects.map(p=>`<article class="cgm-project-card"><div class="cgm-project-icon">▦</div><h3>${escapeHTML(p.name)}</h3><p>${escapeHTML(p.description)}</p><div class="cgm-actions"><button data-action="rename-project" data-id="${p.id}">${t("rename")}</button><button class="danger" data-action="delete-project" data-id="${p.id}">${t("delete")}</button></div><button class="cgm-project-open" data-project="${p.id}">${t("openChat")}</button></article>`).join("")}</div>`;
}
function chatView({t,chat,messages}) {
  return `<section class="cgm-chat-view"><header class="cgm-chat-head"><div><h2>${escapeHTML(chat.title)}</h2><small>${t("chatDetails")}</small></div><button data-action="rename-chat" data-id="${chat.id}">${t("rename")}</button></header>
  <div class="cgm-messages">${messages.length?messages.map(m=>`<article class="cgm-message ${m.role==="user"?"user":""}"><span>${escapeHTML(m.role)}</span><div>${escapeHTML(m.text)}</div></article>`).join(""):`<div class="cgm-empty">${t("noMessages")}</div>`}</div>
  <form class="cgm-composer" id="chat-composer"><textarea id="chat-message" placeholder="${t("message")}" rows="2"></textarea><button class="primary" type="submit">${t("send")}</button></form>
  </section>`;
}
function formatDate(value) {
  if(!value)return "—";
  const date=new Date(value);
  return Number.isNaN(date.getTime())?String(value):date.toLocaleString();
}

exports.sidebar = sidebar;
exports.conversationTable = conversationTable;
exports.projectsTable = projectsTable;
exports.chatView = chatView;

},
"UI/App.js": function(module, exports, __require) {
const { sidebar,conversationTable,projectsTable,chatView } = __require("UI/Views.js");
const { modal,toast } = __require("UI/Components.js");
class ManagerApp {
  constructor({api,bridge,preferences,i18n,conversations,projects}) {
    Object.assign(this,{api,bridge,preferences,i18n,conversations,projects});
    this.view="chats";this.archived=false;this.selected=new Set();this.items=[];this.activeChat=null;this.projectId=null;
    this.authStatus={bridgeConnected:Boolean(bridge.connected),brokerConnected:false,accountAuthenticated:false,apiAvailable:null};
    this.root = document.querySelector("#cgm-dialog-host")?.shadowRoot?.querySelector("#app")
      || document.querySelector("#app");
  }
  async init() {
    const prefs=await this.preferences.get();
    this.i18n.setLanguage(prefs.language || "fa");
    this.theme=prefs.theme || "auto";
    this.applyDirection();
    if(this.bridge.connected) {
      try {
        this.authStatus=await this.api.authStatus();
        if(this.authStatus.accountAuthenticated) await this.refresh();
      } catch(error) {
        this.authStatus={bridgeConnected:true,brokerConnected:false,accountAuthenticated:false,authRequired:/نشست|اتصال مجدد|HTTP 401|HTTP 403/i.test(error.message||""),apiAvailable:false,error:error.message};
      }
    } else this.items=[];
    this.render();
  }
  applyDirection() {
    const mount = this.root?.getRootNode();
    const root = mount instanceof ShadowRoot ? mount.host : document.documentElement;
    root.lang = this.i18n.language;
    root.dir = this.i18n.dir;
    root.dataset.theme = this.theme;
  }
  async refresh() {
    try {
      if(!this.authStatus.accountAuthenticated) {
        this.authStatus=await this.api.authStatus();
        if(!this.authStatus.accountAuthenticated) { this.items=[];this.projects.items=[];this.render();return; }
      }
      const [projects,items]=await Promise.all([this.projects.load(),this.conversations.load({archived:this.archived})]);
      this.items=items;
      this.authStatus.apiAvailable=true;
      toast(this.i18n.t("refreshDone"));
      this.render();
    } catch(error) {
      if(/HTTP (401|403)|اتصال مجدد|نشست|دسترسی را رد کرد/i.test(error.message||"")) {
        this.authStatus={...this.authStatus,authRequired:true,accountAuthenticated:false,apiAvailable:false,error:error.message};
      }
      toast(error.message || this.i18n.t("loadError"),"error");
      this.render();
    }
  }
  render() {
    const t=key=>this.i18n.t(key);
    const projectConversations=this.items.filter(c=>!this.projectId||c.projectId===this.projectId);
    let content="";
    if(this.view==="projects") content=projectsTable({t,projects:this.projects.items});
    else if(this.view==="chat"&&this.activeChat) content=chatView({t,chat:this.activeChat,messages:this.activeChat.messages||[]});
    else if(this.view==="settings") content=this.settingsView(t);
    else if(this.view==="bulk") content=conversationTable({t,items:projectConversations,projects:this.projects.items,selected:this.selected,archived:this.archived});
    else content=conversationTable({t,items:projectConversations,projects:this.projects.items,selected:this.selected,archived:this.view==="archive"});
    const connectionLabel=this.authStatus.authRequired?"اتصال مجدد لازم است":!this.authStatus.bridgeConnected?t("bridgeOffline"):!this.authStatus.brokerConnected?t("brokerOffline"):!this.authStatus.accountAuthenticated?t("accountUnauthenticated"):this.authStatus.apiAvailable===true?t("apiAvailable"):this.authStatus.apiAvailable===false?t("apiUnavailable"):t("accountAuthenticated");
    const authNotice=this.authStatus.authRequired?`<div class="cgm-auth-notice" role="alert"><strong>اتصال به حساب ChatGPT متوقف شده است.</strong><p>${this.authStatus.error||"برای جلوگیری از درخواست‌های نامعتبر، هیچ درخواست دیگری ارسال نمی‌شود."}</p><p>در یک تب ChatGPT از منوی Tampermonkey گزینه «اتصال مجدد به ChatGPT» را اجرا کن.</p></div>`:"";
    this.root.innerHTML=`<div class="cgm-shell">${sidebar({t,view:this.view,projects:this.projects.items,conversations:this.items,projectId:this.projectId})}<main class="cgm-main"><header class="cgm-topbar"><strong>${t(this.view==="chat"?"chats":this.view)}</strong><div class="cgm-top-actions"><span class="cgm-session">${connectionLabel}</span><button data-action="refresh">${t("refresh")}</button><button data-action="close-manager" title="${t("closeManager")}">×</button></div></header><section class="cgm-content">${authNotice}${content}</section></main></div>`;
    this.bind();
  }
  settingsView(t) {
    return `<h2>${t("settings")}</h2><div class="cgm-settings-row"><label>${t("language")}</label><select id="language"><option value="fa" ${this.i18n.language==="fa"?"selected":""}>فارسی</option><option value="en" ${this.i18n.language==="en"?"selected":""}>English</option></select></div><div class="cgm-settings-row"><label>${t("theme")}</label><select id="theme"><option value="auto">Auto</option><option value="dark">Dark</option><option value="light">Light</option></select></div>`;
  }
  bind() {
    this.root.querySelectorAll("[data-view]").forEach(el=>el.onclick=()=>{this.view=el.dataset.view;this.archived=this.view==="archive";this.selected.clear();this.projectId=null;this.render();});
    this.root.querySelectorAll("[data-chat]").forEach(el=>el.onclick=()=>this.openChat(el.dataset.chat));
    this.root.querySelectorAll("[data-project]").forEach(el=>el.onclick=()=>{this.projectId=el.dataset.project;this.view="bulk";this.render();});
    this.root.querySelectorAll("[data-select]").forEach(el=>el.onchange=()=>{el.checked?this.selected.add(el.dataset.select):this.selected.delete(el.dataset.select);this.renderSelectionCount();});
    this.root.querySelectorAll("[data-action]").forEach(el=>el.onclick=()=>this.action(el.dataset.action,el.dataset.id));
    this.root.querySelector("#conversation-search")?.addEventListener("input",e=>this.filterRows(e.target.value));
    this.root.querySelector("#bulk-project")?.addEventListener("change",e=>e.target.value&&this.moveSelected(e.target.value));
    this.root.querySelector("#chat-composer")?.addEventListener("submit",e=>{e.preventDefault();this.sendChatMessage();});
    this.root.querySelector("#language")?.addEventListener("change",e=>this.updatePreference("language",e.target.value));
    this.root.querySelector("#theme")?.addEventListener("change",e=>this.updatePreference("theme",e.target.value));
  }
  async action(name,id) {
    const t=key=>this.i18n.t(key);
    try {
      if(name==="refresh") await this.refresh();
      if(name==="close-manager") { this.bridge.request("ui.close").catch(()=>{}); return; }
      if(name==="select-all") this.items.filter(c=>c.archived===this.archived).forEach(c=>this.selected.add(c.id));
      if(name==="clear-selection") this.selected.clear();
      if(name==="archive-selected"||name==="restore-selected") {
        const result=await this.conversations.archiveMany([...this.selected],name==="archive-selected");
        this.report(result);this.selected.clear();await this.refresh();
      }
      if(name==="delete-selected") {
        if(!this.selected.size||!confirm(t("confirmDelete")))return;
        const result=await this.conversations.deleteMany([...this.selected]);this.report(result);this.selected.clear();await this.refresh();
      }
      if(name==="create-project") {
        const value=await modal({title:t("projectName"),input:true,confirmText:t("save"),cancelText:t("cancel")});
        if(value){await this.projects.create(value);await this.refresh();}
      }
      if(name==="rename-project") {
        const p=this.projects.items.find(x=>x.id===id);const value=await modal({title:t("rename"),input:true,value:p?.name,confirmText:t("save"),cancelText:t("cancel")});
        if(value){await this.projects.rename(id,value);await this.refresh();}
      }
      if(name==="delete-project") {
        if(!confirm(t("confirmProjectDelete")))return;
        await this.projects.remove(id);await this.refresh();
      }
      if(name==="rename-chat"&&this.activeChat) {
        const value=await modal({title:t("renameChat"),input:true,value:this.activeChat.title,confirmText:t("save"),cancelText:t("cancel")});
        if(value){await this.api.renameConversation(this.activeChat.id,value);this.activeChat.title=value;this.render();}
      }
      if(name==="new-chat") {
        this.activeChat={id:null,title:t("newChat"),messages:[]};this.view="chat";this.render();
      }
      if(name==="select-all"||name==="clear-selection")this.render();
      if(name==="archive-selected"||name==="restore-selected"||name==="delete-selected"||name==="create-project"||name==="rename-project"||name==="delete-project")this.render();
    } catch(error) {
      if(/HTTP (401|403)|اتصال مجدد|نشست|دسترسی را رد کرد/i.test(error.message||"")) {
        this.authStatus={...this.authStatus,authRequired:true,accountAuthenticated:false,apiAvailable:false,error:error.message};
      }
      toast(error.message||t("apiError"),"error");
      this.render();
    }
  }
  async openChat(id) {
    try {
      const data=await this.conversations.detail(id);
      this.activeChat={id,title:data.title||"Untitled",messages:extractMessages(data)};
      this.view="chat";this.render();
    } catch(error) { toast(error.message,"error"); }
  }
  async sendChatMessage() {
    const field=this.root.querySelector("#chat-message"),text=field?.value.trim();
    if(!text)return;
    try {
      const result=await this.api.sendMessage(this.activeChat?.id,text);
      if(result?.conversation_id) await this.openChat(result.conversation_id);
      else if(this.activeChat?.id) await this.openChat(this.activeChat.id);
    } catch(error) { toast(error.message,"error"); }
  }
  async moveSelected(projectId) {
    try {const result=await this.conversations.moveMany([...this.selected],projectId);this.report(result);this.selected.clear();await this.refresh();this.render();}
    catch(error){toast(error.message,"error");}
  }
  report(result) {
    toast(`${result.success} ✓  ·  ${result.failed.length} ✕`,result.failed.length?"error":"success");
    if(result.failed.length) console.warn("[ChatGPT Manager] Partial operation failures",result.failed);
  }
  filterRows(query) {
    const q=query.toLowerCase();
    this.root.querySelectorAll("[data-row]").forEach(row=>{row.hidden=!row.textContent.toLowerCase().includes(q);});
  }
  renderSelectionCount() {
    const el=this.root.querySelector(".cgm-selection-count");
    if(el)el.textContent=this.selected.size+" "+this.i18n.t("selected");
  }
  async updatePreference(key,value) {
    const prefs=await this.preferences.get();prefs[key]=value;await this.preferences.set(prefs);
    if(key==="language")this.i18n.setLanguage(value);
    if(key==="theme")this.theme=value;
    this.applyDirection();this.render();
  }
}
function extractMessages(data) {
  const mapping=data.mapping||{},current=data.current_node;
  const nodes=[];let node=mapping[current],guard=0;
  while(node&&guard++<500){if(node.message)nodes.unshift(node.message);node=mapping[node.parent];}
  return nodes.map(item=>({role:item.author?.role||"assistant",text:(item.content?.parts||[]).filter(x=>typeof x==="string").join("\n")||item.content?.text||""})).filter(item=>item.text);
}

exports.ManagerApp = ManagerApp;

},
"main.js": function(module, exports, __require) {
async function start(){
const { BridgeClient } = __require("Core/BridgeClient.js");
const { I18n } = __require("Core/I18n.js");
const { Preferences } = __require("Storage/Preferences.js");
const { ChatGPTApi } = __require("API/ChatGPTApi.js");
const { ConversationService } = __require("Modules/Conversations/ConversationService.js");
const { ProjectService } = __require("Modules/Projects/ProjectService.js");
const { ManagerApp } = __require("UI/App.js");
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

}
exports.start = start;
}
};
const __cache={};
function __require(id){if(__cache[id])return __cache[id].exports;const factory=__factories[id];if(!factory)throw new Error("Unknown ChatGPT Manager module: "+id);const module={exports:{}};__cache[id]=module;factory(module,module.exports,__require);return module.exports;}
global.ChatGPTManagerStart=async function(){return __require("main.js").start();};
})(globalThis);
