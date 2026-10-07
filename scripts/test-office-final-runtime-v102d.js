#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = process.env.IRGEZTNE_OFFICE_ROOT
  ? path.resolve(process.env.IRGEZTNE_OFFICE_ROOT)
  : path.resolve(__dirname, '..');
const ownerPath = path.join(root, 'src/preview4-grid-nav-lang-fix.js');
const documentsPath = path.join(root, 'src/modules/documents/documents-v0.js');
const webStudioPath = path.join(root, 'src/modules/editor-site-studio-safe/editor-site-studio-safe-v5.js');

const owner = fs.readFileSync(ownerPath, 'utf8');
const documents = fs.readFileSync(documentsPath, 'utf8');
const webStudio = fs.readFileSync(webStudioPath, 'utf8');

assert(owner.includes("node.closest('[data-ir-no-translate=\"true\"], [contenteditable=\"true\"]')"),
  'Global label cleanup is not isolated from contenteditable Documents.');
assert(owner.includes('if (nextText !== currentText) node.textContent = nextText;'),
  'Global label cleanup still replaces unchanged text nodes.');
assert(owner.includes('const alreadyOrdered = orderedItems.length === currentItems.length'),
  'Top Office navigation has no stable-order guard.');
assert(owner.includes('if (!alreadyOrdered)'),
  'Top Office navigation still moves DOM buttons when their order is unchanged.');

assert(documents.includes('data-ir-no-translate="true" data-documents-rich-editor'),
  'Documents editor is not marked as an application-owned text surface.');
assert(documents.includes("document.addEventListener('input'"),
  'Documents input/autosave owner is missing.');
assert(webStudio.includes('window.IRGEZTNESiteStudioSafeV5 = {'),
  'Web Studio public runtime owner is unavailable.');

console.log('PASS: Office final runtime guards editor text nodes and keeps ordered top navigation stationary.');
