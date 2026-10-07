export function initLegacyShell() {
  const els = {
    mainLayout: document.getElementById('mainLayout'),
    workspaceShell: document.getElementById('workspaceShell'),
    workspaceDivider: document.getElementById('workspaceDivider'),
    workspaceToggle: document.getElementById('workspaceToggle'),
    workspaceCollapseBtn: document.getElementById('workspaceCollapseBtn'),
    workspaceShellNav: document.getElementById('workspaceShellNav'),
    workspaceShellBody: document.getElementById('workspaceShellBody'),

    hamburgerBtn: document.getElementById('hamburgerBtn'),
    cabinetOverlay: document.getElementById('cabinetOverlay'),
    cabinetGridView: document.getElementById('cabinetGridView'),
    cabinetExpandedView: document.getElementById('cabinetExpandedView'),
    cabinetExpandedBody: document.getElementById('cabinetExpandedBody'),
    cabinetCloseBtn: document.getElementById('cabinetCloseBtn'),
    cabinetCloseBtnExpanded: document.getElementById('cabinetCloseBtnExpanded'),
    cabinetBackBtn: document.getElementById('cabinetBackBtn'),
    cabinetExpandedTitle: document.getElementById('cabinetExpandedTitle'),
    cabinetExpandedSubtitle: document.getElementById('cabinetExpandedSubtitle')
  };

  function isRu() { return document.documentElement.lang === 'ru'; }
  function tr(en, ru) { return isRu() ? ru : en; }
  function showPlannedModuleNotice(button) {
    if (!button) return;
    const original = button.textContent;
    const message = tr('In development', 'В разработке');
    button.textContent = message;
    button.classList.add('is-showing-planned-notice');
    window.setTimeout(function () {
      button.textContent = original;
      button.classList.remove('is-showing-planned-notice');
    }, 1100);
  }

function normalizeWorkspaceLabel(value) {
  const raw = String(value || '');
  if (isRu()) return raw;
  const map = [
    ['Заметка без названия','Untitled note'],
    ['Заметка проекта','Project Note'],
    ['Пустая заметка','Empty note'],
    ['Пакет без названия','Untitled package'],
    ['Проект без названия','Untitled project'],
    ['Файл без названия','Untitled file'],
    ['Шаблон','template'],
    ['Черновик','draft'],
    ['Готово','ready'],
    ['Отправлено','submitted'],
    ['Файлы','Files'],
    ['Заметки','Notes'],
    ['Черновики','Drafts'],
    ['Офис','Office'],
    ['Документы','Office'],
    ['Карта','Map'],
    ['Комнаты','Rooms'],
    ['Задачи','Tasks'],
    ['Инструменты','Tools'],
    ['Шаблоны','Templates'],
    ['Главная','Home'],
    ['Продолжить в файлах','Continue in files'],
    ['Продолжить в проектах','Continue in projects'],
    ['Продолжить в заметках','Continue in notes'],
    ['Продолжить в Веб-мастерской','Continue in Web Workshop'],
    ['Открыть','Open'],
    ['Во вкладке','In Tab'],
    ['Пустая заметка','Empty note'],
    ['статья','article'],
    ['идея','idea'],
    ['проект','project'],
    ['заметка','note'],
    ['черновик','draft'],
    ['файлы','Files'],
    ['заметки','Notes'],
    ['черновики','Drafts'],
    ['офис','Office'],
    ['документы','Office'],
    ['карта','Map'],
    ['комнаты','Rooms'],
    ['задачи','Tasks'],
    ['инструменты','Tools'],
    ['каталог','Templates'],
    ['главная','Home']
  ];
  let text = raw;
  for (const [ru,en] of map) text = text.split(ru).join(en);
  return text;
}
function normalizeProjectMetaText(text) {
  return normalizeWorkspaceLabel(text);
}

  const state = {
    workspaceEnabled: false,
    workspaceMode: 'normal',
    workspaceWidthPercent: 38,
    isResizingWorkspace: false,
    activeWorkspaceSection: 'workspace',

    isCabinetOpen: false,
    cabinetMode: 'grid',
    activeCabinetSection: 'workspace'
  };

  const WORKSPACE_MIN_PERCENT = 26;
  const WORKSPACE_MAX_PERCENT = 68;

  let homeDashboardBound = false;
  let homeDashboardSubscribed = false;

  bindWorkspace();
  bindStartRailFullOwnerV04P17();
  bindCabinet();
  bindHomeShortcuts();
  initHomeDashboard();
  applyWorkspaceUi();
  syncCabinetUi();
  setWorkspaceSection(state.activeWorkspaceSection);
  ensureWorkspaceFullContractStyle();
  window.setTimeout(scheduleWorkspaceNavigationContractSync, 0);

  function bindWorkspace() {
    els.workspaceToggle?.addEventListener('click', () => {
      if (!state.workspaceEnabled) {
        setWorkspaceEnabled(true);
        setWorkspaceMode('split');
        return;
      }

      if (state.workspaceMode === 'normal') {
        setWorkspaceMode('split');
        return;
      }

      setWorkspaceEnabled(false);
      setWorkspaceMode('normal');
    });

    els.workspaceCollapseBtn?.addEventListener('click', () => {
      if (state.activeWorkspaceSection && state.activeWorkspaceSection !== 'workspace') {
        setWorkspaceSection('workspace');
        setWorkspaceEnabled(true);
        setWorkspaceMode('split');
        return;
      }

      setWorkspaceEnabled(false);
      setWorkspaceMode('normal');
    });

    els.workspaceShellNav?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-section]');
      if (!button) return;
      setWorkspaceSection(String(button.dataset.section || 'workspace'));
    });

    if (els.workspaceDivider && els.mainLayout) {
      els.workspaceDivider.addEventListener('mousedown', (event) => {
        if (state.workspaceMode !== 'split') return;
        event.preventDefault();
        state.isResizingWorkspace = true;
        els.workspaceDivider.classList.add('dragging');
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
      });

      window.addEventListener('mousemove', (event) => {
        if (!state.isResizingWorkspace || state.workspaceMode !== 'split') return;

        const rect = els.mainLayout.getBoundingClientRect();
        if (!rect.width) return;

        const rightPaneWidth = rect.right - event.clientX;
        const nextPercent = (rightPaneWidth / rect.width) * 100;
        state.workspaceWidthPercent = clamp(nextPercent, WORKSPACE_MIN_PERCENT, WORKSPACE_MAX_PERCENT);
        applyWorkspaceUi();
      });

      const stopResize = () => {
        if (!state.isResizingWorkspace) return;
        state.isResizingWorkspace = false;
        els.workspaceDivider.classList.remove('dragging');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };

      window.addEventListener('mouseup', stopResize);
      window.addEventListener('mouseleave', stopResize);
    }
  }

  function toggleWorkspaceStartRailCompact() {
    const compact = document.body.classList.toggle('is-start-rail-compact');

    if (els.hamburgerBtn) {
      els.hamburgerBtn.classList.toggle('is-rail-compact', compact);
      els.hamburgerBtn.setAttribute('aria-pressed', compact ? 'true' : 'false');
      els.hamburgerBtn.setAttribute('title', compact ? 'Развернуть левую панель' : 'Свернуть левую панель');
      els.hamburgerBtn.setAttribute('aria-label', compact ? 'Развернуть левую панель' : 'Свернуть левую панель');
    }
  }

  function closeWorkspaceSurfacesForHome() {
    if (state.isCabinetOpen) closeCabinet();

    if (state.workspaceEnabled) {
      setWorkspaceEnabled(false);
      setWorkspaceMode('normal');
    }
  }

  function activateRealWorkspaceHome() {
    closeWorkspaceSurfacesForHome();

    const homeBtn = document.getElementById('homeBtn');
    if (homeBtn) {
      homeBtn.click();
      return;
    }

    // Fallback for a future shell where the browser Home control is absent.
    document.dispatchEvent(new CustomEvent('irgeztne:start-search', {
      detail: { query: 'irgeztne://workspace' }
    }));
  }

  function ensureWorkspaceFullContractStyle() {
    let style = document.getElementById('workspaceFullContractStyleV04P13');
    if (style) return style;

    style = document.createElement('style');
    style.id = 'workspaceFullContractStyleV04P13';
    style.textContent = `
      body.is-workspace-full-module-open .cabinet-expanded-header {
        min-height: 44px !important;
        padding: 5px 12px !important;
        gap: 8px !important;
        align-items: center !important;
      }
      body.is-workspace-full-module-open .cabinet-expanded-left,
      body.is-workspace-full-module-open .cabinet-expanded-right {
        min-height: 32px !important;
        align-items: center !important;
      }
      body.is-workspace-full-module-open .cabinet-expanded-left {
        gap: 10px !important;
      }
      body.is-workspace-full-module-open .cabinet-expanded-title {
        line-height: 1.05 !important;
        margin: 0 !important;
      }
      body.is-workspace-full-module-open .cabinet-expanded-subtitle {
        line-height: 1.15 !important;
        margin-top: 2px !important;
      }
      body.is-workspace-full-module-open .cabinet-expanded-right {
        gap: 7px !important;
        height: 32px !important;
        min-height: 32px !important;
        max-height: 32px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: flex-end !important;
      }
      body.is-workspace-full-module-open #workspaceFullLanguageBtn {
        width: 44px !important;
        min-width: 44px !important;
        height: 32px !important;
        min-height: 32px !important;
        margin: 0 !important;
        padding: 0 8px !important;
        border-radius: 9px !important;
      }
      body.is-workspace-full-module-open #cabinetCloseBtnExpanded,
      body.is-workspace-full-module-open #cabinetBackBtn {
        width: 32px !important;
        min-width: 32px !important;
        height: 32px !important;
        min-height: 32px !important;
        border-radius: 9px !important;
      }
      body.is-workspace-full-module-open .cabinet-inner-nav {
        min-height: 36px !important;
        padding: 5px 12px !important;
        gap: 6px !important;
        align-items: center !important;
      }
      body.is-workspace-full-module-open .cabinet-inner-nav-btn {
        min-height: 26px !important;
        padding: 4px 9px !important;
        line-height: 1 !important;
      }
    `;
    document.head.appendChild(style);
    return style;
  }

  // IRGEZTNE_TASKS_CANONICAL_ROUTE_V05T1B
  const FULL_NAV_CONTRACT_V04P13 = [
    { key: 'workspace', section: 'workspace', en: 'Home', ru: 'Главная' },
    { key: 'files', section: 'files', en: 'Files', ru: 'Файлы' },
    { key: 'projects', section: 'projects', en: 'Projects', ru: 'Проекты' },
    { key: 'documents', section: 'documents', en: 'Office', ru: 'Офис' },
    { key: 'notes', section: 'notes', en: 'Notes', ru: 'Заметки' },
    { key: 'tasks', section: 'tasks', en: 'Tasks', ru: 'Задачи' },
    { key: 'tools', section: 'tools', en: 'Tools', ru: 'Инструменты' },
    { key: 'rooms', section: 'rooms', en: 'Chat', ru: 'Чат' },
    { key: 'templates', deepLink: 'templates', en: 'Templates', ru: 'Шаблоны' },
    { key: 'workshop', deepLink: 'workshop', en: 'Workshop', ru: 'Мастерская' },
    { key: 'site-pages', section: 'site-pages', en: 'Web Studio', ru: 'Веб-студия' }
  ];

  function normalizeFullModuleNavigation() {
    const nav = document.getElementById('cabinetInnerNav');
    if (!nav) return;

    const keep = new Set();
    for (const item of FULL_NAV_CONTRACT_V04P13) {
      let button = null;
      if (item.section) {
        button = nav.querySelector(`.cabinet-inner-nav-btn[data-section="${item.section}"]`);
      } else {
        button = nav.querySelector(`.cabinet-inner-nav-btn[data-workspace-deep-link="${item.deepLink}"]`);
      }

      if (!button) {
        button = document.createElement('button');
        button.type = 'button';
        button.className = 'cabinet-inner-nav-btn';
        if (item.deepLink) button.dataset.workspaceDeepLink = item.deepLink;
      }

      button.textContent = isRu() ? item.ru : item.en;
      button.hidden = false;
      button.style.removeProperty('display');
      keep.add(button);
      nav.appendChild(button);
    }

    Array.from(nav.children).forEach((button) => {
      if (keep.has(button)) return;
      // Keep old route nodes in the DOM for legacy queries, but remove them from
      // the visible navigation contract.
      button.hidden = true;
      button.style.setProperty('display', 'none', 'important');
    });
  }

  function normalizeWorkspaceHomeCardOrder() {
    const grid = document.querySelector('.irgeztne-start-quick');
    if (!grid) return false;

    const selectors = [
      '.irgeztne-start-card--files',
      '.irgeztne-start-card--projects',
      '.irgeztne-start-card--office',
      '.irgeztne-start-card--notes',
      '.irgeztne-start-card--tasks',
      '.irgeztne-start-card--tools',
      '.irgeztne-start-card--rooms',
      '.irgeztne-start-card--templates',
      '.irgeztne-start-card--workshop',
      '.irgeztne-start-card--web'
    ];

    const cards = selectors.map((selector) => grid.querySelector(selector)).filter(Boolean);
    if (cards.length < 8) return false;
    cards.forEach((card) => grid.appendChild(card));
    return true;
  }

  function scheduleWorkspaceNavigationContractSync() {
    normalizeFullModuleNavigation();
    normalizeWorkspaceHomeCardOrder();
    window.setTimeout(() => {
      normalizeFullModuleNavigation();
      normalizeWorkspaceHomeCardOrder();
    }, 0);
    window.setTimeout(() => {
      normalizeFullModuleNavigation();
      normalizeWorkspaceHomeCardOrder();
    }, 120);
  }

  function openWorkspaceDeepLink(kind) {
    const selector = kind === 'templates'
      ? '.irgeztne-start-card--templates'
      : '.irgeztne-start-card--workshop';
    const source = document.querySelector(selector);
    if (!source) return false;

    // Reuse the already-accepted Home-card route instead of inventing another
    // Templates / Workshop router in the Full shell.
    closeCabinet();
    window.setTimeout(() => source.click(), 0);
    return true;
  }

  function ensureFullModuleLanguageButton() {
    const right = els.cabinetCloseBtnExpanded && els.cabinetCloseBtnExpanded.parentElement;
    if (!right) return null;

    let button = document.getElementById('workspaceFullLanguageBtn');
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.id = 'workspaceFullLanguageBtn';
      button.className = 'utility-btn';
      button.setAttribute('aria-label', 'Workspace language');
      button.setAttribute('title', 'Workspace language');
      button.style.width = '44px';
      button.style.minWidth = '44px';
      button.style.minHeight = '32px';
      button.style.fontSize = '12px';
      button.style.fontWeight = '700';
      button.style.letterSpacing = '0.08em';
      button.style.marginRight = '0';
      button.hidden = true;

      button.addEventListener('click', () => {
        // Reuse the one existing Workspace language owner. The browser control is
        // visually hidden in Full mode, but it remains the canonical RU/EN switch.
        const owner = document.getElementById('languageToggleBtn');
        if (!owner || owner === button) return;
        owner.click();
        window.setTimeout(syncFullModuleLanguageButton, 0);
      });

      right.insertBefore(button, els.cabinetCloseBtnExpanded || null);
    }

    return button;
  }

  function syncFullModuleLanguageButton() {
    const button = ensureFullModuleLanguageButton();
    if (!button) return;

    const owner = document.getElementById('languageToggleBtn');
    const ownerLabel = owner ? String(owner.textContent || '').trim().toUpperCase() : '';
    const htmlLang = String(document.documentElement.lang || '').trim().toLowerCase();
    button.textContent = ownerLabel === 'RU' || ownerLabel === 'EN'
      ? ownerLabel
      : (htmlLang === 'ru' ? 'RU' : 'EN');

    const ru = button.textContent === 'RU';
    button.setAttribute('title', ru ? 'Язык Workspace' : 'Workspace language');
    button.setAttribute('aria-label', ru ? 'Язык Workspace' : 'Workspace language');
  }

  function setFullModuleLanguageButtonVisible(visible) {
    const button = ensureFullModuleLanguageButton();
    if (!button) return;
    button.hidden = !visible;
    if (visible) syncFullModuleLanguageButton();
  }

  function bindStartRailFullOwnerV04P17() {
    // IRGEZTNE_START_RAIL_FULL_OWNER_V04P17
    // The visible Workspace Home rail is created by src/browser/tabs.js.
    // Its ordinary module buttons use data-open-section, but their old generic
    // bubbling route is not reliable on the start surface. Own only this rail,
    // in capture phase, and reuse the already-stable Full Cabinet router.
    //
    // Deliberately excluded here:
    // - site-pages / marketplace: Web Studio's direct bridge already owns them;
    // - codehub: Workshop belongs inside Web Studio and is a separate deep link;
    // - Home cards: they keep their existing compact/right-panel behaviour.
    if (document.documentElement.dataset.irgeztneStartRailFullOwnerV04P17 === '1') return;
    document.documentElement.dataset.irgeztneStartRailFullOwnerV04P17 = '1';

    const fullSections = new Set([
      'files',
      'projects',
      'documents',
      'notes',
      'tasks',
      'tools',
      'rooms'
    ]);

    document.addEventListener('click', (event) => {
      const button = event.target && event.target.closest
        ? event.target.closest('.irgeztne-start-nav button[data-open-section]')
        : null;
      if (!button) return;

      const section = String(button.dataset.openSection || '').trim();
      if (!fullSections.has(section)) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      showCabinetSection(section);
    }, true);
  }

  function bindCabinet() {
    document.addEventListener('irgeztne:global-navigation-start', () => {
      closeWorkspaceSurfacesForHome();
    });

    document.addEventListener('irg:language-changed', () => {
      syncFullModuleLanguageButton();
      scheduleWorkspaceNavigationContractSync();
      // Global localization can rewrite the expanded header after the module
      // rendered. Reassert the active full-module owner after that pass.
      window.setTimeout(syncCabinetUi, 80);
      window.setTimeout(syncCabinetUi, 220);
    });

    // Browser-shell Home must always escape any open Cabinet/full-module surface.
    // The tabs owner then activates the one real Workspace start page.
    document.getElementById('homeBtn')?.addEventListener('click', () => {
      closeWorkspaceSurfacesForHome();
    }, true);

    els.hamburgerBtn?.addEventListener('click', () => {
      if (state.isCabinetOpen) closeCabinet();
      else openCabinet();
    });

    els.hamburgerBtn?.addEventListener('click', (event) => {
      const isWorkspaceStart = document.body.classList.contains('is-workspace-start-tab');

      if (event.isTrusted && isWorkspaceStart && !state.isCabinetOpen) {
        event.preventDefault();
        event.stopImmediatePropagation();
        toggleWorkspaceStartRailCompact();
      }
    }, true);

    els.cabinetCloseBtn?.addEventListener('click', closeCabinet);
    els.cabinetCloseBtnExpanded?.addEventListener('click', closeCabinet);
    els.cabinetBackBtn?.addEventListener('click', () => {
      activateRealWorkspaceHome();
    });

    document.addEventListener('click', (event) => {
      const deepLink = event.target.closest('.cabinet-inner-nav-btn[data-workspace-deep-link]');
      if (deepLink) {
        event.preventDefault();
        event.stopPropagation();
        openWorkspaceDeepLink(String(deepLink.dataset.workspaceDeepLink || ''));
        return;
      }

      const tile = event.target.closest('[data-open-section]');
      if (tile) {
        const section = String(tile.dataset.openSection || 'workspace');
        showCabinetSection(section);
        return;
      }

      const inner = event.target.closest('.cabinet-inner-nav-btn[data-section]');
      if (inner) {
        const section = String(inner.dataset.section || 'workspace');
        showCabinetSection(section);
      }
    });

    document.addEventListener('irgeztne:open-account-surface', () => {
      showCabinetSection('account');
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && state.isCabinetOpen) {
        closeCabinet();
      }
    });
  }

  function bindHomeShortcuts() {
    document.addEventListener('click', (event) => {
      const plannedBtn = event.target.closest('[data-planned-module]');
      if (plannedBtn) {
        event.preventDefault();
        event.stopPropagation();
        showPlannedModuleNotice(plannedBtn);
        return;
      }

      const workspaceBtn = event.target.closest('[data-home-open]');
      if (workspaceBtn) {
        const section = String(workspaceBtn.dataset.homeOpen || '');
        if (!section) return;

        setWorkspaceEnabled(true);
        if (section !== 'workspace' && state.workspaceMode === 'normal') {
          setWorkspaceMode('split');
        }
        setWorkspaceSection(section);
        return;
      }

      const cabinetBtn = event.target.closest('[data-home-open-cabinet]');
      if (cabinetBtn) {
        const section = String(cabinetBtn.dataset.homeOpenCabinet || '');
        if (!section) return;
        openCabinet();
        showCabinetSection(section);
        return;
      }

      const workspaceEditorBtn = event.target.closest('[data-workspace-editor-open]');
      if (workspaceEditorBtn) {
        const section = String(workspaceEditorBtn.dataset.workspaceEditorOpen || '');
        if (!section) return;
        setWorkspaceEnabled(true);
        if (section !== 'workspace' && state.workspaceMode === 'normal') {
          setWorkspaceMode('split');
        }
        setWorkspaceSection(section);
        return;
      }

      const workspaceEditorCabinetBtn = event.target.closest('[data-workspace-editor-open-cabinet]');
      if (workspaceEditorCabinetBtn) {
        const section = String(workspaceEditorCabinetBtn.dataset.workspaceEditorOpenCabinet || '').trim() || 'editor';
        openCabinet();
        showCabinetSection(section);
        return;
      }
    });

    document.addEventListener('ns-projects:open-workspace', () => {
      openProjectTarget('workspace');
    });

    document.addEventListener('ns-projects:new-note', (event) => {
      const projectId = event && event.detail ? String(event.detail.projectId || '') : '';
      openProjectTarget('notes');

      if (window.NSNotesStore && typeof window.NSNotesStore.createNote === 'function') {
        const note = window.NSNotesStore.createNote({
          title: tr('Untitled note', tr('Untitled note','Заметка без названия')),
          type: 'note',
          text: '',
          projectId
        });

        if (note && note.id && typeof window.NSNotesStore.setLastOpenedNoteId === 'function') {
          window.NSNotesStore.setLastOpenedNoteId(note.id);
        }
      }
    });

    document.addEventListener('ns-projects:new-draft', (event) => {
      const projectId = event && event.detail ? String(event.detail.projectId || '') : '';
      const surfaceType = openProjectTarget('editor');

      if (window.NSEditorV1 && typeof window.NSEditorV1.createDraftFromTemplate === 'function') {
        let draft = window.NSEditorV1.createDraftFromTemplate(null);

        if (draft && projectId && window.__nsEditorV1Instance && window.__nsEditorV1Instance.store && typeof window.__nsEditorV1Instance.store.saveDraft === 'function') {
          draft = window.__nsEditorV1Instance.store.saveDraft(Object.assign({}, draft, { projectId }));
        }

        if (draft && draft.id && typeof window.NSEditorV1.openDraftById === 'function') {
          window.NSEditorV1.openDraftById(draft.id, surfaceType);
        }
      }
    });

    document.addEventListener('ns-projects:open-files', () => {
      openProjectTarget('files');
    });

    document.addEventListener('ns-projects:open-documents', () => {
      openProjectTarget('documents');
    });

    document.addEventListener('ns-projects:open-map', () => {
      openProjectTarget('map');
    });

    document.addEventListener('ns-projects:open-note', () => {
      openProjectTarget('notes');
    });

    document.addEventListener('ns-tools:use-text', (event) => {
      const detail = event && event.detail ? event.detail : {};
      openProjectTarget('tools');
      setTimeout(() => {
        pushTextIntoTools(detail);
      }, 60);
    });

    document.addEventListener('ns-notes:open-project', () => {
      openProjectTarget('projects');
    });

    document.addEventListener('ns-notes:open-files', () => {
      openProjectTarget('files');
    });

    document.addEventListener('ns-codehub:open-workspace', () => {
      openProjectTarget('codehub');
    });

    document.addEventListener('ns-codehub:open-cabinet', () => {
      openCabinet();
      showCabinetSection('codehub');
    });
  }

  function openProjectTarget(section) {
    const next = String(section || 'workspace');

    if (state.isCabinetOpen) {
      showCabinetSection(next);
      return 'cabinet';
    }

    setWorkspaceEnabled(true);
    if (next !== 'workspace' && state.workspaceMode === 'normal') {
      setWorkspaceMode('split');
    }
    setWorkspaceSection(next);
    return 'workspace';
  }

  function pushTextIntoTools(payload) {
    const text = payload && payload.text ? String(payload.text) : '';
    if (!text) return;

    const translatorRoots = Array.from(document.querySelectorAll('[data-translate-tool-root]'));
    translatorRoots.forEach((root) => {
      const input = root.querySelector('[data-translate-input]');
      const result = root.querySelector('[data-translate-result]');
      const status = root.querySelector('[data-translate-status]');
      if (input) {
        input.value = text;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
      if (result) {
        result.value = '';
      }
      if (status) {
        status.textContent = tr('Project text captured. Ready for translation.', 'Текст проекта захвачен. Готово к переводу.');
      }
    });
  }

  function setWorkspaceEnabled(enabled) {
    state.workspaceEnabled = Boolean(enabled);
    if (!state.workspaceEnabled && state.workspaceMode !== 'normal') {
      state.workspaceMode = 'normal';
    }
    applyWorkspaceUi();
  }

  function setWorkspaceMode(mode) {
    state.workspaceMode = mode === 'split' ? 'split' : 'normal';
    if (state.workspaceMode === 'split') {
      state.workspaceEnabled = true;
    }
    applyWorkspaceUi();
  }

  function setWorkspaceSection(section) {
    const next = String(section || 'workspace');
    state.activeWorkspaceSection = next;

    els.workspaceShellNav?.querySelectorAll('.workspace-nav-btn').forEach((button) => {
      const isActive = button.dataset.section === next;
      button.classList.toggle('active', isActive);
      button.setAttribute('aria-pressed', String(isActive));
    });

    els.workspaceShellBody?.querySelectorAll('[data-panel]').forEach((panel) => {
      const isActive = panel.dataset.panel === next;
      panel.classList.toggle('active', isActive);
      panel.hidden = !isActive;
      panel.setAttribute('aria-hidden', String(!isActive));
      panel.style.display = isActive ? '' : 'none';
      panel.style.pointerEvents = isActive ? 'auto' : 'none';
    });

    if (next === 'workspace') {
      renderHomeDashboard();
    }
  }

  function applyWorkspaceUi() {
    const enabled = state.workspaceEnabled;
    const isSplit = enabled && state.workspaceMode === 'split';

    els.workspaceShell?.classList.toggle('hidden', !enabled);
    els.workspaceDivider?.classList.toggle('hidden', !isSplit);
    els.workspaceShell?.setAttribute('aria-hidden', String(!enabled));

    els.mainLayout?.classList.toggle('mode-normal', !isSplit);
    els.mainLayout?.classList.toggle('mode-split', isSplit);

    if (isSplit && els.workspaceShell) {
      els.workspaceShell.style.width = `${state.workspaceWidthPercent}%`;
    } else if (els.workspaceShell) {
      els.workspaceShell.style.removeProperty('width');
    }

    if (els.workspaceToggle) {
      els.workspaceToggle.setAttribute('aria-pressed', String(enabled));
    }
  }

  function openCabinet() {
    state.isCabinetOpen = true;
    state.cabinetMode = 'grid';

    // Big Cabinet is a full surface. Keep the small split Workspace closed
    // behind it; the Workspace button can still open the small panel separately.
    setWorkspaceEnabled(false);
    setWorkspaceMode('normal');

    syncCabinetUi();
  }

  function closeCabinet() {
    state.isCabinetOpen = false;
    state.cabinetMode = 'grid';
    syncCabinetUi();
  }

  function showCabinetGrid() {
    state.cabinetMode = 'grid';
    setWorkspaceEnabled(false);
    setWorkspaceMode('normal');
    syncCabinetUi();
  }

  function showCabinetSection(section) {
    const next = String(section || 'workspace');

    // IRGEZTNE_FLOATING_WINDOW_MANAGER_BEFORE_V04P17B
    const floatingWindowManagerP17B = window.__IRGEZTNE_FLOATING_WINDOW_MANAGER_V04P17B;
    const floatingWindowIntentP17B = (
      floatingWindowManagerP17B &&
      typeof floatingWindowManagerP17B.beforeLegacyRoute === 'function'
    ) ? floatingWindowManagerP17B.beforeLegacyRoute(next) : null;



    // There is only one Home in Workspace: the browser start page.
    // Do not open the old Cabinet 'workspace' page as a second Home.
    if (next === 'workspace') {
      activateRealWorkspaceHome();
      return;
    }

    state.activeCabinetSection = next;
    state.isCabinetOpen = true;
    state.cabinetMode = 'expanded';

    if (els.cabinetExpandedTitle) {
      els.cabinetExpandedTitle.textContent = getCabinetTitle(next);
    }

    if (els.cabinetExpandedSubtitle) {
      els.cabinetExpandedSubtitle.textContent = getCabinetSubtitle(next);
    }

    normalizeFullModuleNavigation();

    document.querySelectorAll('.cabinet-inner-nav-btn').forEach((button) => {
      const isActive = button.dataset.section === next;
      button.classList.toggle('active', isActive);
      button.setAttribute('aria-pressed', String(isActive));
    });

    document.querySelectorAll('.cabinet-section-panel').forEach((panel) => {
      const isActive = panel.dataset.cabinetPanel === next;
      panel.classList.toggle('active', isActive);
      panel.hidden = !isActive;
      panel.setAttribute('aria-hidden', String(!isActive));
      panel.style.display = isActive ? '' : 'none';
      panel.style.pointerEvents = isActive ? 'auto' : 'none';
    });

    if (els.cabinetExpandedBody) {
      els.cabinetExpandedBody.scrollTop = 0;
    }

    // Big Cabinet owns the visible module surface.
    // Do not open the small split Workspace behind expanded Cabinet sections.
    setWorkspaceEnabled(false);
    setWorkspaceMode('normal');

    if (next === 'workspace') {
      renderHomeDashboard();
    }

    syncCabinetUi();

    // IRGEZTNE_FLOATING_WINDOW_MANAGER_AFTER_V04P17B
    if (
      floatingWindowIntentP17B &&
      floatingWindowManagerP17B &&
      typeof floatingWindowManagerP17B.afterLegacyRoute === 'function'
    ) {
      floatingWindowManagerP17B.afterLegacyRoute(next, floatingWindowIntentP17B);
    }
  }

  function syncCabinetUi() {
    const isOpen = state.isCabinetOpen;
    const expanded = isOpen && state.cabinetMode === 'expanded';
    const fullModuleShellOpen = expanded && [
      'files',
      'projects',
      'notes',
      'documents',
      'site-pages',
      'tools',
      'rooms',
      'tasks',
      'account'
    ].includes(state.activeCabinetSection);

    // Full Workspace modules reuse the already-stable Full Office shell behavior:
    // the browser chrome is hidden and the active module owns the wide surface.
    // Home keeps the browser. Templates/Workshop are intentionally not folded into
    // this rule here because their final ownership belongs inside Web Studio.
    // Keep the legacy class name: existing CSS already owns the proven behavior.
    document.body.classList.toggle('is-office-shell-open', fullModuleShellOpen);
    document.body.classList.toggle('is-workspace-full-module-open', fullModuleShellOpen);
    if (fullModuleShellOpen) document.body.dataset.workspaceFullModule = state.activeCabinetSection;
    else delete document.body.dataset.workspaceFullModule;

    const accountFullSurface = fullModuleShellOpen && state.activeCabinetSection === 'account';
    const innerNav = document.getElementById('cabinetInnerNav');
    if (innerNav) {
      innerNav.hidden = accountFullSurface;
      if (accountFullSurface) innerNav.style.setProperty('display', 'none', 'important');
      else innerNav.style.removeProperty('display');
    }

    if (fullModuleShellOpen && !accountFullSurface) normalizeFullModuleNavigation();
    else if (!fullModuleShellOpen) normalizeWorkspaceHomeCardOrder();

    if (expanded) {
      if (els.cabinetExpandedTitle) els.cabinetExpandedTitle.textContent = getCabinetTitle(state.activeCabinetSection);
      if (els.cabinetExpandedSubtitle) els.cabinetExpandedSubtitle.textContent = getCabinetSubtitle(state.activeCabinetSection);
      document.querySelectorAll('.cabinet-inner-nav-btn').forEach((button) => {
        const active = button.dataset.section === state.activeCabinetSection;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', String(active));
      });
    }

    // v0.4P12: Full Workspace modules keep exactly one global control from the
    // hidden Browser Shell: RU/EN. Web Studio is excluded because it already owns
    // its own language control and should not receive a duplicate button.
    setFullModuleLanguageButtonVisible(fullModuleShellOpen && state.activeCabinetSection !== 'site-pages');

    els.cabinetOverlay?.classList.toggle('hidden', !isOpen);
    els.cabinetOverlay?.setAttribute('aria-hidden', String(!isOpen));

    els.cabinetGridView?.classList.toggle('hidden', !isOpen || expanded);
    els.cabinetGridView?.setAttribute('aria-hidden', String(!isOpen || expanded));

    els.cabinetExpandedView?.classList.toggle('hidden', !isOpen || !expanded);
    els.cabinetExpandedView?.setAttribute('aria-hidden', String(!isOpen || !expanded));

    if (els.cabinetOverlay) {
      els.cabinetOverlay.dataset.cabinetMode = state.cabinetMode;
      els.cabinetOverlay.dataset.cabinetSection = state.activeCabinetSection;

      // v0.4P2: expanded real modules must own the complete application surface.
      // The base Cabinet CSS intentionally reserves topbar + tabsbar height.
      // Full Office hides that browser chrome, so keeping the reserved inset
      // exposes the page underneath (the visible strip seen above Full Chat).
      // Apply the geometry at the shared Cabinet owner instead of patching
      // Green Lightning / Office / every module separately.
      if (fullModuleShellOpen) {
        els.cabinetOverlay.style.setProperty('inset', '0px', 'important');
      } else {
        els.cabinetOverlay.style.removeProperty('inset');
      }
    }
  }


function initHomeDashboard() {
  bindHomeDashboard();
  subscribeHomeDashboard();
  renderHomeDashboard();
}

function bindHomeDashboard() {
  if (homeDashboardBound) return;
  homeDashboardBound = true;

  document.addEventListener('click', (event) => {
    const fileBtn = event.target.closest('[data-home-open-file]');
    if (fileBtn) {
      const fileId = String(fileBtn.dataset.homeOpenFile || '');
      if (!fileId || !window.NSLibraryStore) return;

      if (typeof window.NSLibraryStore.setActiveItem === 'function') {
        window.NSLibraryStore.setActiveItem(fileId);
      }

      if (state.isCabinetOpen) {
        showCabinetSection('files');
      } else {
        setWorkspaceEnabled(true);
        if (state.workspaceMode === 'normal') setWorkspaceMode('split');
        setWorkspaceSection('files');
      }
      return;
    }

    const fileTabBtn = event.target.closest('[data-home-open-file-tab]');
    if (fileTabBtn) {
      const fileId = String(fileTabBtn.dataset.homeOpenFileTab || '');
      if (!fileId) return;

      const opened = openLibraryItemInTab(fileId);
      if (opened && state.isCabinetOpen) {
        closeCabinet();
      }
      return;
    }

    const projectBtn = event.target.closest('[data-home-open-project]');
    if (projectBtn) {
      const projectId = String(projectBtn.dataset.homeOpenProject || '');
      if (!projectId || !window.NSProjectStore) return;

      if (typeof window.NSProjectStore.setLastOpenedProjectId === 'function') {
        window.NSProjectStore.setLastOpenedProjectId(projectId);
      }

      if (state.isCabinetOpen) {
        showCabinetSection('projects');
      } else {
        setWorkspaceEnabled(true);
        if (state.workspaceMode === 'normal') setWorkspaceMode('split');
        setWorkspaceSection('projects');
      }
      return;
    }

    const noteBtn = event.target.closest('[data-home-open-note]');
    if (noteBtn) {
      const noteId = String(noteBtn.dataset.homeOpenNote || '');
      if (!noteId || !window.NSNotesStore) return;

      if (typeof window.NSNotesStore.setLastOpenedNoteId === 'function') {
        window.NSNotesStore.setLastOpenedNoteId(noteId);
      }

      if (state.isCabinetOpen) {
        showCabinetSection('notes');
      } else {
        setWorkspaceEnabled(true);
        if (state.workspaceMode === 'normal') setWorkspaceMode('split');
        setWorkspaceSection('notes');
      }
      return;
    }


    const packageBtn = event.target.closest('[data-home-open-package]');
    if (packageBtn) {
      const packageId = String(packageBtn.dataset.homeOpenPackage || '');
      if (!packageId || !window.NSCodeHubStore) return;

      if (typeof window.NSCodeHubStore.setActiveItem === 'function') {
        window.NSCodeHubStore.setActiveItem(packageId);
      }

      if (state.isCabinetOpen) {
        showCabinetSection('codehub');
      } else {
        setWorkspaceEnabled(true);
        if (state.workspaceMode === 'normal') setWorkspaceMode('split');
        setWorkspaceSection('codehub');
      }
    }
  });
}

function subscribeHomeDashboard() {
  if (homeDashboardSubscribed) return;
  homeDashboardSubscribed = true;

  const rerender = () => {
    renderHomeDashboard();
  };

  if (window.NSLibraryStore && typeof window.NSLibraryStore.subscribe === 'function') {
    window.NSLibraryStore.subscribe(rerender);
  } else {
    window.addEventListener('ns:library-store-changed', rerender);
  }

  if (window.NSProjectStore && typeof window.NSProjectStore.subscribe === 'function') {
    window.NSProjectStore.subscribe(rerender);
  }

  if (window.NSNotesStore && typeof window.NSNotesStore.subscribe === 'function') {
    window.NSNotesStore.subscribe(rerender);
  }

  if (window.NSCodeHubStore && typeof window.NSCodeHubStore.subscribe === 'function') {
    window.NSCodeHubStore.subscribe(rerender);
  }

  document.addEventListener('irg:bookmarks-updated', rerender);
}

function getBrowserBookmarks() {
  const api = window.__IRG_BROWSER_SHELL_API;
  if (api && typeof api.getBookmarks === 'function') {
    const items = api.getBookmarks();
    return Array.isArray(items) ? items.slice() : [];
  }
  return Array.isArray(window.__IRG_BROWSER_BOOKMARKS__) ? window.__IRG_BROWSER_BOOKMARKS__.slice() : [];
}

function openBrowserBookmark(url, title) {
  const target = String(url || '').trim();
  if (!target) return false;
  const api = window.__IRG_BROWSER_SHELL_API;
  if (api && typeof api.createTab === 'function') {
    api.createTab({ title: title || target, url: target });
    if (typeof api.updateAddressFromActiveTab === 'function') {
      api.updateAddressFromActiveTab();
    }
    if (state.isCabinetOpen) closeCabinet();
    return true;
  }
  try {
    window.open(target, '_blank', 'noopener');
    return true;
  } catch (error) {
    console.warn('[workspace] failed to open bookmark', error);
    return false;
  }
}

function renderHomeDashboard() {
  const root = document.getElementById('workspaceCombinedLayout');
  const hasWorkspaceHome = Boolean(root && root.classList.contains('workspace-home-dashboard'));
  const isCompactHome = Boolean(root && root.classList.contains('workspace-home-dashboard--compact'));
  const listLimit = isCompactHome ? 4 : 3;

  const compactEmpty = {
    files: tr('No files yet.','Файлов пока нет.'),
    projects: tr('No projects yet.','Проектов пока нет.'),
    notes: tr('No notes yet.','Заметок пока нет.'),
    bookmarks: tr('No saved sites yet.','Сохранённых сайтов пока нет.'),
    packages: tr('No packages yet.','Пакетов пока нет.')
  };

  const fileState = window.NSLibraryStore && typeof window.NSLibraryStore.getState === 'function'
    ? window.NSLibraryStore.getState()
    : { items: [], activeId: null };
  const fileItems = Array.isArray(fileState.items) ? fileState.items.slice() : [];
  const fileItemsSorted = fileItems.slice().sort(compareUpdatedDesc);
  const activeFile = fileState.activeId && window.NSLibraryStore && typeof window.NSLibraryStore.getItemById === 'function'
    ? window.NSLibraryStore.getItemById(fileState.activeId)
    : null;
  const fileFavoritesCount = fileItems.filter((item) => item && (item.favorite || item.pinned)).length;
  const browserBookmarks = getBrowserBookmarks().sort((a, b) => getTimeValue(b && b.savedAt) - getTimeValue(a && a.savedAt));
  const favoritesCount = fileFavoritesCount + browserBookmarks.length;

  const projectItems = window.NSProjectStore && typeof window.NSProjectStore.getAll === 'function'
    ? window.NSProjectStore.getAll()
    : [];
  const activeProjectId = window.NSProjectStore && typeof window.NSProjectStore.getLastOpenedProjectId === 'function'
    ? window.NSProjectStore.getLastOpenedProjectId()
    : '';
  const activeProject = activeProjectId && window.NSProjectStore && typeof window.NSProjectStore.getById === 'function'
    ? window.NSProjectStore.getById(activeProjectId)
    : null;

  const noteItems = window.NSNotesStore && typeof window.NSNotesStore.getAll === 'function'
    ? window.NSNotesStore.getAll()
    : [];
  const activeNoteId = window.NSNotesStore && typeof window.NSNotesStore.getLastOpenedNoteId === 'function'
    ? window.NSNotesStore.getLastOpenedNoteId()
    : '';
  const activeNote = activeNoteId && window.NSNotesStore && typeof window.NSNotesStore.getById === 'function'
    ? window.NSNotesStore.getById(activeNoteId)
    : null;

  const packageItems = window.NSCodeHubStore && typeof window.NSCodeHubStore.getAll === 'function'
    ? window.NSCodeHubStore.getAll()
    : [];
  const packageItemsSorted = packageItems.slice().sort(compareUpdatedDesc);
  const activePackage = window.NSCodeHubStore && typeof window.NSCodeHubStore.getActiveItem === 'function'
    ? window.NSCodeHubStore.getActiveItem()
    : null;

  if (hasWorkspaceHome) {
    setTextContent('homeStatFiles', String(fileItems.length));
    setTextContent('homeStatProjects', String(projectItems.length));
    setTextContent('homeStatNotes', String(noteItems.length));
    setTextContent('homeStatFavorites', String(favoritesCount));

    setTextContent('homeFilesMeta', fileItems.length ? (isCompactHome ? `${fileItems.length} ${tr('items','элементов')}` : `${fileItems.length} ${tr('source library items','элементов библиотеки источников')}`) : tr('Source Library is empty','Библиотека источников пуста'));
    setTextContent('homeProjectsMeta', projectItems.length ? (isCompactHome ? `${projectItems.length} ${tr('active','активных')}` : `${projectItems.length} ${tr('linked projects','связанных проектов')}`) : tr('No projects yet','Проектов пока нет'));
    setTextContent('homeNotesMeta', noteItems.length ? (isCompactHome ? `${noteItems.length} ${tr('saved','сохранено')}` : `${noteItems.length} ${tr('saved notes','заметок сохранено')}`) : tr('No notes yet','Заметок пока нет'));
    setTextContent('homeFavoritesMeta', favoritesCount
      ? (isCompactHome
        ? `${favoritesCount} ${tr('saved','сохранено')}`
        : `${fileFavoritesCount} ${tr('file favorites','избранных файлов')} · ${browserBookmarks.length} ${tr('saved sites','сохранённых сайтов')}`)
      : tr('No favorites yet','Избранного пока нет'));

    const focusStrip = document.getElementById('homeFocusStrip');
    if (focusStrip) {
      focusStrip.innerHTML = (isCompactHome
        ? [
            `<span class="workspace-home-focus-chip">Файл: ${escapeHtml(activeFile ? activeFile.name : tr('none','нет'))}</span>`,
            `<span class="workspace-home-focus-chip">Проект: ${escapeHtml(activeProject ? activeProject.title : tr('none','нет'))}</span>`,
            `<span class="workspace-home-focus-chip">Заметка: ${escapeHtml(activeNote ? activeNote.title : tr('none','нет'))}</span>`
          ]
        : [
            `<span class="workspace-home-focus-chip">Активный файл: ${escapeHtml(activeFile ? activeFile.name : tr('none','нет'))}</span>`,
            `<span class="workspace-home-focus-chip">Проект: ${escapeHtml(activeProject ? activeProject.title : tr('none','нет'))}</span>`,
            `<span class="workspace-home-focus-chip">Заметка: ${escapeHtml(activeNote ? activeNote.title : tr('none','нет'))}</span>`
          ]).join('');
    }

    renderHomeList(
      'homeFilesList',
      fileItemsSorted.slice(0, listLimit).map((item) => {
        const kind = item && item.preview && item.preview.kind ? String(item.preview.kind) : 'file';
        return {
          title: item && item.name ? normalizeWorkspaceLabel(item.name) : tr('Untitled file','Файл без названия'),
          meta: normalizeWorkspaceLabel((isCompactHome
            ? [item && item.category ? item.category : tr('other','другое')].filter(Boolean).join(' · ')
            : [item && item.category ? item.category : tr('other','другое'), kind, formatHomeDate(item && item.updatedAt)].filter(Boolean).join(' · '))),
          primaryAction: `<button type="button" class="workspace-home-row-btn" data-home-open-file="${escapeHtml(item.id)}">${tr('Open',tr('Open','Открыть'))}</button>`,
          secondaryAction: ''
        };
      }),
      isCompactHome ? compactEmpty.files : 'Файлов пока нет. Загрузите файлы, чтобы начать собирать библиотеку источников.'
    );

    renderHomeList(
      'homeProjectsList',
      projectItems.slice(0, listLimit).map((project) => {
        const counts = window.NSProjectStore && typeof window.NSProjectStore.getCounts === 'function'
          ? window.NSProjectStore.getCounts(project.id)
          : { files: 0, notes: 0, drafts: 0 };
        return {
          title: normalizeWorkspaceLabel(project.title || tr('Untitled project','Проект без названия')),
          meta: normalizeWorkspaceLabel((isCompactHome
            ? [project.type || tr('project','проект')].filter(Boolean).join(' · ')
            : [project.type, project.status, `${tr('Files','Файлы')} ${counts.files}`, `${tr('Notes','Заметки')} ${counts.notes}`].filter(Boolean).join(' · '))),
          primaryAction: `<button type="button" class="workspace-home-row-btn" data-home-open-project="${escapeHtml(project.id)}">${tr('Open',tr('Open','Открыть'))}</button>`
        };
      }),
      isCompactHome ? compactEmpty.projects : tr('No projects yet. Create a project to connect files, notes, and drafts.', 'Проектов пока нет. Создайте проект, чтобы связать файлы, заметки и черновики.')
    );

    renderHomeList(
      'homeNotesList',
      noteItems.slice(0, listLimit).map((note) => {
        const preview = String(note && note.text ? note.text : '').replace(/\s+/g, ' ').trim();
        const previewLimit = isCompactHome ? 40 : 72;
        const compactPreview = preview ? preview.slice(0, previewLimit) + (preview.length > previewLimit ? '…' : '') : tr('Empty note', 'Пустая заметка');
        return {
          title: normalizeWorkspaceLabel(note.title || tr('Untitled note','Заметка без названия')),
          meta: normalizeWorkspaceLabel(isCompactHome
            ? compactPreview
            : [note.type, compactPreview].filter(Boolean).join(' · ')),
          primaryAction: `<button type="button" class="workspace-home-row-btn" data-home-open-note="${escapeHtml(note.id)}">${tr('Open',tr('Open','Открыть'))}</button>`
        };
      }),
      isCompactHome ? compactEmpty.notes : tr('No notes yet. Use quick capture or open the notes module.', 'Заметок пока нет. Используйте быстрый захват или откройте модуль заметок.')
    );

  }

  renderCabinetHome({
    fileItemsSorted,
    projectItems,
    noteItems,
    packageItemsSorted,
    activeFile,
    activeProject,
    activeNote,
    activePackage,
    compactEmpty
  });
}

function renderCabinetHome(context) {
  renderCabinetMiniList(
    'cabinetHomeRecentFiles',
    context.fileItemsSorted.slice(0, 3).map(function (item) {
      const kind = item && item.category ? String(item.category) : 'file';
      return {
        id: item && item.id ? item.id : '',
        title: item && item.name ? normalizeWorkspaceLabel(item.name) : tr('Untitled file','Файл без названия'),
        meta: normalizeWorkspaceLabel(kind),
        action: tr('Open','Открыть'),
        actionType: 'file'
      };
    }),
    context.compactEmpty.files
  );

  renderCabinetMiniList(
    'cabinetHomeRecentProjects',
    context.projectItems.slice(0, 3).map(function (project) {
      return {
        id: project && project.id ? project.id : '',
        title: project && project.title ? normalizeWorkspaceLabel(project.title) : tr('Untitled project','Проект без названия'),
        meta: normalizeWorkspaceLabel(project && project.type ? project.type : tr('project','проект')),
        action: tr('Open','Открыть'),
        actionType: 'project'
      };
    }),
    context.compactEmpty.projects
  );

  renderCabinetMiniList(
    'cabinetHomeRecentNotes',
    context.noteItems.slice(0, 3).map(function (note) {
      const preview = String(note && note.text ? note.text : '').replace(/\s+/g, ' ').trim();
      return {
        id: note && note.id ? note.id : '',
        title: note && note.title ? normalizeWorkspaceLabel(note.title) : tr('Untitled note','Заметка без названия'),
        meta: preview ? normalizeWorkspaceLabel(preview.slice(0, 42) + (preview.length > 42 ? '…' : '')) : tr('Empty note', 'Пустая заметка'),
        action: tr('Open','Открыть'),
        actionType: 'note'
      };
    }),
    context.compactEmpty.notes
  );

  renderCabinetMiniList(
    'cabinetHomeRecentPackages',
    context.packageItemsSorted.slice(0, 3).map(function (item) {
      return {
        id: item && item.id ? item.id : '',
        title: item && item.title ? normalizeWorkspaceLabel(item.title) : tr('Untitled package','Пакет без названия'),
        meta: normalizeProjectMetaText([item && item.type ? item.type : tr('package','пакет'), item && item.status ? item.status : tr('draft','черновик')].filter(Boolean).join(' · ')),
        action: tr('Open','Открыть'),
        actionType: 'package'
      };
    }),
    context.compactEmpty.packages
  );

  renderCabinetContinueBlock('cabinetHomeContinueBlock', [
    {
      id: context.activeFile && context.activeFile.id ? context.activeFile.id : '',
      title: context.activeFile && context.activeFile.name ? normalizeWorkspaceLabel(context.activeFile.name) : tr('No active file yet','Активного файла пока нет'),
      meta: normalizeWorkspaceLabel(tr('Continue in files','Продолжить в файлах')),
      actionType: 'file'
    },
    {
      id: context.activeProject && context.activeProject.id ? context.activeProject.id : '',
      title: context.activeProject && context.activeProject.title ? normalizeWorkspaceLabel(context.activeProject.title) : tr('No active project yet','Активного проекта пока нет'),
      meta: normalizeWorkspaceLabel(tr('Continue in projects','Продолжить в проектах')),
      actionType: 'project'
    },
    {
      id: context.activeNote && context.activeNote.id ? context.activeNote.id : '',
      title: context.activeNote && context.activeNote.title ? normalizeWorkspaceLabel(context.activeNote.title) : tr('No active note yet','Активной заметки пока нет'),
      meta: normalizeWorkspaceLabel(tr('Continue in notes','Продолжить в заметках')),
      actionType: 'note'
    },
    {
      id: context.activePackage && context.activePackage.id ? context.activePackage.id : '',
      title: context.activePackage && context.activePackage.title ? normalizeWorkspaceLabel(context.activePackage.title) : tr('No active package yet','Активного пакета пока нет'),
      meta: normalizeWorkspaceLabel(tr('Continue in Web Workshop','Продолжить в Веб-мастерской')),
      actionType: 'package'
    }
  ]);
}

function renderCabinetMiniList(containerId, items, emptyText) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!items || !items.length) {
    container.innerHTML = `<div class="cabinet-home-empty">${escapeHtml(emptyText)}</div>`;
    return;
  }

  container.innerHTML = items.map(function (item) {
    return [
      '<div class="cabinet-home-mini-row">',
      '  <div class="cabinet-home-mini-copy">',
      `    <div class="cabinet-home-mini-title">${escapeHtml(item.title || tr('Untitled','Без названия'))}</div>`,
      `    <div class="cabinet-home-mini-meta">${escapeHtml(item.meta || '')}</div>`,
      '  </div>',
      `  <button type="button" class="cabinet-home-mini-btn" data-home-open-${escapeHtml(item.actionType)}="${escapeHtml(item.id || '')}">${escapeHtml(item.action || tr('Open',tr('Open','Открыть')))}</button>`,
      '</div>'
    ].join('');
  }).join('');
}

