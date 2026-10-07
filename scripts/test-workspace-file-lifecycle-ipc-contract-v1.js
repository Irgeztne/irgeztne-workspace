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

const getHandler = between(
  main,
  "ipcMain.handle('ns:storage:workspaceFileGet'",
  "\nipcMain.handle('ns:storage:workspaceFileAttach'"
);

const attachHandler = between(
  main,
  "ipcMain.handle('ns:storage:workspaceFileAttach'",
  "\nipcMain.handle('ns:storage:workspaceFileRemoveReference'"
);

const removeHandler = between(
  main,
  "ipcMain.handle('ns:storage:workspaceFileRemoveReference'",
  "\n\nfunction sanitizePlainText"
);

for (const [name, handler] of [
  ['get', getHandler],
  ['attach', attachHandler],
  ['remove', removeHandler]
]) {
  assert.match(
    handler,
    /assertTrustedSender\(event\)/
  );
  console.log(`PASS ${name} requires trusted sender`);
}

assert.match(
  getHandler,
  /cleanWorkspaceFileOpaqueId\([\s\S]*payload\.fileId/
);
assert.match(
  attachHandler,
  /cleanWorkspaceFileOpaqueId\([\s\S]*payload\.fileId/
);
assert.match(
  removeHandler,
  /cleanWorkspaceFileOpaqueId\([\s\S]*payload\.refId/
);
console.log('PASS opaque file/reference IDs are validated');

assert.match(
  attachHandler,
  /cleanWorkspaceFileToken\([\s\S]*payload\.ownerType/
);
assert.match(
  attachHandler,
  /cleanWorkspaceFileOwnerId\(payload\.ownerId\)/
);
assert.match(
  attachHandler,
  /cleanWorkspaceFileToken\([\s\S]*payload\.role/
);
console.log('PASS attach validates owner type, owner id and role');

assert.match(
  attachHandler,
  /attachWorkspaceFile\(\{[\s\S]*fileId,[\s\S]*ownerType,[\s\S]*ownerId,[\s\S]*role[\s\S]*\}\)/
);
assert.match(
  removeHandler,
  /removeWorkspaceFileReference\(refId\)/
);
console.log('PASS lifecycle IPC delegates to Storage Core owners');

for (const forbidden of [
  'storageRelpath',
  'sourcePath',
  'filePath',
  'filePaths',
  'rootDir'
]) {
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
console.log('PASS lifecycle DTOs expose no filesystem paths');

assert.match(passport, /fileId:/);
assert.match(passport, /displayName:/);
assert.match(passport, /mimeType:/);
assert.match(passport, /sizeBytes:/);
assert.match(passport, /sha256:/);

assert.match(publicRef, /refId:/);
assert.match(publicRef, /fileId:/);
assert.match(publicRef, /ownerType:/);
assert.match(publicRef, /ownerId:/);
assert.match(publicRef, /role:/);
console.log('PASS lifecycle DTOs expose safe identity and metadata');

assert.match(
  preload,
  /workspaceFileGet:\s*\(fileId\)\s*=>\s*ipcRenderer\.invoke\('ns:storage:workspaceFileGet',\s*\{\s*fileId\s*\}\)/
);
assert.match(
  preload,
  /workspaceFileAttach:\s*\(payload\)\s*=>\s*ipcRenderer\.invoke\('ns:storage:workspaceFileAttach',\s*payload\)/
);
assert.match(
  preload,
  /workspaceFileRemoveReference:\s*\(refId\)\s*=>\s*ipcRenderer\.invoke\('ns:storage:workspaceFileRemoveReference',\s*\{\s*refId\s*\}\)/
);
console.log('PASS preload exposes only narrow lifecycle capabilities');

assert.match(
  getHandler,
  /WORKSPACE_FILE_NOT_FOUND/
);
assert.match(
  attachHandler,
  /WORKSPACE_FILE_ATTACH_FAILED/
);
assert.match(
  removeHandler,
  /WORKSPACE_FILE_REMOVE_FAILED/
);
console.log('PASS lifecycle failures are fail-closed');

console.log('WORKSPACE FILE LIFECYCLE IPC CONTRACT V1: PASS');
