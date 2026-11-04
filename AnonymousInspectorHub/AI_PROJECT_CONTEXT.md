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
3. **The assistant must not directly modify the code repository.** Do not create/update/delete source files, commit, push, open PRs, or otherwise write to GitHub on the user's behalf.
4. **Normal code-editing workflow:** first fetch/read the current GitHub version of the exact file; understand it and compare the requested change against it; then provide the complete revised file in the chat, one file per response, with the smallest necessary changes. The user applies the code in their own environment and updates GitHub. Do not provide a patch or invented reconstruction when the agreed workflow calls for a complete file.
5. **One-file-at-a-time delivery.** When multiple files need changes, work in the agreed order and deliver one complete file per response. Do not dump several files together.
6. **No unrequested scope expansion.** Do not refactor, rename, redesign, or alter finalized/unrelated files. Preserve the existing project structure and conventions.
7. **Read before proposing/editing.** Verify actual paths, dependencies, current source, and state from GitHub. Never assume a filename or architecture from an earlier chat if current source can be inspected.
8. **The only currently authorized GitHub write exception:** the user explicitly authorized creating and maintaining this single persistent memory file, `AnonymousInspectorHub/AI_PROJECT_CONTEXT.md`, so project context can survive across chats. This exception is limited to this memory file. It does not authorize direct edits to code or any other repository file.
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

The user explicitly stated that the current task is **only WebStructureInspector**. Older notes about `main.js`, `AdminPanel_Viewer`, and other prior-stage files must not be mixed into the current work unless the user explicitly reopens them or an actual dependency is demonstrated from current source.

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
2. Remember the no-file-exchange and no-direct-GitHub-code-edit contract.
3. Treat GitHub as the shared source of truth; use the project root and live root in Section 1.
4. Ask/identify the user's current requested scope. Unless explicitly changed, it is WebStructureInspector only.
5. Fetch the exact current GitHub source files needed for that task.
6. Explain the smallest necessary change and the file order.
7. Provide one complete revised file per response in chat; the user applies it and updates GitHub.
8. Do not directly write to GitHub. The sole currently authorized exception is maintaining this `AI_PROJECT_CONTEXT.md` file.
9. Keep implemented facts separate from proposals and unknown history. Never fill gaps by guessing.