function renderCabinetContinueBlock(containerId, items) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = items.map(function (item) {
    const isEmpty = !item.id;
    return [
      `<div class="cabinet-home-resume-row${isEmpty ? ' is-empty' : ''}">`,
      '  <div class="cabinet-home-resume-copy">',
      `    <div class="cabinet-home-resume-title">${escapeHtml(item.title || tr('Untitled','Без названия'))}</div>`,
      `    <div class="cabinet-home-resume-meta">${escapeHtml(item.meta || '')}</div>`,
      '  </div>',
      isEmpty
        ? '  <span class="cabinet-home-mini-btn" aria-hidden="true">' + tr('Waiting','Ожидание') + '</span>'
        : `  <button type="button" class="cabinet-home-resume-btn" data-home-open-${escapeHtml(item.actionType)}="${escapeHtml(item.id)}">${tr('Open',tr('Open','Открыть'))}</button>`,
      '</div>'
    ].join('');
  }).join('');
}

function renderHomeList(containerId, items, emptyText) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!items || !items.length) {
    container.innerHTML = `<div class="workspace-home-empty">${escapeHtml(emptyText)}</div>`;
    return;
  }

  container.innerHTML = items.map((item) => {
    return [
      '<div class="workspace-home-row">',
      `  <div class="workspace-home-row-copy">`,
      `    <div class="workspace-home-row-title">${escapeHtml(item.title || tr('Untitled','Без названия'))}</div>`,
      `    <div class="workspace-home-row-meta">${escapeHtml(item.meta || '')}</div>`,
      '  </div>',
      `  <div class="workspace-home-row-actions">${item.primaryAction || ''}${item.secondaryAction || ''}</div>`,
      '</div>'
    ].join('');
  }).join('');
}

