#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const studio = fs.readFileSync(path.join(root, 'src/modules/editor-site-studio-safe/editor-site-studio-safe-v5.js'), 'utf8');
const codehub = fs.readFileSync(path.join(root, 'src/v88-codehub-v1.js'), 'utf8');
const codehubCss = fs.readFileSync(path.join(root, 'src/v88-codehub-v1.css'), 'utf8');
const storeSource = fs.readFileSync(path.join(root, 'src/ns-codehub-store.js'), 'utf8');

function has(haystack, needle, message) {
  if (!haystack.includes(needle)) throw new Error(message);
}

function lacks(haystack, needle, message) {
  if (haystack.includes(needle)) throw new Error(message);
}

has(studio, "return ['sites', 'site-settings', 'templates', 'workshop', 'page', 'pages', 'menu', 'identity', 'preview', 'server'];", 'Workshop tab order regressed');
has(codehub, 'function localizeRuntimeText(value)', 'Runtime localization bridge is missing');
has(codehub, 'storedRuntimeTextPairs', 'Historical store validation strings are not covered');
has(codehub, 'localizeRuntimeText(context.notice)', 'Notices are not localized at render time');
has(codehub, 'localizeRuntimeText(error)', 'Runtime errors are not localized at render time');
has(codehub, 'localizeRuntimeText(warning)', 'Runtime warnings are not localized at render time');
has(codehub, 'localizeRuntimeText(check.label)', 'Dynamic meta.json check labels are not localized at render time');
has(codehub, 'localizeRuntimeText(check.detail', 'Dynamic meta.json check details are not localized at render time');
has(codehubCss, '[data-codehub-host="webstudio"][data-codehub-theme="light"]', 'Light host theme contract regressed');
has(codehubCss, '[data-codehub-host="webstudio"]', 'Dark/default host theme contract regressed');

