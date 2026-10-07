process.env.ELECTRON_DISABLE_SANDBOX = '1';
const { app, BrowserWindow, screen, Menu, ipcMain, shell, dialog, safeStorage, protocol, net } = require('electron');
const { spawn, spawnSync } = require('child_process');
const path = require('path');

// IRGEZTNE_CANONICAL_APP_IDENTITY_V2
// Keep one application name, but do not force a second userData directory.
// productName in package.json uses the same spelling.
const IRGEZTNE_CANONICAL_APP_NAME = 'IRGEZTNE Workspace';
try { app.setName(IRGEZTNE_CANONICAL_APP_NAME); }
catch (error) {
  console.warn('[IRGEZTNE profile] failed to set canonical app name:', error && error.message ? error.message : error);
}
const crypto = require('crypto');
const fs = require('fs');
const fsp = fs.promises;
const { pathToFileURL } = require('url');
const { createStorageCore } = require('./src/storage/storage-core-main');
const { createAccountDesktopController, registerAccountDesktopIpc } = require('./src/account/account-desktop-main.cjs');
const { createIdentityController, registerIdentityIpc } = require('./src/identity/identity-core-main.cjs');
const { createIdentityAccountController, registerIdentityAccountIpc } = require('./src/identity/identity-account-main.cjs');
const { createWorkspaceMessengerController, registerWorkspaceMessengerIpc } = require('./src/messenger/messenger-main.cjs');
const { registerDocumentBundleIpc } = require('./src/office-document-bundle-main.cjs');
const { createWeatherWindowController } = require('./src/modules/weather/weather-window-main.cjs');
const remotePublish = require('./src/publishing/remote-publish-main.cjs');

// IRGEZTNE_WORKSPACE_ASSET_PROTOCOL_V1
// App-owned raster assets only. No host filesystem path is exposed to renderer.
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'irgeztne-asset',
    privileges: {
      standard: true,
      secure: true
    }
  }
]);

const DATA_DIR = app.isPackaged ? path.join(app.getPath('userData'), 'data') : path.join(__dirname, 'data');
const PAGES_DIR = path.join(DATA_DIR, 'pages');
const TEMPLATES_DIR = path.join(__dirname, 'templates');
const WEBSTUDIO_MEDIA_DIR = path.join(DATA_DIR, 'webstudio-media');
const TEST_CLEANUP_MODE = process.env.IRGEZTNE_CLEAN_TEST_DATA === '1';
const INDEX_FILE = path.join(__dirname, TEST_CLEANUP_MODE ? 'maintenance-cleanup.html' : 'index.html');
const INDEX_URL = pathToFileURL(INDEX_FILE).toString();
const ECONOMY_PROOF_URL = pathToFileURL(path.join(__dirname, 'proofs', 'economy-widget-standalone.html')).toString();
const WEATHER_PROOF_URL = pathToFileURL(path.join(__dirname, 'proofs', 'weather-widget-standalone.html')).toString();
const WEATHER_DATA_VIEW_PRELOAD = path.join(__dirname, 'src', 'modules', 'weather', 'weather-data-view-preload.cjs');
const WEATHER_STATE_KEYS = Object.freeze({
  location: 'irgeztne.weather.client.v1',
  cache: 'irgeztne.weather.cache.v1'
});
const WEATHER_OFFICIAL_LINKS = new Set([
  'https://api.met.no/doc/License',
  'https://api.met.no/weatherapi/locationforecast/2.0/documentation'
]);
const irgeztneWeatherWindowController = createWeatherWindowController({
  BrowserWindow,
  weatherUrl: WEATHER_PROOF_URL,
  preloadPath: WEATHER_DATA_VIEW_PRELOAD
});
let irgeztneDataPlatformServer = null;

async function startIRGEZTNEDataPlatformV02() {
  if (irgeztneDataPlatformServer) return irgeztneDataPlatformServer;
  const runtimeDataDir = path.join(DATA_DIR, 'economy-data-platform');
  const runtimeSnapshot = path.join(runtimeDataDir, 'latest.json');
  const bundledSnapshot = path.join(__dirname, 'data-platform', 'data', 'latest.json');
  ensureDir(runtimeDataDir);
  if (!fs.existsSync(runtimeSnapshot) && fs.existsSync(bundledSnapshot)) {
    fs.copyFileSync(bundledSnapshot, runtimeSnapshot);
  }
  process.env.IRGEZTNE_DATA_DIR = runtimeDataDir;
  const moduleUrl = pathToFileURL(path.join(__dirname, 'data-platform', 'src', 'server.js')).href;
  const dataPlatform = await import(moduleUrl);
  irgeztneDataPlatformServer = await dataPlatform.startServer();
  return irgeztneDataPlatformServer;
}

function resolveIRGEZTNEAppIconPath() {
  const candidates = [
    path.join(__dirname, 'build', 'icons', '512x512.png'),
    path.join(__dirname, 'build', 'icons', '256x256.png'),
    path.join(__dirname, 'build', 'icon.png'),
    path.join(__dirname, 'assets', 'branding', 'app-mark.png')
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || undefined;
}


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

/* IRGEZTNE_WEBSTUDIO_MEDIA_CORE_V084H
   Heavy media files live outside localStorage.
   Page HTML stores only assets/media/... paths. */

function sanitizeMediaSegmentV084H(value, fallback = 'site') {
  const clean = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

  return clean || fallback;
}

function videoMimeV084H(extension) {
  const map = {
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.ogg': 'video/ogg',
    '.ogv': 'video/ogg'
  };

  return map[String(extension || '').toLowerCase()] || '';
}

function imageMimeV092C(extension) {
  const map = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif'
  };

  return map[String(extension || '').toLowerCase()] || '';
}

/* IRGEZTNE_VIDEO_SIGNATURE_DETECT_V084I
   Detect real video type from file contents.
   Downloaders may save MP4 with a hash instead of .mp4. */
async function detectVideoTypeV084I(filePath, originalExtension) {
  const fallbackMime = videoMimeV084H(originalExtension);
  let handle = null;

  try {
    handle = await fsp.open(filePath, 'r');

    const probe = Buffer.alloc(4096);
    const result = await handle.read(
      probe,
      0,
      probe.length,
      0
    );

    const data = probe.subarray(0, result.bytesRead);

    if (
      data.length >= 12 &&
      data.subarray(4, 8).toString('ascii') === 'ftyp'
    ) {
      return {
        mimeType: 'video/mp4',
        extension: '.mp4'
      };
    }

    if (
      data.length >= 4 &&
      data[0] === 0x1a &&
      data[1] === 0x45 &&
      data[2] === 0xdf &&
      data[3] === 0xa3
    ) {
      const headerText = data
        .toString('latin1')
        .toLowerCase();

      if (headerText.includes('webm')) {
        return {
          mimeType: 'video/webm',
          extension: '.webm'
        };
      }
    }

    if (
      data.length >= 4 &&
      data.subarray(0, 4).toString('ascii') === 'OggS'
    ) {
      return {
        mimeType: 'video/ogg',
        extension: '.ogg'
      };
    }
  } catch (error) {
    console.warn(
      '[webstudio-media] video signature detection failed:',
      error
    );
  } finally {
    if (handle) {
      try {
        await handle.close();
      } catch {}
    }
  }

  return {
    mimeType: fallbackMime,
    extension: fallbackMime
      ? originalExtension
      : ''
  };
}

/* IRGEZTNE_IMAGE_SIGNATURE_DETECT_V092C
   Local images use verified bitmap signatures. SVG stays URL-only because
   an SVG file may contain active content. */
async function detectImageTypeV092C(filePath, originalExtension) {
  const fallbackMime = imageMimeV092C(originalExtension);
  let handle = null;

  try {
    handle = await fsp.open(filePath, 'r');

    const probe = Buffer.alloc(32);
    const result = await handle.read(
      probe,
      0,
      probe.length,
      0
    );

    const data = probe.subarray(0, result.bytesRead);

    if (
      data.length >= 8 &&
      data[0] === 0x89 &&
      data.subarray(1, 4).toString('ascii') === 'PNG' &&
      data[4] === 0x0d &&
      data[5] === 0x0a &&
      data[6] === 0x1a &&
      data[7] === 0x0a
    ) {
      return {
        mimeType: 'image/png',
        extension: '.png'
      };
    }

    if (
      data.length >= 3 &&
      data[0] === 0xff &&
      data[1] === 0xd8 &&
      data[2] === 0xff
    ) {
      return {
        mimeType: 'image/jpeg',
        extension: fallbackMime === 'image/jpeg' &&
          originalExtension === '.jpeg'
          ? '.jpeg'
          : '.jpg'
      };
    }

    if (
      data.length >= 6 &&
      (
        data.subarray(0, 6).toString('ascii') === 'GIF87a' ||
        data.subarray(0, 6).toString('ascii') === 'GIF89a'
      )
    ) {
      return {
        mimeType: 'image/gif',
        extension: '.gif'
      };
    }

    if (
      data.length >= 12 &&
      data.subarray(0, 4).toString('ascii') === 'RIFF' &&
      data.subarray(8, 12).toString('ascii') === 'WEBP'
    ) {
      return {
        mimeType: 'image/webp',
        extension: '.webp'
      };
    }
  } catch (error) {
    console.warn(
      '[webstudio-media] image signature detection failed:',
      error
    );
  } finally {
    if (handle) {
      try {
        await handle.close();
      } catch {}
    }
  }

  return {
    mimeType: '',
    extension: ''
  };
}

