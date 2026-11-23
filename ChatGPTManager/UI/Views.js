import { escapeHTML } from "./Components.js";

export function sidebar({t,view,projects,conversations,projectId}) {
  return `<aside class="cgm-sidebar">
    <div class="cgm-brand"><span class="cgm-logo">✳</span><span>ChatGPT Manager</span></div>
    <button class="cgm-new primary" data-action="new-chat">＋ ${t("newChat")}</button>
    <nav class="cgm-nav">
      ${["chats","projects","archive","bulk","settings","help"].map(key=>`<button data-view="${key}" class="${view===key?"active":""}">${t(key)}</button>`).join("")}
    </nav>
    <div class="cgm-side-label">${view==="projects"?t("projects"):t("chats")}</div>
    <div class="cgm-side-list">
      ${view==="projects"?projects.map(p=>`<button class="cgm-side-item ${p.id===projectId?"active":""}" data-project="${p.id}"><span class="cgm-dot"></span><span>${escapeHTML(p.name)}</span></button>`).join(""):conversations.map(c=>`<button class="cgm-side-item" data-chat="${c.id}"><span>${escapeHTML(c.title)}</span></button>`).join("")}
    </div>
    <div class="cgm-side-footer"><span>${t("connection")}</span><span class="cgm-status"></span></div>
  </aside>`;
}
export function conversationTable({t,items,projects,selected,archived}) {
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
  </tbody></table></div><div class="cgm-load-more" aria-live="polite"></div>`;
}
export function projectsTable({t,projects}) {
  return `<div class="cgm-toolbar"><button class="primary" data-action="create-project">＋ ${t("createProject")}</button></div>
  <div class="cgm-project-grid">${projects.map(p=>`<article class="cgm-project-card"><div class="cgm-project-icon">▦</div><h3>${escapeHTML(p.name)}</h3><p>${escapeHTML(p.description)}</p><div class="cgm-actions"><button data-action="rename-project" data-id="${p.id}">${t("rename")}</button><button class="danger" data-action="delete-project" data-id="${p.id}">${t("delete")}</button></div><button class="cgm-project-open" data-project="${p.id}">${t("openChat")}</button></article>`).join("")}</div>`;
}
export function chatView({t,chat,messages}) {
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

export function helpView({t}) {
  return `<article class="cgm-help">
    <h2>${t("helpTitle")}</h2>
    <p class="cgm-help-lead">${t("helpIntro")}</p>
    <section class="cgm-help-section">
      <h3>${t("helpStep1Title")}</h3>
      <p>${t("helpStep1Text")}</p>
      <a href="https://www.tampermonkey.net/" target="_blank" rel="noopener noreferrer">${t("helpTampermonkeyLink")}</a>
    </section>
    <section class="cgm-help-section">
      <h3>${t("helpStep2Title")}</h3>
      <p>${t("helpStep2Text")}</p>
    </section>
    <section class="cgm-help-section">
      <h3>${t("helpStep3Title")}</h3>
      <ol><li>${t("helpStep3A")}</li><li>${t("helpStep3B")}</li><li>${t("helpStep3C")}</li></ol>
      <a class="cgm-help-install" href="https://raw.githubusercontent.com/libertyir/TamperMonkeyAddOns/main/ChatGPTManager/ChatGPTManager.user.js" target="_blank" rel="noopener noreferrer">${t("helpInstallLink")}</a>
    </section>
    <section class="cgm-help-section">
      <h3>${t("helpUsageTitle")}</h3>
      <ol><li>${t("helpUsageA")}</li><li>${t("helpUsageB")}</li><li>${t("helpUsageC")}</li></ol>
    </section>
    <section class="cgm-help-note"><strong>${t("helpNoteTitle")}</strong><p>${t("helpNoteText")}</p></section>
  </article>`;
}
