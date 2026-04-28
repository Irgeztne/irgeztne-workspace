(function () {
  const VIEW_HOME = 'home';
  const VIEW_LIST = 'list';
  const VIEW_BUILDER = 'builder';
  const VIEW_RULES = 'rules';
  const BUILDER_TABS = ['overview', 'details', 'files', 'preview', 'compatibility', 'validation', 'submit'];
  const TYPE_OPTIONS = ['template', 'theme', 'pack', 'widget', 'asset-pack', 'starter'];
  const uiState = {
    view: VIEW_HOME,
    builderTab: 'overview',
    filterStatus: 'all',
    filterType: 'all',
    query: '',
    notice: ''
  };

  function isRu() {
    return String(document && document.documentElement && document.documentElement.lang || '').toLowerCase() === 'ru';
  }

  function t(ru, en) {
    return isRu() ? ru : en;
  }

  function getStatusLabels() {
    return isRu()
      ? {
          draft: 'Черновик',
          ready: 'Готово',
          submitted: 'Отправлено',
          approved: 'Одобрено',
          rejected: 'Отклонено',
          archived: 'В архиве'
        }
      : {
          draft: 'Draft',
          ready: 'Ready',
          submitted: 'Submitted',
          approved: 'Approved',
          rejected: 'Rejected',
          archived: 'Archived'
        };
  }

  function getTypeOptions() {
    return [
      ['template', t('Шаблон', 'Template')],
      ['theme', t('Тема', 'Theme')],
      ['pack', t('Пак', 'Pack')],
      ['widget', t('Виджет', 'Widget')],
      ['asset-pack', t('Пак ассетов', 'Asset Pack')],
      ['starter', t('Стартовый набор', 'Starter')]
    ];
  }
  let initialized = false;
  let unsubscribe = null;

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }


  function normalizeUiText(value) {
    const raw = String(value || '').trim();
    if (isRu() || !raw) return raw;
    const map = [
      ['Пакет без названия','Untitled package'],
      ['Копия','Copy'],
      ['Шаблон','Template'],
      ['Тема','Theme'],
      ['Пак','Pack'],
      ['Виджет','Widget'],
      ['Пак ассетов','Asset Pack'],
      ['Стартовый набор','Starter'],
      ['Черновик','Draft'],
      ['Готово','Ready'],
      ['Отправлено','Submitted'],
      ['Одобрено','Approved'],
      ['Отклонено','Rejected'],
      ['В архиве','Archived'],
      ['Как это работает','How it works'],
      ['Недавние пакеты','Recent Packages'],
      ['Начните с чистого класса пакета.','Start with a clean package class.'],
      ['Простой локальный рабочий поток автора.','Simple local-first creator flow.'],
      ['Создайте черновик пакета.','Create a package draft.'],
      ['Добавьте файлы, превью и совместимость.','Add files, preview, and compatibility.'],
      ['Проверьте, пометьте как готовый и отправьте на проверку в Каталог.','Validate, mark ready, and submit to Catalog review.'],
      ['Открыть','Open']
    ];
    let text = raw;
    for (const [ru,en] of map) text = text.split(ru).join(en);
    return text;
  }

  function normalizePackageTitle(value) {
    const text = String(value || '').trim();
    if (!text) return t('Пакет без названия', 'Untitled package');
    if (isRu()) return text;
    const map = {
      'Пакет без названия': 'Untitled package',
      'Пакет без названия Копия': 'Untitled package Copy',
      'Шаблон': 'Template',
      'Тема': 'Theme',
      'Пак': 'Pack',
      'Виджет': 'Widget',
      'Пак ассетов': 'Asset Pack',
      'Стартовый набор': 'Starter',
      'Черновик': 'Draft',
      'Готово': 'Ready',
      'Отправлено': 'Submitted',
      'Одобрено': 'Approved',
      'Отклонено': 'Rejected',
      'В архиве': 'Archived',
      'Открыть': 'Open'
    };
    let next = map[text] || text;
    next = normalizeUiText(next);
    return next;
  }

  function formatDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleString();
  }

  function getRoots() {
    return Array.from(document.querySelectorAll('[data-codehub-root]'));
  }

  function getStore() {
    return window.NSCodeHubStore || null;
  }

  function ensureInit() {
    if (initialized) return true;
    const store = getStore();
    if (!store) {
      console.warn('[NSCodeHubV1] store unavailable');
      return false;
    }

    bindRoots();
    unsubscribe = store.subscribe(renderAll);
    initialized = true;
    renderAll();
    return true;
  }

  window.addEventListener('irg:language-changed', renderAll);
  document.addEventListener('irg:language-changed', renderAll);

  function bindRoots() {
    getRoots().forEach(function (root) {
      if (root.dataset.codehubBound === 'true') return;
      root.dataset.codehubBound = 'true';
      root.addEventListener('click', handleRootClick);
      root.addEventListener('input', handleRootInput);
      root.addEventListener('change', handleRootChange);
    });
  }

  function setNotice(message) {
    uiState.notice = String(message || '');
    renderAll();
  }

  function clearNotice() {
    if (!uiState.notice) return;
    uiState.notice = '';
  }

  function getActiveItem() {
    const store = getStore();
    return store ? store.getActiveItem() : null;
  }

  function getItems() {
    const store = getStore();
    return store ? store.getAll() : [];
  }

  function getFilteredItems() {
    return getItems()
      .filter(function (item) {
        if (uiState.filterStatus !== 'all' && item.status !== uiState.filterStatus) return false;
        if (uiState.filterType !== 'all' && item.type !== uiState.filterType) return false;
        if (uiState.query) {
          const haystack = [item.title, item.type, item.version, item.description && item.description.short, item.author && item.author.name, (item.tags || []).join(' ')].join(' ').toLowerCase();
          if (!haystack.includes(uiState.query.toLowerCase())) return false;
        }
        return true;
      })
      .sort(function (a, b) {
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
  }

  function renderAll() {
    bindRoots();
    const store = getStore();
    if (!store) return;

    const counts = store.getCounts();
    const activeItem = store.getActiveItem();
    const filteredItems = getFilteredItems();

    getRoots().forEach(function (root) {
      const surface = root.getAttribute('data-codehub-surface') || 'workspace';
      root.innerHTML = renderSurface(surface, {
        counts: counts,
        activeItem: activeItem,
        filteredItems: filteredItems,
        allItems: getItems(),
        notice: uiState.notice
      });
    });
  }

  function renderSurface(surface, context) {
    const classes = ['ns-codehub-v1'];
    if (surface === 'cabinet') {
      classes.push('ns-codehub-v1--cabinet');
    } else {
      classes.push('ns-codehub-v1--workspace');
    }

    return [
      '<div class="' + classes.join(' ') + '" data-codehub-surface="' + escapeHtml(surface) + '">',
      renderSurfaceHead(surface),
      context.notice ? '<div class="ns-codehub-v1__notice">' + escapeHtml(context.notice) + '</div>' : '',
      renderSurfaceBody(surface, context),
      '</div>'
    ].join('');
  }

  function renderSurfaceHead(surface) {
    return [
      '<section class="panel-card ns-codehub-v1__hero">',
      '  <div class="ns-codehub-v1__hero-copy">',
      '    <div class="ns-codehub-v1__kicker">' + escapeHtml(t('Пространство автора', 'Creator Workspace')) + '</div>',
      '    <h3 class="ns-codehub-v1__brand" translate="no">CodeHub</h3>',
      '    <p>' + escapeHtml(t('Подготавливайте пакеты для Каталога, держите локальные черновики в порядке и переводите в путь публикации только проверенные элементы.', 'Prepare packages for Catalog, keep local drafts clean, and move only validated items into the publish path.')) + '</p>',
      '  </div>',
      '  <div class="ns-codehub-v1__hero-actions">',
      '    <button type="button" class="ns-codehub-v1__btn ns-codehub-v1__btn--primary" data-codehub-action="new-item">' + escapeHtml(t('Новый пакет', 'New Package')) + '</button>',
      surface === 'workspace'
        ? '    <button type="button" class="ns-codehub-v1__btn ns-codehub-v1__btn--muted" data-codehub-action="open-cabinet">' + escapeHtml(t('Открыть кабинет', 'Open Cabinet')) + '</button>'
        : '    <button type="button" class="ns-codehub-v1__btn ns-codehub-v1__btn--muted" data-codehub-action="open-workspace">' + escapeHtml(t('Открыть пространство', 'Open Workspace')) + '</button>',
      '  </div>',
      renderTopNav(),
      '</section>'
    ].join('');
  }

  function renderTopNav() {
    return [
      '<div class="ns-codehub-v1__topnav">',
      '  <button type="button" class="ns-codehub-v1__topnav-btn' + (uiState.view === VIEW_HOME ? ' is-active' : '') + '" data-codehub-nav="home">' + escapeHtml(t('Главная', 'Home')) + '</button>',
      '  <button type="button" class="ns-codehub-v1__topnav-btn' + (uiState.view === VIEW_LIST ? ' is-active' : '') + '" data-codehub-nav="list">' + escapeHtml(t('Мои пакеты', 'My Packages')) + '</button>',
      '  <button type="button" class="ns-codehub-v1__topnav-btn' + (uiState.view === VIEW_RULES ? ' is-active' : '') + '" data-codehub-nav="rules">' + escapeHtml(t('Правила отправки', 'Submission Rules')) + '</button>',
      '</div>'
    ].join('');
  }

  function renderSurfaceBody(surface, context) {
    if (uiState.view === VIEW_LIST) return renderListView(surface, context);
    if (uiState.view === VIEW_BUILDER) return renderBuilderView(surface, context);
    if (uiState.view === VIEW_RULES) return renderRulesView(surface, context);
    return renderHomeView(surface, context);
  }

  function renderHomeView(surface, context) {
    const counts = context.counts;
    const recent = context.allItems.slice().sort(function (a, b) {
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    }).slice(0, surface === 'workspace' ? 4 : 6);

    return [
      '<div class="ns-codehub-v1__grid ns-codehub-v1__grid--home">',
      '  <section class="panel-card ns-codehub-v1__summary">',
      '    <div class="ns-codehub-v1__summary-card"><span>' + escapeHtml(t('Пакеты', 'Packages')) + '</span><strong>' + counts.all + '</strong></div>',
      '    <div class="ns-codehub-v1__summary-card"><span>' + escapeHtml(t('Черновики', 'Drafts')) + '</span><strong>' + counts.draft + '</strong></div>',
      '    <div class="ns-codehub-v1__summary-card"><span>' + escapeHtml(t('Готово', 'Ready')) + '</span><strong>' + counts.ready + '</strong></div>',
      '    <div class="ns-codehub-v1__summary-card"><span>' + escapeHtml(t('Отправлено', 'Submitted')) + '</span><strong>' + counts.submitted + '</strong></div>',
      '  </section>',
      '  <section class="panel-card ns-codehub-v1__panel">',
      '    <div class="ns-codehub-v1__panel-head"><h4>' + escapeHtml(t('Недавние пакеты', 'Recent Packages')) + '</h4><button type="button" class="ns-codehub-v1__inline-btn" data-codehub-nav="list">' + escapeHtml(t('Открыть список', 'Open list')) + '</button></div>',
      renderRecentList(recent),
      '  </section>',
      '  <section class="panel-card ns-codehub-v1__panel">',
      '    <div class="ns-codehub-v1__panel-head"><h4>' + escapeHtml(t('Типы пакетов', 'Package Types')) + '</h4><span>' + escapeHtml(t('Начните с чистого класса пакета.', 'Start with a clean package class.')) + '</span></div>',
      '    <div class="ns-codehub-v1__type-grid">',
      getTypeOptions().map(function (pair) {
        return [
          '<button type="button" class="ns-codehub-v1__type-card" data-codehub-action="new-item" data-codehub-type="' + pair[0] + '">',
          '  <strong>' + pair[1] + '</strong>',
          '  <span>' + getTypeHelp(pair[0]) + '</span>',
          '</button>'
        ].join('');
      }).join(''),
      '    </div>',
      '  </section>',
      '  <section class="panel-card ns-codehub-v1__panel">',
      '    <div class="ns-codehub-v1__panel-head"><h4>' + escapeHtml(t('Как это работает', 'How it works')) + '</h4><span>' + escapeHtml(t('Простой локальный рабочий поток автора.', 'Simple local-first creator flow.')) + '</span></div>',
      '    <div class="ns-codehub-v1__flow">',
      '      <div class="ns-codehub-v1__flow-step"><strong>1</strong><span>' + escapeHtml(t('Создайте черновик пакета.', 'Create a package draft.')) + '</span></div>',
      '      <div class="ns-codehub-v1__flow-step"><strong>2</strong><span>' + escapeHtml(t('Добавьте файлы, превью и совместимость.', 'Add files, preview, and compatibility.')) + '</span></div>',
      '      <div class="ns-codehub-v1__flow-step"><strong>3</strong><span>' + escapeHtml(t('Проверьте, пометьте как готовый и отправьте на проверку в Каталог.', 'Validate, mark ready, and submit to Catalog review.')) + '</span></div>',
      '    </div>',
      '  </section>',
      '</div>'
    ].join('');
  }

  function renderRecentList(items) {
    if (!items.length) {
      return '<div class="ns-codehub-v1__empty">' + escapeHtml(t('Пакетов пока нет. Создайте первый черновик через «Новый пакет».', 'No packages yet. Create the first draft from New Package.')) + '</div>';
    }

    return [
      '<div class="ns-codehub-v1__recent-list">',
      items.map(function (item) {
        return [
          '<div class="ns-codehub-v1__recent-row">',
          '  <div class="ns-codehub-v1__recent-copy">',
          '    <strong>' + escapeHtml(normalizePackageTitle(item.title || t('Пакет без названия', 'Untitled package'))) + '</strong>',
          '    <span>' + escapeHtml(normalizeUiText([getTypeLabel(item.type), getStatusLabels()[item.status] || item.status, item.version].filter(Boolean).join(' · '))) + '</span>',
          '  </div>',
          '  <div class="ns-codehub-v1__recent-actions">',
          '    <button type="button" class="ns-codehub-v1__inline-btn" data-codehub-action="open-item" data-codehub-id="' + escapeHtml(item.id) + '">' + escapeHtml(t('Открыть', 'Open')) + '</button>',
          '    <button type="button" class="ns-codehub-v1__inline-btn ns-codehub-v1__inline-btn--danger" data-codehub-action="delete-item" data-codehub-id="' + escapeHtml(item.id) + '">' + escapeHtml(t('Удалить', 'Delete')) + '</button>',
          '  </div>',
          '</div>'
        ].join('');
      }).join(''),
      '</div>'
    ].join('');
  }

  function renderListView(surface, context) {
    return [
      '<section class="panel-card ns-codehub-v1__panel">',
      '  <div class="ns-codehub-v1__panel-head"><h4>' + escapeHtml(t('Мои пакеты', 'My Packages')) + '</h4><span>' + escapeHtml(t('Локальный список пакетов для подготовки к Каталогу.', 'Local-first package list for Catalog preparation.')) + '</span></div>',
      '  <div class="ns-codehub-v1__toolbar">',
      '    <input class="ns-codehub-v1__input ns-codehub-v1__search" type="text" placeholder="' + escapeHtml(t('Поиск пакетов...', 'Search packages...')) + '" data-codehub-filter="query" value="' + escapeHtml(uiState.query) + '">',
      '    <select class="ns-codehub-v1__select" data-codehub-filter="status">',
      renderSelectOptions([['all', t('Все статусы', 'All statuses')]].concat(Object.keys(getStatusLabels()).map(function (key) { return [key, getStatusLabels()[key]]; })), uiState.filterStatus),
      '    </select>',
      '    <select class="ns-codehub-v1__select" data-codehub-filter="type">',
      renderSelectOptions([['all', t('Все типы', 'All types')]].concat(getTypeOptions()), uiState.filterType),
      '    </select>',
      '  </div>',
      renderPackageList(context.filteredItems, surface),
      '</section>'
    ].join('');
  }

  function renderPackageList(items, surface) {
    if (!items.length) {
      return '<div class="ns-codehub-v1__empty">' + escapeHtml(t('По текущим фильтрам пакеты не найдены.', 'No packages match the current filters.')) + '</div>';
    }

    return [
      '<div class="ns-codehub-v1__list">',
      items.map(function (item) {
        return renderPackageCard(item, surface);
      }).join(''),
      '</div>'
    ].join('');
  }

  function renderPackageCard(item) {
    return [
      '<article class="ns-codehub-v1__card">',
      '  <div class="ns-codehub-v1__card-head">',
      '    <div>',
      '      <div class="ns-codehub-v1__card-kicker">' + escapeHtml(getTypeLabel(item.type)) + ' · ' + escapeHtml(item.version) + '</div>',
      '      <h5>' + escapeHtml(normalizePackageTitle(item.title || t('Пакет без названия', 'Untitled package'))) + '</h5>',
      '    </div>',
      '    <div class="ns-codehub-v1__badge-row">',
      '      <span class="ns-codehub-v1__badge">' + escapeHtml(getStatusLabels()[item.status] || item.status) + '</span>',
      '      <span class="ns-codehub-v1__badge ns-codehub-v1__badge--muted">' + escapeHtml(item.trust) + '</span>',
      '    </div>',
      '  </div>',
      '  <p class="ns-codehub-v1__card-copy">' + escapeHtml(item.description && item.description.short ? item.description.short : getBuilderNoDescription()) + '</p>',
      '  <div class="ns-codehub-v1__card-meta">' + escapeHtml(t('Обновлено', 'Updated')) + ' ' + escapeHtml(formatDate(item.updatedAt)) + '</div>',
      '  <div class="ns-codehub-v1__card-tags">' + renderTags(item.tags) + '</div>',
      '  <div class="ns-codehub-v1__card-actions">',
      '    <button type="button" class="ns-codehub-v1__btn ns-codehub-v1__btn--primary" data-codehub-action="open-item" data-codehub-id="' + escapeHtml(item.id) + '">' + escapeHtml(t('Открыть', 'Open')) + '</button>',
      '    <button type="button" class="ns-codehub-v1__btn" data-codehub-action="duplicate-item" data-codehub-id="' + escapeHtml(item.id) + '">' + escapeHtml(t('Дублировать', 'Duplicate')) + '</button>',
      item.status === 'archived'
        ? '    <button type="button" class="ns-codehub-v1__btn" data-codehub-action="restore-item" data-codehub-id="' + escapeHtml(item.id) + '">' + escapeHtml(t('Восстановить', 'Restore')) + '</button>'
        : '    <button type="button" class="ns-codehub-v1__btn" data-codehub-action="archive-item" data-codehub-id="' + escapeHtml(item.id) + '">' + escapeHtml(t('В архив', 'Archive')) + '</button>',
      '    <button type="button" class="ns-codehub-v1__btn ns-codehub-v1__btn--danger" data-codehub-action="delete-item" data-codehub-id="' + escapeHtml(item.id) + '">' + escapeHtml(t('Удалить', 'Delete')) + '</button>',
      '  </div>',
      '</article>'
    ].join('');
  }

  function renderBuilderView(surface, context) {
    const item = context.activeItem;
    if (!item) {
      return [
        '<section class="panel-card ns-codehub-v1__panel">',
        '  <div class="ns-codehub-v1__empty">' + escapeHtml(t('Активного пакета пока нет. Создайте его, чтобы открыть конструктор.', 'No active package yet. Create one to open the builder.')) + '</div>',
        '</section>'
      ].join('');
    }

    const validation = getStore().validateItem(item.id);

    return [
      '<div class="ns-codehub-v1__grid ns-codehub-v1__grid--builder">',
      '  <section class="panel-card ns-codehub-v1__builder-shell">',
      '    <div class="ns-codehub-v1__panel-head">',
      '      <div><h4>' + escapeHtml(normalizePackageTitle(item.title)) + '</h4><span>' + escapeHtml(getTypeLabel(item.type)) + ' · ' + escapeHtml(item.version) + '</span></div>',
      '      <div class="ns-codehub-v1__builder-head-actions">',
      '        <button type="button" class="ns-codehub-v1__btn" data-codehub-nav="list">' + escapeHtml(t('Назад к списку', 'Back to list')) + '</button>',
      '        <button type="button" class="ns-codehub-v1__btn ns-codehub-v1__btn--primary" data-codehub-action="save-draft" data-codehub-id="' + escapeHtml(item.id) + '">' + escapeHtml(t('Сохранить черновик', 'Save draft')) + '</button>',
      '      </div>',
      '    </div>',
      renderBuilderTabs(),
      renderBuilderTab(item, validation),
      '  </section>',
      surface === 'cabinet' ? renderBuilderSideSummary(item, validation) : '',
      '</div>'
    ].join('');
  }

  function renderBuilderTabs() {
    return [
      '<div class="ns-codehub-v1__builder-tabs">',
      BUILDER_TABS.map(function (tab) {
        return '<button type="button" class="ns-codehub-v1__builder-tab' + (uiState.builderTab === tab ? ' is-active' : '') + '" data-codehub-builder-tab="' + tab + '">' + escapeHtml(getBuilderTabLabel(tab)) + '</button>';
      }).join(''),
      '</div>'
    ].join('');
  }

  function renderBuilderSideSummary(item, validation) {
    return [
      '<aside class="panel-card ns-codehub-v1__side">',
      '  <div class="ns-codehub-v1__panel-head"><h4>' + escapeHtml(t('Кратко', 'At a glance')) + '</h4><span>' + escapeHtml(t('Живой статус пакета', 'Live package status')) + '</span></div>',
      '  <div class="ns-codehub-v1__side-row"><strong>' + escapeHtml(t('Статус', 'Status')) + '</strong><span>' + escapeHtml(getStatusLabels()[item.status] || item.status) + '</span></div>',
      '  <div class="ns-codehub-v1__side-row"><strong>' + escapeHtml(t('Доверие', 'Trust')) + '</strong><span>' + escapeHtml(item.trust) + '</span></div>',
      '  <div class="ns-codehub-v1__side-row"><strong>' + escapeHtml(t('Файлы', 'Files')) + '</strong><span>' + item.files.length + '</span></div>',
      '  <div class="ns-codehub-v1__side-row"><strong>' + escapeHtml(t('Проверка', 'Validation')) + '</strong><span>' + escapeHtml(getValidationStateLabel(validation)) + '</span></div>',
      '  <div class="ns-codehub-v1__side-row"><strong>' + escapeHtml(t('Обновлено', 'Updated')) + '</strong><span>' + escapeHtml(formatDate(item.updatedAt)) + '</span></div>',
      '</aside>'
    ].join('');
  }

  function renderBuilderTab(item, validation) {
    if (uiState.builderTab === 'details') return renderDetailsTab(item);
    if (uiState.builderTab === 'files') return renderFilesTab(item);
    if (uiState.builderTab === 'preview') return renderPreviewTab(item);
    if (uiState.builderTab === 'compatibility') return renderCompatibilityTab(item);
    if (uiState.builderTab === 'validation') return renderValidationTab(item, validation);
    if (uiState.builderTab === 'submit') return renderSubmitTab(item, validation);
    return renderOverviewTab(item, validation);
  }

  function renderOverviewTab(item, validation) {
    return [
      '<div class="ns-codehub-v1__section">',
      '  <div class="ns-codehub-v1__overview-grid">',
      '    <div class="ns-codehub-v1__overview-card"><span>' + escapeHtml(t('Тип', 'Type')) + '</span><strong>' + escapeHtml(getTypeLabel(item.type)) + '</strong></div>',
      '    <div class="ns-codehub-v1__overview-card"><span>' + escapeHtml(t('Статус', 'Status')) + '</span><strong>' + escapeHtml(getStatusLabels()[item.status] || item.status) + '</strong></div>',
      '    <div class="ns-codehub-v1__overview-card"><span>' + escapeHtml(t('Файлы', 'Files')) + '</span><strong>' + item.files.length + '</strong></div>',
      '    <div class="ns-codehub-v1__overview-card"><span>' + escapeHtml(t('Проверка', 'Validation')) + '</span><strong>' + escapeHtml(getValidationSummaryLabel(validation)) + '</strong></div>',
      '  </div>',
      '  <div class="ns-codehub-v1__overview-note">',
      '    <strong>' + escapeHtml(t('Краткое описание', 'Short description')) + '</strong>',
      '    <p>' + escapeHtml(item.description && item.description.short ? item.description.short : getBuilderNoDescription()) + '</p>',
      '  </div>',
      '  <div class="ns-codehub-v1__actions">',
      '    <button type="button" class="ns-codehub-v1__btn" data-codehub-action="validate-item" data-codehub-id="' + escapeHtml(item.id) + '">' + escapeHtml(t('Проверить пакет', 'Validate package')) + '</button>',
      '    <button type="button" class="ns-codehub-v1__btn" data-codehub-action="mark-ready" data-codehub-id="' + escapeHtml(item.id) + '">' + escapeHtml(t('Пометить как готовый', 'Mark ready')) + '</button>',
      '    <button type="button" class="ns-codehub-v1__btn ns-codehub-v1__btn--primary" data-codehub-action="submit-item" data-codehub-id="' + escapeHtml(item.id) + '">' + escapeHtml(t('Отправить в Каталог', 'Submit to Catalog')) + '</button>',
      '    <button type="button" class="ns-codehub-v1__btn ns-codehub-v1__btn--danger" data-codehub-action="delete-item" data-codehub-id="' + escapeHtml(item.id) + '">' + escapeHtml(t('Удалить', 'Delete')) + '</button>',
      '  </div>',
      '</div>'
    ].join('');
  }

  function renderDetailsTab(item) {
    return [
      '<div class="ns-codehub-v1__section">',
      '  <div class="ns-codehub-v1__field-grid two-up">',
      renderField(t('Название пакета', 'Package title'), '<input class="ns-codehub-v1__input" type="text" data-codehub-field="title" data-codehub-id="' + escapeHtml(item.id) + '" value="' + escapeHtml(normalizePackageTitle(item.title)) + '">'),
      renderField(t('Тип', 'Type'), '<select class="ns-codehub-v1__select" data-codehub-field="type" data-codehub-id="' + escapeHtml(item.id) + '">' + renderSelectOptions(getTypeOptions(), item.type) + '</select>'),
      renderField(t('Автор', 'Author'), '<input class="ns-codehub-v1__input" type="text" data-codehub-field="author.name" data-codehub-id="' + escapeHtml(item.id) + '" value="' + escapeHtml(item.author && item.author.name) + '">'),
      renderField(t('Версия', 'Version'), '<input class="ns-codehub-v1__input" type="text" data-codehub-field="version" data-codehub-id="' + escapeHtml(item.id) + '" value="' + escapeHtml(item.version) + '">'),
      '  </div>',
      renderField(t('Краткое описание', 'Short description'), '<textarea class="ns-codehub-v1__textarea" rows="3" data-codehub-field="description.short" data-codehub-id="' + escapeHtml(item.id) + '">' + escapeHtml(item.description && item.description.short) + '</textarea>'),
      renderField(t('Полное описание', 'Full description'), '<textarea class="ns-codehub-v1__textarea" rows="6" data-codehub-field="description.full" data-codehub-id="' + escapeHtml(item.id) + '">' + escapeHtml(item.description && item.description.full) + '</textarea>'),
      renderField(t('Теги', 'Tags'), '<input class="ns-codehub-v1__input" type="text" data-codehub-field="tags" data-codehub-id="' + escapeHtml(item.id) + '" value="' + escapeHtml((item.tags || []).join(', ')) + '" placeholder="' + escapeHtml(t('новости, редактура, минимализм', 'news, editorial, minimal')) + '">'),
      '</div>'
    ].join('');
  }

  function renderFilesTab(item) {
    return [
      '<div class="ns-codehub-v1__section">',
      '  <div class="ns-codehub-v1__panel-head compact"><h4>' + escapeHtml(t('Файлы', 'Files')) + '</h4><span>' + escapeHtml(t('Пока только метаданные для v1. Сначала безопасная структура пакета.', 'Only metadata in v1 for now. Start with a safe package structure.')) + '</span></div>',
      '  <div class="ns-codehub-v1__actions">',
      '    <label class="ns-codehub-v1__upload"><input type="file" multiple data-codehub-files-input data-codehub-id="' + escapeHtml(item.id) + '" hidden><span>' + escapeHtml(t('Добавить файлы', 'Add files')) + '</span></label>',
      '  </div>',
      item.files.length ? [
        '<div class="ns-codehub-v1__file-list">',
        item.files.map(function (file) {
          return [
            '<div class="ns-codehub-v1__file-row">',
            '  <div class="ns-codehub-v1__file-copy">',
            '    <strong>' + escapeHtml(file.path) + '</strong>',
            '    <span>' + escapeHtml([file.kind, file.size ? formatBytes(file.size) : '0 B'].join(' · ')) + '</span>',
            '  </div>',
            '  <div class="ns-codehub-v1__file-actions">',
            '    <select class="ns-codehub-v1__select compact" data-codehub-file-role data-codehub-id="' + escapeHtml(item.id) + '" data-codehub-file-id="' + escapeHtml(file.id) + '">',
            renderSelectOptions([
              ['main', 'Основной'],
              ['style', 'Стиль'],
              ['template', 'Шаблон'],
              ['asset', 'Ассет'],
              ['cover', 'Обложка'],
              ['preview', 'Превью'],
              ['data', 'Данные']
            ], file.role),
            '    </select>',
            '    <button type="button" class="ns-codehub-v1__btn" data-codehub-action="remove-file" data-codehub-id="' + escapeHtml(item.id) + '" data-codehub-file-id="' + escapeHtml(file.id) + '">' + escapeHtml(t('Убрать', 'Remove')) + '</button>',
            '  </div>',
            '</div>'
          ].join('');
        }).join(''),
        '</div>'
      ].join('') : '<div class="ns-codehub-v1__empty">' + escapeHtml(t('Файлов пока нет. Позже добавьте хотя бы один основной файл и одно превью обложки.', 'No files yet. Later add at least one main file and one preview cover.')) + '</div>',
      '</div>'
    ].join('');
  }

  function renderPreviewTab(item) {
    return [
      '<div class="ns-codehub-v1__section">',
      renderField(t('Обложка', 'Cover'), '<input class="ns-codehub-v1__input" type="text" data-codehub-field="preview.cover" data-codehub-id="' + escapeHtml(item.id) + '" value="' + escapeHtml(item.preview && item.preview.cover) + '" placeholder="preview/cover.png">'),
      renderField(t('Галерея', 'Gallery'), '<textarea class="ns-codehub-v1__textarea" rows="4" data-codehub-field="preview.gallery" data-codehub-id="' + escapeHtml(item.id) + '" placeholder="preview/screen-1.png&#10;preview/screen-2.png">' + escapeHtml((item.preview && item.preview.gallery || []).join('\n')) + '</textarea>'),
      renderField(t('Заметка к превью', 'Preview note'), '<textarea class="ns-codehub-v1__textarea" rows="3" data-codehub-field="preview.note" data-codehub-id="' + escapeHtml(item.id) + '">' + escapeHtml(item.preview && item.preview.note) + '</textarea>'),
      renderField(t('Поверхность превью', 'Preview surface'), '<input class="ns-codehub-v1__input" type="text" data-codehub-field="preview.surface" data-codehub-id="' + escapeHtml(item.id) + '" value="' + escapeHtml(item.preview && item.preview.surface) + '" placeholder="editor">'),
      '</div>'
    ].join('');
  }

  function renderCompatibilityTab(item) {
    return [
      '<div class="ns-codehub-v1__section">',
      '  <div class="ns-codehub-v1__field-grid two-up">',
      renderField(t('NS Browser', 'NS Browser'), '<input class="ns-codehub-v1__input" type="text" data-codehub-field="compatibility.nsBrowser" data-codehub-id="' + escapeHtml(item.id) + '" value="' + escapeHtml(item.compatibility && item.compatibility.nsBrowser) + '">'),
      renderField(t('Минимальная версия приложения', 'Minimum app version'), '<input class="ns-codehub-v1__input" type="text" data-codehub-field="compatibility.minAppVersion" data-codehub-id="' + escapeHtml(item.id) + '" value="' + escapeHtml(item.compatibility && item.compatibility.minAppVersion) + '">'),
      '  </div>',
      renderField(t('Целевой модуль', 'Target module'), '<input class="ns-codehub-v1__input" type="text" data-codehub-field="compatibility.moduleTarget" data-codehub-id="' + escapeHtml(item.id) + '" value="' + escapeHtml((item.compatibility && item.compatibility.moduleTarget || []).join(', ')) + '" placeholder="catalog, editor">'),
      renderField(t('Поверхность', 'Surface'), '<input class="ns-codehub-v1__input" type="text" data-codehub-field="compatibility.surface" data-codehub-id="' + escapeHtml(item.id) + '" value="' + escapeHtml((item.compatibility && item.compatibility.surface || []).join(', ')) + '" placeholder="workspace, cabinet">'),
      '</div>'
    ].join('');
  }

  function renderValidationTab(item, validation) {
    return [
      '<div class="ns-codehub-v1__section">',
      '  <div class="ns-codehub-v1__actions">',
      '    <button type="button" class="ns-codehub-v1__btn" data-codehub-action="validate-item" data-codehub-id="' + escapeHtml(item.id) + '">' + escapeHtml(t('Запустить проверку', 'Run validation')) + '</button>',
      '    <button type="button" class="ns-codehub-v1__btn" data-codehub-action="mark-ready" data-codehub-id="' + escapeHtml(item.id) + '">' + escapeHtml(t('Пометить как готовый', 'Mark ready')) + '</button>',
      '  </div>',
      renderValidationResult(validation),
      '</div>'
    ].join('');
  }

  function renderSubmitTab(item, validation) {
    return [
      '<div class="ns-codehub-v1__section">',
      '  <div class="ns-codehub-v1__submit-card">',
      '    <h4>' + escapeHtml(t('Отправка в Каталог', 'Catalog submission')) + '</h4>',
      '    <p>' + escapeHtml(t('В v1 отправка локальная. Пакет проверяется, помечается как отправленный и остаётся готовым для более позднего процесса ревью.', 'In v1 submission stays local. The package is validated, marked submitted, and remains ready for a later review flow.')) + '</p>',
      '    <div class="ns-codehub-v1__submit-meta">',
      '      <span><strong>' + escapeHtml(t('Название', 'Title')) + ':</strong> ' + escapeHtml(normalizePackageTitle(item.title)) + '</span>',
      '      <span><strong>' + escapeHtml(t('Статус', 'Status')) + ':</strong> ' + escapeHtml(getStatusLabels()[item.status] || item.status) + '</span>',
      '      <span><strong>' + escapeHtml(t('Проверка', 'Validation')) + ':</strong> ' + escapeHtml(getValidationStateLabel(validation)) + '</span>',
      '    </div>',
      '    <div class="ns-codehub-v1__actions">',
      '      <button type="button" class="ns-codehub-v1__btn" data-codehub-action="validate-item" data-codehub-id="' + escapeHtml(item.id) + '">' + escapeHtml(t('Проверить снова', 'Validate again')) + '</button>',
      '      <button type="button" class="ns-codehub-v1__btn ns-codehub-v1__btn--primary" data-codehub-action="submit-item" data-codehub-id="' + escapeHtml(item.id) + '">' + escapeHtml(t('Отправить в Каталог', 'Submit to Catalog')) + '</button>',
      '    </div>',
      renderValidationResult(validation),
      '  </div>',
      '</div>'
    ].join('');
  }

  function renderRulesView() {
    return [
      '<section class="panel-card ns-codehub-v1__panel">',
      '  <div class="ns-codehub-v1__panel-head"><h4>' + escapeHtml(t('Правила отправки', 'Submission Rules')) + '</h4><span>' + escapeHtml(t('Пока это справочный раздел v1: он объясняет поток и требования, но ещё не запускает отдельные действия.', 'This is a reference-only v1 section for now: it explains the flow and requirements, but does not trigger separate actions yet.')) + '</span></div>',
      '  <div class="ns-codehub-v1__rules-grid">',
      '    <div class="ns-codehub-v1__rule-card"><strong>' + escapeHtml(t('Разрешённые типы пакетов', 'Allowed package types')) + '</strong><span>' + escapeHtml(t('Шаблон · Тема · Пак · Виджет · Пак ассетов · Стартовый набор', 'Template · Theme · Pack · Widget · Asset Pack · Starter')) + '</span></div>',
      '    <div class="ns-codehub-v1__rule-card"><strong>' + escapeHtml(t('Обязательные поля', 'Required fields')) + '</strong><span>' + escapeHtml(t('Название, версия, автор, краткое описание, превью обложки и хотя бы один файл.', 'Title, version, author, short description, preview cover, and at least one file.')) + '</span></div>',
      '    <div class="ns-codehub-v1__rule-card"><strong>' + escapeHtml(t('Безопасность v1', 'v1 safety')) + '</strong><span>' + escapeHtml(t('Держите пакеты пассивными и структурированными. В первом релизе — без тяжёлого произвольного кода.', 'Keep packages passive and structured. In the first release, avoid heavy arbitrary code.')) + '</span></div>',
      '    <div class="ns-codehub-v1__rule-card"><strong>' + escapeHtml(t('Поток статусов', 'Status flow')) + '</strong><span>' + escapeHtml(t('Черновик → Готово → Отправлено. Поток одобрения и ревью появится позже.', 'Draft → Ready → Submitted. Approval and review flow come later.')) + '</span></div>',
      '  </div>',
      '</section>'
    ].join('');
  }

  function renderValidationResult(validation) {
    return [
      '<div class="ns-codehub-v1__validation ' + (validation.isReady ? 'is-passed' : 'is-failed') + '">',
      '  <div class="ns-codehub-v1__validation-head"><strong>' + escapeHtml(validation.isReady ? t('Проверка пройдена', 'Validation passed') : t('Проверке нужно внимание', 'Validation needs attention')) + '</strong></div>',
      validation.errors.length
        ? '<div class="ns-codehub-v1__validation-group"><span>' + escapeHtml(t('Ошибки', 'Errors')) + '</span><ul>' + validation.errors.map(function (error) { return '<li>' + escapeHtml(error) + '</li>'; }).join('') + '</ul></div>'
        : '<div class="ns-codehub-v1__validation-group"><span>' + escapeHtml(t('Ошибки', 'Errors')) + '</span><p>' + escapeHtml(t('Блокирующих ошибок нет.', 'No blocking errors.')) + '</p></div>',
      validation.warnings.length
        ? '<div class="ns-codehub-v1__validation-group"><span>' + escapeHtml(t('Предупреждения', 'Warnings')) + '</span><ul>' + validation.warnings.map(function (warning) { return '<li>' + escapeHtml(warning) + '</li>'; }).join('') + '</ul></div>'
        : '<div class="ns-codehub-v1__validation-group"><span>' + escapeHtml(t('Предупреждения', 'Warnings')) + '</span><p>' + escapeHtml(t('Предупреждений нет.', 'No warnings.')) + '</p></div>',
      '</div>'
    ].join('');
  }

  function renderField(label, control) {
    return [
      '<label class="ns-codehub-v1__field">',
      '  <span>' + escapeHtml(label) + '</span>',
      '  ' + control,
      '</label>'
    ].join('');
  }

  function renderTags(tags) {
    if (!tags || !tags.length) {
      return '<span class="ns-codehub-v1__tag ns-codehub-v1__tag--muted">' + escapeHtml(t('Без тегов', 'No tags')) + '</span>';
    }

    return tags.slice(0, 4).map(function (tag) {
      return '<span class="ns-codehub-v1__tag">' + escapeHtml(tag) + '</span>';
    }).join('');
  }

  function renderSelectOptions(options, currentValue) {
    return options.map(function (option) {
      const value = option[0];
      const label = option[1];
      return '<option value="' + escapeHtml(value) + '"' + (currentValue === value ? ' selected' : '') + '>' + escapeHtml(label) + '</option>';
    }).join('');
  }

  function getTypeLabel(type) {
    const found = getTypeOptions().find(function (pair) {
      return pair[0] === type;
    });
    return found ? found[1] : t('Пакет', 'Package');
  }

  function getBuilderTabLabel(tab) {
    const labels = {
      overview: t('Обзор', 'Overview'),
      details: t('Детали', 'Details'),
      files: t('Файлы', 'Files'),
      preview: t('Превью', 'Preview'),
      compatibility: t('Совместимость', 'Compatibility'),
      validation: t('Проверка', 'Validation'),
      submit: t('Отправка', 'Submit')
    };
    return labels[tab] || tab;
  }

  function getValidationStateLabel(validation) {
    return validation && validation.isReady
      ? t('Пройдено', 'Passed')
      : String((validation && validation.errors ? validation.errors.length : 0)) + ' ' + t('ошибок', 'errors');
  }

  function getValidationSummaryLabel(validation) {
    return validation && validation.isReady
      ? t('Готово', 'Ready')
      : t('Нужно доработать', 'Needs work');
  }

  function getBuilderNoDescription() {
    return t('Краткое описание пока не добавлено.', 'No short description yet.');
  }

  function getTypeHelp(type) {
    const map = isRu()
      ? {
          template: 'Готовая страница или структура публикации.',
          theme: 'Визуальный язык, цвета и представление интерфейса.',
          pack: 'Сгруппированные блоки и переиспользуемые части пакета.',
          widget: 'Небольшой точечный UI-модуль для целевой поверхности.',
          'asset-pack': 'Иконки, обложки и вспомогательная графика.',
          starter: 'Стартовый набор для конкретного пути публикации.'
        }
      : {
          template: 'Ready page or publication structure.',
          theme: 'Visual language, colors, and interface presentation.',
          pack: 'Grouped blocks and reusable package parts.',
          widget: 'Small focused UI module for a target surface.',
          'asset-pack': 'Icons, covers, and supporting graphics.',
          starter: 'Starter bundle for a specific publish path.'
        };
    return map[type] || t('Элемент пакета для будущего использования в Каталоге.', 'Package item for later use in Catalog.');
  }

  function formatBytes(bytes) {
    const value = Number(bytes || 0);
    if (value < 1024) return value + ' B';
    if (value < 1024 * 1024) return (value / 1024).toFixed(1) + ' KB';
    return (value / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function handleRootClick(event) {
    const actionButton = event.target.closest('[data-codehub-action]');
    if (actionButton) {
      handleAction(actionButton);
      return;
    }

    const navButton = event.target.closest('[data-codehub-nav]');
    if (navButton) {
      uiState.view = navButton.getAttribute('data-codehub-nav') || VIEW_HOME;
      clearNotice();
      renderAll();
      return;
    }

    const builderTabButton = event.target.closest('[data-codehub-builder-tab]');
    if (builderTabButton) {
      uiState.builderTab = builderTabButton.getAttribute('data-codehub-builder-tab') || 'overview';
      clearNotice();
      renderAll();
    }
  }

  function handleRootInput(event) {
    const field = event.target.closest('[data-codehub-field]');
    if (field) {
      applyFieldUpdate(field);
      return;
    }

    const queryField = event.target.closest('[data-codehub-filter="query"]');
    if (queryField) {
      uiState.query = String(queryField.value || '');
      renderAll();
    }
  }

  function handleRootChange(event) {
    const field = event.target.closest('[data-codehub-field]');
    if (field) {
      applyFieldUpdate(field);
      return;
    }

    const statusFilter = event.target.closest('[data-codehub-filter="status"]');
    if (statusFilter) {
      uiState.filterStatus = String(statusFilter.value || 'all');
      renderAll();
      return;
    }

    const typeFilter = event.target.closest('[data-codehub-filter="type"]');
    if (typeFilter) {
      uiState.filterType = String(typeFilter.value || 'all');
      renderAll();
      return;
    }

    const filesInput = event.target.closest('[data-codehub-files-input]');
    if (filesInput) {
      handleFilesInput(filesInput);
      return;
    }

    const fileRole = event.target.closest('[data-codehub-file-role]');
    if (fileRole) {
      updateFileRole(fileRole);
    }
  }

  function applyFieldUpdate(field) {
    const store = getStore();
    if (!store) return;

    const itemId = field.getAttribute('data-codehub-id');
    const fieldKey = field.getAttribute('data-codehub-field');
    if (!itemId || !fieldKey) return;

    const item = store.getById(itemId);
    if (!item) return;

    const value = field.value;
    const patch = {};

    switch (fieldKey) {
      case 'title':
      case 'type':
      case 'version':
        patch[fieldKey] = value;
        break;
      case 'author.name':
        patch.author = { name: value };
        break;
      case 'description.short':
        patch.description = { short: value };
        break;
      case 'description.full':
        patch.description = { full: value };
        break;
      case 'tags':
        patch.tags = value.split(',').map(function (tag) { return tag.trim(); }).filter(Boolean);
        break;
      case 'preview.cover':
        patch.preview = { cover: value };
        break;
      case 'preview.gallery':
        patch.preview = { gallery: value.split(/\r?\n|,/g).map(function (entry) { return entry.trim(); }).filter(Boolean) };
        break;
      case 'preview.note':
        patch.preview = { note: value };
        break;
      case 'preview.surface':
        patch.preview = { surface: value };
        break;
      case 'compatibility.nsBrowser':
        patch.compatibility = { nsBrowser: value };
        break;
      case 'compatibility.minAppVersion':
        patch.compatibility = { minAppVersion: value };
        break;
      case 'compatibility.moduleTarget':
        patch.compatibility = { moduleTarget: value.split(',').map(function (entry) { return entry.trim(); }).filter(Boolean) };
        break;
      case 'compatibility.surface':
        patch.compatibility = { surface: value.split(',').map(function (entry) { return entry.trim(); }).filter(Boolean) };
        break;
      default:
        return;
    }

    store.updateItem(itemId, patch);
  }

  function handleFilesInput(input) {
    const store = getStore();
    if (!store) return;
    const itemId = input.getAttribute('data-codehub-id');
    if (!itemId) return;
    const item = store.getById(itemId);
    if (!item) return;

    const picked = Array.from(input.files || []);
    if (!picked.length) return;

    const nextFiles = item.files.slice();
    picked.forEach(function (file, index) {
      nextFiles.push({
        id: 'file_' + Date.now() + '_' + index + '_' + Math.random().toString(36).slice(2, 6),
        path: file.name,
        role: nextFiles.length === 0 ? 'main' : (/cover/i.test(file.name) ? 'cover' : 'asset'),
        kind: guessKind(file.name, file.type),
        size: file.size,
        mime: file.type,
        order: nextFiles.length
      });
    });

    store.setFiles(itemId, nextFiles);
    input.value = '';
    setNotice(t('Метаданные файлов добавлены в черновик пакета.', 'File metadata added to the package draft.'));
  }

  function guessKind(fileName, mimeType) {
    const mime = String(mimeType || '').toLowerCase();
    const lower = String(fileName || '').toLowerCase();
    if (mime.startsWith('image/') || /\.(png|jpe?g|webp|svg)$/i.test(lower)) return 'image';
    if (/\.css$/i.test(lower)) return 'stylesheet';
    if (/\.json$/i.test(lower)) return 'data';
    if (/\.html?$/i.test(lower)) return 'document';
    return 'asset';
  }

  function updateFileRole(select) {
    const store = getStore();
    if (!store) return;
    const itemId = select.getAttribute('data-codehub-id');
    const fileId = select.getAttribute('data-codehub-file-id');
    if (!itemId || !fileId) return;
    const item = store.getById(itemId);
    if (!item) return;

    const nextFiles = item.files.map(function (file) {
      if (file.id !== fileId) return file;
      return Object.assign({}, file, { role: select.value || 'asset' });
    });

    store.setFiles(itemId, nextFiles);
  }

  function handleAction(button) {
    const action = button.getAttribute('data-codehub-action');
    const id = button.getAttribute('data-codehub-id') || '';
    const type = button.getAttribute('data-codehub-type') || 'template';
    const store = getStore();
    if (!store) return;

    if (action === 'new-item') {
      const item = store.createItem({ type: type || 'template' });
      uiState.view = VIEW_BUILDER;
      uiState.builderTab = 'details';
      setNotice(t('Черновик пакета создан.', 'New package draft created.'));
      store.setActiveItem(item.id);
      return;
    }

    if (action === 'open-item' && id) {
      store.setActiveItem(id);
      uiState.view = VIEW_BUILDER;
      clearNotice();
      renderAll();
      return;
    }

    if (action === 'duplicate-item' && id) {
      const item = store.duplicateItem(id);
      uiState.view = VIEW_BUILDER;
      uiState.builderTab = 'details';
      setNotice(item ? t('Пакет продублирован.', 'Package duplicated.') : t('Не удалось продублировать пакет.', 'Failed to duplicate package.'));
      return;
    }

    if (action === 'archive-item' && id) {
      store.archiveItem(id);
      setNotice(t('Пакет отправлен в архив.', 'Package archived.'));
      return;
    }

    if (action === 'restore-item' && id) {
      store.restoreItem(id);
      setNotice(t('Пакет восстановлен в черновик.', 'Package restored to draft.'));
      return;
    }

    if (action === 'delete-item' && id) {
      const item = store.getById(id);
      const title = item && item.title ? normalizePackageTitle(item.title) : t('Пакет без названия', 'Untitled package');
      const confirmed = window.confirm(t('Удалить пакет «' + title + '»? Это действие нельзя отменить.', 'Delete package “' + title + '”? This cannot be undone.'));
      if (!confirmed) return;
      const removed = store.deleteItem(id);
      setNotice(removed ? t('Пакет удалён.', 'Package deleted.') : t('Не удалось удалить пакет.', 'Failed to delete package.'));
      if (uiState.view === VIEW_BUILDER && !store.getActiveItem()) {
        uiState.view = VIEW_LIST;
      }
      renderAll();
      return;
    }

    if (action === 'remove-file' && id) {
      const fileId = button.getAttribute('data-codehub-file-id');
      store.removeFile(id, fileId);
      setNotice(t('Файл удалён из метаданных пакета.', 'File removed from package metadata.'));
      return;
    }

    if (action === 'save-draft' && id) {
      store.setStatus(id, 'draft');
      setNotice(t('Черновик сохранён локально.', 'Draft saved locally.'));
      return;
    }

    if (action === 'validate-item' && id) {
      const validation = store.validateItem(id);
      uiState.builderTab = 'validation';
      setNotice(validation.isReady ? t('Проверка пройдена.', 'Validation passed.') : t('Проверка нашла проблемы, которые нужно исправить.', 'Validation found problems to fix.'));
      renderAll();
      return;
    }

    if (action === 'mark-ready' && id) {
      const validation = store.markReady(id);
      uiState.builderTab = 'validation';
      setNotice(validation.isReady ? t('Пакет помечен как готовый.', 'Package marked ready.') : t('Пакет пока не готов.', 'Package is not ready yet.'));
      renderAll();
      return;
    }

    if (action === 'submit-item' && id) {
      const validation = store.markSubmitted(id);
      uiState.builderTab = 'submit';
      if (validation.isReady) {
        const item = store.getById(id);
        document.dispatchEvent(new CustomEvent('ns-codehub:submitted', { detail: { item: item } }));
        setNotice(t('Пакет помечен как отправленный на проверку в Каталог.', 'Package marked as submitted to Catalog review.'));
      } else {
        setNotice(t('Отправка заблокирована, пока пакет не пройдёт проверку.', 'Submit is blocked until validation passes.'));
      }
      renderAll();
      return;
    }

    if (action === 'open-cabinet') {
      document.dispatchEvent(new CustomEvent('ns-codehub:open-cabinet'));
      return;
    }

    if (action === 'open-workspace') {
      document.dispatchEvent(new CustomEvent('ns-codehub:open-workspace'));
      return;
    }
  }

  const api = {
    init: ensureInit,
    render: renderAll,
    createNewItem: function (type) {
      const store = getStore();
      if (!store) return null;
      const item = store.createItem({ type: type || 'template' });
      uiState.view = VIEW_BUILDER;
      uiState.builderTab = 'details';
      renderAll();
      return item;
    },
    openItemById: function (id) {
      const store = getStore();
      if (!store || !id) return null;
      store.setActiveItem(id);
      uiState.view = VIEW_BUILDER;
      renderAll();
      return store.getById(id);
    },
    openList: function () {
      uiState.view = VIEW_LIST;
      renderAll();
    },
    getState: function () {
      const store = getStore();
      return store ? store.getState() : null;
    }
  };

  window.NSCodeHubV1 = api;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureInit, { once: true });
  } else {
    ensureInit();
  }
})();