async function importSiteImageV092C(owner, payload = {}) {
  const picked = await dialog.showOpenDialog(
    owner || undefined,
    {
      title: 'Choose image / Выберите изображение',
      properties: ['openFile'],
      filters: [
        {
          name: 'Image',
          extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif']
        },
        {
          name: 'All files',
          extensions: ['*']
        }
      ]
    }
  );

  if (picked.canceled || !picked.filePaths?.[0]) {
    return { ok: false, canceled: true };
  }

  const selectedPath = path.resolve(picked.filePaths[0]);
  const originalExtension = path
    .extname(selectedPath)
    .toLowerCase();

  const detectedType = await detectImageTypeV092C(
    selectedPath,
    originalExtension
  );

  const extension = detectedType.extension;
  const mimeType = detectedType.mimeType;

  if (!mimeType || !extension) {
    return {
      ok: false,
      error: 'unsupported-image-type'
    };
  }

  const stat = await fsp.stat(selectedPath);

  if (!stat.isFile()) {
    return {
      ok: false,
      error: 'not-a-file'
    };
  }

  if (stat.size > 50 * 1024 * 1024) {
    return {
      ok: false,
      error: 'image-too-large'
    };
  }

  const siteId = sanitizeMediaSegmentV084H(
    payload.siteId,
    'active-site'
  );

  const baseName = sanitizeMediaSegmentV084H(
    path.basename(selectedPath, originalExtension),
    'image'
  ).slice(0, 54);

  const digest = crypto
    .createHash('sha1')
    .update(
      selectedPath +
      ':' +
      stat.size +
      ':' +
      stat.mtimeMs +
      ':' +
      Date.now()
    )
    .digest('hex')
    .slice(0, 12);

  const fileName = `${baseName}-${digest}${extension}`;

  const targetDir = path.join(
    WEBSTUDIO_MEDIA_DIR,
    siteId,
    'image'
  );

  const targetPath = path.join(targetDir, fileName);

  ensureDir(targetDir);
  await fsp.copyFile(selectedPath, targetPath);

  return {
    ok: true,
    asset: {
      id: `media_${digest}`,
      kind: 'image',
      name: path.basename(selectedPath),
      fileName,
      mimeType,
      size: stat.size,
      sourcePath: targetPath,
      sourceUrl: pathToFileURL(targetPath).toString(),
      publicPath: `assets/media/image/${fileName}`,
      createdAt: new Date().toISOString()
    }
  };
}

