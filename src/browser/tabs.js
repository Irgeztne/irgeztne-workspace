import { SOURCES } from './sources-ui.js';

const WORKSPACE_START_URL = 'irgeztne://workspace';

const WORKSPACE_START_TITLE = 'IRGEZTNE Workspace';

function makeTabId(state) {
  state.tabCounter += 1;
  return `tab_${Date.now()}_${state.tabCounter}`;
}

function getSourceHomeUrl(state) {
  const source = SOURCES[state.currentSource] || SOURCES.google;
  if (source && source.home) return source.home;
  if (source && typeof source.buildSearchUrl === 'function') {
    const built = source.buildSearchUrl('');
    if (built) return built;
  }
  return SOURCES.google.home;
}

function isWorkspaceStartUrl(url) {
  return String(url || '').trim().toLowerCase().startsWith(WORKSPACE_START_URL);
}

function createWorkspaceStartTabData() {
  return {
    url: WORKSPACE_START_URL,
    title: WORKSPACE_START_TITLE,
    displayUrl: WORKSPACE_START_URL,
    sourceType: 'workspace',
    kind: 'workspace-start'
  };
}

function esc(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}


function startLang(ru, en) {
  return `<span class="irgeztne-start-lang-ru">${esc(ru)}</span><span class="irgeztne-start-lang-en">${esc(en)}</span>`;
}

// IRGEZTNE_MAIN_HOME_WORKING_ACTIONS_R1T
// Workspace Home must resume real persisted work instead of showing static demo routes.
const WEBSTUDIO_MANAGER_STATE_KEY = 'webstudio.siteManager.v1';
const WEBSTUDIO_MANAGER_LEGACY_KEY = 'irgeztne.webStudioSites.v1';
const WORKSPACE_RECENT_KEY = 'irgeztne.workspace.home.recent.v1';
const WORKSPACE_RECENT_SECTIONS = new Set(['site-pages', 'projects', 'files', 'documents', 'notes', 'tasks']);


