// ==UserScript==
// @name         tradingview gopro remove
// @namespace    https://github.com/libertyir
// @version      2026-06-04
// @description  tradingview gopro dialog close!
// @author       libertyir
// @match        https://www.tradingview.com/chart/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=tradingview.com
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    console.log("Start TradingView remove Ad-Pro.");
    const checkAd = setInterval(() => {
        if(typeof $ !== 'undefined') {
            var adproDialog = $("div[data-dialog-name*='gopro']");
            if(adproDialog.length > 0) {
                adproDialog.remove();
                console.log("Ad-Pro dialog closed.");
            }
        }
    }, 5000);
})();