async function importSiteVideoV084H(owner, payload = {}) {
  const picked = await dialog.showOpenDialog(
    owner || undefined,
    {
      title: 'Choose video / Выберите видео',
      properties: ['openFile'],
      filters: [
        {
          name: 'Video',
          extensions: ['mp4', 'webm', 'ogg', 'ogv']
        },
        {
          name: 'All files',
          extensions: ['*']
        }
      ]
    }
  );

  if (picked.canceled || !picked.filePaths?.[0]) {
    return { ok: false, canceled: true };
  }

  const selectedPath = path.resolve(picked.filePaths[0]);
  const originalExtension = path
    .extname(selectedPath)
    .toLowerCase();

  const detectedType = await detectVideoTypeV084I(
    selectedPath,
    originalExtension
  );

  const extension = detectedType.extension;
  const mimeType = detectedType.mimeType;

  if (!mimeType || !extension) {
    return {
      ok: false,
      error: 'unsupported-video-type'
    };
  }

  const stat = await fsp.stat(selectedPath);

  if (!stat.isFile()) {
    return {
      ok: false,
      error: 'not-a-file'
    };
  }

  if (stat.size > 1024 * 1024 * 1024) {
    return {
      ok: false,
      error: 'video-too-large'
    };
  }

  const siteId = sanitizeMediaSegmentV084H(
    payload.siteId,
    'active-site'
  );

  const baseName = sanitizeMediaSegmentV084H(
    path.basename(selectedPath, originalExtension),
    'video'
  ).slice(0, 54);

  const digest = crypto
    .createHash('sha1')
    .update(
      selectedPath +
      ':' +
      stat.size +
      ':' +
      stat.mtimeMs +
      ':' +
      Date.now()
    )
    .digest('hex')
    .slice(0, 12);

  const fileName = `${baseName}-${digest}${extension}`;

  const targetDir = path.join(
    WEBSTUDIO_MEDIA_DIR,
    siteId,
    'video'
  );

  const targetPath = path.join(targetDir, fileName);

  ensureDir(targetDir);
  await fsp.copyFile(selectedPath, targetPath);

  return {
    ok: true,
    asset: {
      id: `media_${digest}`,
      kind: 'video',
      name: path.basename(selectedPath),
      fileName,
      mimeType,
      size: stat.size,
      sourcePath: targetPath,
      sourceUrl: pathToFileURL(targetPath).toString(),
      publicPath: `assets/media/video/${fileName}`,
      createdAt: new Date().toISOString()
    }
  };
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

// IRGEZTNE_WEBSTUDIO_PREVIEW_TEMP_ROOT_R2
// Generated browser previews are disposable runtime artifacts, not Workspace data.
function getPreviewsDir() {
  return path.join(app.getPath('temp'), 'irgeztne-workspace-previews');
}

function clearSitePreviewTempDir() {
  try {
    fs.rmSync(getPreviewsDir(), { recursive: true, force: true });
  } catch (_) {}
}

function getExportsDir() {
  return path.join(DATA_DIR, 'exports');
}

function getChatAttachmentOpenTempDir() {
  return path.join(app.getPath('temp'), 'irgeztne-workspace-chat-open');
}

function clearChatAttachmentOpenTempDir() {
  try {
    fs.rmSync(getChatAttachmentOpenTempDir(), { recursive: true, force: true });
  } catch (_) {}
}

// IRGEZTNE_WORKSPACE_FILE_OPEN_R1N
// Workspace File Store-backed documents can be opened without exposing a
// filesystem path to the renderer. Temporary copies are private and cleared
// on the next app start / quit.
function getWorkspaceFileOpenTempDir() {
  return path.join(app.getPath('temp'), 'irgeztne-workspace-file-open');
}

function clearWorkspaceFileOpenTempDir() {
  try {
    fs.rmSync(getWorkspaceFileOpenTempDir(), { recursive: true, force: true });
  } catch (_) {}
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

function isWeatherDataViewUrl(value) {
  try {
    const parsed = new URL(String(value || ''));
    const expected = new URL(WEATHER_PROOF_URL);
    return parsed.protocol === 'file:' && parsed.pathname === expected.pathname;
  } catch (_) {
    return false;
  }
}

function assertWeatherDataViewSender(event) {
  const senderUrl = String(event?.senderFrame?.url || event?.sender?.getURL?.() || '');
  if (!isWeatherDataViewUrl(senderUrl)) throw new Error('Blocked Weather IPC from untrusted sender');
}


// preview.4 v7g4 step2 — Storage Core IPC for app preferences/layout.
// This is intentionally limited to app preferences, layout and generic module state.
// Web Studio state and provider tokens are not migrated in this step.
let irgeztneStorageCoreInstance = null;
let irgeztneMessengerController = null;
let irgeztneAccountDesktopController = null;
let irgeztneIdentityController = null;
let irgeztneIdentityAccountController = null;

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

function getIRGEZTNEAccountDesktopController() {
  if (!irgeztneAccountDesktopController) {
    irgeztneAccountDesktopController = createAccountDesktopController({
      app,
      safeStorage,
      shell,
      apiBase: process.env.IRGEZTNE_ACCOUNT_API_URL || 'https://account.irgeztne.com'
    });
  }
  return irgeztneAccountDesktopController;
}

function getIRGEZTNEIdentityController() {
  if (!irgeztneIdentityController) {
    irgeztneIdentityController = createIdentityController({
      app,
      safeStorage,
      dataDir: DATA_DIR
    });
  }
  return irgeztneIdentityController;
}

function getIRGEZTNEIdentityAccountController() {
  if (!irgeztneIdentityAccountController) {
    irgeztneIdentityAccountController = createIdentityAccountController({
      app,
      fetchImpl: (...args) => net.fetch(...args),
      getIdentityController: getIRGEZTNEIdentityController,
      getLegacyAccountStatus: () => getIRGEZTNEAccountDesktopController().getStatus(),
      identityApiBase: process.env.IRGEZTNE_IDENTITY_API_URL || '',
      accountApiBase: process.env.IRGEZTNE_ACCOUNT_API_URL || ''
    });
  }
  return irgeztneIdentityAccountController;
}

registerIdentityIpc({
  ipcMain,
  dialog,
  assertTrustedSender,
  getController: getIRGEZTNEIdentityController
});

registerIdentityAccountIpc({
  ipcMain,
  assertTrustedSender,
  getController: getIRGEZTNEIdentityAccountController
});

registerAccountDesktopIpc({
  ipcMain,
  assertTrustedSender,
  getController: getIRGEZTNEAccountDesktopController
});

// IRGEZTNE_DOCUMENT_BUNDLE_EXPORT_R1L
registerDocumentBundleIpc({
  ipcMain,
  dialog,
  BrowserWindow,
  assertTrustedSender,
  getStorageCore: getIRGEZTNEStorageCore,
  dataDir: DATA_DIR
});

require('./src/storage/workspace-backup-main.cjs').registerWorkspaceBackupIpc({ ipcMain, dialog, BrowserWindow, assertTrustedSender, getStorageCore: getIRGEZTNEStorageCore });
let testCleanupCompleted = false;
ipcMain.handle('ns:workspace:testCleanup', (event, payload = {}) => {
  assertTrustedSender(event);
  if (!TEST_CLEANUP_MODE || testCleanupCompleted) throw new Error('Test cleanup requires the isolated maintenance launch');
  const result = getIRGEZTNEStorageCore().cleanTestWorkspace(payload.storage, payload.indexedDB);
  testCleanupCompleted = true;
  return result;
});

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

// IRGEZTNE_WEATHER_DATA_VIEW_BRIDGE_V1
// The standalone Weather surface gets only two fixed state slots and two
// allowlisted official MET Norway links. It never receives generic nsAPI access.
ipcMain.handle('irgeztne:weather:openFull', async (event, payload = {}) => {
  assertTrustedSender(event);
  return irgeztneWeatherWindowController.open(payload);
});

ipcMain.on('irgeztne:weather:getStateSync', (event, payload = {}) => {
  try {
    assertWeatherDataViewSender(event);
    const key = WEATHER_STATE_KEYS[String(payload.slot || '')];
    event.returnValue = key ? getIRGEZTNEStorageCore().getModuleState(key, payload.fallback) : payload.fallback;
  } catch (_) {
    event.returnValue = payload.fallback;
  }
});

ipcMain.on('irgeztne:weather:setStateSync', (event, payload = {}) => {
  try {
    assertWeatherDataViewSender(event);
    const key = WEATHER_STATE_KEYS[String(payload.slot || '')];
    const serialized = JSON.stringify(payload.value);
    if (!key || serialized.length > 512000) throw new Error('Invalid Weather state payload');
    event.returnValue = getIRGEZTNEStorageCore().setModuleState(key, payload.value);
  } catch (_) {
    event.returnValue = { ok: false };
  }
});

ipcMain.on('irgeztne:weather:locationChanged', (event) => {
  try {
    assertWeatherDataViewSender(event);
    BrowserWindow.getAllWindows().forEach((window) => {
      if (!window.isDestroyed() && window.webContents.getURL() === INDEX_URL) {
        window.webContents.send('irgeztne:weather:locationChanged');
      }
    });
  } catch (_) {}
});

ipcMain.handle('irgeztne:weather:openOfficialLink', async (event, payload = {}) => {
  assertWeatherDataViewSender(event);
  let url;
  try { url = new URL(String(payload.url || '')).toString().replace(/\/$/, ''); }
  catch (_) { return { ok: false, error: 'invalid-url' }; }
  if (!WEATHER_OFFICIAL_LINKS.has(url)) return { ok: false, error: 'not-allowlisted' };
  await shell.openExternal(url);
  return { ok: true };
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

// IRGEZTNE_WORKSHOP_FOLDER_PICKER_R1W7B
// Native folder picker for Workshop. The renderer receives only package-relative
// paths and bounded file bytes; the selected host filesystem path never crosses IPC.
const WORKSHOP_FOLDER_PICK_MAX_FILES = 200;
const WORKSHOP_FOLDER_PICK_MAX_FILE_BYTES = 64 * 1024 * 1024;
const WORKSHOP_FOLDER_PICK_MAX_TOTAL_BYTES = 128 * 1024 * 1024;

const WORKSHOP_FOLDER_MIME_BY_EXTENSION = Object.freeze({
  '.html': 'text/html',
  '.htm': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.json': 'application/json',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf'
});

function workshopFolderMime(filePath) {
  return WORKSHOP_FOLDER_MIME_BY_EXTENSION[path.extname(String(filePath || '')).toLowerCase()] || 'application/octet-stream';
}

async function collectWorkshopFolderFiles(rootPath) {
  const files = [];
  let totalBytes = 0;

  async function walk(currentPath) {
    const entries = await fsp.readdir(currentPath, { withFileTypes: true });
    entries.sort((a, b) => String(a.name).localeCompare(String(b.name)));

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      if (entry.isSymbolicLink()) {
        throw new Error(`Symbolic links are not allowed in Workshop folders: ${entry.name}`);
      }
      if (entry.isDirectory()) {
        await walk(fullPath);
        continue;
      }
      if (!entry.isFile()) continue;

      if (files.length >= WORKSHOP_FOLDER_PICK_MAX_FILES) {
        throw new Error(`Workshop folder exceeds ${WORKSHOP_FOLDER_PICK_MAX_FILES} files`);
      }

      const stat = await fsp.stat(fullPath);
      const size = Number(stat.size || 0);
      if (size > WORKSHOP_FOLDER_PICK_MAX_FILE_BYTES) {
        throw new Error(`Workshop file is too large: ${entry.name}`);
      }
      totalBytes += size;
      if (totalBytes > WORKSHOP_FOLDER_PICK_MAX_TOTAL_BYTES) {
        throw new Error('Workshop folder exceeds the package size limit');
      }

      const relativeNative = path.relative(rootPath, fullPath);
      if (!relativeNative || relativeNative.startsWith('..') || path.isAbsolute(relativeNative)) {
        throw new Error('Invalid Workshop folder path');
      }
      const relativePath = relativeNative.split(path.sep).join('/');
      const bytes = await fsp.readFile(fullPath);
      files.push({
        name: path.basename(fullPath),
        relativePath,
        size,
        mime: workshopFolderMime(fullPath),
        bytes: new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength)
      });
    }
  }

  await walk(rootPath);
  return files;
}

ipcMain.handle('ns:workshop:pickFolder', async (event) => {
  try {
    assertTrustedSender(event);
    const owner = BrowserWindow.fromWebContents(event.sender);
    const options = {
      title: 'Выберите папку сайта / Choose website folder',
      buttonLabel: 'Выбрать папку / Select folder',
      properties: ['openDirectory']
    };
    const picked = owner
      ? await dialog.showOpenDialog(owner, options)
      : await dialog.showOpenDialog(options);
    if (picked.canceled || !picked.filePaths?.[0]) {
      return { ok: false, canceled: true, files: [] };
    }
    const files = await collectWorkshopFolderFiles(path.resolve(picked.filePaths[0]));
    if (!files.length) {
      return { ok: false, canceled: false, files: [], error: { code: 'WORKSHOP_FOLDER_EMPTY', message: 'Selected folder is empty' } };
    }
    return { ok: true, canceled: false, files };
  } catch (error) {
    console.warn('[Workshop] folder picker failed:', error && error.message ? error.message : error);
    return {
      ok: false,
      canceled: false,
      files: [],
      error: { code: 'WORKSHOP_FOLDER_PICK_FAILED', message: String(error && error.message || error) }
    };
  }
});

// IRGEZTNE_WORKSHOP_IMPORT_CONFLICTS_R1W7C
ipcMain.handle('ns:workshop:resolveImportConflicts', async (event, payload = {}) => {
  try {
    assertTrustedSender(event);
    const locale = payload && payload.locale === 'en' ? 'en' : 'ru';
    const count = Math.max(1, Math.min(200, Number(payload && payload.count || 0) || 1));
    const paths = Array.isArray(payload && payload.paths)
      ? payload.paths.slice(0, 5).map((value) => String(value || '').replace(/[\r\n]/g, ' ').slice(0, 180)).filter(Boolean)
      : [];
    const owner = BrowserWindow.fromWebContents(event.sender);
    const shown = paths.length ? `\n\n${paths.join('\n')}${count > paths.length ? `\n… +${count - paths.length}` : ''}` : '';
    const options = locale === 'en'
      ? {
          type: 'question',
          title: 'Matching package files',
          message: `${count} matching file path${count === 1 ? '' : 's'} already exist in this package.`,
          detail: `Choose what to do with the matching files.${shown}`,
          buttons: ['Replace matches', 'Skip matches', 'Cancel'],
          defaultId: 0,
          cancelId: 2,
          noLink: true
        }
      : {
          type: 'question',
          title: 'Совпадающие файлы пакета',
          message: `В пакете уже ${count === 1 ? 'есть 1 файл с таким путём' : `есть ${count} файлов с такими путями`}.`,
          detail: `Выберите, что сделать с совпадающими файлами.${shown}`,
          buttons: ['Заменить совпадающие', 'Пропустить совпадающие', 'Отмена'],
          defaultId: 0,
          cancelId: 2,
          noLink: true
        };
    const result = owner
      ? await dialog.showMessageBox(owner, options)
      : await dialog.showMessageBox(options);
    return {
      ok: true,
      action: result.response === 0 ? 'replace' : result.response === 1 ? 'skip' : 'cancel'
    };
  } catch (error) {
    console.warn('[Workshop] import conflict dialog failed:', error && error.message ? error.message : error);
    return { ok: false, action: 'cancel' };
  }
});

// IRGEZTNE_WORKSPACE_FILE_PICKER_V1
// Trusted Workspace picker: renderer never receives an arbitrary filesystem path.
const WORKSPACE_FILE_OWNER_TYPES = new Set([
  'document',
  'spreadsheet',
  'presentation',
  'diagram',
  'formula',
  'files',
  'webstudio',
  'project',
  'note',
  'workspace'
]);

const WORKSPACE_FILE_ROLES = new Set([
  'attachment',
  'image',
  'media',
  'asset',
  'source',
  'reference',
  'import'
]);


const WORKSPACE_IMAGE_MIME_BY_EXTENSION = Object.freeze({
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  avif: 'image/avif'
});

function workspaceImageMimeFromPath(filePath) {
  const extension = path.extname(String(filePath || ''))
    .toLowerCase()
    .replace(/^\./, '');

  return WORKSPACE_IMAGE_MIME_BY_EXTENSION[extension] || '';
}

function cleanWorkspaceFileToken(value, label, allowed) {
  const text = String(value == null ? '' : value).trim().toLowerCase();

  if (
    !text ||
    text.length > 64 ||
    !/^[a-z][a-z0-9_-]*$/.test(text) ||
    (allowed && !allowed.has(text))
  ) {
    const error = new TypeError(`Invalid ${label}`);
    error.code = 'WORKSPACE_FILE_INVALID_CONTEXT';
    throw error;
  }

  return text;
}

function cleanWorkspaceFileOwnerId(value) {
  const text = String(value == null ? '' : value).trim();

  if (
    !text ||
    text.length > 300 ||
    /[\u0000-\u001f\u007f]/.test(text)
  ) {
    const error = new TypeError('Invalid Workspace file owner id');
    error.code = 'WORKSPACE_FILE_INVALID_CONTEXT';
    throw error;
  }

  return text;
}

function publicWorkspaceFilePassport(file) {
  if (!file) return null;

  return {
    fileId: String(file.fileId || ''),
    blobId: String(file.blobId || ''),
    originalName: String(file.originalName || ''),
    displayName: String(file.displayName || ''),
    mimeType: String(file.mimeType || 'application/octet-stream'),
    extension: String(file.extension || ''),
    sourceKind: String(file.sourceKind || ''),
    sizeBytes: Number(file.sizeBytes || 0),
    sha256: String(file.sha256 || ''),
    blobState: String(file.blobState || ''),
    createdAt: String(file.createdAt || ''),
    updatedAt: String(file.updatedAt || '')
  };
}

function publicWorkspaceFileRef(ref) {
  if (!ref) return null;

  return {
    refId: String(ref.ref_id || ref.refId || ''),
    fileId: String(ref.file_id || ref.fileId || ''),
    ownerType: String(ref.owner_type || ref.ownerType || ''),
    ownerId: String(ref.owner_id || ref.ownerId || ''),
    role: String(ref.role || ''),
    createdAt: String(ref.created_at || ref.createdAt || '')
  };
}

function cleanWorkspaceFileOpaqueId(value, label) {
  const text = String(value == null ? '' : value).trim();

  if (
    !text ||
    text.length > 200 ||
    /[\u0000-\u001f\u007f]/.test(text)
  ) {
    const error = new TypeError(`Invalid ${label}`);
    error.code = 'WORKSPACE_FILE_INVALID_CONTEXT';
    throw error;
  }

  return text;
}

function publicWorkspaceFileImportResult(result) {
  const blob = result && result.blob ? result.blob : {};

  return {
    ok: true,
    canceled: false,
    file: publicWorkspaceFilePassport(result && result.file),
    ref: publicWorkspaceFileRef(result && result.ref),
    blob: {
      blobId: String(blob.blobId || ''),
      sha256: String(blob.sha256 || ''),
      sizeBytes: Number(blob.sizeBytes || 0),
      reusedPhysicalBlob: Boolean(blob.reusedPhysicalBlob)
    }
  };
}

ipcMain.handle('ns:storage:workspaceFilePickImport', async (event, payload = {}) => {
  try {
    assertTrustedSender(event);

    const intent = payload.intent === 'image' ? 'image' : 'any';

    const ownerType = cleanWorkspaceFileToken(
      payload.ownerType,
      'Workspace file owner type',
      WORKSPACE_FILE_OWNER_TYPES
    );

    const ownerId = cleanWorkspaceFileOwnerId(payload.ownerId);

    const role = cleanWorkspaceFileToken(
      payload.role || 'attachment',
      'Workspace file role',
      WORKSPACE_FILE_ROLES
    );

    const owner = BrowserWindow.fromWebContents(event.sender);

    const picked = await dialog.showOpenDialog(
      owner || undefined,
      {
        title: 'Choose file / Выберите файл',
        properties: ['openFile'],
        filters: intent === 'image'
          ? [
              {
                name: 'Images',
                extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'avif']
              }
            ]
          : [
              {
                name: 'All files',
                extensions: ['*']
              }
            ]
      }
    );

    if (picked.canceled || !picked.filePaths?.[0]) {
      return {
        ok: false,
        canceled: true
      };
    }

    const pickedPath = picked.filePaths[0];
    const imageMimeType = intent === 'image'
      ? workspaceImageMimeFromPath(pickedPath)
      : '';

    if (intent === 'image' && !imageMimeType) {
      return {
        ok: false,
        canceled: false,
        error: { code: 'WORKSPACE_IMAGE_UNSUPPORTED_TYPE' }
      };
    }

    const imported = await getIRGEZTNEStorageCore()
      .importWorkspaceFileFromPath({
        sourcePath: pickedPath,
        ownerType,
        ownerId,
        role,
        sourceKind: 'computer',
        mimeType: imageMimeType || undefined
      });

    return publicWorkspaceFileImportResult(imported);
  } catch (error) {
    const code = String(
      error && error.code
        ? error.code
        : 'WORKSPACE_FILE_IMPORT_FAILED'
    );

    console.warn(
      '[IRGEZTNE Workspace File Picker]',
      code,
      error && error.message ? error.message : error
    );

    return {
      ok: false,
      canceled: false,
      error: {
        code: /^[A-Z0-9_]{1,80}$/.test(code)
          ? code
          : 'WORKSPACE_FILE_IMPORT_FAILED'
      }
    };
  }
});


// IRGEZTNE_FILES_DURABLE_IMPORT_V1
// Drag/drop and the Files upload input can only provide renderer File bytes.
// Import those bytes through trusted IPC into the same Workspace File Store
// used by Office attachments. No arbitrary filesystem path crosses to renderer.
function workspaceFileBufferFromPayload(value) {
  if (Buffer.isBuffer(value)) return Buffer.from(value);

  if (value instanceof ArrayBuffer) {
    return Buffer.from(value);
  }

  if (ArrayBuffer.isView(value)) {
    return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
  }

  if (
    value &&
    value.type === 'Buffer' &&
    Array.isArray(value.data)
  ) {
    return Buffer.from(value.data);
  }

  throw Object.assign(
    new TypeError('Invalid Workspace file bytes'),
    { code: 'WORKSPACE_FILE_INVALID_BYTES' }
  );
}

function cleanWorkspaceFileName(value) {
  const name = path.basename(String(value || '').trim());

  if (
    !name ||
    name.length > 255 ||
    /[\u0000-\u001f\u007f]/.test(name)
  ) {
    throw Object.assign(
      new TypeError('Invalid Workspace file name'),
      { code: 'WORKSPACE_FILE_INVALID_NAME' }
    );
  }

  return name;
}

ipcMain.handle('ns:storage:workspaceFileImportBuffer', async (event, payload = {}) => {
  let tempPath = '';

  try {
    assertTrustedSender(event);

    const ownerType = cleanWorkspaceFileToken(
      payload.ownerType,
      'Workspace file owner type',
      WORKSPACE_FILE_OWNER_TYPES
    );
    const ownerId = cleanWorkspaceFileOwnerId(payload.ownerId);
    const role = cleanWorkspaceFileToken(
      payload.role || 'source',
      'Workspace file role',
      WORKSPACE_FILE_ROLES
    );
    const originalName = cleanWorkspaceFileName(payload.originalName);
    const displayName = cleanWorkspaceFileName(
      payload.displayName || originalName
    );
    const requestedSourceKind = String(
      payload.sourceKind || 'computer'
    ).trim().toLowerCase();
    const sourceKind =
      requestedSourceKind === 'imported' ||
      requestedSourceKind === 'import'
        ? 'imported'
        : 'computer';
    const mimeType = String(payload.mimeType || 'application/octet-stream')
      .trim()
      .slice(0, 255) || 'application/octet-stream';

    const bytes = workspaceFileBufferFromPayload(payload.bytes);

    // Keep IPC memory use bounded. The File Store itself can hold larger files
    // through the native path picker used by Office.
    if (bytes.length > 128 * 1024 * 1024) {
      const error = new Error('Workspace renderer import is too large');
      error.code = 'WORKSPACE_FILE_TOO_LARGE';
      throw error;
    }

    const tempDir = path.join(DATA_DIR, 'files', 'renderer-imports');
    ensureDir(tempDir);
    tempPath = path.join(
      tempDir,
      `renderer-${process.pid}-${Date.now()}-${crypto.randomUUID()}.tmp`
    );

    const handle = await fsp.open(tempPath, 'wx', 0o600);
    try {
      await handle.writeFile(bytes);
      await handle.sync();
    } finally {
      await handle.close();
    }

    const imported = await getIRGEZTNEStorageCore()
      .importWorkspaceFileFromPath({
        sourcePath: tempPath,
        originalName,
        displayName,
        ownerType,
        ownerId,
        role,
        sourceKind,
        mimeType
      });

    return publicWorkspaceFileImportResult(imported);
  } catch (error) {
    const code = String(
      error && error.code
        ? error.code
        : 'WORKSPACE_FILE_IMPORT_FAILED'
    );

    console.warn(
      '[IRGEZTNE Workspace File Buffer Import]',
      code,
      error && error.message ? error.message : error
    );

    return {
      ok: false,
      canceled: false,
      error: {
        code: /^[A-Z0-9_]{1,80}$/.test(code)
          ? code
          : 'WORKSPACE_FILE_IMPORT_FAILED'
      }
    };
  } finally {
    if (tempPath) {
      try { await fsp.unlink(tempPath); }
      catch (error) {
        if (!error || error.code !== 'ENOENT') {
          console.warn('[IRGEZTNE Workspace File Buffer Import] temp cleanup failed', error);
        }
      }
    }
  }
});


// IRGEZTNE_WORKSPACE_FILE_LIST_V1
ipcMain.on('ns:storage:workspaceFileListSync', (event, payload = {}) => {
  try {
    assertTrustedSender(event);
    const files = getIRGEZTNEStorageCore().listWorkspaceFiles({
      limit: Math.max(1, Math.min(10000, Number(payload.limit || 5000) || 5000))
    });
    event.returnValue = {
      ok: true,
      files: Array.isArray(files) ? files.map(publicWorkspaceFilePassport) : []
    };
  } catch (error) {
    console.warn('[IRGEZTNE Workspace File List]', error && error.message ? error.message : error);
    event.returnValue = { ok: false, files: [], error: { code: 'WORKSPACE_FILE_LIST_FAILED' } };
  }
});

ipcMain.handle('ns:storage:workspaceFileGet', async (event, payload = {}) => {
  try {
    assertTrustedSender(event);

    const fileId = cleanWorkspaceFileOpaqueId(
      payload.fileId,
      'Workspace file id'
    );

    const file = getIRGEZTNEStorageCore().getWorkspaceFile(fileId);

    if (!file) {
      return {
        ok: false,
        error: { code: 'WORKSPACE_FILE_NOT_FOUND' }
      };
    }

    return {
      ok: true,
      file: publicWorkspaceFilePassport(file)
    };
  } catch (error) {
    const code = String(
      error && error.code
        ? error.code
        : 'WORKSPACE_FILE_GET_FAILED'
    );

    return {
      ok: false,
      error: {
        code: /^[A-Z0-9_]{1,80}$/.test(code)
          ? code
          : 'WORKSPACE_FILE_GET_FAILED'
      }
    };
  }
});


// IRGEZTNE_WORKSPACE_FILE_SAVE_AS_V1
ipcMain.handle('ns:storage:workspaceFileSaveAs', async (event, payload = {}) => {
  try {
    assertTrustedSender(event);

    const fileId = cleanWorkspaceFileOpaqueId(
      payload.fileId,
      'Workspace file id'
    );
    const file = getIRGEZTNEStorageCore().getWorkspaceFile(fileId);

    if (!file || file.blobState !== 'ready') {
      return {
        ok: false,
        canceled: false,
        error: { code: 'WORKSPACE_FILE_NOT_FOUND' }
      };
    }

    const dataRoot = path.resolve(DATA_DIR);
    const sourcePath = path.resolve(
      dataRoot,
      String(file.storageRelpath || '')
    );

    if (
      sourcePath === dataRoot ||
      !sourcePath.startsWith(dataRoot + path.sep)
    ) {
      return {
        ok: false,
        canceled: false,
        error: { code: 'WORKSPACE_FILE_INVALID_PATH' }
      };
    }

    const owner = BrowserWindow.fromWebContents(event.sender);
    const suggestedName = cleanWorkspaceFileName(
      payload.suggestedName ||
      file.displayName ||
      file.originalName ||
      'workspace-file'
    );

    const picked = await dialog.showSaveDialog(owner || undefined, {
      title: 'Save file / Сохранить файл',
      defaultPath: suggestedName
    });

    if (picked.canceled || !picked.filePath) {
      return { ok: false, canceled: true };
    }

    await fsp.copyFile(sourcePath, picked.filePath);

    return {
      ok: true,
      canceled: false,
      fileName: path.basename(picked.filePath)
    };
  } catch (error) {
    const code = String(
      error && error.code
        ? error.code
        : 'WORKSPACE_FILE_SAVE_FAILED'
    );

    console.warn(
      '[IRGEZTNE Workspace File Save As]',
      code,
      error && error.message ? error.message : error
    );

    return {
      ok: false,
      canceled: false,
      error: {
        code: /^[A-Z0-9_]{1,80}$/.test(code)
          ? code
          : 'WORKSPACE_FILE_SAVE_FAILED'
      }
    };
  }
});


// IRGEZTNE_WORKSPACE_FILE_OPEN_R1N
ipcMain.handle('ns:storage:workspaceFileOpen', async (event, payload = {}) => {
  try {
    assertTrustedSender(event);

    const fileId = cleanWorkspaceFileOpaqueId(
      payload.fileId,
      'Workspace file id'
    );

    const file = getIRGEZTNEStorageCore().getWorkspaceFile(fileId);

    if (!file || file.blobState !== 'ready') {
      return {
        ok: false,
        error: { code: 'WORKSPACE_FILE_NOT_FOUND' }
      };
    }

    const originalName = cleanWorkspaceFileName(
      file.displayName ||
      file.originalName ||
      'workspace-file'
    );
    const extension = String(
      path.extname(originalName).replace(/^\./, '') ||
      file.extension ||
      ''
    ).toLowerCase();

    // Open only passive/common document, image and archive formats.
    // HTML/SVG/scripts/installers/executables deliberately require Save As.
    const safeOpenExtensions = new Set([
      'txt', 'md', 'markdown', 'json', 'csv', 'pdf',
      'png', 'jpg', 'jpeg', 'webp', 'gif', 'avif',
      'zip',
      'rtf', 'doc', 'docx', 'odt',
      'xls', 'xlsx', 'ods',
      'ppt', 'pptx', 'odp'
    ]);

    if (!safeOpenExtensions.has(extension)) {
      return {
        ok: false,
        error: { code: 'WORKSPACE_FILE_OPEN_REQUIRES_SAVE' }
      };
    }

    const dataRoot = path.resolve(DATA_DIR);
    const sourcePath = path.resolve(
      dataRoot,
      String(file.storageRelpath || '')
    );

    if (
      sourcePath === dataRoot ||
      !sourcePath.startsWith(dataRoot + path.sep)
    ) {
      return {
        ok: false,
        error: { code: 'WORKSPACE_FILE_INVALID_PATH' }
      };
    }

    const stat = await fsp.stat(sourcePath);

    if (!stat.isFile()) {
      return {
        ok: false,
        error: { code: 'WORKSPACE_FILE_NOT_FOUND' }
      };
    }

    if (stat.size > 256 * 1024 * 1024) {
      return {
        ok: false,
        error: { code: 'WORKSPACE_FILE_OPEN_TOO_LARGE' }
      };
    }

    const tempRoot = getWorkspaceFileOpenTempDir();
    ensureDir(tempRoot);
    try { await fsp.chmod(tempRoot, 0o700); } catch (_) {}

    const target = path.join(
      tempRoot,
      `${Date.now()}-${crypto.randomUUID()}-${originalName}`
    );

    await fsp.copyFile(sourcePath, target);
    try { await fsp.chmod(target, 0o600); } catch (_) {}

    const openError = await shell.openPath(target);

    if (openError) {
      try { await fsp.unlink(target); } catch (_) {}
      return {
        ok: false,
        error: { code: 'WORKSPACE_FILE_OPEN_FAILED' }
      };
    }

    return {
      ok: true,
      opened: true
    };
  } catch (error) {
    const code = String(
      error && error.code
        ? error.code
        : 'WORKSPACE_FILE_OPEN_FAILED'
    );

    console.warn(
      '[IRGEZTNE Workspace File Open]',
      code,
      error && error.message ? error.message : error
    );

    return {
      ok: false,
      error: {
        code: /^[A-Z0-9_]{1,80}$/.test(code)
          ? code
          : 'WORKSPACE_FILE_OPEN_FAILED'
      }
    };
  }
});

ipcMain.handle('ns:storage:workspaceFileAttach', async (event, payload = {}) => {
  try {
    assertTrustedSender(event);

    const fileId = cleanWorkspaceFileOpaqueId(
      payload.fileId,
      'Workspace file id'
    );

    const ownerType = cleanWorkspaceFileToken(
      payload.ownerType,
      'Workspace file owner type',
      WORKSPACE_FILE_OWNER_TYPES
    );

    const ownerId = cleanWorkspaceFileOwnerId(payload.ownerId);

    const role = cleanWorkspaceFileToken(
      payload.role || 'attachment',
      'Workspace file role',
      WORKSPACE_FILE_ROLES
    );

    const storage = getIRGEZTNEStorageCore();

    const attached = storage.attachWorkspaceFile({
      fileId,
      ownerType,
      ownerId,
      role
    });

    const file = storage.getWorkspaceFile(fileId);

    return {
      ok: true,
      created: Boolean(attached && attached.created),
      file: publicWorkspaceFilePassport(file),
      ref: publicWorkspaceFileRef(attached && attached.ref)
    };
  } catch (error) {
    const code = String(
      error && error.code
        ? error.code
        : 'WORKSPACE_FILE_ATTACH_FAILED'
    );

    return {
      ok: false,
      error: {
        code: /^[A-Z0-9_]{1,80}$/.test(code)
          ? code
          : 'WORKSPACE_FILE_ATTACH_FAILED'
      }
    };
  }
});

ipcMain.handle('ns:storage:workspaceFileRemoveReference', async (event, payload = {}) => {
  try {
    assertTrustedSender(event);

    const refId = cleanWorkspaceFileOpaqueId(
      payload.refId,
      'Workspace file reference id'
    );

    const result = getIRGEZTNEStorageCore()
      .removeWorkspaceFileReference(refId);

    return {
      ok: true,
      removed: Boolean(result && result.removed),
      deletedFileId: result && result.deletedFileId
        ? String(result.deletedFileId)
        : ''
    };
  } catch (error) {
    const code = String(
      error && error.code
        ? error.code
        : 'WORKSPACE_FILE_REMOVE_FAILED'
    );

    return {
      ok: false,
      error: {
        code: /^[A-Z0-9_]{1,80}$/.test(code)
          ? code
          : 'WORKSPACE_FILE_REMOVE_FAILED'
      }
    };
  }
});


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

function packageEntryBufferV084H(entry) {
  if (entry && entry.templateAsset) {
    const templateRoot = path.resolve(
      __dirname,
      'template-lab'
    );
    const assetPath = path.resolve(
      __dirname,
      String(entry.templateAsset || '')
    );
    const allowedExtension = /\.(?:avif|gif|jpe?g|png|svg|webp)$/i.test(
      assetPath
    );

    if (
      !allowedExtension ||
      (
        assetPath !== templateRoot &&
        !assetPath.startsWith(templateRoot + path.sep)
      )
    ) {
      throw new Error(
        'Template asset is outside the official Template Lab'
      );
    }

    return fs.readFileSync(assetPath);
  }

  if (entry && entry.sourcePath) {
    const sourcePath = path.resolve(
      String(entry.sourcePath || '')
    );

    const mediaRoot = path.resolve(
      WEBSTUDIO_MEDIA_DIR
    );

    if (
      sourcePath !== mediaRoot &&
      !sourcePath.startsWith(mediaRoot + path.sep)
    ) {
      throw new Error(
        'Media source is outside Web Studio storage'
      );
    }

    return fs.readFileSync(sourcePath);
  }

  if (entry && entry.contentBase64) {
    return Buffer.from(
      String(entry.contentBase64 || ''),
      'base64'
    );
  }

  return Buffer.from(
    String(
      entry && entry.content !== undefined
        ? entry.content
        : ''
    ),
    'utf8'
  );
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
    const content = packageEntryBufferV084H(entry);
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
    if (value.templateAsset) {
      return {
        templateAsset: String(value.templateAsset || ''),
        mimeType: String(value.mimeType || '')
      };
    }
    if (value.sourcePath) {
      return {
        sourcePath: String(value.sourcePath || ''),
        mimeType: String(value.mimeType || '')
      };
    }
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
    const content = packageEntryBufferV084H(entry);
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
          'User-Agent': 'IRGEZTNE/1.0.0'
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
        'User-Agent': 'IRGEZTNE/1.0.0'
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
    'User-Agent': 'IRGEZTNE/1.0.0',
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
    const content = packageEntryBufferV084H(entry);
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
      const response = await fetch(target, { method: 'GET', headers: { 'User-Agent': 'IRGEZTNE/1.0.0' } });
      last = { ok: response.ok, status: response.status, message: `HTTP ${response.status}` };
      if (response.ok) return last;
      if (response.status === 404 || response.status >= 500) continue;
    } catch (error) {
      last = { ok: false, status: 0, message: error && error.message ? error.message : String(error || 'URL check failed') };
    }
  }
  return last || { ok: false, status: 0, message: 'URL check failed' };
}


