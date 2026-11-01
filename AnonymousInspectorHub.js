// ==UserScript==
// @name         Anonymous Inspector Hub
// @namespace    https://github.com/libertyir
// @version      2.1.0
// @description  Modular web exposure inspection toolkit (Index Of,.DS_Store,Git/Config)
// @match        http://*/*
// @match        https://*/*
// @run-at       document-idle
// @require      https://cdn.jsdelivr.net/npm/kaitai-struct@0.10.0/KaitaiStream.js
// @require      https://formats.kaitai.io/ds_store/src/javascript/DsStore.js
// @grant        GM_setClipboard
// ==/UserScript==

(function () {
    'use strict';

    // ============================================================
    // 1. CONFIGURATION
    // ============================================================

    const CONFIG = {
        maxGitSize: 256 * 1024,
        maxDSStoreSize: 5 * 1024 * 1024,
        timeout: 10000,

        position: {
            right: '20px',
            bottom: '20px'
        }
    };


    // ============================================================
    // 2. ICON LIBRARY
    // ============================================================

    class IconLibrary {

        static anonymous() {
            return `
                <svg viewBox="0 0 64 64" width="36" height="36"
                     xmlns="http://www.w3.org/2000/svg">

                    <path fill="#fff"
                        d="M11 18 L16 9 Q32 3 48 9 L53 18
                           L58 23 L54 28 L51 25 L49 38
                           Q32 47 15 38 L13 25 L10 28
                           L6 23 Z"/>

                    <path fill="#242424"
                        d="M10 17 Q32 5 54 17 L52 23
                           Q32 13 12 23 Z"/>

                    <path fill="#242424"
                        d="M14 22 L28 22 L29 32 L15 31 Z
                           M36 22 L50 22 L49 31 L35 32 Z"/>

                    <path fill="none" stroke="#242424"
                        stroke-width="3"
                        d="M28 26 L36 26"/>

                    <path fill="none" stroke="#242424"
                        stroke-width="2"
                        d="M20 37 Q32 43 44 37"/>

                    <path fill="#fff"
                        d="M27 34 L32 39 L37 34 L34 34
                           L32 36 L30 34 Z"/>
                </svg>
            `;
        }

        static github() {
            return `
                <svg viewBox="0 0 24 24" width="25" height="25"
                     fill="currentColor"
                     xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 .9a11.1 11.1 0 0 0-3.51
                    21.63c.55.1.76-.24.76-.53v-2.05
                    c-3.1.68-3.76-1.32-3.76-1.32
                    -.5-1.3-1.23-1.65-1.23-1.65
                    -1.01-.69.08-.68.08-.68
                    1.12.08 1.71 1.15 1.71 1.15
                    .99 1.7 2.6 1.21 3.23.92
                    .1-.72.39-1.21.7-1.49
                    -2.48-.28-5.09-1.24-5.09-5.53
                    0-1.22.44-2.22 1.15-3
                    -.12-.28-.5-1.42.11-2.96
                    0 0 .94-.3 3.05 1.15
                    a10.6 10.6 0 0 1 5.55 0
                    c2.11-1.45 3.05-1.15 3.05-1.15
                    .61 1.54.23 2.68.11 2.96
                    .72.78 1.15 1.78 1.15 3
                    0 4.3-2.61 5.25-5.1 5.52
                    .4.35.75 1.02.75 2.06V22
                    c0 .29.2.63.76.53A11.1 11.1
                    0 0 0 12 .9Z"/>
                </svg>
            `;
        }

        static folder() {
            return `
                <svg viewBox="0 0 24 24" width="25" height="25"
                     fill="currentColor"
                     xmlns="http://www.w3.org/2000/svg">
                    <path d="M10 4H3a2 2 0 0 0-2 2v12
                             a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V8
                             a2 2 0 0 0-2-2h-9z"/>
                </svg>
            `;
        }
    }


    // ============================================================
    // 3. CLIPBOARD MANAGER
    // ============================================================

    class ClipboardManager {

        static async copy(value) {
            try {
                if (typeof GM_setClipboard === 'function') {
                    GM_setClipboard(value, 'text');
                    return true;
                }

                await navigator.clipboard.writeText(value);
                return true;

            } catch (error) {
                console.error('[Anonymous] Clipboard error:', error);
                return false;
            }
        }
    }


    // ============================================================
    // 4. UI FACTORY
    // ============================================================

    class UIFactory {

        static element(tag, className, content) {
            const element = document.createElement(tag);

            if (className) element.className = className;

            if (content !== undefined) {
                element.textContent = content;
            }

            return element;
        }

        static button(label, callback) {
            const button = document.createElement('button');

            button.textContent = label;
            button.type = 'button';
            button.addEventListener('click', callback);

            return button;
        }

        static injectStyles() {
            if (document.getElementById('anonymous-hub-styles')) return;

            const style = document.createElement('style');

            style.id = 'anonymous-hub-styles';

            style.textContent = `
                #anonymous-hub-root {
                    position:fixed;
                    right:${CONFIG.position.right};
                    bottom:${CONFIG.position.bottom};
                    z-index:2147483647;
                    font-family:Arial,sans-serif;
                }

                #anonymous-hub-main {
                    width:54px;
                    height:54px;
                    border-radius:50%;
                    border:2px solid #777;
                    background:#171717;
                    color:white;
                    display:flex;
                    align-items:center;
                    justify-content:center;
                    cursor:pointer;
                    box-shadow:0 3px 15px #0006;
                    transition:transform .2s;
                }

                #anonymous-hub-main:hover {
                    transform:scale(1.08);
                }

                #anonymous-hub-menu {
                    position:absolute;
                    right:0;
                    bottom:66px;
                    width:285px;
                    max-width:calc(100vw - 40px);
                    background:#fff;
                    color:#24292f;
                    border:1px solid #d0d7de;
                    border-radius:10px;
                    box-shadow:0 5px 25px #0004;
                    overflow:hidden;
                    display:none;
                }

                #anonymous-hub-menu.open {
                    display:block;
                }

                .anonymous-menu-header {
                    background:#24292f;
                    color:white;
                    padding:12px 15px;
                    font-weight:bold;
                    font-size:14px;
                }

                .anonymous-module {
                    display:flex;
                    align-items:center;
                    gap:12px;
                    padding:12px;
                    cursor:pointer;
                    border-bottom:1px solid #eee;
                    transition:background .15s;
                }

                .anonymous-module:hover {
                    background:#f1f4f8;
                }

                .anonymous-module-icon {
                    width:38px;
                    height:38px;
                    flex-shrink:0;
                    display:flex;
                    align-items:center;
                    justify-content:center;
                    border-radius:8px;
                    background:#24292f;
                    color:white;
                }

                .anonymous-module-info {
                    flex:1;
                    min-width:0;
                }

                .anonymous-module-title {
                    font-size:13px;
                    font-weight:bold;
                }

                .anonymous-module-description {
                    font-size:11px;
                    color:#57606a;
                    margin-top:4px;
                    line-height:1.4;
                }

                .anonymous-module-status {
                    width:8px;
                    height:8px;
                    border-radius:50%;
                    background:#2da44e;
                    flex-shrink:0;
                }

                #anonymous-popup {
                    position:fixed;
                    right:20px;
                    bottom:85px;
                    width:min(650px,calc(100vw - 40px));
                    max-height:75vh;
                    display:flex;
                    flex-direction:column;
                    background:white;
                    color:#24292f;
                    border:1px solid #d0d7de;
                    border-radius:10px;
                    box-shadow:0 8px 35px #0005;
                    overflow:hidden;
                    z-index:2147483647;
                    font-family:Arial,sans-serif;
                }

                .anonymous-popup-header {
                    display:flex;
                    align-items:center;
                    justify-content:space-between;
                    gap:10px;
                    padding:12px 15px;
                    background:#24292f;
                    color:white;
                    font-size:14px;
                    font-weight:bold;
                }

                .anonymous-popup-actions {
                    display:flex;
                    gap:6px;
                }

                .anonymous-popup-actions button {
                    background:#3b434d;
                    color:white;
                    border:1px solid #59636e;
                    border-radius:5px;
                    padding:5px 9px;
                    cursor:pointer;
                }

                .anonymous-popup-info {
                    padding:9px 12px;
                    background:#f6f8fa;
                    border-bottom:1px solid #d0d7de;
                    color:#57606a;
                    font-size:11px;
                    overflow-wrap:anywhere;
                }

                .anonymous-popup-content {
                    padding:12px;
                    overflow:auto;
                    font-family:Consolas,monospace;
                    font-size:12px;
                    line-height:1.8;
                    white-space:pre-wrap;
                    overflow-wrap:anywhere;
                }

                .anonymous-line {
                    min-height:20px;
                }

                .anonymous-line-number {
                    display:inline-block;
                    width:38px;
                    color:#8c959f;
                    user-select:none;
                }

                .anonymous-link {
                    color:#0969da;
                    text-decoration:underline;
                    cursor:pointer;
                }

                .anonymous-link-group:hover .anonymous-copy-link {
                    opacity:1;
                }

                .anonymous-copy-link {
                    opacity:0;
                    border:none;
                    background:transparent;
                    color:#57606a;
                    cursor:pointer;
                    padding:0 5px;
                }

                .anonymous-copy-link:hover {
                    color:#0969da;
                }

                .anonymous-directory-table {
                    width:100%;
                    border-collapse:collapse;
                    font-size:12px;
                    font-family:Arial,sans-serif;
                }

                .anonymous-directory-table th {
                    text-align:left;
                    padding:9px 7px;
                    background:#f6f8fa;
                    border-bottom:1px solid #d0d7de;
                    position:sticky;
                    top:0;
                }

                .anonymous-directory-table td {
                    padding:8px 7px;
                    border-bottom:1px solid #eee;
                }

                .anonymous-file-link {
                    color:#0969da;
                    text-decoration:none;
                    overflow-wrap:anywhere;
                }

                .anonymous-file-link:hover {
                    text-decoration:underline;
                }

                .anonymous-warning {
                    background:#fff8c5;
                    color:#633c01;
                    padding:10px;
                    margin-bottom:12px;
                    border-radius:6px;
                    font-size:12px;
                    line-height:1.6;
                }

                .anonymous-toolbar {
                    display:flex;
                    gap:8px;
                    flex-wrap:wrap;
                    margin-bottom:12px;
                }

                .anonymous-toolbar button {
                    border:1px solid #d0d7de;
                    border-radius:5px;
                    background:#f6f8fa;
                    padding:6px 10px;
                    cursor:pointer;
                    font-size:12px;
                }

                .anonymous-toolbar button:hover {
                    background:#eaeef2;
                }

                .anonymous-empty {
                    color:#57606a;
                    padding:15px;
                    text-align:center;
                }
            `;

            document.head.appendChild(style);
        }
    }


    // ============================================================
    // 5. POPUP MANAGER
    // ============================================================

    class PopupManager {

        static current = null;

        static open(module) {
            this.close();

            const popup = UIFactory.element('div', '');
            popup.id = 'anonymous-popup';

            const header = UIFactory.element(
                'div',
                'anonymous-popup-header'
            );

            const title = UIFactory.element(
                'span',
                '',
                module.name
            );

            const actions = UIFactory.element(
                'div',
                'anonymous-popup-actions'
            );

            const copyButton = UIFactory.button(
                'Copy All',
                () => ClipboardManager.copy(module.content)
            );

            const closeButton = UIFactory.button(
                '✕',
                () => this.close()
            );

            actions.append(copyButton, closeButton);
            header.append(title, actions);

            const info = UIFactory.element(
                'div',
                'anonymous-popup-info',
                module.infoText
            );

            const content = UIFactory.element(
                'div',
                'anonymous-popup-content'
            );

            module.render(content);

            popup.append(header, info, content);

            document.body.appendChild(popup);

            this.current = popup;
        }

        static renderText(container, text) {
            const lines = text.split(/\r?\n/);

            lines.forEach((line, index) => {

                const row = UIFactory.element(
                    'div',
                    'anonymous-line'
                );

                const number = UIFactory.element(
                    'span',
                    'anonymous-line-number',
                    String(index + 1).padStart(3, ' ') + ' '
                );

                row.appendChild(number);

                const regex = /https?:\/\/[^\s"'<>]+/gi;

                let cursor = 0;
                let match;

                while ((match = regex.exec(line)) !== null) {

                    let url = match[0];

                    while (/[),.;\]}]+$/.test(url)) {
                        url = url.slice(0, -1);
                    }

                    if (!url) continue;

                    row.appendChild(
                        document.createTextNode(
                            line.slice(cursor, match.index)
                        )
                    );

                    try {
                        const parsed = new URL(url);

                        if (!['http:', 'https:'].includes(parsed.protocol)) {
                            throw new Error('Invalid URL');
                        }

                        const group = UIFactory.element(
                            'span',
                            'anonymous-link-group'
                        );

                        const link = document.createElement('a');

                        link.className = 'anonymous-link';
                        link.href = parsed.href;
                        link.target = '_blank';
                        link.rel = 'noopener noreferrer';
                        link.textContent = url;

                        const copy = UIFactory.element(
                            'button',
                            'anonymous-copy-link',
                            '⧉'
                        );

                        copy.type = 'button';
                        copy.title = 'Copy URL';

                        copy.addEventListener('click', () => {
                            ClipboardManager.copy(parsed.href);
                        });

                        group.append(link, copy);
                        row.appendChild(group);

                    } catch {
                        row.appendChild(
                            document.createTextNode(url)
                        );
                    }

                    cursor = match.index + url.length;

                    const punctuation = match[0].slice(url.length);

                    if (punctuation) {
                        row.appendChild(
                            document.createTextNode(punctuation)
                        );

                        cursor += punctuation.length;
                    }
                }

                row.appendChild(
                    document.createTextNode(line.slice(cursor))
                );

                container.appendChild(row);
            });
        }

        static close() {
            if (this.current) {
                this.current.remove();
                this.current = null;
            }
        }
    }


    // ============================================================
    // 6. MODULE REGISTRY
    // ============================================================

    class ModuleRegistry {

        constructor() {
            this.modules = [];
        }

        register(module) {
            this.modules.push(module);
        }

        async initialize() {

            await Promise.all(
                this.modules.map(async module => {

                    try {
                        module.active = await module.detect();

                    } catch (error) {

                        module.active = false;

                        console.error(
                            '[Anonymous] Module error:',
                            module.name,
                            error
                        );
                    }
                })
            );

            return this.modules.filter(
                module => module.active
            );
        }
    }


    // ============================================================
    // 7. BASE MODULE
    // ============================================================

    class BaseModule {

        constructor() {
            this.name = 'Unnamed Module';
            this.description = '';
            this.icon = '';
            this.active = false;
            this.content = '';
            this.fileURL = '';
        }

        async detect() {
            return false;
        }

        open() {
            PopupManager.open(this);
        }

        render(container) {
            PopupManager.renderText(container, this.content);
        }

        get infoText() {
            return this.fileURL + ' | ' +
                this.content.length + ' characters';
        }
    }


    // ============================================================
    // 8. GIT CONFIG MODULE
    // ============================================================

    class GitConfigModule extends BaseModule {

        constructor() {
            super();

            this.name = 'Git Config Inspector';

            this.description =
                'Inspect Git configuration and remote URLs.';

            this.icon = IconLibrary.github();

            this.fileURL = new URL(
                '.git/config',
                location.href
            ).href;
        }

        async detect() {

            const controller = new AbortController();

            const timer = setTimeout(
                () => controller.abort(),
                CONFIG.timeout
            );

            try {

                const response = await fetch(this.fileURL, {
                    method: 'GET',
                    credentials: 'same-origin',
                    cache: 'no-store',
                    signal: controller.signal
                });

                if (!response.ok) return false;

                if (
                    new URL(response.url).origin !== location.origin
                ) {
                    return false;
                }

                const length = Number(
                    response.headers.get('content-length') || 0
                );

                if (length > CONFIG.maxGitSize) return false;

                const content = await response.text();

                if (content.length > CONFIG.maxGitSize) return false;

                if (!this.isValidConfig(content)) return false;

                this.content = content;

                return true;

            } catch {
                return false;

            } finally {
                clearTimeout(timer);
            }
        }

        isValidConfig(content) {

            if (!content || content.length < 10) {
                return false;
            }

            const hasSection =
                /^\s*\[(?:core|remote\s+"[^"]+"|branch\s+"[^"]+"|user|credential|url)\]\s*$/mi
                    .test(content);

            const hasKey =
                /^\s*[a-zA-Z][a-zA-Z0-9.-]*\s*=\s*.+$/m
                    .test(content);

            return hasSection && hasKey;
        }
    }


    // ============================================================
    // 9. DS_STORE MODULE
    // ============================================================

    class DSStoreModule extends BaseModule {

        constructor() {
            super();

            this.name = 'DS_Store Directory Browser';

            this.description =
                'Extract and browse recorded directory entries.';

            this.icon = IconLibrary.folder();

            const pathname = location.pathname.endsWith('/')
                ? location.pathname
                : location.pathname.replace(/[^/]*$/, '');

            this.directoryURL = new URL(
                pathname,
                location.origin
            );

            this.fileURL = new URL(
                '.DS_Store',
                this.directoryURL
            ).href;

            this.entries = [];
        }


        // --------------------------------------------------------
        // DETECTION
        // --------------------------------------------------------

        async detect() {

            try {

                const buffer = await this.downloadFile();

                if (!buffer) return false;

                const entries = this.parseFile(buffer);

                if (!entries.length) return false;

                this.entries = entries;

                this.content = entries
                    .map(entry => entry.name)
                    .join('\n');

                return true;

            } catch (error) {

                console.error(
                    '[Anonymous] DS_Store parser error:',
                    error
                );

                return false;
            }
        }


        // --------------------------------------------------------
        // DOWNLOAD
        // --------------------------------------------------------

        async downloadFile() {

            const controller = new AbortController();

            const timer = setTimeout(
                () => controller.abort(),
                CONFIG.timeout
            );

            try {

                const response = await fetch(this.fileURL, {
                    method: 'GET',
                    credentials: 'same-origin',
                    cache: 'no-store',
                    signal: controller.signal
                });

                if (!response.ok) return null;

                if (
                    new URL(response.url).origin !== location.origin
                ) {
                    return null;
                }

                const length = Number(
                    response.headers.get('content-length') || 0
                );

                if (length > CONFIG.maxDSStoreSize) return null;

                if (!response.body) return null;

                const reader = response.body.getReader();

                const chunks = [];

                let total = 0;

                try {

                    while (true) {

                        const { done, value } = await reader.read();

                        if (done) break;

                        total += value.byteLength;

                        if (total > CONFIG.maxDSStoreSize) {

                            await reader.cancel();

                            return null;
                        }

                        chunks.push(value);
                    }

                } finally {
                    reader.releaseLock();
                }

                if (!total) return null;

                const buffer = new Uint8Array(total);

                let offset = 0;

                for (const chunk of chunks) {

                    buffer.set(chunk, offset);

                    offset += chunk.length;
                }

                return buffer.buffer;

            } finally {
                clearTimeout(timer);
            }
        }


        // --------------------------------------------------------
        // PARSE DS_STORE
        // --------------------------------------------------------

        parseFile(buffer) {

            if (
                typeof KaitaiStream === 'undefined' ||
                typeof DsStore === 'undefined' ||
                typeof DsStore.DsStore !== 'function'
            ) {
                throw new Error(
                    'Kaitai DS_Store parser is unavailable.'
                );
            }

            const stream = new KaitaiStream(buffer);

            const parser = new DsStore.DsStore(stream);

            const body = parser.buddyAllocatorBody;

            const directories = body.directories;

            if (!directories || !directories.length) {
                throw new Error(
                    'DS_Store directory table is empty.'
                );
            }

            // Prefer the DSDB directory.
            const dsdbIndex = body.directoryEntries.findIndex(
                entry => entry.name === 'DSDB'
            );

            const selectedDirectories = dsdbIndex >= 0
                ? [directories[dsdbIndex]]
                : directories;

            const records = [];

            const visitedBlocks = new Set();

            let processedBlocks = 0;

            const maxBlocks = 100000;

            const maxRecords = 200000;

            const walkBlock = (block, blockId) => {

                if (!block) return;

                if (visitedBlocks.has(blockId)) return;

                visitedBlocks.add(blockId);

                processedBlocks++;

                if (processedBlocks > maxBlocks) {
                    throw new Error(
                        'B-Tree traversal limit exceeded.'
                    );
                }

                // Internal nodes contain child pointers
                // and records. Leaf nodes contain records only.

                for (const item of block.data) {

                    if (block.mode > 0) {

                        const child = item.block;

                        walkBlock(child, item.blockId);
                    }

                    this.extractRecord(
                        item.record,
                        records
                    );

                    if (records.length > maxRecords) {
                        throw new Error(
                            'Record limit exceeded.'
                        );
                    }
                }

                // Rightmost child
                if (block.mode > 0) {

                    walkBlock(
                        block.rightmostBlock,
                        block.mode
                    );
                }
            };


            for (const directory of selectedDirectories) {

                const master = directory.masterBlock;

                if (!master) continue;

                walkBlock(
                    master.rootBlock,
                    master.blockId
                );
            }


            // Group multiple records belonging to one filename.
            const unique = new Map();

            for (const record of records) {

                if (!record.name) continue;

                if (!unique.has(record.name)) {

                    unique.set(record.name, {
                        name: record.name,
                        properties: new Set(),
                        types: new Set()
                    });
                }

                const entry = unique.get(record.name);

                if (record.structureType) {
                    entry.properties.add(record.structureType);
                }

                if (record.dataType) {
                    entry.types.add(record.dataType);
                }
            }


            return Array.from(unique.values())
                .map(entry => ({
                    name: entry.name,
                    properties: Array.from(entry.properties),
                    types: Array.from(entry.types)
                }))
                .sort((a, b) =>
                    a.name.localeCompare(
                        b.name,
                        undefined,
                        { sensitivity: 'base' }
                    )
                );
        }


        // --------------------------------------------------------
        // RECORD EXTRACTION
        // --------------------------------------------------------

        extractRecord(record, output) {

            if (!record || !record.filename) return;

            const name = record.filename.value;

            if (
                typeof name !== 'string' ||
                !name ||
                name === '.' ||
                name === '..'
            ) {
                return;
            }

            const structureType =
                record.structureType?.value || 'Unknown';

            const dataType =
                record.dataType || 'Unknown';

            output.push({
                name,
                structureType,
                dataType
            });
        }


        // --------------------------------------------------------
        // INFORMATION
        // --------------------------------------------------------

        get infoText() {

            return this.fileURL +
                ' | ' +
                this.entries.length +
                ' unique entries';
        }


        // --------------------------------------------------------
        // RENDER DIRECTORY BROWSER
        // --------------------------------------------------------

        render(container) {

            container.style.fontFamily = 'Arial,sans-serif';

            const warning = UIFactory.element(
                'div',
                'anonymous-warning',

                'DS_Store records may contain deleted filenames. ' +
                'This listing is not guaranteed to represent the ' +
                'current directory contents.'
            );

            container.appendChild(warning);


            // Toolbar
            const toolbar = UIFactory.element(
                'div',
                'anonymous-toolbar'
            );

            const copyNames = UIFactory.button(
                'Copy Names',
                () => ClipboardManager.copy(
                    this.entries
                        .map(entry => entry.name)
                        .join('\n')
                )
            );

            const copyAll = UIFactory.button(
                'Copy Full Report',
                () => ClipboardManager.copy(
                    this.exportReport()
                )
            );

            toolbar.append(copyNames, copyAll);

            container.appendChild(toolbar);


            // Table
            const table = UIFactory.element(
                'table',
                'anonymous-directory-table'
            );

            const thead = document.createElement('thead');

            const header = document.createElement('tr');

            ['Name', 'Properties', 'Data Types'].forEach(label => {

                const th = UIFactory.element(
                    'th',
                    '',
                    label
                );

                header.appendChild(th);
            });

            thead.appendChild(header);

            table.appendChild(thead);


            const tbody = document.createElement('tbody');


            this.entries.forEach(entry => {

                const tr = document.createElement('tr');

                const nameCell = document.createElement('td');

                const link = document.createElement('a');

                const targetURL = new URL(
                    encodeURIComponent(entry.name),
                    this.directoryURL
                );

                link.href = targetURL.href;

                link.target = '_blank';

                link.rel = 'noopener noreferrer';

                link.className = 'anonymous-file-link';

                link.textContent = entry.name;

                link.title = 'Open ' + entry.name;

                nameCell.appendChild(link);


                const propertyCell = UIFactory.element(
                    'td',
                    '',
                    entry.properties.join(', ')
                );

                const typeCell = UIFactory.element(
                    'td',
                    '',
                    entry.types.join(', ')
                );

                tr.append(
                    nameCell,
                    propertyCell,
                    typeCell
                );

                tbody.appendChild(tr);
            });


            table.appendChild(tbody);

            container.appendChild(table);


            if (!this.entries.length) {

                const empty = UIFactory.element(
                    'div',
                    'anonymous-empty',
                    'No entries found.'
                );

                container.appendChild(empty);
            }
        }


        // --------------------------------------------------------
        // EXPORT
        // --------------------------------------------------------

        exportReport() {

            return this.entries.map(entry => {

                return [
                    'Name: ' + entry.name,
                    'Properties: ' + entry.properties.join(', '),
                    'Data Types: ' + entry.types.join(', ')
                ].join('\n');

            }).join('\n\n');
        }
    }


    // ============================================================
    // 10. ANONYMOUS HUB
    // ============================================================

    class AnonymousHub {

        constructor(modules) {

            this.modules = modules;

            this.root = null;

            this.menu = null;

            this.isOpen = false;
        }


        mount() {

            if (!this.modules.length) return;

            if (
                document.getElementById(
                    'anonymous-hub-root'
                )
            ) {
                return;
            }

            UIFactory.injectStyles();

            this.root = UIFactory.element('div', '');

            this.root.id = 'anonymous-hub-root';


            // Main button
            const main = UIFactory.element('button', '');

            main.id = 'anonymous-hub-main';

            main.type = 'button';

            main.title = 'Anonymous Inspector';

            main.setAttribute(
                'aria-label',
                'Anonymous Inspector'
            );

            main.innerHTML = IconLibrary.anonymous();

            main.addEventListener('click', () => {
                this.toggleMenu();
            });


            // Menu
            this.menu = UIFactory.element('div', '');

            this.menu.id = 'anonymous-hub-menu';

            const header = UIFactory.element(
                'div',
                'anonymous-menu-header',
                'Anonymous Inspector'
            );

            this.menu.appendChild(header);


            this.modules.forEach(module => {
                this.addModuleMenuItem(module);
            });


            this.root.append(this.menu, main);

            document.body.appendChild(this.root);


            // Outside click
            document.addEventListener('click', event => {

                if (
                    this.isOpen &&
                    !this.root.contains(event.target)
                ) {
                    this.closeMenu();
                }
            });


            // Escape key
            document.addEventListener('keydown', event => {

                if (event.key === 'Escape') {

                    this.closeMenu();

                    PopupManager.close();
                }
            });
        }


        addModuleMenuItem(module) {

            const item = UIFactory.element(
                'div',
                'anonymous-module'
            );

            const icon = UIFactory.element(
                'div',
                'anonymous-module-icon'
            );

            icon.innerHTML = module.icon;


            const info = UIFactory.element(
                'div',
                'anonymous-module-info'
            );

            const title = UIFactory.element(
                'div',
                'anonymous-module-title',
                module.name
            );

            const description = UIFactory.element(
                'div',
                'anonymous-module-description',
                module.description
            );

            const status = UIFactory.element(
                'div',
                'anonymous-module-status'
            );

            info.append(title, description);

            item.append(icon, info, status);


            item.addEventListener('click', () => {

                this.closeMenu();

                module.open();
            });


            this.menu.appendChild(item);
        }


        toggleMenu() {

            this.isOpen
                ? this.closeMenu()
                : this.openMenu();
        }


        openMenu() {

            this.menu.classList.add('open');

            this.isOpen = true;
        }


        closeMenu() {

            if (!this.menu) return;

            this.menu.classList.remove('open');

            this.isOpen = false;
        }
    }


    // ============================================================
    // 11. APPLICATION
    // ============================================================

    class AnonymousInspector {

        async start() {

            const registry = new ModuleRegistry();


            // Register modules
            registry.register(
                new GitConfigModule()
            );

            registry.register(
                new DSStoreModule()
            );


            // Detect available modules
            const activeModules =
                await registry.initialize();


            // No exposed files
            if (!activeModules.length) return;


            // Create shared interface
            const hub = new AnonymousHub(
                activeModules
            );

            hub.mount();
        }
    }


    // ============================================================
    // 12. START
    // ============================================================

    new AnonymousInspector().start();

})();
