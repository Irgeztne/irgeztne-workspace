#!/usr/bin/env node
'use strict';

/*
 * v103 was the intentionally empty shell prototype. The accepted v104 shell
 * mounts native editors, so its replacement contract lives in the v104 test.
 */
require('./test-office-shell-ui-contract-v104.js');
process.exit(0);

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const fail = (message) => {
  console.error(`FAIL: ${message}`);
  process.exitCode = 1;
};
const pass = (message) => console.log(`PASS: ${message}`);
const assert = (condition, message) => condition ? pass(message) : fail(message);

const index = read('index.html');
const legacy = read('src/legacy-shell.js');
const i18n = read('src/i18n.js');
const script = read('src/modules/office-shell/office-shell-v1.js');
const styles = read('src/modules/office-shell/office-shell-v1.css');
const documents = read('src/modules/documents/documents-v0.js');

assert(index.includes('src/modules/office-shell/office-shell-v1.css'), 'Office shell stylesheet is loaded');
assert(index.includes('src/modules/office-shell/office-shell-v1.js'), 'Office shell script is loaded');
assert(index.includes('<div data-office-shell-root></div>'), 'Full Office uses its dedicated shell mount');
assert(!index.includes('data-documents-root data-documents-surface="cabinet"'), 'Legacy document editor is not mounted in Full Office');
assert(index.includes('data-documents-root data-documents-surface="workspace"'), 'Compact Office keeps the legacy document owner');
assert(documents.includes("const STORAGE_KEY = 'irgeztne.documents.v1'"), 'Existing document storage contract remains present');

assert(legacy.includes("state.activeCabinetSection === 'documents'"), 'Lifecycle class is derived from the active Full Office route');
assert(legacy.includes("classList.toggle('is-office-shell-open', officeShellOpen)"), 'Lifecycle removes and restores Office chrome without reload');
assert(legacy.includes('Native workspace for documents, spreadsheets, presentations, diagrams, and formulas'), 'Full Office runtime description matches the native editor shell');
assert(i18n.includes('Родное рабочее пространство для документов, таблиц, презентаций, диаграмм и формул'), 'RU Full Office description matches the native editor shell');
assert(styles.includes('body.is-office-shell-open .topbar'), 'Browser chrome is hidden only while Full Office is open');
assert(styles.includes('grid-template-columns: 232px minmax(0, 1fr)'), 'Expanded Office navigation reserves a desktop column');
assert(styles.includes('grid-template-columns: 72px minmax(0, 1fr)'), 'Collapsed Office navigation returns width to the workspace');
assert(styles.includes('html[data-theme="light"] .ns-office-shell-v103'), 'Light theme tokens are defined');
assert(styles.includes('--office-bg: #dce7f3'), 'Light background is a cold blue-gray rather than white');
assert(styles.includes(':focus-visible'), 'Keyboard focus state is visible');
assert(styles.includes(':disabled'), 'Disabled controls have an explicit state');

for (const type of ['document', 'spreadsheet', 'presentation', 'diagram', 'formula']) {
  assert(script.includes(`id: '${type}'`), `Native Office route exists: ${type}`);
}

assert(!/localStorage|sessionStorage|indexedDB|STORAGE_KEY/.test(script), 'Office shell does not own or migrate data');
assert(!/OfficeObject|documents\.v[0-9]|project.*store/i.test(script), 'Office shell does not introduce a parallel Office store');

const rootNode = { innerHTML: '' };
const handlers = {};
const documentMock = {
  readyState: 'complete',
  documentElement: { lang: 'ru' },
  querySelectorAll(selector) {
    return selector === '[data-office-shell-root]' ? [rootNode] : [];
  },
  addEventListener(type, handler) {
    handlers[type] = handler;
  },
};
const windowMock = {};
const context = {
  document: documentMock,
  window: windowMock,
  Object,
};

vm.runInNewContext(script, context, { filename: 'office-shell-v1.js' });
assert(rootNode.innerHTML.includes('Документы'), 'RU shell renders immediately');
assert(rootNode.innerHTML.includes('Таблицы'), 'RU native editor labels are complete');

documentMock.documentElement.lang = 'en';
handlers['irg:language-changed']();
assert(rootNode.innerHTML.includes('Documents'), 'EN shell rerenders without reload');
assert(rootNode.innerHTML.includes('Spreadsheets'), 'EN native editor labels are complete');
assert(!rootNode.innerHTML.includes('Документы'), 'EN shell contains no stale RU editor label');

handlers.click({
  target: {
    closest(selector) {
      if (selector === '[data-office-shell-toggle]') return {};
      return null;
    },
  },
});
assert(rootNode.innerHTML.includes('data-office-shell-state="collapsed"'), 'Navigation collapses at runtime without reload');

handlers.click({
  target: {
    closest(selector) {
      if (selector === '[data-office-shell-toggle]') return null;
      if (selector === '[data-office-editor]') {
        return {
          dataset: { officeEditor: 'diagram' },
          closest(innerSelector) {
            return innerSelector === '[data-office-shell-root]' ? rootNode : null;
          },
        };
      }
      return null;
    },
  },
});
assert(rootNode.innerHTML.includes('<h1>Diagrams</h1>'), 'Local Office route changes only the empty working surface');

if (process.exitCode) process.exit(process.exitCode);
console.log('Office module shell v103 regression checks passed.');
