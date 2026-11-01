
// ==UserScript==
// @name         DS_Store Finder & Viewer
// @namespace    https://github.com/libertyir
// @version      2.0
// @description  Detect and browse entries stored in .DS_Store
// @match        *://*/*
// @grant        GM_xmlhttpRequest
// @connect      *
// @require      https://cdn.jsdelivr.net/npm/kaitai-struct@0.10.0/KaitaiStream.js
// @require      https://formats.kaitai.io/ds_store/src/javascript/DsStore.js
// ==/UserScript==

(function () {
    'use strict';

    if (window.__dsStoreChecked) return;
    window.__dsStoreChecked = true;

    // Resolve the current directory
    const directoryURL = new URL(
        location.pathname.endsWith('/')
            ? location.pathname
            : location.pathname.replace(/[^/]*$/, ''),
        location.origin
    );

    const fileURL = new URL('.DS_Store', directoryURL);

    GM_xmlhttpRequest({
        method: 'GET',
        url: fileURL.href,
        responseType: 'arraybuffer',

        onload: function (response) {
            if (response.status !== 200) return;

            try {
                const buffer = response.response;
                if (!buffer || buffer.byteLength < 36) return;

                // Parse DS_Store
                const parser = new DsStore.DsStore(
                    new KaitaiStream(buffer)
                );

                const records = [];
                const visited = new Set();

                function traverse(block) {
                    if (!block) return;

                    for (const item of block.data) {
                        if (block.mode > 0 && item.blockId !== undefined) {
                            traverse(item.block);
                        }

                        const record = item.record;
                        const name = record.filename.value;

                        if (name && name !== '.') {
                            records.push({
                                name: name,
                                property: record.structureType.value,
                                dataType: record.dataType
                            });
                        }
                    }

                    if (block.mode > 0) {
                        traverse(block.rightmostBlock);
                    }
                }

                // Traverse DSDB B-Tree
                const body = parser.buddyAllocatorBody;
                const dsdb = body.directories.find(
                    entry => entry._parent.directoryEntries[
                        entry.idx
                    ].name === 'DSDB'
                );

                if (!dsdb) return;

                traverse(dsdb.masterBlock.rootBlock);

                // Remove duplicate names
                const entries = [
                    ...new Map(
                        records.map(item => [item.name, item])
                    ).values()
                ].sort((a, b) => a.name.localeCompare(b.name));

                if (!entries.length) return;

                // Floating button
                const button = document.createElement('button');

                button.textContent = '📂';
                button.title = 'DS_Store Found - Click to Browse';

                Object.assign(button.style, {
                    position: 'fixed',
                    right: '20px',
                    bottom: '20px',
                    width: '48px',
                    height: '48px',
                    border: 'none',
                    borderRadius: '50%',
                    background: '#222',
                    color: '#fff',
                    fontSize: '23px',
                    cursor: 'pointer',
                    zIndex: '2147483647',
                    boxShadow: '0 3px 12px #0008'
                });

                document.body.appendChild(button);

                // Popup
                button.onclick = function () {
                    if (document.getElementById('ds-store-popup')) return;

                    const popup = document.createElement('div');
                    popup.id = 'ds-store-popup';

                    Object.assign(popup.style, {
                        position: 'fixed',
                        top: '8%',
                        left: '10%',
                        width: '80%',
                        height: '84%',
                        background: '#fff',
                        color: '#222',
                        zIndex: '2147483647',
                        borderRadius: '8px',
                        boxShadow: '0 0 0 9999px #0009',
                        overflow: 'hidden',
                        fontFamily: 'Arial, sans-serif',
                        fontSize: '13px'
                    });

                    const header = document.createElement('div');

                    Object.assign(header.style, {
                        padding: '14px',
                        background: '#222',
                        color: '#fff',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    });

                    const title = document.createElement('strong');
                    title.textContent = 'DS_Store Directory Browser';

                    const close = document.createElement('button');
                    close.textContent = 'Close ✕';

                    Object.assign(close.style, {
                        cursor: 'pointer',
                        padding: '6px 12px'
                    });

                    close.onclick = () => popup.remove();

                    header.append(title, close);

                    const info = document.createElement('div');
                    info.textContent =
                        'Directory: ' + directoryURL.pathname +
                        ' | Entries: ' + entries.length;

                    info.style.padding = '12px';
                    info.style.background = '#eee';

                    const list = document.createElement('div');

                    Object.assign(list.style, {
                        height: 'calc(100% - 90px)',
                        overflowY: 'auto',
                        padding: '8px 14px'
                    });

                    entries.forEach(entry => {
                        const row = document.createElement('div');

                        Object.assign(row.style, {
                            display: 'flex',
                            justifyContent: 'space-between',
                            padding: '9px',
                            borderBottom: '1px solid #ddd'
                        });

                        const link = document.createElement('a');

                        link.textContent = '📄 ' + entry.name;
                        link.href = new URL(
                            entry.name.split('/').map(encodeURIComponent).join('/'),
                            directoryURL
                        ).href;

                        link.target = '_blank';
                        link.rel = 'noopener noreferrer';

                        Object.assign(link.style, {
                            color: '#1769aa',
                            textDecoration: 'none',
                            fontWeight: 'bold',
                            overflowWrap: 'anywhere'
                        });

                        const property = document.createElement('span');
                        property.textContent =
                            entry.property + ' / ' + entry.dataType;

                        property.style.color = '#888';

                        row.append(link, property);
                        list.appendChild(row);
                    });

                    popup.append(header, info, list);
                    document.body.appendChild(popup);
                };

            } catch (error) {
                console.error('DS_Store parsing failed:', error);
            }
        }
    });

})();
