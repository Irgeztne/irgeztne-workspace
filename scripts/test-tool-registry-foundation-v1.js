#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const registryPath = path.join(root, 'src/modules/tools/tool-registry-v1.js');
const toolsPath = path.join(root, 'src/modules/tools/tools-v0.js');
const indexPath = path.join(root, 'index.html');

const registrySource = fs.readFileSync(registryPath, 'utf8');
const toolsSource = fs.readFileSync(toolsPath, 'utf8');
const imageSource = fs.readFileSync(path.join(root, 'src/modules/tools/image-tool-v1.js'), 'utf8');
const indexSource = fs.readFileSync(indexPath, 'utf8');

assert(
  indexSource.indexOf('src/modules/tools/tool-registry-v1.js') < indexSource.indexOf('src/modules/files/files-v0.js'),
  'Tool Registry must load before Files and Tools host adapters.'
);
assert(!registrySource.includes('Tool Studio'), 'Production registry must not depend on legacy Tool Studio.');

assert(imageSource.includes("const TOOL_ID = 'workspace.image.convert'"), 'Missing canonical registered Image Tool.');
[
  'workspace.html.convert',
  'workspace.json.format',
  'workspace.document.export',
  'workspace.text.cleanup'
].forEach((id) => {
  assert(toolsSource.includes("id: '" + id + "'"), 'Missing registered working tool: ' + id);
});

const events = [];
class CustomEvent {
  constructor(type, options) {
    this.type = type;
    this.detail = options && options.detail;
  }
}

const document = {
  documentElement: {
    dataset: { theme: 'light' },
    className: '',
    getAttribute(name) { return name === 'lang' ? 'en' : ''; }
  },
  body: { dataset: {}, className: '' },
  dispatchEvent(event) {
    events.push(event);
    return true;
  }
};

const sandbox = {
  window: null,
  document,
  localStorage: { getItem() { return null; } },
  CustomEvent,
  Map,
  Set,
  Date,
  Promise,
  Object,
  Array,
  String,
  Boolean,
  Error,
  console
};
sandbox.window = sandbox;

vm.runInNewContext(registrySource, sandbox, { filename: registryPath });

const registry = sandbox.NSToolRegistryV1;
assert(registry, 'NSToolRegistryV1 was not exposed.');
assert.strictEqual(typeof registry.register, 'function');
assert.strictEqual(typeof registry.open, 'function');
assert.strictEqual(typeof registry.createContext, 'function');

let implementationContext = null;
let returnedResult = null;

const metadata = registry.register({
  id: 'workspace.test.contract',
  version: '1.0.0',
  title: { ru: 'Проверка', en: 'Contract test' },
  description: { ru: 'Проверка контракта.', en: 'Registry contract test.' },
  category: 'test',
  icon: 'check',
  inputTypes: ['image/png'],
  outputTypes: ['image/webp'],
  supportedHosts: ['files', 'tools'],
  modes: ['full', 'embedded'],
  capabilities: { network: false, auth: false },
  implementation: {
    open(context) {
      implementationContext = context;
      return {
        status: 'success',
        outputs: [{ owner: 'files', id: 'result-1', type: 'image', mime: 'image/webp' }],
        payload: { preservedSource: true }
      };
    }
  }
});

assert.strictEqual(metadata.id, 'workspace.test.contract');
assert.deepStrictEqual(Array.from(metadata.inputTypes), ['image/png']);
assert.deepStrictEqual(Array.from(metadata.outputTypes), ['image/webp']);
assert.deepStrictEqual(Array.from(metadata.supportedHosts), ['files', 'tools']);
assert.strictEqual(metadata.capabilities.network, false);
assert.strictEqual(metadata.capabilities.auth, false);
assert(Object.isFrozen(metadata), 'Public tool metadata must be immutable.');
assert.strictEqual(registry.get(metadata.id), metadata, 'Registered metadata must be discoverable.');
assert.strictEqual(registry.list({ host: 'files' }).length, 1, 'Host filtering failed.');
assert.strictEqual(registry.list({ host: 'projects' }).length, 0, 'Unsupported host leaked into listing.');

assert.throws(() => {
  registry.register({
    id: 'workspace.test.contract',
    title: { ru: 'Дубль', en: 'Duplicate' },
    description: { ru: 'Дубль.', en: 'Duplicate.' },
    supportedHosts: ['files'],
    implementation: { open() {} }
  });
}, /already registered/, 'Duplicate stable ids must be rejected.');

(async () => {
  const opened = await registry.open(metadata.id, {
    host: 'files',
    surface: 'workspace',
    mode: 'embedded',
    sourceRef: { owner: 'files', id: 'source-1', type: 'image', mime: 'image/png', name: 'source.png' },
    projectRef: { id: 'project-1', name: 'Project' },
    taskRef: { id: 'task-1', name: 'Task' },
    selection: [{ owner: 'files', id: 'source-1', mime: 'image/png' }],
    returnResult(result) { returnedResult = result; }
  });

  assert(implementationContext, 'Implementation did not receive host context.');
  assert.strictEqual(implementationContext.locale, 'en', 'Host locale was not resolved.');
  assert.strictEqual(implementationContext.theme, 'light', 'Host theme was not resolved.');
  assert.strictEqual(implementationContext.host, 'files');
  assert.strictEqual(implementationContext.mode, 'embedded');
  assert.strictEqual(implementationContext.sourceRef.id, 'source-1');
  assert.strictEqual(implementationContext.projectRef.id, 'project-1');
  assert.strictEqual(implementationContext.taskRef.id, 'task-1');
  assert.strictEqual(implementationContext.selection.length, 1);
  assert.strictEqual(typeof implementationContext.emitResult, 'function');

  assert(returnedResult, 'Owner did not receive the normalized result.');
  assert.strictEqual(returnedResult.toolId, metadata.id);
  assert.strictEqual(returnedResult.status, 'success');
  assert.strictEqual(returnedResult.host, 'files');
  assert.strictEqual(returnedResult.sourceRef.id, 'source-1');
  assert.strictEqual(returnedResult.outputTypes[0], 'image/webp');
  assert.strictEqual(returnedResult.payload.preservedSource, true);
  assert.strictEqual(opened.result, returnedResult);

  assert(events.some((event) => event.type === 'ns-tool:registered'));
  assert(events.some((event) => event.type === 'ns-tool:open'));
  assert(events.some((event) => event.type === 'ns-tool:result'));

  await assert.rejects(
    registry.open(metadata.id, { host: 'projects', mode: 'embedded' }),
    /does not support host projects/,
    'Unsupported hosts must fail before implementation.'
  );

  console.log('PASS: Tool Registry V1 foundation contract verified.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
