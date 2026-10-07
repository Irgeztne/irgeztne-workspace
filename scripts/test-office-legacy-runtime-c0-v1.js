#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const modelPath = path.join(root, 'src/modules/documents/office-working-object-v1.js');
const documentsPath = path.join(root, 'src/modules/documents/documents-v0.js');
const modelSource = fs.readFileSync(modelPath, 'utf8');
const documentsSource = fs.readFileSync(documentsPath, 'utf8');
const storageKey = 'irgeztne.documents.v1';

const initialState = {
  items: [
    {
      id: 'legacy-report', title: 'Старый отчёт', type: 'report', status: 'ready', body: 'Старый текст',
      projectId: 'project-1', fileIds: ['file-1'], createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-02T00:00:00.000Z'
    },
    {
      id: 'legacy-no-type', title: 'Документ без типа', body: 'Ещё один текст',
      createdAt: '2025-02-01T00:00:00.000Z', updatedAt: '2025-02-02T00:00:00.000Z'
    }
  ],
  activeId: 'legacy-report'
};

const storage = { [storageKey]: JSON.stringify(initialState) };

function createRuntime() {
  const roots = [
    { innerHTML: '', getAttribute(name) { return name === 'data-documents-surface' ? 'workspace' : ''; } },
    { innerHTML: '', getAttribute(name) { return name === 'data-documents-surface' ? 'cabinet' : ''; } }
  ];
  const events = [];
  class CustomEvent {
    constructor(type, options) { this.type = type; this.detail = options && options.detail; }
  }
  const document = {
    readyState: 'loading',
    documentElement: { lang: 'ru' },
    body: { appendChild() {} },
    addEventListener() {},
    dispatchEvent(event) { events.push(event); return true; },
    querySelector() { return null; },
    querySelectorAll(selector) { return selector === '[data-documents-root]' ? roots : []; },
    createElement() { return { style: {}, setAttribute() {}, focus() {}, select() {}, click() {}, remove() {} }; }
  };
  const localStorage = {
    getItem(key) { return Object.prototype.hasOwnProperty.call(storage, key) ? storage[key] : null; },
    setItem(key, value) { storage[key] = String(value); }
  };
  const sandbox = {
    window: null, document, localStorage, CustomEvent, console, Date, Math, JSON, Object, Array, Set, String,
    navigator: {}, Blob: function Blob() {}, URL: { createObjectURL() { return 'blob:test'; }, revokeObjectURL() {} },
    setTimeout(fn) { if (typeof fn === 'function') fn(); return 1; }, clearTimeout() {}, confirm() { return true; }
  };
  sandbox.window = sandbox;
  sandbox.addEventListener = function () {};
  sandbox.dispatchEvent = function (event) { events.push(event); return true; };
  sandbox.confirm = function () { return true; };
  vm.runInNewContext(modelSource, sandbox, { filename: modelPath });
  vm.runInNewContext(documentsSource, sandbox, { filename: documentsPath });
  return { sandbox, roots, events };
}

const first = createRuntime();
const docs = first.sandbox.NSDocumentsV1.getAll();
assert.strictEqual(docs.length, 2);
assert.strictEqual(docs[0].type, 'document');
assert.strictEqual(docs[0].documentType, 'report');
assert.strictEqual(docs[0].body, 'Старый текст');
assert.strictEqual(docs[1].type, 'document');
assert.strictEqual(docs[1].documentType, 'article');

first.sandbox.NSDocumentsV1.renderAll();
assert(first.roots[0].innerHTML.includes('Старый отчёт'), 'Compact Office did not render the historical document.');
assert(first.roots[0].innerHTML.includes('Старый текст'), 'Compact Office body did not survive normalization.');
assert(first.roots[1].innerHTML.includes('Старый отчёт'), 'Big Office did not render the same historical document.');
assert(first.roots[1].innerHTML.includes('Старый текст'), 'Big Office body did not survive normalization.');

assert(first.sandbox.NSDocumentsV1.openDocumentById('legacy-no-type'));
let stored = JSON.parse(storage[storageKey]);
assert(!Object.prototype.hasOwnProperty.call(stored.items[1], 'schemaVersion'), 'Opening an object must not migrate it.');
assert(!Object.prototype.hasOwnProperty.call(stored.items[1], 'type'), 'Untouched no-type document must keep its historical shape.');

first.sandbox.NSOfficeV1.updateObject('legacy-report', { title: 'Обновлённый отчёт', payload: { body: 'Новый текст' } });
stored = JSON.parse(storage[storageKey]);
const upgraded = stored.items.find((item) => item.id === 'legacy-report');
const untouched = stored.items.find((item) => item.id === 'legacy-no-type');
assert.strictEqual(upgraded.type, 'document');
assert.strictEqual(upgraded.schemaVersion, 1);
assert.strictEqual(upgraded.payload.body, 'Новый текст');
assert.strictEqual(upgraded.relations.projectId, 'project-1');
assert(!Object.prototype.hasOwnProperty.call(untouched, 'schemaVersion'), 'Saving one object must not migrate another object.');

const reopened = createRuntime();
const reopenedReport = reopened.sandbox.NSDocumentsV1.getById('legacy-report');
assert(reopenedReport, 'Upgraded document failed to reopen.');
assert.strictEqual(reopenedReport.title, 'Обновлённый отчёт');
assert.strictEqual(reopenedReport.body, 'Новый текст');
reopened.sandbox.NSDocumentsV1.openDocumentById('legacy-report');
reopened.sandbox.NSDocumentsV1.renderAll();
assert(reopened.roots[0].innerHTML.includes('Новый текст'), 'Compact Office did not reopen the saved common object.');
assert(reopened.roots[1].innerHTML.includes('Новый текст'), 'Big Office did not reopen the saved common object.');

console.log('PASS: Legacy Office documents open, lazily upgrade per object, and stay synchronized in Compact/Big Office.');
