// ==UserScript==
// @name         ChatGPT Manager
// @namespace    https://github.com/libertyir/TamperMonkeyAddOns
// @version      0.2.0
// @description  In-page ChatGPT manager dialog with conversation and project tools
// @match        https://chatgpt.com/*
// @match        https://chat.openai.com/*
// @run-at       document-idle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// ==/UserScript==

(function () {
  "use strict";
  const APP_URL = "https://libertyir.github.io/TamperMonkeyAddOns/ChatGPTManager/Index.html?embedded=1";
  const CHANNEL = "cgm:request";
  let host, frame, dialog;

  function createDialog() {
    if (host) return;
    host=document.createElement("div");
    host.id="cgm-host";
    const shadow=host.attachShadow({mode:"open"});
    shadow.innerHTML=`
      <style>
        :host{all:initial}.backdrop{position:fixed;inset:0;z-index:2147483646;background:#0009;display:grid;place-items:center;padding:3vh 3vw}
        dialog{position:relative;margin:0;padding:0;border:1px solid #555;border-radius:16px;width:min(1500px,96vw);height:min(940px,94vh);max-width:none;max-height:none;background:#171717;overflow:hidden;box-shadow:0 20px 80px #0009}
        dialog::backdrop{background:transparent}.bar{height:38px;background:#222;display:flex;align-items:center;justify-content:space-between;padding:0 12px;color:#eee;font:13px system-ui}
        .close{border:0;background:transparent;color:#ddd;font-size:24px;cursor:pointer;line-height:1}
        iframe{display:block;border:0;width:100%;height:calc(100% - 38px);background:#212121}
        @media(max-width:700px){.backdrop{padding:0}dialog{width:100vw;height:100vh;border-radius:0}}
      </style>
      <div class="backdrop"><dialog open><div class="bar"><span>ChatGPT Manager</span><button class="close" aria-label="Close">×</button></div><iframe title="ChatGPT Manager" allow="clipboard-read; clipboard-write"></iframe></dialog></div>`;
    dialog=shadow.querySelector("dialog");
    frame=shadow.querySelector("iframe");
    frame.src=APP_URL;
    shadow.querySelector(".close").addEventListener("click",closeDialog);
    shadow.querySelector(".backdrop").addEventListener("click",e=>{if(e.target.classList.contains("backdrop"))closeDialog();});
    document.addEventListener("keydown",onKeydown,true);
    document.documentElement.appendChild(host);
  }
  function openDialog() { createDialog(); }
  function closeDialog() { host?.remove();host=null;frame=null;dialog=null;document.removeEventListener("keydown",onKeydown,true); }
  function onKeydown(event) { if(event.key==="Escape"&&host){event.stopPropagation();closeDialog();} }
  function respond(event,id,result,error) {
    event.source.postMessage({channel:"cgm:response",id,result,error},event.origin);
  }
  async function api(path,options={}) {
    const response=await fetch("/backend-api"+path,{credentials:"include",headers:{"Accept":"application/json","Content-Type":"application/json",...(options.headers||{})},...options});
    const text=await response.text();
    let data=null;try{data=text?JSON.parse(text):null;}catch{data=text;}
    if(!response.ok)throw new Error(data?.detail?.message||data?.message||data?.error||`HTTP ${response.status}: ${response.statusText}`);
    return data;
  }
  async function listConversations({archived=false,offset=0,limit=28}={}) {
    const query=new URLSearchParams({offset:String(offset),limit:String(limit),order:"updated"});
    if(archived)query.set("is_archived","true");
    return api("/conversations?"+query);
  }
  async function listProjects() {
    return api("/gizmos/snorlax/sidebar?owned_only=true&conversations_per_gizmo=0");
  }
  async function projectConversations({projectId}) {
    return api(`/gizmos/${encodeURIComponent(projectId)}/conversations?cursor=0`);
  }
  async function conversation({id}) { return api("/conversation/"+encodeURIComponent(id)); }
  async function archive({id,archived}) {
    return api("/conversation/"+encodeURIComponent(id),{method:"PATCH",body:JSON.stringify({is_archived:archived})});
  }
  async function deleteConversation({id}) {
    return api("/conversation/"+encodeURIComponent(id),{method:"PATCH",body:JSON.stringify({is_visible:false})});
  }
  async function renameConversation({id,title}) {
    return api("/conversation/id/"+encodeURIComponent(id)+"/rename",{method:"POST",body:JSON.stringify({title})});
  }
  async function moveConversation({id,projectId}) {
    return api("/conversation/"+encodeURIComponent(id),{method:"PATCH",body:JSON.stringify({gizmo_id:projectId})});
  }
  async function createProject({name}) {
    return api("/projects",{method:"POST",body:JSON.stringify({name,instructions:"",memory_scope:"unset"})});
  }
  async function renameProject({id,name}) {
    return api("/projects/"+encodeURIComponent(id),{method:"PATCH",body:JSON.stringify({name})});
  }
  async function deleteProject({id}) {
    return api("/gizmos/"+encodeURIComponent(id),{method:"DELETE"});
  }
  async function sendMessage({id,text}) {
    throw new Error("ارسال مستقیم پیام به API داخلی به توکن‌های امنیتی جاری ChatGPT وابسته است. اتصال به جریان ارسال بومی در مرحله بعد پیاده‌سازی می‌شود؛ در این نسخه پیام ساختگی تولید نمی‌شود.");
  }
  async function handleRequest(event) {
    const message=event.data;
    if(!message||message.channel!==CHANNEL||!frame||event.source!==frame.contentWindow||event.origin!=="https://libertyir.github.io")return;
    const {id,action,params={}}=message;
    try {
      let result;
      switch(action) {
        case "ui.close": closeDialog();result=true;break;
        case "storage.get": result=await GM_getValue(params.key,null);break;
        case "storage.set": result=await GM_setValue(params.key,params.value);break;
        case "api.conversations": result=await listConversations(params);break;
        case "api.projects": result=await listProjects();break;
        case "api.projectConversations": result=await projectConversations(params);break;
        case "api.conversation": result=await conversation(params);break;
        case "api.archive": result=await archive(params);break;
        case "api.deleteConversation": result=await deleteConversation(params);break;
        case "api.renameConversation": result=await renameConversation(params);break;
        case "api.moveConversation": result=await moveConversation(params);break;
        case "api.createProject": result=await createProject(params);break;
        case "api.renameProject": result=await renameProject(params);break;
        case "api.deleteProject": result=await deleteProject(params);break;
        case "api.sendMessage": result=await sendMessage(params);break;
        default: throw new Error("Unknown bridge action: "+action);
      }
      if(action!=="ui.close")respond(event,id,result,null);
    } catch(error) { respond(event,id,null,error.message||String(error)); }
  }
  window.addEventListener("message",handleRequest);
  if(typeof GM_registerMenuCommand==="function") {
    GM_registerMenuCommand("✳ ChatGPT Manager",openDialog,{accessKey:"m"});
  }
})();
