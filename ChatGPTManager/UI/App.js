import { sidebar,conversationTable,projectsTable,chatView,helpView } from "./Views.js";
import { modal,toast } from "./Components.js";

export class ManagerApp {
  constructor({api,bridge,preferences,i18n,conversations,projects}) {
    Object.assign(this,{api,bridge,preferences,i18n,conversations,projects});
    this.view="chats";this.archived=false;this.selected=new Set();this.items=[];this.activeChat=null;this.projectId=null;
    this.authStatus={bridgeConnected:Boolean(bridge.connected),brokerConnected:false,accountAuthenticated:false,apiAvailable:null};this.progress=null;this.loadingMore=false;
    this.root = globalThis.__CGM_ROOT__?.querySelector("#app")
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
      this.setProgress("در حال دریافت پروژه‌ها…",0,2);
      const [projects,items]=await Promise.all([
        this.projects.load().then(value=>{this.setProgress("پروژه‌ها دریافت شدند",1,2);return value;}),
        this.conversations.load({archived:this.archived,onProgress:p=>this.setProgress(p.label,p.current,p.total)}).then(value=>{this.setProgress("گفتگوها دریافت شدند",2,2);return value;})
      ]);
      this.items=items;
      this.authStatus.apiAvailable=true;
      this.setProgress("به‌روزرسانی کامل شد",2,2);toast(this.i18n.t("refreshDone"));
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
    else if(this.view==="help") content=helpView({t});
    else if(this.view==="bulk") content=conversationTable({t,items:projectConversations,projects:this.projects.items,selected:this.selected,archived:this.archived});
    else content=conversationTable({t,items:projectConversations,projects:this.projects.items,selected:this.selected,archived:this.view==="archive"});
    const connectionLabel=this.authStatus.authRequired?"اتصال مجدد لازم است":!this.authStatus.bridgeConnected?t("bridgeOffline"):!this.authStatus.brokerConnected?t("brokerOffline"):!this.authStatus.accountAuthenticated?t("accountUnauthenticated"):this.authStatus.apiAvailable===true?t("apiAvailable"):this.authStatus.apiAvailable===false?t("apiUnavailable"):t("accountAuthenticated");
    const authNotice=this.authStatus.authRequired?`<div class="cgm-auth-notice" role="alert"><strong>اتصال به حساب ChatGPT متوقف شده است.</strong><p>${this.authStatus.error||"برای جلوگیری از درخواست‌های نامعتبر، هیچ درخواست دیگری ارسال نمی‌شود."}</p><p>در یک تب ChatGPT از منوی Tampermonkey گزینه «اتصال مجدد به ChatGPT» را اجرا کن.</p></div>`:"";
    this.root.innerHTML=`<div class="cgm-shell">${sidebar({t,view:this.view,projects:this.projects.items,conversations:this.items,projectId:this.projectId})}<main class="cgm-main"><header class="cgm-topbar"><strong>${t(this.view==="chat"?"chats":this.view)}</strong><div class="cgm-top-actions"><span class="cgm-session">${connectionLabel}</span><button data-action="refresh">${t("refresh")}</button><button data-action="close-manager" title="${t("closeManager")}">×</button></div></header><section class="cgm-content">${authNotice}${content}</section>${this.loadMoreMarkup()}${this.progressMarkup()}</main></div>`;
    this.bind();
  }
  loadMoreMarkup() {
    if(this.view==="projects"||this.view==="settings"||this.view==="chat") return "";
    if(this.loadingMore) return '<div class="cgm-load-more">در حال دریافت گفتگوهای قدیمی‌تر…</div>';
    if(this.conversations.hasMore) return '<div class="cgm-load-more">برای نمایش گفتگوهای قدیمی‌تر، به پایین فهرست بروید</div>';
    return '<div class="cgm-load-more">همه گفتگوها بارگذاری شدند</div>';
  }
  async loadMore() {
    if(this.loadingMore||!this.conversations.hasMore||!this.authStatus.accountAuthenticated||!["chats","archive","bulk"].includes(this.view)) return;
    this.loadingMore=true;
    const content=this.root.querySelector(".cgm-content");
    const previousTop=content?.scrollTop||0;
    const previousHeight=content?.scrollHeight||0;
    const archived=this.view==="archive";
    try {
      const items=await this.conversations.load({archived,reset:false});
      this.items=items;
      this.loadingMore=false;
      this.render();
      const next=this.root.querySelector(".cgm-content");
      if(next) next.scrollTop=previousTop+(next.scrollHeight-previousHeight);
      const scrollAreas=[next,this.root.querySelector(".cgm-table-wrap"),this.root.querySelector(".cgm-side-list")].filter(Boolean);
      if(this.conversations.hasMore&&scrollAreas.every(area=>area.scrollHeight<=area.clientHeight+80)) {
        queueMicrotask(()=>this.loadMore());
      }
    } catch(error) {
      this.loadingMore=false;
      this.setProgress(error.message||"دریافت گفتگوهای قدیمی‌تر ناموفق بود",0,1,true);
      this.render();
    }
  }
  progressMarkup() {
    if(!this.progress) return "";
    const p=this.progress,percent=p.total>0?Math.min(100,Math.round(p.current/p.total*100)):null;
    return `<div class="cgm-progress" role="status" aria-live="polite"><div class="cgm-progress-head"><span>${p.label}</span><strong>${percent===null?"…":percent+"%"}</strong></div><div class="cgm-progress-track"><span class="${percent===null?"indeterminate":""}" style="${percent===null?"":"width:"+percent+"%"}"></span></div>${p.total>0?`<small>${p.current} از ${p.total}</small>`:""}<button data-action="dismiss-progress" aria-label="بستن">×</button></div>`;
  }
  setProgress(label,current=0,total=null,error=false) {
    this.progress={label,current,total,error};
    const old=this.root.querySelector(".cgm-progress");
    const wrapper=document.createElement("div");
    wrapper.innerHTML=this.progressMarkup();
    const next=wrapper.firstElementChild;
    if(old)old.replaceWith(next);
    else this.root.append(next);
    if(total!==null&&current>=total&&!error) {
      setTimeout(()=>{if(this.progress?.label===label){this.progress=null;this.root.querySelector(".cgm-progress")?.remove();}},1600);
    }
  }
  async runProgress(label,operation) {
    this.setProgress(label,0,null);
    try { const result=await operation();this.setProgress("عملیات انجام شد",1,1);return result; }
    catch(error){this.setProgress(error.message||"عملیات ناموفق بود",0,1,true);throw error;}
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
    const maybeLoadMore=element=>{
      if(!element) return;
      element.addEventListener("scroll",()=>{
        if(element.scrollHeight-element.scrollTop-element.clientHeight<320)this.loadMore();
      },{passive:true});
    };
    maybeLoadMore(this.root.querySelector(".cgm-content"));
    maybeLoadMore(this.root.querySelector(".cgm-table-wrap"));
    maybeLoadMore(this.root.querySelector(".cgm-side-list"));
    this.root.querySelector("#bulk-project")?.addEventListener("change",e=>e.target.value&&this.moveSelected(e.target.value));
    this.root.querySelector("#chat-composer")?.addEventListener("submit",e=>{e.preventDefault();this.sendChatMessage();});
    this.root.querySelector("#language")?.addEventListener("change",e=>this.updatePreference("language",e.target.value));
    this.root.querySelector("#theme")?.addEventListener("change",e=>this.updatePreference("theme",e.target.value));
  }
  async action(name,id) {
    const t=key=>this.i18n.t(key);
    try {
      if(name==="refresh") await this.refresh();
      if(name==="dismiss-progress"){this.progress=null;this.root.querySelector(".cgm-progress")?.remove();return;}
      if(name==="close-manager") { this.bridge.request("ui.close").catch(()=>{}); return; }
      if(name==="select-all") this.items.filter(c=>c.archived===this.archived).forEach(c=>this.selected.add(c.id));
      if(name==="clear-selection") this.selected.clear();
      if(name==="archive-selected"||name==="restore-selected") {
        const result=await this.conversations.archiveMany([...this.selected],name==="archive-selected",p=>this.setProgress(p.label,p.current,p.total));
        this.report(result);this.selected.clear();await this.refresh();
      }
      if(name==="delete-selected") {
        if(!this.selected.size||!confirm(t("confirmDelete")))return;
        const result=await this.conversations.deleteMany([...this.selected],p=>this.setProgress(p.label,p.current,p.total));this.report(result);this.selected.clear();await this.refresh();
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
      this.setProgress("در حال دریافت محتوای گفتگو…",0,null);
      const data=await this.conversations.detail(id);
      this.progress=null;
      this.activeChat={id,title:data.title||"Untitled",messages:extractMessages(data)};
      this.view="chat";this.render();
    } catch(error) { toast(error.message,"error"); }
  }
  async sendChatMessage() {
    const field=this.root.querySelector("#chat-message"),text=field?.value.trim();
    if(!text)return;
    try {
      this.setProgress("در حال ارسال پیام…",0,null);
      const result=await this.api.sendMessage(this.activeChat?.id,text);
      this.progress=null;
      if(result?.conversation_id) await this.openChat(result.conversation_id);
      else if(this.activeChat?.id) await this.openChat(this.activeChat.id);
    } catch(error) { toast(error.message,"error"); }
  }
  async moveSelected(projectId) {
    try {const result=await this.conversations.moveMany([...this.selected],projectId,p=>this.setProgress(p.label,p.current,p.total));this.report(result);this.selected.clear();await this.refresh();this.render();}
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
