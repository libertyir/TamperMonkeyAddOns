import { sidebar,conversationTable,projectsTable,chatView } from "./Views.js";
import { modal,toast } from "./Components.js";

export class ManagerApp {
  constructor({api,bridge,preferences,i18n,conversations,projects}) {
    Object.assign(this,{api,bridge,preferences,i18n,conversations,projects});
    this.view="chats";this.archived=false;this.selected=new Set();this.items=[];this.activeChat=null;this.projectId=null;
    this.authStatus={bridgeConnected:Boolean(bridge.connected),accountAuthenticated:false,apiAvailable:null};
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
        this.authStatus={bridgeConnected:true,accountAuthenticated:false,apiAvailable:null,error:error.message};
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
      if(this.authStatus.accountAuthenticated) this.authStatus.apiAvailable=false;
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
    const connectionLabel=!this.authStatus.bridgeConnected?t("bridgeOffline"):!this.authStatus.accountAuthenticated?t("accountUnauthenticated"):this.authStatus.apiAvailable===true?t("apiAvailable"):this.authStatus.apiAvailable===false?t("apiUnavailable"):t("accountAuthenticated");
    this.root.innerHTML=`<div class="cgm-shell">${sidebar({t,view:this.view,projects:this.projects.items,conversations:this.items,projectId:this.projectId})}<main class="cgm-main"><header class="cgm-topbar"><strong>${t(this.view==="chat"?"chats":this.view)}</strong><div class="cgm-top-actions"><span class="cgm-session">${connectionLabel}</span><button data-action="refresh">${t("refresh")}</button><button data-action="close-manager" title="${t("closeManager")}">×</button></div></header><section class="cgm-content">${content}</section></main></div>`;
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
    } catch(error) { toast(error.message||t("apiError"),"error"); }
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
