process.env.ELECTRON_DISABLE_SANDBOX = '1';
const { app, BrowserWindow, Menu, ipcMain, shell, dialog, safeStorage } = require('electron');
const { spawn, spawnSync } = require('child_process');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const fsp = fs.promises;
const { pathToFileURL } = require('url');
const { createStorageCore } = require('./src/storage/storage-core-main');

const DATA_DIR = app.isPackaged ? path.join(app.getPath('userData'), 'data') : path.join(__dirname, 'data');
const PAGES_DIR = path.join(DATA_DIR, 'pages');
const TEMPLATES_DIR = path.join(__dirname, 'templates');
const INDEX_FILE = path.join(__dirname, 'index.html');
const INDEX_URL = pathToFileURL(INDEX_FILE).toString();

function resolveIRGEZTNEAppIconPath() {
  const candidates = [
    path.join(__dirname, 'build', 'icons', '512x512.png'),
    path.join(__dirname, 'build', 'icons', '256x256.png'),
    path.join(__dirname, 'build', 'icon.png'),
    path.join(__dirname, 'assets', 'branding', 'app-mark.png')
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || undefined;
}

try {
  app.setName('IRGEZTNE Workspace');
}
catch {}


function getAppIconPath() {
  const candidates = [
    path.join(__dirname, 'build', 'icons', '256x256.png'),
    path.join(__dirname, 'build', 'icons', '512x512.png'),
    path.join(__dirname, 'build', 'icon.png'),
    path.join(__dirname, 'build', 'icon.ico'),
    path.join(__dirname, 'assets', 'branding', 'app-mark.svg')
  ];

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch (_) {
      // ignore unavailable icon candidate
    }
  }

  return undefined;
}


function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function ensureJsonFile(filePath, fallback) {
  ensureDir(path.dirname(filePath));
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(fallback, null, 2), 'utf8');
    return;
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    JSON.parse(raw || JSON.stringify(fallback));
  } catch {
    fs.writeFileSync(filePath, JSON.stringify(fallback, null, 2), 'utf8');
  }
}

function readJson(filePath, fallback) {
  ensureJsonFile(filePath, fallback);
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}

async function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  await fsp.writeFile(filePath, JSON.stringify(value, null, 2), 'utf8');
}

function getNotesPath() {
  return path.join(DATA_DIR, 'notes.json');
}

function getDraftsPath() {
  return path.join(DATA_DIR, 'drafts.json');
}

function getPagesPath() {
  return path.join(DATA_DIR, 'pages.json');
}

function getVitrinaRegistryPath() {
  return path.join(DATA_DIR, 'vitrina-registry.json');
}

function getPreviewsDir() {
  return path.join(DATA_DIR, 'previews');
}

function getExportsDir() {
  return path.join(DATA_DIR, 'exports');
}

function getTemplatesDir() {
  return TEMPLATES_DIR;
}

function isTrustedSender(event) {
  const senderUrl = String(event?.senderFrame?.url || event?.sender?.getURL?.() || '');
  return senderUrl === INDEX_URL;
}

function assertTrustedSender(event) {
  if (!isTrustedSender(event)) {
    throw new Error('Blocked IPC from untrusted sender');
  }
}


// preview.4 v7g4 step2 — Storage Core IPC for app preferences/layout.
// This is intentionally limited to app preferences, layout and generic module state.
// Web Studio state and provider tokens are not migrated in this step.
let irgeztneStorageCoreInstance = null;

function getIRGEZTNEStorageCore() {
  if (!irgeztneStorageCoreInstance) {
    irgeztneStorageCoreInstance = createStorageCore({
      app,
      dataDir: DATA_DIR,
      safeStorage
    });
  }
  return irgeztneStorageCoreInstance;
}

function runStorageCoreRequest(event, fallback, fn) {
  try {
    assertTrustedSender(event);
    return fn(getIRGEZTNEStorageCore());
  } catch (error) {
    console.warn('[IRGEZTNE Storage Core]', error && error.message ? error.message : error);
    return fallback;
  }
}

ipcMain.handle('ns:storage:status', async (event) => runStorageCoreRequest(event, { ok: false }, (storage) => storage.status()));

ipcMain.on('ns:storage:getPreferenceSync', (event, payload = {}) => {
  event.returnValue = runStorageCoreRequest(event, payload.fallback, (storage) => storage.getPreference(payload.key, payload.fallback));
});

ipcMain.handle('ns:storage:setPreference', async (event, payload = {}) => runStorageCoreRequest(event, { ok: false }, (storage) => storage.setPreference(payload.key, payload.value)));

ipcMain.on('ns:storage:getLayoutSync', (event, payload = {}) => {
  event.returnValue = runStorageCoreRequest(event, payload.fallback, (storage) => storage.getLayout(payload.key, payload.fallback));
});

ipcMain.handle('ns:storage:setLayout', async (event, payload = {}) => runStorageCoreRequest(event, { ok: false }, (storage) => storage.setLayout(payload.key, payload.value)));

ipcMain.on('ns:storage:getModuleStateSync', (event, payload = {}) => {
  event.returnValue = runStorageCoreRequest(event, payload.fallback, (storage) => storage.getModuleState(payload.moduleId, payload.fallback));
});

ipcMain.handle('ns:storage:setModuleState', async (event, payload = {}) => runStorageCoreRequest(event, { ok: false }, (storage) => storage.setModuleState(payload.moduleId, payload.value)));

ipcMain.on('ns:storage:setModuleStateSync', (event, payload = {}) => {
  event.returnValue = runStorageCoreRequest(event, { ok: false }, (storage) => storage.setModuleState(payload.moduleId, payload.value));
});

// preview.4 v7g4 step4A — Storage Core encrypted secret IPC only.
// This step intentionally does not touch Web Studio UI or publish logic.
ipcMain.handle('ns:storage:secretSave', async (event, payload = {}) => runStorageCoreRequest(event, { ok: false }, (storage) => storage.saveSecret(payload.scope, payload.key, payload.value)));

ipcMain.on('ns:storage:secretHasSync', (event, payload = {}) => {
  event.returnValue = runStorageCoreRequest(event, false, (storage) => storage.hasSecret(payload.scope, payload.key));
});

