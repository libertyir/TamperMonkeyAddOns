# ChatGPT Manager

Client-side ChatGPT conversation and project manager for Tampermonkey.

## Runtime architecture

- `Index.html` remains the single UI entry and declares the app root, stylesheet and ES module entry.
- The Tampermonkey menu opens an overlay dialog in the current ChatGPT document.
- No cross-origin iframe is created. The userscript reads `Index.html` and its stylesheet, mounts the app inside a Shadow DOM, and imports the declared module entry.
- The userscript bridge runs in the same userscript sandbox as the app and accesses the current ChatGPT session and GM storage.
- UI, API facade, conversation/project services, storage and localization remain separate modules.

## Install

Install or update:
`https://raw.githubusercontent.com/libertyir/TamperMonkeyAddOns/main/ChatGPTManager/ChatGPTManager.user.js`

Then reload ChatGPT and choose **ChatGPT Manager** from the Tampermonkey menu.

## CSP

The manager does not use an iframe, so ChatGPT's `frame-src` policy does not apply. Its remote app files are retrieved by Tampermonkey's `GM_xmlhttpRequest`; the module entry is imported by the userscript sandbox.

## Standalone preview

`https://libertyir.github.io/TamperMonkeyAddOns/ChatGPTManager/Index.html`

The standalone page uses localStorage and does not have access to the signed-in ChatGPT session.

## Notes

The ChatGPT web-app endpoints are undocumented and may change. Message sending is not yet connected to ChatGPT's native streaming send flow; the composer reports this explicitly rather than simulating a response.
