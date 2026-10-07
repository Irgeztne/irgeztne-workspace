#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = process.env.IRGEZTNE_OFFICE_ROOT
  ? path.resolve(process.env.IRGEZTNE_OFFICE_ROOT)
  : path.resolve(__dirname, '..');
const documentsPath = path.join(root, 'src/modules/documents/documents-v0.js');
const source = fs.readFileSync(documentsPath, 'utf8');

assert(
  source.includes("if (getFocusedDocumentsSurface()) return;") &&
  source.includes("document.querySelectorAll('[data-documents-root]').forEach"),
  'Documents save-state UI is not scoped to Documents roots.'
);
assert(
  !source.includes("document.querySelectorAll('[data-documents-save-state]').forEach"),
  'Documents still mutates save-state badges globally across the outer Office shell.'
);
assert(
  source.includes("if (!force && (renderingDocuments || getFocusedDocumentsSurface())) return;"),
  'Outer Office setters are not guarded while Documents owns focus.'
);

const inputStart = source.indexOf("document.addEventListener('input', (event) => {");
const changeStart = source.indexOf("document.addEventListener('change', (event) => {", inputStart);
assert(inputStart >= 0 && changeStart > inputStart, 'Documents input handler was not found.');
const inputHandler = source.slice(inputStart, changeStart);
assert(!inputHandler.includes('renderAll();'), 'Typing still directly calls renderAll().');
assert(inputHandler.includes('saveState();'), 'Typing no longer persists document state.');
assert(inputHandler.includes('scheduleSavedState();'), 'Typing no longer schedules saved state.');

console.log('PASS: Documents caret isolation keeps autosave DOM mutations inside Documents and does not renderAll() on input.');
