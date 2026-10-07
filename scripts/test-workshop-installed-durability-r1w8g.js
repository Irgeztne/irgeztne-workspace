#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const codehubPath = path.join(root, 'src/v88-codehub-v1.js');
let source = fs.readFileSync(codehubPath, 'utf8');

function has(haystack, needle, message) {
  if (!haystack.includes(needle)) throw new Error(message);
}

has(source, 'IRGEZTNE_WORKSHOP_INSTALLED_DURABILITY_R1W8G', 'Missing R1W8G owner marker');
has(source, "const WORKSHOP_INSTALLED_DURABLE_KEY = 'workspace.workshop.installed.v1';", 'Installed durable Storage Core key is missing');
has(source, 'function readWorkshopInstalledDurableState()', 'Installed durable read path is missing');
has(source, 'storageGetModuleStateSync(WORKSHOP_INSTALLED_DURABLE_KEY, null)', 'Installed registry does not read from Storage Core');
has(source, 'storageSetModuleStateSync(WORKSHOP_INSTALLED_DURABLE_KEY', 'Installed registry does not write to Storage Core');
has(source, 'First upgrade from the old localStorage-only registry', 'Legacy installed registry migration rule is missing');

source = source.replace(
  '  const api = {',
  '  window.__R1W8G_TEST = { readWorkshopInstalledRegistry, writeWorkshopInstalledRegistry };\n\n  const api = {'
);

const durable = Object.create(null);

function makeContext(localStorageData) {
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
    nsAPI: {
      storageGetModuleStateSync(moduleId, fallback) {
        return Object.prototype.hasOwnProperty.call(durable, moduleId)
          ? JSON.parse(JSON.stringify(durable[moduleId]))
          : fallback;
      },
      storageSetModuleStateSync(moduleId, value) {
        durable[moduleId] = JSON.parse(JSON.stringify(value));
        return { ok: true };
      }
    },
    addEventListener() {},
    removeEventListener() {},
    confirm() { return true; }
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
    URL,
    Date
  };
  vm.runInNewContext(source, context, { filename: 'v88-codehub-v1.js' });
  return { api: windowStub.__R1W8G_TEST, localStorageData };
}

const record = {
  installId: 'test.template@0.1.0',
  packageId: 'test.template',
  type: 'template',
  title: 'IRGEZTNE Test Template',
  version: '0.1.0',
  installedAt: '2026-09-05T08:00:00.000Z',
  files: [{ blobKey: 'blob:one' }]
};

// Upgrade path: the old visible local-only registry must become durable.
const localA = new Map([
  ['irgeztne-workshop-installed-v1', JSON.stringify([record])]
]);
const first = makeContext(localA);
let items = first.api.readWorkshopInstalledRegistry();
if (items.length !== 1 || items[0].packageId !== 'test.template') {
  throw new Error('Legacy installed package was not preserved during durability upgrade');
}
if (!durable['workspace.workshop.installed.v1'] || durable['workspace.workshop.installed.v1'].items.length !== 1) {
  throw new Error('Installed package was not mirrored to durable Storage Core');
}

// Simulated full renderer restart with localStorage unavailable/empty: durable state must restore the package.
const localB = new Map();
const second = makeContext(localB);
items = second.api.readWorkshopInstalledRegistry();
if (items.length !== 1 || items[0].packageId !== 'test.template') {
  throw new Error('Installed package did not survive restart from durable Storage Core');
}
if (!localB.has('irgeztne-workshop-installed-v1')) {
  throw new Error('Durable installed registry was not mirrored back to localStorage after restart');
}

// Deletion must update durable state too, so a later restart cannot resurrect it.
second.api.writeWorkshopInstalledRegistry([]);
if (!durable['workspace.workshop.installed.v1'] || durable['workspace.workshop.installed.v1'].items.length !== 0) {
  throw new Error('Installed package deletion did not persist to durable Storage Core');
}

const localC = new Map();
const third = makeContext(localC);
items = third.api.readWorkshopInstalledRegistry();
if (items.length !== 0) {
  throw new Error('Deleted installed package resurrected after restart');
}

console.log('PASS: R1W8G Installed registry survives renderer/app restart via Storage Core and deletions do not resurrect');
