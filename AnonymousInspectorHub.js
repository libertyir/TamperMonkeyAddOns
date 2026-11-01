// ==UserScript==
// @name         Anonymous Inspector Hub
// @namespace    https://github.com/libertyir/TamperMonkeyAddOns
// @version      1.1.1
// @description  Modular exposure inspectors for public web directories
// @author       libertyir
// @match        http://*/*
// @match        https://*/*
// @run-at       document-idle
// @require      https://libertyir.github.io/TamperMonkeyAddOns/AnonymousInspectorHub/main.js?1209
// @grant        GM_xmlhttpRequest
// @grant        GM_setClipboard
// @grant        GM_registerMenuCommand
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      libertyir.github.io
// @connect      cdn.jsdelivr.net
// @connect      formats.kaitai.io
// @connect      *
// ==/UserScript==

AnonymousInspector(
    "DS_Store_Viewer",
    "GitConfig_Viewer",
    "PhpInfo_Viewer",
    "EnvFile_Viewer",
    //"CommonTestFiles_Viewer",

    "SwaggerUI_Viewer",
    "OpenAPI_Viewer",
    //"Redoc_Viewer",
    //"Scalar_Viewer",
    "ApiDocs_Viewer",
    "ApachiServerStatus_Viewer",
    //"ServerInfo_Viewer",
    //"Status_Viewer",
    //"Metrics_Viewer",
    //"HealthCheck_Viewer",
    "DirectoryBrowsing_Viewer",
    "GraphQL_Viewer",
     //"AdminPanel_Viewer"

);