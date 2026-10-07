#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const studioPath = path.join(root, 'src/modules/editor-site-studio-safe/editor-site-studio-safe-v5.js');
const codehubPath = path.join(root, 'src/v88-codehub-v1.js');
const codehubCssPath = path.join(root, 'src/v88-codehub-v1.css');
const storePath = path.join(root, 'src/ns-codehub-store.js');
const browserTabsPath = path.join(root, 'src/browser/tabs.js');
const indexPath = path.join(root, 'index.html');

const studio = fs.readFileSync(studioPath, 'utf8');
const codehub = fs.readFileSync(codehubPath, 'utf8');
const codehubCss = fs.readFileSync(codehubCssPath, 'utf8');
const store = fs.readFileSync(storePath, 'utf8');
const browserTabs = fs.readFileSync(browserTabsPath, 'utf8');
const index = fs.readFileSync(indexPath, 'utf8');

function has(haystack, needle, message) {
  if (!haystack.includes(needle)) throw new Error(message);
}

has(studio, 'IRGEZTNE_WEBSTUDIO_WORKSHOP_INTEGRATION_V099A', 'Missing Web Studio Workshop integration owner');
has(studio, "return ['sites', 'site-settings', 'templates', 'workshop', 'page', 'pages', 'menu', 'identity', 'preview', 'server'];", 'Workshop is not directly between Templates and Editor');
has(studio, "workshop: ru ? 'Мастерская' : 'Workshop'", 'Workshop top-tab RU/EN label is missing');
has(studio, "if (activeTab === 'workshop') return renderWorkshopTabV099A();", 'Workshop is not owned by the Web Studio workspace renderer');
has(studio, 'data-codehub-root data-codehub-surface="cabinet" data-codehub-host="webstudio"', 'Web Studio does not mount the existing full CodeHub surface');
has(studio, 'data-codehub-lang="\' + escapeHtml(currentLang())', 'Web Studio language is not passed to CodeHub');
has(studio, 'data-codehub-theme="\' + escapeHtml(currentTheme())', 'Web Studio theme is not passed to CodeHub');
has(studio, "window.NSCodeHubV1.render();", 'Dynamic CodeHub root is not rendered after the Web Studio shell rebuild');

has(codehub, "root.getAttribute('data-codehub-lang')", 'CodeHub does not read a host-provided language');
has(codehub, 'withLanguageRoot(root', 'CodeHub roots do not render in their own language context');
has(codehubCss, 'IRGEZTNE_WEBSTUDIO_WORKSHOP_INTEGRATION_V099A', 'Missing scoped Workshop theme adapter');
has(codehubCss, '[data-codehub-host="webstudio"][data-codehub-theme="light"]', 'Missing Web Studio light-theme adapter');
has(codehubCss, '[data-codehub-host="webstudio"]', 'Missing Web Studio-scoped CodeHub styles');

has(store, "const STORAGE_KEY = 'nsbrowser:v1:codehub-items';", 'Existing CodeHub storage key changed or disappeared');
has(store, 'window.NSCodeHubStore = api;', 'Existing CodeHub store API changed or disappeared');
has(browserTabs, 'data-open-section="codehub"', 'Technical codehub route disappeared from the existing browser owner');
if (index.indexOf('src/ns-codehub-store.js') > index.indexOf('src/v88-codehub-v1.js')) {
  throw new Error('CodeHub runtime loads before its preserved store');
}
if (codehub.includes('data-codehub-action="toggle-theme"')) {
  throw new Error('Workshop introduced a separate theme switch');
}

function makeRoot(language) {
  const attributes = {
    'data-codehub-lang': language,
    'data-codehub-surface': 'cabinet',
    'data-codehub-host': 'webstudio',
    'data-codehub-theme': 'light'
  };
  return {
    dataset: {},
    innerHTML: '',
    getAttribute(name) { return attributes[name] || ''; },
    addEventListener() {}
  };
}

const ruRoot = makeRoot('ru');
const enRoot = makeRoot('en');
const roots = [ruRoot, enRoot];
const codehubStore = {
  subscribe() { return function unsubscribe() {}; },
  getCounts() { return { all: 0, draft: 0, ready: 0, submitted: 0 }; },
  getActiveItem() { return null; },
  getAll() { return []; }
};
const documentStub = {
  readyState: 'complete',
  documentElement: { lang: 'en' },
  querySelectorAll(selector) { return selector === '[data-codehub-root]' ? roots : []; },
  addEventListener() {},
  dispatchEvent() {}
};
const windowStub = {
  NSCodeHubStore: codehubStore,
  addEventListener() {},
  confirm() { return true; }
};
const context = {
  window: windowStub,
  document: documentStub,
  console,
  CustomEvent: function CustomEvent(type, options) { this.type = type; this.detail = options && options.detail; },
  FileReader: function FileReader() {}
};

vm.runInNewContext(codehub, context, { filename: 'v88-codehub-v1.js' });
if (!windowStub.NSCodeHubV1 || typeof windowStub.NSCodeHubV1.render !== 'function') {
  throw new Error('Existing NSCodeHubV1 public render API is unavailable');
}
windowStub.NSCodeHubV1.render();

has(ruRoot.innerHTML, 'Мастерская', 'RU Web Studio root did not render Russian Workshop UI');
has(ruRoot.innerHTML, 'Пространство автора', 'RU host context was contaminated by the global document language');
has(enRoot.innerHTML, 'Workshop', 'EN Web Studio root did not render English Workshop UI');
has(enRoot.innerHTML, 'Creator Workspace', 'EN host context was contaminated by another CodeHub root');
if (ruRoot.innerHTML.includes('Open Workshop') || enRoot.innerHTML.includes('Open Workshop')) {
  throw new Error('Embedded full Workshop still renders the external full-view button');
}

console.log('PASS: Web Studio V099A existing Workshop integration verified');
