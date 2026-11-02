
// ==UserScript==
// @name         Anonymous Inspector Hub
// @namespace    https://github.com/libertyir/TamperMonkeyAddOns
// @version      1.1.2
// @description  Modular exposure inspectors for public web directories
// @author       libertyir
// @homepageURL  https://github.com/libertyir/TamperMonkeyAddOns
// @match        http://*/*
// @match        https://*/*
// @run-at       document-idle
// @require      https://libertyir.github.io/TamperMonkeyAddOns/AnonymousInspectorHub/main.js?v=1.5.0
// @grant        GM_xmlhttpRequest
// @grant        GM_setClipboard
// @grant        GM_registerMenuCommand
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_listValues
// @connect      libertyir.github.io
// @connect      cdn.jsdelivr.net
// @connect      formats.kaitai.io
// @connect *
// ==/UserScript==

(function () {
    "use strict";

    if (typeof AnonymousInspector !== "function") {
        console.error(
            "[Anonymous Inspector] Main framework failed to load."
        );
        return;
    }

    AnonymousInspector(
        "DS_Store_Viewer", 
        "GitConfig_Viewer",
        "PhpInfo_Viewer",
        "EnvFile_Viewer",

        "SwaggerUI_Viewer",
        "OpenAPI_Viewer",
        "ApiDocs_Viewer",
        "ApachiServerStatus_Viewer",
        "DirectoryBrowsing_Viewer",
        "GraphQL_Viewer",

        "CommonTestFiles_Viewer",
        "Redoc_Viewer",
        "Scalar_Viewer",
        "ServerInfo_Viewer",
        "Status_Viewer",
        "Metrics_Viewer",
        "HealthCheck_Viewer",
        "AdminPanel_Viewer"
    );

})();