ipcMain.on('ns:storage:secretPreviewSync', (event, payload = {}) => {
  event.returnValue = runStorageCoreRequest(event, '', (storage) => storage.previewSecret(payload.scope, payload.key));
});

ipcMain.on('ns:storage:secretReadSync', (event, payload = {}) => {
  event.returnValue = runStorageCoreRequest(event, '', (storage) => storage.readSecret(payload.scope, payload.key));
});

ipcMain.handle('ns:storage:secretClear', async (event, payload = {}) => runStorageCoreRequest(event, { ok: false }, (storage) => storage.clearSecret(payload.scope, payload.key)));


function sanitizePlainText(value, maxLength = 2_000_000) {
  const text = typeof value === 'string' ? value : '';
  return text.slice(0, maxLength);
}

function sanitizeSlug(value) {
  return String(value || 'page')
    .toLowerCase()
    .replace(/[^a-z0-9а-яё_-]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'page';
}

function sanitizeFileName(value, fallback = 'file.txt') {
  const raw = String(value || '').trim();
  if (!raw) return fallback;
  const cleaned = raw.replace(/[\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim();
  return cleaned || fallback;
}

function sanitizeTemplateFileName(value, fallback = 'template.json') {
  const base = sanitizeSlug(value || '').replace(/[^a-z0-9_-]+/g, '-');
  return `${base || 'template'}.json`;
}

function normalizeTemplateRecord(input, fileName = '') {
  const source = input && typeof input === 'object' ? input : {};
  const template = source.template && typeof source.template === 'object' ? source.template : source;
  const defaults = template.defaults && typeof template.defaults === 'object' ? template.defaults : {};

  if (!template || !template.id) return null;

  return {
    itemId: String(source.itemId || source.catalogItemId || `catalog-template-${template.id}`),
    templateId: String(source.templateId || template.id),
    name: String(source.name || template.name || template.id),
    description: String(source.description || template.description || ''),
    version: String(source.version || '0.1.0'),
    installed: source.installed !== false,
    trust: String(source.trust || 'local-file'),
    fileName: String(fileName || source.fileName || ''),
    template: {
      id: String(template.id),
      name: String(template.name || template.id),
      category: String(template.category || 'website'),
      description: String(template.description || source.description || ''),
      defaults: {
        kicker: String(defaults.kicker || template.name || source.name || 'Template'),
        title: String(defaults.title || `Untitled ${template.name || source.name || 'Template'}`),
        author: String(defaults.author || 'NS Desk'),
        summary: String(defaults.summary || source.description || ''),
        excerpt: String(defaults.excerpt || defaults.summary || source.description || ''),
        seoTitle: String(defaults.seoTitle || defaults.title || `Untitled ${template.name || source.name || 'Template'}`),
        seoDescription: String(defaults.seoDescription || defaults.summary || source.description || ''),
        keywords: Array.isArray(defaults.keywords) ? defaults.keywords.slice() : [],
        visualHtml: String(defaults.visualHtml || ''),
        markdown: String(defaults.markdown || ''),
        blocks: Array.isArray(defaults.blocks) ? defaults.blocks.slice() : [],
        tags: Array.isArray(defaults.tags) ? defaults.tags.slice() : []
      }
    }
  };
}

function loadTemplateFilesFromDisk() {
  ensureDir(getTemplatesDir());
  const entries = fs.readdirSync(getTemplatesDir(), { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.json'))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  return files.map((fileName) => {
    const filePath = path.join(getTemplatesDir(), fileName);
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(raw);
      const normalized = normalizeTemplateRecord(parsed, fileName);
      return normalized;
    } catch (error) {
      console.warn('[templates] failed to read', fileName, error);
      return null;
    }
  }).filter(Boolean);
}

async function saveTemplateFileToDisk(payload) {
  const normalized = normalizeTemplateRecord(payload);
  if (!normalized) {
    throw new Error('Template payload is invalid');
  }

  ensureDir(getTemplatesDir());

  const explicitFileName = String(payload?.fileName || '').trim();
  const targetFileName = sanitizeTemplateFileName(
    explicitFileName.replace(/\.json$/i, '') || normalized.template.templateId || normalized.name,
    'template.json'
  );
  const targetPath = path.join(getTemplatesDir(), targetFileName);

  const next = {
    itemId: normalized.itemId,
    templateId: normalized.templateId,
    name: normalized.name,
    description: normalized.description,
    version: normalized.version,
    installed: normalized.installed,
    trust: normalized.trust,
    template: normalized.template
  };

  await fsp.writeFile(targetPath, JSON.stringify(next, null, 2), 'utf8');

  return {
    ok: true,
    fileName: targetFileName,
    filePath: targetPath,
    templateId: normalized.templateId,
    itemId: normalized.itemId
  };
}


const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function getDosDateTime(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const dosTime = ((date.getHours() & 0x1f) << 11) |
    ((date.getMinutes() & 0x3f) << 5) |
    (Math.floor(date.getSeconds() / 2) & 0x1f);
  const dosDate = (((year - 1980) & 0x7f) << 9) |
    ((month & 0x0f) << 5) |
    (day & 0x1f);
  return { dosDate, dosTime };
}

function normalizeZipEntryName(value) {
  return String(value || '')
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .replace(/\.\.(\/|$)/g, '')
    .trim();
}

function createStoredZipBuffer(entries) {
  const localParts = [];
  const centralParts = [];
  const now = new Date();
  const { dosDate, dosTime } = getDosDateTime(now);
  let offset = 0;

  const safeEntries = Array.isArray(entries) ? entries : [];
  for (const entry of safeEntries) {
    const name = normalizeZipEntryName(entry && entry.name);
    if (!name) continue;

    const fileName = Buffer.from(name, 'utf8');
    const content = entry && entry.contentBase64
      ? Buffer.from(String(entry.contentBase64 || ''), 'base64')
      : Buffer.from(String(entry && entry.content !== undefined ? entry.content : ''), 'utf8');
    const crc = crc32(content);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(dosTime, 10);
    localHeader.writeUInt16LE(dosDate, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(content.length, 18);
    localHeader.writeUInt32LE(content.length, 22);
    localHeader.writeUInt16LE(fileName.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localParts.push(localHeader, fileName, content);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(dosTime, 12);
    centralHeader.writeUInt16LE(dosDate, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(content.length, 20);
    centralHeader.writeUInt32LE(content.length, 24);
    centralHeader.writeUInt16LE(fileName.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    centralParts.push(centralHeader, fileName);

    offset += localHeader.length + fileName.length + content.length;
  }

  const centralOffset = offset;
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const entryCount = centralParts.length / 2;

  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entryCount, 8);
  end.writeUInt16LE(entryCount, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(centralOffset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, ...centralParts, end]);
}

function getExportZipDefaultPath(payload) {
  const baseName = sanitizeFileName(
    payload?.fileName || payload?.slug || payload?.title || 'site-export',
    'site-export'
  ).replace(/\.zip$/i, '') || 'site-export';

  const downloadsDir = app.getPath('downloads') || getExportsDir();
  return path.join(downloadsDir, `${baseName}.zip`);
}

function normalizePackageEntryContent(value, fallback = '') {
  if (value && typeof value === 'object' && !Buffer.isBuffer(value)) {
    if (value.contentBase64) {
      return {
        contentBase64: String(value.contentBase64 || ''),
        mimeType: String(value.mimeType || '')
      };
    }
    if (Object.prototype.hasOwnProperty.call(value, 'content')) {
      return {
        content: sanitizePlainText(value.content, 8_000_000),
        mimeType: String(value.mimeType || '')
      };
    }
  }
  return { content: sanitizePlainText(value === undefined || value === null ? fallback : value, 8_000_000) };
}

function buildPackageEntries(packageFiles, requiredFiles = []) {
  const source = packageFiles && typeof packageFiles === 'object' ? packageFiles : {};
  const entryNames = new Set(requiredFiles);
  Object.keys(source).forEach((name) => entryNames.add(name));

  const entries = [];
  for (const rawName of entryNames) {
    const name = normalizeZipEntryName(rawName);
    if (!name || name.endsWith('/')) continue;
    entries.push({
      name,
      ...normalizePackageEntryContent(source[rawName], '')
    });
  }
  return entries;
}

async function writePackageFilesToDir(packageFiles, targetDir, requiredFiles = []) {
  const entries = buildPackageEntries(packageFiles, requiredFiles);
  for (const entry of entries) {
    const safeName = normalizeZipEntryName(entry.name);
    if (!safeName) continue;
    const target = path.join(targetDir, safeName);
    if (!target.startsWith(targetDir)) continue;
    ensureDir(path.dirname(target));
    const content = entry.contentBase64
      ? Buffer.from(String(entry.contentBase64 || ''), 'base64')
      : Buffer.from(String(entry.content || ''), 'utf8');
    await fsp.writeFile(target, content);
  }
  return entries.map((entry) => entry.name);
}

async function writeExportZipPackage(payload, targetPath) {
  const packageFiles = payload && payload.package && typeof payload.package === 'object' ? payload.package : {};
  const zipPath = targetPath && String(targetPath).trim()
    ? String(targetPath)
    : getExportZipDefaultPath(payload);
  const finalZipPath = /\.zip$/i.test(zipPath) ? zipPath : `${zipPath}.zip`;

  const entries = buildPackageEntries(packageFiles, [
    'index.html',
    'styles.css',
    'content/page.json',
    'meta.json'
  ]);
  if (!entries.some((entry) => entry.name === 'index.html')) {
    entries.unshift({ name: 'index.html', content: '<!doctype html><html><body><h1>Empty export</h1></body></html>' });
  }

  ensureDir(path.dirname(finalZipPath));
  const zipBuffer = createStoredZipBuffer(entries);
  await fsp.writeFile(finalZipPath, zipBuffer);

  try {
    shell.showItemInFolder(finalZipPath);
  } catch (error) {
    console.warn('Could not reveal exported ZIP:', error);
  }

  return {
    ok: true,
    zipPath: finalZipPath,
    fileName: path.basename(finalZipPath),
    fileSize: zipBuffer.length,
    files: entries.map((entry) => entry.name),
    exportedAt: new Date().toISOString()
  };
}

function netlifyDeployMessage(status, data, fallback = '') {
  const message = data && (data.message || data.error || data.code) ? String(data.message || data.error || data.code) : '';
  return message || fallback || `HTTP ${status}`;
}

function netlifyDeployUrlFromData(data, fallback = '') {
  if (!data || typeof data !== 'object') return fallback || '';
  return String(data.ssl_url || data.deploy_ssl_url || data.url || data.deploy_url || fallback || '');
}

function netlifyDeployStateFromData(data) {
  if (!data || typeof data !== 'object') return '';
  return String(data.state || data.deploy_state || data.site_capabilities?.deploys?.state || '').trim();
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchNetlifyJson(url, options = {}) {
  if (typeof fetch !== 'function') {
    throw new Error('Fetch API is unavailable in this Electron build');
  }

  const response = await fetch(url, options);
  let raw = '';
  let data = null;
  try { raw = await response.text(); } catch {}
  try { data = raw ? JSON.parse(raw) : null; } catch { data = null; }
  return { response, raw, data };
}

async function pollNetlifyDeploy(deployId, token) {
  if (!deployId || !token) return null;

  let last = null;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    if (attempt > 0) await wait(1250);
    try {
      const result = await fetchNetlifyJson(`https://api.netlify.com/api/v1/deploys/${encodeURIComponent(deployId)}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          'User-Agent': 'IRGEZTNE Preview.4'
        }
      });
      if (!result.response.ok) {
        last = result.data || { state: `HTTP ${result.response.status}` };
        continue;
      }
      last = result.data || last;
      const state = netlifyDeployStateFromData(last).toLowerCase();
      if (state === 'ready' || state === 'error' || state === 'failed') break;
    } catch (error) {
      last = { state: 'poll-error', message: error && error.message ? error.message : String(error || 'poll error') };
    }
  }
  return last;
}

async function publishNetlifyZipPackage(payload) {
  const token = sanitizePlainText(payload?.token || '', 20_000).trim();
  const siteId = sanitizePlainText(payload?.siteId || '', 400).trim();
  if (!token) return { ok: false, status: 0, message: 'Missing Netlify token' };
  if (!siteId) return { ok: false, status: 0, message: 'Missing Netlify Site ID' };

  const packageFiles = payload && payload.package && typeof payload.package === 'object' ? payload.package : {};
  const entries = buildPackageEntries(packageFiles, [
    'index.html',
    'styles.css',
    'content/page.json',
    'meta.json'
  ]);
  if (!entries.some((entry) => entry.name === 'index.html')) {
    entries.unshift({ name: 'index.html', content: '<!doctype html><html><body><h1>Empty deploy</h1></body></html>' });
  }

  const zipBuffer = createStoredZipBuffer(entries);
  const endpoint = `https://api.netlify.com/api/v1/sites/${encodeURIComponent(siteId)}/deploys`;
  let result;
  try {
    result = await fetchNetlifyJson(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/zip',
        Accept: 'application/json',
        'User-Agent': 'IRGEZTNE Preview.4'
      },
      body: zipBuffer
    });
  } catch (error) {
    return {
      ok: false,
      status: 0,
      message: error && error.message ? error.message : String(error || 'Netlify network error')
    };
  }

  const { response, data } = result;
  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      message: netlifyDeployMessage(response.status, data)
    };
  }

  const deployId = String(data?.id || data?.deploy_id || '');
  const polled = deployId ? await pollNetlifyDeploy(deployId, token) : null;
  const finalData = polled && typeof polled === 'object' ? { ...data, ...polled } : data;
  const state = netlifyDeployStateFromData(finalData) || netlifyDeployStateFromData(data) || 'created';
  const websiteUrl = netlifyDeployUrlFromData(finalData, payload?.websiteUrl || '');

  return {
    ok: true,
    deployId,
    state,
    websiteUrl,
    adminUrl: String(finalData?.admin_url || data?.admin_url || ''),
    deployUrl: String(finalData?.deploy_ssl_url || finalData?.deploy_url || ''),
    fileName: sanitizeFileName(payload?.fileName || 'irgeztne-site.zip', 'irgeztne-site.zip'),
    fileSize: zipBuffer.length,
    files: entries.map((entry) => entry.name),
    publishedAt: new Date().toISOString()
  };
}


function cloudflareApiMessage(status, data, fallback = '') {
  const errors = Array.isArray(data?.errors) ? data.errors : [];
  const messages = Array.isArray(data?.messages) ? data.messages : [];
  const firstError = errors.find(Boolean) || messages.find(Boolean) || null;
  const text = firstError && (firstError.message || firstError.code)
    ? `${firstError.message || 'Cloudflare API error'}${firstError.code ? ` (${firstError.code})` : ''}`
    : '';
  return text || data?.message || data?.error || fallback || `HTTP ${status}`;
}

async function fetchCloudflareJson(url, token, options = {}) {
  if (typeof fetch !== 'function') {
    throw new Error('Fetch API is unavailable in this Electron build');
  }
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
    'User-Agent': 'IRGEZTNE Preview.4',
    ...(options.headers || {})
  };
  const response = await fetch(url, { ...options, headers });
  let raw = '';
  let data = null;
  try { raw = await response.text(); } catch {}
  try { data = raw ? JSON.parse(raw) : null; } catch { data = null; }
  return { response, raw, data };
}

function normalizeCloudflareProjectName(value) {
  return String(value || '').trim().replace(/^https?:\/\//i, '').replace(/\.pages\.dev.*$/i, '').replace(/[^a-z0-9_-]+/gi, '-').replace(/^-|-$/g, '');
}

function cloudflarePagesUrlFromProject(project, fallback = '') {
  if (project && typeof project === 'object') {
    if (project.subdomain) return String(project.subdomain || '');
    if (project.url) return String(project.url || '');
    if (Array.isArray(project.domains) && project.domains.length) {
      const domain = String(project.domains[0] || '').trim();
      if (domain) return /^https?:\/\//i.test(domain) ? domain : `https://${domain}`;
    }
    if (project.name) return `https://${project.name}.pages.dev`;
  }
  return fallback || '';
}

async function testCloudflarePagesConnection(payload) {
  const token = sanitizePlainText(payload?.token || '', 20_000).trim();
  const accountId = sanitizePlainText(payload?.accountId || '', 400).trim();
  const projectName = normalizeCloudflareProjectName(payload?.projectName || '');
  if (!token) return { ok: false, status: 0, message: 'Missing Cloudflare token' };
  if (!accountId) return { ok: false, status: 0, message: 'Missing Cloudflare Account ID' };
  if (!projectName) return { ok: false, status: 0, message: 'Missing Cloudflare Pages project name' };

  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/pages/projects/${encodeURIComponent(projectName)}`;
  let result;
  try {
    result = await fetchCloudflareJson(endpoint, token, { method: 'GET' });
  } catch (error) {
    return { ok: false, status: 0, message: error && error.message ? error.message : String(error || 'Cloudflare network error') };
  }
  const { response, data } = result;
  if (!response.ok || data?.success === false) {
    return { ok: false, status: response.status, message: cloudflareApiMessage(response.status, data, 'Cloudflare Pages project was not found or token was rejected') };
  }
  const project = data?.result || data || {};
  return {
    ok: true,
    status: response.status,
    projectName: String(project.name || projectName),
    websiteUrl: cloudflarePagesUrlFromProject(project, payload?.websiteUrl || `https://${projectName}.pages.dev`),
    message: `Cloudflare Pages connected: ${project.name || projectName}`
  };
}

function packageEntriesToCloudflareAssets(packageFiles) {
  const entries = buildPackageEntries(packageFiles, [
    'index.html',
    'styles.css',
    'content/page.json',
    'meta.json'
  ]);
  if (!entries.some((entry) => entry.name === 'index.html')) {
    entries.unshift({ name: 'index.html', content: '<!doctype html><html><body><h1>Empty Cloudflare Pages deploy</h1></body></html>' });
  }

  return entries.map((entry) => {
    const name = normalizeZipEntryName(entry.name);
    const content = entry.contentBase64
      ? Buffer.from(String(entry.contentBase64 || ''), 'base64')
      : Buffer.from(String(entry.content !== undefined ? entry.content : ''), 'utf8');
    const hash = crypto.createHash('md5').update(content).update(name).digest('hex');
    return {
      name,
      path: `/${name}`,
      hash,
      length: content.length,
      content,
      contentType: mimeTypeForFile(name),
      base64: content.toString('base64')
    };
  }).filter((entry) => entry.name && !entry.name.endsWith('/'));
}

function mimeTypeForFile(fileName) {
  const ext = String(fileName || '').toLowerCase().split('.').pop();
  const map = {
    html: 'text/html; charset=utf-8',
    htm: 'text/html; charset=utf-8',
    css: 'text/css; charset=utf-8',
    js: 'application/javascript; charset=utf-8',
    json: 'application/json; charset=utf-8',
    xml: 'application/xml; charset=utf-8',
    txt: 'text/plain; charset=utf-8',
    svg: 'image/svg+xml',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    ico: 'image/x-icon',
    webmanifest: 'application/manifest+json'
  };
  return map[ext] || 'application/octet-stream';
}

function makeMultipartBody(fields) {
  const boundary = `----IRGEZTNEBoundary${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  const chunks = [];
  Object.entries(fields || {}).forEach(([name, value]) => {
    if (value === undefined || value === null) return;
    chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${String(name).replace(/"/g, '')}"\r\n\r\n${String(value)}\r\n`, 'utf8'));
  });
  chunks.push(Buffer.from(`--${boundary}--\r\n`, 'utf8'));
  return { boundary, body: Buffer.concat(chunks) };
}

