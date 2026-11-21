# ChatGPT Manager

A client-side Tampermonkey project for organizing ChatGPT conversations and projects.

## Current scaffold

- Standalone UI preview through `Index.html` (uses browser localStorage).
- Tampermonkey entry point using GM storage.
- Persian RTL and English LTR interface.
- Mock chat workspace.
- Project create, rename and delete.
- Conversation selection, bulk archive/restore, permanent delete and project assignment.
- Popup entry from the Tampermonkey menu and a floating launcher.

## Install

1. Install Tampermonkey.
2. Open `ChatGPTManager.user.js` on GitHub and install the raw userscript.
3. Open ChatGPT. Use the Tampermonkey menu command **Open ChatGPT Manager**.

For local preview, open `Index.html` through GitHub Pages or a local static server.

## Important boundaries

The current chat workspace is mock-only. It does not send messages to ChatGPT. Real conversation listing, project operations and message sending require a separately tested adapter for ChatGPT's undocumented web-app endpoints. The public OpenAI API does not provide access to a user's ordinary ChatGPT web conversation history.

The standalone preview cannot read the ChatGPT login session. Real account operations must run in the ChatGPT origin through the userscript.

## Storage

Tampermonkey GM storage is used on ChatGPT. Standalone preview falls back to localStorage. Conversation data is currently stored locally in the browser profile; no server or external database is used.
