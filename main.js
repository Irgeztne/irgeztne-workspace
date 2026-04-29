process.env.ELECTRON_DISABLE_SANDBOX = '1';
const { app, BrowserWindow, Menu, ipcMain, shell } = require('electron');
const { spawn, spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const { pathToFileURL } = require('url');

const DATA_DIR = app.isPackaged ? path.join(app.getPath('userData'), 'data') : path.join(__dirname, 'data');
const PAGES_DIR = path.join(DATA_DIR, 'pages');
const TEMPLATES_DIR = path.join(__dirname, 'templates');
const INDEX_FILE = path.join(__dirname, 'index.html');
const INDEX_URL = pathToFileURL(INDEX_FILE).toString();

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

async function writePreviewPackage(payload) {
  const packageFiles = payload && payload.package && typeof payload.package === 'object' ? payload.package : {};
  const slugBase = sanitizeSlug(payload?.slug || payload?.title || 'preview');
  const previewId = `${slugBase}-${Date.now()}`;
  const previewDir = path.join(getPreviewsDir(), previewId);
  const contentDir = path.join(previewDir, 'content');
  ensureDir(previewDir);
  ensureDir(contentDir);

  const indexHtml = sanitizePlainText(packageFiles['index.html'] || '<!doctype html><html><body><h1>Empty preview</h1></body></html>', 4_000_000);
  const stylesCss = sanitizePlainText(packageFiles['styles.css'] || '', 2_000_000);
  const pageJson = sanitizePlainText(packageFiles['content/page.json'] || '{}', 2_000_000);
  const metaJson = sanitizePlainText(packageFiles['meta.json'] || '{}', 2_000_000);

  const indexPath = path.join(previewDir, sanitizeFileName('index.html', 'index.html'));
  const stylesPath = path.join(previewDir, sanitizeFileName('styles.css', 'styles.css'));
  const pageJsonPath = path.join(contentDir, sanitizeFileName('page.json', 'page.json'));
  const metaJsonPath = path.join(previewDir, sanitizeFileName('meta.json', 'meta.json'));

  await fsp.writeFile(indexPath, indexHtml, 'utf8');
  await fsp.writeFile(stylesPath, stylesCss, 'utf8');
  await fsp.writeFile(pageJsonPath, pageJson, 'utf8');
  await fsp.writeFile(metaJsonPath, metaJson, 'utf8');

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
      { label: 'Copy', enabled: canCopy, accelerator: 'CmdOrCtrl+C', click: () => win.webContents.copy() },
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
    width: 1400,
    height: 900,
    backgroundColor: '#111111',
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
