# Anonymous Inspector Hub — AI Project Context

> Read this file first when continuing work on this repository in a new chat. Treat it as the project handover and working instructions, not as permission to change unrelated code.

## Repository and URL roots

- GitHub repository: https://github.com/libertyir/TamperMonkeyAddOns
- Project directory: `AnonymousInspectorHub/`
- **Project root for all paths in this project:** `AnonymousInspectorHub/`
- Live project root (GitHub Pages): https://libertyir.github.io/TamperMonkeyAddOns/AnonymousInspectorHub/
- Live module asset root: https://libertyir.github.io/TamperMonkeyAddOns/AnonymousInspectorHub/Modules/WebStructureInspector/
- Default branch: `main`

When the user says “project root”, resolve paths relative to `AnonymousInspectorHub/`, not the repository root. Live URLs must be formed from the GitHub Pages project root above.

## Collaboration rules

1. Inspect the current GitHub version of the relevant file before editing it. Do not reconstruct files from memory or from old chat snippets.
2. Work only on the scope the user names. The current active scope is **WebStructureInspector**.
3. Do not drift into `main.js`, `AdminPanel_Viewer`, or unrelated Anonymous Inspector Hub modules unless the user explicitly asks or a verified dependency makes it necessary.
4. Preserve the existing architecture and behavior outside the requested change. Avoid broad refactors, speculative renames, and parallel/duplicate implementations.
5. Make the smallest necessary changes. Keep existing file/class naming and separation unless the user approves a change.
6. Do not claim a file was changed, tested, or deployed unless the corresponding action actually succeeded.
7. Before editing, identify which existing files need edits and which genuinely new files are required. Explain the order briefly; do not invent filenames before inspecting the code.
8. Treat the user's latest explicit instruction as authoritative if it conflicts with older notes in this file.
9. Keep responses concise and practical. The user prefers Persian, direct explanations, and no unnecessary alternatives.

## Current active work: WebStructureInspector

Main module:
- `Modules/WebStructureInspector.js`

Supporting files currently declared by that module in `static dependencies`:
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

The main module loads the supporting scripts sequentially from the live module asset root, then creates the ResourceStore, ResourceAnalyzer, Collector, DirectoryScanner, SensitiveScanner, Grabber, TreeBuilder, and UIManager instances. The ResourceStore persists records per origin. Collector passively records current-page DOM references and browser performance resources. DirectoryScanner parses same-origin directory-listing HTML. SensitiveScanner checks configured candidate filenames/content. Grabber traverses pages and extracts links/resources. TreeBuilder turns records into a hierarchy. UIManager renders and operates the explorer.

These are descriptions of the current repository snapshot, not a claim that every implementation is complete or bug-free. Always re-read live source before changing behavior.

## Agreed design proposal — unified file discovery and validation

The user proposed separating discovery from validation and display:

1. Discovery sources (Grabber, Scanner/Sensitive Scanner, Directory Browsing, and other existing discovery paths as applicable) produce candidate file records and submit them to one shared collection/queue.
2. A central scanner processes that unified candidate list.
3. For each candidate, issue HTTP `HEAD` first.
4. If the response indicates a usable file and content is actually needed for analysis, then issue `GET`.
5. A `404` candidate is ignored/not included as a valid resource.
6. A `403` candidate is retained with an explicit access-denied / inaccessible tag or status.
7. Other HTTP outcomes are represented accurately; do not silently label them as valid.
8. Final validated records are sent to the existing ResourceStore/results model and then reflected in both the existing list and tree view.
9. Show a live processing dialog/progress view indicating which files are being processed, plus processed/total counts and current status.

Important architecture principle: **discovery, validation/scanning, persistence/results, and presentation are separate responsibilities.** Discovery sources should not each implement their own competing validation logic.

This is an agreed proposal/target design only. Do not assume it has already been implemented. Before choosing edit order, inspect all current WebStructureInspector files and determine the smallest correct integration points.

## Safety and request constraints for this feature

- Keep requests within the module's existing allowed origin/scope rules unless the user explicitly changes them.
- Preserve request timeouts, response-size limits, and existing protections.
- Do not turn passive collection into automatic broad crawling.
- Do not issue GET for every candidate by default; GET is conditional on a real content-analysis/display requirement.
- Do not follow cross-origin redirects or bypass browser/security restrictions.
- Record HTTP status and access state truthfully.

## Verified baseline snapshot

At the time this context file was prepared, the following GitHub files were inspected on branch `main`:

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
- `AnonymousInspectorHub.user.js` (inspected only to confirm module registration; it is not in current scope)

The source of truth for current code is always the latest version in the repository, not this list or a prior chat.

## How to resume in a new chat

1. Read this file.
2. Confirm the repository and project root above.
3. Inspect the current GitHub files under `AnonymousInspectorHub/Modules/WebStructureInspector/` and the relevant settings UI.
4. State the current active scope as WebStructureInspector.
5. Continue from the unified discovery → central HEAD/conditional-GET validation → shared results → live progress UI design.
6. Do not touch unrelated modules.
