# Anonymous Inspector Hub — Project Memory & Working Contract

> **Mandatory first read in every new project chat.** This file is the shared handover for the project's purpose, decisions, collaboration contract, history, current architecture, and active work. It is not permission to modify source code or to bypass the user's workflow.

## 1. Canonical project location

- GitHub repository: https://github.com/libertyir/TamperMonkeyAddOns
- Project directory and project-relative root: `AnonymousInspectorHub/`
- Live root: https://libertyir.github.io/TamperMonkeyAddOns/AnonymousInspectorHub/
- Default branch observed: `main`

All paths mentioned as project paths are relative to `AnonymousInspectorHub/`. For example, `Modules/WebStructureInspector.js` means `AnonymousInspectorHub/Modules/WebStructureInspector.js` in GitHub.

GitHub is the **shared language, shared reference, and canonical source of truth** between user and assistant. Use the live repository state, not stale copies or assumptions. The live URL root above is the base for project assets and pages.

## 2. Non-negotiable collaboration contract

This contract is more important than convenience and must be followed in every future chat:

1. **No source-file exchange as attachments.** The user does not want to download files from the assistant and upload files back, nor to send source files as chat attachments to bypass limits.
2. **GitHub is our shared workspace/reference.** The assistant should inspect the current source directly in the repository when a task requires it. The user and assistant communicate about code by referring to the repository paths and current GitHub contents.
3. **GitHub code writes require explicit, task-specific authorization.** Default to read-only access. Do not modify code, commit, push, or open PRs unless the user explicitly authorizes those actions and identifies the requested scope. A specific authorization applies only to that task; it is not blanket permission for future code changes.
4. **Normal code-editing workflow:** first fetch/read the current GitHub version of the exact file; understand it and compare the requested change against it; then provide the complete revised file in the chat, one file per response, with the smallest necessary changes. The user applies the code in their own environment and updates GitHub. Do not provide a patch or invented reconstruction when the agreed workflow calls for a complete file.
5. **One-file-at-a-time delivery.** When multiple files need changes, work in the agreed order and deliver one complete file per response. Do not dump several files together.
6. **No unrequested scope expansion.** Do not refactor, rename, redesign, or alter finalized/unrelated files. Preserve the existing project structure and conventions.
7. **Read before proposing/editing.** Verify actual paths, dependencies, current source, and state from GitHub. Never assume a filename or architecture from an earlier chat if current source can be inspected.
8. **Persistent memory file:** the user explicitly authorizes creating and maintaining `AnonymousInspectorHub/AI_PROJECT_CONTEXT.md`. This file may be updated to preserve project decisions and verified implementation history. This standing permission does not itself authorize code changes; code writes still require the task-specific authorization described in Rule 3.
9. Do not claim that code was applied, tested, committed, or deployed unless that actually happened. A file supplied in chat is a proposed revision until the user applies it.
10. The user prefers Persian, concise, direct, technically exact communication.

If any future instruction appears to conflict with this contract, ask before taking a GitHub write action. The user remains the person who applies and publishes code changes.

## 3. Project identity, concept, and goal

Project name: **Anonymous Inspector Hub**. It is a browser-side Tampermonkey add-on organized around a modular hub, with configurable settings and inspection modules.

Confirmed project characteristics:
- It is organized as a central userscript/hub with separately managed modules and settings UI.
- Modules can be enabled/configured through the hub rather than being treated as unrelated standalone scripts.
- Site/domain configuration controls where modules are allowed to run.
- The project includes data management and client-side cloud-storage settings/behavior.
- One of the inspection modules is WebStructureInspector, which collects and organizes information about a site's discoverable structure/resources.

The complete original product brief, initial motivation, intended audience, and all early-stage rationale from the two linked chats are **not fully present in the retrievable conversation summaries**. Do not invent them. If those details become necessary, retrieve the relevant original discussion or ask the user for the missing point. The facts and decisions recorded below are confirmed.

## 4. Confirmed project history and decisions

### 4.1 Hub and settings structure

The accepted settings sections are:
- `GeneralUI`
- `SitesUI`
- `ModulesUI`
- `DataManagerUI`
- `CloudStorageUI`

No extra settings section should be invented.

Confirmed settings/domain decisions:
- Site rules must support a root domain such as `google.com` and wildcard subdomains such as `*.google.com`.
- A configured root domain plus its wildcard rule is intended to cover the root and its subdomains.
- Configured Sites are global/shared configuration, not isolated per currently visited site or tab.
- The configured site list should be accessible, searchable, and manageable from any site/tab.
- Configured domains/exceptions should be visible in the Settings UI across tabs/sections, as requested.
- **An empty module list means no modules run.** It must never be interpreted as “run all modules”.
- Preserve the established settings and module architecture. Avoid resetting the active settings tab during module toggles or rebuilding unrelated state.
- A prior inspection identified a possible mismatch where `main.js` did not consume `aih_sites_config`; this is historical context only. It is not current scope unless the user reopens it.

### 4.2 Module management and UI

- `ModuleManager` and `UIManager` were reviewed during earlier project work.
- The project proceeded through module-level review after the hub/settings work.
- A prior stage began reviewing `AdminPanel_Viewer`; the user later explicitly narrowed the active scope to WebStructureInspector and said not to carry that older file/order into the current task.
- Do not assume the older review queue remains active.

### 4.3 WebStructureInspector persistence and collector work

Confirmed decisions from the later implementation discussion:
- Persistent tree/data behavior was accepted.
- The settings file for this module is `Settings/WebStructureInspectorUI.js`, a sibling of the `Modules/WebStructureInspector/` directory.
- The user requested implementation through the agreed one-file-at-a-time process: inspect the current GitHub file, compare it, then provide the complete minimally changed file in chat.
- A Collector revision was described as preserving the existing GitHub formatting and limiting changes to queue persistence/error recovery, incremental DOM collection, additional resources, URL resolution, and `stop()` flushing. Treat that as a historical description; verify the current GitHub source before relying on it.

### 4.4 Current focus explicitly narrowed