// IRGEZTNE_REMOTE_PUBLISH_R1Q
// Real FTP/FTPS/SFTP publishing with a local per-target SHA-256 manifest.
// First publish sends the complete build. Later publishes send only changed/new
// files and remove only files previously published by this Workspace target.
function remotePublishManifestDir() {
  return path.join(app.getPath('userData'), 'publish-sync');
}

function normalizeRemotePublishConfig(providerId, payload) {
  const source = payload && typeof payload === 'object' ? payload : {};
  const config = source.config && typeof source.config === 'object' ? source.config : source;
  const provider = String(providerId || source.providerId || '').trim().toLowerCase();
  return {
    providerId: provider,
    host: sanitizePlainText(config.host || '', 512).trim(),
    port: sanitizePlainText(config.port || '', 16).trim(),
    username: sanitizePlainText(config.username || '', 512).trim(),
    password: String(config.password || '').slice(0, 16384),
    remotePath: sanitizePlainText(config.remotePath || '/', 2048).trim() || '/',
    protocol: sanitizePlainText(config.protocol || (provider === 'ftp' ? 'ftps' : ''), 32).trim().toLowerCase()
  };
}

function remotePublishManifestPath(providerId, config, siteKey) {
  const key = remotePublish.targetIdentity(providerId, config, siteKey || 'default');
  return path.join(remotePublishManifestDir(), `${key}.json`);
}

