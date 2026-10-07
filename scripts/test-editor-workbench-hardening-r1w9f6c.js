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

has(js, 'IRGEZTNE_EDITOR_HARDENING_R1W9F6C', 'Hardening marker missing');
has(js, "toolbarR1W9F5.style.width = 'max-content'", 'Toolbar does not measure natural content width');
lacks(js, 'Math.min(1220, available)', 'Old 1220px toolbar stretch remains');
has(css, 'width: max-content;', 'Toolbar CSS is not content-sized');

has(css, 'IRGEZTNE_WORKBENCH_ANCHORED_POPOVERS_R1W9F6C', 'Anchored popover CSS marker missing');
has(css, '.ewb-dialog {\n  position: absolute;', 'Dialog is not an anchored absolute popover');
lacks(css, '.ewb-dialog {\n  position: fixed;', 'Fullscreen fixed dialog model remains');
lacks(css, 'background: rgba(2, 8, 23, .64);', 'Blackout backdrop remains');
has(js, 'positionDialogPopoverR1W9F6C', 'Popover positioning function missing');
has(js, "openDialog('link', button)", 'Link popover is not anchored to its trigger');
has(js, "openDialog('image', button)", 'Image URL popover is not anchored to its trigger');
has(js, "openDialog('video', button)", 'Video URL popover is not anchored to its trigger');

has(js, 'if (mediaBlockFromTargetV084J(element)) return null;', 'Media is not excluded from generic block detection');
has(js, 'ensureMediaInspectorV084J', 'Dedicated media inspector missing');
has(js, "data-media-size=\"full\"", 'Media inspector lost 100% size');
has(js, "data-media-align=\"center\"", 'Media inspector lost alignment controls');

has(js, 'IRGEZTNE_EDITOR_UNIFIED_HISTORY_R1W9F6C', 'Unified history marker missing');
has(js, 'recordEditorHistoryBoundaryR1W9F6C', 'History transaction boundary missing');
has(js, 'recordEditorHistoryInputBoundaryR1W9F6C', 'Text-edit history capture missing');
has(js, 'editorUndoR1W9F6C', 'Unified undo missing');
has(js, 'editorRedoR1W9F6C', 'Unified redo missing');
has(js, "recordEditorHistoryBoundaryR1W9F6C('block-delete')", 'Block delete is outside unified history');
has(js, "recordEditorHistoryBoundaryR1W9F6C('block-move')", 'Block move is outside unified history');
has(js, "recordEditorHistoryBoundaryR1W9F6C('component-insert')", 'Component insert is outside unified history');
has(js, "recordEditorHistoryBoundaryR1W9F6C('media-delete')", 'Media delete is outside unified history');
has(js, "inputType === 'historyUndo'", 'Native historyUndo is not routed to unified history');
has(js, 'historyShortcut', 'Ctrl/Cmd+Z routing missing');

has(studio, "type: 'component-inserted-r1w9f6c'", 'Parent does not return inserted component HTML to live workbench');
has(js, "data.type === 'component-inserted-r1w9f6c'", 'Workbench does not accept component insertion result');
has(studio, 'data-workshop-component-title', 'Component snapshot lacks metadata for history restore');
has(studio, "placement: String(node.getAttribute('data-workshop-component-placement')", 'Metadata reconstruction after Undo is missing');
has(studio, 'page.workshopComponentInsertions = liveList;', 'Component metadata is not reconciled with bodyHtml');

must(/editor-workbench\.html\?v=(?:r1w9f6c|r1w9h)&amp;theme=/.test(studio), 'Parent cache-bust missing');
must(/editor-workbench\.css\?v=(?:r1w9f6c|r1w9h)/.test(html), 'CSS cache-bust missing');
must(/editor-workbench\.js\?v=(?:r1w9f6c|r1w9h)/.test(html), 'JS cache-bust missing');

console.log('PASS: R1W9F6C hardens Editor toolbar sizing, anchored popovers, dedicated media inspector boundaries, and unified Undo/Redo including structural Component metadata reconciliation.');
