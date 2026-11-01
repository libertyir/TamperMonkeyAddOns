
// ==UserScript==
// @name         Git Config Inspector
// @namespace    https://github.com/libertyir
// @version      1.0
// @description  Detect and inspect exposed Git configuration files
// @match        http://*/*
// @match        https://*/*
// @run-at       document-idle
// @grant        GM_setClipboard
// ==/UserScript==

(function () {
    'use strict';

    // Configuration
    const CONFIG = {
        maxFileSize: 256 * 1024,
        requestTimeout: 10000,
        filePath: '.git/config'
    };

    let configContent = '';
    let popup = null;

    // Resolve current directory
    const configURL = new URL(CONFIG.filePath, location.href);

    // Check only once
    checkGitConfig();

    async function checkGitConfig() {
        const controller = new AbortController();
        const timeout = setTimeout(
            () => controller.abort(),
            CONFIG.requestTimeout
        );

        try {
            const response = await fetch(configURL.href, {
                method: 'GET',
                credentials: 'same-origin',
                cache: 'no-store',
                signal: controller.signal
            });

            if (!response.ok) return;

            // Prevent cross-origin redirects
            if (new URL(response.url).origin !== location.origin) return;

            const contentLength = Number(
                response.headers.get('content-length') || 0
            );

            if (contentLength > CONFIG.maxFileSize) return;

            const content = await response.text();

            if (content.length > CONFIG.maxFileSize) return;

            if (!isValidGitConfig(content)) return;

            configContent = content;

            createGitIcon();

        } catch (error) {
            // Ignore unavailable files and network errors
        } finally {
            clearTimeout(timeout);
        }
    }

    // Basic Git config validation
    function isValidGitConfig(content) {
        if (!content || content.length < 10) return false;

        const hasSection =
            /^\s*\[(?:core|remote\s+"[^"]+"|branch\s+"[^"]+"|user|credential|url)\]\s*$/mi
                .test(content);

        const hasKeyValue =
            /^\s*[a-zA-Z][a-zA-Z0-9.-]*\s*=\s*.+$/m
                .test(content);

        return hasSection && hasKeyValue;
    }

    // Floating Git icon
    function createGitIcon() {
        if (document.getElementById('git-inspector-icon')) return;

        const button = document.createElement('button');

        button.id = 'git-inspector-icon';
        button.title = 'Git Config Inspector';

        button.innerHTML = `
            <svg viewBox="0 0 40 40" width="30" height="30"
                 xmlns="http://www.w3.org/2000/svg">
                <circle cx="20" cy="20" r="18" fill="#24292f"/>
                <path d="M28 13.5 A11 11 0 1 0 30 21
                         H20 V17 H34 V21
                         A14 14 0 1 1 31 10"
                      fill="#ffffff"/>
            </svg>
        `;

        button.style.cssText = `
            position:fixed;
            right:20px;
            bottom:20px;
            width:48px;
            height:48px;
            border:none;
            border-radius:50%;
            background:#ffffff;
            box-shadow:0 3px 12px rgba(0,0,0,.3);
            cursor:pointer;
            z-index:2147483647;
            display:flex;
            align-items:center;
            justify-content:center;
            padding:0;
        `;

        button.addEventListener('click', togglePopup);

        document.body.appendChild(button);
    }

    // Popup management
    function togglePopup() {
        if (popup) {
            popup.remove();
            popup = null;
            return;
        }

        createPopup();
    }

    function createPopup() {
        popup = document.createElement('div');
        popup.id = 'git-inspector-popup';

        popup.style.cssText = `
            position:fixed;
            right:20px;
            bottom:80px;
            width:min(620px, calc(100vw - 40px));
            max-height:75vh;
            background:#ffffff;
            color:#24292f;
            border:1px solid #d0d7de;
            border-radius:10px;
            box-shadow:0 8px 35px rgba(0,0,0,.3);
            z-index:2147483647;
            display:flex;
            flex-direction:column;
            overflow:hidden;
            font-family:Consolas,Monaco,monospace;
            font-size:13px;
        `;

        // Header
        const header = document.createElement('div');

        header.style.cssText = `
            display:flex;
            justify-content:space-between;
            align-items:center;
            padding:12px 15px;
            background:#24292f;
            color:white;
            font-family:Arial,sans-serif;
            font-weight:bold;
        `;

        const title = document.createElement('span');
        title.textContent = 'Git Config Inspector';

        const actions = document.createElement('div');

        const copyAll = createActionButton('Copy All', () => {
            copyText(configContent);
        });

        const close = createActionButton('✕', () => {
            popup.remove();
            popup = null;
        });

        actions.append(copyAll, close);
        header.append(title, actions);

        // File information
        const info = document.createElement('div');

        info.style.cssText = `
            padding:8px 14px;
            background:#f6f8fa;
            border-bottom:1px solid #d0d7de;
            color:#57606a;
            font-family:Arial,sans-serif;
            font-size:11px;
            overflow-wrap:anywhere;
        `;

        info.textContent =
            configURL.href + '  |  ' +
            configContent.length + ' characters';

        // Content
        const content = document.createElement('div');

        content.style.cssText = `
            overflow:auto;
            padding:12px;
            white-space:pre-wrap;
            overflow-wrap:anywhere;
            line-height:1.7;
            background:#ffffff;
        `;

        renderConfig(content, configContent);

        popup.append(header, info, content);

        document.body.appendChild(popup);
    }

    function createActionButton(label, callback) {
        const button = document.createElement('button');

        button.textContent = label;

        button.style.cssText = `
            background:#3b434d;
            color:white;
            border:1px solid #59636e;
            border-radius:5px;
            padding:5px 10px;
            margin-left:6px;
            cursor:pointer;
            font-size:12px;
        `;

        button.addEventListener('click', callback);

        return button;
    }

    // Render config while preserving its original text
    function renderConfig(container, text) {
        const lines = text.split(/\r?\n/);

        lines.forEach((line, index) => {
            const lineContainer = document.createElement('div');

            const number = document.createElement('span');
            number.textContent = String(index + 1).padStart(3, ' ') + ' ';
            number.style.cssText = `
                color:#8c959f;
                user-select:none;
                display:inline-block;
                width:38px;
            `;

            lineContainer.appendChild(number);

            const urlRegex = /https?:\/\/[^\s"'<>]+/gi;

            let lastIndex = 0;
            let match;

            while ((match = urlRegex.exec(line)) !== null) {
                const rawURL = match[0];

                let cleanURL = rawURL;

                // Remove trailing punctuation
                while (/[),.;\]}]+$/.test(cleanURL)) {
                    cleanURL = cleanURL.slice(0, -1);
                }

                lineContainer.appendChild(
                    document.createTextNode(
                        line.slice(lastIndex, match.index)
                    )
                );

                let parsedURL;

                try {
                    parsedURL = new URL(cleanURL);

                    if (!['http:', 'https:'].includes(parsedURL.protocol)) {
                        throw new Error('Invalid protocol');
                    }

                } catch {
                    lineContainer.appendChild(
                        document.createTextNode(rawURL)
                    );

                    lastIndex = urlRegex.lastIndex;
                    continue;
                }

                // Clickable URL
                const link = document.createElement('a');

                link.href = parsedURL.href;
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
                link.textContent = cleanURL;

                link.style.cssText = `
                    color:#0969da;
                    text-decoration:underline;
                    cursor:pointer;
                `;

                // Copy button
                const copy = document.createElement('button');

                copy.textContent = '⧉';
                copy.title = 'Copy URL';

                copy.style.cssText = `
                    border:none;
                    background:transparent;
                    color:#57606a;
                    cursor:pointer;
                    padding:0 5px;
                    opacity:0;
                `;

                copy.addEventListener('click', () => {
                    copyText(parsedURL.href);
                });

                copy.addEventListener('mouseenter', () => {
                    copy.style.opacity = '1';
                });

                copy.addEventListener('mouseleave', () => {
                    copy.style.opacity = '0';
                });

                link.addEventListener('mouseenter', () => {
                    copy.style.opacity = '1';
                });

                link.addEventListener('mouseleave', () => {
                    copy.style.opacity = '0';
                });

                lineContainer.append(link, copy);

                lastIndex = match.index + cleanURL.length;

                // Preserve punctuation
                const remaining = rawURL.slice(cleanURL.length);

                if (remaining) {
                    lineContainer.appendChild(
                        document.createTextNode(remaining)
                    );
                    lastIndex = urlRegex.lastIndex;
                }
            }

            lineContainer.appendChild(
                document.createTextNode(line.slice(lastIndex))
            );

            container.appendChild(lineContainer);
        });
    }

    // Clipboard
    function copyText(text) {
        if (typeof GM_setClipboard === 'function') {
            GM_setClipboard(text, 'text');
            return;
        }

        navigator.clipboard?.writeText(text).catch(() => {});
    }

    // Close popup using Escape
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && popup) {
            popup.remove();
            popup = null;
        }
    });

})();
