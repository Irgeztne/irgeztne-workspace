#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = process.env.IRGEZTNE_OFFICE_ROOT
  ? path.resolve(process.env.IRGEZTNE_OFFICE_ROOT)
  : path.resolve(__dirname, '..');
const documentsPath = path.join(root, 'src/modules/documents/documents-v0.js');
const modelPath = path.join(root, 'src/modules/documents/office-working-object-v1.js');
const cssPath = path.join(root, 'src/modules/documents/documents-v0.css');
const shellCssPath = path.join(root, 'styles.css');
const source = fs.readFileSync(documentsPath, 'utf8');
const css = fs.readFileSync(cssPath, 'utf8');
const shellCss = fs.readFileSync(shellCssPath, 'utf8');

const listeners = Object.create(null);
const storageKey = 'irgeztne.documents.v1';
const storage = {
  [storageKey]: JSON.stringify({
    items: [{
      id: 'doc-caret',
      type: 'document',
      title: 'Caret test',
      createdAt: '2026-08-13T00:00:00.000Z',
      updatedAt: '2026-08-13T00:00:00.000Z',
      schemaVersion: 1,
      payload: { documentType: 'article', status: 'draft', body: 'Hello', richBody: 'Hello', tags: [] },
      relations: { projectId: '', taskIds: [], fileIds: [], mapPointIds: [] }
    }],
    activeId: 'doc-caret'
  })
};

const rootNode = { isConnected: true };
const richEditor = {
  innerHTML: 'Hello world',
  innerText: 'Hello world',
  getAttribute(name) { return name === 'data-documents-id' ? 'doc-caret' : ''; },
  closest(selector) {
    if (selector === '[data-documents-rich-editor]') return this;
    if (selector === '[data-documents-root]') return rootNode;
    if (selector.includes('[data-documents-rich-editor]')) return this;
    return null;
  }
};

const saveStateNode = {
  value: '',
  setAttribute(name, value) { if (name === 'data-documents-save-state') this.value = value; },
  textContent: ''
};
const document = {
  readyState: 'loading',
  activeElement: null,
  documentElement: { lang: 'ru' },
  body: { appendChild() {} },
  addEventListener(type, handler) { (listeners[type] ||= []).push(handler); },
  dispatchEvent() {},
  querySelector() { return null; },
  querySelectorAll(selector) {
    if (selector === '[data-documents-save-state]') return [saveStateNode];
    return [];
  },
  createElement() { return { click() {}, remove() {}, style: {}, setAttribute() {}, focus() {}, select() {} }; }
};
const externalSaveCalls = [];
const timers = [];
const sandbox = {
  window: null,
  document,
  localStorage: {
    getItem(key) { return storage[key] || null; },
    setItem(key, value) { storage[key] = String(value); }
  },
  CustomEvent: function CustomEvent() {},
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
  NodeFilter: { SHOW_TEXT: 4 },
  setTimeout(fn) { timers.push(fn); return timers.length; },
  clearTimeout() {}
};
sandbox.window = sandbox;
sandbox.addEventListener = function addEventListener() {};
sandbox.confirm = function confirm() { return true; };
sandbox.prompt = function prompt(message, value) { return value; };
sandbox.IRGEZTNEOfficeShell = {
  setSaveState(value) { externalSaveCalls.push(value); },
  setObjectContext() {}
};

vm.runInNewContext(fs.readFileSync(modelPath, 'utf8'), sandbox, { filename: modelPath });
vm.runInNewContext(source, sandbox, { filename: documentsPath });
(listeners.DOMContentLoaded || []).forEach((handler) => handler());

document.activeElement = richEditor;
const inputEvent = { target: richEditor };
(listeners.input || []).forEach((handler) => handler(inputEvent));
while (timers.length) timers.shift()();

assert.strictEqual(externalSaveCalls.length, 0, 'Typing called the external Office shell and can reset the caret.');
assert.strictEqual(saveStateNode.value, '', 'Autosave mutated the save badge while the editor kept focus.');
const saved = JSON.parse(storage[storageKey]);
assert.strictEqual(saved.items[0].payload.body, 'Hello world', 'Typing did not persist the document body.');
assert.strictEqual(saved.items[0].payload.richBody, 'Hello world', 'Typing did not persist the visual body.');

document.activeElement = null;
(listeners.focusout || []).forEach((handler) => handler({ target: richEditor }));
while (timers.length) timers.shift()();
assert.deepStrictEqual(externalSaveCalls, ['saved'], 'The external shell did not receive one settled state after focus left.');

assert(source.includes('data-ir-no-translate="true" data-documents-rich-editor'), 'The global translator can still mutate the active editor.');
assert(source.includes('captureDocumentFocus') && source.includes('restoreDocumentFocus'), 'Forced rerenders do not preserve document focus/selection.');
assert(!source.includes("window.addEventListener('irg:language-changed', renderAll)"), 'Language changes still trigger duplicate Office renders.');
assert(source.includes('ns-documents-v1__document-actions'), 'Full Office action row has no dedicated layout owner.');
assert(css.includes('.ns-documents-v1--office-shell .ns-documents-v1__document-actions'), 'Full Office actions are not scoped outside the canvas.');
assert(css.includes('position: static !important;'), 'Full Office actions can still overlay the canvas.');
assert(!css.includes('transform: translateY(-1px);'), 'Office buttons still physically jump on hover.');
assert(shellCss.includes('body.is-office-shell-open button:hover') && shellCss.includes('transform: none !important;'), 'Full Office navigation hover is not geometrically stable.');

console.log('PASS: Full/Compact Office keeps the caret, saves locally, defers shell updates, separates actions and uses stable hover feedback.');
