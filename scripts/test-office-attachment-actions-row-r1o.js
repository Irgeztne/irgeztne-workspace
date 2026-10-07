#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const cssPath = path.join(root, 'src/modules/documents/documents-v0.css');
const css = fs.readFileSync(cssPath, 'utf8');
const match = css.match(/\.ns-documents-v1__file-entry-actions\s*\{([\s\S]*?)\}/);
if (!match) throw new Error('file-entry-actions block not found');
const block = match[1];
if (!/grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/.test(block)) {
  throw new Error('attachment actions are not three equal columns');
}
if (!/gap:\s*8px/.test(block)) throw new Error('existing 8px gap changed');
if (!/width:\s*100%/.test(block)) throw new Error('actions row width changed');
if (!css.includes('IRGEZTNE_WORKSPACE_FILE_OPEN_R1N')) {
  throw new Error('R1N attachment Open styling missing');
}
if (!css.includes('IRGEZTNE_DOCUMENT_BUNDLE_EXPORT_R1L')) {
  throw new Error('bundle export styling missing');
}
console.log('PASS: Office attachment actions are one three-column row; R1N/R1L styles preserved');
