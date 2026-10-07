'use strict';

const assert = require('assert/strict');
const fs = require('fs');

const main = fs.readFileSync('main.js', 'utf8');
const preload = fs.readFileSync('preload.js', 'utf8');
const js = fs.readFileSync('src/modules/documents/documents-v0.js', 'utf8');
const css = fs.readFileSync('src/modules/documents/documents-v0.css', 'utf8');

function between(text, start, end) {
  const a = text.indexOf(start);
  assert.notEqual(a, -1, `Missing start marker: ${start}`);
  const b = text.indexOf(end, a + start.length);
  assert.notEqual(b, -1, `Missing end marker: ${end}`);
  return text.slice(a, b);
}

assert(main.includes('// IRGEZTNE_WORKSPACE_FILE_OPEN_R1N'));
assert(preload.includes('// IRGEZTNE_WORKSPACE_FILE_OPEN_R1N'));
assert(js.includes('// IRGEZTNE_WORKSPACE_FILE_OPEN_R1N'));
assert(css.includes('IRGEZTNE_WORKSPACE_FILE_OPEN_R1N'));
console.log('PASS R1N owners are present');

const handler = between(
  main,
  "ipcMain.handle('ns:storage:workspaceFileOpen'",
  "\nipcMain.handle('ns:storage:workspaceFileAttach'"
);

assert.match(handler, /assertTrustedSender\(event\)/);
assert.match(handler, /cleanWorkspaceFileOpaqueId\([\s\S]*payload\.fileId/);
assert.match(handler, /getWorkspaceFile\(fileId\)/);
console.log('PASS open IPC accepts only a validated File Store id from trusted Workspace');

assert.match(handler, /path\.resolve\([\s\S]*DATA_DIR/);
assert.match(handler, /startsWith\(dataRoot \+ path\.sep\)/);
assert.match(handler, /getWorkspaceFileOpenTempDir\(\)/);
assert.match(handler, /fsp\.copyFile\(sourcePath, target\)/);
assert.match(handler, /shell\.openPath\(target\)/);
assert.equal(/payload\.(?:path|filePath|sourcePath|storageRelpath)/.test(handler), false);
console.log('PASS renderer cannot supply an arbitrary filesystem path');

for (const safe of ['md', 'pdf', 'png', 'zip', 'docx', 'xlsx', 'pptx']) {
  assert(handler.includes(`'${safe}'`), `Missing safe open type ${safe}`);
}
for (const forbidden of ['html', 'svg', 'js', 'sh', 'exe', 'deb', 'appimage']) {
  assert.equal(
    new RegExp(`['\"]${forbidden}['\"]`).test(handler),
    false,
    `Executable/active type should not be allowlisted: ${forbidden}`
  );
}
assert.match(handler, /WORKSPACE_FILE_OPEN_REQUIRES_SAVE/);
console.log('PASS passive document/image/archive allowlist is fail-closed');

assert.match(
  preload,
  /workspaceFileOpen:\s*\(fileId\)\s*=>\s*ipcRenderer\.invoke\('ns:storage:workspaceFileOpen',\s*\{\s*fileId\s*\}\)/
);
assert.equal(/workspaceFileOpen:\s*\([^)]*path/.test(preload), false);
console.log('PASS preload exposes narrow fileId-only open bridge');

assert(js.includes('data-documents-action="open-workspace-file-ref"'));
assert(js.includes("t('Открыть', 'Open')"));
assert(js.includes('async function openWorkspaceAttachment(refId)'));
assert(js.includes('api.workspaceFileOpen(attachmentRef.fileId)'));
assert(js.includes("if (action === 'open-workspace-file-ref')"));
console.log('PASS every current Workspace attachment gets an Open action');

assert(css.includes('.ns-documents-v1__workspace-file-open'));
console.log('PASS Open action has bounded attachment-pill geometry');

assert(main.includes('clearWorkspaceFileOpenTempDir();'));
assert(main.includes("app.on('before-quit'"));
console.log('PASS private temporary open copies are cleaned up');

console.log('DOCUMENTS WORKSPACE FILE OPEN R1N: PASS');
