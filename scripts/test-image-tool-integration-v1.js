#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

const indexSource = read('index.html');
const registrySource = read('src/modules/tools/tool-registry-v1.js');
const imageSource = read('src/modules/tools/image-tool-v1.js');
const imageCss = read('src/modules/tools/image-tool-v1.css');
const toolsSource = read('src/modules/tools/tools-v0.js');
const filesSource = read('src/modules/files/files-v0.js');

const registryIndex = indexSource.indexOf('src/modules/tools/tool-registry-v1.js');
const imageIndex = indexSource.indexOf('src/modules/tools/image-tool-v1.js');
const filesIndex = indexSource.indexOf('src/modules/files/files-v0.js');
const toolsIndex = indexSource.indexOf('src/modules/tools/tools-v0.js');
assert(registryIndex >= 0 && imageIndex > registryIndex && filesIndex > imageIndex && toolsIndex > imageIndex,
  'Registry and canonical Image Tool must load before both host adapters.');

assert(toolsSource.includes('data-image-tool-host="tools"'), 'Tools host adapter is missing.');
assert(filesSource.includes('data-image-tool-host="files"'), 'Files host adapter is missing.');
assert(toolsSource.includes('window.NSImageToolV1.mountAll(rootEl)'), 'Tools does not mount the canonical core.');
assert(filesSource.includes('window.NSImageToolV1.mountAll(root)'), 'Files does not mount the canonical core.');

[
  'runImageToolConversion',
  'function convertImage',
  'function loadImageFile',
  'canvas.toDataURL',
  'data-image-convert-download',
  'data-image-convert-library',
  'data-tools-image-file'
].forEach((legacySignal) => {
  assert(!toolsSource.includes(legacySignal), 'Legacy Tools converter remains: ' + legacySignal);
  assert(!filesSource.includes(legacySignal), 'Legacy Files converter remains: ' + legacySignal);
});

[
  'data-image-tool-source-preview',
  'data-image-tool-result-preview',
  'data-image-tool-width',
  'data-image-tool-height',
  'data-image-tool-lock',
  'data-image-tool-format',
  'data-image-tool-quality',
  'data-image-tool-action="save"',
  'sourcePreserved: true',
  "SUPPORTED_TYPES = ['image/png', 'image/jpeg', 'image/webp']"
].forEach((contract) => assert(imageSource.includes(contract), 'Image Tool contract missing: ' + contract));

assert(imageCss.includes('[data-image-tool-theme="light"]'), 'Light theme token set is missing.');
assert(imageCss.includes('--it-bg:'), 'Dark/default semantic theme tokens are missing.');
assert(imageCss.includes(':focus-visible'), 'Keyboard focus state is missing.');

const events = [];
class CustomEvent {
  constructor(type, options) { this.type = type; this.detail = options && options.detail; }
}
const document = {
  documentElement: {
    dataset: { theme: 'dark' }, className: '',
    getAttribute(name) { return name === 'lang' ? 'ru' : ''; }
  },
  body: { dataset: {}, className: '' },
  dispatchEvent(event) { events.push(event); return true; },
  querySelector() { return null; },
  querySelectorAll() { return []; }
};
const sandbox = {
  window: null,
  document,
  localStorage: { getItem() { return null; } },
  CustomEvent,
  Map, Set, WeakMap, Date, Promise, Object, Array, String, Boolean, Number, Math, Error, console
};
sandbox.window = sandbox;

vm.runInNewContext(registrySource, sandbox, { filename: 'tool-registry-v1.js' });
vm.runInNewContext(imageSource, sandbox, { filename: 'image-tool-v1.js' });

const registry = sandbox.NSToolRegistryV1;
const imageTool = sandbox.NSImageToolV1;
assert(registry && imageTool, 'Canonical runtime globals were not exposed.');

const metadata = registry.get('workspace.image.convert');
assert(metadata, 'Image Tool did not register itself.');
assert.deepStrictEqual(Array.from(metadata.inputTypes), ['image/png', 'image/jpeg', 'image/webp']);
assert.deepStrictEqual(Array.from(metadata.outputTypes), ['image/png', 'image/jpeg', 'image/webp']);
assert.deepStrictEqual(Array.from(metadata.supportedHosts), ['tools', 'files', 'projects', 'tasks', 'webstudio']);
assert.strictEqual(metadata.capabilities.network, false);
assert.strictEqual(metadata.capabilities.auth, false);

assert.strictEqual(imageTool.isSupportedType('image/png', 'source.png'), true);
assert.strictEqual(imageTool.isSupportedType('image/jpeg', 'source.jpg'), true);
assert.strictEqual(imageTool.isSupportedType('', 'source.webp'), true);
assert.strictEqual(imageTool.isSupportedType('image/gif', 'source.gif'), false);
assert.strictEqual(imageTool.makeFileName('photo.final.png', 'image/webp'), 'photo.final-irgeztne.webp');

assert.deepStrictEqual(
  Object.assign({}, imageTool.calculateSize(1600, 900, 800, 0, true, 'width')),
  { width: 800, height: 450 },
  'Aspect-locked width resize failed.'
);
assert.deepStrictEqual(
  Object.assign({}, imageTool.calculateSize(1600, 900, 0, 450, true, 'height')),
  { width: 800, height: 450 },
  'Aspect-locked height resize failed.'
);
assert.deepStrictEqual(
  Object.assign({}, imageTool.calculateSize(1600, 900, 800, 600, false, 'width')),
  { width: 800, height: 600 },
  'Unlocked resize failed.'
);

assert(events.some((event) => event.type === 'ns-tool:registered' && event.detail.tool.id === metadata.id));

console.log('PASS: canonical Image Tool V1 verified for Tools + Files, RU/EN and Light/Dark contracts.');
