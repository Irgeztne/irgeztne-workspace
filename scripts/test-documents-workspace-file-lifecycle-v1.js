'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const source = fs.readFileSync(
  path.join(ROOT, 'src/modules/documents/documents-v0.js'),
  'utf8'
);

function fn(name, nextName) {
  const start = source.indexOf(`  ${name}`);
  assert.notEqual(start, -1, `Missing ${name}`);

  const end = source.indexOf(`\n  ${nextName}`, start + 3);
  assert.notEqual(end, -1, `Missing boundary ${nextName}`);

  return source.slice(start, end);
}

const createDocument = fn(
  'function createDocument(seed)',
  'function createObject(type, seed)'
);

const removeWorkspaceFileRef = fn(
  'async function removeWorkspaceFileRef(item, refId)',
  'async function releaseWorkspaceFileRefs(item)'
);

const releaseWorkspaceFileRefs = fn(
  'async function releaseWorkspaceFileRefs(item)',
  'async function removeObject(objectId)'
);

const removeObject = fn(
  'async function removeObject(objectId)',
  'async function deleteOfficeObject(objectId)'
);

const deleteOfficeObject = fn(
  'async function deleteOfficeObject(objectId)',
  'function getObjectById(objectId)'
);

const deleteActive = fn(
  'async function deleteActive()',
  'async function duplicateActive()'
);

const duplicateActive = fn(
  'async function duplicateActive()',
  'function persistAndRender()'
);

assert.match(
  createDocument,
  /workspaceFileRefs:\s*OfficeObject\.normalizeWorkspaceFileRefs\(seed\.workspaceFileRefs\)/
);
assert.match(
  createDocument,
  /id:\s*seed\.id\s*\|\|\s*uid\('doc'\)/
);
console.log('PASS createDocument preserves canonical Workspace file refs and stable id');

assert.match(
  removeWorkspaceFileRef,
  /workspaceFileRemoveReference\(target\.refId\)/
);
assert.match(
  removeWorkspaceFileRef,
  /refs\.filter\(\(entry\)\s*=>\s*entry\.refId\s*!==\s*target\.refId\)/
);
console.log('PASS unlink removes backend ref before dropping local relation');

assert.match(
  releaseWorkspaceFileRefs,
  /for\s*\(const ref of refs\)/
);
assert.match(
  releaseWorkspaceFileRefs,
  /await removeWorkspaceFileRef\(item,\s*ref\.refId\)/
);
console.log('PASS release walks every Workspace file reference');

const releaseIndex = removeObject.indexOf('await releaseWorkspaceFileRefs(item)');
const deleteIndex = removeObject.indexOf('state.items = state.items.filter');

assert.ok(releaseIndex !== -1 && deleteIndex !== -1 && releaseIndex < deleteIndex);
console.log('PASS removeObject releases refs before deleting Office object');

assert.match(
  deleteOfficeObject,
  /await removeObject\(item\.id\)/
);
assert.match(
  deleteActive,
  /await removeObject\(item\.id\)/
);
console.log('PASS both delete paths use lifecycle-aware removeObject');

assert.match(
  duplicateActive,
  /const sourceWorkspaceRefs = getWorkspaceFileRefs\(item\)/
);
assert.match(
  duplicateActive,
  /workspaceFileRefs:\s*\[\]/
);
assert.match(
  duplicateActive,
  /workspaceFileAttach\(\{[\s\S]*fileId:\s*sourceRef\.fileId,[\s\S]*ownerType:\s*'document',[\s\S]*ownerId:\s*copy\.id,[\s\S]*role:/
);
assert.match(
  duplicateActive,
  /workspaceFileRefFromAttachResult\([\s\S]*attached,[\s\S]*sourceRef\.role/
);

assert.doesNotMatch(
  duplicateActive,
  /workspaceFileRefs:\s*sourceWorkspaceRefs/
);
console.log('PASS duplicate creates new refs on same fileIds instead of copying old refIds');

assert.match(
  source,
  /window\.NSOfficeV1\s*=\s*\{[\s\S]*removeObject,/
);
console.log('PASS public Office removeObject uses lifecycle-aware implementation');

console.log('DOCUMENTS WORKSPACE FILE LIFECYCLE V1: PASS');