function cloudflareDeploymentStatus(deployment) {
  if (!deployment || typeof deployment !== 'object') return '';
  const latest = deployment.latest_stage || {};
  if (latest.status) return String(latest.status || '');
  if (deployment.status) return String(deployment.status || '');
  if (Array.isArray(deployment.stages) && deployment.stages.length) {
    const last = deployment.stages[deployment.stages.length - 1] || {};
    if (last.status) return String(last.status || '');
  }
  return '';
}

async function pollCloudflareDeployment(accountId, projectName, deploymentId, token) {
  let last = null;
  const listUrl = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/pages/projects/${encodeURIComponent(projectName)}/deployments`;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    if (attempt > 0) await wait(1500);
    try {
      const result = await fetchCloudflareJson(listUrl, token, { method: 'GET' });
      if (!result.response.ok || result.data?.success === false) {
        last = { status: `HTTP ${result.response.status}`, raw: result.data };
        continue;
      }
      const deployments = Array.isArray(result.data?.result) ? result.data.result : [];
      last = deployments.find((item) => String(item?.id || '') === String(deploymentId || '')) || deployments[0] || last;
      const status = cloudflareDeploymentStatus(last).toLowerCase();
      if (status === 'success' || status === 'failure' || status === 'failed' || status === 'canceled') break;
    } catch (error) {
      last = { status: 'poll-error', message: error && error.message ? error.message : String(error || 'poll error') };
    }
  }
  return last;
}

async function verifyPublishedUrl(url) {
  const target = String(url || '').trim();
  if (!/^https?:\/\//i.test(target)) return { ok: false, status: 0, message: 'Missing website URL' };
  let last = null;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    if (attempt > 0) await wait(1500);
    try {
      const response = await fetch(target, { method: 'GET', headers: { 'User-Agent': 'IRGEZTNE Preview.4' } });
      last = { ok: response.ok, status: response.status, message: `HTTP ${response.status}` };
      if (response.ok) return last;
      if (response.status === 404 || response.status >= 500) continue;
    } catch (error) {
      last = { ok: false, status: 0, message: error && error.message ? error.message : String(error || 'URL check failed') };
    }
  }
  return last || { ok: false, status: 0, message: 'URL check failed' };
}

async function publishCloudflarePagesPackage(payload) {
  const token = sanitizePlainText(payload?.token || '', 20_000).trim();
  const accountId = sanitizePlainText(payload?.accountId || '', 400).trim();
  const projectName = normalizeCloudflareProjectName(payload?.projectName || '');
  const branch = sanitizePlainText(payload?.branch || 'main', 200).trim() || 'main';
  const fallbackUrl = sanitizePlainText(payload?.websiteUrl || '', 2000).trim() || (projectName ? `https://${projectName}.pages.dev` : '');

  if (!token) return { ok: false, status: 0, message: 'Missing Cloudflare token' };
  if (!accountId) return { ok: false, status: 0, message: 'Missing Cloudflare Account ID' };
  if (!projectName) return { ok: false, status: 0, message: 'Missing Cloudflare Pages project name' };

  const connection = await testCloudflarePagesConnection({ token, accountId, projectName, websiteUrl: fallbackUrl });
  if (!connection.ok) return { ...connection, message: `Cloudflare project check failed: ${connection.message || 'unknown error'}` };

  const assets = packageEntriesToCloudflareAssets(payload?.package || {});
  if (!assets.some((entry) => entry.name === 'index.html')) {
    return { ok: false, status: 0, message: 'Cloudflare Pages deploy needs index.html in the ZIP root' };
  }

  const uploadTokenResult = await fetchCloudflareJson(
    `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/pages/projects/${encodeURIComponent(projectName)}/upload-token`,
    token,
    { method: 'GET' }
  );
  if (!uploadTokenResult.response.ok || uploadTokenResult.data?.success === false) {
    return { ok: false, status: uploadTokenResult.response.status, message: cloudflareApiMessage(uploadTokenResult.response.status, uploadTokenResult.data, 'Could not create Cloudflare upload token') };
  }
  const uploadToken = String(uploadTokenResult.data?.result?.jwt || uploadTokenResult.data?.result || '').trim();
  if (!uploadToken) return { ok: false, status: 0, message: 'Cloudflare upload token was empty' };

  const uploadPayload = assets.map((asset) => ({
    key: asset.hash,
    value: asset.base64,
    metadata: { contentType: asset.contentType },
    base64: true
  }));
  const assetsUpload = await fetchCloudflareJson('https://api.cloudflare.com/client/v4/pages/assets/upload', uploadToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(uploadPayload)
  });
  if (!assetsUpload.response.ok || assetsUpload.data?.success === false) {
    return { ok: false, status: assetsUpload.response.status, message: cloudflareApiMessage(assetsUpload.response.status, assetsUpload.data, 'Cloudflare asset upload failed') };
  }

  const hashes = assets.map((asset) => asset.hash);
  const hashResult = await fetchCloudflareJson('https://api.cloudflare.com/client/v4/pages/assets/upsert-hashes', uploadToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hashes })
  });
  if (!hashResult.response.ok || hashResult.data?.success === false) {
    return { ok: false, status: hashResult.response.status, message: cloudflareApiMessage(hashResult.response.status, hashResult.data, 'Cloudflare hash registration failed') };
  }

  const manifest = {};
  assets.forEach((asset) => { manifest[asset.path] = asset.hash; });
  const multipart = makeMultipartBody({ manifest: JSON.stringify(manifest), branch });
  const deployResult = await fetchCloudflareJson(
    `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/pages/projects/${encodeURIComponent(projectName)}/deployments`,
    token,
    {
      method: 'POST',
      headers: { 'Content-Type': `multipart/form-data; boundary=${multipart.boundary}` },
      body: multipart.body
    }
  );
  if (!deployResult.response.ok || deployResult.data?.success === false) {
    return { ok: false, status: deployResult.response.status, message: cloudflareApiMessage(deployResult.response.status, deployResult.data, 'Cloudflare deployment creation failed') };
  }

  const deployment = deployResult.data?.result || {};
  const deploymentId = String(deployment.id || deployment.deployment_id || '');
  if (!deploymentId) {
    return { ok: false, status: deployResult.response.status, message: 'Cloudflare did not return a deployment ID' };
  }

  const polled = await pollCloudflareDeployment(accountId, projectName, deploymentId, token);
  const finalDeployment = polled && typeof polled === 'object' ? { ...deployment, ...polled } : deployment;
  const state = cloudflareDeploymentStatus(finalDeployment) || 'created';
  if (/fail|error|cancel/i.test(state)) {
    return { ok: false, status: deployResult.response.status, message: `Cloudflare deployment ended with status: ${state}`, deploymentId, state };
  }

  const websiteUrl = String(deployment.url || finalDeployment.url || connection.websiteUrl || fallbackUrl || '').trim();
  const check = await verifyPublishedUrl(websiteUrl);
  if (!check || check.ok !== true) {
    return { ok: false, status: check && check.status || 0, message: `Cloudflare deployment was created, but the site URL did not answer correctly: ${check && check.message || 'URL check failed'}`, deploymentId, state, websiteUrl };
  }

  return {
    ok: true,
    deployId: deploymentId,
    state,
    websiteUrl,
    projectName: connection.projectName || projectName,
    fileName: sanitizeFileName(payload?.fileName || 'irgeztne-cloudflare-pages.zip', 'irgeztne-cloudflare-pages.zip'),
    files: assets.map((asset) => asset.name),
    publishedAt: new Date().toISOString()
  };
}



