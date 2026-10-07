'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'irgeztne-backup-ipc-'));
(async () => {
  try {
    const source = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
    const registration = source.match(/^require\('\.\/src\/storage\/workspace-backup-main\.cjs'\)\.registerWorkspaceBackupIpc\([^\n]+\);$/m);
    assert.ok(registration, 'production main must register native backup handlers');
    const handlers = new Map();
    let trusted = true;
    let canceled = false;
    let dialogs = 0;
    const file = path.join(temp, 'backup.json');
    const bundle = { format: 'irgeztne.workspace.bundle', version: 2, assets: [] };
    vm.runInNewContext(registration[0], {
      require: p => require(path.resolve(root, p)),
      ipcMain: { handle: (channel, handler) => { assert.equal(handlers.has(channel), false); handlers.set(channel, handler); } },
      dialog: { showSaveDialog: async () => { dialogs++; return { canceled, filePath: file }; } },
      BrowserWindow: { fromWebContents: () => undefined },
      assertTrustedSender: () => { if (!trusted) throw new Error('Untrusted sender'); },
      getIRGEZTNEStorageCore: () => ({ exportWorkspaceBundle: () => bundle })
    });
    const preload = fs.readFileSync(path.join(root, 'preload.js'), 'utf8');
    for (const channel of ['ns:workspace:backupExport', 'ns:workspace:backupImport']) {
      assert.equal(typeof handlers.get(channel), 'function');
      assert.ok(preload.includes(channel), 'preload channel must match native handler');
    }
    const exportBackup = handlers.get('ns:workspace:backupExport');
    const event = { sender: {} };
    trusted = false;
    assert.equal((await exportBackup(event)).error, 'Untrusted sender');
    assert.equal(dialogs, 0);
    trusted = true; canceled = true;
    assert.equal((await exportBackup(event)).canceled, true);
    assert.equal(fs.existsSync(file), false);
    canceled = false;
    assert.equal((await exportBackup(event)).ok, true);
    assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), bundle);
    assert.deepEqual(fs.readdirSync(temp), ['backup.json']);
    console.log('PASS: production Main registration, preload channels, trusted sender, canceled export, physical JSON write (mock native dialog; not desktop E2E)');
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
})().catch(error => { console.error(error); process.exitCode = 1; });
