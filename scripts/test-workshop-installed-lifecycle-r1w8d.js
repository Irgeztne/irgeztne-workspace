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

has(code, 'IRGEZTNE_WORKSHOP_INSTALLED_LIFECYCLE_R1W8D', 'Missing R1W8D owner marker');
has(code, 'async function deleteWorkshopBytesBatch(blobKeys)', 'Installed byte batch cleanup is missing');
has(code, "data-codehub-action=\"uninstall-installed\"", 'Installed package remove action is missing');
has(code, "await uninstallWorkshopInstalledPackage(installId);", 'Installed package remove action is not wired');
has(code, 'Авторский пакет в «Мои пакеты» затронут не будет.', 'Uninstall confirmation does not protect the creator copy contract');
has(code, "writeWorkshopInstalledRegistry(nextRegistry);", 'Uninstall does not remove the Installed registry record');
has(code, "await deleteWorkshopBytesBatch(blobKeys);", 'Uninstall does not remove installed IndexedDB bytes');
has(code, "writeWorkshopInstalledRegistry(registry);", 'Uninstall does not restore the registry if byte deletion fails');
has(code, "ns-codehub-v1__install-drop-title", 'Drop zone does not have an explicit primary title');
has(code, "t('Перетащите ZIP-файл сюда', 'Drop a ZIP file here')", 'Drop zone title is not explicit');
has(code, '.ns-codehub-v1__install-dropzone.is-dragover{background:rgba(32,142,91,.15)', 'Drag-over state is not visibly highlighted');
has(code, 'Открывает шаблон в полноэкранном предпросмотре', 'Preview guidance was not updated to full-screen wording');
lacks(code, 'Предпросмотр откроется почти на всей рабочей области.', 'Stale almost-full-work-area preview wording remains');

// Expose only the private functions needed for a focused functional uninstall check.
code = code.replace(
  '  const api = {',
  '  window.__R1W8D_TEST = { renderInstalledView, uninstallWorkshopInstalledPackage, deleteWorkshopBytesBatch };\n\n  const api = {'
);

const localStorageData = new Map();
const byteStore = new Map([
  ['blob:a', { blobKey: 'blob:a' }],
  ['blob:b', { blobKey: 'blob:b' }]
]);

function makeTransaction() {
  const tx = {
    error: null,
    objectStore() {
      return {
        delete(key) { byteStore.delete(String(key)); }
      };
    },
    oncomplete: null,
    onerror: null,
    onabort: null
  };
  setImmediate(() => { if (typeof tx.oncomplete === 'function') tx.oncomplete(); });
  return tx;
}

const fakeDb = {
  objectStoreNames: { contains(name) { return name === 'files'; } },
  transaction() { return makeTransaction(); },
  close() {}
};
const indexedDB = {
  open() {
    const req = { result: fakeDb, error: null, onupgradeneeded: null, onsuccess: null, onerror: null };
    setImmediate(() => { if (typeof req.onsuccess === 'function') req.onsuccess(); });
    return req;
  }
};

const packageRecord = {
  installId: 'sample.pkg@1.2.3',
  packageId: 'sample.pkg',
  type: 'template',
  title: 'Sample Package',
  version: '1.2.3',
  author: 'Tester',
  license: 'MPL-2.0',
  installedAt: '2026-09-05T00:00:00.000Z',
  files: [{ blobKey: 'blob:a' }, { blobKey: 'blob:b' }]
};
localStorageData.set('irgeztne-workshop-installed-v1', JSON.stringify([packageRecord]));

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
  indexedDB,
  confirm() { return true; },
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
  setImmediate,
  clearImmediate,
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

(async () => {
  const api = windowStub.__R1W8D_TEST;
  if (!api) throw new Error('R1W8D private test hooks were not injected');

  const html = api.renderInstalledView();
  has(html, 'Удалить установленный', 'Installed card does not render a remove control');
  has(html, 'Перетащите ZIP-файл сюда', 'Installed view does not render the primary drop-zone title');

  await api.uninstallWorkshopInstalledPackage('sample.pkg@1.2.3');
  const registry = JSON.parse(localStorageData.get('irgeztne-workshop-installed-v1') || '[]');
  if (registry.length !== 0) throw new Error('Installed registry record survived uninstall');
  if (byteStore.has('blob:a') || byteStore.has('blob:b')) throw new Error('Installed byte records survived uninstall');

  console.log('PASS: R1W8D Installed lifecycle removes registry + bytes, preserves creator boundary, clarifies drop zone, and updates preview wording');
})().catch((error) => {
  console.error(error && error.stack || error);
  process.exit(1);
});
