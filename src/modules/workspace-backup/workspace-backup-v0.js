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
    'irgeztne.ecosystem.rooms.v0',
    'irgeztne.ecosystem.filiStore.v0',
    'irgeztne.ecosystem.filiSafe.v0',
    'nsbrowser.v8.bookmarks',
    'nsbrowser.v8.language',
    'nsbrowser.v8.browser.source'
  ];

  function isWorkspaceKey(key) {
    var value = String(key || '');
    return KNOWN_KEYS.indexOf(value) >= 0 ||
      value.indexOf('irgeztne.') === 0 ||
      value.indexOf('irgeztne:') === 0 ||
      value.indexOf('nsbrowser') === 0 ||
      value.indexOf('ns.browser') === 0;
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

  function collectStorage() {
    var result = {};
    try {
      for (var index = 0; index < root.localStorage.length; index += 1) {
        var key = root.localStorage.key(index);
        if (!key || !isWorkspaceKey(key)) continue;
        var value = root.localStorage.getItem(key);
        if (value != null) result[key] = value;
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
    var manager = readJson('irgeztne.webStudioSites.v1', null);
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
      app: 'IRGEZTNE Workspace',
      exportedAt: exportedAt,
      workspace: identity,
      stats: getStats(),
      storageSizeBytes: textSize,
      storage: storage
    };
  }

  function getDownloadName(backup) {
    var stamp = String((backup && backup.exportedAt) || nowIso())
      .replace(/[-:]/g, '')
      .replace('T', '-')
      .replace(/\.\d+Z$/, '');
    var workspaceId = String((backup && backup.workspace && backup.workspace.workspaceId) || 'workspace').replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 40);
    return 'irgeztne-backup-' + workspaceId + '-' + stamp + '.json';
  }

  function downloadBackup() {
    var backup = buildBackup();
    var text = JSON.stringify(backup, null, 2);
    var blob = new Blob([text], { type: 'application/json;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = getDownloadName(backup);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    setStatus(t('Backup-файл создан. Сохраните его в безопасном месте.', 'Backup file created. Keep it somewhere safe.'));
    renderPanel();
  }

  function validateBackup(data) {
    if (!data || typeof data !== 'object') return 'empty';
    if (data.format !== BACKUP_FORMAT) return 'format';
    if (!data.storage || typeof data.storage !== 'object') return 'storage';
    return '';
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

  function importBackup(data) {
    var error = validateBackup(data);
    if (error) {
      setStatus(t('Файл не похож на backup IRGEZTNE Workspace.', 'This file does not look like an IRGEZTNE Workspace backup.'));
      return;
    }

    var ok = root.confirm(t(
      'Импорт заменит текущие локальные данные workspace данными из backup. Продолжить?',
      'Import will replace current local workspace data with the backup. Continue?'
    ));
    if (!ok) return;

    clearWorkspaceStorage();
    Object.keys(data.storage).forEach(function (key) {
      if (!isWorkspaceKey(key)) return;
      root.localStorage.setItem(key, String(data.storage[key] || ''));
    });
    updateIdentity({ lastImportAt: nowIso() });
    setStatus(t('Backup импортирован. Приложение перезагрузится.', 'Backup imported. The app will reload.'));
    window.setTimeout(function () {
      root.location.reload();
    }, 700);
  }

  function readFile(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(String(reader.result || '')); };
      reader.onerror = function () { reject(reader.error || new Error('Failed to read file')); };
      reader.readAsText(file, 'utf-8');
    });
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
      '    <div class="workspace-backup-kicker">IRGEZTNE · Workspace Identity v0</div>',
      '    <h2>' + escapeHtml(t('Backup / перенос workspace', 'Workspace Backup / Migration')) + '</h2>',
      '    <p>' + escapeHtml(t('Локальный backup для переноса, восстановления и будущей синхронизации. Аккаунт не нужен для локального backup workspace.', 'Local backup for transfer, restore, and future sync. Account is not required for local workspace backup.')) + '</p>',
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
      statCard(t('Документы', 'Documents'), stats.documents),
      statCard(t('Сайты', 'Sites'), stats.sites),
      statCard(t('Страницы', 'Pages'), stats.sitePages),
      statCard(t('Элементы', 'Workspace items'), stats.mapPoints),
      statCard(t('Черновики', 'Drafts'), stats.drafts),
      '</div>',
      '<div class="workspace-backup-actions">',
      '  <button type="button" class="workspace-backup-primary" data-workspace-backup-export>' + escapeHtml(t('Экспортировать backup', 'Export backup')) + '</button>',
      '  <button type="button" data-workspace-backup-import>' + escapeHtml(t('Импортировать backup', 'Import backup')) + '</button>',
      '  <input type="file" accept="application/json,.json" id="workspaceBackupFile" hidden />',
      '</div>',
      '<div class="workspace-backup-note">',
      '  <strong>' + escapeHtml(t('Что сохраняется:', 'Saved data:')) + '</strong> ',
      escapeHtml(t('проекты, файлы и ассеты, заметки, документы, сайты и страницы Web Studio, черновики, настройки и рабочие закладки. Размер сейчас примерно ', 'projects, files and assets, notes, documents, Web Studio sites/pages, drafts, settings, and workspace bookmarks. Current size is about ')),
      '<strong>' + escapeHtml(formatBytes(storageSize)) + '</strong>.',
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
        var input = document.getElementById('workspaceBackupFile');
        if (input) input.click();
      }
    });

    document.addEventListener('change', function (event) {
      var input = event.target && event.target.id === 'workspaceBackupFile' ? event.target : null;
      if (!input || !input.files || !input.files[0]) return;
      readFile(input.files[0]).then(function (text) {
        input.value = '';
        try {
          importBackup(JSON.parse(text));
        } catch (error) {
          setStatus(t('Не удалось прочитать JSON backup.', 'Could not read backup JSON.'));
        }
      }).catch(function () {
        setStatus(t('Не удалось открыть файл backup.', 'Could not open backup file.'));
      });
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
