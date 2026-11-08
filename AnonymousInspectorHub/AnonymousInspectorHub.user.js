
// ==UserScript==
// @name         Anonymous Inspector Hub
// @namespace    https://github.com/libertyir/TamperMonkeyAddOns
// @version      1.1.3
// @description  Modular exposure inspectors for public web directories
// @author       libertyir
// @homepageURL  https://github.com/libertyir/TamperMonkeyAddOns
// @match        http://*/*
// @match        https://*/*
// @run-at       document-idle
// @require      https://libertyir.github.io/TamperMonkeyAddOns/AnonymousInspectorHub/AssetManager.js?v=1.0.0
// @require      https://libertyir.github.io/TamperMonkeyAddOns/AnonymousInspectorHub/main.js?v=1.5.2
// @grant        GM_xmlhttpRequest
// @grant        GM_setClipboard
// @grant        GM_registerMenuCommand
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_listValues
// @grant        GM_deleteValue
// @connect      libertyir.github.io
// @connect      cdn.jsdelivr.net
// @connect      formats.kaitai.io
// @connect *
// ==/UserScript==


// const keys = await GM.listValues();

// for (const key of keys) {
//     await GM.deleteValue(key);
// }

// console.log("All userscript storage cleared.");

(function () {
    "use strict";

    if (typeof AnonymousInspector !== "function") {
        console.error(
            "[Anonymous Inspector] Main framework failed to load."
        );
        return;
    }

    AnonymousInspector(
        "DS_StoreModule", 
        "GitConfigModule",
        "PhpInfoModule",
        "EnvFileModule",
        "WebStructureInspectorModule",

        "DebugModeInspector",
        "SwaggerUIModule",
        "OpenAPIModule",
        "ApiDocsModule",
        "ApachiServerStatusModule",
        "DirectoryBrowsingModule",
        "GraphQLModule",

        "CommonTestFilesModule",
        "RedocModule",
        "ScalarModule",
        "ServerInfoModule",
        "StatusModule",
        "MetricsModule",
        "HealthCheckModule",
        "AdminPanelModule",
        "PlainTextViewerModule",
        "ImageFileViewerModule"
    );

})();
