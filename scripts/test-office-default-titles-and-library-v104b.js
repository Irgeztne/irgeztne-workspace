#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const sourceFiles = [
  'src/modules/documents/office-working-object-v1.js',
  'src/modules/documents/office-spreadsheet-v1.js',
  'src/modules/documents/office-presentation-v1.js',
  'src/modules/documents/office-diagram-v1.js',
  'src/modules/documents/office-formula-v1.js',
  'src/modules/documents/documents-v0.js'
];

function makeRuntime(locale) {
  const storage = {};
  const roots = [];
  const handlers = {};
  class CustomEvent { constructor(type, options) { this.type = type; this.detail = options && options.detail; } }
  const document = {
    readyState: 'complete',
    documentElement: { lang: locale },
    body: { appendChild() {} },
    addEventListener(type, handler) { (handlers[type] || (handlers[type] = [])).push(handler); },
    dispatchEvent() { return true; },
    querySelector() { return null; },
    querySelectorAll(selector) { return selector === '[data-documents-root]' ? roots : []; },
    createElement() { return { style:{}, setAttribute() {}, focus() {}, select() {}, click() {}, remove() {} }; }
  };
  const sandbox = {
    window: null, document, CustomEvent, console, Date, Math, JSON, Object, Array, Set, String, Number,
    localStorage: {
      getItem(key) { return Object.prototype.hasOwnProperty.call(storage, key) ? storage[key] : null; },
      setItem(key, value) { storage[key] = String(value); }
    },
    navigator: {}, Blob: function Blob() {}, URL: { createObjectURL() { return 'blob:test'; }, revokeObjectURL() {} },
    setTimeout() { return 1; }, clearTimeout() {}, confirm() { return true; }, prompt(message, value) { return value; }
  };
  sandbox.window = sandbox;
  sandbox.addEventListener = function () {};
  sourceFiles.forEach((file) => vm.runInNewContext(read(file), sandbox, { filename:file }));
  return { sandbox, storage, handlers, roots };
}

const expected = {
  ru: {
    document: 'Документ без названия', spreadsheet: 'Новая таблица', presentation: 'Новая презентация',
    diagram: 'Новая диаграмма', formula: 'Новая формула'
  },
  en: {
    document: 'Untitled document', spreadsheet: 'Untitled spreadsheet', presentation: 'Untitled presentation',
    diagram: 'Untitled diagram', formula: 'Untitled formula'
  }
};

for (const locale of ['ru', 'en']) {
  const runtime = makeRuntime(locale);
  const api = runtime.sandbox.NSOfficeV1;
  const created = [
    runtime.sandbox.NSDocumentsV1.createDocument(),
    api.createSpreadsheet(),
    api.createPresentation(),
    api.createDiagram(),
    api.createFormula()
  ];
  for (const item of created) {
    assert.strictEqual(item.title, expected[locale][item.type], `${locale}/${item.type} received the wrong OfficeObject title`);
  }
  const stored = JSON.parse(runtime.storage[api.STORAGE_KEY]).items;
  for (const item of created) {
    const persisted = stored.find((entry) => entry.id === item.id);
    assert(persisted, `${locale}/${item.type} was not saved`);
    assert.strictEqual(persisted.type, item.type);
    assert.strictEqual(persisted.title, expected[locale][item.type], `${locale}/${item.type} title was only cosmetic`);
  }
}

const drawer = makeRuntime('ru');
const surfaceRoot = {
  innerHTML: '',
  getAttribute(name) {
    if (name === 'data-documents-surface') return 'office-shell';
    if (name === 'data-office-type') return 'document';
    return '';
  },
  closest() { return this; },
  querySelector() { return null; }
};
drawer.roots.push(surfaceRoot);
drawer.sandbox.NSDocumentsV1.createDocument();
assert(surfaceRoot.innerHTML.includes('data-office-library-state="expanded"'));

const toggleButton = {
  getAttribute(name) {
    if (name === 'data-documents-action') return 'toggle-library';
    if (name === 'data-office-type') return 'document';
    return '';
  }
};
const event = {
  target: {
    closest(selector) {
      if (selector === '[data-documents-action]') return toggleButton;
      return null;
    }
  }
};
drawer.handlers.click.forEach((handler) => handler(event));
assert(surfaceRoot.innerHTML.includes('data-office-library-state="collapsed"'));
assert(surfaceRoot.innerHTML.includes('is-library-collapsed'));

console.log('PASS: all five Office create flows persist type-specific default titles and the object library collapses independently.');
