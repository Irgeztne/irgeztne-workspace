(function (root) {
  // IRGEZTNE_PROJECTS_LIVING_CORE_V07PR1

  function isRu() { return document.documentElement.lang === 'ru'; }
  function tr(en, ru) { return isRu() ? ru : en; }
  function normalizeDisplayText(value) {
    const raw = String(value || '');
    if (isRu()) return raw;
    return raw.replace(/Заметка без названия/g,'Untitled note').replace(/Пустая заметка/g,'Empty note').replace(/Пакет без названия/g,'Untitled package').replace(/Файлы/g,'Files').replace(/Заметки/g,'Notes').replace(/Черновики/g,'Drafts').replace(/статья/g,'article').replace(/идея/g,'idea').replace(/Архив/g,'Archive').replace(/Поверхность пространства/g,'Workspace surface').replace(/Модуль пространства/g,'Workspace module');
  }
  function trType(value) {
    const map = {
      article:['article','статья'], site:['site','сайт'], research:['research','исследование'], module:['module','модуль'], package:['package','пакет'], collection:['collection','коллекция'],
      idea:['idea','идея'], active:['active','активный'], review:['review','на проверке'], ready:['ready','готово'], published:['published','опубликовано'], archived:['archived','архив'],
      project:['project','проект'], note:['note','заметка'], draft:['draft','черновик']
    };
    const key = String(value || '').trim().toLowerCase();
    return map[key] ? tr(map[key][0], map[key][1]) : String(value || '');
  }

  var IRGEZTNE_PROJECTS_OVERVIEW_CLEANUP_V07PR1A = true;
  var IRGEZTNE_PROJECTS_CREATE_FORM_FOCUS_FIX_V07PR1B = true;
  var IRGEZTNE_PROJECTS_UI_POLISH_V07PR1C = true;
  var IRGEZTNE_PROJECTS_FINAL_POLISH_V07PR1E = true;
  var IRGEZTNE_PROJECTS_SETTINGS_CLEANUP_V07PR1F = true;

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

  function getTaskStore() {
    return root.NSTaskStoreV1 || null;
  }

  function getRelationsStore() {
    return root.NSRelationsStore || null;
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

  function clickSectionButton(sectionNames) {
    var names = Array.isArray(sectionNames) ? sectionNames : [sectionNames];
    var selectors = [];
    names.forEach(function (name) {
      if (!name) return;
      selectors.push('.cabinet-inner-nav-btn[data-section="' + name + '"]');
      selectors.push('[data-open-section="' + name + '"]');
      selectors.push('.workspace-nav-btn[data-section="' + name + '"]');
    });
    var buttons = [];
    selectors.forEach(function (selector) {
      document.querySelectorAll(selector).forEach(function (button) {
        if (!buttons.includes(button)) buttons.push(button);
      });
    });
    if (!buttons.length) return false;
    var visible = buttons.find(function (button) {
      try { return button.offsetParent !== null; } catch (error) { return false; }
    });
    (visible || buttons[0]).click();
    return true;
  }

  function getProjectTasks(projectId) {
    var taskStore = getTaskStore();
    if (!taskStore || typeof taskStore.getAll !== 'function') return [];
    return taskStore.getAll({ includeArchived: true }).filter(function (task) {
      return task && String(task.projectId || '') === String(projectId || '') && task.state !== 'ARCHIVED';
    });
  }

  function getProjectTaskSummary(projectId) {
    var tasks = getProjectTasks(projectId);
    return tasks.reduce(function (acc, task) {
      acc.total += 1;
      if (task.state === 'ACTIVE') acc.active += 1;
      if (task.state === 'BLOCKED') acc.blocked += 1;
      if (task.state === 'REVIEW') acc.review += 1;
      if (task.state === 'DONE' || task.state === 'VERIFIED') acc.completed += 1;
      return acc;
    }, { total: 0, active: 0, blocked: 0, review: 0, completed: 0 });
  }

  function taskStateLabel(state) {
    var map = {
      INBOX: ['Inbox','Входящие'], READY: ['Ready','Готово к работе'], ACTIVE: ['Active','В работе'], WAITING: ['Waiting','Ожидание'],
      BLOCKED: ['Blocked','Заблокировано'], PAUSED: ['Paused','Пауза'], REVIEW: ['Review','На проверке'], DONE: ['Completed','Завершено'],
      VERIFIED: ['Verified','Подтверждено'], CANCELLED: ['Cancelled','Отменено'], SUPERSEDED: ['Superseded','Заменено'], ARCHIVED: ['Archived','Архив']
    };
    var key = String(state || '').toUpperCase();
    return map[key] ? tr(map[key][0], map[key][1]) : String(state || '');
  }

  function taskEventLabel(type) {
    var map = {
      TASK_CREATED: ['Task created','Задача создана'], TASK_READY: ['Task ready','Задача готова к работе'], TASK_STARTED: ['Task started','Работа по задаче начата'],
      TASK_RESUMED: ['Task resumed','Работа по задаче продолжена'], TASK_RETURNED_TO_WORK: ['Task returned to work','Задача возвращена в работу'],
      TASK_WAITING: ['Task waiting','Задача переведена в ожидание'], TASK_BLOCKED: ['Task blocked','Задача заблокирована'], TASK_UNBLOCKED: ['Task unblocked','Задача разблокирована'],
      TASK_PAUSED: ['Task paused','Задача поставлена на паузу'], TASK_COMPLETED: ['Task completed','Задача завершена'], TASK_SENT_TO_REVIEW: ['Task sent to review','Задача отправлена на проверку'],
      TASK_VERIFIED: ['Task verified','Результат задачи подтверждён'], NEXT_ACTION_CHANGED: ['Task next action changed','Изменён следующий шаг задачи'],
      SESSION_STARTED: ['Work session started','Рабочая сессия начата'], SESSION_FINISHED: ['Work context saved','Сохранён контекст работы'],
      EVIDENCE_ADDED: ['Evidence added','Добавлено подтверждение'], CHECKLIST_ITEM_ADDED: ['Checklist item added','Добавлен пункт проверки'], CHECKLIST_ITEM_COMPLETED: ['Checklist item completed','Пункт проверки выполнен']
    };
    var key = String(type || '').toUpperCase();
    return map[key] ? tr(map[key][0], map[key][1]) : tr('Task updated','Задача изменена');
  }

  function projectActivityLabel(type, payload) {
    payload = payload || {};
    var map = {
      PROJECT_CREATED: ['Project created','Проект создан'], PROJECT_UPDATED: ['Project updated','Проект изменён'], PROJECT_CONTEXT_CHANGED: ['Project purpose updated','Обновлены цель / результат проекта'],
      NEXT_ACTION_CHANGED: ['Project next action changed','Изменён следующий шаг проекта'], PROJECT_STATUS_CHANGED: ['Project status changed','Изменён статус проекта'],
      PROJECT_PINNED: ['Project pinned','Проект закреплён'], PROJECT_UNPINNED: ['Project unpinned','Проект откреплён'], PROJECT_ARCHIVED: ['Project archived','Проект отправлен в архив'], PROJECT_UNARCHIVED: ['Project restored','Проект восстановлен из архива'],
      FILE_ATTACHED: ['File attached','Добавлен файл'], FILE_DETACHED: ['File detached','Файл откреплён'], NOTE_ATTACHED: ['Note attached','Добавлена заметка'], NOTE_DETACHED: ['Note detached','Заметка откреплена'],
      DRAFT_ATTACHED: ['Draft attached','Добавлен черновик'], DRAFT_DETACHED: ['Draft detached','Черновик откреплён']
    };
    var key = String(type || '').toUpperCase();
    if (key === 'PROJECT_CONTEXT_CHANGED') {
      var fields = Array.isArray(payload.fields) ? payload.fields : [];
      var hasGoal = fields.includes('goal');
      var hasOutcome = fields.includes('outcome');
      if (hasGoal && !hasOutcome) return tr('Goal updated','Изменена цель');
      if (!hasGoal && hasOutcome) return tr('Expected result updated','Изменён ожидаемый результат');
      if (hasGoal && hasOutcome) return tr('Goal and expected result updated','Обновлены цель и ожидаемый результат');
    }
    var base = map[key] ? tr(map[key][0], map[key][1]) : tr('Project updated','Проект изменён');
    if (key === 'PROJECT_STATUS_CHANGED' && payload.next) return base + ': ' + trType(payload.next);
    return base;
  }

  function getProjectActivity(project) {
    if (!project) return [];
    var store = getStore();
    var taskStore = getTaskStore();
    var entries = [];

    var local = store && typeof store.getActivity === 'function' ? store.getActivity(project.id, 20) : (project.activity || []);
    (local || []).forEach(function (item) {
      entries.push({
        id: item.id,
        createdAt: item.createdAt,
        label: projectActivityLabel(item.type, item.payload),
        meta: '',
        kind: 'project'
      });
    });

    if (taskStore && typeof taskStore.getEvents === 'function') {
      getProjectTasks(project.id).forEach(function (task) {
        taskStore.getEvents(task.id).slice(0, 10).forEach(function (event) {
          entries.push({
            id: event.id,
            createdAt: event.createdAt,
            label: taskEventLabel(event.type),
            meta: task.title || '',
            kind: 'task'
          });
        });
      });
    }

    return entries.sort(function (a, b) {
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    }).slice(0, 8);
  }

  function chooseProjectTask(projectId) {
    var priority = { ACTIVE: 0, PAUSED: 1, BLOCKED: 2, WAITING: 3, READY: 4, INBOX: 5, REVIEW: 6, DONE: 7, VERIFIED: 8 };
    return getProjectTasks(projectId).filter(function (task) {
      return priority[task.state] != null;
    }).sort(function (a, b) {
      var stateDiff = priority[a.state] - priority[b.state];
      if (stateDiff) return stateDiff;
      return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
    })[0] || null;
  }

  function getContinueTarget(project) {
    if (!project) return null;
    var task = chooseProjectTask(project.id);
    if (task && ['ACTIVE','PAUSED','BLOCKED','WAITING','READY','INBOX','REVIEW'].includes(task.state)) {
      return { type: 'TASK', id: task.id, label: task.title, meta: task.nextAction || taskStateLabel(task.state) };
    }
    if (project.lastWork && project.lastWork.type) {
      return { type: project.lastWork.type, id: project.lastWork.id || '', label: project.lastWork.label || '', meta: project.nextAction || '' };
    }
    var buckets = getRelationBuckets(project);
    if (buckets.documents && buckets.documents.length) {
      var doc = buckets.documents[0];
      return { type: 'DOCUMENT', id: doc.bucketId || doc.targetId || '', label: doc.bucketTitle || doc.targetTitle || tr('Project document','Документ проекта'), meta: project.nextAction || '' };
    }
    if (project.noteIds && project.noteIds.length) {
      var note = getNoteById(project.noteIds[0]);
      return { type: 'NOTE', id: project.noteIds[0], label: note && note.title ? note.title : tr('Project note','Заметка проекта'), meta: project.nextAction || '' };
    }
    if (project.fileIds && project.fileIds.length) {
      var file = getLibraryItemById(project.fileIds[0]);
      return { type: 'FILE', id: project.fileIds[0], label: file && file.name ? file.name : tr('Project file','Файл проекта'), meta: project.nextAction || '' };
    }
    if (project.templateId) {
      return { type: 'WEB_STUDIO', id: project.templateId, label: tr('Web Studio','Web Studio'), meta: project.nextAction || '' };
    }
    if (project.nextAction) {
      return { type: 'NEXT_ACTION', id: '', label: project.nextAction, meta: tr('No linked work surface yet','Рабочая поверхность ещё не связана') };
    }
    return null;
  }

  function rememberProjectWork(project, type, id, label) {
    var store = getStore();
    if (!project || !store || typeof store.setLastWork !== 'function') return;
    store.setLastWork(project.id, { type: type, id: id || '', label: label || '' });
  }

  function openTaskFromProject(project, taskId) {
    var taskStore = getTaskStore();
    if (!taskStore || !taskId) return false;
    var task = typeof taskStore.getById === 'function' ? taskStore.getById(taskId) : null;
    if (!task) return false;
    if (typeof taskStore.setLastOpenedTaskId === 'function') taskStore.setLastOpenedTaskId(task.id);
    rememberProjectWork(project, 'TASK', task.id, task.title || '');
    if (root.NSTasksV1 && typeof root.NSTasksV1.render === 'function') root.NSTasksV1.render();
    return clickSectionButton(['tasks']);
  }

  function openWebStudioFromProject(project) {
    rememberProjectWork(project, 'WEB_STUDIO', project && project.templateId ? project.templateId : '', tr('Web Studio','Web Studio'));
    return clickSectionButton(['site-pages', 'web-studio', 'site-studio']);
  }

  var runtime = {
    currentProjectId: '',
    currentTab: 'overview',
    searchQuery: '',
    showArchived: false,
    showCreateForm: false,
    createDraft: { title: '', type: 'article', description: '' },
    filePickerOpen: false,
    contextFeedback: null,
    settingsFeedback: null
  };

  function resetCreateDraft() {
    runtime.createDraft = { title: '', type: 'article', description: '' };
  }

  function getCurrentProject() {
    var store = getStore();
    if (!store) return null;

    if (!runtime.currentProjectId) {
      runtime.currentProjectId = store.getLastOpenedProjectId() || '';
    }

    var current = runtime.currentProjectId ? store.getById(runtime.currentProjectId) : null;
    if (current && current.archived && !runtime.showArchived) {
      current = null;
      runtime.currentProjectId = '';
    }

    if (!current) {
      var items = typeof store.search === 'function'
        ? store.search('', { showArchived: runtime.showArchived })
        : (typeof store.getAll === 'function' ? store.getAll() : []);
      if (items.length) {
        runtime.currentProjectId = items[0].id;
        current = store.getById(runtime.currentProjectId);
      }
    }

    return current || null;
  }

  function getVisibleProjects() {
    var store = getStore();
    if (!store) return [];

    var base = typeof store.search === 'function'
      ? store.search('', { showArchived: runtime.showArchived })
      : (typeof store.getAll === 'function' ? store.getAll() : []);
    var q = String(runtime.searchQuery || '').trim().toLowerCase();
    if (!q) return base;

    return base.filter(function (project) {
      var haystack = [
        project.title, project.description, project.goal, project.outcome, project.nextAction,
        project.type, project.status, trType(project.type), trType(project.status)
      ].map(function (value) { return String(value || '').toLowerCase(); }).join('\n');
      return haystack.includes(q);
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
    return surface === 'workspace' ? tr('Workspace surface','Поверхность пространства') : tr('Workspace module','Модуль пространства');
  }

  function renderCreateForm(store) {
    var draft = runtime.createDraft || { title: '', type: 'article', description: '' };
    var typeOptions = store.PROJECT_TYPES.map(function (type) {
      return '<option value="' + escapeHtml(type) + '"' + (String(draft.type || 'article') === String(type) ? ' selected' : '') + '>' + escapeHtml(trType(type)) + '</option>';
    }).join('');

    return [
      '<form class="ns-projects-inline-form" data-projects-create-form novalidate>',
      '  <div class="ns-projects-inline-grid">',
      '    <label class="ns-project-field">',
      '      <span>' + tr('Project name','Название проекта') + '</span>',
      '      <input type="text" name="title" value="' + escapeHtml(draft.title || '') + '" placeholder="' + escapeHtml(tr('Enter project name…','Введите название проекта…')) + '" data-projects-title-input />',
      '    </label>',
      '    <label class="ns-project-field">',
      '      <span>' + tr('Type','Тип') + '</span>',
      '      <select name="type" data-projects-type-input>' + typeOptions + '</select>',
      '    </label>',
      '  </div>',
      '  <label class="ns-project-field">',
      '    <span>' + tr('Description','Описание') + '</span>',
      '    <input type="text" name="description" value="' + escapeHtml(draft.description || '') + '" placeholder="' + escapeHtml(tr('Short description','Короткое описание')) + '" data-projects-description-input />',
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
      '    <h3 class="ns-projects-surface-title">' + tr('Project workspace for site, materials, notes, and publishing','Рабочий центр проекта: сайт, материалы, заметки и публикация') + '</h3>',
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
      runtime.showCreateForm ? renderCreateForm(store) : [
        '  <div class="ns-projects-toolbar-row ns-projects-toolbar-row--actions">',
        '    <button type="button" data-projects-new>' + tr('New Project','Новый проект') + '</button>',
        '    <button type="button" data-projects-toggle-archived>' + (runtime.showArchived ? tr('Hide Archived','Скрыть архив') : tr('Show Archived','Показать архив')) + '</button>',
        '  </div>',
        '  <input class="ns-projects-search-input" type="text" value="' + escapeHtml(runtime.searchQuery) + '" placeholder="' + escapeHtml(tr('Search projects…','Поиск проектов…')) + '" aria-label="' + escapeHtml(tr('Search projects','Поиск проектов')) + '" data-projects-search />'
      ].join(''),
      '</div>'
    ].join('');
  }

  function renderProjectCard(store, project) {
    var counts = store.getCounts(project.id);
    var taskSummary = getProjectTaskSummary(project.id);

    return [
      '<article class="ns-project-card ' + (runtime.currentProjectId === project.id ? 'is-active' : '') + '">',
      '  <button type="button" class="ns-project-card-main" data-project-open="' + escapeHtml(project.id) + '">',
      '    <div class="ns-project-card-title-row">',
      '      <strong class="ns-project-card-title">' + escapeHtml(project.title) + '</strong>',
      project.pinned ? '<span class="ns-project-chip">' + tr('Pinned','Закреплён') + '</span>' : '',
      project.archived ? '<span class="ns-project-chip is-muted">' + tr('Archived','В архиве') + '</span>' : '',
      '    </div>',
      '    <div class="ns-project-card-meta-row">',
      '      <span class="ns-project-card-meta">' + escapeHtml(trType(project.type)) + '</span>',
      '      <span class="ns-project-card-meta">' + escapeHtml(trType(project.status)) + '</span>',
      '    </div>',
      project.description ? '<div class="ns-project-card-description">' + escapeHtml(project.description) + '</div>' : '<div class="ns-project-card-description is-muted">' + tr('No description yet.','Описание пока не добавлено.') + '</div>',
      project.nextAction ? '<div class="ns-project-card-next"><span>→</span><strong>' + escapeHtml(project.nextAction) + '</strong></div>' : '',
      '    <div class="ns-project-card-counts">',
      '      <span>' + tr('Tasks','Задачи') + ' <strong>' + taskSummary.total + '</strong></span>',
      '      <span>' + tr('Files','Файлы') + ' <strong>' + counts.files + '</strong></span>',
      '      <span>' + tr('Notes','Заметки') + ' <strong>' + counts.notes + '</strong></span>',
      '      <span>' + tr('Drafts','Черновики') + ' <strong>' + counts.drafts + '</strong></span>',
      '    </div>',
      '    <div class="ns-project-card-updated">' + tr('Updated: ','Обновлён: ') + escapeHtml(formatDate(project.updatedAt)) + '</div>',
      '  </button>',
      '  <div class="ns-project-card-actions">',
      '    <button type="button" data-project-pin="' + escapeHtml(project.id) + '">' + (project.pinned ? tr('Unpin','Открепить') : tr('Pin','Закрепить')) + '</button>',
      project.archived
        ? '    <button type="button" data-project-unarchive="' + escapeHtml(project.id) + '">' + tr('Unarchive','Вернуть') + '</button>'
        : '    <button type="button" data-project-archive="' + escapeHtml(project.id) + '">' + tr('Archive','Архив') + '</button>',
      '    <button type="button" class="ns-project-danger-button ns-project-danger-button--compact" data-project-delete="' + escapeHtml(project.id) + '">' + tr('Delete','Удалить') + '</button>',
      '  </div>',
      '</article>'
    ].join('');
  }

  function renderProjectsList(store) {
    var projects = getVisibleProjects();

    if (!projects.length) {
      var allProjects = typeof store.getAll === 'function' ? store.getAll() : [];
      var hasAnyProjects = allProjects.length > 0;
      var hasArchivedProjects = allProjects.some(function (item) { return Boolean(item.archived); });
      var filtered = Boolean(String(runtime.searchQuery || '').trim());
      var title = tr('No projects yet','Пока нет проектов');
      var copy = tr('Create the first project to connect Web Studio, files, notes, documents, and publishing.','Создайте первый проект, чтобы связать Web Studio, файлы, заметки, документы и публикацию.');
      if (hasAnyProjects && filtered) {
        title = tr('Nothing found','Ничего не найдено');
        copy = tr('Clear the project search or try another phrase. Type and status names can be searched in the current interface language.','Очистите поиск проектов или попробуйте другую фразу. Тип и статус можно искать на текущем языке интерфейса.');
      } else if (!runtime.showArchived && hasArchivedProjects) {
        title = tr('No active projects','Нет активных проектов');
        copy = tr('There are projects in the archive. Use “Show Archived” to open them.','В архиве есть проекты. Нажмите «Показать архив», чтобы открыть их.');
      }
      return [
        '<div class="ns-project-empty">',
        '  <h3>' + title + '</h3>',
        '  <p>' + copy + '</p>',
        '</div>'
      ].join('');
    }

    return projects.map(function (project) {
      return renderProjectCard(store, project);
    }).join('');
  }


  function getRelationBuckets(project) {
    var fallback = { files: [], notes: [], drafts: [], documents: [], mapPoints: [], packages: [], templates: [], other: [], all: [] };
    if (!project) return fallback;

    var relationsStore = getRelationsStore();
    if (relationsStore && typeof relationsStore.getProjectBuckets === 'function') {
      return relationsStore.getProjectBuckets(project.id);
    }

    fallback.files = (project.fileIds || []).map(function (id) { return { bucketType: 'file', bucketId: id, bucketTitle: id, bucketMeta: tr('Linked file','Связанный файл') }; });
    fallback.notes = (project.noteIds || []).map(function (id) { return { bucketType: 'note', bucketId: id, bucketTitle: id, bucketMeta: tr('Linked note','Связанная заметка') }; });
    fallback.drafts = (project.draftIds || []).map(function (id) { return { bucketType: 'draft', bucketId: id, bucketTitle: id, bucketMeta: tr('Linked draft','Связанный черновик') }; });
    fallback.all = fallback.files.concat(fallback.notes, fallback.drafts);
    return fallback;
  }

  function relationBucketCount(buckets, key) {
    return Array.isArray(buckets && buckets[key]) ? buckets[key].length : 0;
  }

  function renderRelationsSnapshot(project) {
    var buckets = getRelationBuckets(project);
    return [
      '<div class="ns-project-relations-grid">',
      '  <div class="ns-project-relation-stat"><span>' + tr('Files','Файлы') + '</span><strong>' + relationBucketCount(buckets, 'files') + '</strong></div>',
      '  <div class="ns-project-relation-stat"><span>' + tr('Notes','Заметки') + '</span><strong>' + relationBucketCount(buckets, 'notes') + '</strong></div>',
      '  <div class="ns-project-relation-stat"><span>' + tr('Drafts','Черновики') + '</span><strong>' + relationBucketCount(buckets, 'drafts') + '</strong></div>',
      '  <div class="ns-project-relation-stat"><span>' + tr('Documents','Документы') + '</span><strong>' + relationBucketCount(buckets, 'documents') + '</strong></div>',
      '</div>',
      '<div class="ns-project-relations-note">' + tr('Relations are local-first: project links are collected from Projects, Files, Notes, and Documents.','Связи работают локально: связи проекта собираются из проектов, файлов, заметок и документов.') + '</div>'
    ].join('');
  }

  function renderRelationActions(entry) {
    var type = entry.bucketType || entry.targetType || '';
    var id = entry.bucketId || entry.targetId || '';
    if (!id) return '';
    if (type === 'file') return '<button type="button" data-project-open-file="' + escapeHtml(id) + '">' + tr('Open','Открыть') + '</button>';
    if (type === 'note') return '<button type="button" data-project-open-note="' + escapeHtml(id) + '">' + tr('Open','Открыть') + '</button>';
    if (type === 'document') return '<button type="button" data-project-open-document="' + escapeHtml(id) + '">' + tr('Open','Открыть') + '</button>';
    if (type === 'mapPoint') return '';
    return '';
  }

  function renderRelationGroup(title, entries, emptyText) {
    entries = Array.isArray(entries) ? entries : [];
    return [
      '<div class="ns-project-relation-group">',
      '  <div class="ns-project-relation-group-head"><h4>' + escapeHtml(title) + '</h4><span class="ns-project-relation-count">' + entries.length + '</span></div>',
      entries.length ? '<div class="ns-project-relation-list">' + entries.map(function (entry) {
        return [
          '<div class="ns-project-relation-row">',
          '  <div class="ns-project-relation-main">',
          '    <strong>' + escapeHtml(entry.bucketTitle || entry.targetTitle || entry.bucketId || entry.targetId || tr('Untitled','Без названия')) + '</strong>',
          '    <span>' + escapeHtml(entry.bucketMeta || entry.targetMeta || entry.origin || '') + '</span>',
          '  </div>',
          '  <div class="ns-project-relation-actions">' + renderRelationActions(entry) + '</div>',
          '</div>'
        ].join('');
      }).join('') + '</div>' : '<div class="ns-project-relation-empty">' + escapeHtml(emptyText) + '</div>',
      '</div>'
    ].join('');
  }

  function renderRelationsTab(project) {
    var buckets = getRelationBuckets(project);
    return [
      '<section class="ns-project-section">',
      '  <div class="ns-project-section-head">',
      '    <h3>' + tr('Relations','Связи') + '</h3>',
      '    <div class="ns-project-section-actions">',
      '      <button type="button" data-project-action="new-note">' + tr('New Note','Новая заметка') + '</button>',
      '      <button type="button" data-project-open-picker>' + tr('Attach File','Прикрепить файл') + '</button>',
      '    </div>',
      '  </div>',
      '  <p class="ns-project-relations-note">' + tr('Relations is an overview: review linked files, notes, documents, drafts, and optional Map links here. Edit links inside each module for now.','Связи — это обзор: здесь можно смотреть связанные файлы, заметки, документы, черновики и необязательные Map-связи. Пока редактируйте связи внутри соответствующих модулей.') + '</p>',
      '  <div class="ns-project-relations-layout">',
      renderRelationGroup(tr('Files','Файлы'), buckets.files, tr('No linked files yet.','Связанных файлов пока нет.')),
      renderRelationGroup(tr('Notes','Заметки'), buckets.notes, tr('No linked notes yet.','Связанных заметок пока нет.')),
      renderRelationGroup(tr('Documents','Документы'), buckets.documents, tr('No linked documents yet. Link a document to this project from Documents.','Связанных документов пока нет. Привяжите документ к проекту из Documents.')),
      renderRelationGroup(tr('Drafts','Черновики'), buckets.drafts, tr('No linked drafts yet.','Связанных черновиков пока нет.')),
      '  </div>',
      '</section>'
    ].join('');
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


  function renderProjectWorkflowSummary(project, counts) {
    var siteLabel = project && project.templateId ? project.templateId : tr('Web Studio available','Web Studio доступна');
    var statusLabel = project && project.status ? trType(project.status) : tr('idea','идея');

    return [
      '<div class="ns-project-workflow-grid ns-project-workflow-grid--focused" aria-label="' + escapeHtml(tr('Project workspace summary','Сводка рабочего центра проекта')) + '">',
      '  <article class="ns-project-workflow-card">',
      '    <span>' + tr('Web Studio','Web Studio') + '</span>',
      '    <strong>' + escapeHtml(siteLabel) + '</strong>',
      '    <p>' + tr('Projects keeps the work context; Web Studio remains the place for pages, preview and publishing.','Projects хранит рабочий контекст; Web Studio остаётся местом для страниц, предпросмотра и публикации.') + '</p>',
      '    <button type="button" data-project-action="open-web-studio">' + tr('Open Web Studio','Открыть Web Studio') + '</button>',
      '  </article>',
      '  <article class="ns-project-workflow-card">',
      '    <span>' + tr('Publishing','Публикация') + '</span>',
      '    <strong>' + escapeHtml(statusLabel) + '</strong>',
      '    <p>' + tr('Publication stays a separate release path; the project stays a calm work center.','Публикация остаётся отдельным путём релиза, а проект — спокойным рабочим центром.') + '</p>',
      '    <button type="button" data-project-tab="publish">' + tr('Open Publish','Открыть публикацию') + '</button>',
      '  </article>',
      '</div>'
    ].join('');
  }

  function renderProjectFeedback(projectId, scope) {
    var feedback = scope === 'settings' ? runtime.settingsFeedback : runtime.contextFeedback;
    if (!feedback || feedback.projectId !== projectId) return '';
    var kind = feedback.kind || 'saved';
    var label = '';
    if (feedback.code === 'no-changes') label = tr('No changes to save','Изменений нет');
    else if (feedback.code === 'need-next-action') label = tr('Add a next action first','Сначала укажите следующий шаг');
    else if (feedback.code === 'no-linked-surface') label = tr('Next action is saved, but no working surface is linked yet','Следующий шаг сохранён, но рабочая поверхность пока не связана');
    else if (scope === 'settings') label = tr('Project saved','Проект сохранён');
    else {
      var fields = Array.isArray(feedback.fields) ? feedback.fields : [];
      var names = fields.map(function (field) {
        if (field === 'goal') return tr('Goal','Цель');
        if (field === 'outcome') return tr('Expected result','Результат');
        if (field === 'nextAction') return tr('Next action','Следующий шаг');
        return '';
      }).filter(Boolean);
      label = names.length ? tr('Saved','Сохранено') + ': ' + names.join(' · ') : tr('Saved','Сохранено');
    }
    return '<div class="ns-project-save-feedback is-' + escapeHtml(kind) + '" role="status">' + (kind === 'saved' ? '✓ ' : kind === 'warning' ? '• ' : '') + escapeHtml(label) + '</div>';
  }

  function renderProjectLivingContext(project) {
    var target = getContinueTarget(project);
    var targetLabel = target ? (target.label || target.meta || tr('Continue project work','Продолжить работу по проекту')) : tr('No work context yet','Контекст работы пока не задан');
    return [
      '<form class="ns-project-living-context" data-project-context-form data-project-id="' + escapeHtml(project.id) + '">',
      '  <div class="ns-project-purpose-grid">',
      '    <label class="ns-project-purpose-card"><span>' + tr('Goal','Цель') + '</span><textarea name="goal" rows="3" placeholder="' + escapeHtml(tr('Why does this project exist?','Зачем существует этот проект?')) + '">' + escapeHtml(project.goal || '') + '</textarea></label>',
      '    <label class="ns-project-purpose-card"><span>' + tr('Expected result','Ожидаемый результат') + '</span><textarea name="outcome" rows="3" placeholder="' + escapeHtml(tr('What should exist when the project is done?','Что должно получиться в конце?')) + '">' + escapeHtml(project.outcome || '') + '</textarea></label>',
      '  </div>',
      '  <div class="ns-project-next-row">',
      '    <label><span>NEXT ACTION / ' + tr('Следующий шаг','Следующий шаг') + '</span><input type="text" name="nextAction" value="' + escapeHtml(project.nextAction || '') + '" placeholder="' + escapeHtml(tr('One concrete next action…','Одно конкретное ближайшее действие…')) + '" /></label>',
      '    <div class="ns-project-next-actions">',
      '      <button type="submit">' + tr('Save context','Сохранить') + '</button>',
      '      <button type="button" class="ns-project-continue-button" data-project-action="continue">▶ ' + tr('Continue','Продолжить') + '</button>',
      '    </div>',
      '  </div>',
      renderProjectFeedback(project.id, 'context'),
      '  <div class="ns-project-continue-hint"><span>' + tr('Continue target','Куда вернёмся') + '</span><strong>' + escapeHtml(targetLabel) + '</strong></div>',
      '</form>'
    ].join('');
  }

  function renderProjectTasksPanel(project) {
    var summary = getProjectTaskSummary(project.id);
    var focusTask = chooseProjectTask(project.id);
    return [
      '<section class="ns-project-live-panel ns-project-task-panel">',
      '  <div class="ns-project-live-panel-head">',
      '    <div><span>' + tr('Project tasks','Задачи проекта') + '</span><strong>' + summary.total + '</strong></div>',
      '    <div class="ns-project-live-panel-actions"><button type="button" data-project-open-tasks>' + tr('Open Tasks','Открыть задачи') + '</button><button type="button" data-project-create-task>＋ ' + tr('Create task','Создать задачу') + '</button></div>',
      '  </div>',
      '  <div class="ns-project-task-stats">',
      '    <div><span>' + tr('Active','В работе') + '</span><strong>' + summary.active + '</strong></div>',
      '    <div><span>' + tr('Blocked','Заблокировано') + '</span><strong>' + summary.blocked + '</strong></div>',
      '    <div><span>' + tr('Review','На проверке') + '</span><strong>' + summary.review + '</strong></div>',
      '    <div><span>' + tr('Completed','Завершено') + '</span><strong>' + summary.completed + '</strong></div>',
      '  </div>',
      focusTask ? '  <button type="button" class="ns-project-task-focus" data-project-open-task="' + escapeHtml(focusTask.id) + '"><span>' + escapeHtml(taskStateLabel(focusTask.state)) + '</span><strong>' + escapeHtml(focusTask.title) + '</strong><small>' + escapeHtml(focusTask.nextAction || tr('Open task context','Открыть контекст задачи')) + '</small></button>' : '  <div class="ns-project-live-empty">' + tr('No linked tasks yet. Create one from the project and it will be linked automatically.','Связанных задач пока нет. Создайте задачу из проекта — связь добавится автоматически.') + '</div>',
      '</section>'
    ].join('');
  }

  function renderProjectActivityPanel(project) {
    var entries = getProjectActivity(project);
    return [
      '<section class="ns-project-live-panel ns-project-activity-panel">',
      '  <div class="ns-project-live-panel-head"><div><span>' + tr('Recent activity','Последняя активность') + '</span><strong>' + entries.length + '</strong></div></div>',
      entries.length ? '<div class="ns-project-activity-list">' + entries.map(function (entry) {
        return '<div class="ns-project-activity-row"><time>' + escapeHtml(formatDate(entry.createdAt)) + '</time><div><strong>' + escapeHtml(entry.label) + '</strong>' + (entry.meta ? '<span>' + escapeHtml(entry.meta) + '</span>' : '') + '</div></div>';
      }).join('') + '</div>' : '<div class="ns-project-live-empty">' + tr('Activity will appear here as the project changes and linked tasks move forward.','Здесь появится история по мере изменений проекта и движения связанных задач.') + '</div>',
      '</section>'
    ].join('');
  }

  function renderProjectLivingPanels(project, counts) {
    return '<div class="ns-project-live-grid">' + renderProjectTasksPanel(project) + '<section class="ns-project-live-panel ns-project-materials-panel"><div class="ns-project-live-panel-head"><div><span>' + tr('Materials','Материалы') + '</span><strong>' + (counts.files + counts.notes + counts.drafts) + '</strong></div></div><div class="ns-project-material-stats"><div><span>' + tr('Files','Файлы') + '</span><strong>' + counts.files + '</strong></div><div><span>' + tr('Notes','Заметки') + '</span><strong>' + counts.notes + '</strong></div><div><span>' + tr('Drafts','Черновики') + '</span><strong>' + counts.drafts + '</strong></div></div></section></div>';
  }

  function renderOverview(project, store, surface) {
    var counts = store.getCounts(project.id);

    return [
      '<section class="ns-project-section ns-project-section--overview">',
      renderProjectLivingContext(project),
      '  <div class="ns-project-stats-grid ns-project-stats-grid--core">',
      '    <div class="ns-project-stat"><span>' + tr('Type','Тип') + '</span><strong>' + escapeHtml(trType(project.type)) + '</strong></div>',
      '    <div class="ns-project-stat"><span>' + tr('Status','Статус') + '</span><strong>' + escapeHtml(trType(project.status)) + '</strong></div>',
      '    <div class="ns-project-stat"><span>' + tr('Updated','Обновлён') + '</span><strong>' + escapeHtml(formatDate(project.updatedAt)) + '</strong></div>',
      '  </div>',
      project.description
        ? '<div class="ns-project-description">' + escapeHtml(project.description) + '</div>'
        : '<div class="ns-project-description is-muted">' + tr('No description yet.','Описание пока не добавлено.') + '</div>',
      renderProjectLivingPanels(project, counts),
      renderProjectWorkflowSummary(project, counts),
      renderProjectActivityPanel(project),
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
        var meta = item && item.mime ? item.mime : (item && item.category ? item.category : tr('Linked file','Связанный файл'));

        return [
          '<div class="ns-project-linked-row">',
          '  <div class="ns-project-linked-main">',
          '    <strong>' + escapeHtml(title) + '</strong>',
          '    <span>' + escapeHtml(meta) + '</span>',
          '  </div>',
          '  <div class="ns-project-linked-actions">',
          item ? '<button type="button" data-project-open-file="' + escapeHtml(fileId) + '">' + tr('Open','Открыть') + '</button>' : '',
          '    <button type="button" data-project-detach-file="' + escapeHtml(fileId) + '">' + tr('Detach','Открепить') + '</button>',
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
          '    <button type="button" data-project-open-note="' + escapeHtml(noteId) + '">' + tr('Open','Открыть') + '</button>',
          '    <button type="button" data-project-detach-note="' + escapeHtml(noteId) + '">' + tr('Detach','Открепить') + '</button>',
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
          '    <button type="button" data-project-detach-draft="' + escapeHtml(draftId) + '">' + tr('Detach','Открепить') + '</button>',
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
      '      <p>' + (project.templateId ? tr('The project keeps this Web Studio/template reference as part of its working context.','Проект хранит эту ссылку Web Studio/шаблона как часть рабочего контекста.') : tr('No Web Studio/template reference is set yet. Web Studio can still be opened from the project overview.','Ссылка Web Studio/шаблона пока не задана. Web Studio всё равно можно открыть из обзора проекта.')) + '</p>',
      '    </div>',
      '    <div class="ns-project-publish-card">',
      '      <span>' + tr('Path','Путь') + '</span>',
      '      <strong>' + tr('Workspace → Web Studio → Publish','Пространство → Web Studio → Публикация') + '</strong>',
      '      <p>' + tr('Projects acts as the work center around Web Studio, files, notes, documents, and release path.','Проекты работают как рабочий центр вокруг Web Studio, файлов, заметок, документов и пути релиза.') + '</p>',
      '    </div>',
      '  </div>',
      '</section>'
    ].join('');
  }

  function renderSettings(project, store) {
    var typeOptions = store.PROJECT_TYPES.map(function (type) {
      return '<option value="' + escapeHtml(type) + '"' + (project.type === type ? ' selected' : '') + '>' + escapeHtml(trType(type)) + '</option>';
    }).join('');

    var statusOptions = store.PROJECT_STATUSES.map(function (status) {
      return '<option value="' + escapeHtml(status) + '"' + (project.status === status ? ' selected' : '') + '>' + escapeHtml(trType(status)) + '</option>';
    }).join('');

    return [
      '<section class="ns-project-section ns-project-section--settings">',
      '  <div class="ns-project-section-head ns-project-settings-head">',
      '    <div>',
      '      <h3>' + tr('Settings','Настройки') + '</h3>',
      '      <p class="ns-project-settings-note">' + tr('Basic project details only. Work links and publication context stay in their own sections.','Только основные параметры проекта. Рабочие связи и публикационный контекст остаются в своих разделах.') + '</p>',
      '    </div>',
      '  </div>',
      '  <form class="ns-project-settings-form" data-project-settings-form data-project-id="' + escapeHtml(project.id) + '">',
      '    <div class="ns-project-settings-grid">',
      '      <label class="ns-project-field">',
      '        <span>' + tr('Title','Название') + '</span>',
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
      '    </div>',
      '    <div class="ns-project-settings-actions">',
      '      <button type="submit">' + tr('Save','Сохранить') + '</button>',
      renderProjectFeedback(project.id, 'settings'),
      '    </div>',
      '  </form>',
      '</section>'
    ].join('');
  }

  function renderTabPanel(project, store, surface) {
    if (runtime.currentTab === 'files') return renderFilesTab(project);
    if (runtime.currentTab === 'notes') return renderNotesTab(project);
    if (runtime.currentTab === 'drafts') return renderDraftsTab(project);
    if (runtime.currentTab === 'relations') return renderRelationsTab(project);
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
              '  <span>' + escapeHtml(item.mime || item.category || tr('File','Файл')) + '</span>',
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
      { id: 'relations', label: tr('Relations','Связи') },
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
    runtime.contextFeedback = null;
    runtime.settingsFeedback = null;

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
    runtime.searchQuery = '';
    resetCreateDraft();
    runtime.filePickerOpen = false;

    emit('ns-projects:created', {
      projectId: project.id,
      project: project
    });

    renderAll();
  }

  function handleDeleteProject(projectId) {
    var store = getStore();
    if (!store || !projectId || typeof store.remove !== 'function') return;

    var project = store.getById(projectId);
    if (!project) return;

    var ok = root.confirm(tr(
      'Delete project "' + String(project.title || '') + '"? Linked files, notes, and drafts will stay in their modules. Linked tasks will stay in Tasks and become unassigned.',
      'Удалить проект «' + String(project.title || '') + '»? Связанные файлы, заметки и черновики останутся в своих модулях. Связанные задачи останутся в «Задачах» и станут без проекта.'
    ));

    if (!ok) return;

    var wasCurrent = runtime.currentProjectId === projectId;
    var linkedTasks = getProjectTasks(projectId);
    var taskStore = getTaskStore();
    if (taskStore && typeof taskStore.update === 'function') {
      linkedTasks.forEach(function (task) {
        taskStore.update(task.id, { projectId: '' });
      });
    }

    var removed = store.remove(projectId);
    if (removed) {
      if (wasCurrent) {
        var items = typeof store.search === 'function'
          ? store.search('', { showArchived: runtime.showArchived })
          : (typeof store.getAll === 'function' ? store.getAll() : []);
        runtime.currentProjectId = items[0] ? items[0].id : '';
        if (typeof store.setLastOpenedProjectId === 'function') store.setLastOpenedProjectId(runtime.currentProjectId);
        runtime.currentTab = 'overview';
        runtime.filePickerOpen = false;
      }
      runtime.contextFeedback = null;
      runtime.settingsFeedback = null;
      emit('ns-projects:deleted', { projectId: projectId, project: removed });
      renderAll();
    }
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
      status: String(formData.get('status') || 'idea')
    });

    if (project) {
      runtime.settingsFeedback = { projectId: project.id, kind: 'saved', code: 'saved' };
      emit('ns-projects:updated', {
        projectId: project.id,
        project: project
      });
      renderAll();
    }
  }

  function handleProjectAction(action) {
    var project = getCurrentProject();
    var store = getStore();
    if (!project || !store) return;

    if (action === 'continue') {
      var target = getContinueTarget(project);
      if (!target) {
        runtime.contextFeedback = { projectId: project.id, kind: 'warning', code: 'need-next-action' };
        renderAll();
        var nextField = document.querySelector('[data-project-context-form][data-project-id="' + project.id + '"] [name="nextAction"]');
        if (nextField) nextField.focus();
        return;
      }
      if (target.type === 'TASK') {
        openTaskFromProject(project, target.id);
        return;
      }
      if (target.type === 'NOTE') {
        rememberProjectWork(project, 'NOTE', target.id, target.label);
        if (root.NSNotesV1 && typeof root.NSNotesV1.openNoteById === 'function') root.NSNotesV1.openNoteById(target.id);
        emit('ns-projects:open-note', { noteId: target.id });
        return;
      }
      if (target.type === 'FILE') {
        rememberProjectWork(project, 'FILE', target.id, target.label);
        var libraryStore = getLibraryStore();
        if (libraryStore && typeof libraryStore.setActiveItem === 'function') libraryStore.setActiveItem(target.id);
        emit('ns-projects:open-files', { fileId: target.id });
        return;
      }
      if (target.type === 'DOCUMENT') {
        rememberProjectWork(project, 'DOCUMENT', target.id, target.label);
        if (root.NSDocumentsV1 && typeof root.NSDocumentsV1.openDocumentById === 'function') root.NSDocumentsV1.openDocumentById(target.id);
        emit('ns-projects:open-documents', { documentId: target.id });
        return;
      }
      if (target.type === 'WEB_STUDIO') {
        openWebStudioFromProject(project);
        return;
      }
      runtime.contextFeedback = { projectId: project.id, kind: 'warning', code: 'no-linked-surface' };
      renderAll();
      var nextActionField = document.querySelector('[data-project-context-form][data-project-id="' + project.id + '"] [name="nextAction"]');
      if (nextActionField) nextActionField.focus();
      return;
    }

    if (action === 'open-web-studio') {
      openWebStudioFromProject(project);
      return;
    }

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
      resetCreateDraft();
      runtime.showCreateForm = true;
      renderAll();
      var createTitle = document.querySelector('[data-projects-root] [data-projects-title-input]');
      if (createTitle) createTitle.focus();
      return;
    }

    if (target.hasAttribute('data-projects-cancel-create')) {
      runtime.showCreateForm = false;
      resetCreateDraft();
      renderAll();
      return;
    }

    if (target.hasAttribute('data-projects-toggle-archived')) {
      runtime.showArchived = !runtime.showArchived;
      if (!runtime.showArchived) {
        var currentBeforeHide = runtime.currentProjectId ? store.getById(runtime.currentProjectId) : null;
        if (currentBeforeHide && currentBeforeHide.archived) {
          var visibleAfterHide = typeof store.search === 'function' ? store.search('', { showArchived: false }) : [];
          runtime.currentProjectId = visibleAfterHide[0] ? visibleAfterHide[0].id : '';
          if (typeof store.setLastOpenedProjectId === 'function') store.setLastOpenedProjectId(runtime.currentProjectId);
        }
      }
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
      var archivingCurrent = runtime.currentProjectId === archiveId;
      var fallbackBeforeArchive = [];
      if (archivingCurrent && !runtime.showArchived && typeof store.search === 'function') {
        fallbackBeforeArchive = store.search('', { showArchived: false }).filter(function (item) { return item.id !== archiveId; });
      }
      store.archive(archiveId);
      if (archivingCurrent && !runtime.showArchived) {
        runtime.currentProjectId = fallbackBeforeArchive[0] ? fallbackBeforeArchive[0].id : '';
        if (typeof store.setLastOpenedProjectId === 'function') store.setLastOpenedProjectId(runtime.currentProjectId);
        runtime.currentTab = 'overview';
      }
      renderAll();
      return;
    }

    var unarchiveId = target.getAttribute('data-project-unarchive');
    if (unarchiveId) {
      store.unarchive(unarchiveId);
      renderAll();
      return;
    }

    var deleteProjectId = target.getAttribute('data-project-delete');
    if (deleteProjectId) {
      handleDeleteProject(deleteProjectId);
      return;
    }

    var openTaskId = target.getAttribute('data-project-open-task');
    if (openTaskId) {
      var projectForTask = getCurrentProject();
      if (projectForTask) openTaskFromProject(projectForTask, openTaskId);
      return;
    }

    if (target.hasAttribute('data-project-open-tasks')) {
      var projectForTasks = getCurrentProject();
      var taskForProject = projectForTasks ? chooseProjectTask(projectForTasks.id) : null;
      if (projectForTasks && taskForProject) {
        openTaskFromProject(projectForTasks, taskForProject.id);
      } else {
        clickSectionButton(['tasks']);
      }
      return;
    }

    if (target.hasAttribute('data-project-create-task')) {
      var taskStore = getTaskStore();
      var projectForCreateTask = getCurrentProject();
      if (!taskStore || !projectForCreateTask || typeof taskStore.create !== 'function') return;
      var suggested = projectForCreateTask.nextAction || (tr('Work on project: ','Работа по проекту: ') + projectForCreateTask.title);
      var title = root.prompt(tr('Task for this project','Задача для этого проекта'), suggested);
      if (title == null) return;
      title = String(title).trim();
      if (!title) return;
      var createdTask = taskStore.create({
        title: title,
        projectId: projectForCreateTask.id,
        nextAction: projectForCreateTask.nextAction || ''
      });
      if (createdTask) openTaskFromProject(projectForCreateTask, createdTask.id);
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
      var projectForFileOpen = getCurrentProject();
      var fileItem = getLibraryItemById(openFileId);
      if (projectForFileOpen) rememberProjectWork(projectForFileOpen, 'FILE', openFileId, fileItem && fileItem.name ? fileItem.name : openFileId);
      var libraryStore = getLibraryStore();
      if (libraryStore && typeof libraryStore.setActiveItem === 'function') {
        libraryStore.setActiveItem(openFileId);
      }
      emit('ns-projects:open-files', { fileId: openFileId });
      return;
    }

    var openNoteId = target.getAttribute('data-project-open-note');
    if (openNoteId) {
      var projectForNoteOpen = getCurrentProject();
      var noteForOpen = getNoteById(openNoteId);
      if (projectForNoteOpen) rememberProjectWork(projectForNoteOpen, 'NOTE', openNoteId, noteForOpen && noteForOpen.title ? noteForOpen.title : openNoteId);
      if (root.NSNotesV1 && typeof root.NSNotesV1.openNoteById === 'function') {
        root.NSNotesV1.openNoteById(openNoteId);
      }
      emit('ns-projects:open-note', { noteId: openNoteId });
      return;
    }

    var openDocumentId = target.getAttribute('data-project-open-document');
    if (openDocumentId) {
      var projectForDocumentOpen = getCurrentProject();
      if (projectForDocumentOpen) rememberProjectWork(projectForDocumentOpen, 'DOCUMENT', openDocumentId, tr('Project document','Документ проекта'));
      if (root.NSDocumentsV1 && typeof root.NSDocumentsV1.openDocumentById === 'function') {
        root.NSDocumentsV1.openDocumentById(openDocumentId);
      }
      emit('ns-projects:open-documents', { documentId: openDocumentId });
      return;
    }

    var openMapPointId = target.getAttribute('data-project-open-map-point');
    if (openMapPointId) {
      if (root.NSMapV1 && typeof root.NSMapV1.openPointById === 'function') {
        root.NSMapV1.openPointById(openMapPointId);
      }
      emit('ns-projects:open-map', { mapPointId: openMapPointId });
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

    if (event.target.matches('[data-project-context-form]')) {
      event.preventDefault();
      var contextStore = getStore();
      if (!contextStore) return;
      var contextProjectId = event.target.getAttribute('data-project-id');
      var contextProject = contextStore.getById(contextProjectId);
      if (!contextProject) return;
      var contextData = new FormData(event.target);
      var patch = {
        goal: String(contextData.get('goal') || '').trim(),
        outcome: String(contextData.get('outcome') || '').trim(),
        nextAction: String(contextData.get('nextAction') || '').trim()
      };
      var changedFields = ['goal','outcome','nextAction'].filter(function (field) {
        return String(contextProject[field] || '') !== String(patch[field] || '');
      });
      if (!changedFields.length) {
        runtime.contextFeedback = { projectId: contextProjectId, kind: 'neutral', code: 'no-changes' };
        renderAll();
        return;
      }
      runtime.contextFeedback = { projectId: contextProjectId, kind: 'saved', code: 'saved', fields: changedFields };
      contextStore.update(contextProjectId, patch);
      return;
    }

    if (event.target.matches('[data-project-settings-form]')) {
      event.preventDefault();
      handleSaveSettings(event.target);
    }
  }

  function restoreTextInputFocus(selector, value, start, end) {
    var candidates = Array.from(document.querySelectorAll(selector));
    var input = candidates.find(function (node) {
      try { return node.offsetParent !== null; } catch (error) { return false; }
    }) || candidates[0];
    if (!input) return;
    if (typeof value === 'string') input.value = value;
    input.focus();
    try {
      if (typeof input.setSelectionRange === 'function') input.setSelectionRange(start, end);
    } catch (error) {}
  }

  function handleRootInput(event) {
    if (event.target.closest && event.target.closest('[data-project-context-form]')) {
      runtime.contextFeedback = null;
    }
    if (event.target.closest && event.target.closest('[data-project-settings-form]')) {
      runtime.settingsFeedback = null;
    }

    if (event.target.matches('[data-projects-title-input]')) {
      runtime.createDraft.title = String(event.target.value || '');
      event.stopPropagation();
      return;
    }

    if (event.target.matches('[data-projects-description-input]')) {
      runtime.createDraft.description = String(event.target.value || '');
      event.stopPropagation();
      return;
    }

    if (event.target.matches('[data-projects-search]')) {
      var value = String(event.target.value || '');
      var start = typeof event.target.selectionStart === 'number' ? event.target.selectionStart : value.length;
      var end = typeof event.target.selectionEnd === 'number' ? event.target.selectionEnd : start;
      runtime.searchQuery = value;
      renderAll();
      restoreTextInputFocus('[data-projects-root] [data-projects-search]', value, start, end);
    }
  }

  function handleRootChange(event) {
    if (event.target.closest && event.target.closest('[data-project-settings-form]')) {
      runtime.settingsFeedback = null;
    }
    if (event.target.matches('[data-projects-type-input]')) {
      runtime.createDraft.type = String(event.target.value || 'article');
      event.stopPropagation();
    }
  }

  function bindRoot(rootEl) {
    if (rootEl.dataset.projectsBound === '1') return;
    rootEl.dataset.projectsBound = '1';

    rootEl.addEventListener('click', handleRootClick);
    rootEl.addEventListener('submit', handleRootSubmit);
    rootEl.addEventListener('input', handleRootInput);
    rootEl.addEventListener('change', handleRootChange);
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

    var taskStore = getTaskStore();
    if (taskStore && typeof taskStore.subscribe === 'function') {
      taskStore.subscribe(function () {
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
    document.addEventListener('irg:relations-changed', renderAll);
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

// 1.0.0 projects role polish v1