async function readRemotePublishManifest(providerId, config, siteKey) {
  const filePath = remotePublishManifestPath(providerId, config, siteKey);
  try {
    const parsed = JSON.parse(await fsp.readFile(filePath, 'utf8'));
    return parsed && parsed.files && typeof parsed.files === 'object' ? parsed : { version: 1, files: {} };
  } catch (_) {
    return { version: 1, files: {} };
  }
}

async function writeRemotePublishManifest(providerId, config, siteKey, manifest) {
  ensureDir(remotePublishManifestDir());
  const filePath = remotePublishManifestPath(providerId, config, siteKey);
  const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  await fsp.writeFile(tmpPath, JSON.stringify(manifest || { version: 1, files: {} }, null, 2), { mode: 0o600 });
  await fsp.rename(tmpPath, filePath);
}

function remotePublishEntries(packageFiles) {
  const entries = buildPackageEntries(packageFiles, [
    'index.html',
    'styles.css',
    'content/page.json',
    'meta.json'
  ]);
  if (!entries.some((entry) => entry.name === 'index.html')) {
    entries.unshift({ name: 'index.html', content: '<!doctype html><html><body><h1>Empty publish</h1></body></html>' });
  }
  return entries.map((entry) => ({ name: entry.name, buffer: packageEntryBufferV084H(entry) }));
}

