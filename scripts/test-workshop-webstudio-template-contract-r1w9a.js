#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const codehubPath = path.join(root, 'src/v88-codehub-v1.js');
const studioPath = path.join(root, 'src/modules/editor-site-studio-safe/editor-site-studio-safe-v5.js');
const contractPath = path.join(root, 'docs/WEBSTUDIO-TEMPLATE-CONTRACT-v1.md');
const codehub = fs.readFileSync(codehubPath, 'utf8');
const studio = fs.readFileSync(studioPath, 'utf8');
const contract = fs.readFileSync(contractPath, 'utf8');

function has(text, needle, message) {
  if (!text.includes(needle)) throw new Error(message);
}
function lacks(text, needle, message) {
  if (text.includes(needle)) throw new Error(message);
}

has(codehub, 'IRGEZTNE_WORKSHOP_WEBSTUDIO_TEMPLATE_CONTRACT_V1', 'Missing Workshop public adapter owner');
has(codehub, 'getInstalledTemplates: function ()', 'Workshop does not expose installed-template discovery');
has(codehub, 'getInstalledTemplatePreviewSrcdoc: function (packageId)', 'Workshop does not expose installed-template preview');
has(codehub, 'return buildWorkshopLivePreview(record);', 'Installed-template preview does not reuse the proven sandboxed Workshop preview builder');
has(studio, 'IRGEZTNE_WORKSHOP_TEMPLATE_LIBRARY_BRIDGE_R1W9A', 'Missing Web Studio installed-template bridge');
has(studio, 'data-v5-workshop-installed-templates-r1w9a="1"', 'Web Studio Templates does not render an installed-template section');
has(studio, "typeof api.getInstalledTemplates !== 'function'", 'Web Studio is not consuming the public discovery API');
has(studio, "typeof api.getInstalledTemplatePreviewSrcdoc !== 'function'", 'Web Studio is not consuming the public preview API');
has(studio, 'sandbox="allow-scripts"', 'Installed template preview iframe is not sandboxed');
lacks(studio, 'irgeztne-workshop-installed-v1', 'Web Studio illegally reads Workshop registry storage directly');
lacks(studio, 'irgeztne-workshop-bytes-v1', 'Web Studio illegally reads Workshop byte storage directly');
has(contract, 'formatVersion`: `1.0`', 'Public contract does not freeze the package format version');
has(contract, '`package.compatibility.product`: `webstudio`', 'Public contract does not define Web Studio compatibility targeting');
has(contract, 'MUST NOT read Workshop localStorage or IndexedDB directly', 'Public ownership boundary is not documented');
has(contract, 'does **not** claim', 'Contract boundary does not explicitly reject an artificial full-adapter PASS');

const storage = new Map();
storage.set('irgeztne-workshop-installed-v1', JSON.stringify([
  {
    installId: 'pkg.template@0.1.0',
    packageId: 'pkg.template',
    type: 'template',
    title: 'Installed Template',
    version: '0.1.0',
    author: { name: 'El', id: 'creator-1', source: 'local' },
    license: 'MPL-2.0',
    distribution: 'free',
    description: { short: 'Template from Workshop', full: '' },
    compatibility: { product: 'webstudio', minAppVersion: '1.0.0' },
    files: [{ path: 'index.html', role: 'main', kind: 'document', blobKey: 'blob:1' }],
    integrity: 'PASS',
    algorithm: 'SHA-256'
  },
  {
    installId: 'pkg.widget@0.1.0',
    packageId: 'pkg.widget',
    type: 'widget',
    title: 'Widget',
    version: '0.1.0',
    author: { name: 'El' },
    compatibility: { product: 'webstudio', minAppVersion: '1.0.0' },
    files: [{ path: 'widget.html', blobKey: 'blob:2' }]
  },
  {
    installId: 'pkg.other@0.1.0',
    packageId: 'pkg.other',
    type: 'template',
    title: 'Other Product',
    version: '0.1.0',
    author: { name: 'Other' },
    compatibility: { product: 'other-product', minAppVersion: '1.0.0' },
    files: [{ path: 'index.html', blobKey: 'blob:3' }]
  }
]));
storage.set('irgeztne-workshop-installed-v1-meta', JSON.stringify({ persistenceVersion: 1, updatedAt: '2026-09-05T14:15:00.000Z' }));

const windowStub = {
  NSCodeHubStore: {
    subscribe() { return function () {}; },
    getCounts() { return { all: 0, draft: 0, validated: 0, ready: 0, submitted: 0 }; },
    getActiveItem() { return null; },
    getAll() { return []; }
  },
  localStorage: {
    getItem(key) { return storage.has(key) ? storage.get(key) : null; },
    setItem(key, value) { storage.set(key, String(value)); }
  },
  addEventListener() {},
  removeEventListener() {}
};
const documentStub = {
  readyState: 'loading',
  documentElement: { lang: 'en' },
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
vm.runInNewContext(codehub, context, { filename: 'v88-codehub-v1.js' });
if (!windowStub.NSCodeHubV1) throw new Error('NSCodeHubV1 public API missing');
const templates = windowStub.NSCodeHubV1.getInstalledTemplates();
if (!Array.isArray(templates) || templates.length !== 1) throw new Error('Installed template discovery did not filter by type/product');
if (templates[0].packageId !== 'pkg.template') throw new Error('Wrong installed template returned');
if (templates[0].authorLabel !== 'El') throw new Error('Installed template author projection is wrong');
if (templates[0].fileCount !== 1) throw new Error('Installed template file count projection is wrong');

console.log('PASS: R1W9A public Workshop -> Web Studio template library contract and read-only bridge verified');