function readJsonStorage(key) {
  try {
    const raw = window.localStorage ? window.localStorage.getItem(key) : '';
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
}

function readWorkspaceResumeSite() {
  let manager = null;
  try {
    const api = window.nsAPI;
    if (api && typeof api.storageGetModuleStateSync === 'function') {
      const stored = api.storageGetModuleStateSync(WEBSTUDIO_MANAGER_STATE_KEY, null);
      if (stored && typeof stored === 'object') manager = stored;
    }
  } catch (error) {}

  if (!manager) manager = readJsonStorage(WEBSTUDIO_MANAGER_LEGACY_KEY);

  if (manager && Array.isArray(manager.sites) && manager.sites.length) {
    const activeId = String(manager.activeSiteId || '');
    const site = manager.sites.find((item) => String(item && item.id || '') === activeId) || manager.sites[0];
    if (site) {
      return {
        id: String(site.id || ''),
        title: String(site.name || (site.state && site.state.site && site.state.site.name) || 'Website'),
        updatedAt: String(site.updatedAt || (site.state && site.state.updatedAt) || '')
      };
    }
  }

  try {
    const api = window.IRGEZTNESiteStudioSafeV5;
    if (api && typeof api.readState === 'function') {
      const state = api.readState();
      if (state && state.site) {
        return {
          id: String(state.site.localSiteId || ''),
          title: String(state.site.name || 'Website'),
          updatedAt: String(state.updatedAt || '')
        };
      }
    }
  } catch (error) {}

  return null;
}

function readWorkspaceResumeProject() {
  try {
    const store = window.NSProjectStore;
    if (!store) return null;
    const lastId = typeof store.getLastOpenedProjectId === 'function'
      ? String(store.getLastOpenedProjectId() || '')
      : '';
    let project = lastId && typeof store.getById === 'function' ? store.getById(lastId) : null;
    if (!project && typeof store.getAll === 'function') {
      const items = store.getAll() || [];
      project = items[0] || null;
    }
    if (!project) return null;
    return {
      id: String(project.id || ''),
      title: String(project.title || 'Project'),
      updatedAt: String(project.updatedAt || '')
    };
  } catch (error) {
    return null;
  }
}

function readWorkspaceResumeFile() {
  try {
    const store = window.NSLibraryStore;
    if (!store || typeof store.getState !== 'function') return null;
    const state = store.getState() || {};
    const activeId = String(state.activeId || '');
    let item = activeId && typeof store.getItemById === 'function' ? store.getItemById(activeId) : null;
    if (!item) {
      const items = Array.isArray(state.items) ? state.items.slice() : [];
      items.sort((a, b) => Date.parse(b && b.updatedAt || '') - Date.parse(a && a.updatedAt || ''));
      item = items[0] || null;
    }
    if (!item) return null;
    return {
      id: String(item.id || ''),
      title: String(item.name || item.originalName || 'File'),
      updatedAt: String(item.updatedAt || item.createdAt || '')
    };
  } catch (error) {
    return null;
  }
}

// IRGEZTNE_MAIN_HOME_RECENT_WORK_R1T1
// Continue Work follows actual workspace navigation, while reusing each module's canonical active item.
function readWorkspaceResumeOffice() {
  try {
    const api = window.NSOfficeV1;
    if (!api) return null;
    let item = typeof api.getActiveObject === 'function' ? api.getActiveObject() : null;
    if (!item && typeof api.getAllObjects === 'function') {
      const items = (api.getAllObjects() || []).slice();
      items.sort((a, b) => Date.parse(b && b.updatedAt || '') - Date.parse(a && a.updatedAt || ''));
      item = items[0] || null;
    }
    if (!item) return null;
    return {
      id: String(item.id || ''),
      title: String(item.title || 'Office'),
      updatedAt: String(item.updatedAt || item.createdAt || '')
    };
  } catch (error) {
    return null;
  }
}

function readWorkspaceResumeNote() {
  try {
    const store = window.NSNotesStore;
    if (!store) return null;
    const lastId = typeof store.getLastOpenedNoteId === 'function'
      ? String(store.getLastOpenedNoteId() || '')
      : '';
    let item = lastId && typeof store.getById === 'function' ? store.getById(lastId) : null;
    if (!item && typeof store.getAll === 'function') {
      const items = (store.getAll() || []).slice();
      items.sort((a, b) => Date.parse(b && b.updatedAt || '') - Date.parse(a && a.updatedAt || ''));
      item = items[0] || null;
    }
    if (!item) return null;
    return {
      id: String(item.id || ''),
      title: String(item.title || 'Note'),
      updatedAt: String(item.updatedAt || item.createdAt || '')
    };
  } catch (error) {
    return null;
  }
}

function readWorkspaceResumeTask() {
  try {
    const store = window.NSTaskStoreV1;
    if (!store) return null;
    const snapshot = typeof store.getState === 'function' ? (store.getState() || {}) : {};
    const lastId = String(snapshot && snapshot.meta && snapshot.meta.lastOpenedTaskId || '');
    let item = lastId && typeof store.getById === 'function' ? store.getById(lastId) : null;
    if (!item && typeof store.getAll === 'function') {
      const items = (store.getAll() || []).slice();
      items.sort((a, b) => Date.parse(b && b.updatedAt || '') - Date.parse(a && a.updatedAt || ''));
      item = items[0] || null;
    }
    if (!item) return null;
    return {
      id: String(item.id || ''),
      title: String(item.title || 'Task'),
      updatedAt: String(item.updatedAt || item.createdAt || '')
    };
  } catch (error) {
    return null;
  }
}

function readWorkspaceRecentHistory() {
  const stored = readJsonStorage(WORKSPACE_RECENT_KEY);
  const items = Array.isArray(stored) ? stored : (stored && Array.isArray(stored.items) ? stored.items : []);
  return items
    .filter((item) => item && WORKSPACE_RECENT_SECTIONS.has(String(item.section || '')))
    .map((item) => ({ section: String(item.section || ''), openedAt: String(item.openedAt || '') }))
    .sort((a, b) => Date.parse(b.openedAt || '') - Date.parse(a.openedAt || ''));
}

function writeWorkspaceRecentHistory(items) {
  try {
    if (!window.localStorage) return;
    window.localStorage.setItem(WORKSPACE_RECENT_KEY, JSON.stringify({
      version: 1,
      items: (Array.isArray(items) ? items : []).slice(0, 12)
    }));
  } catch (error) {}
}

function recordWorkspaceRecentSection(section) {
  const safe = String(section || '').trim();
  if (!WORKSPACE_RECENT_SECTIONS.has(safe)) return;
  const remaining = readWorkspaceRecentHistory().filter((item) => item.section !== safe);
  writeWorkspaceRecentHistory([{ section: safe, openedAt: new Date().toISOString() }, ...remaining]);
}

function bindWorkspaceRecentTracking() {
  const root = document.documentElement;
  if (!root || root.dataset.irWorkspaceRecentR1t1 === '1') return;
  root.dataset.irWorkspaceRecentR1t1 = '1';
  document.addEventListener('click', (event) => {
    const target = event.target && event.target.closest
      ? event.target.closest('[data-open-section], [data-section]')
      : null;
    if (!target) return;
    const section = String(target.getAttribute('data-open-section') || target.getAttribute('data-section') || '').trim();
    recordWorkspaceRecentSection(section);
  }, true);
}

function workspaceResumeDescriptor(section) {
  const safe = String(section || '');
  if (safe === 'site-pages') {
    const item = readWorkspaceResumeSite();
    return { section: safe, kind: 'site', id: item ? item.id : '', title: item ? item.title : '', updatedAt: item ? item.updatedAt : '' };
  }
  if (safe === 'projects') {
    const item = readWorkspaceResumeProject();
    return { section: safe, kind: 'project', id: item ? item.id : '', title: item ? item.title : '', updatedAt: item ? item.updatedAt : '' };
  }
  if (safe === 'files') {
    const item = readWorkspaceResumeFile();
    return { section: safe, kind: 'file', id: item ? item.id : '', title: item ? item.title : '', updatedAt: item ? item.updatedAt : '' };
  }
  if (safe === 'documents') {
    const item = readWorkspaceResumeOffice();
    return { section: safe, kind: 'office', id: item ? item.id : '', title: item ? item.title : '', updatedAt: item ? item.updatedAt : '' };
  }
  if (safe === 'notes') {
    const item = readWorkspaceResumeNote();
    return { section: safe, kind: 'note', id: item ? item.id : '', title: item ? item.title : '', updatedAt: item ? item.updatedAt : '' };
  }
  if (safe === 'tasks') {
    const item = readWorkspaceResumeTask();
    return { section: safe, kind: 'task', id: item ? item.id : '', title: item ? item.title : '', updatedAt: item ? item.updatedAt : '' };
  }
  return null;
}

function workspaceResumeTitle(item) {
  if (item && item.title) return esc(item.title);
  const kind = String(item && item.kind || '');
  if (kind === 'site') return startLang('Веб-студия', 'Web Studio');
  if (kind === 'project') return startLang('Проекты', 'Projects');
  if (kind === 'file') return startLang('Файлы', 'Files');
  if (kind === 'office') return startLang('Офис', 'Office');
  if (kind === 'note') return startLang('Заметки', 'Notes');
  if (kind === 'task') return startLang('Задачи', 'Tasks');
  return startLang('Работа', 'Work');
}

function workspaceResumeSubtitle(kind) {
  if (kind === 'site') return startLang('Сайт · продолжить редактирование', 'Site · continue editing');
  if (kind === 'project') return startLang('Проект · вернуться в рабочий контекст', 'Project · return to work context');
  if (kind === 'file') return startLang('Файл · открыть выбранный материал', 'File · open selected material');
  if (kind === 'office') return startLang('Офис · продолжить документ или рабочий объект', 'Office · continue the document or work object');
  if (kind === 'note') return startLang('Заметка · продолжить запись', 'Note · continue writing');
  if (kind === 'task') return startLang('Задача · продолжить выполнение', 'Task · continue work');
  return startLang('Продолжить работу', 'Continue work');
}

function openWorkspaceFullSection(section) {
  const safe = String(section || '').trim();
  if (!safe) return false;
  const fullButton = document.querySelector(`.cabinet-inner-nav-btn[data-section="${safe}"]`);
  if (fullButton && typeof fullButton.click === 'function') {
    fullButton.click();
    return true;
  }
  const fallback = document.querySelector(`[data-open-section="${safe}"]`);
  if (fallback && typeof fallback.click === 'function') {
    fallback.click();
    return true;
  }
  return false;
}

function openWorkspaceStudioTab(tabId) {
  let tries = 0;
  const attempt = () => {
    tries += 1;
    const api = window.IRGEZTNESiteStudioSafeV5;
    if (api && typeof api.openTab === 'function') {
      api.openTab(tabId || 'page');
      return;
    }
    if (tries < 30) window.setTimeout(attempt, 100);
  };
  attempt();
}

function openWorkspaceNewProject() {
  openWorkspaceFullSection('projects');
  let tries = 0;
  const attempt = () => {
    tries += 1;
    const buttons = Array.from(document.querySelectorAll('[data-projects-root] [data-projects-new]'));
    const visible = buttons.find((button) => {
      try { return button.offsetParent !== null; } catch (error) { return false; }
    });
    const button = visible || buttons[0];
    if (button && typeof button.click === 'function') {
      button.click();
      return;
    }
    if (tries < 30) window.setTimeout(attempt, 100);
  };
  window.setTimeout(attempt, 0);
}

// IRGEZTNE Workspace v031m Start Page Navigation Owner
function renderWorkspaceStartPane(state) {
  const pane = document.createElement('div');
  pane.className = 'irgeztne-start-page irgeztne-start-page--v2';
  pane.innerHTML = `
    <div class="irgeztne-start-bg" aria-hidden="true"></div>
    <aside class="irgeztne-start-rail" aria-label="IRGEZTNE workspace navigation">
      <div class="irgeztne-start-rail-head">
        <strong>${startLang('Пространство', 'Workspace')}</strong>
        <span>${startLang('Рабочие зоны', 'Work zones')}</span>
      </div>
      <nav class="irgeztne-start-nav">
        <button type="button" class="active" data-start-focus="home"><span class="irgeztne-start-nav-icon">⌂</span><span class="irgeztne-start-nav-label">${startLang('Главная', 'Home')}</span></button>
        <button type="button" data-open-section="files"><span class="irgeztne-start-nav-icon">▣</span><span class="irgeztne-start-nav-label">${startLang('Файлы', 'Files')}</span></button>
        <button type="button" data-open-section="projects"><span class="irgeztne-start-nav-icon">▰</span><span class="irgeztne-start-nav-label">${startLang('Проекты', 'Projects')}</span></button>
        <button type="button" data-open-section="documents"><span class="irgeztne-start-nav-icon">▤</span><span class="irgeztne-start-nav-label">${startLang('Офис', 'Office')}</span></button>
        <button type="button" data-open-section="notes"><span class="irgeztne-start-nav-icon">✎</span><span class="irgeztne-start-nav-label">${startLang('Заметки', 'Notes')}</span></button>
        <button type="button" data-open-section="rooms"><span class="irgeztne-start-nav-icon">◌</span><span class="irgeztne-start-nav-label">${startLang('Чат', 'Chat')}</span></button>
        <button type="button" data-open-section="tasks"><span class="irgeztne-start-nav-icon">↗</span><span class="irgeztne-start-nav-label">${startLang('Задачи', 'Tasks')}</span></button>
        <button type="button" data-open-section="tools"><span class="irgeztne-start-nav-icon">⚙</span><span class="irgeztne-start-nav-label">${startLang('Инструменты', 'Tools')}</span></button>
        <button type="button" data-open-section="marketplace"><span class="irgeztne-start-nav-icon">▧</span><span class="irgeztne-start-nav-label">${startLang('Шаблоны', 'Templates')}</span></button>
        <button type="button" data-open-section="codehub"><span class="irgeztne-start-nav-icon">◇</span><span class="irgeztne-start-nav-label">${startLang('Мастерская', 'Workshop')}</span></button>
        <button type="button" data-open-section="site-pages"><span class="irgeztne-start-nav-icon">◈</span><span class="irgeztne-start-nav-label">Web Studio</span></button>
      </nav>
      <div class="irgeztne-start-rail-footer">
        <span class="irgeztne-start-status-dot"></span>
        <span>${startLang('Локальная оболочка', 'Local shell')}</span>
      </div>
    </aside>
    <section class="irgeztne-start-main">
      <div class="irgeztne-start-hero">
        <p class="irgeztne-start-kicker">IRGEZTNE Workspace</p>
        <h1>${startLang('Рабочее пространство', 'Workspace')}</h1>
        <p class="irgeztne-start-lead">${startLang('Сайты, файлы, проекты, заметки, публикация и общение.', 'Sites, files, projects, notes, publishing and communication.')}</p>
        <form class="irgeztne-start-search" data-start-search-form>
          <div class="irgeztne-start-source-picker" data-start-source-picker>
            <button type="button" class="irgeztne-start-source-toggle" data-start-source-toggle aria-expanded="false">
              <span data-start-source-label>${esc((SOURCES[state.currentSource] || SOURCES.google).label || 'Google')}</span>
              <span class="irgeztne-start-source-caret">⌄</span>
            </button>
            <div class="irgeztne-start-source-menu hidden" data-start-source-menu>
              <button type="button" data-start-source="google">Google</button>
              <button type="button" data-start-source="yandex">Yandex</button>
              <button type="button" data-start-source="duckduckgo">DuckDuckGo</button>
              <button type="button" data-start-source="wikipedia">Wikipedia</button>
            </div>
          </div>
          <button type="submit" class="irgeztne-start-search-submit" title="Search" aria-label="Search">⌕</button>
          <input type="text" autocomplete="off" spellcheck="false" placeholder="${esc('Поиск или адрес / Search or address')}" data-start-search-input />
        </form>
      </div>

      <div class="irgeztne-start-quick">
        <button type="button" class="irgeztne-start-card irgeztne-start-card--files" data-open-section="files" title="Open compact Files">
          <span class="irgeztne-start-icon">▣</span>
          <strong>${startLang('Файлы', 'Files')}</strong>
          <small>${startLang('Ассеты, изображения и материалы для текущей работы.', 'Assets, images and source materials for current work.')}</small>
        </button>
        <button type="button" class="irgeztne-start-card irgeztne-start-card--projects" data-open-section="projects" title="Open compact Projects">
          <span class="irgeztne-start-icon">▰</span>
          <strong>${startLang('Проекты', 'Projects')}</strong>
          <small>${startLang('Контейнеры работы, черновики и связанные материалы.', 'Work containers, drafts and linked materials.')}</small>
        </button>
        <button type="button" class="irgeztne-start-card irgeztne-start-card--office" data-open-section="documents" title="Open compact Office">
          <span class="irgeztne-start-icon">▤</span>
          <strong>${startLang('Офис', 'Office')}</strong>
          <small>${startLang('Документы, тексты, описания и рабочие записи.', 'Documents, texts, descriptions and working notes.')}</small>
        </button>
        <button type="button" class="irgeztne-start-card irgeztne-start-card--notes" data-open-section="notes" title="Open compact Notes">
          <span class="irgeztne-start-icon">✦</span>
          <strong>${startLang('Заметки', 'Notes')}</strong>
          <small>${startLang('Быстрые мысли, фрагменты, ссылки и рабочие черновики.', 'Quick thoughts, fragments, links and working drafts.')}</small>
        </button>
        <button type="button" class="irgeztne-start-card irgeztne-start-card--rooms" data-open-section="rooms" title="Open compact Rooms">
          <span class="irgeztne-start-icon">◌</span>
          <strong>${startLang('Чат', 'Chat')}</strong>
          <small>${startLang('Основа рабочего чата для быстрого проектного общения.', 'Work chat foundation for quick project communication.')}</small>
        </button>
        <button type="button" class="irgeztne-start-card irgeztne-start-card--tasks" data-open-section="tasks" title="Open compact Tasks">
          <span class="irgeztne-start-icon">↗</span>
          <strong>${startLang('Задачи', 'Tasks')}</strong>
          <small>${startLang('Личные и проектные задачи, сроки и рабочие списки.', 'Personal and project tasks, deadlines and working lists.')}</small>
        </button>
        <button type="button" class="irgeztne-start-card irgeztne-start-card--tools" data-open-section="tools" title="Open compact Tools">
          <span class="irgeztne-start-icon">⚙</span>
          <strong>${startLang('Инструменты', 'Tools')}</strong>
          <small>${startLang('Практические помощники для файлов и рабочего процесса.', 'Practical helpers for files and workflow.')}</small>
        </button>
        <button type="button" class="irgeztne-start-card irgeztne-start-card--templates" data-open-section="marketplace" title="Open compact Templates">
          <span class="irgeztne-start-icon">▧</span>
          <strong>${startLang('Шаблоны', 'Templates')}</strong>
          <small>${startLang('Официальные бесплатные шаблоны и темы для старта.', 'Official free templates and themes to start with.')}</small>
        </button>
        <button type="button" class="irgeztne-start-card irgeztne-start-card--workshop" data-open-section="codehub" title="Open Workshop">
          <span class="irgeztne-start-icon">◇</span>
          <strong>${startLang('Мастерская', 'Workshop')}</strong>
          <small>${startLang('Блоки, темы, секции, ассеты и заготовки для сайтов.', 'Blocks, themes, sections, assets and website materials.')}</small>
        </button>
        <button type="button" class="irgeztne-start-card irgeztne-start-card--primary irgeztne-start-card--web" data-open-section="site-pages">
          <span class="irgeztne-start-icon">◆</span>
          <strong>Web Studio</strong>
          <small>${startLang('Сайты, страницы, шаблоны, предпросмотр, экспорт и публикация.', 'Sites, pages, templates, preview, export and publishing.')}</small>
        </button>
      </div>

      <div class="irgeztne-start-bottom">
        <section class="irgeztne-start-panel">
          <div class="irgeztne-start-panel-head">
            <strong>${startLang('Продолжить работу', 'Continue work')}</strong>
            <span>${startLang('активное', 'active')}</span>
          </div>
          <div class="irgeztne-start-list" data-start-continue-list></div>
        </section>
        <section class="irgeztne-start-panel">
          <div class="irgeztne-start-panel-head">
            <strong>${startLang('Избранное', 'Favorites')}</strong>
            <span>★</span>
          </div>
          <div class="irgeztne-start-favorites" data-start-favorites-list>
            <p class="irgeztne-start-muted">${startLang('Здесь появятся страницы, проекты и места, которые вы сохраните звёздочкой.', 'Saved pages, projects and useful places will appear here from the star button.')}</p>
          </div>
        </section>
        <section class="irgeztne-start-panel">
          <div class="irgeztne-start-panel-head">
            <strong>${startLang('Быстрые действия', 'Quick actions')}</strong>
            <span>${startLang('рабочее', 'workspace')}</span>
          </div>
          <div class="irgeztne-start-actions">
            <button type="button" data-start-action="create-site">${startLang('Создать сайт', 'Create site')}</button>
            <button type="button" data-start-action="new-project">${startLang('Новый проект', 'New project')}</button>
            <button type="button" data-open-section="marketplace">${startLang('Шаблоны', 'Templates')}</button>
            <button type="button" data-open-section="codehub">${startLang('Мастерская', 'Workshop')}</button>
          </div>
        </section>
      </div>
    </section>
  `;

  const form = pane.querySelector('[data-start-search-form]');
  const input = pane.querySelector('[data-start-search-input]');
  const sourcePicker = pane.querySelector('[data-start-source-picker]');
  const sourceToggle = pane.querySelector('[data-start-source-toggle]');
  const sourceMenu = pane.querySelector('[data-start-source-menu]');
  const sourceLabel = pane.querySelector('[data-start-source-label]');
  const sourceButtons = Array.from(pane.querySelectorAll('[data-start-source]'));
  const refreshStartSources = (nextSource) => {
    const activeSource = String(nextSource || state.currentSource || 'google').toLowerCase();
    const sourceInfo = SOURCES[activeSource] || SOURCES.google;
    if (sourceLabel) sourceLabel.textContent = sourceInfo.label || 'Google';
    sourceButtons.forEach((button) => {
      const isActive = String(button.dataset.startSource || '').toLowerCase() === activeSource;
      button.classList.toggle('active', isActive);
      button.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
  };
  const closeStartSourceMenu = () => {
    if (sourceMenu) sourceMenu.classList.add('hidden');
    if (sourceToggle) sourceToggle.setAttribute('aria-expanded', 'false');
  };
  refreshStartSources(state.currentSource);
  if (sourceToggle && sourceMenu) {
    sourceToggle.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const willOpen = sourceMenu.classList.contains('hidden');
      sourceMenu.classList.toggle('hidden', !willOpen);
      sourceToggle.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
    });
  }
  sourceButtons.forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const source = String(button.dataset.startSource || '').trim();
      if (!source) return;
      document.dispatchEvent(new CustomEvent('irgeztne:set-source', { detail: { source } }));
      refreshStartSources(source);
      closeStartSourceMenu();
      if (input) input.focus();
    });
  });
  pane.addEventListener('click', (event) => {
    if (sourcePicker && !sourcePicker.contains(event.target)) closeStartSourceMenu();
  });
  