async function writePreviewPackage(payload) {
  const packageFiles = payload && payload.package && typeof payload.package === 'object' ? payload.package : {};
  const slugBase = sanitizeSlug(payload?.slug || payload?.title || 'preview');
  const previewId = `${slugBase}-${Date.now()}`;
  const previewDir = path.join(getPreviewsDir(), previewId);
  const contentDir = path.join(previewDir, 'content');
  ensureDir(previewDir);
  ensureDir(contentDir);

  const indexPath = path.join(previewDir, sanitizeFileName('index.html', 'index.html'));
  const stylesPath = path.join(previewDir, sanitizeFileName('styles.css', 'styles.css'));
  const pageJsonPath = path.join(contentDir, sanitizeFileName('page.json', 'page.json'));
  const metaJsonPath = path.join(previewDir, sanitizeFileName('meta.json', 'meta.json'));

  await writePackageFilesToDir({
    'index.html': '<!doctype html><html><body><h1>Empty preview</h1></body></html>',
    'styles.css': '',
    'content/page.json': '{}',
    'meta.json': '{}',
    ...packageFiles
  }, previewDir, [
    'index.html',
    'styles.css',
    'content/page.json',
    'meta.json'
  ]);

  return {
    ok: true,
    previewId,
    previewDir,
    indexPath,
    stylesPath,
    pageJsonPath,
    metaJsonPath,
    indexUrl: pathToFileURL(indexPath).toString(),
    title: sanitizePlainText(payload?.title || 'Preview', 200),
    slug: slugBase
  };
}

