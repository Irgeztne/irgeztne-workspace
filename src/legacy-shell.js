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
    ['Продолжить в файлах','Continue in files'],
    ['Продолжить в проектах','Continue in projects'],
    ['Продолжить в заметках','Continue in notes'],
    ['Продолжить в CodeHub','Continue in CodeHub'],
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
    ['черновики','Drafts']
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
  bindCabinet();
  bindHomeShortcuts();
  initHomeDashboard();
  applyWorkspaceUi();
  syncCabinetUi();
  setWorkspaceSection(state.activeWorkspaceSection);

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

  function bindCabinet() {
    els.hamburgerBtn?.addEventListener('click', () => {
      if (state.isCabinetOpen) closeCabinet();
      else openCabinet();
    });

    els.cabinetCloseBtn?.addEventListener('click', closeCabinet);
    els.cabinetCloseBtnExpanded?.addEventListener('click', closeCabinet);
    els.cabinetBackBtn?.addEventListener('click', showCabinetGrid);

    document.addEventListener('click', (event) => {
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
    syncCabinetUi();
  }

  function closeCabinet() {
    state.isCabinetOpen = false;
    state.cabinetMode = 'grid';
    syncCabinetUi();
  }

  function showCabinetGrid() {
    state.cabinetMode = 'grid';
    syncCabinetUi();
  }

  function showCabinetSection(section) {
    const next = String(section || 'workspace');
    state.activeCabinetSection = next;
    state.isCabinetOpen = true;
    state.cabinetMode = 'expanded';

    if (els.cabinetExpandedTitle) {
      els.cabinetExpandedTitle.textContent = getCabinetTitle(next);
    }

    if (els.cabinetExpandedSubtitle) {
      els.cabinetExpandedSubtitle.textContent = getCabinetSubtitle(next);
    }

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

    if (next === 'workspace') {
      setWorkspaceEnabled(true);
      setWorkspaceMode('split');
      setWorkspaceSection('workspace');
    } else {
      setWorkspaceEnabled(true);
      if (state.workspaceMode === 'normal') setWorkspaceMode('split');
      setWorkspaceSection(next);
    }

    syncCabinetUi();
  }

  function syncCabinetUi() {
    const isOpen = state.isCabinetOpen;
    const expanded = isOpen && state.cabinetMode === 'expanded';

    els.cabinetOverlay?.classList.toggle('hidden', !isOpen);
    els.cabinetOverlay?.setAttribute('aria-hidden', String(!isOpen));

    els.cabinetGridView?.classList.toggle('hidden', !isOpen || expanded);
    els.cabinetGridView?.setAttribute('aria-hidden', String(!isOpen || expanded));

    els.cabinetExpandedView?.classList.toggle('hidden', !isOpen || !expanded);
    els.cabinetExpandedView?.setAttribute('aria-hidden', String(!isOpen || !expanded));

    if (els.cabinetOverlay) {
      els.cabinetOverlay.dataset.cabinetMode = state.cabinetMode;
      els.cabinetOverlay.dataset.cabinetSection = state.activeCabinetSection;
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
  const favoritesCount = fileItems.filter((item) => item && (item.favorite || item.pinned)).length;

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
    setTextContent('homeFavoritesMeta', favoritesCount ? (isCompactHome ? `${favoritesCount} сохранено` : `${favoritesCount} избранных или закреплённых элементов`) : tr('No favorites yet','Избранного пока нет'));

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
          secondaryAction: isCompactHome ? '' : `<button type="button" class="workspace-home-row-btn secondary" data-home-open-file-tab="${escapeHtml(item.id)}">${tr('In Tab','Во вкладке')}</button>`
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
      meta: normalizeWorkspaceLabel(tr('Continue in CodeHub','Продолжить в CodeHub')),
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
      video: 'Видео и чат',
      chat: 'Chat',
      files: 'Файлы',
      projects: 'Проекты',
      notes: 'Заметки',
      tools: 'Tools',
      editor: 'Editor',
      wallet: 'Digital Wallet',
      analytics: 'Analytics',
      codehub: 'CodeHub',
      marketplace: 'Каталог',
      workspace: 'Главная'
    };
    return map[section] || 'Раздел';
  }

  function getCabinetSubtitle(section) {
    const map = {
      video: 'Видео, чат и будущий слой коммуникации',
      chat: 'Диалоги и поток помощника',
      files: 'Источники, загрузки и документы',
      projects: 'Контейнеры проектов и рабочий поток',
      notes: 'Связанные заметки и ссылки',
      tools: 'Служебные модули и поток перевода',
      editor: 'Поверхность для черновиков и редактирования',
      wallet: 'Цифровой кошелёк и платёжные направления · будущий модуль',
      analytics: 'Лёгкая аналитика сайтов, доменов и публикаций · будущий модуль',
      codehub: 'Черновики пакетов и подготовка к Каталогу',
      marketplace: 'Шаблоны, темы, паки и отправленные элементы Каталога',
      workspace: 'Главная точка запуска для файлов, заметок, проектов, редактора и закладок'
    };
    return map[section] || 'Раздел пространства';
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
