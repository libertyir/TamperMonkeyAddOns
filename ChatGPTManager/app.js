(function () {
  "use strict";

  const ROOT_ID = "cgm-root";
  const KEY = "cgm_state_v1";
  const isUserscript = typeof GM_getValue === "function" && typeof GM_setValue === "function";
  const $ = (selector, root = document) => root.querySelector(selector);
  const uid = () => "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
  const initialState = () => ({
    language: "fa", theme: "auto", activeView: "chats", activeChat: null,
    projects: [{id:"p-inbox",name:"بدون پروژه",createdAt:Date.now()}],
    conversations: [
      {id:"chat-welcome",title:"گفتگوی آزمایشی",projectId:"p-inbox",archived:false,updatedAt:Date.now(),messages:[{role:"assistant",content:"به ChatGPT Manager خوش آمدید. این محیط فعلاً آزمایشی است و پیام‌ها را محلی ذخیره می‌کند."}]}
    ]
  });
  let state = initialState();
  let selected = new Set();

  async function loadState() {
    try {
      const saved = isUserscript ? await GM_getValue(KEY, null) : localStorage.getItem(KEY);
      const parsed = typeof saved === "string" ? JSON.parse(saved) : saved;
      if (parsed && Array.isArray(parsed.projects) && Array.isArray(parsed.conversations)) state = {...initialState(), ...parsed};
    } catch (error) { console.warn("[ChatGPT Manager] State load failed", error); }
  }
  async function saveState() {
    try {
      if (isUserscript) await GM_setValue(KEY, state);
      else localStorage.setItem(KEY, JSON.stringify(state));
    } catch (error) { console.error("[ChatGPT Manager] State save failed", error); }
  }
  const t = (fa, en) => state.language === "fa" ? fa : en;
  const activeConversation = () => state.conversations.find(item => item.id === state.activeChat);
  function render() {
    const root = document.getElementById(ROOT_ID);
    if (!root) return;
    const rtl = state.language === "fa";
    document.documentElement.lang = state.language;
    document.documentElement.dir = rtl ? "rtl" : "ltr";
    const chats = state.conversations.filter(item => !item.archived);
    const projects = state.projects;
    const current = activeConversation();
    root.innerHTML = `
      <div class="cgm-shell">
        <aside class="cgm-sidebar">
          <div class="cgm-brand"><span>✳ ChatGPT Manager</span><span class="cgm-badge">Preview</span></div>
          <div class="cgm-nav">
            <button data-view="chats">${t("گفتگوها","Chats")}</button>
            <button data-view="projects">${t("پروژه‌ها","Projects")}</button>
            <button data-view="archive">${t("آرشیو","Archive")}</button>
          </div>
          <button class="primary" id="new-chat">＋ ${t("گفتگوی جدید","New chat")}</button>
          <div class="cgm-list">
            ${(state.activeView === "projects" ? projects : chats).map(item => `<div class="cgm-item ${item.id === state.activeChat ? "active" : ""}" data-open="${item.id}" data-kind="${state.activeView === "projects" ? "project" : "chat"}"><span>${escapeHTML(item.name || item.title)}</span></div>`).join("")}
          </div>
          <div class="cgm-side-footer"><span>${t("ذخیره‌سازی محلی","Local storage")}</span><button id="language">${rtl ? "EN" : "فا"}</button></div>
        </aside>
        <main class="cgm-main">
          <header class="cgm-topbar"><strong>${viewTitle()}</strong><div class="cgm-row"><span class="cgm-badge">${isUserscript ? "Tampermonkey" : "Standalone preview"}</span><button id="theme">${t("تغییر تم","Theme")}</button></div></header>
          <section class="cgm-content">${renderView(current)}</section>
        </main>
      </div>`;
    bindEvents();
  }
  function viewTitle() {
    return ({chats:t("گفتگوها","Chats"),projects:t("مدیریت پروژه‌ها","Projects"),archive:t("گفتگوهای آرشیوشده","Archived chats"),chat:t("گفتگو","Chat")})[state.activeView] || "ChatGPT Manager";
  }
  function renderView(current) {
    if (state.activeView === "chat" && current) return renderChat(current);
    if (state.activeView === "projects") return renderProjects();
    if (state.activeView === "archive") return renderConversations(true);
    return renderConversations(false);
  }
  function renderConversations(archived) {
    const rows = state.conversations.filter(item => item.archived === archived);
    return `<h1 class="cgm-heading">${archived ? t("آرشیو گفتگوها","Conversation archive") : t("همه گفتگوها","All conversations")}</h1>
      <p class="cgm-sub">${t("گفتگوها را انتخاب و به‌صورت گروهی مدیریت کنید.","Select conversations and manage them in bulk.")}</p>
      <div class="cgm-toolbar"><input class="cgm-search" id="search" placeholder="${t("جست‌وجو در گفتگوها...","Search conversations...")}"><button id="select-all">${t("انتخاب همه","Select all")}</button><button id="archive-selected">${archived ? t("بازیابی","Restore") : t("آرشیو انتخاب‌شده‌ها","Archive selected")}</button><button class="danger" id="delete-selected">${t("حذف انتخاب‌شده‌ها","Delete selected")}</button><select id="assign-project"><option value="">${t("انتقال به پروژه...","Move to project...")}</option>${state.projects.map(p=>`<option value="${p.id}">${escapeHTML(p.name)}</option>`).join("")}</select></div>
      <table class="cgm-table"><thead><tr><th></th><th>${t("عنوان گفتگو","Conversation")}</th><th>${t("پروژه","Project")}</th><th>${t("آخرین تغییر","Updated")}</th></tr></thead><tbody id="conversation-rows">${rows.length ? rows.map(c=>`<tr data-row="${c.id}"><td><input class="cgm-check" type="checkbox" data-select="${c.id}" ${selected.has(c.id)?"checked":""}></td><td><a href="#" data-chat="${c.id}">${escapeHTML(c.title)}</a></td><td>${escapeHTML(state.projects.find(p=>p.id===c.projectId)?.name || "—")}</td><td>${new Date(c.updatedAt).toLocaleString()}</td></tr>`).join("") : `<tr><td colspan="4" class="cgm-empty">${t("گفتگویی وجود ندارد","No conversations here yet")}</td></tr>`}</tbody></table>`;
  }
  function renderProjects() {
    return `<h1 class="cgm-heading">${t("پروژه‌ها","Projects")}</h1><p class="cgm-sub">${t("پروژه‌ها را بسازید و گفتگوها را بین آن‌ها سازمان‌دهی کنید.","Create projects and organize conversations.")}</p>
      <div class="cgm-toolbar"><button class="primary" id="add-project">＋ ${t("پروژه جدید","New project")}</button></div>
      <table class="cgm-table"><thead><tr><th>${t("نام پروژه","Project name")}</th><th>${t("تعداد گفتگو","Conversations")}</th><th></th></tr></thead><tbody>${state.projects.map(p=>`<tr><td>${escapeHTML(p.name)}</td><td>${state.conversations.filter(c=>c.projectId===p.id).length}</td><td><button data-rename="${p.id}">${t("ویرایش","Rename")}</button> <button class="danger" data-remove-project="${p.id}" ${p.id==="p-inbox"?"disabled":""}>${t("حذف","Delete")}</button></td></tr>`).join("")}</tbody></table>`;
  }
  function renderChat(chat) {
    return `<div class="cgm-chat"><div class="cgm-messages" id="messages">${chat.messages.map(m=>`<div class="cgm-message ${m.role==="user"?"user":""}">${escapeHTML(m.content)}</div>`).join("")}</div><div class="cgm-composer"><textarea id="message-input" placeholder="${t("پیام خود را بنویسید...","Message ChatGPT...")}"></textarea><button class="primary" id="send-message">${t("ارسال","Send")}</button></div><p class="cgm-sub">${t("حالت آزمایشی: پاسخ‌ها محلی و شبیه‌سازی‌شده هستند؛ به سرویس ChatGPT ارسال نمی‌شوند.","Mock mode: messages are local and are not sent to ChatGPT.")}</p></div>`;
  }
  function bindEvents() {
    $("#language")?.addEventListener("click",()=>{state.language=state.language==="fa"?"en":"fa";saveState().then(render);});
    $("#theme")?.addEventListener("click",()=>{document.body.classList.toggle("cgm-light");});
    document.querySelectorAll("[data-view]").forEach(el=>el.addEventListener("click",()=>{state.activeView=el.dataset.view;selected.clear();render();}));
    document.querySelectorAll("[data-open]").forEach(el=>el.addEventListener("click",()=>{if(el.dataset.kind==="project"){state.activeView="chats";}else{state.activeChat=el.dataset.open;state.activeView="chat";}render();}));
    document.querySelectorAll("[data-chat]").forEach(el=>el.addEventListener("click",e=>{e.preventDefault();state.activeChat=el.dataset.chat;state.activeView="chat";render();}));
    $("#new-chat")?.addEventListener("click",async()=>{const chat={id:uid(),title:t("گفتگوی جدید","New conversation"),projectId:"p-inbox",archived:false,updatedAt:Date.now(),messages:[]};state.conversations.unshift(chat);state.activeChat=chat.id;state.activeView="chat";await saveState();render();});
    $("#add-project")?.addEventListener("click",()=>askName(t("نام پروژه جدید","New project name"),async name=>{if(name.trim()){state.projects.push({id:uid(),name:name.trim(),createdAt:Date.now()});await saveState();render();}}));
    document.querySelectorAll("[data-rename]").forEach(el=>el.addEventListener("click",()=>{const p=state.projects.find(x=>x.id===el.dataset.rename);askName(t("نام جدید","New name"),async name=>{if(name.trim()){p.name=name.trim();await saveState();render();}},p.name);}));
    document.querySelectorAll("[data-remove-project]").forEach(el=>el.addEventListener("click",async()=>{if(!confirm(t("پروژه حذف شود؟ گفتگوها به «بدون پروژه» منتقل می‌شوند.","Delete project? Its conversations will move to Inbox.")))return;state.conversations.forEach(c=>{if(c.projectId===el.dataset.removeProject)c.projectId="p-inbox";});state.projects=state.projects.filter(p=>p.id!==el.dataset.removeProject);await saveState();render();}));
    document.querySelectorAll("[data-select]").forEach(el=>el.addEventListener("change",()=>{el.checked?selected.add(el.dataset.select):selected.delete(el.dataset.select);}));
    $("#select-all")?.addEventListener("click",()=>{state.conversations.filter(c=>c.archived===(state.activeView==="archive")).forEach(c=>selected.add(c.id));render();});
    $("#archive-selected")?.addEventListener("click",async()=>{state.conversations.forEach(c=>{if(selected.has(c.id))c.archived=state.activeView!=="archive";});selected.clear();await saveState();render();});
    $("#delete-selected")?.addEventListener("click",async()=>{if(!selected.size)return;if(!confirm(t("حذف دائمی گفتگوهای انتخاب‌شده؟ این کار قابل بازگشت نیست.","Permanently delete selected conversations? This cannot be undone.")))return;state.conversations=state.conversations.filter(c=>!selected.has(c.id));selected.clear();await saveState();render();});
    $("#assign-project")?.addEventListener("change",async el=>{if(!el.target.value)return;state.conversations.forEach(c=>{if(selected.has(c.id))c.projectId=el.target.value;});selected.clear();await saveState();render();});
    $("#search")?.addEventListener("input",el=>{const q=el.target.value.toLowerCase();document.querySelectorAll("[data-row]").forEach(row=>{row.hidden=!state.conversations.find(c=>c.id===row.dataset.row)?.title.toLowerCase().includes(q);});});
    $("#send-message")?.addEventListener("click",sendMessage);
    $("#message-input")?.addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMessage();}});
  }
  async function sendMessage() {
    const input=$("#message-input"), text=input?.value.trim(), chat=activeConversation();
    if(!text||!chat)return;
    chat.messages.push({role:"user",content:text});chat.title=chat.messages.length===1?text.slice(0,42):chat.title;
    chat.messages.push({role:"assistant",content:t("این یک پاسخ آزمایشی است. اتصال به مدل واقعی در مرحله بعد از طریق ChatGPT API Adapter اضافه می‌شود.","This is a mock response. Real model access will be added through the ChatGPT API adapter in a later phase.")});
    chat.updatedAt=Date.now();await saveState();render();$("#messages")?.scrollTo(0,999999);
  }
  function askName(title, callback, value="") {
    const wrap=document.createElement("div");wrap.className="cgm-modal-backdrop";
    wrap.innerHTML=`<form class="cgm-modal"><strong>${escapeHTML(title)}</strong><input autofocus value="${escapeHTML(value)}" required><div class="cgm-row end"><button type="button" id="cancel">${t("انصراف","Cancel")}</button><button class="primary" type="submit">${t("ذخیره","Save")}</button></div></form>`;
    document.body.appendChild(wrap);const form=$("form",wrap),input=$("input",wrap);input.focus();
    $("#cancel",wrap).onclick=()=>wrap.remove();form.onsubmit=e=>{e.preventDefault();const name=input.value;wrap.remove();callback(name);};
  }
  function ensureRoot() {
    let root = document.getElementById(ROOT_ID);
    if (root) return root;
    root = document.createElement("div");
    root.id = ROOT_ID;
    document.body.appendChild(root);
    if (!document.getElementById("cgm-styles")) {
      const link = document.createElement("link");
      link.id = "cgm-styles";
      link.rel = "stylesheet";
      link.href = "https://libertyir.github.io/TamperMonkeyAddOns/ChatGPTManager/Assets/manager.css";
      document.head.appendChild(link);
    }
    return root;
  }
  async function start() {
    if (!document.body) return;
    ensureRoot();
    await loadState();
    if (new URLSearchParams(location.search).has("cgm")) render();
    else renderLauncher();
  }
  function renderLauncher() {
    const root=document.getElementById(ROOT_ID);
    root.innerHTML='<button id="cgm-open" style="position:fixed;right:18px;bottom:18px;z-index:2147483647;border-radius:24px;padding:12px 16px;background:#10a37f;color:white;border:0;box-shadow:0 4px 18px #0005">✳ ChatGPT Manager</button>';
    $("#cgm-open").onclick=()=>window.open(location.origin+"/?cgm=1","ChatGPTManager","popup=yes,width=1280,height=850,resizable=yes,scrollbars=yes");
  }
  if (document.readyState==="loading") document.addEventListener("DOMContentLoaded",start,{once:true}); else start();
})();