function detectChromeCommand() {
  if (process.platform === 'linux') {
    const candidates = ['google-chrome', 'google-chrome-stable', 'chromium-browser', 'chromium'];
    for (const candidate of candidates) {
      try {
        const result = spawnSync('which', [candidate], { stdio: 'ignore' });
        if (result && result.status === 0) return candidate;
      } catch {}
    }
    return '';
  }

  if (process.platform === 'darwin') {
    const candidate = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    return fs.existsSync(candidate) ? candidate : '';
  }

  if (process.platform === 'win32') {
    const candidates = [
      path.join(process.env.PROGRAMFILES || '', 'Google/Chrome/Application/chrome.exe'),
      path.join(process.env['PROGRAMFILES(X86)'] || '', 'Google/Chrome/Application/chrome.exe'),
      path.join(process.env.LOCALAPPDATA || '', 'Google/Chrome/Application/chrome.exe')
    ].filter(Boolean);

    return candidates.find((candidate) => fs.existsSync(candidate)) || '';
  }

  return '';
}

async function openPreviewExternally(indexPath, indexUrl) {
  const safeIndexPath = typeof indexPath === 'string' ? indexPath : '';
  const safeIndexUrl = typeof indexUrl === 'string' && indexUrl
    ? indexUrl
    : (safeIndexPath ? pathToFileURL(safeIndexPath).toString() : '');
  const chrome = detectChromeCommand();

  if (chrome && safeIndexUrl) {
    try {
      const child = spawn(chrome, [safeIndexUrl], { detached: true, stdio: 'ignore' });
      child.unref();
      return { ok: true, target: 'chrome', indexPath: safeIndexPath, indexUrl: safeIndexUrl };
    } catch (error) {
      console.warn('Chrome preview open failed:', error);
    }
  }

  if (safeIndexUrl) {
    await shell.openExternal(safeIndexUrl);
    return { ok: true, target: 'default', indexPath: safeIndexPath, indexUrl: safeIndexUrl };
  }

  throw new Error('Preview URL is missing');
}

