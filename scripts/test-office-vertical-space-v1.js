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

const nativeEditorCases = [
  {
    type: 'spreadsheet', file: 'src/modules/documents/office-spreadsheet-v1.js',
    css: 'src/modules/documents/office-spreadsheet-v1.css', global: 'NSOfficeSpreadsheetV1',
    headClass: 'ns-office-sheet__head', rowClass: 'ns-office-sheet__toolbar',
    titleClass: 'ns-office-sheet__object-title', titleAttribute: 'data-sheet-title'
  },
  {
    type: 'presentation', file: 'src/modules/documents/office-presentation-v1.js',
    css: 'src/modules/documents/office-presentation-v1.css', global: 'NSOfficePresentationV1',
    headClass: 'ns-office-presentation__head', rowClass: 'ns-office-presentation__toolbar',
    titleClass: 'ns-office-presentation__object-title', titleAttribute: 'data-presentation-title', files: []
  },
  {
    type: 'diagram', file: 'src/modules/documents/office-diagram-v1.js',
    css: 'src/modules/documents/office-diagram-v1.css', global: 'NSOfficeDiagramV1',
    headClass: 'ns-office-diagram__head', rowClass: 'ns-office-diagram__toolbar',
    titleClass: 'ns-office-diagram__object-title', titleAttribute: 'data-diagram-title'
  },
  {
    type: 'formula', file: 'src/modules/documents/office-formula-v1.js',
    css: 'src/modules/documents/office-formula-v1.css', global: 'NSOfficeFormulaV1',
    headClass: 'ns-office-formula__head', rowClass: 'ns-office-formula__toolbar',
    titleClass: 'ns-office-formula__object-title', titleAttribute: 'data-formula-title'
  },
  {
    type: 'form', file: 'src/modules/documents/office-form-v1.js',
    css: 'src/modules/documents/office-form-v1.css', global: 'NSOfficeFormV1',
    headClass: 'ns-office-form__head', rowClass: 'ns-office-form__tabs',
    titleClass: 'ns-office-form__object-title', titleAttribute: 'data-form-title'
  }
];

const fullRoot = { innerHTML: '', mode: 'full' };
const floatingRoot = { innerHTML: '', mode: 'floating' };
const handlers = {};
const documentMock = {
  readyState: 'complete',
  documentElement: { lang: 'ru' },
  querySelectorAll(selector) {
    if (selector === '[data-office-shell-root]') return [fullRoot, floatingRoot];
    return [];
  },
  addEventListener(type, handler) { handlers[type] = handler; }
};
const windowMock = { NSOfficeV1: { renderAll() {} } };
vm.runInNewContext(source, { window: windowMock, document: documentMock, Object }, { filename: 'office-shell-v1.js' });

const editorCases = [
  ['document', 'Документы'],
  ['spreadsheet', 'Таблицы'],
  ['presentation', 'Презентации'],
  ['diagram', 'Диаграммы'],
  ['formula', 'Формулы'],
  ['form', 'Формы']
];

function assertCompactShell(markup, type, label, mode) {
  assert(markup.includes(`data-office-shell-active-type="${type}"`), `${mode}/${type}: active type missing`);
  assert(markup.includes(`<strong>${label}</strong>`), `${mode}/${type}: section context missing from navigation`);
  assert(/<main class="ns-office-shell-v103__main">\s*<div class="ns-office-shell-v103__workspace"/.test(markup), `${mode}/${type}: workspace does not begin directly inside main`);
  assert(!markup.includes('ns-office-shell-v103__main-header'), `${mode}/${type}: legacy context header returned`);
  assert(!markup.includes('data-office-shell-object-title'), `${mode}/${type}: object title is duplicated by the shell`);
  assert(!markup.includes('Единое рабочее пространство'), `${mode}/${type}: permanent description row returned`);
}

