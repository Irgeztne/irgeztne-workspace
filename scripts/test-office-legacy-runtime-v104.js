#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const storageKey = 'irgeztne.documents.v1';
const legacyState = {
  items: [{
    id: 'legacy-document-1',
    title: 'Старый документ',
    documentType: 'article',
    status: 'draft',
    body: 'Текст до OfficeObject',
    createdAt: '2026-08-01T10:00:00.000Z',
    updatedAt: '2026-08-01T10:00:00.000Z',
    projectId: 'project-1',
    fileIds: ['file-1']
  }],
  activeId: 'legacy-document-1'
};
const storage = { [storageKey]: JSON.stringify(legacyState) };

function makeRoot(surface) {
  return {
    innerHTML: '',
    getAttribute(name) {
      if (name === 'data-documents-surface') return surface;
      if (name === 'data-office-type') return 'document';
      return '';
    },
    closest() { return this; },
    querySelector() { return null; }
  };
}

const compactRoot = makeRoot('workspace');
const fullRoot = makeRoot('office-shell');
const roots = [compactRoot, fullRoot];
class CustomEvent { constructor(type, options) { this.type = type; this.detail = options && options.detail; } }
const document = {
  readyState: 'loading',
  documentElement: { lang: 'ru' },
  body: { appendChild() {} },
  addEventListener() {},
  dispatchEvent() { return true; },
  querySelector() { return null; },
  querySelectorAll(selector) { return selector === '[data-documents-root]' ? roots : []; },
  createElement() { return { style: {}, setAttribute() {}, focus() {}, select() {}, click() {}, remove() {} }; }
};
const sandbox = {
  window: null,
  document,
  localStorage: {
    getItem(key) { return Object.prototype.hasOwnProperty.call(storage, key) ? storage[key] : null; },
    setItem(key, value) { storage[key] = String(value); }
  },
  CustomEvent,
  console,
  Date,
  Math,
  JSON,
  Object,
  Array,
  Set,
  String,
  Number,
  navigator: {},
  Blob: function Blob() {},
  URL: { createObjectURL() { return 'blob:test'; }, revokeObjectURL() {} },
  setTimeout() { return 1; },
  clearTimeout() {},
  confirm() { return true; },
  prompt(message, value) { return value; }
};
sandbox.window = sandbox;
sandbox.addEventListener = function () {};
sandbox.confirm = function () { return true; };
sandbox.prompt = function (message, value) { return value; };

vm.runInNewContext(read('src/modules/documents/office-working-object-v1.js'), sandbox, { filename: 'office-working-object-v1.js' });
vm.runInNewContext(read('src/modules/documents/documents-v0.js'), sandbox, { filename: 'documents-v0.js' });

const beforeRead = storage[storageKey];
sandbox.NSOfficeV1.renderAll();
const normalized = sandbox.NSOfficeV1.getObjectById('legacy-document-1');
assert(normalized, 'Legacy document was not loaded');
assert.strictEqual(normalized.type, 'document');
assert.strictEqual(normalized.payload.body, 'Текст до OfficeObject');
assert(compactRoot.innerHTML.includes('Старый документ'));
assert(fullRoot.innerHTML.includes('Старый документ'));
assert(fullRoot.innerHTML.includes('contenteditable="true"'));
assert.strictEqual(storage[storageKey], beforeRead, 'Reading/rendering must not rewrite legacy records');

sandbox.NSOfficeV1.updateObject('legacy-document-1', {
  payload: { body: 'Текст после сохранения' }
});
const saved = JSON.parse(storage[storageKey]).items[0];
assert.strictEqual(saved.type, 'document');
assert.strictEqual(saved.schemaVersion, 1);
assert.strictEqual(saved.payload.body, 'Текст после сохранения');
assert.strictEqual(saved.relations.projectId, 'project-1');
assert.deepStrictEqual(saved.relations.fileIds, ['file-1']);

console.log('PASS: legacy document opens in Compact + Full Office without migration-on-read and upgrades only on save.');