function createAppMenu(win) {
  const appMenu = Menu.buildFromTemplate([
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'delete' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        ...(!app.isPackaged ? [{ role: 'toggleDevTools' }] : [])
      ]
    }
  ]);

  Menu.setApplicationMenu(appMenu);

  win.webContents.on('context-menu', (_event, params) => {
    const hasSelection = Boolean(params.selectionText && String(params.selectionText).trim());
    const canCopy = Boolean(params.editFlags.canCopy || hasSelection);
    const canCut = Boolean(params.editFlags.canCut);
    const canPaste = Boolean(params.editFlags.canPaste);

    const menu = Menu.buildFromTemplate([
      { label: 'Undo', enabled: params.editFlags.canUndo, click: () => win.webContents.undo() },
      { label: 'Redo', enabled: params.editFlags.canRedo, click: () => win.webContents.redo() },
      { type: 'separator' },
      { label: 'Cut', enabled: canCut, accelerator: 'CmdOrCtrl+X', click: () => win.webContents.cut() },
      { label: 'Copy', enabled: canCopy, accelerator: 'CmdOrCtrl+C', click: () => {
        try {
          const selected = String((params && params.selectionText) || '').trim();
          if (selected) {
            require('electron').clipboard.writeText(selected);
          } else {
            win.webContents.copy();
          }
        } catch (_) {
          try { win.webContents.copy(); } catch (_) {}
        }
      } },
      { label: 'Paste', enabled: canPaste, accelerator: 'CmdOrCtrl+V', click: () => win.webContents.paste() },
      { label: 'Select All', accelerator: 'CmdOrCtrl+A', click: () => win.webContents.selectAll() }
    ]);

    menu.popup({ window: win });
  });
}