The earlier WebStructureInspector-only scope was later expanded by the user to include the hub's Core/SiteIntelligence infrastructure, temporary resource caching, storage management, and tree memory/display behavior. The active scope is whichever concrete task the user currently specifies. Do not assume the older WebStructureInspector-only restriction still applies.

## 5. Current WebStructureInspector architecture (repository snapshot)

Main module:
- `Modules/WebStructureInspector.js`

Supporting files observed in its static dependencies:
- `Modules/WebStructureInspector/WebStructureInspector.ResourceStore.js`
- `Modules/WebStructureInspector/WebStructureInspector.ResourceAnalyzer.js`
- `Modules/WebStructureInspector/WebStructureInspector.Collector.js`
- `Modules/WebStructureInspector/WebStructureInspector.DirectoryScanner.js`
- `Modules/WebStructureInspector/WebStructureInspector.SensitiveScanner.js`
- `Modules/WebStructureInspector/WebStructureInspector.Grabber.js`
- `Modules/WebStructureInspector/WebStructureInspector.TreeBuilder.js`
- `Modules/WebStructureInspector/WebStructureInspector.UIManager.js`

Settings UI:
- `Settings/WebStructureInspectorUI.js`

Observed responsibilities:
- `ResourceStore`: stores resource records, including per-origin persistence.
- `ResourceAnalyzer`: normalizes/analyzes candidate URLs and classifies resource type/tags.
- `Collector`: collects current-page DOM/performance resource observations.
- `DirectoryScanner`: checks same-origin directory-listing pages and extracts entries.
- `SensitiveScanner`: checks candidate sensitive filenames/content within its configured limits.
- `Grabber`: traverses pages and extracts links/resources under its configured scope/limits.
- `TreeBuilder`: builds a hierarchical tree from resource records.
- `UIManager`: renders and operates the resource explorer.

The main module loads dependencies and constructs these services. This is a snapshot description, not proof that all behavior is complete or correct. Always fetch the latest source before any code recommendation.

## 6. Active WebStructureInspector design proposal: unified discovery and central validation

The user proposed this architecture:

1. Discovery sources (Grabber, Scanner/Sensitive Scanner, Directory Browsing, and other existing discovery routes where appropriate) produce candidate file records.
2. Candidates are submitted to one unified list/queue. Discovery sources should not each run separate, duplicated validation logic.
3. A central scanner processes that unified candidate list.
4. For each candidate, send HTTP `HEAD` first.
5. If the response indicates a usable resource and actual content is needed, send `GET` only then.
6. `404`: ignore/remove as a valid discovered resource.
7. `403`: retain the candidate with an explicit access-denied/inaccessible status or tag.
8. Other HTTP statuses must be represented truthfully; do not mark an unverified result as valid.
9. Validated results flow into the existing shared store/results model and then the existing list/tree display.
10. Display live progress: current file, processed count, total count, current request/status, and overall progress.

Architectural separation:
- discovery,
- central validation/scanning,
- persistence/results,
- presentation/progress UI.

This is a **target design/proposal**, not a statement that the central scanner has already been implemented. Inspect the current code and identify the smallest integration points before proposing file changes.

Request constraints:
- Respect existing same-origin/scope rules, timeouts, response-size limits, and protections.
- Do not turn passive collection into uncontrolled broad crawling.
- Do not GET every candidate by default.
- Do not bypass browser security or follow unsafe cross-origin redirects.
- Preserve truthful HTTP status/access-state information.

## 7. Current verified source inventory

The following files were fetched/inspected from branch `main` while preparing the first version of this memory:
- `Modules/WebStructureInspector.js`
- `Modules/WebStructureInspector/WebStructureInspector.ResourceStore.js`
- `Modules/WebStructureInspector/WebStructureInspector.ResourceAnalyzer.js`
- `Modules/WebStructureInspector/WebStructureInspector.Collector.js`
- `Modules/WebStructureInspector/WebStructureInspector.DirectoryScanner.js`
- `Modules/WebStructureInspector/WebStructureInspector.SensitiveScanner.js`
- `Modules/WebStructureInspector/WebStructureInspector.Grabber.js`
- `Modules/WebStructureInspector/WebStructureInspector.TreeBuilder.js`
- `Modules/WebStructureInspector/WebStructureInspector.UIManager.js`
- `Settings/WebStructureInspectorUI.js`
- `AnonymousInspectorHub.user.js` (registration/dependency context only)

This inventory can become stale. The repository's current file contents always take precedence.

## 8. Resume procedure for every new chat

1. Read this entire `AI_PROJECT_CONTEXT.md` first.
2. Remember the no-file-exchange preference and the task-specific GitHub authorization rule.
3. Treat GitHub as the shared source of truth; use the project root and live root in Section 1.
4. Identify the user's current requested scope; do not assume the old WebStructureInspector-only scope.
5. Fetch the exact current GitHub source files needed for the task.
6. Make the smallest necessary change and preserve unrelated files and structure.
7. For small changes, provide only the exact snippet and location when the user is applying changes; for large changes, provide the complete file inline. If the user explicitly authorizes a GitHub commit for that task, the assistant may apply and commit only the authorized scope.
8. The assistant may maintain this `AI_PROJECT_CONTEXT.md` file under the user's standing authorization.
9. Keep implemented facts separate from proposals and unknown history. Never fill gaps by guessing.

## 9. Current work update — independent scanner dialog

The active work has advanced to the scanner dialog within WebStructureInspector.

Confirmed user decision:
- The scanner dialog must operate independently of the UI workflow and refresh lifecycle of the other project sections.
- It must not depend on, trigger, or be disrupted by the UI of GeneralUI, SitesUI, ModulesUI, DataManagerUI, CloudStorageUI, or other unrelated hub sections.
- The scanner dialog itself has been constructed. Do not assume the scanner's complete processing pipeline is already implemented merely because the dialog exists.