async function testRemotePublishConnection(payload) {
  const providerId = String(payload?.providerId || '').trim().toLowerCase();
  if (providerId !== 'ftp' && providerId !== 'sftp') {
    return { ok: false, message: 'Unsupported remote publishing provider' };
  }
  const config = normalizeRemotePublishConfig(providerId, payload);
  try {
    const result = await remotePublish.testConnection(providerId, config);
    return {
      ok: true,
      providerId,
      remotePath: result && result.remotePath ? result.remotePath : config.remotePath,
      message: `${providerId.toUpperCase()} connection verified`
    };
  } catch (error) {
    return { ok: false, providerId, message: error && error.message ? error.message : String(error || 'Connection failed') };
  }
}

async function publishRemotePackage(payload) {
  const providerId = String(payload?.providerId || '').trim().toLowerCase();
  if (providerId !== 'ftp' && providerId !== 'sftp') {
    return { ok: false, message: 'Unsupported remote publishing provider' };
  }
  const config = normalizeRemotePublishConfig(providerId, payload);
  const siteKey = sanitizePlainText(payload?.siteKey || payload?.slug || payload?.title || 'default', 512).trim() || 'default';
  let entries;
  try {
    entries = remotePublishEntries(payload?.package || {});
  } catch (error) {
    return { ok: false, providerId, message: error && error.message ? error.message : String(error || 'Could not prepare build') };
  }
  try {
    const previousManifest = await readRemotePublishManifest(providerId, config, siteKey);
    const result = await remotePublish.publish(providerId, config, entries, previousManifest);
    await writeRemotePublishManifest(providerId, config, siteKey, result.currentManifest);
    return {
      ok: true,
      providerId,
      uploaded: result.plan.upload,
      removed: result.plan.remove,
      unchanged: result.plan.unchanged,
      files: Object.keys(result.currentManifest.files || {}),
      publishedAt: new Date().toISOString(),
      incremental: Object.keys(previousManifest.files || {}).length > 0
    };
  } catch (error) {
    return { ok: false, providerId, message: error && error.message ? error.message : String(error || 'Remote publish failed') };
  }
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

function irgeztneNativeEditLabels() {
  const locale = String((typeof app.getLocale === 'function' ? app.getLocale() : '') || process.env.LANG || '').toLowerCase();
  const ru = locale.startsWith('ru') || locale.includes('russian');
  return ru
    ? {
        edit: 'Правка',
        view: 'Вид',
        undo: 'Отменить',
        redo: 'Повторить',
        cut: 'Вырезать',
        copy: 'Копировать',
        paste: 'Вставить',
        delete: 'Удалить',
        selectAll: 'Выделить всё'
      }
    : {
        edit: 'Edit',
        view: 'View',
        undo: 'Undo',
        redo: 'Redo',
        cut: 'Cut',
        copy: 'Copy',
        paste: 'Paste',
        delete: 'Delete',
        selectAll: 'Select All'
      };
}

function createAppMenu(win) {
  const L = irgeztneNativeEditLabels();
  const appMenu = Menu.buildFromTemplate([
    {
      label: L.edit,
      submenu: [
        { role: 'undo', label: L.undo },
        { role: 'redo', label: L.redo },
        { type: 'separator' },
        { role: 'cut', label: L.cut },
        { role: 'copy', label: L.copy },
        { role: 'paste', label: L.paste },
        { role: 'delete', label: L.delete },
        { role: 'selectAll', label: L.selectAll }
      ]
    },
    {
      label: L.view,
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
      { label: L.undo, enabled: params.editFlags.canUndo, click: () => win.webContents.undo() },
      { label: L.redo, enabled: params.editFlags.canRedo, click: () => win.webContents.redo() },
      { type: 'separator' },
      { label: L.cut, enabled: canCut, accelerator: 'CmdOrCtrl+X', click: () => win.webContents.cut() },
      { label: L.copy, enabled: canCopy, accelerator: 'CmdOrCtrl+C', click: () => {
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
      { label: L.paste, enabled: canPaste, accelerator: 'CmdOrCtrl+V', click: () => win.webContents.paste() },
      { label: L.selectAll, accelerator: 'CmdOrCtrl+A', click: () => win.webContents.selectAll() }
    ]);

    menu.popup({ window: win });
  });
}

function configureWindowSecurity(win) {
  win.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const parsed = new URL(url);
      const economyProof = new URL(ECONOMY_PROOF_URL);
      const weatherProof = new URL(WEATHER_PROOF_URL);
      const isWeatherDataView = parsed.protocol === 'file:' && parsed.pathname === weatherProof.pathname;
      const isWorkspaceDataView = parsed.protocol === 'file:' &&
        (parsed.pathname === economyProof.pathname || parsed.pathname === weatherProof.pathname);
      if (isWorkspaceDataView) {
        const dataViewPreferences = {
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true
        };
        if (isWeatherDataView) dataViewPreferences.preload = WEATHER_DATA_VIEW_PRELOAD;
        return {
          action: 'allow',
          overrideBrowserWindowOptions: {
            width: 1180,
            height: 820,
            minWidth: 760,
            minHeight: 620,
            backgroundColor: '#071224',
            autoHideMenuBar: true,
            webPreferences: dataViewPreferences
          }
        };
      }
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

  win.webContents.on('did-create-window', (child, details) => {
    if (!isWeatherDataViewUrl(details && details.url)) return;
    child.webContents.on('will-navigate', (event) => event.preventDefault());
    child.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  });

  const ses = win.webContents.session;

  ses.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowWeatherLocation = permission === 'geolocation' && isWeatherDataViewUrl(webContents && webContents.getURL());
    callback(allowWeatherLocation);
  });

  if (typeof ses.setPermissionCheckHandler === 'function') {
    ses.setPermissionCheckHandler((webContents, permission) => {
      return permission === 'geolocation' && isWeatherDataViewUrl(webContents && webContents.getURL());
    });
  }
}

