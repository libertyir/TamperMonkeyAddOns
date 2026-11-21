# ChatGPT Manager

Client-side conversation and ChatGPT Project manager for Tampermonkey.

## Architecture

- `Index.html`: single application entry. It runs standalone for UI preview and inside the in-page dialog.
- `ChatGPTManager.user.js`: injects a modal dialog into the current ChatGPT page and hosts the authenticated bridge.
- `Core/`: configuration, localization and RPC bridge client.
- `API/`: UI-facing API facade.
- `Storage/`: preferences persistence.
- `Modules/`: conversation and project services.
- `UI/`: application shell, reusable components and views.
- `Assets/`: styles.

## Install

Install the raw userscript:
`https://raw.githubusercontent.com/libertyir/TamperMonkeyAddOns/main/ChatGPTManager/ChatGPTManager.user.js`

Then open the Tampermonkey menu and select **ChatGPT Manager**. The manager opens as an overlay dialog on the current ChatGPT page; it does not navigate to another tab or window.

Standalone preview:
`https://libertyir.github.io/TamperMonkeyAddOns/ChatGPTManager/Index.html`

Standalone preview has no ChatGPT session bridge and therefore cannot perform account operations.

## Current API coverage

- List regular and archived conversations (paged).
- Read full conversation details and message tree.
- List projects and project conversations.
- Create, rename and delete projects.
- Archive, restore, rename, delete and move conversations.
- Bulk archive, restore, delete and move operations from the UI.
- Preferences use GM storage through the bridge; standalone preview uses localStorage.

These are undocumented ChatGPT web-app endpoints, not the public OpenAI API. Their paths and payloads may change. The adapter is isolated in the userscript bridge so endpoint changes do not require UI rewrites.

## Chat sending

Message sending is intentionally not faked. The current ChatGPT frontend uses a Sentinel-protected streaming send flow. The send adapter currently returns a clear unsupported message rather than pretending a message was sent. The next integration step is to connect the Manager composer to ChatGPT's native send flow and stream the resulting response back into the embedded workspace.

## Data and privacy

No external server or database is used. The manager fetches data from the current ChatGPT origin using the existing signed-in browser session. Preferences are stored in Tampermonkey GM storage. Conversation bodies are fetched on demand and are not copied into GM storage.
