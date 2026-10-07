#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const modelPath = path.join(root, 'src/modules/documents/office-working-object-v1.js');
const spreadsheetPath = path.join(root, 'src/modules/documents/office-spreadsheet-v1.js');
const documentsPath = path.join(root, 'src/modules/documents/documents-v0.js');
const sources = [modelPath, spreadsheetPath, documentsPath].map((file) => fs.readFileSync(file, 'utf8'));
const storage = {};

function runtime() {
  const roots = [
    { innerHTML: '', dataset: {}, getAttribute(name) { return name === 'data-documents-surface' ? 'workspace' : ''; }, querySelector() { return null; } },
    { innerHTML: '', dataset: {}, getAttribute(name) { return name === 'data-documents-surface' ? 'cabinet' : ''; }, querySelector() { return null; } }
  ];
  class CustomEvent { constructor(type, options) { this.type = type; this.detail = options && options.detail; } }
  const document = {
    readyState: 'loading', documentElement: { lang: 'en' }, body: { appendChild() {} },
    addEventListener() {}, dispatchEvent() { return true; }, querySelector() { return null; },
    querySelectorAll(selector) { return selector === '[data-documents-root]' ? roots : []; },
    createElement() { return { style: {}, setAttribute() {}, click() {}, remove() {} }; }
  };
  const localStorage = {
    getItem(key) { return Object.prototype.hasOwnProperty.call(storage, key) ? storage[key] : null; },
    setItem(key, value) { storage[key] = String(value); }
  };
  const sandbox = {
    window: null, document, localStorage, CustomEvent, console, Date, Math, JSON, Object, Array, Set, String, Number,
    navigator: {}, Blob: function Blob() {}, URL: { createObjectURL() { return 'blob:test'; }, revokeObjectURL() {} },
    setTimeout() { return 1; }, clearTimeout() {}, confirm() { return true; }, prompt(message, value) { return value; }
  };
  sandbox.window = sandbox;
  sandbox.addEventListener = function () {};
  sandbox.confirm = function () { return true; };
  sandbox.prompt = function (message, value) { return value; };
  vm.runInNewContext(sources[0], sandbox, { filename: modelPath });
  vm.runInNewContext(sources[1], sandbox, { filename: spreadsheetPath });
  vm.runInNewContext(sources[2], sandbox, { filename: documentsPath });
  return { sandbox, roots };
}

const first = runtime();
const created = first.sandbox.NSOfficeV1.createSpreadsheet({ title: 'Reopen budget', payload: { rows: 6, columns: 4, sheetName: 'Plan' } });
assert.strictEqual(created.type, 'spreadsheet');
const payload = first.sandbox.NSOfficeSpreadsheetV1.normalizePayload(created.payload);
first.sandbox.NSOfficeSpreadsheetV1.setCell(payload, payload.activeSheetId, 'A1', '12');
first.sandbox.NSOfficeSpreadsheetV1.setCell(payload, payload.activeSheetId, 'A2', '8');
first.sandbox.NSOfficeSpreadsheetV1.setCell(payload, payload.activeSheetId, 'A3', '=SUM(A1:A2)');
first.sandbox.NSOfficeV1.updateObject(created.id, { payload, relations: { projectId: 'project-runtime', taskIds: ['task-runtime'] } });

const persistedBeforeClose = JSON.parse(storage['irgeztne.documents.v1']);
const persistedSheet = persistedBeforeClose.items.find((item) => item.id === created.id);
assert.strictEqual(persistedSheet.type, 'spreadsheet');
assert.strictEqual(persistedSheet.payload.sheets[0].cells.A3.raw, '=SUM(A1:A2)');
assert.strictEqual(persistedSheet.relations.projectId, 'project-runtime');

// Closing means discarding the first JavaScript runtime. A new runtime reads only localStorage.
const reopened = runtime();
const reopenedObject = reopened.sandbox.NSOfficeV1.getObjectById(created.id);
assert(reopenedObject, 'Spreadsheet was not restored after closing Office.');
assert.strictEqual(reopenedObject.title, 'Reopen budget');
assert.strictEqual(reopenedObject.type, 'spreadsheet');
assert.strictEqual(reopened.sandbox.NSOfficeSpreadsheetV1.getCellComputed(reopenedObject.payload, reopenedObject.payload.activeSheetId, 'A3'), 20);
assert.strictEqual(reopenedObject.relations.taskIds[0], 'task-runtime');
assert(reopened.sandbox.NSOfficeV1.openObjectById(created.id));
reopened.sandbox.NSOfficeV1.renderAll();
assert(reopened.roots[1].innerHTML.includes('Reopen budget'), 'Reopened spreadsheet did not render in Big Office.');
assert(reopened.roots[1].innerHTML.includes('Spreadsheet'), 'Spreadsheet editor did not render after reopen.');

console.log('PASS: Spreadsheet completed save → close → reopen through the shared Office storage owner.');
