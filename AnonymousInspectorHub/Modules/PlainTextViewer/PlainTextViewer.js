(function(Framework){
"use strict";
class PlainTextViewer extends Framework.BaseModule{
static id="PlainTextViewer";static title="Plain Text Viewer";static description="Formatted text and source viewer";static icon="📄";static providerId="PlainTextViewer_Provider";
async init(context={}){
this.url=context.url||context.fileUrl;if(!this.url)return;
const {response,buffer}=await globalThis.AnonymousInspectorFileViewerHash.read(this.url);
if(buffer.byteLength>2097152)throw new Error("Text preview is limited to 2 MB.");
this.text=new TextDecoder("utf-8").decode(buffer);this.hashes=await globalThis.AnonymousInspectorFileViewerHash.digest(buffer);
this.language=this.detectLanguage(this.url,response.headers.get("content-type")||"");this.available=true;
}
detectLanguage(url,type){
const ext=new URL(url).pathname.split(".").pop().toLowerCase();
const map={js:"javascript",mjs:"javascript",css:"css",scss:"scss",ts:"typescript",json:"json",xml:"xml",svg:"xml",html:"html",htm:"html",yaml:"yaml",yml:"yaml",md:"markdown",py:"python",sh:"bash",sql:"sql"};
return map[ext]||(type.includes("json")?"json":type.includes("xml")?"xml":"text");
}
render(){
const root=Framework.createElement("section",{className:"ptv-root"}),style=Framework.createElement("style");
style.textContent=".ptv-root{color:#ddd;font:13px monospace}.ptv-hash{padding:10px;background:#181818;border:1px solid #444;overflow-wrap:anywhere}.ptv-code{white-space:pre;overflow:auto;max-height:65vh;padding:12px;background:#101318;border:1px solid #333;tab-size:4}.ptv-bar{display:flex;justify-content:space-between;margin:10px 0}";
const hashes=Framework.createElement("div",{className:"ptv-hash"});
hashes.textContent="MD5: "+this.hashes.md5+"\nSHA-256: "+this.hashes.sha256;
const bar=Framework.createElement("div",{className:"ptv-bar"}),info=Framework.createElement("span");
info.textContent=this.language.toUpperCase()+" · "+this.text.length+" characters";
const copy=Framework.createElement("button",{type:"button",textContent:"Copy"});
copy.addEventListener("click",async()=>{await Framework.copy(this.text);copy.textContent="Copied";});
bar.append(info,copy);
const pre=Framework.createElement("pre",{className:"ptv-code"}),code=Framework.createElement("code");
code.className="language-"+this.language;code.textContent=this.text;pre.appendChild(code);
root.append(style,hashes,bar,pre);return root;
}
destroy(){this.text=null;this.hashes=null;}
}
Framework.register(PlainTextViewer.id,PlainTextViewer);
})(Framework);
