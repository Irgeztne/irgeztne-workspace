#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const codehubPath = path.join(root, 'src/v88-codehub-v1.js');
let code = fs.readFileSync(codehubPath, 'utf8');

function has(haystack, needle, message) {
  if (!haystack.includes(needle)) throw new Error(message);
}
function lacks(haystack, needle, message) {
  if (haystack.includes(needle)) throw new Error(message);
}

has(code, 'IRGEZTNE_WORKSHOP_INSTALLED_METADATA_R1W8H', 'Missing R1W8H owner marker');
has(code, 'function normalizeWorkshopInstalledAuthor(author)', 'Installed author normalization helper is missing');
has(code, 'function workshopInstalledAuthorLabel(author)', 'Installed author label helper is missing');
has(code, 'author: normalizeWorkshopInstalledAuthor(pkg.author)', 'ZIP installer does not preserve structured author metadata');
lacks(code, "author: String(pkg.author || '')", 'ZIP installer still stringifies author objects');
has(code, "t('Установленные', 'Installed')", 'Installed navigation label is still ambiguous in Russian');
has(code, "t('Установленные пакеты', 'Installed packages')", 'Installed panel heading is still ambiguous in Russian');

code = code.replace(
  '  const api = {',
  '  window.__R1W8H_TEST = { renderInstalledView, normalizeWorkshopInstalledAuthor, workshopInstalledAuthorLabel };\n\n  const api = {'
);

const localStorageData = new Map();
const installedRecord = {
  installId: 'pkg.demo@0.1.0',
  packageId: 'pkg.demo',
  type: 'template',
  title: 'IRGEZTNE Test Template',
  version: '0.1.0',
  author: { name: 'El', id: '', source: 'local' },
  license: 'MPL-2.0',
  installedAt: '2026-09-05T13:43:34.000Z',
  files: Array.from({ length: 5 }, (_, i) => ({ path: `file-${i + 1}`, blobKey: `blob:${i + 1}` }))
};
localStorageData.set('irgeztne-workshop-installed-v1', JSON.stringify([installedRecord]));
localStorageData.set('irgeztne-workshop-installed-v1-meta', JSON.stringify({ persistenceVersion: 1, updatedAt: '2026-09-05T13:43:34.000Z' }));

const windowStub = {
  NSCodeHubStore: {
    subscribe() { return function () {}; },
    getCounts() { return { all: 0, draft: 0, validated: 0, ready: 0, submitted: 0 }; },
    getActiveItem() { return null; },
    getAll() { return []; }
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
const api = windowStub.__R1W8H_TEST;
if (!api) throw new Error('R1W8H private test hooks were not injected');

const normalized = api.normalizeWorkshopInstalledAuthor({ name: ' El ', id: 'creator-1', source: 'local' });
if (!normalized || normalized.name !== 'El' || normalized.id !== 'creator-1' || normalized.source !== 'local') {
  throw new Error('Structured author metadata was not normalized correctly');
}
if (api.workshopInstalledAuthorLabel(normalized) !== 'El') throw new Error('Structured author name is not rendered correctly');
if (api.workshopInstalledAuthorLabel('Tester') !== 'Tester') throw new Error('Legacy string author is not rendered correctly');
if (api.workshopInstalledAuthorLabel('[object Object]') !== '—') throw new Error('Broken legacy object-string should not leak into the UI');

const html = api.renderInstalledView();
has(html, 'Установленные пакеты', 'Installed panel heading is not clear');
has(html, '>El</div>', 'Installed card does not render the author name');
lacks(html, '[object Object]', 'Installed card leaks object stringification');
if (!/Файлы<\/span>5<\/div>/.test(html)) throw new Error('Installed card does not show the real five-file count');

console.log('PASS: R1W8H Installed metadata renders structured author names, keeps real file counts, and clarifies the Installed section label');