Next task is analysis, not immediate implementation:
1. Inspect the current GitHub source to establish exactly what the scanner dialog already does and how it is opened, updated, and closed.
2. Trace the existing discovery outputs from Grabber, Directory Browsing/DirectoryScanner, and SensitiveScanner (and any other relevant discovery path).
3. Determine how candidate paths/files can be collected into one shared queue/list without duplicating discovery or validation logic.
4. Identify whether a central HEAD-first validation/scanning component already exists, and what is missing.
5. Trace how results/statuses can be delivered incrementally to the independent dialog and existing ResourceStore/tree without coupling it to unrelated UI refreshes.
6. Report the actual implemented state, missing pieces, dependencies, and the smallest safe implementation order before changing code.

Keep the proposed central-scanner behavior in Section 6 as the target design, not as implemented functionality. Continue to fetch current GitHub files before analyzing or changing them. The no-direct-GitHub-code-edit rule remains in force; the existing exception permits writes only to this memory file.


## 10. Current verified implementation update — temporary resource cache, tree memory, and Storage UI

This section supersedes older status notes where they conflict. The repository state and commits listed here were checked against branch `main` on 2026-11-07.

### 10.1 Recent verified commits

- `c91e66bf33faa430083ed399e881dcdf6f159274` — Storage UI management improvements. Added visibility and management for application storage records and nested metadata entries.
- `322cf180ca49b48f16eaebabbf8ced25381e18d9` — Added temporary resource cache and reduced tree memory copies. Changes included:
  - `Core/SiteIntelligence/ResourceScanner.js`
  - `Core/SiteIntelligence/ResourceRepository.js`
  - `Core/SiteIntelligence/SiteIntelligenceService.js`
  - `Core/SiteIntelligence/SiteStructureManager.js`
  - `Core/ServiceFactory.js`
  - `Settings/StorageUI.js`
  - `Modules/WebStructureInspector/WebStructureInspector.UIManager.js`
- `e7d1be00a5437c34b764933c7bf355c2368a3ec2` — Fixed Storage UI access to Tampermonkey GM APIs through the central Framework bridge. Changes:
  - `Core/Framework.js`
  - `Core/ServiceFactory.js`
  - `Settings/StorageUI.js`

### 10.2 Temporary resource cache — implemented behavior

- Temporary resource entries use the GM storage key prefix `aih_temp_`.
- Default lifetime is 15 minutes.
- Keys encode expiration timestamp, stored-size metadata, and a hash of the resource URL. The URL itself is not used as the storage key.
- Allowed content types are HTML, CSS, JavaScript, and plain text. JSON/Swagger and binary resources are not cached.
- Content is gzip-compressed when the browser supports `CompressionStream`; otherwise it is stored as Base64-encoded UTF-8.
- Cache reads are lazy: listing Storage metadata does not read payloads into RAM; the payload is read and decoded only when a module requests that resource.
- Expired/malformed temporary entries are removed during cleanup. A periodic cleanup runs while the scanner is initialized.
- If no valid temporary cache entry exists, the resource is fetched again.
- The temporary cache is separate from persistent findings/application stores. Storage UI has a dedicated Temporary Resource Cache section, supports individual deletion, and can clear all keys with the `aih_temp_` prefix.
- Cache read/write failures are caught and logged so they do not prevent the resource request from proceeding.
- Important implementation caveat: the current key includes expiry and URL hash, and the writer removes prior keys matching the URL hash before writing. Storage UI can enumerate and bulk-delete by prefix. Do not claim that GM Storage itself enforces TTL; cleanup is performed by application code.

### 10.3 Resource and tree memory behavior

- ResourceScanner no longer persists fetched response bodies in ResourceRepository as part of its normal scan result.
- Stored resource records no longer retain response headers from the scanner's fetched response; header data is not copied into the tree records.
- The tree uses a lightweight projection of resource records rather than cloning full records/payloads.
- ResourceRepository exposes a lightweight structure-record retrieval path used by SiteStructureManager to rebuild the tree.
- WebStructureInspector tree labels decode percent-encoded names for display, limit the visible label to 25 characters, and retain the full decoded name in the element's `title` tooltip.
- This does not prove total per-tab RAM usage is now bounded to a specific number. Browser profiling and runtime verification are still required to quantify actual memory use.

### 10.4 GM storage bridge fix

- StorageUI previously called legacy global identifiers such as `GM_getValue` and `GM_listValues` directly. In the current execution context these were not reliably available, causing: `Storage read failed: GM storage APIs are unavailable.`
- Framework now exposes a `GM` facade with `getValue`, `setValue`, `deleteValue`, and `listValues`.
- ServiceFactory routes those operations to the Kernel's GM API object.
- StorageUI now uses the Framework facade for listing, reading, deleting regular GM entries and temporary cache entries.
- The three changed files passed JavaScript syntax checks after commit. Browser runtime behavior has not yet been independently verified.

### 10.5 Current next verification

After updating/reloading the userscript, verify in a real browser:
1. Storage UI opens and reads regular GM keys, application stores, and temporary cache entries without the previous GM API error.
2. Temporary cache records appear under the dedicated section and can be individually deleted or cleared as a group.
3. A second request for an eligible resource can use the temporary cache; after expiry or manual deletion, it is fetched again.
4. JSON/Swagger and binary content are not stored in the temporary cache.
5. Tree labels display at most 25 characters and show the full decoded name on hover.
6. The tree remains functional after the lightweight record projection, especially directory-listing metadata and status/tag behavior.

Do not claim these browser checks passed until they are actually performed.


## 11. Current project state — module architecture and file viewers (2026-11-08)

This section records recent Anonymous Inspector Hub work discussed and committed during the current project conversation. The latest repository branch observed after the file-viewer additions was main at commit 46206e18f9dff7021f3220b5861ac16dbaa7161b. Always re-fetch current files before relying on this snapshot.

### 11.1 Module architecture and naming

- The user standardized descriptor filenames without the _Module suffix: for example, GitConfigModule.js, not GitConfig_Module.js.
- Component filenames retain role suffixes, including _Provider.js; the user specifically requested readable formatting, indentation, and non-minified source.
- The user explicitly excluded DebugModeInspector and WebStructureInspector from an earlier batch migration; later the user explicitly authorized converting WebStructureInspector as well.
- Desired separation remains: descriptor registers components; Provider matches resource types and resolves stored results; Viewer presents results; Scanner performs scan/network work. Do not add a Scanner to modules that the user explicitly says do not need one.
- Do not assume previous claims that every module is fully migrated or runtime-tested are true. Verify actual current source and behavior.

