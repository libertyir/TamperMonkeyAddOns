(function(Framework){
"use strict";
const extensions=new Set(["txt","text","log","md","rst","css","scss","less","js","mjs","cjs","ts","jsx","tsx","json","jsonc","xml","html","htm","xhtml","svg","yaml","yml","toml","ini","conf","csv","sql","sh","py","rb","php","java","c","h","cpp","cs","go","rs","vue","svelte"]);
class PlainTextViewerProvider extends Framework.BaseProvider{
matchesResource(resource){
if(!resource||typeof resource!=="object"||resource.type==="directory")return false;
try{const url=new URL(resource.url||resource.path||resource.name||"",location.href);if(url.origin!==location.origin)return false;
const name=url.pathname.split("/").pop()||"",match=name.match(/\.([a-z0-9]{1,12})$/i);
return extensions.has(match?match[1].toLowerCase():"")||/^(text\/|application\/(json|xml|javascript|x-javascript))/i.test(resource.contentType||"");
}catch{return false;}
}}
Framework.registerProvider("PlainTextViewer_Provider",PlainTextViewerProvider);
})(Framework);
