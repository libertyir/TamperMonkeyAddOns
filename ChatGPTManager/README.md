# ChatGPT Manager

A standalone, client-side ChatGPT manager with one shared interface.

## Opening the manager

- **Tampermonkey menu:** the userscript runs on HTTP/HTTPS websites and adds exactly one menu command named **ChatGPT Manager**. Selecting it opens the manager as a dialog over the current page.
- **Direct page:** open https://libertyir.github.io/TamperMonkeyAddOns/ChatGPTManager/Index.html to use the same `Index.html` interface as a standalone page.
- No floating launcher, injected page button, iframe, or dependency on the ChatGPT website's DOM is used.

## Install

https://raw.githubusercontent.com/libertyir/TamperMonkeyAddOns/main/ChatGPTManager/ChatGPTManager.user.js

## Runtime design

- `Index.html` is the single UI entry for both launch methods.
- The userscript registers the menu command, mounts the shared UI in a Shadow DOM dialog, provides GM storage, and brokers account requests.
- The standalone page communicates with the userscript only when the userscript is installed and active on the GitHub Pages URL.
- Preferences use GM storage when available and localStorage as a standalone fallback. Conversation bodies are fetched on demand and are not copied into GM Storage.
- No floating launcher or page button is created.

## Account access

The userscript checks the signed-in web session through `/api/auth/session`, keeps its access token in memory only, and sends backend requests with a Bearer token. A successful session check is not treated as proof that the backend API works: the UI tracks bridge connectivity, account authentication, and backend API availability separately. ChatGPT web-app endpoints are undocumented and may change. The public OpenAI API is separate and does not expose ChatGPT account history or Projects.

Message sending is not yet connected to ChatGPT's protected streaming send flow. The composer reports this limitation instead of simulating a response.
