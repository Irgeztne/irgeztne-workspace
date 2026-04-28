(function (root) {

  function isRu() { return document.documentElement.lang === 'ru'; }
  function tr(en, ru) { return isRu() ? ru : en; }
  function normalizeDisplayText(value) {
    const raw = String(value || '');
    if (isRu()) return raw;
    return raw.replace(/Заметка без названия/g,'Untitled note').replace(/Пустая заметка/g,'Empty note').replace(/Заметка проекта/g,'Project Note').replace(/связанный файл/g,'linked file');
  }
  function trType(value) {
    const map = { note:['note','заметка'], idea:['idea','идея'], article:['article','статья'], quote:['quote','цитата'], outline:['outline','план'], reference:['reference','ссылка'], code:['code','код'] };
    const key = String(value || '').trim().toLowerCase();
    return map[key] ? tr(map[key][0], map[key][1]) : String(value || '');
  }

  function getRoots() {
    return Array.from(document.querySelectorAll("[data-notes-root]"));
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function normalizeDefaultTitle(value) {
    const text = String(value || '');
    if (isRu()) return text;
    const map = { 'Заметка без названия': 'Untitled note', 'Заметка проекта': 'Project Note', 'Пустая заметка': 'Empty note', 'Без проекта': 'No project' };
    return map[text] || text;
  }

  function formatDate(value) {
    if (!value) return "—";
    try {
      return new Date(value).toLocaleString();
    } catch (error) {
      return String(value);
    }
  }

  function getStore() {
    return root.NSNotesStore || null;
  }

  function getProjectStore() {
    return root.NSProjectStore || null;
  }

  function getProjectById(projectId) {
    var store = getProjectStore();
    if (!store || !projectId || typeof store.getById !== "function") return null;
    return store.getById(projectId);
  }

  function getProjectOptions(currentProjectId) {
    var store = getProjectStore();
    var items = store && typeof store.getAll === "function" ? store.getAll() : [];
    var options = ['<option value="">' + tr('No project','Без проекта') + '</option>'];
    items.forEach(function (project) {
      options.push('<option value="' + escapeHtml(project.id) + '"' + (project.id === currentProjectId ? ' selected' : '') + '>' + escapeHtml(project.title) + '</option>');
    });
    return options.join("");
  }

  function getLibraryItemById(fileId) {
    if (!root.NSLibraryStore || !fileId || typeof root.NSLibraryStore.getItemById !== "function") return null;
    return root.NSLibraryStore.getItemById(fileId);
  }

  function getActiveLibraryFileId() {
    if (!root.NSLibraryStore || typeof root.NSLibraryStore.getState !== "function") return "";
    var state = root.NSLibraryStore.getState();
    return state && state.activeId ? String(state.activeId) : "";
  }

  function getDraftById(draftId) {
    if (root.__nsEditorV1Instance && root.__nsEditorV1Instance.store && typeof root.__nsEditorV1Instance.store.getDraft === "function") {
      return root.__nsEditorV1Instance.store.getDraft(draftId);
    }
    return null;
  }

  function openEditorDraft(draftId) {
    if (!draftId) return;
    if (root.NSEditorV1 && typeof root.NSEditorV1.openDraftById === "function") {
      root.NSEditorV1.openDraftById(draftId, "cabinet");
    }

    var hamburger = document.getElementById("hamburgerBtn");
    var cabinetBtn = document.querySelector('.cabinet-inner-nav-btn[data-section="editor"]');
    var cabinetTile = document.querySelector('[data-open-section="editor"]');

    if (cabinetBtn) {
      cabinetBtn.click();
      return;
    }

    if (hamburger) {
      hamburger.click();
      setTimeout(function () {
        var nextBtn = document.querySelector('.cabinet-inner-nav-btn[data-section="editor"]');
        var nextTile = document.querySelector('[data-open-section="editor"]');
        if (nextBtn) nextBtn.click();
        else if (nextTile) nextTile.click();
      }, 40);
      return;
    }

    var workspaceToggle = document.getElementById("workspaceToggle");
    if (workspaceToggle && workspaceToggle.getAttribute("aria-pressed") !== "true") {
      workspaceToggle.click();
    }
    var workspaceBtn = document.querySelector('.workspace-nav-btn[data-section="editor"]');
    if (workspaceBtn) workspaceBtn.click();
  }

  function emit(name, detail) {
    document.dispatchEvent(new CustomEvent(name, { detail: detail || {} }));
  }

  var runtime = {
    currentNoteId: "",
    searchQuery: "",
    currentType: "all",
    showArchived: false,
    pendingProjectId: ""
  };

  var saveTimers = Object.create(null);

  function scheduleUpdate(noteId, patch) {
    clearTimeout(saveTimers[noteId]);
    saveTimers[noteId] = setTimeout(function () {
      var store = getStore();
      if (!store) return;
      store.update(noteId, patch || {});
    }, 120);
  }

  function getCurrentNote() {
    var store = getStore();
    if (!store) return null;
    if (!runtime.currentNoteId) {
      runtime.currentNoteId = store.getLastOpenedNoteId() || "";
    }
    return runtime.currentNoteId ? store.getById(runtime.currentNoteId) : null;
  }

  function getVisibleNotes() {
    var store = getStore();
    if (!store) return [];
    return store.search(runtime.searchQuery, {
      showArchived: runtime.showArchived,
      type: runtime.currentType
    });
  }

  function renderToolbar(store) {
    var typeOptions = ['<option value="all">' + tr('All types','Все типы') + '</option>'].concat(store.NOTE_TYPES.map(function (type) {
      return '<option value="' + escapeHtml(type) + '"' + (runtime.currentType === type ? ' selected' : '') + '>' + escapeHtml(trType(type)) + '</option>';
    })).join("");

    return [
      '<div class="ns-notes-toolbar">',
      '  <div class="ns-notes-toolbar-row">',
      '    <button type="button" data-notes-new>' + tr('New Note','Новая заметка') + '</button>',
      '    <input type="text" value="' + escapeHtml(runtime.searchQuery) + '" placeholder="' + tr('Search notes','Поиск по заметкам') + '" data-notes-search />',
      '    <select data-notes-type-filter>' + typeOptions + '</select>',
      '    <button type="button" data-notes-toggle-archived>' + (runtime.showArchived ? tr('Hide Archived','Скрыть архив') : tr('Show Archived','Показать архив')) + '</button>',
      '  </div>',
      '</div>'
    ].join("");
  }

  function renderNoteCard(note) {
    var project = note.projectId ? getProjectById(note.projectId) : null;
    var preview = String(note.text || "").replace(/\s+/g, ' ').trim();
    if (preview.length > 120) preview = preview.slice(0, 120) + '…';

    return [
      '<article class="ns-note-card ' + (runtime.currentNoteId === note.id ? 'is-active' : '') + '">',
      '  <button type="button" class="ns-note-card-main" data-note-open="' + escapeHtml(note.id) + '">',
      '    <div class="ns-note-card-title-row">',
      '      <strong class="ns-note-card-title">' + escapeHtml(note.title) + '</strong>',
      note.pinned ? '<span class="ns-note-chip">' + tr('Pinned','Закреплена') + '</span>' : '',
      note.archived ? '<span class="ns-note-chip is-muted">' + tr('Archived','В архиве') + '</span>' : '',
      '    </div>',
      '    <div class="ns-note-card-meta">' + escapeHtml(trType(note.type)) + (project ? ' · ' + escapeHtml(project.title) : '') + '</div>',
      preview ? '<div class="ns-note-card-preview">' + escapeHtml(normalizeDisplayText(normalizeDefaultTitle(preview))) + '</div>' : '<div class="ns-note-card-preview is-muted">' + tr('Empty note','Пустая заметка') + '</div>',
      '    <div class="ns-note-card-updated">' + tr('Updated: ','Обновлён: ') + escapeHtml(formatDate(note.updatedAt)) + '</div>',
      '  </button>',
      '  <div class="ns-note-card-actions">',
      '    <button type="button" data-note-pin="' + escapeHtml(note.id) + '">' + (note.pinned ? tr('Unpin','Открепить') : tr('Pin','Закрепить')) + '</button>',
      '    <button type="button" data-note-archive="' + escapeHtml(note.id) + '">' + (note.archived ? tr('Unarchive','Из архива') : tr('Archive','В архив')) + '</button>',
      '    <button type="button" data-note-delete="' + escapeHtml(note.id) + '">' + tr('Delete','Удалить') + '</button>',
      '  </div>',
      '</article>'
    ].join("");
  }

  function renderNotesList(store) {
    var notes = getVisibleNotes();
    if (!notes.length) {
      return [
        '<div class="ns-note-empty">',
        '  <h3>' + tr('No notes yet','Пока нет заметок') + '</h3>',
        '  <p>' + tr('Create your first note to capture ideas, references, and project thoughts.','Создайте первую заметку, чтобы сохранять идеи, ссылки и мысли по проекту.') + '</p>',
        '  <button type="button" data-notes-new>New Note</button>',
        '</div>'
      ].join("");
    }
    return notes.map(renderNoteCard).join("");
  }

  function renderLinkedFiles(note) {
    var activeFileId = getActiveLibraryFileId();

    return [
      '<section class="ns-note-section">',
      '  <div class="ns-note-section-head">',
      '    <h3>' + tr('Linked Files','Связанные файлы') + '</h3>',
      '    <div class="ns-note-actions">',
      activeFileId ? '<button type="button" data-note-link-active-file="' + escapeHtml(activeFileId) + '">' + tr('Link Active File','Привязать активный файл') + '</button>' : '<span class="is-muted">' + tr('No active file','Нет активного файла') + '</span>',
      '      <button type="button" data-note-open-files>' + tr('Open Files','Открыть файлы') + '</button>',
      '    </div>',
      '  </div>',
      note.linkedFileIds.length ? '<div class="ns-note-linked-list">' + note.linkedFileIds.map(function (fileId) {
        var item = getLibraryItemById(fileId);
        var title = item && item.name ? item.name : fileId;
        var meta = item && item.mime ? item.mime : (item && item.category ? item.category : tr('linked file',tr('linked file','связанный файл')));
        return [
          '<div class="ns-note-linked-row">',
          '  <div class="ns-note-linked-main">',
          '    <strong>' + escapeHtml(title) + '</strong>',
          '    <span>' + escapeHtml(meta) + '</span>',
          '  </div>',
          '  <div class="ns-note-linked-actions">',
          '    <button type="button" data-note-open-file="' + escapeHtml(fileId) + '">' + tr('Open','Открыть') + '</button>',
          '    <button type="button" data-note-detach-file="' + escapeHtml(fileId) + '">' + tr('Detach','Отвязать') + '</button>',
          '  </div>',
          '</div>'
        ].join("");
      }).join('') + '</div>' : '<div class="ns-note-empty-inline">' + tr('No linked files yet.','Связанных файлов пока нет.') + '</div>',
      '</section>'
    ].join("");
  }

  function renderLinkedDrafts(note) {
    return [
      '<section class="ns-note-section">',
      '  <div class="ns-note-section-head">',
      '    <h3>' + tr('Linked Drafts','Связанные черновики') + '</h3>',
      '  </div>',
      note.linkedDraftIds.length ? '<div class="ns-note-linked-list">' + note.linkedDraftIds.map(function (draftId) {
        var draft = getDraftById(draftId);
        var title = draft && draft.meta && draft.meta.title ? draft.meta.title : draftId;
        var meta = draft && draft.status ? draft.status : tr('linked draft','связанный черновик');
        return [
          '<div class="ns-note-linked-row">',
          '  <div class="ns-note-linked-main">',
          '    <strong>' + escapeHtml(title) + '</strong>',
          '    <span>' + escapeHtml(meta) + '</span>',
          '  </div>',
          '  <div class="ns-note-linked-actions">',
          '    <button type="button" data-note-open-draft="' + escapeHtml(draftId) + '">' + tr('Open','Открыть') + '</button>',
          '    <button type="button" data-note-detach-draft="' + escapeHtml(draftId) + '">' + tr('Detach','Отвязать') + '</button>',
          '  </div>',
          '</div>'
        ].join('');
      }).join('') + '</div>' : '<div class="ns-note-empty-inline">' + tr('No linked drafts yet.','Связанных черновиков пока нет.') + '</div>',
      '</section>'
    ].join('');
  }

  function renderNoteView(store) {
    var note = getCurrentNote();
    if (!note) {
      return [
        '<div class="ns-note-empty">',
        '  <h3>' + tr('Select a note','Выберите заметку') + '</h3>',
        '  <p>' + tr('Open an existing note or create a new one.','Откройте существующую заметку или создайте новую.') + '</p>',
        '</div>'
      ].join("");
    }

    var project = note.projectId ? getProjectById(note.projectId) : null;

    return [
      '<div class="ns-note-view">',
      '  <header class="ns-note-view-header">',
      '    <div class="ns-note-view-main">',
      '      <h2>' + escapeHtml(note.title) + '</h2>',
      '      <div class="ns-note-view-meta">' + escapeHtml(trType(note.type)) + (project ? ' · ' + escapeHtml(project.title) : ' · ' + tr('No project','Без проекта')) + ' · ' + escapeHtml(formatDate(note.updatedAt)) + '</div>',
      '    </div>',
      '    <div class="ns-note-view-actions">',
      project ? '<button type="button" data-note-open-project="' + escapeHtml(project.id) + '">' + tr('Open Project','Открыть проект') + '</button>' : '',
      '      <button type="button" data-note-use-tools="translate">' + tr('Translate','Перевести') + '</button>',
      '      <button type="button" data-note-use-tools="compare">' + tr('Compare','Сравнить') + '</button>',
      '      <button type="button" data-note-use-tools="extract">' + tr('Extract','Извлечь') + '</button>',
      '      <button type="button" data-note-pin="' + escapeHtml(note.id) + '">' + (note.pinned ? 'Unpin' : 'Pin') + '</button>',
      '      <button type="button" data-note-archive="' + escapeHtml(note.id) + '">' + (note.archived ? 'Unarchive' : 'Archive') + '</button>',
      '      <button type="button" data-note-delete="' + escapeHtml(note.id) + '">' + tr('Delete','Удалить') + '</button>',
      '    </div>',
      '  </header>',
      '  <section class="ns-note-section">',
      '    <label class="ns-note-field">',
      '      <span>' + tr('Title','Название') + '</span>',
      '      <input type="text" data-note-title value="' + escapeHtml(note.title) + '" />',
      '    </label>',
      '    <div class="ns-note-field-grid">',
      '      <label class="ns-note-field">',
      '        <span>' + tr('Type','Тип') + '</span>',
      '        <select data-note-type>' + store.NOTE_TYPES.map(function (type) {
                return '<option value="' + escapeHtml(type) + '"' + (type === note.type ? ' selected' : '') + '>' + escapeHtml(type) + '</option>';
              }).join('') + '</select>',
      '      </label>',
      '      <label class="ns-note-field">',
      '        <span>' + tr('Project','Проект') + '</span>',
      '        <select data-note-project>' + getProjectOptions(note.projectId) + '</select>',
      '      </label>',
      '    </div>',
      '    <label class="ns-note-field">',
      '      <span>' + tr('Text','Текст') + '</span>',
      '      <textarea data-note-text placeholder="' + tr('Write a note, idea, quote, outline, or project thought...','Напишите заметку, идею, цитату, план или мысль по проекту...') + '">' + escapeHtml(note.text) + '</textarea>',
      '    </label>',
      '  </section>',
      renderLinkedFiles(note),
      renderLinkedDrafts(note),
      '</div>'
    ].join("");
  }

  function renderRoot(rootEl) {
    var store = getStore();
    if (!store) return;
    rootEl.innerHTML = [
      '<div class="ns-notes-root-shell">',
      '  <aside class="ns-notes-sidebar">',
      renderToolbar(store),
      '    <div class="ns-notes-list">' + renderNotesList(store) + '</div>',
      '  </aside>',
      '  <main class="ns-notes-main">',
      renderNoteView(store),
      '  </main>',
      '</div>'
    ].join("");
  }

  function renderAll() {
    getRoots().forEach(renderRoot);
  }

  function openNoteById(noteId) {
    var store = getStore();
    if (!store || !noteId) return;
    runtime.currentNoteId = noteId;
    store.setLastOpenedNoteId(noteId);
    renderAll();
  }

  function createNote(prefill) {
    var store = getStore();
    if (!store) return null;
    var note = store.create({
      title: prefill && prefill.title ? prefill.title : tr('Untitled note','Заметка без названия'),
      type: prefill && prefill.type ? prefill.type : 'note',
      text: prefill && prefill.text ? prefill.text : '',
      projectId: prefill && prefill.projectId ? prefill.projectId : ''
    });
    runtime.currentNoteId = note.id;
    runtime.pendingProjectId = '';
    renderAll();
    return note;
  }

  function handleClick(event) {
    var target = event.target.closest('button');
    if (!target) return;
    var store = getStore();
    if (!store) return;

    if (target.hasAttribute('data-notes-new')) {
      createNote({ projectId: runtime.pendingProjectId || '' });
      return;
    }

    var noteOpenId = target.getAttribute('data-note-open');
    if (noteOpenId) {
      openNoteById(noteOpenId);
      return;
    }

    var pinId = target.getAttribute('data-note-pin');
    if (pinId) {
      var noteForPin = store.getById(pinId);
      if (noteForPin) {
        store.setPinned(pinId, !noteForPin.pinned);
      }
      return;
    }

    var archiveId = target.getAttribute('data-note-archive');
    if (archiveId) {
      var noteForArchive = store.getById(archiveId);
      if (noteForArchive) {
        if (noteForArchive.archived) {
          store.unarchive(archiveId);
        } else {
          store.archive(archiveId);
        }
      }
      return;
    }

    var deleteId = target.getAttribute('data-note-delete');
    if (deleteId) {
      store.remove(deleteId);
      runtime.currentNoteId = typeof store.getLastOpenedNoteId === 'function' ? store.getLastOpenedNoteId() : '';
      renderAll();
      return;
    }

    var linkActiveFileId = target.getAttribute('data-note-link-active-file');
    if (linkActiveFileId) {
      var current = getCurrentNote();
      if (current) {
        store.attachFile(current.id, linkActiveFileId);
      }
      return;
    }

    var detachFileId = target.getAttribute('data-note-detach-file');
    if (detachFileId) {
      var noteDetach = getCurrentNote();
      if (noteDetach) {
        store.detachFile(noteDetach.id, detachFileId);
      }
      return;
    }

    var openFileId = target.getAttribute('data-note-open-file');
    if (openFileId) {
      if (root.NSLibraryStore && typeof root.NSLibraryStore.setActiveItem === 'function') {
        root.NSLibraryStore.setActiveItem(openFileId);
      }
      emit('ns-notes:open-files', { fileId: openFileId });
      return;
    }

    if (target.hasAttribute('data-note-open-files')) {
      emit('ns-notes:open-files', {});
      return;
    }

    var openDraftId = target.getAttribute('data-note-open-draft');
    if (openDraftId) {
      openEditorDraft(openDraftId);
      return;
    }

    var detachDraftId = target.getAttribute('data-note-detach-draft');
    if (detachDraftId) {
      var noteForDetachDraft = getCurrentNote();
      if (noteForDetachDraft) {
        store.detachDraft(noteForDetachDraft.id, detachDraftId);
      }
      return;
    }


    var useToolsMode = target.getAttribute('data-note-use-tools');
    if (useToolsMode) {
      var currentNote = getCurrentNote();
      if (!currentNote) return;
      emit('ns-tools:use-text', {
        mode: useToolsMode,
        text: String(currentNote.text || currentNote.title || '').trim(),
        noteId: currentNote.id,
        projectId: currentNote.projectId || '',
        source: 'note',
        title: currentNote.title || tr('Untitled note','Заметка без названия')
      });
      return;
    }

    var openProjectId = target.getAttribute('data-note-open-project');
    if (openProjectId) {
      if (root.NSProjectsV1 && typeof root.NSProjectsV1.setCurrentProject === 'function') {
        root.NSProjectsV1.setCurrentProject(openProjectId);
      }
      emit('ns-notes:open-project', { projectId: openProjectId });
    }
  }

  function handleInput(event) {
    var store = getStore();
    if (!store) return;

    if (event.target.matches('[data-notes-search]')) {
      runtime.searchQuery = String(event.target.value || '');
      renderAll();
      return;
    }

    if (event.target.matches('[data-note-title]')) {
      var note = getCurrentNote();
      if (note) {
        scheduleUpdate(note.id, { title: String(event.target.value || '').trim() || tr('Untitled note','Заметка без названия') });
      }
      return;
    }

    if (event.target.matches('[data-note-text]')) {
      var noteText = getCurrentNote();
      if (noteText) {
        var nextText = String(event.target.value || '');
        var currentTitle = event.target.closest('.ns-note-view').querySelector('[data-note-title]');
        var titleValue = currentTitle ? String(currentTitle.value || '').trim() : noteText.title;
        scheduleUpdate(noteText.id, { text: nextText, title: titleValue || undefined });
      }
      return;
    }
  }

  function handleChange(event) {
    var store = getStore();
    if (!store) return;

    if (event.target.matches('[data-notes-type-filter]')) {
      runtime.currentType = String(event.target.value || 'all');
      renderAll();
      return;
    }

    if (event.target.matches('[data-note-type]')) {
      var noteType = getCurrentNote();
      if (noteType) {
        store.update(noteType.id, { type: String(event.target.value || 'note') });
      }
      return;
    }

    if (event.target.matches('[data-note-project]')) {
      var noteProject = getCurrentNote();
      if (noteProject) {
        store.attachToProject(noteProject.id, String(event.target.value || ''));
      }
      return;
    }
  }

  function bindRoot(rootEl) {
    if (rootEl.dataset.notesBound === '1') return;
    rootEl.dataset.notesBound = '1';
    rootEl.addEventListener('click', handleClick);
    rootEl.addEventListener('input', handleInput);
    rootEl.addEventListener('change', handleChange);
  }

  function init() {
    var store = getStore();
    if (!store) return;
    runtime.currentNoteId = store.getLastOpenedNoteId() || '';
    getRoots().forEach(bindRoot);
    renderAll();

    if (typeof store.subscribe === 'function') {
      store.subscribe(function () {
        renderAll();
      });
    }

    if (root.NSProjectStore && typeof root.NSProjectStore.subscribe === 'function') {
      root.NSProjectStore.subscribe(function () {
        renderAll();
      });
    }

    if (root.NSLibraryStore && typeof root.NSLibraryStore.subscribe === 'function') {
      root.NSLibraryStore.subscribe(function () {
        renderAll();
      });
    }

    document.addEventListener('ns-projects:new-note', function (event) {
      var projectId = event && event.detail ? String(event.detail.projectId || '') : '';
      runtime.pendingProjectId = projectId;
      var note = createNote({
        title: tr('Project Note','Заметка проекта'),
        type: 'note',
        text: '',
        projectId: projectId
      });
      if (note) {
        emit('ns-notes:created', { noteId: note.id, note: note, projectId: projectId });
      }
    });

    document.addEventListener('DOMContentLoaded', function () {
      getRoots().forEach(bindRoot);
      renderAll();
    });

    window.addEventListener('irg:language-changed', renderAll);
    document.addEventListener('irg:language-changed', renderAll);
  }

  init();

  root.NSNotesV1 = {
    renderAll: renderAll,
    openNoteById: openNoteById,
    createNote: createNote,
    getCurrentNoteId: function () {
      return runtime.currentNoteId || '';
    }
  };
})(window);
