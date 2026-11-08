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

