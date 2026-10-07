#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const modelPath = path.join(root, 'src/modules/documents/office-working-object-v1.js');
const source = fs.readFileSync(modelPath, 'utf8');
const sandbox = { window: null, console, Date, Math, JSON, Object, Array, Set, String };
sandbox.window = sandbox;
vm.runInNewContext(source, sandbox, { filename: modelPath });

const model = sandbox.NSOfficeWorkingObjectV1;
const documentObject = model.create('document', {
  id: 'document-1',
  title: 'First-class document',
  body: 'Shared Office body',
  documentType: 'guide',
  status: 'ready',
  projectId: 'project-1',
  fileIds: ['file-1']
});

assert.strictEqual(documentObject.type, 'document');
assert.strictEqual(documentObject.documentType, 'guide');
assert.strictEqual(documentObject.body, 'Shared Office body');
assert.strictEqual(documentObject.status, 'ready');
assert.strictEqual(documentObject.projectId, 'project-1');

documentObject.body = 'Edited through the existing document compatibility view';
const stored = model.serialize(documentObject);
assert.strictEqual(stored.type, 'document');
assert.strictEqual(stored.payload.body, 'Edited through the existing document compatibility view');
assert.strictEqual(stored.payload.documentType, 'guide');
assert.strictEqual(stored.relations.fileIds[0], 'file-1');

const reopened = model.normalize(JSON.parse(JSON.stringify(stored)));
assert.strictEqual(reopened.type, 'document');
assert.strictEqual(reopened.body, 'Edited through the existing document compatibility view');
assert.strictEqual(reopened.documentType, 'guide');

console.log('PASS: Document remains the first normal Office object type with existing compatibility fields.');
