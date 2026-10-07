#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const codehubPath = path.join(root, 'src/v88-codehub-v1.js');
const cssPath = path.join(root, 'src/v88-codehub-v1.css');
let code = fs.readFileSync(codehubPath, 'utf8');
const css = fs.readFileSync(cssPath, 'utf8');

function has(haystack, needle, message) {
  if (!haystack.includes(needle)) throw new Error(message);
}
function lacks(haystack, needle, message) {
  if (haystack.includes(needle)) throw new Error(message);
}
function countOf(haystack, needle) {
  return String(haystack).split(needle).length - 1;
}

has(code, 'IRGEZTNE_WORKSHOP_RELEASE_FILTERS_R1W10A', 'Missing R1W10A owner marker');
has(code, "['template', t('Шаблоны', 'Templates')]", 'Plural Template filter label is missing');
has(code, "['theme', t('Темы', 'Themes')]", 'Plural Theme filter label is missing');
has(code, "['component', t('Компоненты', 'Components')]", 'Plural Component filter label is missing');
has(code, "['widget', t('Виджеты', 'Widgets')]", 'Plural Widget filter label is missing');
has(code, "renderWorkshopTypeFilter('catalog'", 'Catalog type filter is missing');
has(code, "renderWorkshopTypeFilter('installed'", 'Installed type filter is missing');
has(code, "renderWorkshopTypeFilter('my-packages'", 'My Packages type filter is missing');
has(code, "scope === 'catalog'", 'Catalog filter state handler is missing');
has(code, "scope === 'installed'", 'Installed filter state handler is missing');
has(code, "scope === 'my-packages'", 'My Packages filter state handler is missing');
has(code, "const catalogItems = [];", 'Disconnected Catalog must remain empty instead of inventing packages');
has(code, "t('Публичный каталог пока не подключён.'", 'Disconnected Catalog empty state is missing');
has(css, 'IRGEZTNE_WORKSHOP_RELEASE_FILTERS_R1W10A', 'R1W10A CSS marker is missing');
has(css, '.ns-codehub-v1__type-filter-btn.is-active', 'Active filter styling is missing');
has(css, '[data-codehub-host="webstudio"][data-codehub-theme="light"] .ns-codehub-v1__type-filter-btn', 'Light-theme filter styling is missing');

code = code.replace(
  '  const api = {',
  '  window.__R1W10A_TEST = { uiState, getFilteredItems, getTypeFilterOptions, workshopTypeCounts, renderWorkshopTypeFilter, renderCatalogView, renderInstalledView, renderListView };\n\n  const api = {'
);

const localStorageData = new Map();
const installedRecords = [
  { installId: 'tpl@1.0.0', packageId: 'tpl', type: 'template', title: 'Template One', version: '1.0.0', author: { name: 'A' }, license: 'MIT', installedAt: '2026-09-09T10:00:00Z', files: [] },
  { installId: 'thm@1.0.0', packageId: 'thm', type: 'theme', title: 'Theme One', version: '1.0.0', author: { name: 'B' }, license: 'MIT', installedAt: '2026-09-09T10:01:00Z', files: [] },
  { installId: 'cmp@1.0.0', packageId: 'cmp', type: 'component', title: 'Component One', version: '1.0.0', author: { name: 'C' }, license: 'MIT', installedAt: '2026-09-09T10:02:00Z', files: [] },
  { installId: 'wdg@1.0.0', packageId: 'wdg', type: 'widget', title: 'Widget One', version: '1.0.0', author: { name: 'D' }, license: 'MIT', installedAt: '2026-09-09T10:03:00Z', files: [] }
];
localStorageData.set('irgeztne-workshop-installed-v1', JSON.stringify(installedRecords));
localStorageData.set('irgeztne-workshop-installed-v1-meta', JSON.stringify({ persistenceVersion: 1, updatedAt: '2026-09-09T10:03:00Z' }));

const creatorItems = [
  { id: 'draft-tpl', type: 'template', title: 'Draft Template', version: '0.1.0', status: 'draft', trust: 'local', updatedAt: '2026-09-09T09:00:00Z', description: { short: 'Template draft' }, author: { name: 'A' }, tags: [] },
  { id: 'draft-thm', type: 'theme', title: 'Draft Theme', version: '0.1.0', status: 'validated', trust: 'local', updatedAt: '2026-09-09T09:01:00Z', description: { short: 'Theme draft' }, author: { name: 'B' }, tags: [] },
  { id: 'draft-cmp', type: 'component', title: 'Draft Component', version: '0.1.0', status: 'ready', trust: 'local', updatedAt: '2026-09-09T09:02:00Z', description: { short: 'Component draft' }, author: { name: 'C' }, tags: [] },
  { id: 'draft-wdg', type: 'widget', title: 'Draft Widget', version: '0.1.0', status: 'draft', trust: 'local', updatedAt: '2026-09-09T09:03:00Z', description: { short: 'Widget draft' }, author: { name: 'D' }, tags: [] }
];

