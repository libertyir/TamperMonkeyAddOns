// ==UserScript==
// @name         ChatGPT Manager
// @namespace    https://github.com/libertyir/TamperMonkeyAddOns
// @version      0.6.1
// @description  Open ChatGPT Manager from the Tampermonkey menu
// @match        *://*/*
// @run-at       document-idle
// @noframes
// @require      https://raw.githubusercontent.com/libertyir/TamperMonkeyAddOns/main/ChatGPTManager/TamperBootstrap.js?v=0.6.1
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @grant        GM_deleteValue
// @grant        GM_addValueChangeListener
// @grant        GM_removeValueChangeListener
// @grant        GM_listValues
// @grant        unsafeWindow
// @connect      libertyir.github.io
// @connect      chatgpt.com
// @connect      chat.openai.com
// ==/UserScript==

(function () {
  "use strict";
  if (typeof ChatGPTManagerBootstrap === "function") ChatGPTManagerBootstrap();
  else console.error("[ChatGPT Manager] TamperBootstrap failed to load.");
})();