### 11.2 Scan scheduling and cache contract — critical

The user has repeatedly clarified the exact expected behavior. Treat these as hard requirements:

1. Loading the userscript/module definitions and running scans are separate actions.
2. On page entry, modules/components may be loaded and valid prior results may be restored for display, but no scan should start automatically.
3. A normal Play request is non-forced. Before a module enters the scan queue or its Scanner is invoked, its Provider must determine whether a valid result already exists for the exact resource/scope.
4. If a valid, unexpired result exists, skip the module entirely. Do not invoke its Scanner and do not send even a preliminary network request to re-check the URL. This must hold on repeated Play presses, even 100 times.
5. Results must be scoped correctly. Some modules are site/origin scoped; others are directory/path scoped. Do not collapse distinct scopes or treat a result for one directory as valid for another.
6. Stop halts the current operation and must not advance to the next queued module. A subsequent Play resumes pending work, including newly registered modules, while continuing to skip still-valid cached results.
7. Refresh is the explicit invalidation route: stop the process, remove prior scan records/results and temporary/resource cache for the current website/scope, then allow a fresh scan from the beginning.
8. A Force scan capability has not yet been implemented. Do not silently treat ordinary Play as Force.
9. Negative but successfully completed findings (e.g. “not found”) should be cacheable as completed results until their TTL expires; real errors/exceptions must not be mislabeled as successful negative findings.
10. Provider-side gating is essential. A queue-only check is insufficient because direct calls to ModuleManager/Scanner must not bypass the cache policy.

Recent code work attempted to introduce BaseProvider.shouldScan(), Provider cache gating, and a non-always TTL for WebStructureInspector. These changes were committed in the conversation as 741bd6aeaa0f8ea28c916ecdc59d7fae88bc3dda and f37d2cdbd06e10241523d1ed4c96ac12639bede5. The user subsequently reported repeated rescans despite existing data, so the cache contract is not considered verified or fixed until a browser test proves that repeated normal Play causes zero scanner/network requests for valid cached scopes. Investigate the actual current implementation before making further claims.

### 11.3 Main menu and progress controls

The user requested a distinct row at the bottom of the main menu with Play, Stop, and Refresh:
- Play performs only required non-forced scans.
- Stop halts and preserves pending progress.
- Refresh stops, clears current-site scan/temp/cache data, and enables a full rescan.
- Progress UI is positioned to the left of the floating menu button, independently of whether the menu is open.
- Progress must not overlap the scanner/menu button, must not cover the menu, and must never lock/disable menu interaction.
- The floating button keeps its normal menu icon when idle and uses a spinner/rotation state while processing, returning to the menu icon afterward.
- A previous layout adjustment set a fixed 48px progress bar height, single-line text, and a wider bar. Verify current CSS and actual viewport behavior rather than assuming no overlap.

### 11.4 WebStructureInspector Viewer matching issue

The user reported that unrelated viewers, especially HTTP Status Viewer, were appearing beside many unrelated file types in WebStructureInspector's resource list.

A fix was committed as 92f14d61f722cf63165cc2276b5cbc4d43fd59b7:
- Tightened several broad site-level Provider matchers (AdminPanel, CommonTestFiles, ServerInfo, Status) so they do not indiscriminately match ordinary file resources.
- Passed resource classification details (type, extension, tags, content type) from WebStructureInspector.UIManager into Viewer lookup.

This needs real browser verification. If unrelated viewers still appear, inspect the full matching pipeline and each Provider's matcher. Do not assume passing extra metadata alone makes all matchers precise.

### 11.5 New modules — Plain Text Viewer and Image File Viewer

The user explicitly requested two new modules, added to the repository and registered in AnonymousInspectorHub.user.js. No dedicated Scanner is required for either module; they open/read the selected resource through the existing binary request bridge.

Files added:
- Modules/FileViewerHash.js — shared file reading and MD5/SHA-256 helper.
- Modules/PlainTextViewerModule.js
- Modules/PlainTextViewer/PlainTextViewer.js
- Modules/PlainTextViewer/PlainTextViewer_Provider.js
- Modules/ImageFileViewerModule.js
- Modules/ImageFileViewer/ImageFileViewer.js
- Modules/ImageFileViewer/ImageFileViewer_Provider.js

Registration was added to AnonymousInspectorHub.user.js for PlainTextViewerModule and ImageFileViewerModule.

Plain Text Viewer intended support includes common text/source extensions such as TXT, LOG, CSS, JS, JSON, XML, HTML, SVG, YAML, SQL, Python and related formats. It preserves whitespace in a monospace code view, identifies a language label from extension/content type, provides copy, and displays MD5 and SHA-256. Current preview limit: 2 MiB. Syntax highlighting/colorized token rendering is not implemented yet; the current code view is plain monospace.

Image File Viewer intended support includes ICO, PNG, JPG/JPEG, GIF, WebP, BMP, AVIF, SVG and TIFF. It previews the image and displays file size, MD5 and SHA-256. Current preview limit: 20 MiB. It revokes its generated object URL when destroyed.

