'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { pathToFileURL, fileURLToPath } = require('node:url');
const FORMAT = 'irgeztne.workspace.bundle';
const MAX_BYTES = 256 * 1024 * 1024;
// Ordinary workspace backup is intentionally separate from Account, Chat,
// provider credentials, keyring data and recovery material.
const MODULES = new Set(['files.library.v1','workspace.projects.v1','workspace.tasks.v1',
  'workspace.notes.v1','workspace.knowledge.v1','workspace.knowledge-packs.v1',
  'workspace.editor.v1','workspace.editor.backup.v1','workspace.site-pages.v1',
  'workspace.site-pages.legacy.v1','workspace.site-profile.v1','workspace.vitrina.v1',
  'workspace.map.pins.v1','workspace.workshop.installed.v1','workspace.codehub.v1','office.documents.v1','webstudio.siteManager.v1']);
const LOCAL_KEYS = new Set(['irgeztne.workspace.identity.v0','nsbrowser:v8:source-library',
  'ns.browser.v8.projects.v1','irgeztne.workspace.tasks.v1','ns.browser.v8.notes.v1',
  'irgeztne.documents.v1','irgeztne.sitePages.v0','irgeztne.webStudioSites.v1',
  'irgeztne.editorSiteStudioSafe.v4','irgeztne:map:v1:pins','ns.browser.v8.editor.v1',
  'ns.browser.v8.editor.v1.backup','nsbrowser:v1:codehub-items','nsbrowser:v1:knowledge-packs',
  'nsbrowser:v8:knowledge-library','ns.browser.v8.tools.v1','ns.browser.v8.vitrina.v1',
  'ns.browser.v8.site-profile.v1','nsbrowser.v8.bookmarks','nsbrowser.v8.language',
  'nsbrowser.v8.browser.source','irgeztne-workshop-installed-v1']);
