(function () {
  'use strict';

  const store = window.NSTaskStoreV1;
  if (!store) {
    console.error('[TasksV1] NSTaskStoreV1 is not available.');
    return;
  }

  const VIEW_ORDER = ['focus', 'today', 'next', 'active', 'waiting', 'blocked', 'review', 'projects', 'completed', 'archive'];
  const VIEW_ICONS = {
    focus: '◎', today: '◷', next: '→', active: '▶', waiting: '◌', blocked: '◆', review: '✓', projects: '▰', completed: '✓', archive: '▤'
  };
  let searchQuery = '';
  let bound = false;
  const openProofTaskIds = new Set();
  const openRelationsTaskIds = new Set();
  const openSessionsTaskIds = new Set();

  function lang() {
    const probes = [];
    try { probes.push(document.documentElement.getAttribute('lang')); } catch (error) {}
    try { probes.push(document.body && document.body.getAttribute('data-lang')); } catch (error) {}
    try { probes.push(localStorage.getItem('irgeztne.lang')); } catch (error) {}
    try { probes.push(localStorage.getItem('irgLang')); } catch (error) {}
    const value = probes.filter(Boolean).map(function (item) { return String(item).toLowerCase(); }).find(function (item) {
      return item === 'ru' || item === 'en' || item.startsWith('ru-') || item.startsWith('en-');
    });
    return value && value.startsWith('en') ? 'en' : 'ru';
  }

  function t(ru, en) {
    return lang() === 'en' ? en : ru;
  }

  function esc(value) {
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
      return new Date(value).toLocaleDateString(lang() === 'en' ? 'en-US' : 'ru-RU', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch (error) { return String(value); }
  }

  function stateLabel(state) {
    const labels = {
      INBOX: ['Входящие', 'Inbox'], READY: ['Готово к работе', 'Ready'], ACTIVE: ['В работе', 'Active'],
      WAITING: ['Ожидание', 'Waiting'], BLOCKED: ['Заблокировано', 'Blocked'], PAUSED: ['Пауза', 'Paused'],
      REVIEW: ['На проверке', 'Review'], DONE: ['Завершено', 'Done'], VERIFIED: ['Подтверждено', 'Verified'],
      CANCELLED: ['Отменено', 'Cancelled'], SUPERSEDED: ['Заменено', 'Superseded'], ARCHIVED: ['Архив', 'Archived']
    };
    const pair = labels[state] || [state, state];
    return t(pair[0], pair[1]);
  }

  function priorityLabel(priority) {
    const labels = { LOW: ['Низкий', 'Low'], NORMAL: ['Обычный', 'Normal'], HIGH: ['Высокий', 'High'], CRITICAL: ['Критичный', 'Critical'] };
    const pair = labels[priority] || [priority, priority];
    return t(pair[0], pair[1]);
  }

  function evidenceTypeLabel(type) {
    const labels = {
      NOTE: ['Заметка', 'Note'], TEST: ['Тест', 'Test'], URL: ['URL', 'URL'],
      FILE: ['Файл', 'File'], IMAGE: ['Изображение', 'Image'], CHECKLIST: ['Чек-лист', 'Checklist']
    };
    const pair = labels[type] || [type, type];
    return t(pair[0], pair[1]);
  }

  function relationTypeLabel(type, direction) {
    const outgoing = {
      DEPENDS_ON: ['Зависит от', 'Depends on'], BLOCKS: ['Блокирует', 'Blocks'],
      RELATED_TO: ['Связано с', 'Related to'], CREATED_FROM: ['Создано из', 'Created from'],
      SUPERSEDES: ['Заменяет', 'Supersedes']
    };
    const incoming = {
      DEPENDS_ON: ['От неё зависит', 'Required by'], BLOCKS: ['Блокируется этой задачей', 'Blocked by'],
      RELATED_TO: ['Связано с', 'Related to'], CREATED_FROM: ['Источник для', 'Source for'],
      SUPERSEDES: ['Заменено этой задачей', 'Superseded by']
    };
    const labels = direction === 'incoming' ? incoming : outgoing;
    const pair = labels[type] || [type, type];
    return t(pair[0], pair[1]);
  }

  function linkTypeLabel(type) {
    const labels = {
      PROJECT: ['Проект', 'Project'], FILE: ['Файл', 'File'], NOTE: ['Заметка', 'Note'],
      WEB_STUDIO: ['Web Studio', 'Web Studio'], WORKSHOP: ['Мастерская', 'Workshop'], URL: ['URL', 'URL']
    };
    const pair = labels[type] || [type, type];
    return t(pair[0], pair[1]);
  }

  function viewLabel(view) {
    const labels = {
      focus: ['Мой фокус', 'My focus'], today: ['Сегодня', 'Today'], next: ['Следующие', 'Next'], active: ['В работе', 'Active'],
      waiting: ['Ожидание', 'Waiting'], blocked: ['Заблокировано', 'Blocked'], review: ['На проверке', 'Review'],
      projects: ['Проекты', 'Projects'], completed: ['Завершённые', 'Completed'], archive: ['Архив', 'Archive']
    };
    const pair = labels[view] || [view, view];
    return t(pair[0], pair[1]);
  }

  function signalLabel(signal) {
    const labels = {
      ON_TRACK: ['По плану', 'On track'], BLOCKED: ['Заблокировано', 'Blocked'], WAITING: ['Ожидание', 'Waiting'],
      READY_FOR_REVIEW: ['Готово к проверке', 'Ready for review'], NO_NEXT_ACTION: ['Нет следующего шага', 'No next action'],
      NEEDS_VERIFICATION: ['Нужно подтверждение', 'Needs verification'], VERIFIED: ['Подтверждено', 'Verified']
    };
    const pair = labels[signal] || [signal, signal];
    return t(pair[0], pair[1]);
  }

  function eventLabel(type) {
    const labels = {
      TASK_CREATED: ['Задача создана', 'Task created'], TASK_UPDATED: ['Задача изменена', 'Task updated'],
      TASK_READY: ['Готово к работе', 'Ready for work'], TASK_STARTED: ['Работа начата', 'Work started'],
      TASK_PAUSED: ['Работа поставлена на паузу', 'Work paused'], TASK_RESUMED: ['Работа продолжена', 'Work resumed'],
      TASK_WAITING: ['Переведено в ожидание', 'Moved to waiting'], TASK_BLOCKED: ['Задача заблокирована', 'Task blocked'],
      TASK_UNBLOCKED: ['Блокировка снята', 'Task unblocked'], TASK_RETURNED_TO_WORK: ['Возвращено в работу', 'Returned to work'],
      NEXT_ACTION_CHANGED: ['Изменено следующее действие', 'Next action changed'], TASK_COMPLETED: ['Работа завершена', 'Work completed'],
      TASK_SENT_TO_REVIEW: ['Отправлено на проверку', 'Sent to review'], TASK_VERIFIED: ['Результат подтверждён', 'Result verified'],
      TASK_CANCELLED: ['Задача отменена', 'Task cancelled'], TASK_SUPERSEDED: ['Задача заменена', 'Task superseded'],
      TASK_ARCHIVED: ['Перенесено в архив', 'Task archived'],
      CHECKLIST_ITEM_ADDED: ['Добавлен пункт проверки', 'Checklist item added'],
      CHECKLIST_ITEM_COMPLETED: ['Пункт проверки выполнен', 'Checklist item completed'],
      CHECKLIST_ITEM_REOPENED: ['Пункт проверки возвращён', 'Checklist item reopened'],
      CHECKLIST_ITEM_REMOVED: ['Пункт проверки удалён', 'Checklist item removed'],
      EVIDENCE_ADDED: ['Добавлено подтверждение', 'Evidence added'],
      EVIDENCE_REMOVED: ['Подтверждение удалено', 'Evidence removed'],
      RELATION_ADDED: ['Добавлена связь задачи', 'Task relation added'],
      RELATION_REMOVED: ['Связь задачи удалена', 'Task relation removed'],
      LINK_ADDED: ['Добавлена связь Workspace', 'Workspace link added'],
      LINK_REMOVED: ['Связь Workspace удалена', 'Workspace link removed'],
      SESSION_STARTED: ['Рабочая сессия начата', 'Work session started'],
      SESSION_FINISHED: ['Рабочая сессия завершена', 'Work session finished']
    };
    const pair = labels[type] || [String(type || '').replace(/_/g, ' '), String(type || '').replace(/_/g, ' ')];
    return t(pair[0], pair[1]);
  }

  function formatEventDate(value) {
    if (!value) return '—';
    try {
      return new Date(value).toLocaleString(lang() === 'en' ? 'en-US' : 'ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    } catch (error) { return String(value); }
  }


  function sessionDurationLabel(session) {
    if (!session || !session.startedAt) return '';
    const end = session.endedAt ? new Date(session.endedAt) : new Date();
    const start = new Date(session.startedAt);
    const minutes = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
    if (!Number.isFinite(minutes)) return '';
    if (minutes < 60) return minutes + ' ' + t('мин', 'min');
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return hours + ' ' + t('ч', 'h') + (rest ? ' ' + rest + ' ' + t('мин', 'min') : '');
  }

  function continueLinesHtml(context) {
    if (!context || !context.task) return '';
    const lines = [];
    if (context.task.nextAction) lines.push('<span><b>' + esc(t('Следующее', 'Next')) + '</b>' + esc(context.task.nextAction) + '</span>');
    if (context.activeSession) {
      lines.push('<span><b>' + esc(t('Сессия', 'Session')) + '</b>' + esc(t('Идёт с ', 'Running since ') + formatEventDate(context.activeSession.startedAt)) + '</span>');
    } else if (context.lastSession && context.lastSession.stoppedAt) {
      lines.push('<span><b>' + esc(t('Остановились', 'Stopped at')) + '</b>' + esc(context.lastSession.stoppedAt) + '</span>');
    } else if (context.lastSession && context.lastSession.summary) {
      lines.push('<span><b>' + esc(t('Последняя сессия', 'Last session')) + '</b>' + esc(context.lastSession.summary) + '</span>');
    }
    if (context.blocker) lines.push('<span class="is-warning"><b>' + esc(t('Блокер', 'Blocker')) + '</b>' + esc(context.blocker === 'BLOCKED' ? t('Задача заблокирована', 'Task is blocked') : context.blocker) + '</span>');
    if (context.unfinishedChecklist && context.unfinishedChecklist.length) {
      lines.push('<span><b>' + esc(t('Осталось', 'Remaining')) + '</b>' + context.unfinishedChecklist.length + ' ' + esc(t('пункт(а) чек-листа', 'checklist item(s)')) + '</span>');
    }
    if (context.latestEvent) lines.push('<span><b>' + esc(t('Последнее изменение', 'Last change')) + '</b>' + esc(eventLabel(context.latestEvent.type)) + ' · ' + esc(formatEventDate(context.latestEvent.createdAt)) + '</span>');
    return lines.join('');
  }

  function stateOptionsHtml(task) {
    const allowed = typeof store.getAllowedTransitions === 'function' ? store.getAllowedTransitions(task.id) : [];
    const states = [task.state].concat(allowed.filter(function (state) { return state !== task.state; }));
    return states.map(function (state) {
      return '<option value="' + state + '"' + (state === task.state ? ' selected' : '') + '>' + esc(stateLabel(state)) + '</option>';
    }).join('');
  }

  function taskActionsHtml(task) {
    const actions = {
      INBOX: [['ready', '◌', 'Готово к работе', 'Ready'], ['start', '▶', 'Начать', 'Start']],
      READY: [['start', '▶', 'Начать', 'Start']],
      ACTIVE: [['pause', 'Ⅱ', 'Пауза', 'Pause'], ['wait', '◌', 'Ожидание', 'Waiting'], ['block', '◆', 'Заблокировать', 'Block'], ['done', '✓', 'Завершить', 'Complete']],
      WAITING: [['resume', '▶', 'Продолжить', 'Resume'], ['block', '◆', 'Заблокировать', 'Block']],
      BLOCKED: [['resume', '▶', 'Продолжить', 'Resume'], ['wait', '◌', 'Ожидание', 'Waiting']],
      PAUSED: [['resume', '▶', 'Продолжить', 'Resume']],
      DONE: [['review', '✓', 'На проверку', 'Send to review'], ['reopen', '↶', 'Вернуть в работу', 'Return to work']],
      REVIEW: [['verify', '◆', 'Подтвердить', 'Verify'], ['reopen', '↶', 'Вернуть в работу', 'Return to work']],
      VERIFIED: [['archive', '▤', 'В архив', 'Archive']],
      CANCELLED: [['archive', '▤', 'В архив', 'Archive']],
      SUPERSEDED: [['archive', '▤', 'В архив', 'Archive']],
      ARCHIVED: []
    };
    const list = actions[task.state] || [];
    const lifecycle = list.map(function (item) {
      return '<button type="button" data-task-action="' + item[0] + '">' + item[1] + ' ' + esc(t(item[2], item[3])) + '</button>';
    }).join('');
    const remove = '<button type="button" class="ir-tasks-v1-delete" data-task-action="delete">× ' + esc(t('Удалить задачу', 'Delete task')) + '</button>';
    return lifecycle + remove;
  }

  function projectName(projectId) {
    if (!projectId) return t('Без проекта', 'No project');
    try {
      const projectStore = window.NSProjectStore;
      const project = projectStore && typeof projectStore.getById === 'function' ? projectStore.getById(projectId) : null;
      return project && project.title ? project.title : t('Проект недоступен', 'Project unavailable');
    } catch (error) {
      return t('Проект недоступен', 'Project unavailable');
    }
  }

  function tasksForView(view) {
    const all = store.getAll({ includeArchived: true });
    const now = new Date();
    const todayKey = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
    let list = all;
    if (view === 'focus') {
      const rank = { ACTIVE: 0, BLOCKED: 1, REVIEW: 2, READY: 3, WAITING: 4, PAUSED: 5, INBOX: 6 };
      list = all.filter(function (task) { return Object.prototype.hasOwnProperty.call(rank, task.state); })
        .sort(function (a, b) { return (rank[a.state] ?? 9) - (rank[b.state] ?? 9) || new Date(b.updatedAt) - new Date(a.updatedAt); });
    } else if (view === 'today') {
      list = all.filter(function (task) { return task.dueAt && String(task.dueAt).slice(0, 10) === todayKey; });
    } else if (view === 'next') {
      list = all.filter(function (task) { return ['INBOX', 'READY', 'PAUSED'].includes(task.state); });
    } else if (view === 'active') list = all.filter(function (task) { return task.state === 'ACTIVE'; });
    else if (view === 'waiting') list = all.filter(function (task) { return task.state === 'WAITING'; });
    else if (view === 'blocked') list = all.filter(function (task) { return task.state === 'BLOCKED'; });
    else if (view === 'review') list = all.filter(function (task) { return task.state === 'REVIEW'; });
    else if (view === 'projects') list = all.filter(function (task) { return Boolean(task.projectId); });
    else if (view === 'completed') list = all.filter(function (task) { return ['DONE', 'VERIFIED'].includes(task.state); });
    else if (view === 'archive') list = all.filter(function (task) { return ['ARCHIVED', 'CANCELLED', 'SUPERSEDED'].includes(task.state); });

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(function (task) {
        return [task.title, task.intent, task.outcome, task.nextAction, projectName(task.projectId)].some(function (value) {
          return String(value || '').toLowerCase().includes(q);
        });
      });
    }
    return list;
  }

  function countForView(view) {
    return tasksForView(view).length;
  }

  function quickCreateHtml(compact) {
    return '<div class="ir-tasks-v1-quick' + (compact ? ' is-compact' : '') + '" data-tasks-quick-box>' +
      '<button type="button" class="ir-tasks-v1-quick-plus" data-tasks-quick-create title="' + esc(t('Создать задачу', 'Create task')) + '">＋</button>' +
      '<input type="text" autocomplete="off" maxlength="180" placeholder="' + esc(t('Быстрая задача…', 'Quick task…')) + '" data-tasks-quick-input />' +
      '<button type="button" data-tasks-quick-create>' + esc(t('Добавить', 'Add')) + '</button>' +
    '</div>';
  }

  function navHtml(activeView, collapsed) {
    return '<aside class="ir-tasks-v1-sidebar' + (collapsed ? ' is-collapsed' : '') + '">' +
      '<div class="ir-tasks-v1-sidebar-head"><div><b>' + esc(t('ЗАДАЧИ', 'TASKS')) + '</b><span>IRGEZTNE</span></div>' +
      '<button type="button" class="ir-tasks-v1-collapse" data-tasks-collapse title="' + esc(t('Свернуть меню', 'Collapse menu')) + '">‹</button></div>' +
      quickCreateHtml(false) +
      '<label class="ir-tasks-v1-search"><span>⌕</span><input type="search" value="' + esc(searchQuery) + '" placeholder="' + esc(t('Поиск', 'Search')) + '" data-tasks-search /></label>' +
      '<nav class="ir-tasks-v1-nav">' + VIEW_ORDER.map(function (view) {
        return '<button type="button" class="' + (activeView === view ? 'active' : '') + '" data-tasks-view="' + view + '" title="' + esc(viewLabel(view)) + '">' +
          '<i>' + esc(VIEW_ICONS[view]) + '</i><span>' + esc(viewLabel(view)) + '</span><em>' + countForView(view) + '</em></button>';
      }).join('') + '</nav>' +
      '<div class="ir-tasks-v1-sidebar-foot"><span>' + store.getAll({ includeArchived: true }).length + '</span><small>' + esc(t('всего задач', 'tasks total')) + '</small></div>' +
    '</aside>';
  }

  function taskCardHtml(task, selectedId) {
    const pulse = store.getTaskPulse(task.id) || { progress: 0, signal: 'ON_TRACK' };
    const next = task.nextAction || t('Следующее действие не задано', 'No next action yet');
    return '<article class="ir-tasks-v1-task-card' + (task.id === selectedId ? ' is-selected' : '') + '" data-task-id="' + esc(task.id) + '">' +
      '<div class="ir-tasks-v1-task-top"><div><strong>' + esc(task.title) + '</strong><small>' + esc(projectName(task.projectId)) + '</small></div>' +
      '<span class="ir-tasks-v1-state state-' + esc(task.state.toLowerCase()) + '">' + esc(stateLabel(task.state)) + '</span></div>' +
      '<p><b>' + esc(t('Следующий шаг:', 'Next action:')) + '</b> ' + esc(next) + '</p>' +
      '<div class="ir-tasks-v1-task-meta"><span>' + esc(priorityLabel(task.priority)) + '</span><span>' + esc(formatDate(task.dueAt)) + '</span><span>' + pulse.progress + '%</span></div>' +
    '</article>';
  }

  function listHtml(view, selectedId) {
    const tasks = tasksForView(view);
    return '<main class="ir-tasks-v1-list-pane">' +
      '<div class="ir-tasks-v1-list-head"><div><span>' + esc(t('ЗАДАЧИ', 'TASKS')) + '</span><h2>' + esc(viewLabel(view)) + '</h2><p>' + esc(t('Сосредоточьтесь на следующем реальном действии.', 'Stay focused on the next real action.')) + '</p></div>' +
      '<button type="button" class="ir-tasks-v1-new" data-tasks-new>＋ ' + esc(t('Новая задача', 'New task')) + '</button></div>' +
      '<div class="ir-tasks-v1-list">' + (tasks.length ? tasks.map(function (task) { return taskCardHtml(task, selectedId); }).join('') :
        '<div class="ir-tasks-v1-empty"><b>' + esc(t('Здесь пока спокойно', 'Nothing here yet')) + '</b><span>' + esc(t('Создайте быструю задачу или выберите другое представление.', 'Create a quick task or choose another view.')) + '</span></div>') + '</div>' +
    '</main>';
  }

  function fieldHtml(label, field, value, multiline, hint) {
    return '<label class="ir-tasks-v1-field"><span>' + esc(label) + '</span>' +
      (multiline
        ? '<textarea data-task-field="' + field + '" rows="3" placeholder="' + esc(hint || '') + '">' + esc(value || '') + '</textarea>'
        : '<input data-task-field="' + field + '" value="' + esc(value || '') + '" placeholder="' + esc(hint || '') + '" />') +
    '</label>';
  }

  function proofHtml(task) {
    if (typeof store.getChecklist !== 'function' || typeof store.getEvidence !== 'function') return '';
    const checklist = store.getChecklist(task.id);
    const evidence = store.getEvidence(task.id);
    const done = checklist.filter(function (item) { return item.done; }).length;
    const summary = t('Чек-лист', 'Checklist') + ' ' + done + '/' + checklist.length + ' · ' + t('Подтверждения', 'Evidence') + ' ' + evidence.length;
    const open = openProofTaskIds.has(task.id) ? ' open' : '';
    const typeOptions = (store.EVIDENCE_TYPES || ['NOTE', 'TEST', 'URL', 'FILE', 'IMAGE', 'CHECKLIST']).map(function (type) {
      return '<option value="' + esc(type) + '">' + esc(evidenceTypeLabel(type)) + '</option>';
    }).join('');
    const checklistHtml = checklist.length ? checklist.map(function (item) {
      return '<div class="ir-tasks-v1-proof-item' + (item.done ? ' is-done' : '') + '">' +
        '<label><input type="checkbox" data-task-checklist-toggle="' + esc(item.id) + '"' + (item.done ? ' checked' : '') + ' /><span>' + esc(item.text) + '</span></label>' +
        '<button type="button" data-task-checklist-remove="' + esc(item.id) + '" title="' + esc(t('Удалить пункт', 'Remove item')) + '">×</button></div>';
    }).join('') : '<p class="ir-tasks-v1-proof-empty">' + esc(t('Добавьте несколько коротких критериев результата.', 'Add a few short completion criteria.')) + '</p>';
    const evidenceHtml = evidence.length ? evidence.map(function (item) {
      return '<div class="ir-tasks-v1-evidence-item"><span>' + esc(evidenceTypeLabel(item.type)) + '</span><div><b>' + esc(item.label || item.value) + '</b>' +
        (item.label && item.value ? '<small>' + esc(item.value) + '</small>' : '') + '</div><button type="button" data-task-evidence-remove="' + esc(item.id) + '" title="' + esc(t('Удалить подтверждение', 'Remove evidence')) + '">×</button></div>';
    }).join('') : '<p class="ir-tasks-v1-proof-empty">' + esc(t('Подтверждение может быть заметкой, тестом, URL, файлом или изображением.', 'Evidence can be a note, test, URL, file or image.')) + '</p>';
    return '<details class="ir-tasks-v1-proof" data-task-proof="' + esc(task.id) + '"' + open + '>' +
      '<summary><span class="ir-tasks-v1-proof-mark">✓</span><span><b>' + esc(t('Подтверждение результата', 'Proof / Evidence')) + '</b><small>' + esc(summary) + '</small></span><em>⌄</em></summary>' +
      '<div class="ir-tasks-v1-proof-body">' +
        '<section><div class="ir-tasks-v1-proof-head"><b>' + esc(t('Чек-лист', 'Checklist')) + '</b><span>' + done + '/' + checklist.length + '</span></div>' + checklistHtml +
          '<div class="ir-tasks-v1-proof-add"><input type="text" maxlength="220" data-task-checklist-input placeholder="' + esc(t('Критерий результата…', 'Completion criterion…')) + '" /><button type="button" data-task-checklist-add>＋ ' + esc(t('Добавить', 'Add')) + '</button></div></section>' +
        '<section><div class="ir-tasks-v1-proof-head"><b>' + esc(t('Доказательства', 'Evidence')) + '</b><span>' + evidence.length + '</span></div>' + evidenceHtml +
          '<div class="ir-tasks-v1-evidence-add"><select data-task-evidence-type>' + typeOptions + '</select><input type="text" maxlength="500" data-task-evidence-input placeholder="' + esc(t('Заметка, URL, ID файла или описание…', 'Note, URL, file ID or description…')) + '" /><button type="button" data-task-evidence-add>＋</button></div></section>' +
      '</div></details>';
  }

  function safeGetAll(storeObject, methodName) {
    try {
      return storeObject && typeof storeObject[methodName] === 'function' ? (storeObject[methodName]() || []) : [];
    } catch (error) { return []; }
  }

  function resolveLinkLabel(link) {
    const fallback = link.label || link.targetId || link.targetUri || '—';
    try {
      if (link.type === 'PROJECT' && window.NSProjectStore && typeof window.NSProjectStore.getById === 'function') {
        const item = window.NSProjectStore.getById(link.targetId);
        return item && item.title ? item.title : fallback;
      }
      if (link.type === 'FILE' && window.NSLibraryStore && typeof window.NSLibraryStore.getItemById === 'function') {
        const item = window.NSLibraryStore.getItemById(link.targetId);
        return item && item.name ? item.name : fallback;
      }
      if (link.type === 'NOTE' && window.NSNotesStore && typeof window.NSNotesStore.getById === 'function') {
        const item = window.NSNotesStore.getById(link.targetId);
        return item && item.title ? item.title : fallback;
      }
    } catch (error) {}
    return fallback;
  }

  function workspaceRefOptionsHtml() {
    const options = [];
    safeGetAll(window.NSProjectStore, 'getAll').forEach(function (item) {
      if (item && item.id) options.push('<option value="' + esc(item.id) + '">' + esc(t('Проект: ', 'Project: ') + (item.title || item.id)) + '</option>');
    });
    safeGetAll(window.NSLibraryStore, 'getAllItems').forEach(function (item) {
      if (item && item.id) options.push('<option value="' + esc(item.id) + '">' + esc(t('Файл: ', 'File: ') + (item.name || item.id)) + '</option>');
    });
    safeGetAll(window.NSNotesStore, 'getAll').forEach(function (item) {
      if (item && item.id) options.push('<option value="' + esc(item.id) + '">' + esc(t('Заметка: ', 'Note: ') + (item.title || item.id)) + '</option>');
    });
    return options.join('');
  }

  function relationsHtml(task) {
    if (typeof store.getRelations !== 'function' || typeof store.getLinks !== 'function') return '';
    const relations = store.getRelations(task.id);
    const links = store.getLinks(task.id);
    const open = openRelationsTaskIds.has(task.id) ? ' open' : '';
    const summary = t('Задачи', 'Tasks') + ' ' + relations.length + ' · ' + t('Workspace', 'Workspace') + ' ' + links.length;

    const relationOptions = (store.RELATION_TYPES || ['DEPENDS_ON', 'BLOCKS', 'RELATED_TO', 'CREATED_FROM', 'SUPERSEDES']).map(function (type) {
      return '<option value="' + esc(type) + '">' + esc(relationTypeLabel(type, 'outgoing')) + '</option>';
    }).join('');
    const taskOptions = store.getAll({ includeArchived: true }).filter(function (item) { return item.id !== task.id; }).map(function (item) {
      return '<option value="' + esc(item.id) + '">' + esc(item.title + ' · ' + stateLabel(item.state)) + '</option>';
    }).join('');

    const taskRelationsHtml = relations.length ? relations.map(function (item) {
      const incoming = item.targetTaskId === task.id;
      const otherId = incoming ? item.sourceTaskId : item.targetTaskId;
      const other = store.getById(otherId);
      return '<div class="ir-tasks-v1-relation-item"><span>' + esc(relationTypeLabel(item.type, incoming ? 'incoming' : 'outgoing')) + '</span>' +
        '<div><b>' + esc(other ? other.title : otherId) + '</b><small>' + esc(otherId) + '</small></div>' +
        '<button type="button" data-task-relation-remove="' + esc(item.id) + '" title="' + esc(t('Удалить связь', 'Remove relation')) + '">×</button></div>';
    }).join('') : '<p class="ir-tasks-v1-proof-empty">' + esc(t('Свяжите задачу с другой задачей, только когда связь действительно полезна.', 'Relate this task to another task only when the connection is useful.')) + '</p>';

    const linksHtml = links.length ? links.map(function (item) {
      const target = item.targetUri || item.targetId || '';
      return '<div class="ir-tasks-v1-link-item"><span>' + esc(linkTypeLabel(item.type)) + '</span><div><b>' + esc(resolveLinkLabel(item)) + '</b>' +
        (target && target !== resolveLinkLabel(item) ? '<small>' + esc(target) + '</small>' : '') + '</div>' +
        '<button type="button" data-task-link-remove="' + esc(item.id) + '" title="' + esc(t('Удалить связь', 'Remove link')) + '">×</button></div>';
    }).join('') : '<p class="ir-tasks-v1-proof-empty">' + esc(t('Можно связать задачу с проектом, файлом, заметкой, Web Studio, Мастерской или URL.', 'Link the task to a project, file, note, Web Studio, Workshop, or URL.')) + '</p>';

    const linkOptions = (store.LINK_TYPES || ['PROJECT', 'FILE', 'NOTE', 'WEB_STUDIO', 'WORKSHOP', 'URL']).map(function (type) {
      return '<option value="' + esc(type) + '">' + esc(linkTypeLabel(type)) + '</option>';
    }).join('');

    return '<details class="ir-tasks-v1-relations" data-task-relations="' + esc(task.id) + '"' + open + '>' +
      '<summary><span class="ir-tasks-v1-relations-mark">↗</span><span><b>' + esc(t('Связи', 'Relations')) + '</b><small>' + esc(summary) + '</small></span><em>⌄</em></summary>' +
      '<div class="ir-tasks-v1-relations-body">' +
        '<section><div class="ir-tasks-v1-proof-head"><b>' + esc(t('Между задачами', 'Task relations')) + '</b><span>' + relations.length + '</span></div>' + taskRelationsHtml +
          '<div class="ir-tasks-v1-relation-add"><select data-task-relation-type>' + relationOptions + '</select><select data-task-relation-target><option value="">' + esc(t('Выберите задачу…', 'Choose task…')) + '</option>' + taskOptions + '</select><button type="button" data-task-relation-add>＋</button></div></section>' +
        '<section><div class="ir-tasks-v1-proof-head"><b>' + esc(t('Workspace', 'Workspace')) + '</b><span>' + links.length + '</span></div>' + linksHtml +
          '<div class="ir-tasks-v1-link-add"><select data-task-link-type>' + linkOptions + '</select><input type="text" list="ir-task-workspace-refs-' + esc(task.id) + '" maxlength="700" data-task-link-target placeholder="' + esc(t('ID объекта или URL…', 'Object ID or URL…')) + '" /><datalist id="ir-task-workspace-refs-' + esc(task.id) + '">' + workspaceRefOptionsHtml() + '</datalist><button type="button" data-task-link-add>＋</button></div></section>' +
      '</div></details>';
  }

  function sessionHtml(task) {
    if (typeof store.getSessions !== 'function') return '';
    const sessions = store.getSessions(task.id);
    const active = typeof store.getActiveSession === 'function' ? store.getActiveSession(task.id) : null;
    const last = typeof store.getLastSession === 'function' ? store.getLastSession(task.id) : null;
    const open = openSessionsTaskIds.has(task.id) ? ' open' : '';
    const summary = active
      ? t('Активная сессия · ', 'Active session · ') + sessionDurationLabel(active)
      : (last ? t('Последняя: ', 'Last: ') + formatEventDate(last.endedAt || last.startedAt) : t('Сессий пока нет', 'No sessions yet'));

    let body = '';
    if (active) {
      body = '<div class="ir-tasks-v1-session-active"><div class="ir-tasks-v1-session-head"><b>' + esc(t('Работа сейчас', 'Working now')) + '</b><span>' + esc(formatEventDate(active.startedAt) + ' · ' + sessionDurationLabel(active)) + '</span></div>' +
        '<label><span>' + esc(t('Что сделано', 'What was done')) + '</span><textarea rows="2" data-task-session-summary placeholder="' + esc(t('Коротко зафиксируйте результат этой сессии…', 'Briefly capture what was done…')) + '"></textarea></label>' +
        '<label><span>' + esc(t('Где остановились', 'Where you stopped')) + '</span><textarea rows="2" data-task-session-stopped placeholder="' + esc(t('Контекст, который важно помнить при возвращении…', 'Context worth remembering when you return…')) + '"></textarea></label>' +
        '<label><span>' + esc(t('Что делать следующим', 'What to do next')) + '</span><input data-task-session-next value="' + esc(task.nextAction || '') + '" placeholder="' + esc(t('Следующее конкретное действие…', 'Next concrete action…')) + '" /></label>' +
        '<button type="button" class="ir-tasks-v1-session-finish" data-task-session-finish>✓ ' + esc(t('Сохранить контекст и завершить сессию', 'Save context and finish session')) + '</button></div>';
    } else {
      const lastCard = last ? '<div class="ir-tasks-v1-session-last"><div class="ir-tasks-v1-session-head"><b>' + esc(t('Последняя сессия', 'Last session')) + '</b><span>' + esc(formatEventDate(last.endedAt || last.startedAt) + (sessionDurationLabel(last) ? ' · ' + sessionDurationLabel(last) : '')) + '</span></div>' +
        (last.summary ? '<p><b>' + esc(t('Сделано:', 'Done:')) + '</b> ' + esc(last.summary) + '</p>' : '') +
        (last.stoppedAt ? '<p><b>' + esc(t('Остановились:', 'Stopped at:')) + '</b> ' + esc(last.stoppedAt) + '</p>' : '') +
        (last.nextAction ? '<p><b>' + esc(t('Следующее:', 'Next:')) + '</b> ' + esc(last.nextAction) + '</p>' : '') + '</div>' : '';
      const control = task.state === 'ACTIVE'
        ? '<button type="button" class="ir-tasks-v1-session-start" data-task-session-start>▶ ' + esc(t('Начать рабочую сессию', 'Start work session')) + '</button>'
        : '<p class="ir-tasks-v1-session-note">' + esc(t('Рабочая сессия доступна, когда задача находится «В работе».', 'A work session is available while the task is Active.')) + '</p>';
      body = lastCard + control;
    }

    return '<details class="ir-tasks-v1-session" data-task-session="' + esc(task.id) + '"' + open + '>' +
      '<summary><span class="ir-tasks-v1-session-mark">◷</span><span><b>' + esc(t('Контекст работы', 'Work context')) + '</b><small>' + esc(summary) + '</small></span><em>⌄</em></summary>' +
      '<div class="ir-tasks-v1-session-body">' + body + '</div></details>';
  }

  function passportHtml(task) {
    if (!task) {
      const context = store.getContinueContext();
      return '<aside class="ir-tasks-v1-passport"><div class="ir-tasks-v1-passport-empty">' +
        '<span>◎</span><h3>' + esc(t('Продолжить работу', 'Continue work')) + '</h3>' +
        (context ? '<p class="ir-tasks-v1-continue-title">' + esc(context.task.title) + ' · ' + esc(stateLabel(context.task.state)) + '</p><div class="ir-tasks-v1-continue-lines">' + continueLinesHtml(context) + '</div><button type="button" data-task-id="' + esc(context.task.id) + '">' + esc(t('Продолжить', 'Continue')) + '</button>' :
          '<p>' + esc(t('Выберите задачу слева или создайте первую.', 'Select a task or create your first one.')) + '</p><button type="button" data-tasks-new>' + esc(t('Создать задачу', 'Create task')) + '</button>') +
      '</div></aside>';
    }
    const pulse = store.getTaskPulse(task.id) || { progress: 0, signal: 'ON_TRACK' };
    const events = store.getEvents(task.id).slice(0, 5);
    return '<aside class="ir-tasks-v1-passport" data-passport-task="' + esc(task.id) + '">' +
      '<div class="ir-tasks-v1-passport-head"><div><span>' + esc(task.id.toUpperCase()) + '</span><input class="ir-tasks-v1-title-input" data-task-field="title" value="' + esc(task.title) + '" placeholder="' + esc(t('Название задачи', 'Task title')) + '" title="' + esc(t('Название задачи — можно редактировать', 'Task title — editable')) + '" /></div>' +
      '<span class="ir-tasks-v1-state state-' + esc(task.state.toLowerCase()) + '">' + esc(stateLabel(task.state)) + '</span></div>' +
      '<div class="ir-tasks-v1-passport-body">' +
        '<section class="ir-tasks-v1-main-fields">' +
          fieldHtml('WHY / ' + t('Зачем', 'Intent'), 'intent', task.intent, true, t('Почему эта задача важна?', 'Why does this task exist?')) +
          fieldHtml('OUTCOME / ' + t('Результат', 'Outcome'), 'outcome', task.outcome, true, t('Какой результат должен появиться?', 'What result should exist?')) +
          '<label class="ir-tasks-v1-field is-next"><span>NEXT ACTION / ' + esc(t('Следующее действие', 'Next action')) + '</span><textarea data-task-field="nextAction" rows="3" placeholder="' + esc(t('Какое одно действие сделать следующим?', 'What is the next concrete action?')) + '">' + esc(task.nextAction) + '</textarea></label>' +
        '</section>' +
        '<section class="ir-tasks-v1-status-card"><div class="ir-tasks-v1-progress" style="--task-progress:' + pulse.progress + '"><b>' + pulse.progress + '%</b></div>' +
          '<div><span>' + esc(t('Статус', 'Status')) + '</span><strong>' + esc(signalLabel(pulse.signal)) + '</strong></div>' +
          '<label><span>' + esc(t('Состояние', 'State')) + '</span><select data-task-state>' + stateOptionsHtml(task) + '</select></label>' +
          '<label><span>' + esc(t('Приоритет', 'Priority')) + '</span><select data-task-priority>' + store.PRIORITIES.map(function (priority) { return '<option value="' + priority + '"' + (priority === task.priority ? ' selected' : '') + '>' + esc(priorityLabel(priority)) + '</option>'; }).join('') + '</select></label>' +
          '<div class="ir-tasks-v1-dates"><span>' + esc(t('Создано', 'Created')) + '<b>' + esc(formatDate(task.createdAt)) + '</b></span><span>' + esc(t('Срок', 'Due')) + '<b>' + esc(formatDate(task.dueAt)) + '</b></span></div>' +
          '<div class="ir-tasks-v1-actions">' + taskActionsHtml(task) + '</div>' +
        '</section>' +
      '</div>' +
      proofHtml(task) +
      relationsHtml(task) +
      sessionHtml(task) +
      '<div class="ir-tasks-v1-history"><div><b>' + esc(t('Последние события', 'Recent events')) + '</b><span>' + esc(t('История Task Core', 'Task Core history')) + '</span></div>' +
        (events.length ? events.map(function (event) { return '<article><i></i><span><b>' + esc(eventLabel(event.type)) + '</b><small>' + esc(formatEventDate(event.createdAt)) + '</small></span></article>'; }).join('') : '<p>—</p>') +
      '</div>' +
    '</aside>';
  }

  function renderFull(root) {
    const snapshot = store.getState();
    const activeView = VIEW_ORDER.includes(snapshot.meta.lastView) ? snapshot.meta.lastView : 'focus';
    let selectedId = snapshot.meta.lastOpenedTaskId;
    let selected = selectedId ? store.getById(selectedId) : null;
    const candidates = tasksForView(activeView);
    if (!selected && candidates.length) {
      selected = candidates[0];
      selectedId = selected.id;
    }
    root.innerHTML = '<div class="ir-tasks-v1 ir-tasks-v1--full' + (snapshot.meta.sidebarCollapsed ? ' sidebar-collapsed' : '') + '">' +
      navHtml(activeView, snapshot.meta.sidebarCollapsed) + listHtml(activeView, selectedId) + passportHtml(selected) + '</div>';
  }

  function compactStat(state, label) {
    const count = store.getAll({ includeArchived: true }).filter(function (task) { return task.state === state; }).length;
    return '<article><b>' + count + '</b><span>' + esc(label) + '</span></article>';
  }

  function renderCompact(root) {
    const context = store.getContinueContext();
    const recent = store.getAll().slice(0, 4);
    root.innerHTML = '<div class="ir-tasks-v1 ir-tasks-v1--compact">' +
      '<div class="ir-tasks-v1-compact-head"><div><span>IRGEZTNE</span><h3>' + esc(t('Задачи', 'Tasks')) + '</h3></div><em>' + store.getAll().length + '</em></div>' +
      quickCreateHtml(true) +
      '<section class="ir-tasks-v1-continue"><span>' + esc(t('ПРОДОЛЖИТЬ', 'CONTINUE')) + '</span>' +
        (context ? '<button type="button" data-task-id="' + esc(context.task.id) + '"><strong>' + esc(context.task.title) + '</strong><small>' + esc(context.task.nextAction || (context.lastSession && context.lastSession.stoppedAt) || t('Задайте следующий шаг', 'Add a next action')) + '</small><em>' + esc(stateLabel(context.task.state) + (context.activeSession ? ' · ' + t('сессия идёт', 'session active') : '')) + '</em></button>' : '<p>' + esc(t('Активных задач пока нет.', 'No active tasks yet.')) + '</p>') +
      '</section>' +
      '<div class="ir-tasks-v1-compact-stats">' + compactStat('ACTIVE', t('В работе', 'Active')) + compactStat('WAITING', t('Ожидание', 'Waiting')) + compactStat('BLOCKED', t('Блок', 'Blocked')) + compactStat('REVIEW', t('Проверка', 'Review')) + '</div>' +
      '<section class="ir-tasks-v1-compact-list"><span>' + esc(t('НЕДАВНИЕ', 'RECENT')) + '</span>' + (recent.length ? recent.map(function (task) {
        return '<button type="button" data-task-id="' + esc(task.id) + '"><b>' + esc(task.title) + '</b><small>' + esc(stateLabel(task.state)) + '</small></button>';
      }).join('') : '<p>' + esc(t('Создайте первую задачу.', 'Create your first task.')) + '</p>') + '</section>' +
    '</div>';
  }

  function roots() {
    return {
      compact: Array.from(document.querySelectorAll('.workspace-panel[data-panel="tasks"]')),
      full: Array.from(document.querySelectorAll('.cabinet-section-panel[data-cabinet-panel="tasks"]'))
    };
  }

  function renderAll() {
    const found = roots();
    found.compact.forEach(renderCompact);
    found.full.forEach(renderFull);
  }

  function closestTasksRoot(target) {
    return target && target.closest ? target.closest('.workspace-panel[data-panel="tasks"], .cabinet-section-panel[data-cabinet-panel="tasks"]') : null;
  }

  function focusPassportTitle(root) {
    window.setTimeout(function () {
      const input = root && root.querySelector('.ir-tasks-v1-title-input');
      if (!input) return;
      input.focus();
      try { input.select(); } catch (error) {}
    }, 0);
  }

  function createTask(title, root) {
    const cleanTitle = String(title || '').trim();
    const task = store.create({ title: cleanTitle || t('Новая задача', 'New task'), state: 'INBOX' });
    if (!task) return null;
    searchQuery = '';
    store.setLastView('focus');
    store.setLastOpenedTaskId(task.id);
    focusPassportTitle(root);
    return task;
  }

  function createFromQuick(trigger) {
    const root = closestTasksRoot(trigger);
    if (!root) return null;
    const box = trigger.closest('[data-tasks-quick-box]');
    const input = box && box.querySelector('[data-tasks-quick-input]');
    const title = input ? input.value : '';
    return createTask(title, root);
  }

  function passportIdFrom(node) {
    const passport = node && node.closest ? node.closest('[data-passport-task]') : null;
    return passport && passport.getAttribute('data-passport-task');
  }

  function addChecklistFrom(trigger) {
    const id = passportIdFrom(trigger);
    const proof = trigger.closest('[data-task-proof]');
    const input = proof && proof.querySelector('[data-task-checklist-input]');
    if (!id || !input || typeof store.addChecklistItem !== 'function') return null;
    const item = store.addChecklistItem(id, { text: input.value });
    if (item) openProofTaskIds.add(id);
    return item;
  }

  function addEvidenceFrom(trigger) {
    const id = passportIdFrom(trigger);
    const proof = trigger.closest('[data-task-proof]');
    const input = proof && proof.querySelector('[data-task-evidence-input]');
    const type = proof && proof.querySelector('[data-task-evidence-type]');
    if (!id || !input || !type || typeof store.addEvidence !== 'function') return null;
    const item = store.addEvidence(id, { type: type.value, value: input.value });
    if (item) openProofTaskIds.add(id);
    return item;
  }

  function addRelationFrom(trigger) {
    const id = passportIdFrom(trigger);
    const box = trigger.closest('[data-task-relations]');
    const type = box && box.querySelector('[data-task-relation-type]');
    const target = box && box.querySelector('[data-task-relation-target]');
    if (!id || !type || !target || !target.value || typeof store.addRelation !== 'function') return null;
    const item = store.addRelation(id, { type: type.value, targetTaskId: target.value });
    if (item) openRelationsTaskIds.add(id);
    return item;
  }

  function addLinkFrom(trigger) {
    const id = passportIdFrom(trigger);
    const box = trigger.closest('[data-task-relations]');
    const type = box && box.querySelector('[data-task-link-type]');
    const target = box && box.querySelector('[data-task-link-target]');
    if (!id || !type || !target || !target.value.trim() || typeof store.addLink !== 'function') return null;
    const item = store.addLink(id, { type: type.value, targetRef: target.value });
    if (item) openRelationsTaskIds.add(id);
    return item;
  }

  function bind() {
    if (bound) return;
    bound = true;

    document.addEventListener('keydown', function (event) {
      if (event.key !== 'Enter') return;
      const target = event.target;
      if (!target || !closestTasksRoot(target)) return;
      if (target.matches('[data-tasks-quick-input]')) {
        event.preventDefault(); event.stopPropagation(); createFromQuick(target); return;
      }
      if (target.matches('[data-task-checklist-input]')) {
        event.preventDefault(); event.stopPropagation(); addChecklistFrom(target); return;
      }
      if (target.matches('[data-task-evidence-input]')) {
        event.preventDefault(); event.stopPropagation(); addEvidenceFrom(target); return;
      }
      if (target.matches('[data-task-link-target]')) {
        event.preventDefault(); event.stopPropagation(); addLinkFrom(target);
      }
    });


    document.addEventListener('click', function (event) {
      if (!closestTasksRoot(event.target)) return;
      const quickCreate = event.target.closest('[data-tasks-quick-create]');
      if (quickCreate) {
        event.preventDefault();
        createFromQuick(quickCreate);
        return;
      }
      const newTask = event.target.closest('[data-tasks-new]');
      if (newTask) {
        event.preventDefault();
        const root = closestTasksRoot(newTask);
        if (root && root.matches('.cabinet-section-panel[data-cabinet-panel="tasks"]') && store.getState().meta.sidebarCollapsed) {
          store.setSidebarCollapsed(false);
        }
        createTask('', root);
        return;
      }
      const collapse = event.target.closest('[data-tasks-collapse]');
      if (collapse) {
        store.setSidebarCollapsed(!store.getState().meta.sidebarCollapsed);
        return;
      }
      const viewButton = event.target.closest('[data-tasks-view]');
      if (viewButton) {
        store.setLastView(viewButton.getAttribute('data-tasks-view') || 'focus');
        return;
      }
      const checklistAdd = event.target.closest('[data-task-checklist-add]');
      if (checklistAdd) { addChecklistFrom(checklistAdd); return; }
      const checklistRemove = event.target.closest('[data-task-checklist-remove]');
      if (checklistRemove) {
        const id = passportIdFrom(checklistRemove);
        if (id && typeof store.removeChecklistItem === 'function') { openProofTaskIds.add(id); store.removeChecklistItem(id, checklistRemove.getAttribute('data-task-checklist-remove')); }
        return;
      }
      const evidenceAdd = event.target.closest('[data-task-evidence-add]');
      if (evidenceAdd) { addEvidenceFrom(evidenceAdd); return; }
      const evidenceRemove = event.target.closest('[data-task-evidence-remove]');
      if (evidenceRemove) {
        const id = passportIdFrom(evidenceRemove);
        if (id && typeof store.removeEvidence === 'function') { openProofTaskIds.add(id); store.removeEvidence(id, evidenceRemove.getAttribute('data-task-evidence-remove')); }
        return;
      }
      const relationAdd = event.target.closest('[data-task-relation-add]');
      if (relationAdd) { addRelationFrom(relationAdd); return; }
      const relationRemove = event.target.closest('[data-task-relation-remove]');
      if (relationRemove) {
        const id = passportIdFrom(relationRemove);
        if (id && typeof store.removeRelation === 'function') { openRelationsTaskIds.add(id); store.removeRelation(id, relationRemove.getAttribute('data-task-relation-remove')); }
        return;
      }
      const linkAdd = event.target.closest('[data-task-link-add]');
      if (linkAdd) { addLinkFrom(linkAdd); return; }
      const linkRemove = event.target.closest('[data-task-link-remove]');
      if (linkRemove) {
        const id = passportIdFrom(linkRemove);
        if (id && typeof store.removeLink === 'function') { openRelationsTaskIds.add(id); store.removeLink(id, linkRemove.getAttribute('data-task-link-remove')); }
        return;
      }
      const sessionStart = event.target.closest('[data-task-session-start]');
      if (sessionStart) {
        const id = passportIdFrom(sessionStart);
        if (id && typeof store.startSession === 'function') { openSessionsTaskIds.add(id); store.startSession(id); }
        return;
      }
      const sessionFinish = event.target.closest('[data-task-session-finish]');
      if (sessionFinish) {
        const id = passportIdFrom(sessionFinish);
        const box = sessionFinish.closest('[data-task-session]');
        if (id && box && typeof store.finishSession === 'function') {
          openSessionsTaskIds.add(id);
          store.finishSession(id, {
            summary: (box.querySelector('[data-task-session-summary]') || {}).value || '',
            stoppedAt: (box.querySelector('[data-task-session-stopped]') || {}).value || '',
            nextAction: (box.querySelector('[data-task-session-next]') || {}).value || ''
          });
        }
        return;
      }
      const taskNode = event.target.closest('[data-task-id]');
      if (taskNode) {
        const id = taskNode.getAttribute('data-task-id');
        if (id && store.getById(id)) store.setLastOpenedTaskId(id);
        return;
      }
      const action = event.target.closest('[data-task-action]');
      if (action) {
        const passport = action.closest('[data-passport-task]');
        const id = passport && passport.getAttribute('data-passport-task');
        if (!id) return;
        const name = action.getAttribute('data-task-action');
        if (name === 'delete') {
          const task = store.getById(id);
          if (!task || typeof store.removeTask !== 'function') return;
          const message = t(
            'Удалить задачу «' + task.title + '» безвозвратно?\n\nБудут удалены её история и связанные записи Task Core. Это действие нельзя отменить.',
            'Delete task “' + task.title + '” permanently?\n\nIts Task Core history and related records will also be removed. This cannot be undone.'
          );
          if (window.confirm(message)) store.removeTask(id);
          return;
        }
        const targets = {
          ready: 'READY', start: 'ACTIVE', resume: 'ACTIVE', reopen: 'ACTIVE',
          pause: 'PAUSED', wait: 'WAITING', block: 'BLOCKED', done: 'DONE',
          review: 'REVIEW', verify: 'VERIFIED', archive: 'ARCHIVED'
        };
        if (targets[name]) store.transition(id, targets[name]);
      }
    });

    document.addEventListener('input', function (event) {
      if (!closestTasksRoot(event.target)) return;
      if (event.target.matches('[data-tasks-search]')) {
        searchQuery = event.target.value || '';
        const caret = event.target.selectionStart == null ? searchQuery.length : event.target.selectionStart;
        const wasFull = Boolean(event.target.closest('.cabinet-section-panel[data-cabinet-panel="tasks"]'));
        renderAll();
        const selector = wasFull
          ? '.cabinet-section-panel[data-cabinet-panel="tasks"] [data-tasks-search]'
          : '.workspace-panel[data-panel="tasks"] [data-tasks-search]';
        const nextInput = document.querySelector(selector);
        if (nextInput) {
          nextInput.focus();
          try { nextInput.setSelectionRange(caret, caret); } catch (error) {}
        }
      }
    });

    document.addEventListener('change', function (event) {
      if (!closestTasksRoot(event.target)) return;
      const passport = event.target.closest('[data-passport-task]');
      const id = passport && passport.getAttribute('data-passport-task');
      if (!id) return;
      if (event.target.matches('[data-task-checklist-toggle]')) {
        if (typeof store.toggleChecklistItem === 'function') {
          openProofTaskIds.add(id);
          store.toggleChecklistItem(id, event.target.getAttribute('data-task-checklist-toggle'), Boolean(event.target.checked));
        }
        return;
      }
      if (event.target.matches('[data-task-field]')) {
        const field = event.target.getAttribute('data-task-field');
        if (field) store.update(id, { [field]: event.target.value });
      }
      if (event.target.matches('[data-task-state]')) store.transition(id, event.target.value);
      if (event.target.matches('[data-task-priority]')) store.update(id, { priority: event.target.value });
    });

    document.addEventListener('toggle', function (event) {
      const details = event.target && event.target.matches ? event.target : null;
      if (!details || !closestTasksRoot(details)) return;
      if (details.matches('[data-task-proof]')) {
        const id = details.getAttribute('data-task-proof');
        if (!id) return;
        if (details.open) openProofTaskIds.add(id); else openProofTaskIds.delete(id);
        return;
      }
      if (details.matches('[data-task-relations]')) {
        const id = details.getAttribute('data-task-relations');
        if (!id) return;
        if (details.open) openRelationsTaskIds.add(id); else openRelationsTaskIds.delete(id);
        return;
      }
      if (details.matches('[data-task-session]')) {
        const id = details.getAttribute('data-task-session');
        if (!id) return;
        if (details.open) openSessionsTaskIds.add(id); else openSessionsTaskIds.delete(id);
      }
    }, true);

    document.addEventListener('irg:language-changed', renderAll);
    window.addEventListener('irg:language-changed', renderAll);
  }

  function boot() {
    bind();
    store.subscribe(renderAll);
    renderAll();
    setTimeout(renderAll, 250);
    setTimeout(renderAll, 900);
  }

  window.NSTasksV1 = { render: renderAll };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
