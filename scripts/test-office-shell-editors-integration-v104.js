#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const index = read('index.html');
const shell = read('src/modules/office-shell/office-shell-v1.js');
const shellCss = read('src/modules/office-shell/office-shell-v1.css');
const documents = read('src/modules/documents/documents-v0.js');
const i18n = read('src/i18n.js');
const storage = {};
const sourceFiles = [
  'src/modules/documents/office-working-object-v1.js',
  'src/modules/documents/office-spreadsheet-v1.js',
  'src/modules/documents/office-presentation-v1.js',
  'src/modules/documents/office-diagram-v1.js',
  'src/modules/documents/office-formula-v1.js',
  'src/modules/documents/documents-v0.js'
];

function makeRoot(surface, officeType) {
  return {
    innerHTML: '',
    dataset: {},
    getAttribute(name) {
      if (name === 'data-documents-surface') return surface;
      if (name === 'data-office-type') return officeType || '';
      return '';
    },
    closest() { return this; },
    querySelector() { return null; }
  };
}

function runtime(locale) {
  const compactRoot = makeRoot('workspace');
  const officeRoot = makeRoot('office-shell', 'document');
  const roots = [compactRoot, officeRoot];
  class CustomEvent { constructor(type, options) { this.type = type; this.detail = options && options.detail; } }
  const document = {
    readyState: 'loading', documentElement: { lang: locale || 'ru' }, body: { appendChild() {} },
    addEventListener() {}, dispatchEvent() { return true; }, querySelector() { return null; },
    querySelectorAll(selector) { return selector === '[data-documents-root]' ? roots : []; },
    createElement() { return { style: {}, setAttribute() {}, focus() {}, select() {}, click() {}, remove() {} }; }
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
  sourceFiles.forEach((file) => vm.runInNewContext(read(file), sandbox, { filename: file }));
  return { sandbox, compactRoot, officeRoot };
}

for (const file of sourceFiles.slice(1, 5)) {
  assert(!read(file).includes('localStorage'), `${file} must use the shared Office owner`);
}
assert(index.indexOf('office-working-object-v1.js') < index.indexOf('documents-v0.js'));
assert(index.indexOf('documents-v0.js') < index.indexOf('office-shell-v1.js'));
assert(index.includes('<div data-office-shell-root></div>'));
assert(shellCss.includes('body.is-office-shell-open .topbar { display:none !important; }'));
assert(shellCss.includes('data-section="codehub"') && shellCss.includes('data-section="marketplace"'));
assert(shellCss.includes('display:none !important'));
assert(shellCss.includes('ns-office-shell-v103__sidebar-save-state'));
assert(shellCss.includes('grid-template-rows:minmax(0,1fr)'));
assert(!shellCss.includes('ns-office-shell-v103__main-header'));
assert(!shell.includes('Прототип оболочки'));
assert(!shell.includes("local: 'Локально'"));
assert(shell.includes('data-office-shell-save-state'));
assert(shell.includes('data-office-shell-save-indicator'));
assert(!shell.includes('data-office-shell-object-title'));
assert(shell.includes('data-documents-surface="office-shell"'));
assert(i18n.includes("'site-pages': 'Веб-студия'"));

const first = runtime('ru');
const doc = first.sandbox.NSOfficeV1.createObject('document', {
  title: 'Рабочий документ', payload: { documentType: 'article', status: 'draft', body: 'Сохранённый текст' }
});
const sheet = first.sandbox.NSOfficeV1.createSpreadsheet({ title: 'Бюджет' });
let sheetPayload = first.sandbox.NSOfficeSpreadsheetV1.normalizePayload(sheet.payload);
first.sandbox.NSOfficeSpreadsheetV1.setCell(sheetPayload, sheetPayload.activeSheetId, 'A1', '12');
first.sandbox.NSOfficeSpreadsheetV1.setCell(sheetPayload, sheetPayload.activeSheetId, 'A2', '8');
first.sandbox.NSOfficeSpreadsheetV1.setCell(sheetPayload, sheetPayload.activeSheetId, 'A3', '=SUM(A1:A2)');
first.sandbox.NSOfficeV1.updateObject(sheet.id, { payload: sheetPayload });

const presentation = first.sandbox.NSOfficeV1.createPresentation({ title: 'Презентация запуска' });
const deckPayload = first.sandbox.NSOfficePresentationV1.normalizePayload(presentation.payload);
first.sandbox.NSOfficePresentationV1.addSlide(deckPayload, 'content', 'ru');
first.sandbox.NSOfficeV1.updateObject(presentation.id, { payload: deckPayload });

const diagram = first.sandbox.NSOfficeV1.createDiagram({ title: 'Схема процесса' });
const diagramPayload = first.sandbox.NSOfficeDiagramV1.normalizePayload(diagram.payload);
first.sandbox.NSOfficeDiagramV1.addElement(diagramPayload, 'rectangle', { text: 'Шаг' });
first.sandbox.NSOfficeV1.updateObject(diagram.id, { payload: diagramPayload });

const formula = first.sandbox.NSOfficeV1.createFormula({ title: 'Формула энергии', payload: { source: 'E = mc^2' } });
assert.strictEqual(first.sandbox.NSOfficeV1.getAllObjects().length, 5);
assert(first.compactRoot.innerHTML.includes('Рабочий документ'));
assert(!first.compactRoot.innerHTML.includes('Бюджет'), 'Compact Office must stay document-only');
assert(first.compactRoot.innerHTML.includes('contenteditable="true"'));
assert(first.compactRoot.innerHTML.includes('Открыть в Office'));

const reopened = runtime('ru');
assert.strictEqual(reopened.sandbox.NSOfficeV1.getAllObjects().length, 5);
const cases = [
  ['document', doc.id, 'Рабочий документ', 'contenteditable="true"'],
  ['spreadsheet', sheet.id, 'Бюджет', 'data-office-spreadsheet'],
  ['presentation', presentation.id, 'Презентация запуска', 'data-office-presentation'],
  ['diagram', diagram.id, 'Схема процесса', 'data-office-diagram'],
  ['formula', formula.id, 'Формула энергии', 'data-office-formula']
];
for (const [type, id, title, marker] of cases) {
  reopened.officeRoot.getAttribute = (name) => name === 'data-documents-surface' ? 'office-shell' : (name === 'data-office-type' ? type : '');
  assert(reopened.sandbox.NSOfficeV1.openObjectById(id));
  reopened.sandbox.NSOfficeV1.renderAll();
  assert(reopened.officeRoot.innerHTML.includes(title), `${type} title did not reopen`);
  assert(reopened.officeRoot.innerHTML.includes(marker), `${type} editor did not mount in the accepted shell`);
}
assert.strictEqual(
  reopened.sandbox.NSOfficeSpreadsheetV1.getCellComputed(reopened.sandbox.NSOfficeV1.getObjectById(sheet.id).payload, sheetPayload.activeSheetId, 'A3'),
  20
);

console.log('PASS: accepted Office shell + five native editors share one owner and survive save → close → reopen.');