const windowStub = {
  NSCodeHubStore: {
    subscribe() { return function () {}; },
    getCounts() { return { all: 4, draft: 2, validated: 1, ready: 1, submitted: 0 }; },
    getActiveItem() { return null; },
    getAll() { return creatorItems.slice(); }
  },
  localStorage: {
    getItem(key) { return localStorageData.has(key) ? localStorageData.get(key) : null; },
    setItem(key, value) { localStorageData.set(key, String(value)); }
  },
  addEventListener() {},
  removeEventListener() {}
};
const documentStub = {
  readyState: 'loading',
  documentElement: { lang: 'ru' },
  querySelectorAll() { return []; },
  addEventListener() {},
  dispatchEvent() {},
  getElementById() { return null; },
  createElement() { return { id: '', textContent: '', appendChild() {} }; },
  head: { appendChild() {} }
};
const context = {
  window: windowStub,
  document: documentStub,
  console,
  CustomEvent: function CustomEvent() {},
  FileReader: function FileReader() {},
  TextEncoder,
  TextDecoder,
  Uint8Array,
  ArrayBuffer,
  DataView,
  Blob,
  URL
};
vm.runInNewContext(code, context, { filename: 'v88-codehub-v1.js' });
const api = windowStub.__R1W10A_TEST;
if (!api) throw new Error('R1W10A private test hooks were not injected');

const counts = api.workshopTypeCounts(installedRecords);
if (counts.all !== 4 || counts.template !== 1 || counts.theme !== 1 || counts.component !== 1 || counts.widget !== 1) {
  throw new Error('Type counts are incorrect');
}

const installedAll = api.renderInstalledView();
for (const title of ['Template One', 'Theme One', 'Component One', 'Widget One']) has(installedAll, title, 'Installed all view lost ' + title);
for (const label of ['Все', 'Шаблоны', 'Темы', 'Компоненты', 'Виджеты']) has(installedAll, '>' + label + '<', 'Installed filter label missing: ' + label);
if (countOf(installedAll, '<strong>1</strong>') < 4) throw new Error('Installed per-type count badges are missing');
has(installedAll, '<strong>4</strong>', 'Installed total count badge is missing');

api.uiState.installedFilterType = 'widget';
const installedWidgets = api.renderInstalledView();
has(installedWidgets, 'Widget One', 'Widget filter does not keep Widget package');
for (const title of ['Template One', 'Theme One', 'Component One']) lacks(installedWidgets, title, 'Widget filter leaked non-widget installed package: ' + title);
has(installedWidgets, 'aria-pressed="true"><span>Виджеты</span>', 'Widget filter active state is missing');

api.uiState.installedFilterType = 'all';
api.uiState.filterType = 'component';
const creatorFiltered = api.getFilteredItems();
if (creatorFiltered.length !== 1 || creatorFiltered[0].type !== 'component') throw new Error('My Packages type filter does not filter creator packages');
const creatorList = api.renderListView('cabinet', { allItems: creatorItems, filteredItems: creatorFiltered });
has(creatorList, 'Draft Component', 'Filtered My Packages list lost the selected Component package');
lacks(creatorList, 'Draft Widget', 'Filtered My Packages list leaked a Widget package');
has(creatorList, 'data-codehub-type-filter="my-packages"', 'My Packages type chips are missing');
lacks(creatorList, 'data-codehub-filter="type"', 'Old duplicate type select remains in My Packages list');
has(creatorList, 'data-codehub-filter="status"', 'Status filter was accidentally removed from My Packages');
has(creatorList, 'data-codehub-filter="query"', 'Search was accidentally removed from My Packages');

const catalog = api.renderCatalogView();
has(catalog, 'Публичный каталог пока не подключён.', 'Catalog disconnected state is missing');
lacks(catalog, 'Template One', 'Catalog leaked local installed packages');
lacks(catalog, 'Draft Template', 'Catalog leaked creator drafts');
if (countOf(catalog, '<strong>0</strong>') !== 5) throw new Error('Disconnected Catalog should show five zero-count type chips without fake data');

documentStub.documentElement.lang = 'en';
const englishFilters = api.renderWorkshopTypeFilter('catalog', { all: 0, template: 0, theme: 0, component: 0, widget: 0 }, 'all');
for (const label of ['All', 'Templates', 'Themes', 'Components', 'Widgets']) has(englishFilters, '>' + label + '<', 'English filter label missing: ' + label);

documentStub.documentElement.lang = 'ru';
console.log('PASS: R1W10A gives Catalog, Installed, and My Packages clear Template/Theme/Component/Widget filters with real counts, isolated filter state, RU/EN labels, and honest empty states without fake catalog data.');