editorCases.forEach(([type, label], index) => {
  if (index) {
    handlers.click({
      target: {
        closest(selector) {
          if (selector === '[data-office-shell-toggle]') return null;
          if (selector === '[data-office-editor]') return {
            dataset: { officeEditor: type },
            closest(inner) { return inner === '[data-office-shell-root]' ? fullRoot : null; }
          };
          return null;
        }
      }
    });
  }
  assertCompactShell(fullRoot.innerHTML, type, label, 'full-expanded');
  assertCompactShell(floatingRoot.innerHTML, type, label, 'floating-expanded');
});

handlers.click({ target: { closest(selector) { return selector === '[data-office-shell-toggle]' ? {} : null; } } });
assert(fullRoot.innerHTML.includes('data-office-shell-state="collapsed"'));
assert(floatingRoot.innerHTML.includes('data-office-shell-state="collapsed"'));
assert(fullRoot.innerHTML.includes('data-office-shell-save-indicator="saved"'));
assertCompactShell(fullRoot.innerHTML, 'form', 'Формы', 'full-collapsed');
assertCompactShell(floatingRoot.innerHTML, 'form', 'Формы', 'floating-collapsed');

const mainRule = styles.match(/\.ns-office-shell-v103__main \{([^}]*)\}/);
assert(mainRule, 'Office main layout rule is missing');
assert(mainRule[1].includes('grid-template-rows:minmax(0,1fr)'));
assert(mainRule[1].includes('gap:0'));
assert(!styles.includes('ns-office-shell-v103__main-header'));
assert(!mainRule[1].includes('grid-template-rows:auto'));
assert(styles.includes('.ns-office-shell-v103.is-collapsed .ns-office-shell-v103__save-dot { display:block; }'));
assert(!/is-irgeztne-floating-workspace[^\{]*main-header/.test(styles));

nativeEditorCases.forEach((testCase) => {
  const moduleWindow = {};
  vm.runInNewContext(read(testCase.file), { window: moduleWindow }, { filename: testCase.file });
  const editor = moduleWindow[testCase.global];
  assert(editor && typeof editor.render === 'function', `${testCase.type}: native renderer is unavailable`);
  assert(typeof editor.createPayload === 'function', `${testCase.type}: payload factory is unavailable`);

  const object = {
    id: `vertical-space-${testCase.type}`,
    type: testCase.type,
    title: `Vertical space ${testCase.type}`,
    payload: editor.createPayload()
  };
  const markup = editor.render(object, 'en', testCase.files);
  const nativeStyles = read(testCase.css);

  assert(!markup.includes(testCase.headClass), `${testCase.type}: native context header returned`);
  assert(!nativeStyles.includes(`.${testCase.headClass}`), `${testCase.type}: native context-header CSS returned`);
  assert(markup.includes(testCase.rowClass), `${testCase.type}: existing editor row is missing`);
  assert(markup.includes(testCase.titleClass), `${testCase.type}: compact object-title control is missing`);
  assert(markup.includes(testCase.titleAttribute), `${testCase.type}: title editing contract is missing`);
  const rowStart = markup.indexOf(testCase.rowClass);
  const titleStart = markup.indexOf(testCase.titleClass);
  const rowEnd = markup.indexOf('</div>', rowStart);
  assert(rowStart !== -1 && titleStart > rowStart && titleStart < rowEnd, `${testCase.type}: object title is not embedded in the existing editor row`);
});

const formulaStyles = read('src/modules/documents/office-formula-v1.css');
const formulaRootRule = formulaStyles.match(/\.ns-office-formula \{([^}]*)\}/);
assert(formulaRootRule, 'formula: root layout rule is missing');
assert(
  formulaRootRule[1].includes('grid-template-rows:auto minmax(0,1fr)'),
  'formula: toolbar row must stay intrinsic while Source/Preview receive the remaining height'
);

console.log('PASS: the shell and all five native Office editors reclaim the context-header height in Full/Floating and expanded/collapsed navigation.');
