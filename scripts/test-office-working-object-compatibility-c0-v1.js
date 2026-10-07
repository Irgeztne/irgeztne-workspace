#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const modelPath = path.join(root, 'src/modules/documents/office-working-object-v1.js');
const documentsPath = path.join(root, 'src/modules/documents/documents-v0.js');
const relationsPath = path.join(root, 'src/ns-relations-store.js');
const indexPath = path.join(root, 'index.html');

assert(fs.existsSync(modelPath), 'C0 model module is missing.');
const modelSource = fs.readFileSync(modelPath, 'utf8');
const documentsSource = fs.readFileSync(documentsPath, 'utf8');
const relationsSource = fs.readFileSync(relationsPath, 'utf8');
const indexSource = fs.readFileSync(indexPath, 'utf8');

const sandbox = { window: null, console, Date, Math, JSON, Object, Array, Set, String };
sandbox.window = sandbox;
vm.runInNewContext(modelSource, sandbox, { filename: modelPath });

const model = sandbox.NSOfficeWorkingObjectV1;
assert(model, 'NSOfficeWorkingObjectV1 was not exposed.');
assert.deepStrictEqual(
  Array.from(model.TYPES),
  ['document', 'spreadsheet', 'presentation', 'diagram', 'formula', 'form'],
  'Canonical Office type list regressed.'
);

const legacyMissingType = {
  id: 'legacy-1',
  title: 'Legacy without type',
  body: 'Preserve this body',
  status: 'ready',
  tags: ['legacy'],
  projectId: 'project-1',
  fileIds: ['file-1', 'file-1'],
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-02T00:00:00.000Z'
};
const normalizedMissingType = model.normalize(legacyMissingType);
assert.strictEqual(normalizedMissingType.type, 'document');
assert.strictEqual(normalizedMissingType.schemaVersion, 1);
assert.strictEqual(normalizedMissingType.payload.body, 'Preserve this body');
assert.strictEqual(normalizedMissingType.payload.documentType, 'article');
assert.strictEqual(normalizedMissingType.payload.status, 'ready');
assert.strictEqual(normalizedMissingType.relations.projectId, 'project-1');
assert.deepStrictEqual(Array.from(normalizedMissingType.relations.fileIds), ['file-1']);

const legacyTyped = {
  id: 'legacy-2',
  title: 'Historical report',
  type: 'report',
  body: 'Report body',
  status: 'draft',
  tags: ['report'],
  mapPointIds: ['point-1']
};
const normalizedTyped = model.normalize(legacyTyped);
assert.strictEqual(normalizedTyped.type, 'document', 'Historical document subtype must not become the Office object type.');
assert.strictEqual(normalizedTyped.documentType, 'report');
assert.strictEqual(normalizedTyped.body, 'Report body');
normalizedTyped.body = 'Edited after normalization';
assert.strictEqual(normalizedTyped.payload.body, 'Edited after normalization', 'Legacy compatibility accessor is not synchronized.');
normalizedTyped.projectId = 'project-2';
assert.strictEqual(normalizedTyped.relations.projectId, 'project-2');

assert.deepStrictEqual(
  JSON.parse(JSON.stringify(model.serialize(normalizedMissingType, { preserveLegacy: true }))),
  legacyMissingType,
  'An untouched legacy record must stay byte-shape compatible on state saves.'
);

const upgraded = model.serialize(normalizedTyped);
['id', 'type', 'title', 'createdAt', 'updatedAt', 'schemaVersion', 'payload'].forEach((key) => {
  assert(Object.prototype.hasOwnProperty.call(upgraded, key), 'Upgraded object missing required field: ' + key);
});
assert.strictEqual(upgraded.type, 'document');
assert.strictEqual(upgraded.payload.documentType, 'report');
assert.strictEqual(upgraded.payload.body, 'Edited after normalization');
assert.strictEqual(upgraded.relations.projectId, 'project-2');
assert(!Object.prototype.hasOwnProperty.call(upgraded, 'body'), 'Legacy aliases must not be duplicated in the stored common schema.');