Shared helper details:
- SHA-256 uses Web Crypto crypto.subtle.digest.
- MD5 is implemented in the shared helper.
- Binary content is obtained via Framework.requestArrayBuffer(url), which routes through the existing KernelEnvironment request bridge. Do not replace this with an independent raw fetch or an invented API.
- The helper is exposed as globalThis.AnonymousInspectorFileViewerHash for the two Viewer files.
- Each JavaScript file is short (well below the user's 400-line threshold); helper logic is shared rather than duplicated.

Important pending verification:
1. Confirm the module descriptors load the shared helper exactly once or safely tolerate it being registered from both descriptors.
2. Confirm Provider matching is correct for file resources and does not conflict with other file viewers.
3. Confirm the ViewerHost passes the selected resource URL under context.url or context.fileUrl; adjust only after inspecting the actual contract.
4. Confirm Framework.createElement supports the attributes/append behavior used by the new viewers, and confirm Framework.copy exists in the current public API.
5. Test binary request behavior and verify that requestArrayBuffer returns a true ArrayBuffer without text conversion.
6. Validate MD5 against known test vectors (empty string and abc) and SHA-256 against a known vector.
7. Test representative files, CORS/same-origin behavior, large-file limits, ICO, animated GIF, and SVG handling.
8. Check whether the current viewer lifecycle calls destroy() so object URLs are reliably released.
9. Test in an actual browser/Tampermonkey session. No browser runtime test has yet been confirmed for these modules.

### 11.6 Current immediate status

The latest user request was to update this project memory on GitHub. This memory update is authorized by the standing exception in Section 2; it does not grant permission to edit other source files. The last source-code work added Plain Text Viewer and Image File Viewer; the next technical step should be runtime verification and correction of those modules only when the user asks to continue.

## 12. AssetManager — initial implementation (2026-11-08)

The user explicitly authorized implementation of an independent asset cache and specified that it must use Tampermonkey GM storage, not IndexedDB. The cache is global to the userscript and is not scoped to the current website or tab.

### 12.1 Files added or changed

- Added `AssetManager.js` — standalone bootstrap/cache manager, loaded before `main.js` through userscript `@require`.
- Added `AssetManifest.json` — data-only manifest listing project JavaScript and JSON assets, with an independent version per asset.
- Updated `AnonymousInspectorHub.user.js` — requires AssetManager before main.js.
- Updated `main.js` — initializes AssetManager before loading Kernel.
- Updated `Core/Kernel.js` — bootstrap components are read from AssetManager rather than downloaded individually.
- Updated `Core/KernelEnvironment.js` — project-origin text assets are served from AssetManager; external-site requests and binary requests retain the existing GM network path.

### 12.2 Confirmed configuration and behavior in the committed source

- Asset cache is stored with `GM_getValue` / `GM_setValue`; removed asset keys are cleaned with `GM_listValues` / `GM_deleteValue`. No IndexedDB is used by AssetManager.
- Cache keys use the global prefix `aih_asset_manager_v1:asset:`; they are not keyed by website, origin, tab, or current page.
- `AssetManifest.json` is requested on every AssetManager initialization with a cache-busting query and no-cache headers. If that request fails, the last saved manifest is used as an offline fallback.
- Current manifest setting is `ForceLoad: false`: a matching cached version is reused; a missing or version-mismatched asset is downloaded.
- Every asset has its own `version`. Increment only the changed asset's version when its content changes. The manifest itself is always requested separately.
- Asset downloads run concurrently with a manifest-configurable limit (currently 16). Execution remains lazy and follows the existing loaders' established order.
- A failed update does not overwrite a previous cached copy. If a previous copy exists it remains available; a successfully downloaded fresh copy is also kept in memory even if GM cache persistence fails.
- Cache entries for paths removed from the manifest are cleaned up.
- AssetManager is not a replacement for the application's existing scan/result/data cache. It only handles project static assets.
- `EntryPoint` is currently `main.js`; main.js remains the userscript entry bootstrap. AssetManager initializes before Kernel/Core loading.
- AssetManager and the manifest are intentionally excluded from the manifest's own Assets list; main.js is the declared EntryPoint, not a cached project asset.

### 12.3 Current verification and limitations

- JavaScript syntax checks passed for `AssetManager.js`, `main.js`, `Core/Kernel.js`, and `Core/KernelEnvironment.js` after the initial integration.
- The manifest parsed successfully and contained 145 project JS/JSON assets at the time of implementation. Kernel.js and KernelEnvironment.js are marked required and their asset versions were bumped to 1.0.1.
- This is source-level verification only. The complete userscript has not yet been tested in a live Tampermonkey browser session. In particular, verify GM storage persistence across different sites, first-run downloads, second-run cache hits, a single-file version bump, ForceLoad behavior, offline manifest fallback, removed-asset cleanup, and binary viewer requests.
- Do not claim browser-level behavior is verified until those tests are run.



---

# 13. Full handover snapshot — 2026-11-14

This section is the newest handover snapshot and takes precedence over any conflicting older status in this file. It was prepared from the current GitHub `main` source on 2026-11-14. Preserve older history below/above as historical context; do not treat old configuration values as current when this section explicitly supersedes them.

## 13.1 User's local working copy and repository

- User's local repository path (Windows): `D:\\GithubSources\\TamperMonkeyAddOns`
- Repository: `libertyir/TamperMonkeyAddOns`
- Branch inspected: `main`
- Project directory: `AnonymousInspectorHub/`
- Live project root: `https://libertyir.github.io/TamperMonkeyAddOns/AnonymousInspectorHub/`
- Shared source of truth for collaborative review remains the current GitHub branch, while the user's local working copy is at the path above.
- When a new project/chat resumes, read this entire file first, then inspect the actual current source/branch state before relying on any recorded implementation detail.

## 13.2 Strict working contract — restated

- User's language is Persian. Respond in Persian, directly and technically, with minimal unnecessary explanation.
- User does not want to exchange source files as downloads/uploads. Inspect source in the shared repository and provide inline code when the agreed workflow calls for user-applied changes.
- GitHub source-code operations are read-only by default. Do not write, commit, push, create PRs, or modify source files without explicit authorization for that specific task.
- Standing exception: the user explicitly authorizes maintaining this `AI_PROJECT_CONTEXT.md` memory file. This does not authorize writes to any other file.
- Before changing code, inspect the exact current file and its dependencies. Do not guess source or rely on stale snippets.
- Small code changes: show the exact snippet and line location. Large changes: provide the complete file inline. One file per response unless user explicitly asks otherwise.
- Preserve formatting and existing architecture. No unsolicited refactors, broad rewrites, unrelated fixes, or unnecessary comments/whitespace.
- Do not claim a fix, test, commit, or deployment unless actually completed.
- GitHub access must be treated as read-only unless the user explicitly grants a task-specific exception.

## 13.3 AssetManager — current source state checked 2026-11-14

Files currently present in the repository:
- `AssetManager.js`
- `AssetManifest.json`
- `AnonymousInspectorHub.user.js`
- `main.js`
- `Core/Kernel.js`
- `Core/KernelEnvironment.js`

Current values read directly from `AssetManifest.json`:
- `Version: "1.0.0"`
- `ForceLoad: true`
- `EntryPoint: "main.js"`
- `MaxConcurrency: 16`
- `RequestTimeout: 20000`
- `Assets.length: 145`
- Required assets: 27
- Optional assets: 118

Current AssetManager source:
- AssetManager implementation constant is `VERSION = "1.0.1"`.
- Userscript requires `AssetManager.js?v=1.0.1` before `main.js?v=1.5.2`.
- Userscript metadata version is currently `1.1.3`.
- AssetManager uses legacy Tampermonkey GM functions: `GM_getValue`, `GM_setValue`, `GM_xmlhttpRequest`, `GM_listValues`, and `GM_deleteValue`.
- GM cache key prefix is `aih_asset_manager_v1:asset:`; manifest fallback key is `aih_asset_manager_v1:manifest`.
- Asset cache is global to this userscript installation and is not partitioned by current website, origin, page, or tab.
- No IndexedDB is used by AssetManager. The project's separate existing `Storage/IndexedDBAdapter.js` may still exist for the application's other storage mode; do not confuse that with AssetManager's cache.
- The AssetManager always requests `AssetManifest.json` from the network with cache-busting/no-cache headers. If manifest download fails, it attempts to use the last stored manifest.
- With `ForceLoad: true`, every manifest asset is fetched again at startup, even if a cached copy exists. Successful downloads replace the GM cache and populate the in-memory map.
- Downloads use bounded parallel workers; current configured concurrency is 16 (implementation clamps the value to 1–32).
- Asset execution remains lazy and ordered by the existing Kernel/Core/Module loaders; download concurrency does not imply parallel code execution.
- Failed asset downloads preserve a previous cached copy. A failed required asset without a usable prior copy causes initialization to fail; optional asset failures are logged.
- Asset paths removed from the manifest are cleaned from the AssetManager GM key namespace when GM list/delete APIs are available.
- `AssetManager.getText(path)` is the interface used by the bootstrap and Kernel to retrieve downloaded project text assets.
- `KernelEnvironment.request()` routes same-origin project text assets to AssetManager when initialized; external-site requests and arraybuffer/binary requests continue through the existing GM network path.
- AssetManager is strictly separate from the scan-result/temp-resource cache and from application data storage.
- `main.js` calls `assetManager.initialize()` before attempting to load the Kernel.
- `Core/Kernel.js` gets bootstrap source using AssetManager and executes components in its established sequence using `new Function(source + "\\n//# sourceURL=" + url)()`.
- The manifest currently records the main project's JS/JSON assets; do not add/remove assets or change their versions without inspecting the actual tree and receiving the appropriate user instruction.

### 13.3.1 Critical user instruction — ForceLoad and versioning

This is an explicit, current user instruction from 2026-11-14 and overrides the older Section 12.2 statement that ForceLoad was false:

1. Keep `ForceLoad: true` in `AssetManifest.json`. Do not turn it off.
2. The user wants all listed assets downloaded again in the first startup phase every time, rather than reusing the previous asset cache for startup.
3. Do not perform any new versioning until the user explicitly says that versioning should begin. This prohibition applies to AssetManager's own version, userscript @require query version, manifest version, and individual asset versions. Do not bump versions as part of a fix unless the user explicitly authorizes it.
4. Do not alter ForceLoad or version values as a side effect of any unrelated fix.
5. The current verified values are the ones listed in Section 13.3. Keep them unchanged unless the user explicitly instructs otherwise.

## 13.4 Current startup error — exact root cause found in GitHub source

User-reported browser error on 2026-11-14:
```
[Anonymous Inspector] Startup failed: SyntaxError: invalid escape sequence
loading ... userscript ... :615
promise callback*loadKernel ... :598
startupPromise ... :663
startApplication ... :666
AnonymousInspector ... :688
At https://aashwast.ziplink.in/assets/js/:10
```

The current GitHub source was fetched and the relevant lines were inspected. The exact cause is in `main.js`, inside `loadKernel()`, where the source text for Kernel is passed to `new Function()`.

Current source fragment (as fetched from GitHub):
```javascript
const KernelClass = new Function(
    source +
    "\\nreturn globalThis.AnonymousInspectorKernel;" +
    "\\n//# sourceURL=" + KERNEL_URL
)();
```

The two backslashes in the JavaScript string literal mean the resulting generated function source receives the literal characters backslash + `n`, rather than an actual newline. The generated code therefore contains an invalid backslash sequence before `return` (and before the sourceURL comment), which causes the reported parse-time `SyntaxError: invalid escape sequence` in Firefox.

The intended source construction is to use a JavaScript newline escape (one backslash in the string literal):
```javascript
const KernelClass = new Function(
    source +
    "\nreturn globalThis.AnonymousInspectorKernel;" +
    "\n//# sourceURL=" + KERNEL_URL
)();
```

Important status:
- Root cause has been identified from the current GitHub source.
- **The source fix has NOT been applied.**
- No code file was changed as part of this memory update.
- Do not change version numbers or `ForceLoad` while fixing this.
- The next minimal code correction, when the user asks to apply it, is only to replace the doubled backslash escapes in these two `main.js` string literals with single newline escapes. Then run a syntax check and verify the generated Function source in a browser/Tampermonkey session.
- Do not mistake the userscript's stack line 615 for the location of the malformed escape in the downloaded Kernel source; the malformed generated source is assembled in `main.js` at the `new Function()` call.
- The `new Function()` use in `Core/Kernel.js` has a normal single newline escape in its source literal (`"\\n//# sourceURL="`) and is not the specific doubled-escape defect identified above.

## 13.5 Current userscript startup sequence

Verified from current source:
1. Tampermonkey loads `AssetManager.js?v=1.0.1` before `main.js?v=1.5.2` because of the order of `@require` directives.
2. `main.js` registers the settings menu command and creates the floating bootstrap UI as applicable.
3. `startApplication()` calls and awaits `AnonymousInspectorAssetManager.initialize()`.
4. AssetManager fetches the manifest, then all 145 assets according to `ForceLoad: true`, with up to 16 concurrent downloads.
5. `loadKernel()` retrieves `Core/Kernel.js` from `assetManager.getText()`.
6. `main.js` constructs the Kernel class dynamically using `new Function()`. This is where the current invalid escape defect occurs.
7. Once fixed, Kernel's `start()` loads Kernel components in order: KernelEnvironment, KernelConfig, SiteInitializer, ModuleRunner, ApplicationStartup.
8. Kernel loads CoreLoader and the remaining Core/Storage/UI components through the existing CoreLoader flow.
9. Existing service initialization, UI initialization, site initialization, and module load-only flow continue as before.
10. Module code loading and actual scan execution remain separate. Do not conflate AssetManager's eager file download with running modules or scanning a website.

## 13.6 Current project architecture and behavior constraints to retain

### Core/bootstrap and modules
- Core boot should be independent of the UI.
- Current boot chain starts from userscript → AssetManager → main.js → Kernel → CoreLoader → services/UI/modules.
- Keep module files in their established project folders. Do not introduce a generic `Resources` folder for modules.
- The user dislikes oversized source files, especially files above roughly 300–400 lines. Keep AssetManager as one compact file; do not split it into multiple files or expand it unnecessarily.
- AssetManager is a bootstrap facility, not a Core service and not part of the scan cache.
- Preserve execution order and dependencies even though static assets are downloaded concurrently.
- Existing application storage may support GM or IndexedDB according to its own adapter configuration; this does not change the GM-only requirement for AssetManager.
- SiteManager is responsible for per-site module loading policy and belongs after the relevant Core/Crypto initialization as established in prior architecture discussions.
- Settings should remain accessible through the small persistent settings control in the bottom/floating menu.
- The user previously specified that module code can be loaded into memory and old results restored without immediately scanning; the Play action is what starts eligible scans.

### Scan lifecycle and cache contract
- Loading a module/provider/viewer and executing its scanner are separate phases.
- On ordinary Play, a Provider must check for a valid unexpired cache entry for the exact scope before enqueueing/running a scanner. If valid data exists, the scanner must not run and no preliminary request to the target site should be made.
- Scope must distinguish site/origin and directory/path correctly.
- Stop pauses before the next module/task and preserves pending work; a subsequent Play resumes pending work and handles newly eligible modules while still skipping valid cache.
- Refresh stops work, clears temporary/site cache and prior scan results for the current site/scope, then allows a new scan.
- Force scan is a separate capability and must not be silently inferred from ordinary Play.
- A successfully completed negative result (for example a confirmed 404) may be cached with TTL; a real exception/network failure must not be recorded as a successful negative result.
- Provider-side cache gating is mandatory; queue-level gating alone is insufficient.
- The user has previously reported repeated scans despite valid stored data. Therefore this cache contract is still considered unverified until a real browser test proves repeated ordinary Play produces zero scanner/network requests for valid cached scopes.
- Do not claim the scan-cache behavior is fixed without that verification.

### WebStructureInspector and resource scanning
- The user proposed a unified discovery queue combining Grabber, directory browsing, sensitive scanning and other existing discovery sources.
- Candidate URLs should go through one central validation scanner, using HEAD first and GET only when needed.
- 404 should be omitted/removed as not found; 403 should be retained with an inaccessible/access-denied marker; other statuses must be represented truthfully.
- Results should feed the shared store/tree and the independent scanner dialog.
- Do not duplicate validation in each discovery source.
- Do not fetch every candidate body by default or expand into uncontrolled crawling.
- The scanner dialog should remain independent from unrelated settings/hub UI refreshes.
- The exact current implementation of this proposed unified scanner must be inspected before claiming it is complete.

### Storage and memory
- Temporary resource cache uses GM keys prefixed `aih_temp_`, default 15-minute lifetime, lazy payload reads, and supported text-like content types (HTML/CSS/JS/plain text); this is separate from AssetManager's `aih_asset_manager_v1:` keys.
- Tree records should remain lightweight: avoid persisting fetched response bodies or unnecessary response headers.
- WebStructureInspector path labels should decode percent-encoded names, display no more than 25 characters, and preserve the full decoded value in a tooltip.
- Storage UI should show aggregate size/management rather than dumping every record by default, consistent with the user's earlier UI direction.
- Never use IndexedDB for AssetManager, even if the main application has an IndexedDB adapter.

### Viewer modules
- PlainTextViewer and ImageFileViewer are present and registered in the userscript.
- Shared helper: `Modules/FileViewerHash.js`.
- PlainTextViewer files: `Modules/PlainTextViewerModule.js`, `Modules/PlainTextViewer/PlainTextViewer.js`, `Modules/PlainTextViewer/PlainTextViewer_Provider.js`.
- ImageFileViewer files: `Modules/ImageFileViewerModule.js`, `Modules/ImageFileViewer/ImageFileViewer.js`, `Modules/ImageFileViewer/ImageFileViewer_Provider.js`.
- Plain Text Viewer supports common text/source formats and displays MD5/SHA-256; preview limit recorded as 2 MiB.
- Image File Viewer supports common image formats and displays file size, MD5/SHA-256; preview limit recorded as 20 MiB and it should revoke generated object URLs on destroy.
- Browser/runtime behavior of these viewers remains to be verified; inspect current source and lifecycle before making claims.
- DebugModeInspector previously had a chain of interface errors (`detector.detect is not a function`, then `evidenceAnalyzer.analyze is not a function`, then `reportBuilder.build is not a function`). The user explicitly deferred this; do not resume it unless asked.

## 13.7 Recent historical commits and caveats

The following commit references are preserved from prior verified project notes; check current history before using them as proof of current source:
- `c91e66bf33faa430083ed399e881dcdf6f159274` — Storage UI improvements.
- `322cf180ca49b48f16eaebabbf8ced25381e18d9` — temporary resource cache and lighter tree records.
- `e7d1be00a5437c34b764933c7bf355c2368a3ec2` — Framework GM bridge / Storage UI fix.
- `741bd6aeaa0f8ea28c916ecdc59d7fae88bc3dda` and `f37d2cdbd06e10241523d1ed4c96ac12639bede5` — provider cache-gating attempts; user later reported rescans, so not verified as fixed.
- `92f14d61f722cf63165cc2276b5cbc4d43fd59b7` — tightened broad Viewer matching; browser verification remains necessary.
- `51f082b6` — Plain Text Viewer provider fix.
- `2475e2b3` — Image File Viewer provider fix.
- `ace92b54073c8e63dce5bc86bb2dfd3551f5938a` — Collector/WebStructureInspector validation behavior.
- `07a009cacf6ed9cc55cb333d27929e9e223f119f` — one DebugModeInspector detector instantiation fix; DebugModeInspector was later deferred due subsequent interface errors.
- `b69247f39672604fe8ce3893c8d34a900f` — dialog top-layer/z-index behavior.
- `55fce665c04c75cf1a1d1ad6933cf47a7` and `c21be90aba6f6b15d3b07865de47c7d24ae94731` — module/provider load and cache behavior work; verify current source before relying on behavior.
- Older commits and versions do not override the current explicit no-versioning instruction.

## 13.8 Immediate next step for the new project/chat

1. Read this file first.
2. Confirm the repository path is `D:\\GithubSources\\TamperMonkeyAddOns` for the user's local working copy and inspect current Git status before any local edit.
3. Confirm current GitHub `main` and local source are aligned before applying any patch.
4. The exact currently identified startup defect is in `AnonymousInspectorHub/main.js`, inside `loadKernel()`: two doubled-backslash string escapes are concatenated into generated source. The minimal intended correction is to change those two string literals from `"\\\\n...` to `"\\n...` (one backslash escape in the actual JavaScript source), without changing anything else.
5. Do not apply the correction unless the user asks to modify code; the present task only authorized this memory update.
6. Keep `ForceLoad: true` and every version unchanged.
7. After an authorized correction, run a JavaScript syntax check and test the actual generated Kernel function body; then request/perform a real Tampermonkey browser test. Do not claim browser verification before it happens.
8. Continue from the user's next explicit task; do not automatically resume unrelated Viewer, DebugModeInspector, UI, or scan-cache work.

## 13.9 Follow-up startup failure and collaboration preference (2026-11-14)

After the newline correction was deployed, the user reported that startup still failed with `AssetManager is not ready.` in `Core/Kernel.js:fetchBootstrapFile`, while AssetManager logged `initialized: true` and all 145 assets downloaded. This points to the dynamically loaded Kernel resolving `globalThis.AnonymousInspectorAssetManager` from a different userscript sandbox/global than the one that owns the initialized manager.

The correction passes the already initialized AssetManager instance explicitly from `main.js` into the Kernel constructor (`options.assetManager`), stores it on the Kernel, and uses `this.assetManager` in `fetchBootstrapFile()` and `this.kernel.assetManager` in `KernelEnvironment.request()`. This avoids relying on cross-sandbox global lookup. Local diff prepared in `main.js`, `Core/Kernel.js`, and `Core/KernelEnvironment.js`; after deployment, browser verification is still required before claiming the startup flow is fixed.

User workflow preference (explicitly stated 2026-11-14): do not make the user drive routine debugging by repeatedly asking for confirmation or sending unnecessary status prompts. Continue investigating independently when enough evidence exists. User authorizes direct GitHub pushes for requested work; manage all related local files together and push the complete set in one batch at the end, rather than delivering files individually. Ask only for information genuinely needed to proceed.

Follow-up for Viewer warnings (2026-11-14): AssetManager `Ready` output is an informational success log, not a warning. The PlainTextViewer and ImageFileViewer restoration failures were caused by `FileViewerHash.read()` checking `buffer instanceof ArrayBuffer`, which rejects cross-realm ArrayBuffers passed through the framework/userscript bridge. The fix detects cross-realm ArrayBuffers via their object tag, accepts typed-array views, and copies the exact view range into a local ArrayBuffer before hashing/decoding. Runtime confirmation remains pending until the user reloads the updated userscript.

## 13.10 GitConfig Viewer GitHub remote check

The GitConfig Viewer now includes a "Check GitHub Connection" action. It extracts GitHub remotes from `[remote "..."]` sections in `.git/config`, supporting HTTPS, git protocol, and SCP-style SSH remotes, deduplicates repositories, and checks each through the GitHub repository API. Successful responses show the repository full name/title, visibility, description, and web URL. A missing/non-success API result is reported as unavailable, private, or requiring authentication because GitHub intentionally does not distinguish private repositories from nonexistent repositories to unauthenticated callers. No repository metadata is fetched until the user clicks the button. Current check does not obtain or transmit a GitHub credential; it reports the access available to the userscript's API request.

## 13.11 Sensitive Data Inspector initial implementation (2026-11-14)

User requested a new module that continuously observes the active page, shows findings in a cascading list grouped by page URL (not a tree), and masks every matched value until the user clicks Reveal. Email addresses and phone numbers are explicitly excluded. The implementation is `Modules/SensitiveDataInspectorModule.js`, registered as an auto-initialized module and added to the userscript module list and manifest. It monitors current document text, HTML comments, and inline script/style text via a debounced MutationObserver; supports stop/resume and clear controls; groups findings in memory by `location.href`; and clears results on module destruction. It checks private key blocks, GitHub tokens, AWS access keys, Slack tokens, Stripe secret keys, JWTs, and secret/password/token assignments. It does not send page contents to a remote service or persist findings. Values are masked in the UI and revealed individually on click. This is an initial review build; browser interaction and false-positive behavior are not yet verified.