function createWindow() {
  const win = new BrowserWindow({
    
    resizable: true,icon: resolveIRGEZTNEAppIconPath(),
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

  win.loadFile(INDEX_FILE);

  win.webContents.once('did-finish-load', () => {
    console.log('IRGEZTNE Workspace: page loaded');
    if (!app.isPackaged) {
    }
  });

  return win;
}

function registerIpcHandlers() {
  

  // IRGEZTNE_WINDOW_CONTROLS_V04P16
  ipcMain.handle('ns:window:getState', async (event) => {
    assertTrustedSender(event);
    const owner = BrowserWindow.fromWebContents(event.sender);
    if (!owner || owner.isDestroyed()) {
      return { ok: false, maximized: false, fullScreen: false, resizable: false };
    }
    return {
      ok: true,
      maximized: owner.isMaximized(),
      fullScreen: owner.isFullScreen(),
      resizable: owner.isResizable(),
      bounds: owner.getBounds()
    };
  });

  ipcMain.handle('ns:window:toggleMaximize', async (event) => {
    assertTrustedSender(event);
    const owner = BrowserWindow.fromWebContents(event.sender);
    if (!owner || owner.isDestroyed()) {
      return { ok: false, maximized: false };
    }

    if (!owner.isResizable()) owner.setResizable(true);

    const boundsBefore = owner.getBounds();
    const normalBefore = owner.getNormalBounds();
    const display = screen.getDisplayMatching(boundsBefore);
    const work = display && display.workArea ? display.workArea : boundsBefore;
    const fillsWorkArea =
      boundsBefore.width >= Math.round(work.width * 0.95) &&
      boundsBefore.height >= Math.round(work.height * 0.93);

    if (owner.isFullScreen()) owner.setFullScreen(false);

    if (owner.isMaximized() || fillsWorkArea) {
      if (owner.isMaximized()) owner.unmaximize();

      const normalLooksUseful =
        normalBefore &&
        normalBefore.width >= 720 &&
        normalBefore.height >= 520 &&
        normalBefore.width < Math.round(work.width * 0.94) &&
        normalBefore.height < Math.round(work.height * 0.92);

      if (!normalLooksUseful) {
        const width = Math.max(900, Math.min(1400, Math.round(work.width * 0.78)));
        const height = Math.max(620, Math.min(900, Math.round(work.height * 0.82)));
        const x = Math.round(work.x + (work.width - width) / 2);
        const y = Math.round(work.y + (work.height - height) / 2);
        owner.setBounds({ x, y, width, height }, true);
      }
    } else {
      owner.maximize();
    }

    return {
      ok: true,
      maximized: owner.isMaximized(),
      fullScreen: owner.isFullScreen(),
      resizable: owner.isResizable(),
      bounds: owner.getBounds()
    };
  });

// IRGEZTNE Green Lightning v0.4P: narrow Messenger capability boundary.
  // The controller starts lazily when the Chat surface asks for status/history.
  if (!irgeztneMessengerController) {
    irgeztneMessengerController = createWorkspaceMessengerController({
      app,
      runtimeDir: path.join(__dirname, 'src', 'messenger', 'native-runtime'),
      storage: getIRGEZTNEStorageCore(),
      safeStorage,
      // Keep the Chat grant in Main. The shared Workspace Renderer never receives
      // either the master Account session or a cross-service grant capability.
      accountServiceGrantProvider: async () =>
        getIRGEZTNEIdentityAccountController().acquireServiceGrantForMain('CHAT'),
      fetchImpl: (...args) => net.fetch(...args),
      chatServiceBaseUrl: process.env.IRGEZTNE_CHAT_API_URL ||
        'https://irgeztne-chat-staging.irgeztne.workers.dev',
      // Old Mirror/Camel MLS lab must never resurrect in the normal product.
      // Explicit opt-in remains available for regression work only.
      localLabEnabled: process.env.IRGEZTNE_CHAT_LOCAL_LAB === '1'
    });

    registerWorkspaceMessengerIpc({
      ipcMain,
      assertTrustedSender,
      controller: irgeztneMessengerController,
      pickAttachmentFile: async (event) => {
        const owner = BrowserWindow.fromWebContents(event.sender);

        const picked = await dialog.showOpenDialog(
          owner || undefined,
          {
            title: 'Choose attachment / Выберите файл',
            properties: ['openFile'],
            filters: [
              {
                name: 'All files',
                extensions: ['*']
              }
            ]
          }
        );

        if (picked.canceled || !picked.filePaths?.[0]) {
          return { canceled: true };
        }

        return {
          canceled: false,
          filePath: picked.filePaths[0]
        };
      },
      openAttachmentFile: async (_event, attachment, bytes) => {
        const safeOpenMimeTypes = new Set([
          'text/plain',
          'text/markdown',
          'application/json',
          'text/csv',
          'application/pdf',
          'image/png',
          'image/jpeg',
          'image/webp',
          'image/gif'
        ]);

        const mimeType = String(attachment?.mimeType || '').toLowerCase();
        if (!safeOpenMimeTypes.has(mimeType)) {
          return {
            ok: false,
            error: {
              code: 'ATTACHMENT_OPEN_REQUIRES_SAVE',
              message: 'Save this attachment before opening it'
            }
          };
        }

        const tempRoot = getChatAttachmentOpenTempDir();
        ensureDir(tempRoot);
        try { await fsp.chmod(tempRoot, 0o700); } catch (_) {}

        const target = path.join(
          tempRoot,
          `${Date.now()}-${crypto.randomUUID()}-${attachment.name}`
        );

        await fsp.writeFile(target, bytes, { mode: 0o600 });
        const openError = await shell.openPath(target);

        if (openError) {
          try { await fsp.unlink(target); } catch (_) {}
          return {
            ok: false,
            error: {
              code: 'ATTACHMENT_OPEN_FAILED',
              message: String(openError).slice(0, 1200)
            }
          };
        }

        return { ok: true, opened: true };
      },
      saveAttachmentFile: async (event, attachment, bytes) => {
        const owner = BrowserWindow.fromWebContents(event.sender);
        const picked = await dialog.showSaveDialog(
          owner || undefined,
          {
            title: 'Save attachment / Сохранить вложение',
            defaultPath: attachment.name
          }
        );

        if (picked.canceled || !picked.filePath) {
          return { ok: false, canceled: true };
        }

        await fsp.writeFile(picked.filePath, bytes);
        return { ok: true, saved: true };
      }
    });
  }

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

  ipcMain.handle('ns:webstudio:media:importVideo', async (event, payload) => {
    assertTrustedSender(event);

    const owner = BrowserWindow.fromWebContents(
      event.sender
    );

    return importSiteVideoV084H(
      owner,
      payload || {}
    );
  });

  ipcMain.handle('ns:webstudio:media:importImage', async (event, payload) => {
    assertTrustedSender(event);

    const owner = BrowserWindow.fromWebContents(
      event.sender
    );

    return importSiteImageV092C(
      owner,
      payload || {}
    );
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

  ipcMain.handle('ns:publish:remoteTest', async (event, payload) => {
    assertTrustedSender(event);
    return testRemotePublishConnection(payload);
  });

  ipcMain.handle('ns:publish:remote', async (event, payload) => {
    assertTrustedSender(event);
    return publishRemotePackage(payload);
  });

  // IRGEZTNE_DOCUMENTS_EXTERNAL_LINK_V6
  ipcMain.handle('ns:system:openExternalUrl', async (event, payload = {}) => {
    assertTrustedSender(event);

    const raw = String(payload?.url || '').trim();
    if (!raw || raw.length > 2048) return { ok: false, error: 'invalid-url' };

    let parsed;
    try {
      parsed = new URL(raw);
    } catch (_) {
      return { ok: false, error: 'invalid-url' };
    }

    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return { ok: false, error: 'unsupported-protocol' };
    }

    try {
      await shell.openExternal(parsed.href);
      return { ok: true };
    } catch (_) {
      return { ok: false, error: 'open-failed' };
    }
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

function workspaceAssetError(status) {
  return new Response('', {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}

async function handleWorkspaceAssetRequest(request) {
  try {
    if (!request || request.method !== 'GET') {
      return workspaceAssetError(405);
    }

    const url = new URL(request.url);

    if (
      url.protocol !== 'irgeztne-asset:' ||
      url.hostname !== 'workspace-file'
    ) {
      return workspaceAssetError(404);
    }

    const fileId = decodeURIComponent(
      String(url.pathname || '').replace(/^\/+/, '')
    );

    if (
      !fileId ||
      fileId.length > 200 ||
      !/^[A-Za-z0-9_-]+$/.test(fileId)
    ) {
      return workspaceAssetError(400);
    }

    const file = getIRGEZTNEStorageCore().getWorkspaceFile(fileId);

    if (!file || file.blobState !== 'ready') {
      return workspaceAssetError(404);
    }

    const extension = String(
      file.extension ||
      path.extname(file.originalName || '').replace(/^\./, '')
    ).toLowerCase();

    const mimeType = WORKSPACE_IMAGE_MIME_BY_EXTENSION[extension];

    // Deliberately raster-only. SVG/HTML/etc. are never served here.
    if (!mimeType) {
      return workspaceAssetError(415);
    }

    const dataRoot = path.resolve(DATA_DIR);
    const absolutePath = path.resolve(
      dataRoot,
      String(file.storageRelpath || '')
    );

    if (
      absolutePath === dataRoot ||
      !absolutePath.startsWith(dataRoot + path.sep)
    ) {
      return workspaceAssetError(403);
    }

    const stat = await fsp.stat(absolutePath);

    if (!stat.isFile()) {
      return workspaceAssetError(404);
    }

    // Inline Office images get a bounded display path.
    // Large files can still live in File Store as normal attachments.
    if (stat.size > 64 * 1024 * 1024) {
      return workspaceAssetError(413);
    }

    const bytes = await fsp.readFile(absolutePath);

    return new Response(bytes, {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Content-Length': String(bytes.length),
        'Cache-Control': 'private, max-age=3600',
        'X-Content-Type-Options': 'nosniff'
      }
    });
  } catch (error) {
    console.warn(
      '[IRGEZTNE Workspace Asset]',
      error && error.message ? error.message : error
    );
    return workspaceAssetError(404);
  }
}

app.whenReady().then(async () => {
  clearChatAttachmentOpenTempDir();
  clearWorkspaceFileOpenTempDir();
  clearSitePreviewTempDir();
  ensureDir(DATA_DIR);
  ensureDir(PAGES_DIR);
  ensureDir(getPreviewsDir());
  ensureDir(getTemplatesDir());
  ensureJsonFile(getNotesPath(), { text: '', updatedAt: null });
  ensureJsonFile(getDraftsPath(), []);
  ensureJsonFile(getPagesPath(), []);
  ensureJsonFile(getVitrinaRegistryPath(), { version: 1, items: [] });

  protocol.handle('irgeztne-asset', handleWorkspaceAssetRequest);

  try {
    await startIRGEZTNEDataPlatformV02();
  } catch (error) {
    console.warn('[Data Platform] local service unavailable; bundled official snapshot remains active:', error && error.message ? error.message : error);
  }

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
          const L = irgeztneNativeEditLabels();
          const hasSelection = Boolean(params.selectionText && String(params.selectionText).trim());
          const canCopy = Boolean(params.editFlags && (params.editFlags.canCopy || hasSelection));
          const canCut = Boolean(params.editFlags && params.editFlags.canCut);
          const canPaste = Boolean(params.editFlags && params.editFlags.canPaste);

          const menu = Menu.buildFromTemplate([
            { label: L.cut, enabled: canCut, accelerator: 'CmdOrCtrl+X', click: () => contents.cut() },
            { label: L.copy, enabled: canCopy, accelerator: 'CmdOrCtrl+C', click: () => {
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
            { label: L.paste, enabled: canPaste, accelerator: 'CmdOrCtrl+V', click: () => contents.paste() },
            { type: 'separator' },
            { label: L.selectAll, accelerator: 'CmdOrCtrl+A', click: () => contents.selectAll() }
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

app.on('before-quit', () => {
  irgeztneWeatherWindowController.close();
  clearChatAttachmentOpenTempDir();
  clearWorkspaceFileOpenTempDir();
  if (irgeztneDataPlatformServer) {
    try { irgeztneDataPlatformServer.close(); } catch (_) {}
    irgeztneDataPlatformServer = null;
  }
  if (irgeztneMessengerController) {
    void irgeztneMessengerController.close().catch((error) => {
      console.warn('[Green Lightning] secure-local-service shutdown warning:', error && error.message ? error.message : error);
    });
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