const TABLES = ['module_state','webstudio_sites','webstudio_pages','workspace_file_blobs','workspace_files','workspace_file_refs'];
const SECRET = /^(token|password|privateKey|secretKey|accessKey|recoveryPhrase|masterCredential|credential|refreshToken|accessToken|authorization|hasToken|hasPassword|hasPrivateKey|hasSecretKey|hasAccessKey|tokenPreview|passwordPreview|secretKeyPreview|accessKeyPreview)$/i;
function clean(value) {
  if (Array.isArray(value)) return value.map(clean);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).filter(([k]) => !SECRET.test(k) && !['__proto__','constructor','prototype'].includes(k)).map(([k,v]) => [k, clean(v)]));
  }
  return value;
}
function localStorageClean(storage) {
  const out = {};
  for (const [k,v] of Object.entries(storage || {})) if (LOCAL_KEYS.has(k)) {
    try { out[k] = JSON.stringify(clean(JSON.parse(String(v)))); }
    catch { out[k] = String(v); }
  }
  return out;
}
function digest(bytes) { return crypto.createHash('sha256').update(bytes).digest('hex'); }
function validPath(rel) {
  return typeof rel === 'string' && rel.length < 500 && !rel.includes('\\') && !rel.includes('\0') &&
    !rel.split('/').some(p => !p || p === '.' || p === '..') &&
    (/^(webstudio-media|files\/blobs|pages)\//.test(rel) || ['notes.json','drafts.json','pages.json','vitrina-registry.json'].includes(rel));
}
function remap(value, oldDir, newDir) {
  if (typeof value === 'string') {
    const oldURL = pathToFileURL(oldDir + path.sep).href;
    return value.split(oldURL).join(pathToFileURL(newDir + path.sep).href).split(oldDir + path.sep).join(newDir + path.sep);
  }
  if (Array.isArray(value)) return value.map(v => remap(v, oldDir, newDir));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k,v]) => [k,remap(v,oldDir,newDir)]));
  return value;
}
function checkReferences(value, origin, assets) {
  if (typeof value === 'string') {
    for (const match of value.matchAll(/file:\/\/[^\s"'<>\\)]+/g)) {
      const target = fileURLToPath(match[0]);
      const rel = path.relative(origin, target).split(path.sep).join('/');
      if (!validPath(rel) || !assets.has(rel)) throw new Error('Local asset is missing or outside managed workspace storage: ' + rel);
    }
  } else if (Array.isArray(value)) value.forEach(v => checkReferences(v,origin,assets));
  else if (value && typeof value === 'object') Object.values(value).forEach(v => checkReferences(v,origin,assets));
}
function exportBundle(db, dataDir, storage = {}) {
  const bundle = { format: FORMAT, version: 2, createdAt: new Date().toISOString(), origin: dataDir, storage: localStorageClean(storage), tables: {}, assets: [] };
  for (const table of TABLES) {
    bundle.tables[table] = db.prepare('SELECT * FROM ' + table).all().filter(row => table !== 'module_state' || MODULES.has(row.module_id)).map(row => {
      if ('value' in row) return { ...row, value: JSON.stringify(clean(JSON.parse(row.value))) };
      return row;
    });
  }
  let total = 0;
  function include(rel) {
    if (!validPath(rel)) throw new Error('Unsupported backup asset path');
    const file = path.join(dataDir, rel);
    const st = fs.lstatSync(file);
    if (st.isSymbolicLink() || !st.isFile()) throw new Error('Backup refuses symbolic links or non-files: ' + rel);
    total += st.size;
    if (total > MAX_BYTES) throw new Error('Workspace backup exceeds the 256 MiB asset limit; no partial backup was created.');
    const bytes = fs.readFileSync(file);
    bundle.assets.push({ path: rel, size: bytes.length, sha256: digest(bytes), bytes: bytes.toString('base64') });
  }
  function walk(rel) {
    const dir = path.join(dataDir, rel);
    if (!fs.existsSync(dir)) return;
    if (fs.lstatSync(dir).isSymbolicLink()) throw new Error('Backup refuses symbolic links: ' + rel);
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) walk(rel + '/' + entry.name);
      else include(rel + '/' + entry.name);
    }
  }
  for (const rel of ['webstudio-media','files/blobs','pages']) walk(rel);
  for (const rel of ['notes.json','drafts.json','pages.json','vitrina-registry.json']) if (fs.existsSync(path.join(dataDir,rel))) include(rel);
  const assets = new Map(bundle.assets.map(a => [a.path,a]));
  for (const row of bundle.tables.workspace_file_blobs) {
    const rel = row.storage_relpath.startsWith('files/') ? row.storage_relpath : 'files/' + row.storage_relpath;
    const asset = assets.get(rel);
    if (!asset || asset.sha256 !== row.sha256 || asset.size !== row.size_bytes) throw new Error('Missing or damaged Workspace File Store blob: ' + rel);
  }
  checkReferences(bundle.tables, dataDir, assets);
  checkReferences(bundle.storage, dataDir, assets);
  return bundle;
}
function validate(bundle, db) {
  if (!bundle || bundle.format !== FORMAT || bundle.version !== 2 || !path.isAbsolute(bundle.origin || '') || bundle.origin.length < 2 || !bundle.tables || !Array.isArray(bundle.assets)) throw new Error('Unsupported full workspace backup');
  if (bundle.assets.length > 50000) throw new Error('Too many backup assets');
  const seen = new Set(); let total = 0;
  for (const asset of bundle.assets) {
    if (!validPath(asset.path) || seen.has(asset.path) || typeof asset.bytes !== 'string' || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(asset.bytes)) throw new Error('Invalid backup asset');
    seen.add(asset.path); total += asset.size;
    if (!Number.isSafeInteger(asset.size) || asset.size < 0 || total > MAX_BYTES) throw new Error('Invalid backup size');
    const bytes = Buffer.from(asset.bytes,'base64');
    if (bytes.length !== asset.size || digest(bytes) !== asset.sha256) throw new Error('Backup integrity verification failed: ' + asset.path);
  }
  for (const table of TABLES) {
    if (!Array.isArray(bundle.tables[table]) || bundle.tables[table].length > 100000) throw new Error('Invalid backup table: ' + table);
    const cols = db.prepare('PRAGMA table_info(' + table + ')').all().map(c => c.name);
    for (const row of bundle.tables[table]) {
      if (!row || Object.keys(row).length !== cols.length || !cols.every(c => Object.hasOwn(row,c))) throw new Error('Invalid backup row: ' + table);
      if (table === 'module_state' && !MODULES.has(row.module_id)) throw new Error('Backup contains a protected module');
      if ('value' in row) JSON.parse(row.value);
    }
  }
  const assets = new Map(bundle.assets.map(a => [a.path,a]));
  for (const row of bundle.tables.workspace_file_blobs) {
    const rel = row.storage_relpath.startsWith('files/') ? row.storage_relpath : 'files/' + row.storage_relpath;
    const a = assets.get(rel);
    if (!a || a.sha256 !== row.sha256 || a.size !== row.size_bytes) throw new Error('Backup blob metadata mismatch');
  }
  checkReferences(bundle.tables, bundle.origin, assets);
  checkReferences(bundle.storage, bundle.origin, assets);
}
function restoreBundle(db, dataDir, bundle) {
  validate(bundle, db); // No writes before all byte hashes and paths have passed.
  const stage = fs.mkdtempSync(path.join(dataDir,'.workspace-restore-'));
  const changed = [];
  try {
    for (const a of bundle.assets) {
      const temp = path.join(stage,'new',a.path); fs.mkdirSync(path.dirname(temp),{recursive:true});
      let bytes = Buffer.from(a.bytes,'base64');
      if (['notes.json','drafts.json','pages.json','vitrina-registry.json'].includes(a.path)) bytes = Buffer.from(JSON.stringify(remap(JSON.parse(bytes.toString('utf8')),bundle.origin,dataDir)));
      else if (/^pages\/.*\.html?$/.test(a.path)) bytes = Buffer.from(remap(bytes.toString('utf8'),bundle.origin,dataDir));
      fs.writeFileSync(temp,bytes,{mode:0o600,flag:'wx'});
      const dest = path.join(dataDir,a.path);
      // Refuse symlink traversal in the existing target profile too.
      for (let parent = path.dirname(dest); parent !== dataDir; parent = path.dirname(parent)) if (fs.existsSync(parent) && fs.lstatSync(parent).isSymbolicLink()) throw new Error('Unsafe restore destination');
      if (fs.existsSync(dest) && fs.lstatSync(dest).isSymbolicLink()) throw new Error('Unsafe restore destination');
    }
    db.transaction(() => {
      for (const a of bundle.assets) {
        const dest = path.join(dataDir,a.path); const previous = path.join(stage,'old',a.path);
        fs.mkdirSync(path.dirname(dest),{recursive:true});
        const hadPrevious = fs.existsSync(dest);
        if (hadPrevious) { fs.mkdirSync(path.dirname(previous),{recursive:true}); fs.renameSync(dest,previous); }
        changed.push({dest,previous,hadPrevious});
        fs.renameSync(path.join(stage,'new',a.path),dest);
      }
      for (const table of [...TABLES].reverse()) {
        if (table === 'module_state') for (const id of MODULES) db.prepare('DELETE FROM module_state WHERE module_id=?').run(id);
        else db.prepare('DELETE FROM ' + table).run();
      }
      for (const table of TABLES) for (const source of bundle.tables[table]) {
        const row = { ...source };
        if ('value' in row) row.value = JSON.stringify(remap(clean(JSON.parse(row.value)),bundle.origin,dataDir));
        const cols = Object.keys(row);
        db.prepare('INSERT INTO ' + table + '(' + cols.join(',') + ') VALUES (' + cols.map(() => '?').join(',') + ')').run(...cols.map(k => row[k]));
      }
    })();
    const storage = localStorageClean(bundle.storage);
    for (const k of Object.keys(storage)) storage[k] = remap(storage[k],bundle.origin,dataDir);
    return { ok:true, storage, assets:bundle.assets.length };
  } catch (error) {
    for (const c of changed.reverse()) { if (fs.existsSync(c.dest)) fs.unlinkSync(c.dest); if (c.hadPrevious) fs.renameSync(c.previous,c.dest); }
    throw error;
  } finally { fs.rmSync(stage,{recursive:true,force:true}); }
}
function registerWorkspaceBackupIpc({ ipcMain, dialog, BrowserWindow, assertTrustedSender, getStorageCore }) {
  ipcMain.handle('ns:workspace:backupExport', async (event,payload={}) => {
    try {
      assertTrustedSender(event);
      const bundle = getStorageCore().exportWorkspaceBundle(payload.storage);
      const ru = payload.language === 'ru';
      const picked = await dialog.showSaveDialog(BrowserWindow.fromWebContents(event.sender) || undefined,{title:ru ? 'Экспортировать полный backup' : 'Export full backup',defaultPath:'IRGEZTNE-workspace-backup.json',filters:[{name:'Workspace backup',extensions:['json']}]});
      if (picked.canceled || !picked.filePath) return {ok:false,canceled:true};
      const temp = picked.filePath + '.' + crypto.randomUUID() + '.tmp';
      try { fs.writeFileSync(temp,JSON.stringify(bundle),{mode:0o600,flag:'wx'}); fs.renameSync(temp,picked.filePath); }
      finally { if (fs.existsSync(temp)) fs.unlinkSync(temp); }
      return {ok:true,assets:bundle.assets.length};
    } catch(error) { return {ok:false,error:error.message}; }
  });
  ipcMain.handle('ns:workspace:backupImport', async (event,payload={}) => {
    try {
      assertTrustedSender(event);
      const owner = BrowserWindow.fromWebContents(event.sender) || undefined;
      const ru = payload.language === 'ru';
      const picked = await dialog.showOpenDialog(owner,{properties:['openFile'],filters:[{name:'Workspace backup',extensions:['json']}]});
      if (picked.canceled || !picked.filePaths[0]) return {ok:false,canceled:true};
      if (fs.statSync(picked.filePaths[0]).size > MAX_BYTES * 1.5) throw new Error('Backup file exceeds the supported size');
      const bundle = JSON.parse(fs.readFileSync(picked.filePaths[0],'utf8'));
      const core = getStorageCore(); core.validateWorkspaceBundle(bundle);
      const confirm = await dialog.showMessageBox(owner,{type:'warning',buttons:ru ? ['Отмена','Восстановить'] : ['Cancel','Restore'],defaultId:0,cancelId:0,message:ru ? 'Восстановить workspace из backup?' : 'Restore workspace backup?',detail:ru ? 'Данные workspace будут заменены. Перед восстановлением полная копия текущего workspace сохранится в data/backups. Account и Chat сохраняются отдельно и не восстанавливаются из этого backup.' : 'Workspace data will be replaced. A full copy of the current workspace will be saved in data/backups before restoration. Account and Chat are separate and are not restored.'});
      if (confirm.response !== 1) return {ok:false,canceled:true};
      const before = core.exportWorkspaceBundle(payload.storage);
      const dir = path.join(core.status().dataDir,'backups'); fs.mkdirSync(dir,{recursive:true});
      fs.writeFileSync(path.join(dir,'before-restore-'+Date.now()+'.json'),JSON.stringify(before),{flag:'wx',mode:0o600});
      return core.restoreWorkspaceBundle(bundle);
    } catch(error) { return {ok:false,error:error.message}; }
  });
}
module.exports = { exportBundle, restoreBundle, validate, registerWorkspaceBackupIpc, localStorageClean };
