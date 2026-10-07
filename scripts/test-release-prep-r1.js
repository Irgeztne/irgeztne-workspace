#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');

const pkg = JSON.parse(read('package.json'));
const buildFiles = pkg.build && pkg.build.files || [];
assert(buildFiles.includes('template-lab/**/*'), 'Release build must include template-lab.');
['LICENSE', 'LICENSE_HISTORY.md', 'THIRD_PARTY_NOTICES.md'].forEach((entry) => assert(buildFiles.includes(entry), 'Release legal file missing: ' + entry));
[
  '!src/messenger/INTEGRATION*.json',
  '!src/**/*.good-*',
  '!src/**/*.before-*',
  '!src/**/*.bak-*'
].forEach((entry) => assert(buildFiles.includes(entry), 'Release build exclusion missing: ' + entry));

const filesJs = read('src/modules/files/files-v0.js');
assert(filesJs.includes('ns-library-preview-quick-delete'), 'Files quick delete is missing.');
assert(filesJs.includes('data-library-remove="${escapeHtml(item.id)}"'), 'Files quick delete bypasses the canonical remove owner.');

const documentsJs = read('src/modules/documents/documents-v0.js');
assert(documentsJs.includes('ns-documents-v1__workspace-file-pill-name'), 'Document attachment filename control is missing.');
assert(documentsJs.includes('data-documents-action="remove-workspace-file-ref"'), 'Document attachment unlink control is missing.');
assert(documentsJs.includes('unlinkWorkspaceFileFromActive'), 'Document attachment unlink owner is missing.');

const studioJs = read('src/modules/editor-site-studio-safe/editor-site-studio-safe-v5.js');
assert(studioJs.includes('IRGEZTNE_TEMPLATE_GALLERY_FIT_RELEASE_R1'), 'Template gallery fit pass is missing.');
assert(studioJs.includes('var baseWidth = 1440;') && studioJs.includes('var baseHeight = 900;'), 'Template previews do not share the release desktop viewport.');
assert((studioJs.match(/finishTemplateGalleryFrameReleaseR1\(frame\)/g) || []).length >= 3, 'Not all gallery loaders use the release fit helper.');
assert(studioJs.includes('IRGEZTNE_WEBSTUDIO_ACCOUNT_CONTEXT_RELEASE_R1'), 'Web Studio account context is missing.');
assert(studioJs.includes("action === 'open-account-release-r1'"), 'Web Studio account action is missing.');
assert(studioJs.includes('window.IRGEZTNEConnected'), 'Web Studio must reuse the existing account owner.');

const workshopJs = read('src/v88-codehub-v1.js');
const workshopCss = read('src/v88-codehub-v1.css');
assert(workshopJs.includes('Таможня пакета') && workshopJs.includes('Package Customs'), 'Workshop Customs UI is missing.');
assert(workshopJs.includes('data-codehub-field="license"'), 'Workshop license field is missing.');
assert(workshopJs.includes('renderWorkshopAccountReleaseR1') && workshopJs.includes('window.IRGEZTNEConnected'), 'Workshop must reuse the existing account owner.');
assert(workshopCss.includes('IRGEZTNE_WEBSTUDIO_WORKSHOP_LIGHT_LAYERS_V100B'), 'Workshop release light layers are missing.');

// Runtime-check the Workshop Customs contract without Electron.
const memory = new Map();
const sandbox = {
  window: {},
  localStorage: {
    getItem(key) { return memory.has(key) ? memory.get(key) : null; },
    setItem(key, value) { memory.set(key, String(value)); },
    removeItem(key) { memory.delete(key); }
  },
  console,
  Set,
  Map,
  Date,
  Math,
  JSON,
  Number,
  String,
  Array,
  Object,
  RegExp
};
vm.createContext(sandbox);
vm.runInContext(read('src/ns-codehub-store.js'), sandbox, { filename: 'ns-codehub-store.js' });
const store = sandbox.window.NSCodeHubStore;
assert(store, 'Workshop store API is unavailable.');

const safe = store.createItem({
  title: 'Safe template',
  type: 'template',
  version: '1.2.3',
  license: 'MPL-2.0',
  author: { name: 'Alice' },
  description: { short: 'Useful package', full: 'Long description' },
  preview: { cover: 'cover.png', gallery: ['preview.png'] },
  tags: ['web'],
  compatibility: { nsBrowser: '8.x' },
  files: [{ path: 'index.html', role: 'main', mime: 'text/html' }]
});
assert(store.validateItem(safe.id).isReady, 'A valid passive package did not pass Customs.');

const unsafe = store.createItem({
  title: 'Unsafe package',
  type: 'template',
  version: 'v1',
  license: '',
  author: { name: 'Local creator' },
  description: { short: 'x' },
  preview: { cover: 'cover.png' },
  compatibility: { nsBrowser: '8.x' },
  files: [
    { path: '../evil.sh', role: 'asset' },
    { path: '../evil.sh', role: 'asset' }
  ]
});
const errors = store.validateItem(unsafe.id).errors.join('\n');
[
  'semantic x.y.z',
  'Author name',
  'license',
  'Unsafe package file path',
  'Duplicate package file path',
  'Executable or installer',
  'main or template'
].forEach((needle) => assert(errors.includes(needle), 'Customs rejection missing: ' + needle));

console.log('PASS: IRGEZTNE Workspace Release Prep R1 contracts verified.');
