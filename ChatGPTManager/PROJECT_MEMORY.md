# ChatGPT Manager — Project Memory

> هدف این فایل حفظ تصمیم‌های معماری، وضعیت فعلی، محدودیت‌ها و نکات لازم برای ادامه‌ی توسعه در گفت‌وگوهای بعدی است. قبل از هر تغییر کد، این فایل و سورس فعلی شاخه‌ی main را دوباره بررسی کن؛ این یادداشت جایگزین خواندن کد نیست.

## Repository and deployment

- Repository: libertyir/TamperMonkeyAddOns
- Project directory: ChatGPTManager/
- Local working copy reported by the user: D:\GithubSources\TamperMonkeyAddOns
- Standalone page: https://libertyir.github.io/TamperMonkeyAddOns/ChatGPTManager/Index.html
- Userscript: https://raw.githubusercontent.com/libertyir/TamperMonkeyAddOns/main/ChatGPTManager/ChatGPTManager.user.js
- Main branch: main
- Latest known app/userscript version when this note was written: 0.7.4
- Latest known relevant project-pagination commits:
  - 9fb233e49d179591576ce7bb1945a1a7db0297c2 — TamperBootstrap project route and version
  - 2b79204f6c36fadf980c8062b8f473dc220fc1ed — API facade accepts cursor
  - 41946fc8cf0feed597780e3e50507434df86a18c — ProjectService cursor loop
  - 952426613ac48fb0b43bc62b38e4966e0a5e9adc — TamperBundle updated
  - 1b2f117be3d0ec5ea8476ef2d7718fba9df43449 — userscript version 0.7.4

Always fetch the current main versions and blob SHAs before editing. Commit history quoted in chat can be stale or incomplete.

## Product purpose

A client-side manager for ChatGPT account conversations and Projects. It has two launch modes:
1. Standalone page on GitHub Pages.
2. Tampermonkey menu command opening a Shadow DOM dialog over the current page.

The shared application should not depend directly on GM APIs or unsafeWindow; adapters/bridge provide the environment-specific capabilities.

## Architecture and trust boundaries

- Index.html + main.js: standalone ES-module entry.
- ChatGPTManager.user.js: Tampermonkey metadata and bootstrap launcher.
- TamperBundle.js: classic bundled app executed in Tampermonkey's isolated sandbox.
- TamperBootstrap.js: menu/dialog/bootstrap, Shadow DOM mounting, bridge and broker.
- Core/BridgeClient.js: app-side request bridge.
- API/ChatGPTApi.js: app API facade.
- Modules/Conversations/ and Modules/Projects/: domain services.
- UI/: app UI and views.
- Assets/manager.css: shared styles.
- Storage/: preferences and local settings.

Security constraints:
- ChatGPT account API calls are brokered by a userscript instance on a signed-in ChatGPT tab.
- The broker uses same-origin requests against internal ChatGPT web endpoints.
- Session/access tokens must remain in the ChatGPT tab's runtime memory. Never put them in GM storage, localStorage, DOM, logs, or bridge payloads.
- Use an allowlist of broker operations.
- Fail closed: on missing session or first 401/403, stop account operations and require reconnect. Do not silently refresh/retry with a new session. Stop the current request on 429.
- The public OpenAI API is not a substitute for ChatGPT account history or Projects endpoints.
- Do not bypass CSP. Do not execute app modules in Page Realm using Blob URLs, eval, Function, injected scripts, or dynamic imports from blobs.
- Tampermonkey app bundle must execute in the userscript sandbox. Standalone ES modules remain normal modules.

## Current functionality (as reflected in the project history)

- Conversation list, search, active/archive views.
- Conversation pagination / infinite scroll was added, with page size 28 in the broker conversation-list request. Scroll container handling has been revised more than once.
- Conversation archive, restore, delete, rename and move operations.
- Project list and project management (create, rename, delete).
- Bulk operation progress feedback.
- Help section for Tampermonkey installation and usage, Persian/English strings.
- Persian/English UI and theme/preferences.
- Standalone and dialog modes.
- Bridge heartbeat and per-tab broker discovery.

