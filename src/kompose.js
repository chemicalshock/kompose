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
    const emojiCategories = {
        Smileys: [
            ['😀', 'Grinning face'], ['😊', 'Smiling face'], ['😂', 'Tears of joy laugh'], ['😉', 'Winking face'],
            ['😎', 'Sunglasses'], ['🤔', 'Thinking face'], ['😮', 'Surprised face'], ['😅', 'Grinning with sweat'],
            ['😢', 'Crying face'], ['😕', 'Confused face'], ['🙃', 'Upside-down face'], ['👀', 'Eyes'],
            ['😍', 'Heart eyes'], ['😴', 'Sleeping face'], ['😡', 'Angry face'], ['🤯', 'Mind blown'],
        ],
        People: [
            ['👍', 'Thumbs up'], ['👎', 'Thumbs down'], ['👏', 'Clapping hands'], ['🙌', 'Raised hands'],
            ['🙏', 'Folded hands thanks'], ['👋', 'Waving hand'], ['🤝', 'Handshake'], ['👌', 'OK hand'],
            ['✌️', 'Victory peace'], ['💪', 'Flexed biceps'], ['🤷', 'Shrug'], ['🤦', 'Facepalm'],
        ],
        Nature: [
            ['🐛', 'Bug'], ['🐶', 'Dog'], ['🐱', 'Cat'], ['🦊', 'Fox'], ['🦋', 'Butterfly'], ['🌱', 'Seedling'],
            ['🌳', 'Tree'], ['🌻', 'Sunflower'], ['☀️', 'Sun'], ['🌧️', 'Rain'], ['🌈', 'Rainbow'], ['🔥', 'Fire'],
        ],
        Food: [
            ['🍕', 'Pizza'], ['🍔', 'Burger'], ['🍟', 'Fries'], ['🍿', 'Popcorn'], ['🍎', 'Apple'], ['🍰', 'Cake'],
            ['🍪', 'Cookie'], ['🍫', 'Chocolate'], ['☕', 'Coffee'], ['🍵', 'Tea'], ['🍺', 'Beer'], ['🥤', 'Soft drink'],
        ],
        Objects: [
            ['🎉', 'Party popper'], ['🎁', 'Gift'], ['💡', 'Light bulb idea'], ['🚀', 'Rocket'], ['💻', 'Laptop computer'],
            ['⚙️', 'Gear settings'], ['🔧', 'Wrench'], ['⌨️', 'Keyboard'], ['📌', 'Pushpin'], ['🔍', 'Magnifying glass'],
            ['📚', 'Books'], ['🔗', 'Link'], ['📷', 'Camera'], ['🏆', 'Trophy'],
        ],
        Symbols: [
            ['❤️', 'Red heart'], ['💚', 'Green heart'], ['💙', 'Blue heart'], ['💔', 'Broken heart'], ['✅', 'Check mark'],
            ['❌', 'Cross mark'], ['⭐', 'Star'], ['⚠️', 'Warning'], ['❓', 'Question mark'], ['❗', 'Exclamation mark'],
            ['💯', 'Hundred points'], ['♻️', 'Recycle'], ['➕', 'Plus'], ['➡️', 'Right arrow'],
        ],
    };
    const allEmojis = Object.values(emojiCategories).flat();

    //
    //!\brief Returns a safe URL for use in links and images, or an empty string if the URL is unsafe.
    //
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

    //
    //!\brief Renders inline Markdown into a parent element.
    //
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

    //
    //!\brief Renders Markdown into the visual editor.
    //
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
            const fence = line.match(/^ {0,3}(`{3,}|~{3,})[ \t]*([a-z][a-z0-9_+-]{0,31})?[ \t]*$/i);
            if (fence) {
                const closing = new RegExp('^ {0,3}' + fence[1][0] + '{' + fence[1].length + ',}[ \\t]*$');
                const code = [];
                index++;
                while (index < lines.length && !closing.test(lines[index])) {
                    code.push(lines[index++]);
                }
                if (index < lines.length) index++;
                const pre = document.createElement('pre');
                if (fence[2]) pre.dataset.codeLanguage = fence[2].toLowerCase();
                pre.textContent = code.join('\n');
                fragment.append(pre);
                continue;
            }
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

    //
    //!\brief Converts an inline DOM node to Markdown.
    //
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

    //
    //!\brief Serializes the visual editor content to Markdown.
    //
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
                    const language = node.dataset.codeLanguage ?? '';
                    if (/^[a-z][a-z0-9_+-]{0,31}$/.test(language)) {
                        const fence = '`'.repeat((code.match(/`+/g) ?? []).reduce(
                            (longest, run) => Math.max(longest, run.length + 1), 3
                        ));
                        output.push(fence + language + '\n' + code + '\n' + fence);
                    } else {
                        output.push(code.split('\n').map(line => '    ' + line).join('\n'));
                    }
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

    //
    //!\brief Creates the toolbar icon for a named action.
    //
    function toolbarIcon(document, name) {
        if (!(name in iconPaths)) {
            const glyph = document.createElement('span');
            glyph.className = 'kompose-glyph kompose-glyph-' + name;
            glyph.textContent = { bold: 'B', italic: 'I', text: '¶', heading: 'H₂', emoji: '☺' }[name];
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

    //
    //!\brief Mounts the Markdown editor on a textarea.
    //
    function mount(textarea, options = {}) {
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
        const highlighter = options.highlighter;
        const languages = highlighter?.listLanguages() ?? [];
        const defaultLanguage = languages.includes(options.defaultCodeLanguage) ? options.defaultCodeLanguage : 'plaintext';
        const codeLanguage = document.createElement('select');
        const codePreview = document.createElement('pre');
        const previewBody = document.createElement('code');
        const required = textarea.required;
        const maximum = textarea.maxLength;
        let sourceMode = false;
        let selection = null;
        let newBlockLanguage = defaultLanguage;
        let previewSource;
        let previewLanguage;

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
        codePreview.className = 'kompose-code-preview';
        codePreview.hidden = true;
        codePreview.setAttribute('aria-label', 'Highlighted code preview');
        previewBody.className = 'codeglint';
        codePreview.append(previewBody);

        //
        //!\brief Returns the code block containing the saved selection.
        //
        function selectedCodeBlock() {
            const node = selection?.startContainer;
            const element = node?.nodeType === 1 ? node : node?.parentElement;
            const block = element?.closest('pre');
            return block && surface.contains(block) ? block : null;
        }

        //
        //!\brief Updates the language selector and highlighted code preview.
        //
        function refreshCodePreview() {
            if (!highlighter) return;
            const block = sourceMode ? null : selectedCodeBlock();
            const language = block
                ? highlighter.getLanguage(block.dataset.codeLanguage || defaultLanguage, { fallback: true }).id
                : newBlockLanguage;
            codeLanguage.value = language;
            const source = block?.innerText ?? '';
            codePreview.hidden = !source || language === 'plaintext';
            if (!codePreview.hidden && (source !== previewSource || language !== previewLanguage)) {
                previewBody.innerHTML = highlighter.highlight(source, { language, fallback: true });
                previewSource = source;
                previewLanguage = language;
            }
        }

        //
        //!\brief Displays or clears the editor status message.
        //
        function report(message) {
            status.textContent = message;
            status.hidden = !message;
        }

        //
        //!\brief Updates the textarea from the visual editor and clears the status.
        //
        function sync() {
            textarea.value = toMarkup(surface);
            report('');
        }

        //
        //!\brief Focuses the visual editor and restores the saved selection.
        //
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

        //
        //!\brief Inserts plain text into the visual editor at the saved selection.
        //
        function insertVisualText(text) {
            const current = restoreSelection();
            if (!current.rangeCount || !surface.contains(current.getRangeAt(0).commonAncestorContainer)) {
                current.selectAllChildren(surface);
                current.collapseToEnd();
            }
            if (!document.execCommand?.('insertText', false, text)) {
                current.deleteFromDocument();
                const node = document.createTextNode(text);
                current.getRangeAt(0).insertNode(node);
                current.collapse(node, node.length);
            }
            sync();
            rememberSelection();
        }

        //
        //!\brief Creates and appends a labeled toolbar group.
        //
        function group(name) {
            const element = document.createElement('div');
            element.className = 'kompose-toolbar-group';
            element.setAttribute('role', 'group');
            element.setAttribute('aria-label', name);
            toolbar.append(element);
            return element;
        }

        //
        //!\brief Creates a toolbar button with its click action.
        //
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
                    rememberSelection();
                    if (value === 'pre' && highlighter) {
                        const block = selectedCodeBlock();
                        if (block && !block.dataset.codeLanguage) block.dataset.codeLanguage = newBlockLanguage;
                    }
                    sync();
                    refreshCodePreview();
                }, container, icon);
                if (['bold', 'italic', 'insertUnorderedList', 'insertOrderedList'].includes(command)) {
                    control.setAttribute('aria-pressed', 'false');
                    pressed.set(command, control);
                }
            }
        }

        if (languages.length) {
            const languageGroup = group('Code language');
            formatGroups.push(languageGroup);
            codeLanguage.className = 'kompose-code-language';
            codeLanguage.setAttribute('aria-label', 'Code language');
            codeLanguage.title = 'Code language for the selected or next code block';
            const labels = { plaintext: 'Plain text', cpp: 'C / C++', javascript: 'JavaScript', json: 'JSON' };
            for (const language of languages) {
                const option = document.createElement('option');
                option.value = language;
                option.textContent = highlighter.getLanguage(language).name || labels[language] || language;
                codeLanguage.append(option);
            }
            codeLanguage.value = newBlockLanguage;
            codeLanguage.addEventListener('change', () => {
                const block = selectedCodeBlock();
                if (block) {
                    block.dataset.codeLanguage = codeLanguage.value;
                    sync();
                    restoreSelection();
                } else {
                    newBlockLanguage = codeLanguage.value;
                }
                refreshCodePreview();
            });
            languageGroup.append(codeLanguage);
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

        const emojiPicker = document.createElement('div');
        emojiPicker.className = 'kompose-emoji-picker';
        emojiPicker.hidden = true;
        emojiPicker.setAttribute('role', 'group');
        emojiPicker.setAttribute('aria-label', 'Choose an emoji');
        const emojiSearch = document.createElement('input');
        emojiSearch.type = 'search';
        emojiSearch.placeholder = 'Search emoji';
        emojiSearch.setAttribute('aria-label', 'Search emoji');
        emojiSearch.autocomplete = 'off';
        const emojiFilters = document.createElement('div');
        emojiFilters.className = 'kompose-emoji-filters';
        emojiFilters.setAttribute('role', 'group');
        emojiFilters.setAttribute('aria-label', 'Emoji categories');
        const emojiGrid = document.createElement('div');
        emojiGrid.className = 'kompose-emoji-grid';
        const emojiStatus = document.createElement('div');
        emojiStatus.setAttribute('role', 'status');
        emojiPicker.append(emojiSearch, emojiFilters, emojiGrid, emojiStatus);
        let category = 'All';

        const emojiToggle = button('Insert emoji', () => {
            rememberSelection();
            if (emojiPicker.hidden) {
                renderEmojis();
                showEmojis(true);
                emojiSearch.focus();
            } else {
                showEmojis(false);
                emojiToggle.focus();
            }
        }, group('Emoji'), 'emoji');
        emojiToggle.setAttribute('aria-expanded', 'false');

        //
        //!\brief Closes the emoji picker when the user clicks outside it.
        //
        function dismissEmojis(event) {
            if (!emojiPicker.contains(event.target) && !emojiToggle.contains(event.target)) {
                showEmojis(false);
            }
        }

        //
        //!\brief Sets whether the emoji picker is visible.
        //
        function showEmojis(visible) {
            emojiPicker.hidden = !visible;
            emojiToggle.setAttribute('aria-expanded', String(visible));
            if (visible) {
                document.addEventListener('pointerdown', dismissEmojis);
            } else {
                document.removeEventListener('pointerdown', dismissEmojis);
            }
        }

        //
        //!\brief Updates the emoji grid for the current category and search.
        //
        function renderEmojis() {
            const query = emojiSearch.value.trim().toLowerCase();
            const entries = category === 'All' ? allEmojis : emojiCategories[category];
            const matches = entries.filter(([emoji, name]) => emoji.includes(query) || name.toLowerCase().includes(query));
            emojiGrid.replaceChildren();
            for (const [emoji, name] of matches) {
                const choice = button(emoji, () => {
                    showEmojis(false);
                    if (sourceMode) {
                        textarea.setRangeText(emoji, textarea.selectionStart, textarea.selectionEnd, 'end');
                        textarea.focus();
                        textarea.dispatchEvent(new document.defaultView.Event('input', { bubbles: true }));
                    } else {
                        insertVisualText(emoji);
                    }
                }, emojiGrid);
                choice.setAttribute('aria-label', name);
                choice.title = name;
            }
            emojiGrid.scrollTop = 0;
            emojiStatus.textContent = matches.length ? '' : 'No emoji found.';
        }

        for (const name of ['All', ...Object.keys(emojiCategories)]) {
            const filter = button(name, () => {
                category = name;
                for (const control of emojiFilters.children) {
                    control.setAttribute('aria-pressed', String(control.textContent === category));
                }
                renderEmojis();
            }, emojiFilters);
            filter.setAttribute('aria-pressed', String(name === category));
        }
        emojiSearch.addEventListener('input', renderEmojis);
        emojiSearch.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === 'ArrowDown') {
                event.preventDefault();
                emojiGrid.firstElementChild?.focus();
            }
        });
        editor.addEventListener('keydown', event => {
            if (event.key === 'Escape' && !emojiPicker.hidden) {
                event.preventDefault();
                showEmojis(false);
                emojiToggle.focus();
            }
        });
        editor.addEventListener('focusout', event => {
            if (event.relatedTarget && !editor.contains(event.relatedTarget)) {
                showEmojis(false);
            }
        });

        const modeGroup = group('Editor mode');
        modeGroup.classList.add('kompose-toolbar-mode');
        const toggle = button('Markdown', () => {
            showEmojis(false);
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
            refreshCodePreview();
            (sourceMode ? textarea : surface).focus();
        }, modeGroup);

        //
        //!\brief Saves the visual selection and updates the toolbar state.
        //
        function rememberSelection() {
            const current = document.getSelection();
            if (current.rangeCount && surface.contains(current.getRangeAt(0).commonAncestorContainer)) {
                selection = current.getRangeAt(0).cloneRange();
                for (const [command, control] of pressed) {
                    control.setAttribute('aria-pressed', String(document.queryCommandState?.(command) ?? false));
                }
                refreshCodePreview();
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
            if (text) {
                rememberSelection();
                insertVisualText(text);
            }
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
            refreshCodePreview();
            report('');
        }));

        textarea.before(editor);
        editor.append(toolbar, emojiPicker, surface, textarea, codePreview, status);
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
