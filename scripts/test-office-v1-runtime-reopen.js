#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const moduleFiles = [
  'src/modules/documents/office-working-object-v1.js',
  'src/modules/documents/office-spreadsheet-v1.js',
  'src/modules/documents/office-presentation-v1.js',
  'src/modules/documents/office-diagram-v1.js',
  'src/modules/documents/office-formula-v1.js',
  'src/modules/documents/office-form-v1.js',
  'src/modules/documents/office-templates-v1.js',
  'src/modules/documents/documents-v0.js'
];
const sources = moduleFiles.map((file) => fs.readFileSync(path.join(root, file), 'utf8'));
const storage = {};
const types = ['document', 'spreadsheet', 'presentation', 'diagram', 'formula', 'form'];

function createRuntime(locale) {
  const roots = types.map((type) => ({
    type,
    innerHTML: '',
    dataset: {},
    getAttribute(name) {
      if (name === 'data-documents-surface') return 'office-shell';
      if (name === 'data-office-type') return type;
      return '';
    },
    querySelector() { return null; }
  }));
  class CustomEvent {
    constructor(type, options) { this.type = type; this.detail = options && options.detail; }
  }
  const document = {
    readyState: 'loading',
    documentElement: { lang: locale || 'ru' },
    activeElement: null,
    body: { appendChild() {} },
    addEventListener() {},
    dispatchEvent() { return true; },
    querySelector() { return null; },
    querySelectorAll(selector) { return selector === '[data-documents-root]' ? roots : []; },
    createElement() { return { style: {}, setAttribute() {}, click() {}, remove() {} }; }
  };
  const localStorage = {
    getItem(key) { return Object.prototype.hasOwnProperty.call(storage, key) ? storage[key] : null; },
    setItem(key, value) { storage[key] = String(value); }
  };
  const sandbox = {
    window: null,
    document,
    localStorage,
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
  sources.forEach((source, index) => vm.runInNewContext(source, sandbox, { filename: moduleFiles[index] }));
  return { sandbox, roots };
}

const templateIds = [
  'document-report',
  'sheet-budget',
  'presentation-project',
  'diagram-process',
  'formula-physics',
  'form-application'
];

const first = createRuntime('ru');
const created = templateIds.map((templateId) => first.sandbox.NSOfficeV1.createFromTemplate(templateId));
assert.deepStrictEqual(Array.from(created, (item) => item.type), types);

const formObject = created.find((item) => item.type === 'form');
const formPayload = first.sandbox.NSOfficeFormV1.normalizePayload(formObject.payload);
first.sandbox.NSOfficeFormV1.addResponse(formPayload, {
  [formPayload.fields[0].id]: 'Ada',
  [formPayload.fields[1].id]: 'ada@example.test'
});
first.sandbox.NSOfficeV1.updateObject(formObject.id, { payload: formPayload });

const persisted = JSON.parse(storage['irgeztne.documents.v1']);
assert.strictEqual(persisted.items.length, 6, 'All six objects must use the common Office storage.');
assert.deepStrictEqual(Array.from(new Set(persisted.items.map((item) => item.type))).sort(), types.slice().sort());
assert.strictEqual(Object.keys(storage).length, 1, 'Forms or templates introduced a parallel storage owner.');

// Reconstruct a fresh JS runtime exclusively from localStorage, matching an app restart.
const reopened = createRuntime('en');
const reopenedObjects = reopened.sandbox.NSOfficeV1.getAllObjects();
assert.strictEqual(reopenedObjects.length, 6);
created.forEach((item) => {
  const restored = reopened.sandbox.NSOfficeV1.getObjectById(item.id);
  assert(restored, item.type + ' did not reopen.');
  assert.strictEqual(restored.type, item.type);
  assert(restored.payload && typeof restored.payload === 'object');
});

const restoredForm = reopened.sandbox.NSOfficeV1.getObjectById(formObject.id);
assert.strictEqual(restoredForm.payload.responses.length, 1, 'Form responses did not survive restart.');
assert.strictEqual(restoredForm.payload.responses[0].answers[formPayload.fields[0].id], 'Ada');

reopened.sandbox.NSOfficeV1.renderAll();
const markers = {
  document: 'data-documents-native-workspace',
  spreadsheet: 'data-office-spreadsheet',
  presentation: 'data-office-presentation',
  diagram: 'data-office-diagram',
  formula: 'data-office-formula',
  form: 'data-office-form'
};
reopened.roots.forEach((surface) => {
  assert(surface.innerHTML.includes(markers[surface.type]), surface.type + ' editor did not render after restart.');
});

console.log('PASS: six Office templates save → close → reopen and Forms responses persist in the single Office store.');
