(function(Framework){
"use strict";
class ImageFileViewer extends Framework.BaseModule{
static id="ImageFileViewer";static title="Image File Viewer";static description="Image preview with MD5 and SHA-256";static icon="🖼️";static providerId="ImageFileViewer_Provider";
async init(context={}){
this.url=context.url||context.fileUrl;if(!this.url)return;
const {response,buffer}=await globalThis.AnonymousInspectorFileViewerHash.read(this.url);
if(buffer.byteLength>20971520)throw new Error("Image preview is limited to 20 MB.");
this.hashes=await globalThis.AnonymousInspectorFileViewerHash.digest(buffer);this.size=buffer.byteLength;
this.objectUrl=URL.createObjectURL(new Blob([buffer],{type:response.headers.get("content-type")||"application/octet-stream"}));this.available=true;
}
render(){
const root=Framework.createElement("section",{className:"ifv-root"}),style=Framework.createElement("style");
style.textContent=".ifv-root{color:#ddd;font:13px sans-serif}.ifv-hash{display:grid;gap:5px;padding:10px;background:#181818;border:1px solid #444;overflow-wrap:anywhere;font-family:monospace}.ifv-preview{display:flex;justify-content:center;align-items:center;min-height:180px;max-height:65vh;overflow:auto;margin-top:12px;padding:12px;background:#111}.ifv-preview img{max-width:100%;max-height:60vh;object-fit:contain}";
const hashes=Framework.createElement("div",{className:"ifv-hash"});
hashes.textContent="MD5: "+this.hashes.md5+"\nSHA-256: "+this.hashes.sha256;
const size=Framework.createElement("p");size.textContent="File size: "+new Intl.NumberFormat().format(this.size)+" bytes";
const preview=Framework.createElement("div",{className:"ifv-preview"});
preview.appendChild(Framework.createElement("img",{src:this.objectUrl,alt:new URL(this.url).pathname.split("/").pop()||"Image"}));
root.append(style,hashes,size,preview);return root;
}
destroy(){if(this.objectUrl)URL.revokeObjectURL(this.objectUrl);this.objectUrl=null;}
}
Framework.register(ImageFileViewer.id,ImageFileViewer);
})(Framework);