function setTextContent(id, value) {
  const node = document.getElementById(id);
  if (node) {
    node.textContent = value;
  }
}

function openLibraryItemInTab(fileId) {
  const api = window.__IRG_BROWSER_SHELL_API;
  if (api && typeof api.openLibraryFileInTab === 'function') {
    return Boolean(api.openLibraryFileInTab(fileId));
  }

  document.dispatchEvent(new CustomEvent('ns-library:open-file-tab', {
    detail: { fileId }
  }));
  return true;
}

  function getCabinetTitle(section) {
    const map = {
      video: tr('Chat', 'Чат'),
      chat: tr('Chat', 'Chat'),
      rooms: tr('Chat', 'Чат'),
      'fili-store': 'Fili Store',
      'fili-safe': 'Fili Safe',
      tasks: tr('Tasks', 'Задачи'),
      files: tr('Files', 'Файлы'),
      projects: tr('Projects', 'Проекты'),
      notes: tr('Notes', 'Заметки'),
      documents: tr('Office', 'Офис'),
      'site-pages': tr('Web Studio', 'Web Studio'),
      tools: tr('Tools', 'Инструменты'),
      editor: tr('Editor', 'Редактор'),
      wallet: 'Fili Safe',
      codehub: tr('Web Workshop', 'Веб-мастерская'),
      marketplace: tr('Templates', 'Шаблоны'),
      map: tr('Map', 'Карта'),
      account: tr('Account', 'Аккаунт'),
      workspace: tr('Home', 'Главная')
    };
    return map[section] || tr('Section', 'Раздел');
  }

  function getCabinetSubtitle(section) {
    const map = {
      video: tr('Simple encrypted-ready project chat.', 'Простой проектный чат с основой под шифрование.'),
      chat: tr('Dialogs and assistant flow', 'Диалоги и поток помощника'),
      rooms: tr('Simple encrypted-ready project chat.', 'Простой проектный чат с основой под шифрование.'),
      'fili-store': tr('Useful file catalog shell; no payments or credits in v0', 'Оболочка полезного файлового каталога; без оплат и credits в v0'),
      'fili-safe': tr('Local safe/profile shell for future signatures and File Credits', 'Локальная безопасная зона для будущих подписей и File Credits'),
      tasks: tr('Personal and project tasks, next actions, and working context.', 'Личные и проектные задачи, следующие действия и рабочий контекст.'),
      files: tr('Sources, uploads, and documents', 'Источники, загрузки и документы'),
      projects: tr('Project containers and workspace flow', 'Контейнеры проектов и рабочий поток'),
      notes: tr('Linked notes and references', 'Связанные заметки и ссылки'),
      documents: tr('Native workspace for documents, spreadsheets, presentations, diagrams, and formulas', 'Родное рабочее пространство для документов, таблиц, презентаций, диаграмм и формул'),
      'site-pages': tr('Site identity, pages, menu, and publishing foundation', 'Identity сайта, страницы, меню и основа публикации'),
      'site-pages': tr('Site identity, Pages Manager, menu foundation, and future build/export flow', 'Идентичность сайта, Pages Manager, основа меню и будущий build/export flow'),
      tools: tr('Utilities for files, images, PDF, text and publishing', 'Утилиты для файлов, изображений, PDF, текста и публикации'),
      editor: tr('Drafting and editing surface', 'Поверхность для черновиков и редактирования'),
      wallet: tr('Local safe/profile shell; no finance in v0', 'Локальная безопасная зона; без финансов в v0'),
      codehub: tr('Package drafts and template preparation', 'Черновики пакетов и подготовка шаблонов'),
      marketplace: tr('Templates, themes, packs, and submitted Templates items', 'Шаблоны, темы, паки и отправленные элементы Шаблоныа'),
      map: tr('Canvas map for research, regions, projects, and future file links', 'Canvas-карта для исследований, регионов, проектов и будущих связей с файлами'),
      account: tr('Connected identity, trusted device, services, and security', 'Подключённая идентичность, доверенное устройство, сервисы и безопасность'),
      workspace: tr('Main launch point for files, notes, projects, editor, and bookmarks', 'Главная точка запуска для файлов, заметок, проектов, редактора и закладок')
    };
    return map[section] || tr('Workspace section', 'Раздел пространства');
  }

function compareUpdatedDesc(a, b) {
  return getTimeValue(b && b.updatedAt) - getTimeValue(a && a.updatedAt);
}

function getTimeValue(value) {
  const time = value ? new Date(value).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
}

function formatHomeDate(value) {
  if (!value) return '';
  try {
    return new Date(value).toLocaleString();
  } catch (error) {
    return String(value);
  }
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }
}
