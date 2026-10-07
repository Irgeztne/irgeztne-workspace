#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');

const studio = fs.readFileSync(path.join(root, 'src/modules/editor-site-studio-safe/editor-site-studio-safe-v5.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'src/modules/editor-workbench/editor-workbench.html'), 'utf8');
const js = fs.readFileSync(path.join(root, 'src/modules/editor-workbench/editor-workbench.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'src/modules/editor-workbench/editor-workbench.css'), 'utf8');

function must(cond, msg) { if (!cond) throw new Error(msg); }
function has(text, needle, msg) { must(text.includes(needle), msg); }
function lacks(text, needle, msg) { must(!text.includes(needle), msg); }

has(js, 'IRGEZTNE_WORKBENCH_TEXT_INTERACTION_UX_R1W9F6B', 'R1W9F6B JS marker missing');
has(js, 'textElementFromHitR1W9F6B', 'Text-hit resolver missing');
has(js, 'activateTextToolsFromPointerR1W9F6B', 'Single-click text activation missing');
has(js, "editor.addEventListener('mouseup', (event) =>", 'Pointer-up activation hook missing');
has(js, 'textInteractionActiveR1W9F6B = true;', 'Intent state does not activate');
has(js, 'textInteractionActiveR1W9F6B = false;', 'Intent state has no dismissal path');
has(js, "document.addEventListener('selectionchange'", 'Selection-driven path was lost');
has(js, 'String(selection.toString() || \'\').trim()', 'Real-selection detection missing');
has(js, 'setTextToolsOpenR1W9F6(true);', 'Text toolbar open path missing');
has(js, 'setTextToolsOpenR1W9F6(false);', 'Text toolbar close path missing');

lacks(html, 'data-action="text-tools"', 'Structural ⋮ menu still contains Text tools');
has(html, 'data-action="block-insert-after"', 'Structural insert action missing');
has(html, 'data-action="block-move-up"', 'Structural move-up action missing');
has(html, 'data-action="block-move-down"', 'Structural move-down action missing');
has(html, 'data-action="block-delete"', 'Structural delete action missing');

lacks(html, 'id="ewbMoreTools"', 'Useful tools are still hidden in a More panel');
lacks(html, 'data-action="text-more-toggle"', 'More trigger still exists');
for (const action of ['image','image-url','video','video-url','divider','code','html']) {
  has(html, `data-action="${action}"`, `Main toolbar lost ${action}`);
}
has(html, 'class="ewb-toolbar ewb-text-toolbar-r1w9f6b"', 'R1W9F6B toolbar class missing');
has(css, 'IRGEZTNE_WORKBENCH_TEXT_INTERACTION_UX_R1W9F6B', 'R1W9F6B CSS marker missing');
has(css, 'flex-wrap: nowrap;', 'Toolbar can wrap into multiple rows');
has(css, 'width: 68px;', 'P/H selector was not compacted');
has(css, 'overflow-x: auto;', 'Narrow-screen one-row fallback missing');

must(/editor-workbench\.html\?v=(?:r1w9f6(?:b|c)|r1w9h)&amp;theme=/.test(studio), 'Workbench iframe cache-bust missing');
must(/editor-workbench\.css\?v=(?:r1w9f6(?:b|c)|r1w9h)/.test(html), 'Workbench CSS cache-bust missing');
must(/editor-workbench\.js\?v=(?:r1w9f6(?:b|c)|r1w9h)/.test(html), 'Workbench JS cache-bust missing');

console.log('PASS: R1W9F6B opens text tools on one intentional text click or a real selection, keeps the toolbar one-row with all useful tools visible, and leaves structural Component actions on ⋮.');
