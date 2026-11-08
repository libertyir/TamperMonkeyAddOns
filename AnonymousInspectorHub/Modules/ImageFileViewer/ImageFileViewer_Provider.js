(function(Framework){
"use strict";
const extensions=new Set(["ico","png","jpg","jpeg","gif","webp","bmp","avif","svg","tif","tiff"]);
class ImageFileViewerProvider extends Framework.BaseProvider{
matchesResource(resource){
if(!resource||typeof resource!=="object"||resource.type==="directory")return false;
try{const url=new URL(resource.url||resource.path||resource.name||"",location.href);if(url.origin!==location.origin)return false;
const name=url.pathname.split("/").pop()||"",match=name.match(/\.([a-z0-9]{1,12})$/i);
return extensions.has(match?match[1].toLowerCase():"")||/^image\//i.test(resource.contentType||"");
}catch{return false;}
}}
Framework.registerProvider("ImageFileViewer_Provider",ImageFileViewerProvider);
})(Framework);
