/*
// -------------------------------------------------------------
//
//!\file kompose.js
//!\brief Dependency-free visual Markdown editor for textareas.
//!\author Colin J.D. Stewart
//
// -------------------------------------------------------------
//
//           Copyright (c) 2026. Colin J.D. Stewart.
//                   All rights reserved
//
// -------------------------------------------------------------
*/
(() => {
    'use strict';

    const editors = new WeakMap();
    const blocks = new Set(['DIV', 'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'PRE', 'UL', 'OL', 'HR']);

    function safeDestination(value) {
        const url = value.trim();
        if (!url || /[\s\\\u0000-\u001f\u007f]/.test(url)) {
            return '';
        }
        const scheme = url.match(/^([a-z][a-z\d+.-]*):/i);
        if (scheme && !['http', 'https', 'mailto'].includes(scheme[1].toLowerCase())) {
            return '';
        }
        return url.replaceAll('(', '%28').replaceAll(')', '%29');
    }

    function inline(document, parent, text) {
        const syntax = /`([^`]+)`|(!?)\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)|\*\*(.+?)\*\*|\*([^*]+)\*/g;
        let cursor = 0;
        for (const match of text.matchAll(syntax)) {
            parent.append(text.slice(cursor, match.index));
            cursor = match.index + match[0].length;
            const [, code, image, label, url, bold, italic] = match;
            if (code !== undefined) {
                const element = document.createElement('code');
                element.textContent = code;
                parent.append(element);
            } else if (url !== undefined) {
                const destination = safeDestination(url);
                if (!destination) {
                    parent.append(label);
                } else if (image) {
                    const element = document.createElement('img');
                    element.src = destination;
                    element.alt = label;
                    parent.append(element);
                } else {
                    const element = document.createElement('a');
                    element.setAttribute('href', destination);
                    inline(document, element, label);
                    parent.append(element);
                }
            } else {
                const element = document.createElement(bold === undefined ? 'em' : 'strong');
                inline(document, element, bold ?? italic);
                parent.append(element);
            }
        }
        parent.append(text.slice(cursor));
    }

    function loadMarkup(surface, markup) {
        const document = surface.ownerDocument;
        const fragment = document.createDocumentFragment();
        const lines = markup.split(/\r\n|\r|\n/);
        let index = 0;

        while (index < lines.length) {
            const line = lines[index];
            const heading = line.match(/^(#{1,6})\s+(.*)$/);
            const bullet = /^\s*[-*+]\s+(.*)$/;
            const numbered = /^\s*\d+\.\s+(.*)$/;
            if (line.startsWith('    ')) {
                const code = [];
                while (lines[index]?.startsWith('    ')) {
                    code.push(lines[index++].slice(4));
                }
                const pre = document.createElement('pre');
                pre.textContent = code.join('\n');
                fragment.append(pre);
                continue;
            }
            if (/^>/.test(line)) {
                const quote = document.createElement('blockquote');
                while (lines[index]?.startsWith('>')) {
                    if (quote.childNodes.length) {
                        quote.append(document.createElement('br'));
                    }
                    inline(document, quote, lines[index++].replace(/^>\s?/, ''));
                }
                fragment.append(quote);
                continue;
            }
            const list = bullet.test(line) ? bullet : numbered.test(line) ? numbered : null;
            if (list) {
                const element = document.createElement(list === bullet ? 'ul' : 'ol');
                while (index < lines.length && !lines[index].startsWith('    ')) {
                    const item = lines[index].match(list);
                    if (!item) {
                        break;
                    }
                    const li = document.createElement('li');
                    inline(document, li, item[1]);
                    element.append(li);
                    index++;
                }
                fragment.append(element);
                continue;
            }
            if (/^\s*[-*_]{3,}\s*$/.test(line)) {
                fragment.append(document.createElement('hr'));
            } else if (line.trim()) {
                const element = document.createElement(heading ? 'h' + heading[1].length : 'p');
                inline(document, element, heading ? heading[2] : line);
                fragment.append(element);
            }
            index++;
        }
        surface.replaceChildren(fragment);
    }

    function inlineMarkup(node) {
        if (node.nodeType === 3) {
            return node.data.replaceAll('\u00a0', ' ');
        }
        const text = Array.from(node.childNodes, inlineMarkup).join('');
        switch (node.tagName) {
            case 'BR': return '\n';
            case 'B':
            case 'STRONG': return text.replace(/\S(?:[^\n]*\S)?/g, '**$&**');
            case 'I':
            case 'EM': return text.replace(/\S(?:[^\n]*\S)?/g, '*$&*');
            case 'CODE': return '`' + text + '`';
            case 'A': {
                const destination = safeDestination(node.getAttribute('href') ?? '');
                return destination && text ? '[' + text.replaceAll(']', '］') + '](' + destination + ')' : text;
            }
            case 'IMG': {
                const destination = safeDestination(node.getAttribute('src') ?? '');
                const label = node.alt.replaceAll(']', '］');
                return destination ? '![' + label + '](' + destination + ')' : label;
            }
            default: return blocks.has(node.tagName) ? text + '\n' : text;
        }
    }

    function toMarkup(surface) {
        const output = [];
        let pending = '';
        for (const node of surface.childNodes) {
            if (!blocks.has(node.tagName)) {
                pending += inlineMarkup(node);
                continue;
            }
            if (pending.trim()) {
                output.push(pending.trim());
            }
            pending = '';
            const tag = node.tagName;
            const text = Array.from(node.childNodes, inlineMarkup).join('').trim();
            if (tag === 'PRE') {
                const code = node.innerText.replace(/\n$/, '');
                if (code) {
                    output.push(code.split('\n').map(line => '    ' + line).join('\n'));
                }
            } else if (tag === 'BLOCKQUOTE') {
                if (text) {
                    output.push(text.split('\n').map(line => '> ' + line).join('\n'));
                }
            } else if (tag === 'UL' || tag === 'OL') {
                const items = Array.from(node.children)
                    .map(li => inlineMarkup(li).trim().replace(/\s*\n\s*/g, ' '))
                    .filter(Boolean);
                output.push(items.map((item, index) => (tag === 'UL' ? '- ' : (index + 1) + '. ') + item).join('\n'));
            } else if (tag === 'HR') {
                output.push('---');
            } else if (text) {
                output.push(/^H[1-6]$/.test(tag) ? '#'.repeat(Number(tag[1])) + ' ' + text : text);
            }
        }
        if (pending.trim()) {
            output.push(pending.trim());
        }
        return output.filter(Boolean).join('\n\n');
    }

    const iconPaths = {
        bullets: 'M5 5h.01M5 10h.01M5 15h.01M9 5h8M9 10h8M9 15h8',
        numbers: 'M9 5h8M9 10h8M9 15h8M3 4l1-1v4M3 10a1 1 0 1 1 2 0l-2 2h2M3 15h2l-1 1 1 1H3',
        quote: 'M4 11h4v5H3v-5l2-5m7 5h4v5h-5v-5l2-5',
        code: 'm7 5-5 5 5 5m6-10 5 5-5 5m-2-12-2 14',
        link: 'm8 12 4-4m-6 6-1 1a3 3 0 0 1-4-4l4-4a3 3 0 0 1 4 0m2 6a3 3 0 0 0 4 0l4-4a3 3 0 0 0-4-4l-1 1',
        undo: 'M7 4 2 9l5 5M2 9h10a5 5 0 0 1 0 10h-2',
        redo: 'm13 4 5 5-5 5m5-5H8a5 5 0 0 0 0 10h2',
    };

    function toolbarIcon(document, name) {
        if (!(name in iconPaths)) {
            const glyph = document.createElement('span');
            glyph.className = 'kompose-glyph kompose-glyph-' + name;
            glyph.textContent = { bold: 'B', italic: 'I', text: '¶', heading: 'H₂' }[name];
            glyph.setAttribute('aria-hidden', 'true');
            return glyph;
        }
        const namespace = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(namespace, 'svg');
        svg.setAttribute('viewBox', '0 0 20 20');
        svg.setAttribute('aria-hidden', 'true');
        svg.setAttribute('focusable', 'false');
        const path = document.createElementNS(namespace, 'path');
        path.setAttribute('d', iconPaths[name]);
        svg.append(path);
        return svg;
    }

    function mount(textarea) {
        if (textarea?.tagName !== 'TEXTAREA') {
            throw new TypeError('Kompose.mount expects a textarea.');
        }
        if (editors.has(textarea)) {
            return editors.get(textarea);
        }

        const document = textarea.ownerDocument;
        const editor = document.createElement('div');
        const toolbar = document.createElement('div');
        const surface = document.createElement('div');
        const status = document.createElement('div');
        const required = textarea.required;
        const maximum = textarea.maxLength;
        let sourceMode = false;
        let selection = null;

        editor.className = 'kompose';
        toolbar.className = 'kompose-toolbar';
        toolbar.setAttribute('role', 'group');
        toolbar.setAttribute('aria-label', 'Formatting');
        surface.className = 'kompose-surface';
        surface.contentEditable = 'true';
        surface.setAttribute('role', 'textbox');
        surface.setAttribute('aria-multiline', 'true');
        surface.setAttribute('aria-required', String(required));
        const label = textarea.labels?.[0];
        if (textarea.id) {
            surface.id = textarea.id + '-visual';
        }
        surface.setAttribute('aria-label', textarea.getAttribute('aria-label') || label?.textContent.trim() || 'Post body');
        status.className = 'kompose-status';
        status.setAttribute('role', 'status');
        status.hidden = true;

        function report(message) {
            status.textContent = message;
            status.hidden = !message;
        }

        function sync() {
            textarea.value = toMarkup(surface);
            report('');
        }

        function restoreSelection() {
            const current = document.getSelection();
            const saved = selection;
            surface.focus();
            if (saved && surface.contains(saved.commonAncestorContainer)) {
                current.removeAllRanges();
                current.addRange(saved);
            }
            return current;
        }

        function group(name) {
            const element = document.createElement('div');
            element.className = 'kompose-toolbar-group';
            element.setAttribute('role', 'group');
            element.setAttribute('aria-label', name);
            toolbar.append(element);
            return element;
        }

        function button(label, action, container, icon = '') {
            const control = document.createElement('button');
            control.type = 'button';
            if (icon) {
                control.className = 'kompose-icon-button';
                control.setAttribute('aria-label', label);
                control.title = label;
                control.append(toolbarIcon(document, icon));
            } else {
                control.textContent = label;
            }
            control.addEventListener('mousedown', event => event.preventDefault());
            control.addEventListener('click', action);
            container.append(control);
            return control;
        }

        const pressed = new Map();
        const groups = [
            ['History', [['Undo', 'undo', 'undo'], ['Redo', 'redo', 'redo']]],
            ['Text', [
                ['Bold', 'bold', 'bold'], ['Italic', 'italic', 'italic'],
                ['Paragraph', 'text', 'formatBlock', 'p'], ['Heading', 'heading', 'formatBlock', 'h2'],
            ]],
            ['Lists', [['Bullets', 'bullets', 'insertUnorderedList'], ['Numbers', 'numbers', 'insertOrderedList']]],
            ['Insert', [['Quote', 'quote', 'formatBlock', 'blockquote'], ['Code block', 'code', 'formatBlock', 'pre']]],
        ];
        const formatGroups = [];
        for (const [name, commands] of groups) {
            const supported = commands.filter(([, , command]) => document.queryCommandSupported?.(command));
            if (!supported.length) {
                continue;
            }
            const container = group(name);
            formatGroups.push(container);
            for (const [label, icon, command, value] of supported) {
                const control = button(label, () => {
                    restoreSelection();
                    document.execCommand(command, false, value ?? null);
                    sync();
                    rememberSelection();
                }, container, icon);
                if (['bold', 'italic', 'insertUnorderedList', 'insertOrderedList'].includes(command)) {
                    control.setAttribute('aria-pressed', 'false');
                    pressed.set(command, control);
                }
            }
        }

        if (document.queryCommandSupported?.('createLink')) {
            const linkGroup = group('Links');
            formatGroups.push(linkGroup);
            button('Link', () => {
                if (restoreSelection().isCollapsed) {
                    report('Select the text to link first.');
                    return;
                }
                const value = document.defaultView.prompt('Link URL', 'https://');
                if (value === null) {
                    return;
                }
                const url = safeDestination(value);
                if (!url || url === 'https://') {
                    report('Enter a valid link URL.');
                    return;
                }
                restoreSelection();
                document.execCommand('createLink', false, url);
                sync();
            }, linkGroup, 'link');
        }

        const modeGroup = group('Editor mode');
        modeGroup.classList.add('kompose-toolbar-mode');
        const toggle = button('Markdown', () => {
            sourceMode = !sourceMode;
            if (!sourceMode) {
                loadMarkup(surface, textarea.value);
            }
            selection = null;
            textarea.hidden = !sourceMode;
            textarea.required = sourceMode && required;
            surface.hidden = sourceMode;
            formatGroups.forEach(container => { container.hidden = sourceMode; });
            toggle.textContent = sourceMode ? 'Visual editor' : 'Markdown';
            if (label && surface.id) {
                label.htmlFor = sourceMode ? textarea.id : surface.id;
            }
            report('');
            (sourceMode ? textarea : surface).focus();
        }, modeGroup);

        function rememberSelection() {
            const current = document.getSelection();
            if (current.rangeCount && surface.contains(current.getRangeAt(0).commonAncestorContainer)) {
                selection = current.getRangeAt(0).cloneRange();
                for (const [command, control] of pressed) {
                    control.setAttribute('aria-pressed', String(document.queryCommandState?.(command) ?? false));
                }
            }
        }

        surface.addEventListener('input', () => {
            sync();
            rememberSelection();
        });
        surface.addEventListener('focus', rememberSelection);
        surface.addEventListener('keyup', rememberSelection);
        surface.addEventListener('pointerup', rememberSelection);
        surface.addEventListener('click', event => {
            if (event.target.closest?.('a')) {
                event.preventDefault();
            }
        });
        surface.addEventListener('paste', event => {
            event.preventDefault();
            const text = event.clipboardData?.getData('text/plain') ?? '';
            if (!text) {
                return;
            }
            if (!document.execCommand?.('insertText', false, text)) {
                const current = document.getSelection();
                if (current.rangeCount && surface.contains(current.getRangeAt(0).commonAncestorContainer)) {
                    current.deleteFromDocument();
                    const node = document.createTextNode(text);
                    current.getRangeAt(0).insertNode(node);
                    current.collapse(node, node.length);
                }
            }
            sync();
        });
        surface.addEventListener('drop', event => event.preventDefault());

        textarea.form?.addEventListener('submit', event => {
            const missing = required && !textarea.value.trim();
            const tooLong = maximum >= 0 && textarea.value.length > maximum;
            if (missing || tooLong) {
                event.preventDefault();
                report(missing ? 'Enter a post before submitting.' : 'The post exceeds ' + maximum + ' characters.');
                (sourceMode ? textarea : surface).focus();
            }
        });
        textarea.form?.addEventListener('reset', () => queueMicrotask(() => {
            loadMarkup(surface, textarea.value);
            selection = null;
            report('');
        }));

        textarea.before(editor);
        editor.append(toolbar, surface, textarea, status);
        loadMarkup(surface, textarea.value);
        label?.addEventListener('click', event => {
            if (!sourceMode) {
                event.preventDefault();
                surface.focus();
            }
        });
        textarea.hidden = true;
        textarea.required = false;
        if (label && surface.id) {
            label.htmlFor = surface.id;
        }
        const instance = { textarea, surface, get value() { return textarea.value; } };
        editors.set(textarea, instance);
        return instance;
    }

    globalThis.Kompose = Object.freeze({ mount });
})();