document.addEventListener('irg:source-changed', (event) => {
    const source = event && event.detail ? event.detail.source : '';
    refreshStartSources(source || state.currentSource);
  });
  if (form && input) {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const raw = String(input.value || '').trim();
      if (!raw) return;
      document.dispatchEvent(new CustomEvent('irgeztne:start-search', { detail: { query: raw } }));
    });
  }

  const continueBox = pane.querySelector('[data-start-continue-list]');
  const renderContinueWork = () => {
    if (!continueBox) return;

    const recent = readWorkspaceRecentHistory()
      .map((item) => {
        const descriptor = workspaceResumeDescriptor(item.section);
        return descriptor ? Object.assign(descriptor, { openedAt: item.openedAt }) : null;
      })
      .filter(Boolean);

    const fallback = ['site-pages', 'projects', 'files', 'documents', 'notes', 'tasks']
      .map(workspaceResumeDescriptor)
      .filter((item) => item && (item.id || item.updatedAt))
      .sort((a, b) => Date.parse(b.updatedAt || '') - Date.parse(a.updatedAt || ''));

    const items = [];
    const usedSections = new Set();
    [...recent, ...fallback].forEach((item) => {
      if (!item || usedSections.has(item.section) || items.length >= 3) return;
      usedSections.add(item.section);
      items.push(item);
    });

    if (!items.length) {
      continueBox.innerHTML = [
        `<button type="button" data-start-action="create-site"><span>${startLang('Новый сайт', 'New site')}</span><small>${startLang('Создать первый локальный сайт', 'Create the first local website')}</small></button>`,
        `<button type="button" data-start-action="new-project"><span>${startLang('Новый проект', 'New project')}</span><small>${startLang('Создать рабочий контейнер', 'Create a work container')}</small></button>`,
        `<button type="button" data-start-resume="office"><span>${startLang('Офис', 'Office')}</span><small>${startLang('Создать или открыть рабочий документ', 'Create or open a work document')}</small></button>`
      ].join('');
      return;
    }

    continueBox.innerHTML = items.map((item) =>
      `<button type="button" data-start-resume="${esc(item.kind)}" data-start-resume-id="${esc(item.id || '')}"><span>${workspaceResumeTitle(item)}</span><small>${workspaceResumeSubtitle(item.kind)}</small></button>`
    ).join('');
  };
  renderContinueWork();

  pane.addEventListener('click', (event) => {
    const resume = event.target.closest('[data-start-resume]');
    if (resume) {
      event.preventDefault();
      event.stopPropagation();
      const kind = String(resume.dataset.startResume || '');
      const id = String(resume.dataset.startResumeId || '');

      if (kind === 'site') {
        openWorkspaceStudioTab('page');
        return;
      }
      if (kind === 'project') {
        try {
          if (window.NSProjectsV1 && typeof window.NSProjectsV1.setCurrentProject === 'function') {
            window.NSProjectsV1.setCurrentProject(id);
          } else if (window.NSProjectStore && typeof window.NSProjectStore.setLastOpenedProjectId === 'function') {
            window.NSProjectStore.setLastOpenedProjectId(id);
          }
        } catch (error) {}
        openWorkspaceFullSection('projects');
        return;
      }
      if (kind === 'file') {
        try {
          if (id && window.NSLibraryStore && typeof window.NSLibraryStore.setActiveItem === 'function') {
            window.NSLibraryStore.setActiveItem(id);
          }
        } catch (error) {}
        openWorkspaceFullSection('files');
        return;
      }
      if (kind === 'office') {
        try {
          if (id && window.NSOfficeV1 && typeof window.NSOfficeV1.openObjectById === 'function') {
            window.NSOfficeV1.openObjectById(id);
          }
        } catch (error) {}
        openWorkspaceFullSection('documents');
        return;
      }
      if (kind === 'note') {
        try {
          if (id && window.NSNotesV1 && typeof window.NSNotesV1.openNoteById === 'function') {
            window.NSNotesV1.openNoteById(id);
          } else if (id && window.NSNotesStore && typeof window.NSNotesStore.setLastOpenedNoteId === 'function') {
            window.NSNotesStore.setLastOpenedNoteId(id);
          }
        } catch (error) {}
        openWorkspaceFullSection('notes');
        return;
      }
      if (kind === 'task') {
        try {
          if (id && window.NSTaskStoreV1 && typeof window.NSTaskStoreV1.setLastOpenedTaskId === 'function') {
            window.NSTaskStoreV1.setLastOpenedTaskId(id);
          }
        } catch (error) {}
        openWorkspaceFullSection('tasks');
        return;
      }
      if (kind === 'files') {
        openWorkspaceFullSection('files');
        return;
      }
    }

    const action = event.target.closest('[data-start-action]');
    if (!action) return;
    event.preventDefault();
    event.stopPropagation();
    const actionId = String(action.dataset.startAction || '');
    if (actionId === 'create-site') {
      openWorkspaceStudioTab('sites');
      return;
    }
    if (actionId === 'new-project') {
      openWorkspaceNewProject();
    }
  });

  const favoritesBox = pane.querySelector('[data-start-favorites-list]');
  const renderFavorites = () => {
    if (!favoritesBox) return;
    const items = Array.isArray(window.__IRG_BROWSER_BOOKMARKS__) ? window.__IRG_BROWSER_BOOKMARKS__.slice(0, 4) : [];
    if (!items.length) {
      favoritesBox.innerHTML = `<p class="irgeztne-start-muted">${startLang('Здесь появятся страницы, проекты и места, которые вы сохраните звёздочкой.', 'Saved pages, projects and useful places will appear here from the star button.')}</p>`;
      return;
    }
    favoritesBox.innerHTML = items.map((item) => {
      const title = item && item.title ? item.title : (item && item.url ? item.url : 'Favorite');
      const url = item && item.url ? item.url : '';
      return `<button type="button" class="irgeztne-start-favorite-row" data-start-favorite-url="${esc(url)}"><span>${esc(title)}</span><small>${esc(url)}</small></button>`;
    }).join('');
  };
  renderFavorites();
  document.addEventListener('irg:bookmarks-updated', renderFavorites);
  pane.addEventListener('click', (event) => {
    const favorite = event.target.closest('[data-start-favorite-url]');
    if (!favorite) return;
    const url = String(favorite.getAttribute('data-start-favorite-url') || '').trim();
    if (url) document.dispatchEvent(new CustomEvent('irgeztne:start-search', { detail: { query: url } }));
  });

  return pane;
}

