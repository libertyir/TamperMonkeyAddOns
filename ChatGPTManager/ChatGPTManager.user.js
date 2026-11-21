// ==UserScript==
// @name         ChatGPT Manager
// @namespace    https://github.com/libertyir/TamperMonkeyAddOns
// @version      0.1.0
// @description  Client-side ChatGPT conversation and project manager scaffold
// @match        https://chatgpt.com/*
// @match        https://chat.openai.com/*
// @run-at       document-idle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @require      https://libertyir.github.io/TamperMonkeyAddOns/ChatGPTManager/app.js
// ==/UserScript==

(function () {
  "use strict";
  if (typeof GM_registerMenuCommand === "function") {
    GM_registerMenuCommand("Open ChatGPT Manager", function () {
      window.open(location.origin + "/?cgm=1", "ChatGPTManager", "popup=yes,width=1280,height=850,resizable=yes,scrollbars=yes");
    });
  }
})();
