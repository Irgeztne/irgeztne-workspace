'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const main = fs.readFileSync(path.join(ROOT, 'main.js'), 'utf8');
const preload = fs.readFileSync(path.join(ROOT, 'preload.js'), 'utf8');

function between(text, start, end) {
  const a = text.indexOf(start);
  assert.notEqual(a, -1, `Missing start marker: ${start}`);

  const b = text.indexOf(end, a + start.length);
  assert.notEqual(b, -1, `Missing end marker: ${end}`);

  return text.slice(a, b);
}

const handler = between(
  main,
  "ipcMain.handle('ns:storage:workspaceFilePickImport'",
  "\n\nfunction sanitizePlainText"
);

const passport = between(
  main,
  'function publicWorkspaceFilePassport',
  '\nfunction publicWorkspaceFileRef'
);

const publicRef = between(
  main,
  'function publicWorkspaceFileRef',
  '\nfunction cleanWorkspaceFileOpaqueId'
);

const publicResult = between(
  main,
  'function publicWorkspaceFileImportResult',
  "\nipcMain.handle('ns:storage:workspaceFilePickImport'"
);

assert.match(
  handler,
  /assertTrustedSender\(event\)/
);
console.log('PASS trusted sender is required');

const trustedIndex = handler.indexOf('assertTrustedSender(event)');
const ownerTypeIndex = handler.indexOf('cleanWorkspaceFileToken(');
const ownerIdIndex = handler.indexOf('cleanWorkspaceFileOwnerId(');
const dialogIndex = handler.indexOf('dialog.showOpenDialog(');

assert.ok(trustedIndex !== -1 && trustedIndex < dialogIndex);
assert.ok(ownerTypeIndex !== -1 && ownerTypeIndex < dialogIndex);
assert.ok(ownerIdIndex !== -1 && ownerIdIndex < dialogIndex);
console.log('PASS context validation happens before system picker');

assert.match(
  handler,
  /properties:\s*\[\s*'openFile'\s*\]/
);
assert.doesNotMatch(
  handler,
  /properties:\s*\[[^\]]*(openDirectory|multiSelections)/
);
console.log('PASS picker is single-file only');

assert.match(
  preload,
  /workspaceFilePickImport:\s*\(payload\)\s*=>\s*ipcRenderer\.invoke\('ns:storage:workspaceFilePickImport',\s*payload\)/
);
console.log('PASS preload exposes one narrow Workspace file capability');

for (const forbidden of [
  'filePath',
  'filePaths',
  'sourcePath',
  'storageRelpath',
  'rootDir'
]) {
  assert.equal(
    publicResult.includes(forbidden),
    false,
    `Public import result leaks internal field: ${forbidden}`
  );
  assert.equal(
    passport.includes(forbidden),
    false,
    `Public file passport leaks internal field: ${forbidden}`
  );
  assert.equal(
    publicRef.includes(forbidden),
    false,
    `Public file ref leaks internal field: ${forbidden}`
  );
}
console.log('PASS public import result does not expose filesystem paths');

assert.match(
  publicResult,
  /publicWorkspaceFilePassport\(result && result\.file\)/
);
assert.match(
  publicResult,
  /publicWorkspaceFileRef\(result && result\.ref\)/
);

assert.match(passport, /fileId:/);
assert.match(passport, /blobId:/);
assert.match(passport, /sizeBytes:/);
assert.match(passport, /sha256:/);

assert.match(publicRef, /refId:/);
assert.match(publicRef, /fileId:/);

console.log('PASS public result exposes safe file identity and metadata through shared DTO helpers');

assert.ok(
  main.includes("error.code = 'WORKSPACE_FILE_INVALID_CONTEXT'"),
  'Workspace file validators must fail closed with WORKSPACE_FILE_INVALID_CONTEXT'
);
assert.match(
  handler,
  /WORKSPACE_FILE_IMPORT_FAILED/
);
console.log('PASS invalid context and import failure are fail-closed');

console.log('WORKSPACE FILE IPC CONTRACT V1: PASS');
