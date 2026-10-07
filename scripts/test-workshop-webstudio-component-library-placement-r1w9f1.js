#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const studioPath = path.join(root, 'src/modules/editor-site-studio-safe/editor-site-studio-safe-v5.js');
const workbenchHtmlPath = path.join(root, 'src/modules/editor-workbench/editor-workbench.html');
const workbenchJsPath = path.join(root, 'src/modules/editor-workbench/editor-workbench.js');
const workbenchCssPath = path.join(root, 'src/modules/editor-workbench/editor-workbench.css');

const studio = fs.readFileSync(studioPath, 'utf8');
const html = fs.readFileSync(workbenchHtmlPath, 'utf8');
const js = fs.readFileSync(workbenchJsPath, 'utf8');
const css = fs.readFileSync(workbenchCssPath, 'utf8');

function must(cond, msg) { if (!cond) throw new Error(msg); }
function has(text, needle, msg) { must(text.includes(needle), msg); }
function lacks(text, needle, msg) { must(!text.includes(needle), msg); }
function sliceBetween(text, startNeedle, endNeedle, label) {
  const start = text.indexOf(startNeedle);
  const end = text.indexOf(endNeedle, start + startNeedle.length);
  must(start >= 0 && end > start, label + ' not found');
  return text.slice(start, end);
}

has(studio, 'IRGEZTNE_WORKSHOP_COMPONENT_LIBRARY_PLACEMENT_R1W9F1', 'Parent placement marker missing');
has(studio, 'installedComponents: workshopInstalledComponentsForWorkbenchR1W9F1()', 'Parent does not hand installed components to Workbench');
has(studio, "data.type === 'component-insert-r1w9f1'", 'Parent does not accept Workbench component insertion request');
has(studio, 'saveEditorWorkbenchPayloadV084B(data);', 'Parent does not preserve current Workbench edits before component insertion');
has(studio, "void insertWorkshopInstalledComponentR1W9F(data.packageId || '')", 'Parent insertion request does not reuse the verified R1W9F materialization path');

const pageTab = sliceBetween(studio, 'function renderPageTab(state, page)', 'function renderПредпросмотрTab(state, page)', 'Page tab');
lacks(pageTab, 'renderWorkshopInstalledComponentsR1W9F(state)', 'Component catalogue is still permanently mounted above Editor Workbench');
has(pageTab, 'editor-workbench/editor-workbench.html', 'Structured editor no longer mounts Editor Workbench');

has(html, 'data-action="blocks"', 'Workbench Blocks button missing');
has(html, 'id="ewbBlocksPanel"', 'On-demand block library panel missing');
has(html, 'id="ewbBlocksList"', 'Block library list missing');
has(html, 'data-action="blocks-close"', 'Block library close action missing');

has(js, 'IRGEZTNE_WORKBENCH_COMPONENT_LIBRARY_R1W9F1', 'Workbench component library marker missing');
has(js, 'Array.isArray(data.installedComponents)', 'Workbench does not consume parent-provided component list');
has(js, "insertButton.dataset.action = 'component-insert-r1w9f1'", 'Workbench cards do not expose the insert action');
has(js, "send('component-insert-r1w9f1', { packageId })", 'Workbench insert does not route through parent bridge');
has(js, "localText('Blocks', 'Блоки')", 'Blocks control is not localized');
lacks(js, 'NSCodeHubV1', 'Workbench reaches directly into Workshop adapter instead of using parent handoff');
lacks(js, 'getInstalledComponents(', 'Workbench reaches directly into installed registry discovery');

has(css, 'IRGEZTNE_WORKBENCH_COMPONENT_LIBRARY_R1W9F1', 'Workbench library CSS marker missing');
has(css, '.ewb-blocks-panel', 'Workbench library panel styling missing');
has(css, 'max-height: 330px', 'Workbench library does not remain compact when many components exist');
has(css, '.ewb-blocks-list', 'Workbench component grid styling missing');

console.log('PASS: R1W9F1 moves installed Component/Block discovery behind an on-demand Blocks control inside Editor Workbench while preserving the verified parent adapter/insertion boundary');