const spreadsheetSeed = model.create('spreadsheet', {
  id: 'sheet-1',
  title: 'Budget',
  payload: { sheets: [{ id: 'sheet-a', name: 'Sheet 1', cells: { A1: { value: 42 } } }] },
  relations: { projectId: 'project-3', taskIds: ['task-1'] }
});
const spreadsheetRoundTrip = model.normalize(model.serialize(spreadsheetSeed));
assert.strictEqual(spreadsheetRoundTrip.type, 'spreadsheet');
assert.strictEqual(spreadsheetRoundTrip.payload.sheets[0].cells.A1.value, 42);
assert.strictEqual(spreadsheetRoundTrip.relations.projectId, 'project-3');
assert.deepStrictEqual(Array.from(spreadsheetRoundTrip.relations.taskIds), ['task-1']);

const workspaceFileDocument = model.create('document', {
  id: 'doc-workspace-file-1',
  title: 'Workspace file relation',
  relations: {
    workspaceFileRefs: [
      {
        refId: 'ref-1',
        fileId: 'file-1',
        displayName: 'video.mp4',
        originalName: 'video.mp4',
        mimeType: 'video/mp4',
        extension: 'mp4',
        sizeBytes: 123456,
        sha256: 'a'.repeat(64),
        role: 'media'
      },
      {
        refId: 'ref-1',
        fileId: 'file-1',
        displayName: 'duplicate.mp4'
      }
    ]
  }
});

assert.strictEqual(workspaceFileDocument.relations.workspaceFileRefs.length, 1);
assert.strictEqual(workspaceFileDocument.workspaceFileRefs[0].refId, 'ref-1');
assert.strictEqual(workspaceFileDocument.workspaceFileRefs[0].fileId, 'file-1');
assert.strictEqual(workspaceFileDocument.workspaceFileRefs[0].displayName, 'video.mp4');

const workspaceFileRoundTrip = model.normalize(model.serialize(workspaceFileDocument));
assert.strictEqual(workspaceFileRoundTrip.relations.workspaceFileRefs.length, 1);
assert.strictEqual(workspaceFileRoundTrip.relations.workspaceFileRefs[0].refId, 'ref-1');
assert.strictEqual(workspaceFileRoundTrip.relations.workspaceFileRefs[0].fileId, 'file-1');
assert.strictEqual(workspaceFileRoundTrip.relations.workspaceFileRefs[0].sizeBytes, 123456);
assert.strictEqual(workspaceFileRoundTrip.relations.workspaceFileRefs[0].sha256, 'a'.repeat(64));

assert.deepStrictEqual(
  JSON.parse(JSON.stringify(model.serialize(normalizedMissingType, { preserveLegacy: true }))),
  legacyMissingType,
  'Adding Workspace file relations must not rewrite untouched legacy records.'
);

assert(indexSource.indexOf('office-working-object-v1.js') < indexSource.indexOf('documents-v0.js'), 'C0 model must load before the existing Office owner.');
assert(documentsSource.includes("const STORAGE_KEY = 'irgeztne.documents.v1'"), 'Existing documents-v1 storage key changed.');
assert(documentsSource.includes('window.NSDocumentsV1'), 'Existing NSDocumentsV1 compatibility API was removed.');
assert(documentsSource.includes('window.NSOfficeV1'), 'Common Office owner API is missing.');
assert(documentsSource.includes('preserveLegacy'), 'Per-object lazy schema write contract is missing.');
assert(relationsSource.includes('source.payload'), 'Relation reader does not understand common Office payloads.');
assert(relationsSource.includes('source.relations'), 'Relation reader does not understand Office relation references.');

console.log('PASS: Office C0 legacy documents, lazy schema writes, shared types and relation references verified.');
