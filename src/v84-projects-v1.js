(function (root) {

  function isRu() { return document.documentElement.lang === 'ru'; }
  function tr(en, ru) { return isRu() ? ru : en; }
  function normalizeDisplayText(value) {
    const raw = String(value || '');
    if (isRu()) return raw;
    return raw.replace(/Заметка без названия/g,'Untitled note').replace(/Пустая заметка/g,'Empty note').replace(/Пакет без названия/g,'Untitled package').replace(/Файлы/g,'Files').replace(/Заметки/g,'Notes').replace(/Черновики/g,'Drafts').replace(/статья/g,'article').replace(/идея/g,'idea').replace(/Архив/g,'Archive').replace(/Поверхность пространства/g,'Workspace surface').replace(/Поверхность кабинета/g,'Cabinet surface');
  }
  function trType(value) {
    const map = { article:['article','статья'], idea:['idea','идея'], project:['project','проект'], note:['note','заметка'], draft:['draft','черновик'], ready:['ready','готово'], published:['published','опубликовано'] };
    const key = String(value || '').trim().toLowerCase();
    return map[key] ? tr(map[key][0], map[key][1]) : String(value || '');
  }

  function getRoots() {
    return Array.from(document.querySelectorAll('[data-projects-root]'));
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatDate(value) {
    if (!value) return '—';

    try {
      return new Date(value).toLocaleString();
    } catch (error) {
      return String(value);
    }
  }

  function truncate(value, limit) {
    var text = String(value == null ? '' : value).trim();
    if (!text) return '';
    if (text.length <= limit) return text;
    return text.slice(0, limit - 1).trim() + '…';
  }

  function getStore() {
    return root.NSProjectStore || null;
  }

  function getLibraryStore() {
    return root.NSLibraryStore || null;
  }

  function getNotesStore() {
    return root.NSNotesStore || null;
  }

  function getLibraryItems() {
    var store = getLibraryStore();
    if (!store || typeof store.getState !== 'function') return [];

    var state = store.getState();
    return Array.isArray(state && state.items) ? state.items.slice() : [];
  }

  function getLibraryItemById(fileId) {
    var store = getLibraryStore();
    if (!fileId || !store || typeof store.getItemById !== 'function') return null;
    return store.getItemById(fileId);
  }

  function getNoteById(noteId) {
    var store = getNotesStore();
    if (!noteId || !store || typeof store.getById !== 'function') return null;
    return store.getById(noteId);
  }

  function emit(name, detail) {
    document.dispatchEvent(new CustomEvent(name, { detail: detail || {} }));
  }

  var runtime = {
    currentProjectId: '',
    currentTab: 'overview',
    searchQuery: '',
    showArchived: false,
    showCreateForm: false,
    filePickerOpen: false
  };

  function getCurrentProject() {
    var store = getStore();
    if (!store) return null;

    if (!runtime.currentProjectId) {
      runtime.currentProjectId = store.getLastOpenedProjectId() || '';
    }

    if (!runtime.currentProjectId) {
      var items = typeof store.getAll === 'function' ? store.getAll() : [];
      if (items.length) {
        runtime.currentProjectId = items[0].id;
      }
    }

    return runtime.currentProjectId ? store.getById(runtime.currentProjectId) : null;
  }

  function getVisibleProjects() {
    var store = getStore();
    if (!store) return [];

    return store.search(runtime.searchQuery, {
      showArchived: runtime.showArchived
    });
  }

  function getSummary(store) {
    if (!store) {
      return {
        total: 0,
        pinned: 0,
        archived: 0,
        active: 0
      };
    }

    if (typeof store.getSummary === 'function') {
      return store.getSummary();
    }

    var all = typeof store.getAll === 'function' ? store.getAll() : [];
    return all.reduce(function (acc, item) {
      acc.total += 1;
      if (item.pinned) acc.pinned += 1;
      if (item.archived) acc.archived += 1;
      else acc.active += 1;
      return acc;
    }, {
      total: 0,
      pinned: 0,
      archived: 0,
      active: 0
    });
  }

  function getSurfaceLabel(surface) {
    return surface === 'workspace' ? tr('Workspace surface','Поверхность пространства') : tr('Cabinet surface','Поверхность кабинета');
  }

  function renderCreateForm(store) {
    var typeOptions = store.PROJECT_TYPES.map(function (type) {
      return '<option value="' + escapeHtml(type) + '">' + escapeHtml(type) + '</option>';
    }).join('');

    return [
      '<form class="ns-projects-inline-form" data-projects-create-form novalidate>',
      '  <div class="ns-projects-inline-grid">',
      '    <label class="ns-project-field">',
      '      <span>' + tr('Title','Название') + '</span>',
      '      <input type="text" name="title" placeholder="' + escapeHtml(tr('Project title','Название проекта')) + '" data-projects-title-input />',
      '    </label>',
      '    <label class="ns-project-field">',
      '      <span>' + tr('Type','Тип') + '</span>',
      '      <select name="type">' + typeOptions + '</select>',
      '    </label>',
      '  </div>',
      '  <label class="ns-project-field">',
      '    <span>' + tr('Description','Описание') + '</span>',
      '    <input type="text" name="description" placeholder="' + escapeHtml(tr('Short description','Короткое описание')) + '" />',
      '  </label>',
      '  <div class="ns-projects-inline-actions">',
      '    <button type="submit">' + tr('Create project','Создать проект') + '</button>',
      '    <button type="button" data-projects-cancel-create>' + tr('Cancel','Отмена') + '</button>',
      '  </div>',
      '</form>'
    ].join('');
  }

  function renderToolbar(store, surface) {
    var summary = getSummary(store);

    return [
      '<div class="ns-projects-surface-head">',
      '  <div class="ns-projects-surface-copy">',
      '    <div class="ns-projects-surface-kicker">' + tr('Projects','Проекты') + '</div>',
      '    <h3 class="ns-projects-surface-title">' + tr('Containers for files, notes, drafts, and workflow','Контейнеры для файлов, заметок, черновиков и рабочего потока') + '</h3>',
      '    <div class="ns-projects-surface-meta">' + escapeHtml(getSurfaceLabel(surface)) + '</div>',
      '  </div>',
      '</div>',
      '<div class="ns-projects-summary-bar">',
      '  <div class="ns-projects-summary-card"><span>' + tr('Total','Всего') + '</span><strong>' + summary.total + '</strong></div>',
      '  <div class="ns-projects-summary-card"><span>' + tr('Active','Активные') + '</span><strong>' + summary.active + '</strong></div>',
      '  <div class="ns-projects-summary-card"><span>' + tr('Pinned','Закреплённые') + '</span><strong>' + summary.pinned + '</strong></div>',
      '  <div class="ns-projects-summary-card"><span>' + tr('Archived','Архив') + '</span><strong>' + summary.archived + '</strong></div>',
      '</div>',
      '<div class="ns-projects-toolbar">',
      '  <div class="ns-projects-toolbar-row">',
      '    <button type="button" data-projects-new>' + tr('New Project','Новый проект') + '</button>',
      '    <input type="text" value="' + escapeHtml(runtime.searchQuery) + '" placeholder="' + escapeHtml(tr('Search projects','Поиск по проектам')) + '" data-projects-search />',
      '    <button type="button" data-projects-toggle-archived>' + (runtime.showArchived ? tr('Hide Archived','Скрыть архив') : tr('Show Archived','Показать архив')) + '</button>',
      '  </div>',
      runtime.showCreateForm ? renderCreateForm(store) : '',
      '</div>'
    ].join('');
  }

  function renderProjectCard(store, project) {
    var counts = store.getCounts(project.id);

    return [
      '<article class="ns-project-card ' + (runtime.currentProjectId === project.id ? 'is-active' : '') + '">',
      '  <button type="button" class="ns-project-card-main" data-project-open="' + escapeHtml(project.id) + '">',
      '    <div class="ns-project-card-title-row">',
      '      <strong class="ns-project-card-title">' + escapeHtml(project.title) + '</strong>',
      project.pinned ? '<span class="ns-project-chip">' + tr('Pinned',tr('Pinned','Закреплён')) + '</span>' : '',
      project.archived ? '<span class="ns-project-chip is-muted">' + tr('Archived',tr('Archived','В архиве')) + '</span>' : '',
      '    </div>',
      '    <div class="ns-project-card-meta-row">',
      '      <span class="ns-project-card-meta">' + escapeHtml(trType(project.type)) + '</span>',
      '      <span class="ns-project-card-meta">' + escapeHtml(trType(project.status)) + '</span>',
      '    </div>',
      project.description ? '<div class="ns-project-card-description">' + escapeHtml(project.description) + '</div>' : '<div class="ns-project-card-description is-muted">' + tr('No description yet.','Описание пока не добавлено.') + '</div>',
      '    <div class="ns-project-card-counts">',
      '      <span>' + tr('Files','Файлы') + ' <strong>' + counts.files + '</strong></span>',
      '      <span>' + tr('Notes','Заметки') + ' <strong>' + counts.notes + '</strong></span>',
      '      <span>' + tr('Drafts','Черновики') + ' <strong>' + counts.drafts + '</strong></span>',
      '    </div>',
      '    <div class="ns-project-card-updated">' + tr('Updated: ','Обновлён: ') + escapeHtml(formatDate(project.updatedAt)) + '</div>',
      '  </button>',
      '  <div class="ns-project-card-actions">',
      '    <button type="button" data-project-pin="' + escapeHtml(project.id) + '">' + (project.pinned ? 'Unpin' : 'Pin') + '</button>',
      project.archived
        ? '    <button type="button" data-project-unarchive="' + escapeHtml(project.id) + '">Unarchive</button>'
        : '    <button type="button" data-project-archive="' + escapeHtml(project.id) + '">Archive</button>',
      '  </div>',
      '</article>'
    ].join('');
  }

  function renderProjectsList(store) {
    var projects = getVisibleProjects();

    if (!projects.length) {
      return [
        '<div class="ns-project-empty">',
        '  <h3>' + tr('No projects yet','Пока нет проектов') + '</h3>',
        '  <p>' + tr('Create the first project to connect Files, Notes, Drafts, and the workspace path.','Создайте первый проект, чтобы связать Файлы, Заметки, Черновики и путь пространства.') + '</p>',
        '  <button type="button" data-projects-new>' + tr('New Project','Новый проект') + '</button>',
        '</div>'
      ].join('');
    }

    return projects.map(function (project) {
      return renderProjectCard(store, project);
    }).join('');
  }

  function renderRecentBlock(title, values, kind) {
    var items = Array.isArray(values) ? values.slice(0, 5) : [];

    return [
      '<div class="ns-project-recent">',
      '  <div class="ns-project-recent-head">',
      '    <h4>' + escapeHtml(title) + '</h4>',
      '    <span>' + items.length + '</span>',
      '  </div>',
      items.length
        ? '<ul class="ns-project-simple-list">' + items.map(function (value) {
            return '<li><span class="ns-project-simple-kind">' + escapeHtml(kind) + '</span><span>' + escapeHtml(value) + '</span></li>';
          }).join('') + '</ul>'
        : '<div class="ns-project-empty-inline">' + tr('Nothing linked yet.','Пока ничего не связано.') + '</div>',
      '</div>'
    ].join('');
  }

  function renderLinkRail(project, counts) {
    return [
      '<div class="ns-project-link-rail">',
      '  <button type="button" data-project-open-files>' + tr('Linked Files','Связанные файлы') + ' <span>' + counts.files + '</span></button>',
      '  <button type="button" data-project-action="use-tools">' + tr('Use in Tools','Использовать в инструментах') + '</button>',
      '  <button type="button" data-project-action="open-workspace">' + tr('Workspace Home','Главная пространства') + '</button>',
      '</div>'
    ].join('');
  }

  function renderOverview(project, store, surface) {
    var counts = store.getCounts(project.id);
    var recentBlocks = [];

    if (Array.isArray(project.fileIds) && project.fileIds.length) {
      recentBlocks.push(renderRecentBlock(tr('Recent Files','Недавние файлы'), project.fileIds, tr('File','Файл')));
    }
    if (Array.isArray(project.noteIds) && project.noteIds.length) {
      recentBlocks.push(renderRecentBlock(tr('Recent Notes','Недавние заметки'), project.noteIds, tr('Note','Заметка')));
    }
    if (Array.isArray(project.draftIds) && project.draftIds.length) {
      recentBlocks.push(renderRecentBlock(tr('Recent Drafts','Недавние черновики'), project.draftIds, tr('Draft','Черновик')));
    }

    return [
      '<section class="ns-project-section">',
      '  <div class="ns-project-stats-grid">',
      '    <div class="ns-project-stat"><span>' + tr('Type','Тип') + '</span><strong>' + escapeHtml(trType(project.type)) + '</strong></div>',
      '    <div class="ns-project-stat"><span>' + tr('Status','Статус') + '</span><strong>' + escapeHtml(trType(project.status)) + '</strong></div>',
      '    <div class="ns-project-stat"><span>' + tr('Linked Files','Связанные файлы') + '</span><strong>' + counts.files + '</strong></div>',
      '    <div class="ns-project-stat"><span>' + tr('Notes','Заметки') + '</span><strong>' + counts.notes + '</strong></div>',
      '    <div class="ns-project-stat"><span>' + tr('Drafts','Черновики') + '</span><strong>' + counts.drafts + '</strong></div>',
      '    <div class="ns-project-stat"><span>' + tr('Updated','Обновлён') + '</span><strong>' + escapeHtml(formatDate(project.updatedAt)) + '</strong></div>',
      '  </div>',
      project.description
        ? '<div class="ns-project-description">' + escapeHtml(project.description) + '</div>'
        : '<div class="ns-project-description is-muted">' + tr('No description yet.','Описание пока не добавлено.') + '</div>',
      recentBlocks.length
        ? '<div class="ns-project-recent-grid">' + recentBlocks.join('') + '</div>'
        : '',
      '</section>'
    ].join('');
  }

  function renderFileRows(project) {
    if (!project.fileIds.length) {
      return '<div class="ns-project-empty-inline">' + tr('No files attached yet.','Пока нет прикреплённых файлов.') + '</div>';
    }

    return [
      '<div class="ns-project-linked-list">',
      project.fileIds.map(function (fileId) {
        var item = getLibraryItemById(fileId);
        var title = item && item.name ? item.name : fileId;
        var meta = item && item.mime ? item.mime : (item && item.category ? item.category : 'linked file');

        return [
          '<div class="ns-project-linked-row">',
          '  <div class="ns-project-linked-main">',
          '    <strong>' + escapeHtml(title) + '</strong>',
          '    <span>' + escapeHtml(meta) + '</span>',
          '  </div>',
          '  <div class="ns-project-linked-actions">',
          item ? '<button type="button" data-project-open-file="' + escapeHtml(fileId) + '">Open</button>' : '',
          '    <button type="button" data-project-detach-file="' + escapeHtml(fileId) + '">Detach</button>',
          '  </div>',
          '</div>'
        ].join('');
      }).join(''),
      '</div>'
    ].join('');
  }

  function renderNotesRows(project) {
    if (!project.noteIds.length) {
      return '<div class="ns-project-empty-inline">' + tr('No project notes linked yet.','Связанных заметок проекта пока нет.') + '</div>';
    }

    return [
      '<div class="ns-project-linked-list">',
      project.noteIds.map(function (noteId) {
        var note = getNoteById(noteId);
        var title = note && note.title ? note.title : noteId;
        var meta = note && note.type ? trType(note.type) : tr('Linked note','Связанная заметка');
        var preview = note && note.text ? truncate(note.text, 120) : tr('Link to the linked note','Ссылка на связанную заметку');

        return [
          '<div class="ns-project-linked-row">',
          '  <div class="ns-project-linked-main">',
          '    <strong>' + escapeHtml(title) + '</strong>',
          '    <span>' + escapeHtml(meta + (preview ? ' · ' + preview : '')) + '</span>',
          '  </div>',
          '  <div class="ns-project-linked-actions">',
          '    <button type="button" data-project-open-note="' + escapeHtml(noteId) + '">Open</button>',
          '    <button type="button" data-project-detach-note="' + escapeHtml(noteId) + '">Detach</button>',
          '  </div>',
          '</div>'
        ].join('');
      }).join(''),
      '</div>'
    ].join('');
  }

  function renderDraftRows(project) {
    if (!project.draftIds.length) {
      return '<div class="ns-project-empty-inline">' + tr('No project drafts linked yet.','Связанных черновиков проекта пока нет.') + '</div>';
    }

    return [
      '<div class="ns-project-linked-list">',
      project.draftIds.map(function (draftId) {
        return [
          '<div class="ns-project-linked-row">',
          '  <div class="ns-project-linked-main">',
          '    <strong>' + escapeHtml(draftId) + '</strong>',
          '    <span>' + tr('Link to the linked draft','Ссылка на связанный черновик') + '</span>',
          '  </div>',
          '  <div class="ns-project-linked-actions">',
          '    <button type="button" data-project-detach-draft="' + escapeHtml(draftId) + '">Detach</button>',
          '  </div>',
          '</div>'
        ].join('');
      }).join(''),
      '</div>'
    ].join('');
  }

  function renderFilesTab(project) {
    return [
      '<section class="ns-project-section">',
      '  <div class="ns-project-section-head">',
      '    <h3>' + tr('Files','Файлы') + '</h3>',
      '    <div class="ns-project-section-actions">',
      '      <button type="button" data-project-open-files>' + tr('Open Linked Files','Открыть связанные файлы') + '</button>',
      '      <button type="button" data-project-open-picker>' + tr('Attach File','Прикрепить файл') + '</button>',
      '    </div>',
      '  </div>',
      renderFileRows(project),
      '</section>'
    ].join('');
  }

  function renderNotesTab(project) {
    return [
      '<section class="ns-project-section">',
      '  <div class="ns-project-section-head">',
      '    <h3>' + tr('Notes','Заметки') + '</h3>',
      '    <div class="ns-project-section-actions">',
      '      <button type="button" data-project-action="new-note">' + tr('New Note','Новая заметка') + '</button>',
      '    </div>',
      '  </div>',
      renderNotesRows(project),
      '</section>'
    ].join('');
  }

  function renderDraftsTab(project) {
    return [
      '<section class="ns-project-section">',
      '  <div class="ns-project-section-head">',
      '    <h3>' + tr('Drafts','Черновики') + '</h3>',
      '    <div class="ns-project-section-actions">',
      '      <button type="button" data-project-action="new-draft">' + tr('New Draft','Новый черновик') + '</button>',
      '    </div>',
      '  </div>',
      renderDraftRows(project),
      '</section>'
    ].join('');
  }

  function renderPublish(project) {
    var publishReady = project.status === 'ready' || project.status === 'published';

    return [
      '<section class="ns-project-section">',
      '  <div class="ns-project-section-head">',
      '    <h3>' + tr('Publish','Публикация') + '</h3>',
      '  </div>',
      '  <div class="ns-project-publish-grid">',
      '    <div class="ns-project-publish-card">',
      '      <span>' + tr('Status','Статус') + '</span>',
      '      <strong>' + escapeHtml(trType(project.status)) + '</strong>',
      '      <p>' + (publishReady ? tr('Project is structurally close to a release path.','Проект уже структурно близок к пути релиза.') : tr('Project is still taking shape before release.','Проект ещё формируется перед релизом.')) + '</p>',
      '    </div>',
      '    <div class="ns-project-publish-card">',
      '      <span>' + tr('Template','Шаблон') + '</span>',
      '      <strong>' + escapeHtml(project.templateId || '—') + '</strong>',
      '      <p>' + tr('Template mapping can connect here when Editor and deploy flow are tightened.','Связка с шаблоном появится здесь, когда поток редактора и публикации будет доделан.') + '</p>',
      '    </div>',
      '    <div class="ns-project-publish-card">',
      '      <span>' + tr('Path','Путь') + '</span>',
      '      <strong>' + tr('Workspace → Editor → Publish','Пространство → Редактор → Публикация') + '</strong>',
      '      <p>' + tr('Projects already acts as the bridge between files, notes, drafts, and the later release layer.','Проекты уже работают как мост между файлами, заметками, черновиками и будущим слоем релиза.') + '</p>',
      '    </div>',
      '  </div>',
      '</section>'
    ].join('');
  }

  function renderSettings(project, store) {
    var typeOptions = store.PROJECT_TYPES.map(function (type) {
      return '<option value="' + escapeHtml(type) + '"' + (project.type === type ? ' selected' : '') + '>' + escapeHtml(type) + '</option>';
    }).join('');

    var statusOptions = store.PROJECT_STATUSES.map(function (status) {
      return '<option value="' + escapeHtml(status) + '"' + (project.status === status ? ' selected' : '') + '>' + escapeHtml(status) + '</option>';
    }).join('');

    return [
      '<section class="ns-project-section">',
      '  <h3>' + tr('Settings','Настройки') + '</h3>',
      '  <form class="ns-project-settings-form" data-project-settings-form data-project-id="' + escapeHtml(project.id) + '">',
      '    <div class="ns-project-settings-grid">',
      '      <label class="ns-project-field">',
      '        <span>Title</span>',
      '        <input type="text" name="title" value="' + escapeHtml(project.title) + '" />',
      '      </label>',
      '      <label class="ns-project-field">',
      '        <span>' + tr('Description','Описание') + '</span>',
      '        <input type="text" name="description" value="' + escapeHtml(project.description) + '" />',
      '      </label>',
      '      <label class="ns-project-field">',
      '        <span>' + tr('Type','Тип') + '</span>',
      '        <select name="type">' + typeOptions + '</select>',
      '      </label>',
      '      <label class="ns-project-field">',
      '        <span>' + tr('Status','Статус') + '</span>',
      '        <select name="status">' + statusOptions + '</select>',
      '      </label>',
      '      <label class="ns-project-field">',
      '        <span>' + tr('Template ID','ID шаблона') + '</span>',
      '        <input type="text" name="templateId" value="' + escapeHtml(project.templateId) + '" />',
      '      </label>',
      '      <label class="ns-project-field">',
      '        <span>' + tr('Color','Цвет') + '</span>',
      '        <input type="text" name="color" value="' + escapeHtml(project.color) + '" placeholder="#5a6cff" />',
      '      </label>',
      '    </div>',
      '    <div class="ns-project-settings-flags">',
      '      <label class="ns-project-checkbox"><input type="checkbox" name="pinned"' + (project.pinned ? ' checked' : '') + ' />' + tr('Pinned','Закрепить') + '</label>',
      '      <label class="ns-project-checkbox"><input type="checkbox" name="archived"' + (project.archived ? ' checked' : '') + ' />' + tr('Archived','Архив') + '</label>',
      '    </div>',
      '    <div class="ns-project-settings-actions">',
      '      <button type="submit">Save project</button>',
      '    </div>',
      '  </form>',
      '</section>'
    ].join('');
  }

  function renderTabPanel(project, store, surface) {
    if (runtime.currentTab === 'files') return renderFilesTab(project);
    if (runtime.currentTab === 'notes') return renderNotesTab(project);
    if (runtime.currentTab === 'drafts') return renderDraftsTab(project);
    if (runtime.currentTab === 'publish') return renderPublish(project);
    if (runtime.currentTab === 'settings') return renderSettings(project, store);
    return renderOverview(project, store, surface);
  }

  function renderFilePicker(project) {
    if (!runtime.filePickerOpen) return '';

    var items = getLibraryItems();

    return [
      '<div class="ns-project-modal-backdrop" data-project-picker-close>',
      '  <div class="ns-project-modal" role="dialog" aria-modal="true">',
      '    <div class="ns-project-modal-head">',
      '      <h3>' + tr('Attach file to ','Прикрепить файл к ') + escapeHtml(project.title) + '</h3>',
      '      <button type="button" data-project-picker-close>✕</button>',
      '    </div>',
      items.length
        ? '<div class="ns-project-picker-list">' + items.map(function (item) {
            return [
              '<button type="button" class="ns-project-picker-item" data-project-attach-file="' + escapeHtml(item.id) + '">',
              '  <strong>' + escapeHtml(item.name || item.id || tr('Untitled','Без названия')) + '</strong>',
              '  <span>' + escapeHtml(item.mime || item.category || 'file') + '</span>',
              '</button>'
            ].join('');
          }).join('') + '</div>'
        : '<div class="ns-project-empty-inline">' + tr('No files in Source Library yet. Add files first, then attach them here.','В библиотеке источников пока нет файлов. Сначала добавьте файлы, затем прикрепите их здесь.') + '</div>',
      '  </div>',
      '</div>'
    ].join('');
  }

  function renderProjectView(store, surface) {
    var project = getCurrentProject();

    if (!project) {
      return [
        '<div class="ns-project-empty">',
        '  <h3>' + tr('Select a project','Выберите проект') + '</h3>',
        '  <p>' + tr('Open an existing project or create a new one.','Откройте существующий проект или создайте новый.') + '</p>',
        '</div>'
      ].join('');
    }

    var tabs = [
      { id: 'overview', label: tr('Overview','Обзор') },
      { id: 'files', label: tr('Files','Файлы') },
      { id: 'notes', label: tr('Notes','Заметки') },
      { id: 'drafts', label: tr('Drafts','Черновики') },
      { id: 'publish', label: tr('Publish','Публикация') },
      { id: 'settings', label: tr('Settings','Настройки') }
    ];

    return [
      '<div class="ns-project-view">',
      '  <header class="ns-project-view-header">',
      '    <div class="ns-project-view-main">',
      '      <div class="ns-project-view-topline">',
      '        <span class="ns-project-view-pill">' + escapeHtml(trType(project.type)) + '</span>',
      '        <span class="ns-project-view-pill">' + escapeHtml(trType(project.status)) + '</span>',
      project.pinned ? '        <span class="ns-project-view-pill is-accent">' + tr('Pinned','Закреплён') + '</span>' : '',
      project.archived ? '        <span class="ns-project-view-pill is-muted">' + tr('Archived','В архиве') + '</span>' : '',
      '      </div>',
      '      <h2>' + escapeHtml(project.title) + '</h2>',
      '      <div class="ns-project-view-meta">' + tr('Updated ','Обновлён ') + escapeHtml(formatDate(project.updatedAt)) + '</div>',
      project.description ? '      <p class="ns-project-view-description">' + escapeHtml(project.description) + '</p>' : '',
      '    </div>',
      '    <div class="ns-project-view-actions">',
      '      <button type="button" data-project-action="new-draft">' + tr('New Draft','Новый черновик') + '</button>',
      '      <button type="button" data-project-action="new-note">' + tr('New Note','Новая заметка') + '</button>',
      '      <button type="button" data-project-open-picker>' + tr('Attach File','Прикрепить файл') + '</button>',
      '      <button type="button" data-project-action="use-tools">' + tr('Use in Tools','Использовать в инструментах') + '</button>',
      '      <button type="button" data-project-action="open-workspace">' + tr('Workspace Home','Главная пространства') + '</button>',
      '    </div>',
      '  </header>',
      '  <nav class="ns-project-tabs">' + tabs.map(function (tab) {
           return '<button type="button" data-project-tab="' + escapeHtml(tab.id) + '" class="' + (runtime.currentTab === tab.id ? 'is-active' : '') + '">' + escapeHtml(tab.label) + '</button>';
         }).join('') + '</nav>',
      '  <div class="ns-project-tab-panel">' + renderTabPanel(project, store, surface) + '</div>',
      renderFilePicker(project),
      '</div>'
    ].join('');
  }

  function renderRoot(rootEl) {
    var store = getStore();
    if (!store) return;

    var surface = rootEl.getAttribute('data-projects-surface') || 'workspace';

    rootEl.innerHTML = [
      '<div class="ns-projects-root-shell">',
      '  <aside class="ns-projects-sidebar">',
      renderToolbar(store, surface),
      '    <div class="ns-projects-list">' + renderProjectsList(store) + '</div>',
      '  </aside>',
      '  <main class="ns-projects-main">',
      renderProjectView(store, surface),
      '  </main>',
      '</div>'
    ].join('');
  }

  function renderAll() {
    getRoots().forEach(renderRoot);
  }

  function setCurrentProject(projectId) {
    var store = getStore();
    runtime.currentProjectId = projectId || '';
    runtime.currentTab = 'overview';
    runtime.filePickerOpen = false;

    if (store && projectId) {
      store.setLastOpenedProjectId(projectId);
      emit('ns-projects:opened', { projectId: projectId });
    }

    renderAll();
  }

  function handleCreate(form) {
    var store = getStore();
    if (!store) return;

    var formData = new FormData(form);
    var title = String(formData.get('title') || '').trim();

    if (!title) {
      var titleInput = form.querySelector('[name="title"]');
      if (titleInput) {
        titleInput.focus();
        titleInput.setAttribute('placeholder', tr('Project title required','Нужно название проекта'));
        titleInput.setAttribute('aria-invalid', 'true');
      }
      return;
    }

    var titleInput = form.querySelector('[name="title"]');
    if (titleInput) {
      titleInput.removeAttribute('aria-invalid');
    }

    var project = store.create({
      title: title,
      type: String(formData.get('type') || 'article'),
      description: String(formData.get('description') || '').trim()
    });

    runtime.currentProjectId = project.id;
    runtime.currentTab = 'overview';
    runtime.showCreateForm = false;
    runtime.filePickerOpen = false;

    emit('ns-projects:created', {
      projectId: project.id,
      project: project
    });

    renderAll();
  }

  function handleSaveSettings(form) {
    var store = getStore();
    if (!store) return;

    var projectId = form.getAttribute('data-project-id');
    var formData = new FormData(form);

    var project = store.update(projectId, {
      title: String(formData.get('title') || '').trim() || tr('Untitled project','Проект без названия'),
      description: String(formData.get('description') || '').trim(),
      type: String(formData.get('type') || 'article'),
      status: String(formData.get('status') || 'idea'),
      templateId: String(formData.get('templateId') || '').trim(),
      color: String(formData.get('color') || '').trim(),
      pinned: formData.get('pinned') === 'on',
      archived: formData.get('archived') === 'on'
    });

    if (project) {
      emit('ns-projects:updated', {
        projectId: project.id,
        project: project
      });
      renderAll();
    }
  }

  function handleProjectAction(action) {
    var project = getCurrentProject();
    if (!project) return;


    if (action === 'use-tools') {
      var counts = store && typeof store.getCounts === 'function'
        ? store.getCounts(project.id)
        : { files: 0, notes: 0, drafts: 0 };
      var payloadText = [
        tr('Project','Проект') + ': ' + String(project.title || tr('Untitled project','Проект без названия')),
        tr('Type','Тип') + ': ' + String(trType(project.type || 'project')),
        tr('Status','Статус') + ': ' + String(trType(project.status || 'idea')),
        project.description ? tr('Description','Описание') + ': ' + String(project.description) : '',
        tr('Files','Файлы') + ': ' + counts.files,
        tr('Notes','Заметки') + ': ' + counts.notes,
        tr('Drafts','Черновики') + ': ' + counts.drafts
      ].filter(Boolean).join('\n');

      emit('ns-tools:use-text', {
        mode: 'translate',
        text: payloadText,
        projectId: project.id,
        source: 'project',
        title: project.title || tr('Untitled project','Проект без названия')
      });
      return;
    }

    if (action === 'new-draft') {
      emit('ns-projects:new-draft', {
        projectId: project.id,
        project: project
      });
      return;
    }

    if (action === 'new-note') {
      emit('ns-projects:new-note', {
        projectId: project.id,
        project: project
      });
      return;
    }

    if (action === 'open-workspace') {
      emit('ns-projects:open-workspace', {
        projectId: project.id,
        project: project
      });
    }
  }

  function handleRootClick(event) {
    var target = event.target.closest('button');
    if (!target) return;

    var store = getStore();
    if (!store) return;

    if (target.hasAttribute('data-projects-new')) {
      runtime.showCreateForm = true;
      renderAll();
      return;
    }

    if (target.hasAttribute('data-projects-cancel-create')) {
      runtime.showCreateForm = false;
      renderAll();
      return;
    }

    if (target.hasAttribute('data-projects-toggle-archived')) {
      runtime.showArchived = !runtime.showArchived;
      renderAll();
      return;
    }

    var projectOpen = target.getAttribute('data-project-open');
    if (projectOpen) {
      setCurrentProject(projectOpen);
      return;
    }

    var tab = target.getAttribute('data-project-tab');
    if (tab) {
      runtime.currentTab = tab;
      runtime.filePickerOpen = false;
      renderAll();
      return;
    }

    var pinId = target.getAttribute('data-project-pin');
    if (pinId) {
      var projectToPin = store.getById(pinId);
      if (projectToPin) {
        store.setPinned(pinId, !projectToPin.pinned);
        renderAll();
      }
      return;
    }

    var archiveId = target.getAttribute('data-project-archive');
    if (archiveId) {
      store.archive(archiveId);
      renderAll();
      return;
    }

    var unarchiveId = target.getAttribute('data-project-unarchive');
    if (unarchiveId) {
      store.unarchive(unarchiveId);
      renderAll();
      return;
    }

    var detachFileId = target.getAttribute('data-project-detach-file');
    if (detachFileId) {
      var currentProjectForFile = getCurrentProject();
      if (currentProjectForFile) {
        store.detachFile(currentProjectForFile.id, detachFileId);
        emit('ns-projects:file-detached', { projectId: currentProjectForFile.id, fileId: detachFileId });
        renderAll();
      }
      return;
    }

    var detachNoteId = target.getAttribute('data-project-detach-note');
    if (detachNoteId) {
      var currentProjectForNote = getCurrentProject();
      if (currentProjectForNote) {
        store.detachNote(currentProjectForNote.id, detachNoteId);
        var noteStore = getNotesStore();
        if (noteStore && typeof noteStore.detachFromProject === 'function') {
          noteStore.detachFromProject(detachNoteId);
        }
        renderAll();
      }
      return;
    }

    var detachDraftId = target.getAttribute('data-project-detach-draft');
    if (detachDraftId) {
      var currentProjectForDraft = getCurrentProject();
      if (currentProjectForDraft) {
        store.detachDraft(currentProjectForDraft.id, detachDraftId);
        renderAll();
      }
      return;
    }

    var openFileId = target.getAttribute('data-project-open-file');
    if (openFileId) {
      var libraryStore = getLibraryStore();
      if (libraryStore && typeof libraryStore.setActiveItem === 'function') {
        libraryStore.setActiveItem(openFileId);
      }
      emit('ns-projects:open-files', { fileId: openFileId });
      return;
    }

    var openNoteId = target.getAttribute('data-project-open-note');
    if (openNoteId) {
      if (root.NSNotesV1 && typeof root.NSNotesV1.openNoteById === 'function') {
        root.NSNotesV1.openNoteById(openNoteId);
      }
      emit('ns-projects:open-note', { noteId: openNoteId });
      return;
    }

    if (target.hasAttribute('data-project-open-files')) {
      emit('ns-projects:open-files', {});
      return;
    }

    if (target.hasAttribute('data-project-open-picker')) {
      runtime.filePickerOpen = true;
      renderAll();
      return;
    }

    if (target.hasAttribute('data-project-picker-close')) {
      runtime.filePickerOpen = false;
      renderAll();
      return;
    }

    var attachFileId = target.getAttribute('data-project-attach-file');
    if (attachFileId) {
      var currentProject = getCurrentProject();
      if (currentProject) {
        store.attachFile(currentProject.id, attachFileId);
        runtime.filePickerOpen = false;
        runtime.currentTab = 'files';
        emit('ns-projects:file-attached', { projectId: currentProject.id, fileId: attachFileId });
        renderAll();
      }
      return;
    }

    var action = target.getAttribute('data-project-action');
    if (action) {
      handleProjectAction(action);
    }
  }

  function handleRootSubmit(event) {
    if (event.target.matches('[data-projects-create-form]')) {
      event.preventDefault();
      handleCreate(event.target);
      return;
    }

    if (event.target.matches('[data-project-settings-form]')) {
      event.preventDefault();
      handleSaveSettings(event.target);
    }
  }

  function handleRootInput(event) {
    if (event.target.matches('[data-projects-search]')) {
      runtime.searchQuery = String(event.target.value || '');
      renderAll();
    }
  }

  function bindRoot(rootEl) {
    if (rootEl.dataset.projectsBound === '1') return;
    rootEl.dataset.projectsBound = '1';

    rootEl.addEventListener('click', handleRootClick);
    rootEl.addEventListener('submit', handleRootSubmit);
    rootEl.addEventListener('input', handleRootInput);
  }

  function init() {
    var store = getStore();
    if (!store) return;

    runtime.currentProjectId = store.getLastOpenedProjectId() || '';

    getRoots().forEach(bindRoot);
    renderAll();

    if (typeof store.subscribe === 'function') {
      store.subscribe(function () {
        renderAll();
      });
    }

    var libraryStore = getLibraryStore();
    if (libraryStore && typeof libraryStore.subscribe === 'function') {
      libraryStore.subscribe(function () {
        renderAll();
      });
    }

    var notesStore = getNotesStore();
    if (notesStore && typeof notesStore.subscribe === 'function') {
      notesStore.subscribe(function () {
        renderAll();
      });
    }

    document.addEventListener('ns-notes:open-project', function (event) {
      var projectId = event && event.detail ? event.detail.projectId : '';
      if (projectId) {
        setCurrentProject(projectId);
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

  root.NSProjectsV1 = {
    renderAll: renderAll,
    setCurrentProject: setCurrentProject,
    getCurrentProjectId: function () {
      return runtime.currentProjectId || '';
    }
  };
})(window);
