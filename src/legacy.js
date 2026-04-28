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
      }
    });

    document.addEventListener('ns-projects:open-workspace', () => {
      setWorkspaceEnabled(true);
      if (state.workspaceMode === 'normal') setWorkspaceMode('split');
      setWorkspaceSection('projects');
    });

    document.addEventListener('ns-projects:new-note', () => {
      setWorkspaceEnabled(true);
      if (state.workspaceMode === 'normal') setWorkspaceMode('split');
      setWorkspaceSection('notes');
    });

    document.addEventListener('ns-projects:open-files', () => {
      setWorkspaceEnabled(true);
      if (state.workspaceMode === 'normal') setWorkspaceMode('split');
      setWorkspaceSection('files');
    });

    document.addEventListener('ns-projects:open-note', () => {
      setWorkspaceEnabled(true);
      if (state.workspaceMode === 'normal') setWorkspaceMode('split');
      setWorkspaceSection('notes');
    });

    document.addEventListener('ns-notes:open-project', () => {
      setWorkspaceEnabled(true);
      if (state.workspaceMode === 'normal') setWorkspaceMode('split');
      setWorkspaceSection('projects');
    });

    document.addEventListener('ns-notes:open-files', () => {
      setWorkspaceEnabled(true);
      if (state.workspaceMode === 'normal') setWorkspaceMode('split');
      setWorkspaceSection('files');
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

      setWorkspaceEnabled(true);
      if (state.workspaceMode === 'normal') setWorkspaceMode('split');
      setWorkspaceSection('files');
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

      setWorkspaceEnabled(true);
      if (state.workspaceMode === 'normal') setWorkspaceMode('split');
      setWorkspaceSection('projects');
      return;
    }

    const noteBtn = event.target.closest('[data-home-open-note]');
    if (noteBtn) {
      const noteId = String(noteBtn.dataset.homeOpenNote || '');
      if (!noteId || !window.NSNotesStore) return;

      if (typeof window.NSNotesStore.setLastOpenedNoteId === 'function') {
        window.NSNotesStore.setLastOpenedNoteId(noteId);
      }

      setWorkspaceEnabled(true);
      if (state.workspaceMode === 'normal') setWorkspaceMode('split');
      setWorkspaceSection('notes');
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
}

function renderHomeDashboard() {
  const root = document.getElementById('workspaceCombinedLayout');
  if (!root || !root.classList.contains('workspace-home-dashboard')) return;

  const isCompactHome = Boolean(root.closest('.workspace-shell'));
  const listLimit = isCompactHome ? 1 : 5;
  const compactEmpty = {
    files: 'No files yet.',
    projects: 'No projects yet.',
    notes: 'No notes yet.'
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

  setTextContent('homeStatFiles', String(fileItems.length));
  setTextContent('homeStatProjects', String(projectItems.length));
  setTextContent('homeStatNotes', String(noteItems.length));
  setTextContent('homeStatFavorites', String(favoritesCount));

  setTextContent('homeFilesMeta', fileItems.length ? (isCompactHome ? `${fileItems.length} items` : `${fileItems.length} Source Library item(s)`) : 'Source Library is empty');
  setTextContent('homeProjectsMeta', projectItems.length ? (isCompactHome ? `${projectItems.length} active` : `${projectItems.length} project(s) linked`) : 'No projects yet');
  setTextContent('homeNotesMeta', noteItems.length ? (isCompactHome ? `${noteItems.length} captured` : `${noteItems.length} note(s) captured`) : 'No notes yet');
  setTextContent('homeFavoritesMeta', favoritesCount ? (isCompactHome ? `${favoritesCount} saved` : `${favoritesCount} favorite or pinned item(s)`) : 'No favorites yet');

  const focusStrip = document.getElementById('homeFocusStrip');
  if (focusStrip) {
    focusStrip.innerHTML = (isCompactHome
      ? [
          `<span class="workspace-home-focus-chip">File: ${escapeHtml(activeFile ? activeFile.name : 'none')}</span>`,
          `<span class="workspace-home-focus-chip">Project: ${escapeHtml(activeProject ? activeProject.title : 'none')}</span>`,
          `<span class="workspace-home-focus-chip">Note: ${escapeHtml(activeNote ? activeNote.title : 'none')}</span>`
        ]
      : [
          `<span class="workspace-home-focus-chip">Active file: ${escapeHtml(activeFile ? activeFile.name : 'none')}</span>`,
          `<span class="workspace-home-focus-chip">Project: ${escapeHtml(activeProject ? activeProject.title : 'none')}</span>`,
          `<span class="workspace-home-focus-chip">Note: ${escapeHtml(activeNote ? activeNote.title : 'none')}</span>`
        ]).join('');
  }

  renderHomeList(
    'homeFilesList',
    fileItemsSorted.slice(0, listLimit).map((item) => {
      const kind = item && item.preview && item.preview.kind ? String(item.preview.kind) : 'file';
      return {
        title: item && item.name ? item.name : 'Untitled file',
        meta: (isCompactHome
          ? [item && item.category ? item.category : 'other'].filter(Boolean).join(' · ')
          : [item && item.category ? item.category : 'other', kind, formatHomeDate(item && item.updatedAt)].filter(Boolean).join(' · ')),
        primaryAction: `<button type="button" class="workspace-home-row-btn" data-home-open-file="${escapeHtml(item.id)}">Open</button>`,
        secondaryAction: isCompactHome ? '' : `<button type="button" class="workspace-home-row-btn secondary" data-home-open-file-tab="${escapeHtml(item.id)}">Tab</button>`
      };
    }),
    isCompactHome ? compactEmpty.files : 'No files yet. Upload files to start building the Source Library.'
  );

  renderHomeList(
    'homeProjectsList',
    projectItems.slice(0, listLimit).map((project) => {
      const counts = window.NSProjectStore && typeof window.NSProjectStore.getCounts === 'function'
        ? window.NSProjectStore.getCounts(project.id)
        : { files: 0, notes: 0, drafts: 0 };
      return {
        title: project.title || 'Untitled project',
        meta: (isCompactHome
          ? [project.type || 'project'].filter(Boolean).join(' · ')
          : [project.type, project.status, `Files ${counts.files}`, `Notes ${counts.notes}`].filter(Boolean).join(' · ')),
        primaryAction: `<button type="button" class="workspace-home-row-btn" data-home-open-project="${escapeHtml(project.id)}">Open</button>`
      };
    }),
    isCompactHome ? compactEmpty.projects : 'No projects yet. Create a project to connect files, notes, and drafts.'
  );

  renderHomeList(
    'homeNotesList',
    noteItems.slice(0, listLimit).map((note) => {
      const preview = String(note && note.text ? note.text : '').replace(/\s+/g, ' ').trim();
      const previewLimit = isCompactHome ? 40 : 72;
      const compactPreview = preview ? preview.slice(0, previewLimit) + (preview.length > previewLimit ? '…' : '') : 'Empty note';
      return {
        title: note.title || 'Untitled note',
        meta: isCompactHome
          ? compactPreview
          : [note.type, compactPreview].filter(Boolean).join(' · '),
        primaryAction: `<button type="button" class="workspace-home-row-btn" data-home-open-note="${escapeHtml(note.id)}">Open</button>`
      };
    }),
    isCompactHome ? compactEmpty.notes : 'No notes yet. Use Quick Capture or open the Notes module.'
  );
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
      `    <div class="workspace-home-row-title">${escapeHtml(item.title || 'Untitled')}</div>`,
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
      video: 'Comm',
      files: 'Files',
      projects: 'Projects',
      notes: 'Notes',
      tools: 'Tools',
      editor: 'Editor',
      wallet: 'Wallet',
      analytics: 'Analytics',
      codehub: 'CodeHub',
      marketplacefuture: 'Marketplace',
      marketplace: 'Vitrina',
      workspace: 'Home'
    };
    return map[section] || 'Section';
  }

  function getCabinetSubtitle(section) {
    const map = {
      video: 'Communication and media shell for future active sessions',
      files: 'Sources, uploads, and documents',
      projects: 'Project containers and workspace flow',
      notes: 'Linked notes and references',
      tools: 'Utility modules and translator flow',
      editor: 'Draft writing and edit surface',
      wallet: 'Connection and payments shell',
      analytics: 'Cards and publish metrics shell',
      codehub: 'Code modules and publishing layer later',
      marketplacefuture: 'Commercial layer kept separate from the current Vitrina surface',
      marketplace: 'Templates, themes, packs, and safe plugin catalog',
      workspace: 'Main launch point for files, notes, projects, editor, and bookmarks'
    };
    return map[section] || 'Workspace section';
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