function configureWindowSecurity(win) {
  win.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'https:') {
        shell.openExternal(url).catch(() => {});
      }
    } catch {
      // ignore malformed URLs
    }

    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    if (url !== INDEX_URL) {
      event.preventDefault();
    }
  });

  const ses = win.webContents.session;

  ses.setPermissionRequestHandler((_wc, _permission, callback) => {
    callback(false);
  });

  if (typeof ses.setPermissionCheckHandler === 'function') {
    ses.setPermissionCheckHandler(() => false);
  }
}

function createWindow() {
  const win = new BrowserWindow({
    icon: resolveIRGEZTNEAppIconPath(),
    width: 1400,
    height: 900,
    backgroundColor: '#111111',
    icon: getAppIconPath(),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: true,
      webviewTag: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false
    }
  });

  createAppMenu(win);
  configureWindowSecurity(win);

  win.loadFile('index.html');

  win.webContents.once('did-finish-load', () => {
    console.log('IRGEZTNE Workspace: page loaded');
    if (!app.isPackaged) {
    }
  });

  return win;
}

function registerIpcHandlers() {
  ipcMain.handle('ns:notes:load', async (event) => {
    assertTrustedSender(event);
    return readJson(getNotesPath(), { text: '', updatedAt: null });
  });

  ipcMain.handle('ns:notes:save', async (event, payload) => {
    assertTrustedSender(event);
    const data = {
      text: sanitizePlainText(payload?.text, 1_000_000),
      updatedAt: new Date().toISOString()
    };
    await writeJson(getNotesPath(), data);
    return { ok: true, updatedAt: data.updatedAt };
  });

  ipcMain.handle('ns:drafts:load', async (event) => {
    assertTrustedSender(event);
    return readJson(getDraftsPath(), []);
  });

  ipcMain.handle('ns:drafts:saveAll', async (event, drafts) => {
    assertTrustedSender(event);
    const safeDrafts = Array.isArray(drafts) ? drafts : [];
    await writeJson(getDraftsPath(), safeDrafts);
    return { ok: true, count: safeDrafts.length };
  });

  ipcMain.handle('ns:pages:load', async (event) => {
    assertTrustedSender(event);
    return readJson(getPagesPath(), []);
  });

  ipcMain.handle('ns:vitrina:load', async (event) => {
    assertTrustedSender(event);
    return readJson(getVitrinaRegistryPath(), { version: 1, items: [] });
  });

  ipcMain.handle('ns:vitrina:save', async (event, registry) => {
    assertTrustedSender(event);
    const safeRegistry = registry && typeof registry === 'object'
      ? registry
      : { version: 1, items: [] };
    await writeJson(getVitrinaRegistryPath(), safeRegistry);
    return { ok: true, count: Array.isArray(safeRegistry.items) ? safeRegistry.items.length : 0 };
  });

  ipcMain.handle('ns:templates:load', async (event) => {
    assertTrustedSender(event);
    return loadTemplateFilesFromDisk();
  });

  ipcMain.on('ns:templates:loadSync', (event) => {
    try {
      assertTrustedSender(event);
      event.returnValue = loadTemplateFilesFromDisk();
    } catch (error) {
      console.warn('[templates] sync load failed:', error);
      event.returnValue = [];
    }
  });

  ipcMain.handle('ns:templates:save', async (event, payload) => {
    assertTrustedSender(event);
    return saveTemplateFileToDisk(payload);
  });

  ipcMain.handle('ns:preview:materialize', async (event, payload) => {
    assertTrustedSender(event);
    return writePreviewPackage(payload);
  });

  ipcMain.handle('ns:export:zip', async (event, payload) => {
    assertTrustedSender(event);
    const owner = BrowserWindow.fromWebContents(event.sender);
    const defaultPath = getExportZipDefaultPath(payload);
    ensureDir(path.dirname(defaultPath));

    const result = await dialog.showSaveDialog(owner || undefined, {
      title: 'Export ZIP',
      defaultPath,
      filters: [{ name: 'ZIP archive', extensions: ['zip'] }]
    });

    if (result.canceled || !result.filePath) {
      return { ok: false, canceled: true };
    }

    return writeExportZipPackage(payload, result.filePath);
  });

  ipcMain.handle('ns:publish:netlifyZip', async (event, payload) => {
    assertTrustedSender(event);
    return publishNetlifyZipPackage(payload);
  });

  ipcMain.handle('ns:publish:cloudflareTest', async (event, payload) => {
    assertTrustedSender(event);
    return testCloudflarePagesConnection(payload);
  });

  ipcMain.handle('ns:publish:cloudflarePages', async (event, payload) => {
    assertTrustedSender(event);
    return publishCloudflarePagesPackage(payload);
  });

  ipcMain.handle('ns:preview:openExternal', async (event, payload) => {
    assertTrustedSender(event);
    return openPreviewExternally(payload?.indexPath, payload?.indexUrl);
  });

  ipcMain.handle('ns:publish:page', async (event, payload) => {
    assertTrustedSender(event);

    const pages = readJson(getPagesPath(), []);
    const id = `page_${Date.now()}`;
    const slugBase = sanitizeSlug(payload?.slug || payload?.title || 'page');
    const fileName = `${slugBase}-${Date.now()}.html`;
    const filePath = path.join(PAGES_DIR, fileName);
    const html = sanitizePlainText(payload?.html || '<html><body><h1>Empty page</h1></body></html>', 4_000_000);

    await fsp.writeFile(filePath, html, 'utf8');

    const entry = {
      id,
      title: sanitizePlainText(payload?.title || 'Untitled page', 200),
      subtitle: sanitizePlainText(payload?.subtitle || '', 400),
      template: sanitizePlainText(payload?.template || 'article', 100),
      slug: slugBase,
      fileName,
      filePath,
      createdAt: new Date().toISOString()
    };

    pages.unshift(entry);
    await writeJson(getPagesPath(), pages);

    return {
      ok: true,
      page: entry
    };
  });
}