function getLibraryItem(fileId) {
  if (!fileId || !window.NSLibraryStore || typeof window.NSLibraryStore.getItemById !== 'function') {
    return null;
  }
  return window.NSLibraryStore.getItemById(fileId);
}

function getLibraryPreviewKind(item) {
  return String(item && item.preview && item.preview.kind ? item.preview.kind : '').toLowerCase();
}

function renderLibraryInlinePane(tab) {
  const item = getLibraryItem(tab.fileId);
  const pane = document.createElement('div');
  pane.className = 'tab-pane-library-file';
  pane.dataset.tabId = tab.id;

  const viewer = document.createElement('div');
  viewer.className = 'native-file-viewer';

  if (!item) {
    viewer.innerHTML = `
      <div style="padding:20px;color:#eaf2ff;">
        <h3 style="margin:0 0 8px;">Library item not found</h3>
        <p style="margin:0;opacity:.8;">The file is no longer available in Source Library.</p>
      </div>
    `;
    pane.appendChild(viewer);
    return pane;
  }

  const kind = getLibraryPreviewKind(item);
  const mime = String(item && item.mime ? item.mime : '').toLowerCase();
  const dataUrl = item && item.storage ? item.storage.dataUrl : '';

  if ((kind === 'image' || mime.startsWith('image/')) && dataUrl) {
    const wrap = document.createElement('div');
    wrap.style.display = 'grid';
    wrap.style.placeItems = 'center';
    wrap.style.minHeight = '100%';
    wrap.style.padding = '20px';

    const img = document.createElement('img');
    img.src = dataUrl;
    img.alt = item.name || item.originalName || 'Library image';
    img.style.maxWidth = '100%';
    img.style.maxHeight = '100%';
    img.style.objectFit = 'contain';
    img.style.borderRadius = '12px';

    wrap.appendChild(img);
    viewer.appendChild(wrap);
    pane.appendChild(viewer);
    return pane;
  }

  if (kind === 'text' || mime.startsWith('text/') || mime.includes('json') || mime.includes('xml')) {
    const pre = document.createElement('pre');
    pre.className = 'native-file-viewer-pre';
    pre.textContent = String(
      (item && item.preview && (item.preview.textContent || item.preview.excerpt)) || ''
    );
    pre.style.margin = '0';
    pre.style.padding = '18px';
    pre.style.whiteSpace = 'pre-wrap';
    pre.style.wordBreak = 'break-word';
    pre.style.color = '#eaf2ff';
    pre.style.background = 'transparent';

    viewer.appendChild(pre);
    pane.appendChild(viewer);
    return pane;
  }

  viewer.innerHTML = `
    <div style="padding:20px;color:#eaf2ff;display:grid;gap:10px;">
      <h3 style="margin:0;">${esc(item.name || item.originalName || 'Library File')}</h3>
      <div style="opacity:.8;">This file opens as a library preview in the tab layer.</div>
      <div style="opacity:.7;">Type: ${esc(item.mime || item.category || 'file')}</div>
    </div>
  `;

  pane.appendChild(viewer);
  return pane;
}

