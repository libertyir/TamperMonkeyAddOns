export const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function getMount() { return globalThis.__CGM_ROOT__ || document; }
export function modal({title,body="",input=false,value="",confirmText="Save",cancelText="Cancel"}) {
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
export function toast(message,type="info") {
  const item=document.createElement("div");item.className="cgm-toast "+type;item.textContent=message;
  getMount().append(item);setTimeout(()=>item.remove(),3500);
}