app.whenReady().then(() => {
  ensureDir(DATA_DIR);
  ensureDir(PAGES_DIR);
  ensureDir(getPreviewsDir());
  ensureDir(getTemplatesDir());
  ensureJsonFile(getNotesPath(), { text: '', updatedAt: null });
  ensureJsonFile(getDraftsPath(), []);
  ensureJsonFile(getPagesPath(), []);
  ensureJsonFile(getVitrinaRegistryPath(), { version: 1, items: [] });

  app.on('web-contents-created', (_event, contents) => {
    // preview.4: route webview popup URLs into the same webview.
    // Some Yandex result links use window.open/target=_blank. Do not spawn
    // a small Electron popup; load the target URL in the current webview instead.
    try {
      const type = typeof contents.getType === 'function' ? contents.getType() : '';
      if (type === 'webview' && typeof contents.setWindowOpenHandler === 'function') {
        contents.setWindowOpenHandler(({ url }) => {
          try {
            const target = String(url || '').trim();
            const parsed = new URL(target);

            if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
              setTimeout(() => {
                try {
                  if (!contents.isDestroyed()) {
                    contents.loadURL(parsed.href).catch(() => {});
                  }
                } catch (_) {}
              }, 0);
            }
          } catch (_) {}

          return { action: 'deny' };
        });
      }
    } catch (error) {
      console.warn('[main] failed to install webview popup same-tab handler:', error);
    }

    // preview.4: context menu and keyboard copy for webview contents.
    // Copy/Select All must target the webview page, not only the main IRGEZTNE shell.
    try {
      const type = typeof contents.getType === 'function' ? contents.getType() : '';
      if (type === 'webview' && !contents.__irgeztneWebviewCopyMenuInstalled) {
        contents.__irgeztneWebviewCopyMenuInstalled = true;

        contents.on('context-menu', (_menuEvent, params) => {
          const hasSelection = Boolean(params.selectionText && String(params.selectionText).trim());
          const canCopy = Boolean(params.editFlags && (params.editFlags.canCopy || hasSelection));
          const canCut = Boolean(params.editFlags && params.editFlags.canCut);
          const canPaste = Boolean(params.editFlags && params.editFlags.canPaste);

          const menu = Menu.buildFromTemplate([
            { label: 'Cut', enabled: canCut, accelerator: 'CmdOrCtrl+X', click: () => contents.cut() },
            { label: 'Copy', enabled: canCopy, accelerator: 'CmdOrCtrl+C', click: () => {
              try {
                const selected = String((params && params.selectionText) || '').trim();
                if (selected) {
                  require('electron').clipboard.writeText(selected);
                } else {
                  contents.copy();
                }
              } catch (_) {
                try { contents.copy(); } catch (_) {}
              }
            } },
            { label: 'Paste', enabled: canPaste, accelerator: 'CmdOrCtrl+V', click: () => contents.paste() },
            { type: 'separator' },
            { label: 'Select All', accelerator: 'CmdOrCtrl+A', click: () => contents.selectAll() }
          ]);

          const owner = BrowserWindow.fromWebContents(contents) || BrowserWindow.getFocusedWindow();
          menu.popup({ window: owner || undefined });
        });

        contents.on('before-input-event', (event, input) => {
          const key = String(input.key || '').toLowerCase();
          const mod = Boolean(input.control || input.meta);

          if (!mod || input.type !== 'keyDown') return;

          if (key === 'c') {
            try {
              event.preventDefault();

              if (contents && typeof contents.executeJavaScript === 'function') {
                contents.executeJavaScript(
                  'String((window.getSelection && window.getSelection().toString()) || "")',
                  true
                ).then((selectedText) => {
                  try {
                    const selected = String(selectedText || '').trim();
                    if (selected) {
                      require('electron').clipboard.writeText(selected);
                    } else {
                      contents.copy();
                    }
                  } catch (_) {
                    try { contents.copy(); } catch (_) {}
                  }
                }).catch(() => {
                  try { contents.copy(); } catch (_) {}
                });
              } else {
                contents.copy();
              }
            } catch (_) {
              try { contents.copy(); } catch (_) {}
            }
          } else if (key === 'x') {
            try { contents.cut(); event.preventDefault(); } catch (_) {}
          } else if (key === 'v') {
            try { contents.paste(); event.preventDefault(); } catch (_) {}
          } else if (key === 'a') {
            try { contents.selectAll(); event.preventDefault(); } catch (_) {}
          }
        });
      }
    } catch (error) {
      console.warn('[main] failed to install webview copy menu:', error);
    }

    contents.on('will-attach-webview', (event, webPreferences, params) => {
      delete webPreferences.preload;
      delete webPreferences.preloadURL;

      webPreferences.nodeIntegration = false;
      webPreferences.contextIsolation = true;
      webPreferences.sandbox = false;
      webPreferences.webSecurity = true;
      webPreferences.allowRunningInsecureContent = false;
      webPreferences.experimentalFeatures = false;

      if (params && Object.prototype.hasOwnProperty.call(params, 'allowpopups')) {
        params.allowpopups = false;
      }

      const src = String(params?.src || '');
      if (!/^https?:/i.test(src)) {
        event.preventDefault();
      }
    });
  });

  try {
    app.setName('IRGEZTNE Workspace');
  } catch (_) {}

  registerIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
