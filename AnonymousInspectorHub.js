// ==UserScript==
// @name         Anonymous Inspector Hub
// @namespace    https://github.com/libertyir/TamperMonkeyAddOns
// @version      1.1.0
// @description  Modular exposure inspectors for public web directories
// @author       libertyir
// @match        http://*/*
// @match        https://*/*
// @run-at       document-idle
// @require      https://libertyir.github.io/TamperMonkeyAddOns/AnonymousInspectorHub/main.js
// @grant        GM_xmlhttpRequest
// @grant        GM_setClipboard
// @connect      libertyir.github.io
// @connect      cdn.jsdelivr.net
// @connect      formats.kaitai.io
// ==/UserScript==

AnonymousInspector(
    "DS_Store_Viewer",
    "GitConfig_Viewer",
    "ApachiServerStatus_Viewer",
    "PhpInfo_Viewer",
    "EnvFile_Viewer",
    "CommonTestFiles_Viewer",
    "GraphQL_Viewer",
    "SwaggerUI_Viewer",
    "OpenAPI_Viewer",
    "Redoc_Viewer",
    "Scalar_Viewer",
    "ApiDocs_Viewer"
);