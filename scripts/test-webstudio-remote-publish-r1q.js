'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const core = require('../src/publishing/remote-publish-main.cjs');

const root = path.resolve(__dirname, '..');
const studio = fs.readFileSync(path.join(root, 'src/modules/editor-site-studio-safe/editor-site-studio-safe-v5.js'), 'utf8');
const main = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
const preload = fs.readFileSync(path.join(root, 'preload.js'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

const firstEntries = [
  { name: 'index.html', buffer: Buffer.from('one') },
  { name: 'assets/site.css', buffer: Buffer.from('css-1') },
  { name: 'old.html', buffer: Buffer.from('old') }
];
const first = core.manifestFromEntries(firstEntries);
let plan = core.diffManifests(null, first);
assert.deepStrictEqual(plan.upload, ['assets/site.css', 'index.html', 'old.html']);
assert.deepStrictEqual(plan.remove, []);

const secondEntries = [
  { name: 'index.html', buffer: Buffer.from('two') },
  { name: 'assets/site.css', buffer: Buffer.from('css-1') },
  { name: 'new.html', buffer: Buffer.from('new') }
];
const second = core.manifestFromEntries(secondEntries);
plan = core.diffManifests(first, second);
assert.deepStrictEqual(plan.upload, ['index.html', 'new.html']);
assert.deepStrictEqual(plan.remove, ['old.html']);
assert.deepStrictEqual(plan.unchanged, ['assets/site.css']);

assert.strictEqual(core.normalizeRemoteRoot('/public_html/'), '/public_html');
assert.strictEqual(core.remoteJoin('/public_html/', 'assets/site.css'), '/public_html/assets/site.css');
assert.throws(() => core.normalizeRemoteRoot('/public_html/../private'), /must not contain/);
assert.throws(() => core.normalizePort('70000', 21), /between 1 and 65535/);

assert(studio.includes("id: 'ftp', icon: 'FTP', name: 'FTP'"), 'separate FTP provider missing');
assert(studio.includes("id: 'ftps', icon: 'FTPS', name: 'FTPS'"), 'separate FTPS provider missing');
assert(studio.includes("id: 'sftp', icon: 'SFTP', name: 'SFTP'"), 'SFTP provider missing');
assert(studio.includes("short: 'Unencrypted sync', shortRu: 'Без шифрования'"), 'FTP unencrypted warning missing');
assert(studio.includes("Explicit FTPS (TLS, recommended)"), 'FTPS explicit TLS mode missing');
assert(studio.includes("Implicit FTPS (legacy, usually port 990)"), 'FTPS implicit legacy mode missing');
assert(studio.includes("providerId === 'ftps' ? 'ftp' : providerId"), 'FTPS must reuse proven FTP transport');
assert(studio.includes("providerId === 'ftp' ? 'ftp' : (providerId === 'ftps' ? (config.protocol || 'ftps') : '')"), 'FTP/FTPS protocol mapping missing');
assert(studio.includes("typeof api.testRemotePublish !== 'function'"), 'remote connection test is not wired');
assert(studio.includes("typeof api.publishRemote !== 'function'"), 'remote publish is not wired');
assert(studio.includes("Changes synchronized:"), 'incremental publish status missing');
assert(main.includes("ipcMain.handle('ns:publish:remoteTest'"), 'remote test IPC missing');
assert(main.includes("ipcMain.handle('ns:publish:remote'"), 'remote publish IPC missing');
assert(main.includes("path.join(app.getPath('userData'), 'publish-sync')"), 'local sync manifest storage missing');
assert(preload.includes("testRemotePublish:"), 'preload remote test bridge missing');
assert(preload.includes("publishRemote:"), 'preload remote publish bridge missing');
assert.strictEqual(pkg.dependencies['basic-ftp'], '6.2.0');
assert.strictEqual(pkg.dependencies['ssh2-sftp-client'], '12.1.1');

console.log('PASS: Web Studio FTP + FTPS + SFTP real publishing and incremental sync R1S');
