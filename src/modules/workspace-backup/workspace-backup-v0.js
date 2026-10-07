(function (root) {
  'use strict';

  var IDENTITY_KEY = 'irgeztne.workspace.identity.v0';
  var BACKUP_FORMAT = 'irgeztne.workspace.backup';
  var BACKUP_FORMAT_VERSION = 1;
  var SCHEMA_VERSION = '1.0.0-workspace-v0';

  var KNOWN_KEYS = [
    IDENTITY_KEY,
    'nsbrowser:v8:source-library',
    'ns.browser.v8.projects.v1',
    'irgeztne.workspace.tasks.v1',
    'ns.browser.v8.notes.v1',
    'irgeztne.documents.v1',
    'irgeztne.sitePages.v0',
    'irgeztne.webStudioSites.v1',
    'irgeztne.editorSiteStudioSafe.v4',
    'irgeztne:map:v1:pins',
    'ns.browser.v8.editor.v1',
    'nsbrowser:v1:codehub-items',
    'nsbrowser:v1:knowledge-packs',
    'ns.browser.v8.tools.v1',
    'ns.browser.v8.vitrina.v1',
    'ns.browser.v8.site-profile.v1',
    'nsbrowser.v8.bookmarks',
    'nsbrowser.v8.language',
    'irgeztne-workshop-installed-v1',
    'nsbrowser:v8:knowledge-library',
    'ns.browser.v8.editor.v1.backup',
    'nsbrowser.v8.browser.source'
  ];

  function isWorkspaceKey(key) {
    var value = String(key || '');
    return KNOWN_KEYS.indexOf(value) >= 0;
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function uid(prefix) {
    return String(prefix || 'id') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9);
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function getLang() {
    try {
      if (root.__IRG_BROWSER_SHELL_API && typeof root.__IRG_BROWSER_SHELL_API.getLanguage === 'function') {
        return root.__IRG_BROWSER_SHELL_API.getLanguage() === 'ru' ? 'ru' : 'en';
      }
    } catch (error) {}
    var htmlLang = (document.documentElement.getAttribute('lang') || '').toLowerCase();
    return htmlLang === 'en' ? 'en' : 'ru';
  }

  function t(ru, en) {
    return getLang() === 'ru' ? ru : en;
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function readJson(key, fallback) {
    try {
      var raw = root.localStorage.getItem(key);
      if (!raw) return clone(fallback);
      return JSON.parse(raw);
    } catch (error) {
      return clone(fallback);
    }
  }

  function writeJson(key, value) {
    root.localStorage.setItem(key, JSON.stringify(value, null, 2));
  }

  function normalizeIdentity(raw) {
    var source = raw && typeof raw === 'object' ? raw : {};
    var createdAt = source.createdAt ? String(source.createdAt) : nowIso();
    return {
      workspaceId: source.workspaceId ? String(source.workspaceId) : uid('workspace'),
      schemaVersion: source.schemaVersion ? String(source.schemaVersion) : SCHEMA_VERSION,
      createdAt: createdAt,
      updatedAt: source.updatedAt ? String(source.updatedAt) : createdAt,
      lastBackupAt: source.lastBackupAt ? String(source.lastBackupAt) : '',
      lastImportAt: source.lastImportAt ? String(source.lastImportAt) : '',
      localOnly: source.localOnly !== false
    };
  }

  function getIdentity() {
    var identity = normalizeIdentity(readJson(IDENTITY_KEY, {}));
    writeJson(IDENTITY_KEY, identity);
    return identity;
  }

  function updateIdentity(patch) {
    var identity = normalizeIdentity(Object.assign({}, getIdentity(), patch || {}, { updatedAt: nowIso() }));
    writeJson(IDENTITY_KEY, identity);
    return identity;
  }

  function stripBackupCredentials(value) {
    if (Array.isArray(value)) return value.map(stripBackupCredentials);
    if (value && typeof value === 'object') {
      var result = {};
      Object.keys(value).forEach(function (key) {
        if (/^(token|password|privateKey|secretKey|accessKey|recoveryPhrase|masterCredential|credential|refreshToken|accessToken|authorization|hasToken|hasPassword|hasPrivateKey|hasSecretKey|hasAccessKey|tokenPreview|passwordPreview|secretKeyPreview|accessKeyPreview|__proto__|constructor|prototype)$/i.test(key)) return;
        result[key] = stripBackupCredentials(value[key]);
      });
      return result;
    }
    return value;
  }

  function collectStorage() {
    var result = {};
    try {
      for (var index = 0; index < root.localStorage.length; index += 1) {
        var key = root.localStorage.key(index);
        if (!key || !isWorkspaceKey(key)) continue;
        var value = root.localStorage.getItem(key);
        if (value != null) {
          try { result[key] = JSON.stringify(stripBackupCredentials(JSON.parse(value))); }
          catch (_) { result[key] = value; }
        }
      }
    } catch (error) {
      console.warn('[IRGEZTNE Backup] collect failed', error);
    }
    return result;
  }

  function getArrayCount(key, prop) {
    var parsed = readJson(key, null);
    if (Array.isArray(parsed)) return parsed.length;
    if (parsed && Array.isArray(parsed[prop || 'items'])) return parsed[prop || 'items'].length;
    if (parsed && Array.isArray(parsed.drafts)) return parsed.drafts.length;
    if (parsed && parsed.rooms && Array.isArray(parsed.rooms)) return parsed.rooms.length;
    return 0;
  }

  function getWebStudioSiteStats() {
    var manager = null;
    try { if (root.nsAPI && root.nsAPI.storageGetModuleStateSync) manager = root.nsAPI.storageGetModuleStateSync('webstudio.siteManager.v1', null); } catch (_) {}
    if (!manager) manager = readJson('irgeztne.webStudioSites.v1', null);
    if (manager && Array.isArray(manager.sites)) {
      var pages = manager.sites.reduce(function (total, site) {
        return total + (site && site.state && Array.isArray(site.state.pages) ? site.state.pages.length : 0);
      }, 0);
      return { sites: manager.sites.length, pages: pages };
    }
    var single = readJson('irgeztne.editorSiteStudioSafe.v4', null);
    if (single && Array.isArray(single.pages)) return { sites: 1, pages: single.pages.length };
    return { sites: 0, pages: getArrayCount('irgeztne.sitePages.v0', 'pages') };
  }

  function getStats() {
    var webStudio = getWebStudioSiteStats();
    return {
      files: getArrayCount('nsbrowser:v8:source-library', 'items'),
      projects: getArrayCount('ns.browser.v8.projects.v1', 'items'),
      notes: getArrayCount('ns.browser.v8.notes.v1', 'items'),
      tasks: getArrayCount('irgeztne.workspace.tasks.v1', 'tasks'),
      documents: getArrayCount('irgeztne.documents.v1', 'items'),
      sites: webStudio.sites,
      pages: webStudio.pages,
      sitePages: webStudio.pages,
      mapPoints: getArrayCount('irgeztne:map:v1:pins'),
      drafts: getArrayCount('ns.browser.v8.editor.v1', 'drafts'),
      packages: getArrayCount('nsbrowser:v1:codehub-items', 'items'),
      bookmarks: getArrayCount('nsbrowser.v8.bookmarks')
    };
  }

  function formatDate(value) {
    if (!value) return '—';
    try {
      return new Date(value).toLocaleString(getLang() === 'ru' ? 'ru-RU' : 'en-US', {
        dateStyle: 'short',
        timeStyle: 'short'
      });
    } catch (error) {
      return String(value);
    }
  }

  function formatBytes(value) {
    var bytes = Number(value || 0);
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
    if (bytes < 1024 * 1024) return Math.max(1, Math.round(bytes / 1024)) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function buildBackup() {
    var exportedAt = nowIso();
    var identity = updateIdentity({ lastBackupAt: exportedAt });
    var storage = collectStorage();
    var textSize = Object.keys(storage).reduce(function (total, key) {
      return total + key.length + String(storage[key] || '').length;
    }, 0);

    return {
      format: BACKUP_FORMAT,
      formatVersion: BACKUP_FORMAT_VERSION,
      metadataOnly: true,
      physicalAssetsIncluded: false,
      app: 'IRGEZTNE Workspace',
      exportedAt: exportedAt,
      workspace: identity,
      stats: getStats(),
      storageSizeBytes: textSize,
      storage: storage
    };
  }

  async function downloadBackup() {
    if (root.nsAPI && root.nsAPI.workspaceBackupExport) {
      try {
        var result = await root.nsAPI.workspaceBackupExport({ storage: collectStorage(), language: getLang() });
        if (result.ok) { updateIdentity({ lastBackupAt: nowIso() }); renderPanel(); setStatus(t('Полный backup создан, включая физические файлы.', 'Full backup created, including physical files.')); }
        else if (!result.canceled) setStatus(result.error || t('Не удалось создать backup.', 'Backup failed.'));
      } catch (error) { setStatus(error.message); }
      return;
    }
    setStatus(t('Полный backup доступен в настольном приложении. Экспорт метаданных не является полным backup.', 'Full backup is available in the desktop app. Metadata export is not a full backup.'));
    return;
  }

  function clearWorkspaceStorage() {
    var remove = [];
    for (var index = 0; index < root.localStorage.length; index += 1) {
      var key = root.localStorage.key(index);
      if (key && isWorkspaceKey(key)) remove.push(key);
    }
    remove.forEach(function (key) {
      root.localStorage.removeItem(key);
    });
  }

  async function importBackup(data) {
    if (!root.nsAPI || !root.nsAPI.workspaceBackupImport) {
      setStatus(t('Восстановление полного backup доступно в настольном приложении.', 'Full backup restore is available in the desktop app.'));
      return;
    }
    try {
      var result = await root.nsAPI.workspaceBackupImport({ storage: collectStorage(), language: getLang() });
      if (!result.ok) { if (!result.canceled) setStatus(result.error || t('Восстановление не выполнено.', 'Restore failed.')); return; }
      clearWorkspaceStorage();
      Object.keys(result.storage || {}).forEach(function (key) {
        if (isWorkspaceKey(key)) root.localStorage.setItem(key, result.storage[key]);
      });
      updateIdentity({ lastImportAt: nowIso() });
      root.location.reload();
    } catch (error) { setStatus(error.message); }
  }

  function createPanel() {
    if (document.getElementById('workspaceBackupPanel')) return;

    var overlay = document.createElement('div');
    overlay.id = 'workspaceBackupOverlay';
    overlay.className = 'workspace-backup-overlay hidden';
    overlay.setAttribute('data-workspace-backup-close', '');

    var panel = document.createElement('section');
    panel.id = 'workspaceBackupPanel';
    panel.className = 'workspace-backup-panel hidden';
    panel.setAttribute('aria-hidden', 'true');
    panel.innerHTML = '<div id="workspaceBackupContent"></div>';

    document.body.appendChild(overlay);
    document.body.appendChild(panel);
  }

  function statCard(label, value) {
    return '<div class="workspace-backup-stat"><span>' + escapeHtml(label) + '</span><strong>' + escapeHtml(String(value || 0)) + '</strong></div>';
  }

  function renderPanel() {
    createPanel();
    var rootNode = document.getElementById('workspaceBackupContent');
    if (!rootNode) return;

    var identity = getIdentity();
    var stats = getStats();
    var storage = collectStorage();
    var storageSize = Object.keys(storage).reduce(function (total, key) {
      return total + key.length + String(storage[key] || '').length;
    }, 0);

    rootNode.innerHTML = [
      '<div class="workspace-backup-head">',
      '  <div>',
      '    <div class="workspace-backup-kicker">IRGEZTNE · Workspace</div>',
      '    <h2>' + escapeHtml(t('Backup / перенос workspace', 'Workspace Backup / Migration')) + '</h2>',
      '    <p>' + escapeHtml(t('Локальный backup для переноса и восстановления. Аккаунт не нужен для локального backup workspace.', 'Local backup for transfer and restore. Account is not required for local workspace backup.')) + '</p>',
      '  </div>',
      '  <button type="button" class="workspace-backup-close" data-workspace-backup-close aria-label="' + escapeHtml(t('Закрыть', 'Close')) + '">×</button>',
      '</div>',
      '<div class="workspace-backup-identity">',
      '  <div><span>' + escapeHtml(t('Workspace ID', 'Workspace ID')) + '</span><code>' + escapeHtml(identity.workspaceId) + '</code></div>',
      '  <div><span>' + escapeHtml(t('Schema', 'Schema')) + '</span><code>' + escapeHtml(identity.schemaVersion) + '</code></div>',
      '  <div><span>' + escapeHtml(t('Создан', 'Created')) + '</span><strong>' + escapeHtml(formatDate(identity.createdAt)) + '</strong></div>',
      '  <div><span>' + escapeHtml(t('Последний backup', 'Last backup')) + '</span><strong>' + escapeHtml(formatDate(identity.lastBackupAt)) + '</strong></div>',
      '</div>',
      '<div class="workspace-backup-stats">',
      statCard(t('Файлы', 'Files'), stats.files),
      statCard(t('Проекты', 'Projects'), stats.projects),
      statCard(t('Заметки', 'Notes'), stats.notes),
      statCard(t('Задачи', 'Tasks'), stats.tasks),
      statCard(t('Документы', 'Documents'), stats.documents),
      statCard(t('Сайты', 'Sites'), stats.sites),
      statCard(t('Страницы', 'Pages'), stats.sitePages),
      statCard(t('Элементы', 'Workspace items'), stats.mapPoints),
      statCard(t('Черновики', 'Drafts'), stats.drafts),
      '</div>',
      '<div class="workspace-backup-actions">',
      '  <button type="button" class="workspace-backup-primary" data-workspace-backup-export>' + escapeHtml(t('Экспортировать backup', 'Export backup')) + '</button>',
      '  <button type="button" data-workspace-backup-import>' + escapeHtml(t('Импортировать backup', 'Import backup')) + '</button>',
      '</div>',
      '<div class="workspace-backup-note">',
      '  <strong>' + escapeHtml(t('Что сохраняется:', 'Saved data:')) + '</strong> ',
      escapeHtml(t('проекты, задачи, заметки, документы, сайты и страницы Web Studio, медиа, физические файлы и закладки. Account, Chat и данные доступа не включаются. Размер локальных метаданных примерно ', 'projects, tasks, notes, documents, Web Studio sites/pages, media, physical files, and bookmarks. Account, Chat, and credentials are excluded. Local metadata size is about ')),
      '<strong>' + escapeHtml(formatBytes(storageSize)) + '</strong>. ',
      escapeHtml(t('Лимит физических файлов в одном backup: 256 MiB. При превышении лимита или отсутствии файлов экспорт не создаёт неполную копию.', 'Physical files limit per backup: 256 MiB. Export refuses incomplete copies when the limit is exceeded or files are missing.')),
      '</div>',
      '<div class="workspace-backup-status" id="workspaceBackupStatus" role="status" aria-live="polite"></div>'
    ].join('');
  }

  function openPanel() {
    renderPanel();
    var overlay = document.getElementById('workspaceBackupOverlay');
    var panel = document.getElementById('workspaceBackupPanel');
    if (overlay) overlay.classList.remove('hidden');
    if (panel) {
      panel.classList.remove('hidden');
      panel.setAttribute('aria-hidden', 'false');
    }
  }

  function closePanel() {
    var overlay = document.getElementById('workspaceBackupOverlay');
    var panel = document.getElementById('workspaceBackupPanel');
    if (overlay) overlay.classList.add('hidden');
    if (panel) {
      panel.classList.add('hidden');
      panel.setAttribute('aria-hidden', 'true');
    }
  }

  function setStatus(message) {
    createPanel();
    var node = document.getElementById('workspaceBackupStatus');
    if (node) node.textContent = message;
    try {
      document.dispatchEvent(new CustomEvent('irgeztne:workspace-backup-status', { detail: { message: message } }));
    } catch (error) {}
  }

  function bind() {
    document.addEventListener('click', function (event) {
      if (event.target.closest('[data-workspace-backup-close]')) {
        closePanel();
        return;
      }

      if (event.target.closest('[data-workspace-backup-export]')) {
        downloadBackup();
        return;
      }

      if (event.target.closest('[data-workspace-backup-import]')) {
        void importBackup();
      }
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') closePanel();
    });

    document.addEventListener('irg:language-changed', function () {
      var panel = document.getElementById('workspaceBackupPanel');
      if (panel && !panel.classList.contains('hidden')) renderPanel();
    });
  }

  getIdentity();
  bind();

  root.NSWorkspaceBackup = {
    getIdentity: getIdentity,
    getStats: getStats,
    buildBackup: buildBackup,
    exportBackup: downloadBackup,
    importBackup: importBackup,
    openPanel: openPanel,
    closePanel: closePanel
  };
})(window);
