#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const source = read('src/modules/office-shell/office-shell-v1.js');
const styles = read('src/modules/office-shell/office-shell-v1.css');
const documents = read('src/modules/documents/documents-v0.js');

const shellRoot = { innerHTML: '' };
const saveNodes = [{ dataset: {}, textContent: '' }];
const saveIndicators = [{
  dataset: {},
  attributes: {},
  setAttribute(name, value) { this.attributes[name] = value; }
}];
const handlers = {};
const documentMock = {
  readyState: 'complete', documentElement: { lang: 'ru' },
  querySelectorAll(selector) {
    if (selector === '[data-office-shell-root]') return [shellRoot];
    if (selector === '[data-office-shell-save-state]') return saveNodes;
    if (selector === '[data-office-shell-save-indicator]') return saveIndicators;
    return [];
  },
  addEventListener(type, handler) { handlers[type] = handler; }
};
const windowMock = { NSOfficeV1: { renderAll() {} } };
vm.runInNewContext(source, { window: windowMock, document: documentMock, Object }, { filename: 'office-shell-v1.js' });

assert(shellRoot.innerHTML.includes('Документы'));
assert(shellRoot.innerHTML.includes('data-office-shell-state="expanded"'));
assert(!shellRoot.innerHTML.includes('Прототип оболочки'));
assert(!shellRoot.innerHTML.includes('Локально'));
assert(shellRoot.innerHTML.includes('Сохранено'));
assert(shellRoot.innerHTML.includes('ns-office-shell-v103__brand-context'));
assert(shellRoot.innerHTML.includes('data-office-shell-active-type="document"'));
assert(!shellRoot.innerHTML.includes('ns-office-shell-v103__main-header'));
assert(!shellRoot.innerHTML.includes('data-office-shell-object-title'));

windowMock.IRGEZTNEOfficeShell.setSaveState('dirty');
assert.strictEqual(saveNodes[0].dataset.officeShellSaveState, 'dirty');
assert.strictEqual(saveNodes[0].textContent, 'Изменено');
assert.strictEqual(saveIndicators[0].dataset.officeShellSaveIndicator, 'dirty');
handlers.click({ target: { closest(selector) { return selector === '[data-office-shell-toggle]' ? {} : null; } } });
assert(shellRoot.innerHTML.includes('data-office-shell-state="collapsed"'));
assert(shellRoot.innerHTML.includes('data-office-shell-save-state="dirty"'));
assert(shellRoot.innerHTML.includes('data-office-shell-save-indicator="dirty"'));
assert(!shellRoot.innerHTML.includes('ns-office-shell-v103__main-header'));

documentMock.documentElement.lang = 'en';
handlers['irg:language-changed']();
assert(shellRoot.innerHTML.includes('Documents'));
assert(!shellRoot.innerHTML.includes('Документы'));

assert(styles.includes('grid-template-columns:232px minmax(0,1fr)'));
assert(styles.includes('grid-template-columns:72px minmax(0,1fr)'));
assert(styles.includes('grid-template-columns:48px minmax(0,1fr)'));
assert(documents.includes('data-documents-action="toggle-library"'));
assert(documents.includes('data-office-library-state="'));
assert(documents.includes('collapsedOfficeLibraries'));
assert(styles.includes('grid-template-rows:minmax(0,1fr)'));
assert(styles.includes('gap:0'));
assert(styles.includes('ns-office-shell-v103__sidebar-save-state[data-office-shell-save-state="dirty"]'));
assert(styles.includes('ns-office-shell-v103__sidebar-save-state[data-office-shell-save-state="saving"]'));
assert(styles.includes('data-office-shell-save-indicator="dirty"'));
assert(!styles.includes('ns-office-shell-v103__main-header'));
assert(!source.includes('data-office-shell-object-title'));
assert(source.includes('setObjectContext'));
assert(styles.includes(':focus-visible'));
assert(styles.includes(':disabled'));
assert(styles.includes('html[data-theme="light"] .ns-office-shell-v103'));
assert(!styles.includes('repeating-linear-gradient'), 'Prototype grid scaffolding must be gone');
assert(documents.includes('data-documents-rich-command="bold"'));
assert(documents.includes('data-documents-rich-style'));
assert(documents.includes('contenteditable="true"'));
assert(!documents.includes('data-documents-format="heading"'), 'Visible Markdown toolbar leaked into normal editing mode');

const officeNavBase = styles.match(/body\.is-office-shell-open \.cabinet-inner-nav \.cabinet-inner-nav-btn \{([\s\S]*?)\}/);
const officeNavHover = styles.match(/body\.is-office-shell-open \.cabinet-inner-nav \.cabinet-inner-nav-btn:hover \{([\s\S]*?)\}/);
assert(officeNavBase && officeNavHover, 'Office global navigation style contract is missing');
['width', 'height', 'padding', 'font-size', 'letter-spacing', 'border-width', 'scale'].forEach((property) => {
  assert(!new RegExp('(?:^|[;\\s])' + property.replace('-', '\\-') + '\\s*:').test(officeNavBase[1]), `Base Office navigation must inherit compact ${property}`);
  assert(!new RegExp('(?:^|[;\\s])' + property.replace('-', '\\-') + '\\s*:').test(officeNavHover[1]), `Hover must not change ${property}`);
});
assert(/transform\s*:\s*none/.test(officeNavHover[1]), 'Hover must neutralize the legacy translate/scale geometry change');

console.log('PASS: Office shell cleanup, navigation, save-state geometry, RU/EN and visual document toolbar verified.');
