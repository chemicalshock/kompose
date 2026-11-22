# Kompose

A standalone, dependency-free JavaScript visual editor for Markdown. Its first
format is the Markdown subset rendered by ORCA2. Load `src/kompose.css` and
`src/kompose.js`, then call `Kompose.mount(textarea)` after the textarea exists.

Kompose uses the textarea as its form field. The **Markdown** button opens the
source for direct editing. Without JavaScript, the original textarea works as
usual. Multiple textareas can be mounted independently.

The visual editor supports bold, italic, headings, links, lists, block quotes,
and indented code blocks. Pasting inserts plain text. Raw HTML and other
Markdown dialects are outside the visual editor’s format. Existing source is
preserved until the visual document changes.

Toolbar commands use browser-native editing where available to preserve undo.
The source editor remains available when a browser lacks a formatting command.
Override the `--kompose-*` CSS variables on the editor to match its host page.