export function initTabs(state, els) {
  function normalizeCreateTabArgs(input, maybeTitle) {
    if (input && typeof input === 'object' && !Array.isArray(input)) {
      const nextUrl = typeof input.url === 'string' && input.url.trim()
        ? input.url.trim()
        : getSourceHomeUrl(state);
      return {
        url: nextUrl,
        title: typeof input.title === 'string' && input.title.trim()
          ? input.title.trim()
          : 'New Tab',
        displayUrl: typeof input.displayUrl === 'string' ? input.displayUrl : '',
        fileId: input.fileId || null,
        sourceType: typeof input.sourceType === 'string' && input.sourceType.trim()
          ? input.sourceType.trim()
          : (isWorkspaceStartUrl(nextUrl) ? 'workspace' : 'web'),
        libraryKey: typeof input.libraryKey === 'string' ? input.libraryKey : '',
        kind: typeof input.kind === 'string' && input.kind
          ? input.kind
          : (isWorkspaceStartUrl(nextUrl) ? 'workspace-start' : '')
      };
    }

    const nextUrl = typeof input === 'string' && input.trim()
      ? input.trim()
      : getSourceHomeUrl(state);
    return {
      url: nextUrl,
      title: isWorkspaceStartUrl(nextUrl)
        ? WORKSPACE_START_TITLE
        : (typeof maybeTitle === 'string' && maybeTitle.trim() ? maybeTitle.trim() : 'New Tab'),
      displayUrl: '',
      fileId: null,
      sourceType: isWorkspaceStartUrl(nextUrl) ? 'workspace' : 'web',
      libraryKey: '',
      kind: isWorkspaceStartUrl(nextUrl) ? 'workspace-start' : ''
    };
  }

  function renderTabs() {
    if (!els.tabsScroll) return;

    els.tabsScroll.innerHTML = '';

    const visibleTabs = state.tabs.filter((tab) => {
      return !(tab.kind === 'workspace-start' || isWorkspaceStartUrl(tab.url));
    });

    els.tabsScroll.dataset.tabCount = String(visibleTabs.length || 0);

    visibleTabs.forEach((tab) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `tab-btn${tab.id === state.activeTabId ? ' active' : ''}`;
      button.dataset.tabId = tab.id;
      button.innerHTML =
        `<span class="tab-title">${esc(tab.title || 'New Tab')}</span>` +
        `<span class="tab-close" data-close-tab="${tab.id}" title="Close tab">✕</span>`;
      els.tabsScroll.appendChild(button);
    });

    if (els.addTabBtn) {
      els.addTabBtn.dataset.addTab = 'true';
      els.addTabBtn.setAttribute('title', 'New tab');
      els.addTabBtn.setAttribute('aria-label', 'New tab');
      els.addTabBtn.classList.add('tabs-add-btn');
      els.tabsScroll.appendChild(els.addTabBtn);
    }
  }

  function scrollElementIntoView(node) {
    if (!node || typeof node.scrollIntoView !== 'function') return;

    requestAnimationFrame(() => {
      try {
        node.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      } catch (error) {
        node.scrollIntoView();
      }
    });
  }

  function scrollActiveTabIntoView() {
    if (!els.tabsScroll || !state.activeTabId) return;

    const activeButton = els.tabsScroll.querySelector(
      `[data-tab-id="${CSS.escape(state.activeTabId)}"]`
    );

    if (!activeButton) return;
    scrollElementIntoView(activeButton);
  }

  function scrollAddButtonIntoView() {
    if (!els.addTabBtn) return;
    scrollElementIntoView(els.addTabBtn);
  }

  function renderWebviews() {
    if (!els.webviewStack) return;

    els.webviewStack.innerHTML = '';

    state.tabs.forEach((tab) => {
      const pane = document.createElement('div');
      pane.className = `tab-pane${tab.id === state.activeTabId ? ' active' : ''}`;
      pane.dataset.tabId = tab.id;

      if (tab.kind === 'workspace-start') {
        pane.appendChild(renderWorkspaceStartPane(state));
      } else if (tab.kind === 'library-file') {
        const libraryPane = renderLibraryInlinePane(tab);
        if (libraryPane.firstChild) {
          pane.appendChild(libraryPane.firstChild);
        }
      } else {
        const webview = document.createElement('webview');
        webview.className = 'browser-webview';
        webview.dataset.tabId = tab.id;
        webview.src = tab.url;
        webview.setAttribute('allowpopups', 'false');

        webview.addEventListener('did-navigate', () => syncFromWebview(tab.id, webview));
        webview.addEventListener('did-navigate-in-page', () => syncFromWebview(tab.id, webview));
        webview.addEventListener('page-title-updated', () => syncFromWebview(tab.id, webview));

        pane.appendChild(webview);
      }

      els.webviewStack.appendChild(pane);
    });
  }

  function syncFromWebview(tabId, webview) {
    const tab = state.tabs.find((item) => item.id === tabId);
    if (!tab) return;

    try {
      tab.url = typeof webview.getURL === 'function' ? webview.getURL() : tab.url;
      tab.title = typeof webview.getTitle === 'function'
        ? (webview.getTitle() || tab.title)
        : tab.title;
    } catch (error) {
      console.warn('[modular] sync webview failed', error);
    }

    renderTabs();
    scrollActiveTabIntoView();
    updateAddressFromActiveTab();

    document.dispatchEvent(new CustomEvent('irg:tab-changed', {
      detail: { tabId }
    }));
  }

  function updateAddressFromActiveTab() {
    const active = state.tabs.find((item) => item.id === state.activeTabId);
    if (!active || !els.addressInput) return;
    const isWorkspaceStart = active.kind === 'workspace-start' || isWorkspaceStartUrl(active.url);
    document.body.classList.toggle('is-workspace-start-tab', Boolean(isWorkspaceStart));
    els.addressInput.value = isWorkspaceStart ? '' : (active.url || '');
  }

  function activateTab(tabId) {
    state.activeTabId = tabId;
    renderTabs();
    renderWebviews();
    scrollActiveTabIntoView();
    updateAddressFromActiveTab();

    document.dispatchEvent(new CustomEvent('irg:tab-changed', {
      detail: { tabId }
    }));
  }

  function createTab(input = getSourceHomeUrl(state), maybeTitle = 'New Tab') {
    if (arguments.length === 0) {
      const sourceForTitle = SOURCES[state.currentSource] || SOURCES.google;
      maybeTitle = sourceForTitle && sourceForTitle.label ? sourceForTitle.label : 'New Tab';
    }
    const normalized = normalizeCreateTabArgs(input, maybeTitle);

    const tab = {
      id: makeTabId(state),
      url: normalized.url,
      title: normalized.title,
      displayUrl: normalized.displayUrl,
      fileId: normalized.fileId,
      sourceType: normalized.sourceType,
      libraryKey: normalized.libraryKey
    };

    if (normalized.kind) {
      tab.kind = normalized.kind;
    }

    state.tabs.push(tab);
    activateTab(tab.id);
    scrollAddButtonIntoView();
    return tab;
  }

  function closeTab(tabId) {
    const index = state.tabs.findIndex((item) => item.id === tabId);
    if (index === -1) return;

    const wasActive = state.tabs[index].id === state.activeTabId;
    state.tabs.splice(index, 1);

    if (!state.tabs.length) {
      createTab();
      return;
    }

    if (wasActive) {
      const fallback = state.tabs[Math.max(0, index - 1)] || state.tabs[0];
      state.activeTabId = fallback.id;
    }

    renderTabs();
    renderWebviews();
    scrollActiveTabIntoView();
    updateAddressFromActiveTab();

    document.dispatchEvent(new CustomEvent('irg:tab-changed', {
      detail: { tabId: state.activeTabId }
    }));
  }

  function navigateActiveTab(url) {
    const active = state.tabs.find((item) => item.id === state.activeTabId);
    if (!active) return;

    document.dispatchEvent(new CustomEvent('irgeztne:global-navigation-start', {
      detail: { url }
    }));

    active.url = url;

    if (isWorkspaceStartUrl(url)) {
      active.kind = 'workspace-start';
      active.sourceType = 'workspace';
      active.title = WORKSPACE_START_TITLE;
      renderWebviews();
      renderTabs();
      updateAddressFromActiveTab();
      return;
    }

    if (active.kind === 'workspace-start') {
      delete active.kind;
      active.sourceType = 'web';
    }

    if (active.kind === 'library-file') {
      delete active.kind;
      delete active.fileId;
      renderWebviews();
      renderTabs();
      updateAddressFromActiveTab();
      return;
    }

    const webview = getActiveWebview();
    if (webview) {
      webview.src = url;
    } else {
      renderWebviews();
    }

    updateAddressFromActiveTab();
  }

  function getActiveWebview() {
    if (!els.webviewStack || !state.activeTabId) return null;
    return els.webviewStack.querySelector(
      `webview[data-tab-id="${CSS.escape(state.activeTabId)}"]`
    );
  }

  function openLibraryFileInTab(fileId) {
    const item = getLibraryItem(fileId);
    if (!item || !item.storage || !item.storage.dataUrl) return false;

    const existing = state.tabs.find((tab) => tab.fileId === item.id);
    if (existing) {
      activateTab(existing.id);
      return true;
    }

    const tab = {
      id: makeTabId(state),
      url: item.storage.dataUrl,
      title: item.name || item.originalName || 'Library File',
      fileId: item.id,
      kind: 'library-file'
    };

    state.tabs.push(tab);
    activateTab(tab.id);
    scrollAddButtonIntoView();
    return true;
  }


  function activateWorkspaceHome() {
    const existing = state.tabs.find((tab) => tab.kind === 'workspace-start' || isWorkspaceStartUrl(tab.url));

    if (existing) {
      activateTab(existing.id);
      return existing;
    }

    return createTab(createWorkspaceStartTabData());
  }

  function bindHomeButton() {
    const homeButton = document.getElementById('homeBtn');
    if (!homeButton || homeButton.dataset.boundHome === 'true') return;

    homeButton.dataset.boundHome = 'true';
    homeButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      activateWorkspaceHome();
    });
  }

  function bindAddTabButton() {
    if (!els.addTabBtn || els.addTabBtn.dataset.boundClick === 'true') return;

    els.addTabBtn.dataset.boundClick = 'true';
    els.addTabBtn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      createTab();
    });
  }

  els.tabsScroll?.addEventListener('click', (event) => {
    const closeTarget = event.target.closest('[data-close-tab]');
    if (closeTarget) {
      event.stopPropagation();
      closeTab(closeTarget.dataset.closeTab);
      return;
    }

    const addTarget = event.target.closest('#addTabBtn, [data-add-tab="true"]');
    if (addTarget) {
      event.preventDefault();
      event.stopPropagation();
      createTab();
      return;
    }

    const tabButton = event.target.closest('[data-tab-id]');
    if (tabButton) {
      activateTab(tabButton.dataset.tabId);
    }
  });

  document.addEventListener('irgeztne:start-search', (event) => {
    const query = String(event && event.detail && event.detail.query ? event.detail.query : '').trim();
    if (!query) return;
    const directUrl = /^(https?:\/\/|file:\/\/|about:|irgeztne:\/\/)/i.test(query) || /^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(query);
    if (/^irgeztne:\/\/workspace/i.test(query)) {
      navigateActiveTab(WORKSPACE_START_URL);
      return;
    }
    if (directUrl) {
      const normalized = /^(https?:\/\/|file:\/\/|about:)/i.test(query) ? query : `https://${query}`;
      navigateActiveTab(normalized);
      return;
    }
    const source = SOURCES[state.currentSource] || SOURCES.google;
    navigateActiveTab(source.buildSearchUrl(query));
  });

  bindWorkspaceRecentTracking();
  bindAddTabButton();
  bindHomeButton();
  createTab(createWorkspaceStartTabData());

  return {
    createTab,
    closeTab,
    activateTab,
    navigateActiveTab,
    getActiveWebview,
    updateAddressFromActiveTab,
    openLibraryFileInTab,
    getSourceHomeUrl: () => getSourceHomeUrl(state)
  };
}
