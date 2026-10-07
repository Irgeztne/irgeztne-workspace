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
      payload: { documentType: 'article', status: 'draft', body: 'Hello world', richBody: 'Hello world', tags: [] },
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
const externalContextCalls = [];
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
  setObjectContext(type, title) { externalContextCalls.push([type, title]); }
};

vm.runInNewContext(fs.readFileSync(modelPath, 'utf8'), sandbox, { filename: modelPath });
vm.runInNewContext(source, sandbox, { filename: documentsPath });
(listeners.DOMContentLoaded || []).forEach((handler) => handler());

// User scenario: place the caret in the middle, type, let autosave settle,
// then continue typing.  The same contenteditable remains focused throughout.
document.activeElement = richEditor;
richEditor.innerHTML = 'Hello brave world';
richEditor.innerText = 'Hello brave world';
(listeners.input || []).forEach((handler) => handler({ target: richEditor }));
while (timers.length) timers.shift()();
assert.strictEqual(document.activeElement, richEditor, 'Autosave replaced or blurred the active editor.');
assert.strictEqual(externalSaveCalls.length, 0, 'Autosave called the outer Office shell while the editor owned focus.');

richEditor.innerHTML = 'Hello brave new world';
richEditor.innerText = 'Hello brave new world';
(listeners.input || []).forEach((handler) => handler({ target: richEditor }));
while (timers.length) timers.shift()();
assert.strictEqual(document.activeElement, richEditor, 'Continued typing lost the active editor after autosave.');
assert.strictEqual(externalSaveCalls.length, 0, 'Continued typing rebuilt the outer Office shell.');
assert.strictEqual(saveStateNode.value, '', 'Autosave mutated the save badge while the editor kept focus.');

const saved = JSON.parse(storage[storageKey]);
assert.strictEqual(saved.items[0].payload.body, 'Hello brave new world', 'Continued typing was not persisted.');
assert.strictEqual(saved.items[0].payload.richBody, 'Hello brave new world', 'Visual document body was not persisted.');

document.activeElement = null;
(listeners.focusout || []).forEach((handler) => handler({ target: richEditor }));
while (timers.length) timers.shift()();
assert.deepStrictEqual(externalSaveCalls, ['saved'], 'Settled save state was not forwarded once focus left Office.');

assert(source.includes('data-ir-no-translate="true" data-documents-rich-editor'), 'Locale translation can mutate the editor body.');
assert(source.includes("document.addEventListener('mousedown'") && source.includes("data-documents-rich-command"), 'Toolbar mousedown can steal the visual selection.');
assert(source.includes('data-documents-native-workspace'), 'Full Office has no single document layout owner.');
assert(source.includes('captureDocumentFocus') && source.includes('restoreDocumentFocus'), 'Locale/open renders do not preserve focus and selection.');
assert.strictEqual((source.match(/document\.addEventListener\('irg:language-changed', renderAll\)/g) || []).length, 1, 'Office has duplicate locale rerenders.');

assert(css.includes('.ns-documents-v1--office-shell .ns-documents-v1__document-workspace'), 'Full Office document layout is not isolated from the outer shell grid.');
assert(css.includes('content: none !important;'), 'Full Office workspace can still receive a dimming pseudo-overlay.');
assert(css.includes('.ns-documents-v1--office-shell.is-library-collapsed') && css.includes('grid-template-columns: 48px minmax(0, 1fr) !important;'), 'Collapsed library does not return width to the editor.');
assert(css.includes('.ns-documents-v1--office-shell .ns-documents-v1__document-actions .ns-documents-v1__btn--danger') && css.includes('margin-left: 0 !important;'), 'Delete can still detach from the other document actions.');
assert(css.includes('width: 112px !important;') && css.includes('width: 100px;'), 'Full/Compact save labels do not reserve stable width.');
assert(shellCss.includes('transition-property: color, background-color, border-color, box-shadow, opacity !important;'), 'Full Office hover still transitions geometry.');
assert(shellCss.includes('body.is-office-shell-open button:active') && shellCss.includes('translate: none !important;'), 'Full Office active/hover controls can still move.');

console.log('PASS: Office stabilization keeps one editor through autosave, isolates Full Office layout, groups actions, returns collapsed width and uses paint-only hover states.');