const storeRuntimeMessages = [];
const storeMessagePattern = /(?:errors|warnings)\.push\('([^']+)'\)|errors:\s*\['([^']+)'\]/g;
let storeMessageMatch;
while ((storeMessageMatch = storeMessagePattern.exec(storeSource))) {
  storeRuntimeMessages.push(storeMessageMatch[1] || storeMessageMatch[2]);
}
if (storeRuntimeMessages.length < 12) throw new Error('Store runtime-message audit found too few validation strings');
for (const message of storeRuntimeMessages) {
  has(codehub, message, 'CodeHub localization table does not cover store runtime text: ' + message);
}

function makeRoot(language, theme) {
  const attributes = {
    'data-codehub-lang': language,
    'data-codehub-surface': 'cabinet',
    'data-codehub-host': 'webstudio',
    'data-codehub-theme': theme
  };
  const listeners = {};
  const rootNode = {
    dataset: {},
    innerHTML: '',
    getAttribute(name) { return attributes[name] || ''; },
    addEventListener(type, listener) { listeners[type] = listener; }
  };

  rootNode.openBuilderTab = function (tabId) {
    const tab = { getAttribute() { return tabId; } };
    listeners.click({
      target: {
        closest(selector) {
          if (selector === '[data-codehub-builder-tab]') return tab;
          return null;
        }
      }
    });
  };

  rootNode.runAction = function (action, itemId) {
    const button = {
      getAttribute(name) {
        if (name === 'data-codehub-action') return action;
        if (name === 'data-codehub-id') return itemId;
        if (name === 'data-codehub-type') return 'template';
        return '';
      }
    };
    listeners.click({
      target: {
        closest(selector) {
          if (selector === '[data-codehub-action]') return button;
          return null;
        }
      }
    });
  };

  rootNode.loadMeta = function (itemId, metaText) {
    const input = {
      files: [{ name: 'meta.json', content: metaText }],
      value: 'meta.json',
      getAttribute(name) { return name === 'data-codehub-id' ? itemId : ''; },
      closest(selector) {
        if (selector === '[data-codehub-meta-input]') return input;
        if (selector === '[data-codehub-root]') return rootNode;
        return null;
      }
    };
    listeners.change({ target: input });
  };

  return rootNode;
}

const ruLight = makeRoot('ru', 'light');
const ruDark = makeRoot('ru', 'dark');
const enLight = makeRoot('en', 'light');
const enDark = makeRoot('en', 'dark');
const roots = [ruLight, ruDark, enLight, enDark];
const storage = {};

function FileReaderStub() {
  this.result = '';
  this.onload = null;
  this.onerror = null;
}
FileReaderStub.prototype.readAsText = function (file) {
  this.result = String(file && file.content || '');
  if (typeof this.onload === 'function') this.onload();
};

const documentStub = {
  readyState: 'complete',
  documentElement: { lang: 'en' },
  querySelectorAll(selector) { return selector === '[data-codehub-root]' ? roots : []; },
  addEventListener() {},
  dispatchEvent() {}
};
const windowStub = {
  addEventListener() {},
  confirm() { return true; }
};
const context = {
  window: windowStub,
  document: documentStub,
  localStorage: {
    getItem(key) { return Object.prototype.hasOwnProperty.call(storage, key) ? storage[key] : null; },
    setItem(key, value) { storage[key] = String(value); }
  },
  console,
  FileReader: FileReaderStub,
  CustomEvent: function CustomEvent(type, options) { this.type = type; this.detail = options && options.detail; }
};

vm.runInNewContext(storeSource, context, { filename: 'ns-codehub-store.js' });
vm.runInNewContext(codehub, context, { filename: 'v88-codehub-v1.js' });

const item = windowStub.NSCodeHubV1.createNewItem('template');
if (!item || !item.id) throw new Error('Could not create a CodeHub validation fixture');
ruLight.openBuilderTab('validation');

const ruValidationStrings = [
  'Требуется название пакета.',
  'Нужно краткое описание.',
  'Требуется обложка для превью.',
  'Добавьте в пакет хотя бы один файл.',
  'Теги пусты. Добавьте 1–3 тега для будущей фильтрации.',
  'Полное описание не заполнено.',
  'Галерея изображений пуста.'
];
const enValidationStrings = [
  'Package title is required.',
  'Short description is required.',
  'Cover preview is required.',
  'Add at least one file to the package.',
  'Tags are empty. Add 1–3 tags for better filtering later.',
  'Full description is empty.',
  'Gallery images are empty.'
];

for (const text of ruValidationStrings) {
  has(ruLight.innerHTML, text, 'RU/light validation missed: ' + text);
  has(ruDark.innerHTML, text, 'RU/dark validation missed: ' + text);
  lacks(enLight.innerHTML, text, 'RU validation leaked into EN/light: ' + text);
  lacks(enDark.innerHTML, text, 'RU validation leaked into EN/dark: ' + text);
}
for (const text of enValidationStrings) {
  has(enLight.innerHTML, text, 'EN/light validation missed: ' + text);
  has(enDark.innerHTML, text, 'EN/dark validation missed: ' + text);
  lacks(ruLight.innerHTML, text, 'EN validation leaked into RU/light: ' + text);
  lacks(ruDark.innerHTML, text, 'EN validation leaked into RU/dark: ' + text);
}

enDark.runAction('mark-ready', item.id);
has(ruLight.innerHTML, 'Пакет пока не готов.', 'Stored notice did not switch to RU/light');
has(ruDark.innerHTML, 'Пакет пока не готов.', 'Stored notice did not switch to RU/dark');
has(enLight.innerHTML, 'Package is not ready yet.', 'Stored notice did not stay EN/light');
has(enDark.innerHTML, 'Package is not ready yet.', 'Stored notice did not stay EN/dark');

enLight.loadMeta(item.id, '{}');
const metaPairs = [
  ['package.format должен быть irgeztne-template-package.', 'package.format must be irgeztne-template-package.'],
  ['Favicon package неполный:', 'Favicon package is incomplete:'],
  ['Формат пакета', 'Package format'],
  ['Ожидается irgeztne-template-package.', 'Expected irgeztne-template-package.'],
  ['meta.json проверен: есть ошибки или предупреждения.', 'meta.json checked: there are errors or warnings.']
];
for (const pair of metaPairs) {
  has(ruLight.innerHTML, pair[0], 'RU/light meta runtime text missed: ' + pair[0]);
  has(ruDark.innerHTML, pair[0], 'RU/dark meta runtime text missed: ' + pair[0]);
  has(enLight.innerHTML, pair[1], 'EN/light meta runtime text missed: ' + pair[1]);
  has(enDark.innerHTML, pair[1], 'EN/dark meta runtime text missed: ' + pair[1]);
  lacks(ruLight.innerHTML, pair[1], 'EN meta runtime text leaked into RU/light: ' + pair[1]);
  lacks(ruDark.innerHTML, pair[1], 'EN meta runtime text leaked into RU/dark: ' + pair[1]);
}

console.log('PASS: Web Studio Workshop V099B runtime localization verified for RU/EN × Light/Dark');
