#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const wb = read('src/modules/editor-workbench/editor-workbench.js');
const html = read('src/modules/editor-workbench/editor-workbench.html');
const css = read('src/modules/editor-workbench/editor-workbench.css');
const bridge = read('docs/WEBSTUDIO-WIDGET-CONTRACT-v1.md');
const frozen = fs.readFileSync(path.join(root, 'docs/workshop/IRGEZTNE-SITE-WIDGET-CONTRACT-v1.md'));

function must(cond, msg) { if (!cond) throw new Error(msg); }
function has(text, needle, msg) { must(text.includes(needle), msg); }
function lacks(text, needle, msg) { must(!text.includes(needle), msg); }
function between(text, start, end, label) {
  const a = text.indexOf(start);
  const b = text.indexOf(end, a + start.length);
  must(a >= 0 && b > a, label + ' not found');
  return text.slice(a, b);
}

const frozenHash = crypto.createHash('sha256').update(frozen).digest('hex');
must(frozenHash === 'd1dbca9a437d5082433da4b42e139d1e63dd888c3c0ba5314ca04f4759a497ad', 'FROZEN Site Widget Contract changed');

has(wb, 'IRGEZTNE_WORKBENCH_WIDGET_PRESENTATION_CLOSEOUT_R1W9H2', 'R1W9H2 workbench marker missing');
has(css, 'IRGEZTNE_WORKBENCH_WIDGET_PRESENTATION_CLOSEOUT_R1W9H2', 'R1W9H2 CSS marker missing');
has(bridge, '## 12. Editor Widget presentation closeout', 'R1W9H2 bridge documentation missing');

// Permanent giant runtime inspector is gone: management rows are inside the on-demand popover.
const panelStart = html.indexOf('id="ewbWidgetsPanel"');
const panelEnd = html.indexOf('</section>\n\n    <section class="ewb-editor-wrap">', panelStart);
const instancesAt = html.indexOf('id="ewbWidgetInstancesR1W9H"');
must(panelStart >= 0 && panelEnd > panelStart && instancesAt > panelStart && instancesAt < panelEnd, 'Widget instance inspector is not nested inside the on-demand Site Widgets panel');
has(html, 'id="ewbEditorCanvasR1W9H"', 'Editor Widget canvas missing');
has(html, 'id="ewbWidgetSurfaceBeforeR1W9H"', 'Before-content Widget Host Surface missing');
has(html, 'id="ewbWidgetSurfaceAfterR1W9H"', 'After-content Widget Host Surface missing');
has(html, 'id="ewbWidgetSurfaceFloatingR1W9H"', 'Floating Widget Host Surface missing');

const renderInspector = between(wb, 'function renderWidgetInstancesR1W9H()', 'function widgetSnapshotByIdR1W9G', 'Widget instance inspector renderer');
lacks(renderInspector, 'widgetPreviewFrameR1W9H(instance)', 'Management inspector still embeds large runtime previews');
has(renderInspector, 'ewb-widget-instance-row-r1w9h2', 'Compact Widget management row missing');
has(renderInspector, 'renderWidgetEditorSurfacesR1W9H2()', 'Inspector update does not refresh editor placement surfaces');

const renderCanvas = between(wb, 'function widgetEditorSurfaceBucketR1W9H2', 'function renderWidgetInstancesR1W9H()', 'Editor Widget presentation renderer');
has(renderCanvas, "if (mode === 'floating') return 'floating';", 'Floating Widgets are not separated from flow layout');
has(renderCanvas, "['page-top', 'after-header', 'main-start'].includes(slot) ? 'before' : 'after'", 'Semantic before/after slot mapping missing');
has(renderCanvas, 'widgetPreviewFrameR1W9H(instance)', 'Editor Host Surface does not render Widget runtime');
has(renderCanvas, "host.setAttribute('contenteditable', 'false')", 'Editor Widget Host Surface can leak into editable HTML');

const blockChrome = between(wb, 'function positionBlockChromeR1W9F6()', 'function adjacentTopLevelBlockR1W9F6', 'Block chrome positioning');
lacks(blockChrome, 'widgetsPanelR1W9G', 'Global Site Widgets panel still follows the selected block / ⋮ handle');
has(wb, 'function positionWidgetsPanelR1W9H2()', 'Stable global Site Widgets panel positioning missing');
has(wb, 'window.requestAnimationFrame(positionWidgetsPanelR1W9H2);', 'Site Widgets panel is not anchored independently');

const saveFn = between(wb, 'function editorHtmlForSaveV084H()', '// IRGEZTNE_EDITOR_UNIFIED_HISTORY_R1W9F6C', 'Editor save serializer');
has(saveFn, 'const clone = editor.cloneNode(true);', 'Editor save no longer serializes only the contenteditable page body');
lacks(saveFn, 'widgetSurface', 'Editor Widget presentation surfaces leaked into page HTML serializer');

has(css, '.ewb-widget-instance-row-r1w9h2', 'Compact management-row styling missing');
has(css, '.ewb-widget-editor-floating-layer-r1w9h', 'Floating editor layer styling missing');
has(css, 'position: absolute;', 'Floating editor layer is not overlay geometry');
has(css, '.ewb-widget-editor-host-r1w9h2.size-compact', 'Editor semantic Widget size geometry missing');
has(css, '.ewb-widget-editor-host-r1w9h2.mode-bar', 'Editor bar geometry missing');

console.log('PASS: R1W9H2 keeps Widget management compact/on-demand, decouples it from block chrome, and renders non-persistent Widget Host Surfaces on the editor canvas according to semantic placement.');