Do not assume every item is currently bug-free; inspect current code and ask for browser evidence when runtime behavior matters.

## Project pagination — important unresolved verification

At version 0.7.4, the project list was changed from one request to a cursor loop:
- Broker route: GET /gizmos/snorlax/sidebar?owned_only=true&conversations_per_gizmo=0, optionally adding a cursor query parameter.
- ChatGPTApi.projects(cursor) forwards the cursor.
- ProjectService.load() reads result.items, deduplicates by project ID, and continues using result.cursor until it is null/empty.

**Critical caveat:** this pagination contract was inferred/implemented but was not validated against an actual live response from the user's ChatGPT account. The initial symptom was that only five projects appeared. The endpoint may use a different continuation field, cursor format, or pagination strategy (or may return only a fixed sidebar subset). Do not claim pagination is confirmed. Before further changes:
1. Inspect a real, redacted response from the endpoint as returned by the authenticated ChatGPT tab.
2. Identify the actual continuation field and whether the next request uses query cursor, page token, or another route.
3. Verify that items contains the full project objects and that normalization handles all row shapes.
4. Check whether the endpoint filters by ownership or only returns a sidebar subset.
5. Update both source modules and TamperBundle.js consistently.
6. Test both the project management view and the conversation-move combobox, since both should consume the same ProjectService.items.

Do not invent cursor names or stop conditions. Preserve deduplication and loop protection once the real contract is known.

## Build and synchronization rules

- Source modules are the maintainable source of truth.
- TamperBundle.js must be regenerated whenever any imported app module changes. Do not patch only the bundle or only the source.
- Keep standalone ES module imports working independently of the Tampermonkey bundle.
- Keep @require versions in ChatGPTManager.user.js aligned with the Bootstrap/bundle cache-busting version.
- TamperBootstrap.js VERSION, userscript @version, @require query strings, and CSS cache-busting should be kept in sync where relevant.
- Avoid unrelated rewrites. User prefers minimal, targeted changes and readable source.
- Check JS syntax and inspect the final files after committing. Be explicit that syntax checks are not browser integration tests.
- Do not claim real browser testing unless it was actually performed.

## Known debugging history

- Dialog previously failed to find the app root because Shadow DOM #app was confused with the top-level document. Always resolve the correct ShadowRoot mount.
- A prior toast/mount issue came from appending more than one element to a Document; mount under document.body or the intended ShadowRoot.
- CSP Report-Only logs showed many blob:https://chatgpt.com/... executions from an earlier module loader. That loader was replaced with a classic bundle in the Tampermonkey sandbox. Do not reintroduce Blob module execution.
- Bridge timeout was traced to a message listener being removed after the initial ready handshake; preserve the listener for subsequent requests.
- Broker discovery uses per-tab heartbeat keys with prefix cgm:broker:v1:heartbeat:. Recheck current code before changing the heartbeat protocol.
- Scrollbar problems were previously related to flex sizing/overflow and Shadow DOM CSS. Avoid speculative CSS-only patches; inspect the actual scroll container and computed layout.
- Conversation pagination previously stopped too early and failed to load on scroll; the table wrapper was identified as a real scroll container. Inspect current event binding before changing it.

## Collaboration preferences

- User prefers Persian, direct and practical explanations.
- User expects the assistant to inspect current GitHub source before editing, make the changes directly when tools permit, and report exact commits.
- Do not ask the user to manually edit code or copy secrets.
- Do not claim a commit, syntax check, endpoint verification, or browser test unless actually performed.
- When endpoint behavior is uncertain, say exactly what is unverified and request only the minimum redacted diagnostic data needed.
- Keep responses concise; avoid repeating background unnecessarily.

## Last reviewed state

This memory file is being added after reviewing the current main versions of:
- Index.html
- ChatGPTManager.user.js
- TamperBootstrap.js
- API/ChatGPTApi.js
- Modules/Projects/ProjectService.js
- README.md

The current code confirms version 0.7.4 and the assumed result.cursor project-pagination implementation. It does not establish that the live endpoint actually returns that cursor.
