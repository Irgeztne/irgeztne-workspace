(() => {
  const SOURCE_PARENT = 'irgeztne-webstudio-v084b';
  const SOURCE_CHILD = 'irgeztne-editor-workbench-v084b';

  const editor = document.getElementById('ewbEditor');
  const htmlPanel = document.getElementById('ewbHtmlPanel');
  const htmlField = document.getElementById('ewbHtml');
  const title = document.getElementById('ewbPageTitle');
  const status = document.getElementById('ewbStatus');
  const shell = document.querySelector('.ewb-shell');
  const saveButton = document.querySelector('[data-action="save"]');
  const blockSelect = document.querySelector('[data-block-select]');
  const blocksButtonR1W9F1 = document.querySelector('[data-action="blocks"]');
  const blocksPanelR1W9F1 = document.getElementById('ewbBlocksPanel');
  const blocksListR1W9F1 = document.getElementById('ewbBlocksList');
  const widgetsPanelR1W9G = document.getElementById('ewbWidgetsPanel');
  const widgetsButtonR1W9H = document.querySelector('[data-action="widgets-open-r1w9h"]');
  const widgetsListR1W9G = document.getElementById('ewbWidgetsList');
  const widgetConfigR1W9H = document.getElementById('ewbWidgetConfigR1W9H');
  const widgetInstancesPanelR1W9H = document.getElementById('ewbWidgetInstancesR1W9H');
  const widgetEditorCanvasR1W9H = document.getElementById('ewbEditorCanvasR1W9H');
  const widgetSurfaceBeforeR1W9H = document.getElementById('ewbWidgetSurfaceBeforeR1W9H');
  const widgetSurfaceAfterR1W9H = document.getElementById('ewbWidgetSurfaceAfterR1W9H');
  const widgetSurfaceFloatingR1W9H = document.getElementById('ewbWidgetSurfaceFloatingR1W9H');
  const toolbarR1W9F5 = document.getElementById('ewbToolbar');
  const blockHandleR1W9F6 = document.getElementById('ewbBlockHandle');
  const blockMenuR1W9F6 = document.getElementById('ewbBlockMenu');

  let pageId = '';
  let saveTimer = null;
  let uiLang = 'ru';
  let savedRange = null;
  let dialogMode = '';
  let mediaAssetsV084H = [];
  let pendingMediaRequestV084H = null;
  let selectedMediaBlockV084J = null;
  let mediaInspectorV084J = null;
  let mediaKeyboardArmedV084N = false;
  let heightReportFrameV094B = 0;
  let installedComponentsR1W9F1 = [];
  let installedWidgetsR1W9G = [];
  let widgetSnapshotsR1W9G = {};
  let widgetInstancesR1W9H = [];
  let widgetThemeContextR1W9H = {};
  let widgetDraftR1W9H = null;
  let widgetSubmitPendingR1W9H = null;
  let widgetFocusInstanceIdR1W9H = '';
  let widgetHostViewportR1W9H3 = null;
  let activeBlockR1W9F6 = null;
  let hoveredBlockR1W9F6 = null;
  let textInteractionFrameR1W9F6B = 0;
  let textInteractionActiveR1W9F6B = false;
  let textAnchorElementR1W9F6B = null;
  let dialogAnchorR1W9F6C = null;
  const editorHistoryR1W9F6C = {
    undo: [],
    redo: [],
    limit: 80,
    applying: false,
    initialized: false,
    lastInputKind: '',
    lastInputAt: 0
  };

  // IRGEZTNE_EDITOR_HARDENING_R1W9F6C
  // One content-first editor history covers text edits and structural/media
  // mutations. Dialogs are anchored popovers; media keeps its dedicated inspector.

  // IRGEZTNE_WORKBENCH_TEXT_INTERACTION_UX_R1W9F6B
  // One intentional click in editable text opens the one-row text toolbar;
  // a real selection also opens it. Blank canvas and structural chrome stay silent.
  // Structural block actions remain exclusively under the external ⋮ menu.

  // IRGEZTNE_WORKBENCH_CONTENT_FIRST_EDITOR_R1W9F6
  // Content is always visible. Text selection owns text tools; structural
  // operations are explicit actions on a top-level page block via ⋮.

  const PALETTE = [
    '#ffffff', '#111827', '#60a5fa', '#38bdf8', '#34d399',
    '#f59e0b', '#fb7185', '#a78bfa', '#f97316', '#94a3b8',
    '#dbeafe', '#fef3c7', '#dcfce7', '#fee2e2', '#ede9fe'
  ];

  const TOOL_TITLES = {
    '[data-cmd="bold"]': 'Bold / Жирный',
    '[data-cmd="italic"]': 'Italic / Курсив',
    '[data-cmd="underline"]': 'Underline / Подчёркивание',
    '[data-cmd="strikeThrough"]': 'Strike / Зачёркивание',
    '[data-action="color"]': 'Text color / Цвет текста',
    '[data-action="highlight"]': 'Marker color / Цвет маркера',
    '[data-block-select]': 'Block format P/H1–H6 / Формат блока P/H1–H6',
    '[data-block="blockquote"]': 'Quote / Цитата',
    '[data-cmd="insertUnorderedList"]': 'Bulleted list / Маркированный список',
    '[data-cmd="insertOrderedList"]': 'Numbered list / Нумерованный список',
    '[data-cmd="undo"]': 'Undo / Отменить',
    '[data-cmd="redo"]': 'Redo / Повторить',
    '[data-action="link"]': 'Insert link / Вставить ссылку',
    '[data-cmd="unlink"]': 'Remove link / Убрать ссылку',
    '[data-action="image"]': 'Local image / Изображение с компьютера',
    '[data-action="image-url"]': 'Image URL / Изображение по ссылке',
    '[data-action="video"]': 'Insert video/card / Вставить видео/карточку',
    '[data-action="emoji"]': 'Insert symbol/emoji / Вставить символ/emoji',
    '[data-action="divider"]': 'Divider / Разделитель',
    '[data-action="code"]': 'Code block / Блок кода',
    '[data-action="html"]': 'HTML source / HTML код',
    '[data-action="save"]': 'Save / Сохранить',
    '[data-action="preview"]': 'Preview / Предпросмотр',
    '[data-action="tools-close"]': 'Close editor tools / Закрыть инструменты редактора'
  };

  // IRGEZTNE_WORKBENCH_COMPONENT_LIBRARY_R1W9F1
  function setBlocksPanelOpenR1W9F1(open) {
    if (!blocksPanelR1W9F1) return;
    if (open && widgetsPanelR1W9G) widgetsPanelR1W9G.hidden = true;
    blocksPanelR1W9F1.hidden = !open;
    if (blocksButtonR1W9F1) {
      blocksButtonR1W9F1.setAttribute('aria-expanded', open ? 'true' : 'false');
      blocksButtonR1W9F1.classList.toggle('is-primary', !!open);
    }
    reportWorkbenchHeightV094B();
    window.requestAnimationFrame(positionBlockChromeR1W9F6);
  }

  function renderInstalledComponentsR1W9F1() {
    if (!blocksListR1W9F1) return;
    const list = Array.isArray(installedComponentsR1W9F1)
      ? installedComponentsR1W9F1
      : [];


    const label = document.querySelector('[data-blocks-label]');
    const kicker = document.querySelector('[data-blocks-kicker]');
    const panelTitle = document.querySelector('[data-blocks-title]');
    const help = document.querySelector('[data-blocks-help]');
    if (label) label.textContent = localText('Blocks', 'Блоки');
    if (kicker) kicker.textContent = localText('WORKSHOP', 'МАСТЕРСКАЯ');
    if (panelTitle) panelTitle.textContent = localText('Installed blocks', 'Установленные блоки');
    if (help) {
      help.textContent = activeBlockR1W9F6
        ? localText(
            'The selected component will be inserted after the current page block.',
            'Выбранный компонент будет вставлен после текущего блока страницы.'
          )
        : localText(
            'Choose a page block with the three-dot menu first.',
            'Сначала выберите блок страницы через меню «⋮».'
          );
    }

    blocksListR1W9F1.replaceChildren();

    if (!list.length) {
      const empty = document.createElement('p');
      empty.className = 'ewb-blocks-empty';
      empty.textContent = localText(
        'No installed blocks. Install Component / Block packages in Workshop first.',
        'Установленных блоков нет. Сначала установите пакет «Компонент / блок» в Мастерской.'
      );
      blocksListR1W9F1.appendChild(empty);
      return;
    }

    list.forEach((item) => {
      const card = document.createElement('article');
      card.className = 'ewb-block-card';

      const body = document.createElement('div');
      body.className = 'ewb-block-card-body';

      const titleEl = document.createElement('strong');
      titleEl.textContent = String(item.title || localText('Installed block', 'Установленный блок'));
      body.appendChild(titleEl);

      const meta = document.createElement('span');
      meta.className = 'ewb-block-card-meta';
      meta.textContent = [item.version, item.authorLabel, item.category].filter(Boolean).join(' · ');
      body.appendChild(meta);

      if (item.description) {
        const description = document.createElement('p');
        description.textContent = String(item.description);
        body.appendChild(description);
      }

      const insertButton = document.createElement('button');
      insertButton.type = 'button';
      insertButton.className = 'ewb-block-insert';
      insertButton.dataset.action = 'component-insert-r1w9f1';
      insertButton.dataset.packageId = String(item.packageId || '');
      insertButton.textContent = localText('Insert block', 'Вставить блок');

      card.appendChild(body);
      card.appendChild(insertButton);
      blocksListR1W9F1.appendChild(card);
    });
  }

  // IRGEZTNE_WORKBENCH_SITE_WIDGET_LIBRARY_R1W9H
  // Site Widgets have their own lifecycle: choose -> configure -> placement -> add.
  // They are not Component-like children inserted after the selected DOM block.
  // IRGEZTNE_WORKBENCH_WIDGET_PRESENTATION_CLOSEOUT_R1W9H2
  // Site Widget management is a stable top-level popover. It must never chase
  // the structural block handle or consume permanent space above page content.
  function positionWidgetsPanelR1W9H2() {
    if (!widgetsPanelR1W9G || widgetsPanelR1W9G.hidden || !shell || !editor) return;
    const shellRect = shell.getBoundingClientRect();
    const editorRect = editor.getBoundingClientRect();
    const buttonRect = widgetsButtonR1W9H ? widgetsButtonR1W9H.getBoundingClientRect() : null;
    const panelW = Math.min(720, Math.max(340, editorRect.width - 24));
    const minLeft = Math.max(12, editorRect.left - shellRect.left + 8);
    const maxLeft = Math.max(minLeft, editorRect.right - shellRect.left - panelW - 8);
    let left = buttonRect ? buttonRect.right - shellRect.left - panelW : minLeft;
    left = Math.max(minLeft, Math.min(left, maxLeft));

    let top = buttonRect ? Math.max(68, buttonRect.bottom - shellRect.top + 8) : 78;
    if (widgetHostViewportR1W9H3 && Number.isFinite(Number(widgetHostViewportR1W9H3.localTop)) && Number.isFinite(Number(widgetHostViewportR1W9H3.localBottom))) {
      const visibleTop = Math.max(0, Number(widgetHostViewportR1W9H3.localTop) - shellRect.top + 10);
      const visibleBottom = Math.max(visibleTop + 1, Number(widgetHostViewportR1W9H3.localBottom) - shellRect.top - 10);
      const visibleHeight = Math.max(1, visibleBottom - visibleTop);
      const panelMaxHeight = Math.max(180, Math.min(760, visibleHeight));
      widgetsPanelR1W9G.style.maxHeight = `${Math.round(panelMaxHeight)}px`;
      top = Math.max(visibleTop, top);
      const measuredHeight = Math.min(panelMaxHeight, Math.max(120, Number(widgetsPanelR1W9G.scrollHeight || 0)));
      top = Math.min(top, Math.max(visibleTop, visibleBottom - measuredHeight));
    } else {
      widgetsPanelR1W9G.style.maxHeight = '';
    }

    widgetsPanelR1W9G.style.width = `${Math.round(panelW)}px`;
    widgetsPanelR1W9G.style.left = `${Math.round(left)}px`;
    widgetsPanelR1W9G.style.top = `${Math.round(top)}px`;
  }

  function setWidgetsPanelOpenR1W9G(open) {
    if (!widgetsPanelR1W9G) return;
    if (open && blocksPanelR1W9F1) blocksPanelR1W9F1.hidden = true;
    widgetsPanelR1W9G.hidden = !open;
    if (!open && widgetConfigR1W9H) {
      widgetConfigR1W9H.hidden = true;
      widgetConfigR1W9H.replaceChildren();
      widgetDraftR1W9H = null;
      widgetSubmitPendingR1W9H = null;
    }
    reportWorkbenchHeightV094B();
    if (open) window.requestAnimationFrame(positionWidgetsPanelR1W9H2);
    window.requestAnimationFrame(positionBlockChromeR1W9F6);
  }

  function widgetDescriptorR1W9H(item) {
    const widget = item && item.widget && typeof item.widget === 'object' ? item.widget : {};
    const placement = widget.placement && typeof widget.placement === 'object' ? widget.placement : {};
    return {
      ...widget,
      runtime: widget.runtime && typeof widget.runtime === 'object' ? widget.runtime : { mode: 'local' },
      management: widget.management && typeof widget.management === 'object' ? widget.management : { mode: 'local' },
      placement: {
        modes: Array.isArray(placement.modes) && placement.modes.length ? placement.modes.slice() : ['flow'],
        preferredMode: String(placement.preferredMode || (placement.modes && placement.modes[0]) || 'flow'),
        sizes: Array.isArray(placement.sizes) && placement.sizes.length ? placement.sizes.slice() : ['compact'],
        preferredSize: String(placement.preferredSize || (placement.sizes && placement.sizes[0]) || 'compact'),
        align: Array.isArray(placement.align) && placement.align.length ? placement.align.slice() : ['center'],
        preferredAlign: String(placement.preferredAlign || (placement.align && placement.align[0]) || 'center'),
        regions: Array.isArray(placement.regions) && placement.regions.length ? placement.regions.slice() : ['main-end'],
        preferredRegion: String(placement.preferredRegion || (placement.regions && placement.regions[0]) || 'main-end'),
        floatingPositions: Array.isArray(placement.floatingPositions) && placement.floatingPositions.length ? placement.floatingPositions.slice() : ['bottom-right'],
        preferredFloatingPosition: String(placement.preferredFloatingPosition || (placement.floatingPositions && placement.floatingPositions[0]) || 'bottom-right')
      },
      settings: widget.settings && typeof widget.settings === 'object' ? widget.settings : { fields: [] },
      theme: widget.theme && typeof widget.theme === 'object' ? widget.theme : { mode: 'self-contained' }
    };
  }

  function installedWidgetByPackageIdR1W9H(packageId) {
    return (Array.isArray(installedWidgetsR1W9G) ? installedWidgetsR1W9G : []).find(
      (item) => String(item && item.packageId || '') === String(packageId || '')
    ) || null;
  }

  function widgetInstanceByIdR1W9H(instanceId) {
    return (Array.isArray(widgetInstancesR1W9H) ? widgetInstancesR1W9H : []).find(
      (item) => String(item && item.instanceId || '') === String(instanceId || '')
    ) || null;
  }

  function renderInstalledWidgetsR1W9G() {
    if (!widgetsListR1W9G) return;
    const list = Array.isArray(installedWidgetsR1W9G) ? installedWidgetsR1W9G : [];
    const panelTitle = document.querySelector('[data-widgets-title]');
    const help = document.querySelector('[data-widgets-help]');
    if (panelTitle) panelTitle.textContent = localText('Site Widgets', 'Виджеты сайта');
    if (help) help.textContent = localText(
      'Choose a Widget, configure it, choose placement, then add it to the site.',
      'Выберите Widget, настройте его, выберите размещение и только потом добавьте на сайт.'
    );
    widgetsListR1W9G.replaceChildren();
    if (!list.length) {
      const empty = document.createElement('p');
      empty.className = 'ewb-blocks-empty';
      empty.textContent = localText('No installed site widgets. Install a Widget package in Workshop first.', 'Установленных виджетов сайта нет. Сначала установите пакет Widget в Мастерской.');
      widgetsListR1W9G.appendChild(empty);
      return;
    }
    list.forEach((item) => {
      const widget = widgetDescriptorR1W9H(item);
      const card = document.createElement('article');
      card.className = 'ewb-block-card ewb-widget-library-card-r1w9h';
      const body = document.createElement('div');
      body.className = 'ewb-block-card-body';
      const titleEl = document.createElement('strong');
      titleEl.textContent = String(item.title || localText('Installed widget', 'Установленный виджет'));
      body.appendChild(titleEl);
      const meta = document.createElement('span');
      meta.className = 'ewb-block-card-meta';
      const placementLabel = (widget.placement.modes || []).map((value) => widgetPlacementOptionLabelR1W9H('mode', value)).join(' / ');
      meta.textContent = [item.version, item.authorLabel, item.category, placementLabel].filter(Boolean).join(' · ');
      body.appendChild(meta);
      if (item.description) {
        const description = document.createElement('p');
        description.textContent = String(item.description);
        body.appendChild(description);
      }
      const configureButton = document.createElement('button');
      configureButton.type = 'button';
      configureButton.className = 'ewb-block-insert';
      configureButton.dataset.action = 'widget-configure-r1w9h';
      configureButton.dataset.packageId = String(item.packageId || '');
      configureButton.textContent = localText('Configure', 'Настроить');
      card.appendChild(body);
      card.appendChild(configureButton);
      widgetsListR1W9G.appendChild(card);
    });
  }

  function widgetFieldLabelR1W9H(field) {
    return String(field && (field.label || field.key) || localText('Setting', 'Настройка'));
  }

  // IRGEZTNE_WORKBENCH_WIDGET_FINAL_UX_CLOSEOUT_R1W9H
  // Contract enum values stay stable in data; the editor presents human labels.
  function widgetPlacementOptionLabelR1W9H(kind, value) {
    const key = String(value || '');
    const labels = {
      mode: {
        flow: ['Flow', 'В потоке'],
        region: ['Site region', 'Область сайта'],
        bar: ['Bar', 'Полоса'],
        floating: ['Floating', 'Плавающий']
      },
      size: {
        compact: ['Compact', 'Компактный'],
        medium: ['Medium', 'Средний'],
        wide: ['Wide', 'Широкий'],
        full: ['Full width', 'На всю ширину']
      },
      align: {
        left: ['Left', 'Слева'],
        center: ['Center', 'По центру'],
        right: ['Right', 'Справа'],
        stretch: ['Stretch', 'Растянуть']
      },
      region: {
        'page-top': ['Page top', 'Верх страницы'],
        'after-header': ['After header', 'После шапки'],
        'main-start': ['Main content start', 'Начало основного содержимого'],
        'main-end': ['Main content end', 'Конец основного содержимого'],
        'before-footer': ['Before footer', 'Перед подвалом'],
        'page-bottom': ['Page bottom', 'Низ страницы']
      },
      floatingPosition: {
        'top-left': ['Top left', 'Сверху слева'],
        'top-right': ['Top right', 'Сверху справа'],
        'bottom-left': ['Bottom left', 'Снизу слева'],
        'bottom-right': ['Bottom right', 'Снизу справа']
      },
      theme: {
        inherit: ['Inherit site theme', 'Наследовать тему сайта'],
        variants: ['Widget theme variants', 'Варианты темы виджета'],
        'self-contained': ['Self-contained', 'Автономная']
      }
    };
    const pair = labels[kind] && labels[kind][key];
    return pair ? localText(pair[0], pair[1]) : key;
  }

  function addWidgetSelectOptionsR1W9H(select, values, selected, kind) {
    (Array.isArray(values) ? values : []).forEach((value) => {
      const option = document.createElement('option');
      option.value = String(value);
      option.textContent = widgetPlacementOptionLabelR1W9H(kind, value);
      option.selected = String(value) === String(selected || '');
      select.appendChild(option);
    });
  }

  function widgetConfigRowR1W9H(labelText, control, hint) {
    const row = document.createElement('label');
    row.className = 'ewb-widget-config-row-r1w9h';
    const label = document.createElement('span');
    label.className = 'ewb-widget-config-label-r1w9h';
    label.textContent = labelText;
    row.appendChild(label);
    row.appendChild(control);
    if (hint) {
      const small = document.createElement('small');
      small.textContent = hint;
      row.appendChild(small);
    }
    return row;
  }

  function widgetSettingControlR1W9H(field, value) {
    const type = String(field && field.type || 'text');
    let control;
    if (type === 'boolean') {
      control = document.createElement('input');
      control.type = 'checkbox';
      control.checked = value === true;
    } else if (type === 'select' || type === 'multi-select') {
      control = document.createElement('select');
      if (type === 'multi-select') control.multiple = true;
      const values = Array.isArray(field.options) ? field.options : Array.isArray(field.values) ? field.values : Array.isArray(field.allowedValues) ? field.allowedValues : [];
      values.forEach((candidate) => {
        const option = document.createElement('option');
        const optionValue = candidate && typeof candidate === 'object' ? candidate.value : candidate;
        const optionLabel = candidate && typeof candidate === 'object' ? (candidate.label || candidate.value) : candidate;
        option.value = String(optionValue == null ? '' : optionValue);
        option.textContent = String(optionLabel == null ? option.value : optionLabel);
        option.selected = Array.isArray(value) ? value.map(String).includes(option.value) : String(value == null ? '' : value) === option.value;
        control.appendChild(option);
      });
    } else if (type === 'textarea') {
      control = document.createElement('textarea');
      control.value = String(value == null ? '' : value);
    } else {
      control = document.createElement('input');
      control.type = type === 'number' ? 'number' : type === 'color' ? 'color' : type === 'url' ? 'url' : 'text';
      control.value = String(value == null ? '' : value);
      if (type === 'number') {
        if (Number.isFinite(Number(field.min))) control.min = String(field.min);
        if (Number.isFinite(Number(field.max))) control.max = String(field.max);
      }
    }
    control.dataset.widgetSettingKey = String(field && field.key || '');
    control.dataset.widgetSettingType = type;
    if (field && field.required === true) control.required = true;
    return control;
  }

  function updateWidgetPlacementVisibilityR1W9H() {
    if (!widgetConfigR1W9H || widgetConfigR1W9H.hidden) return;
    const mode = widgetConfigR1W9H.querySelector('[data-widget-placement-field="mode"]')?.value || 'flow';
    widgetConfigR1W9H.querySelectorAll('[data-placement-for]').forEach((row) => {
      const modes = String(row.getAttribute('data-placement-for') || '').split(',');
      row.hidden = !modes.includes(mode);
    });
  }

  function beginWidgetConfigurationR1W9H(item, existingInstance) {
    if (!item || !widgetConfigR1W9H) return;
    const widget = widgetDescriptorR1W9H(item);
    const settings = existingInstance && existingInstance.settings && typeof existingInstance.settings === 'object'
      ? { ...existingInstance.settings }
      : {};
    const placement = existingInstance && existingInstance.placement && typeof existingInstance.placement === 'object'
      ? { ...existingInstance.placement }
      : {};
    (Array.isArray(widget.settings.fields) ? widget.settings.fields : []).forEach((field) => {
      const key = String(field && field.key || '');
      if (key && !(key in settings) && Object.prototype.hasOwnProperty.call(field, 'default')) settings[key] = field.default;
    });
    widgetDraftR1W9H = {
      packageId: String(item.packageId || existingInstance && existingInstance.packageId || ''),
      instanceId: String(existingInstance && existingInstance.instanceId || ''),
      widget,
      settings,
      placement
    };
    widgetConfigR1W9H.replaceChildren();
    widgetConfigR1W9H.hidden = false;

    const head = document.createElement('header');
    head.className = 'ewb-widget-config-head-r1w9h';
    const heading = document.createElement('div');
    const kicker = document.createElement('span');
    kicker.className = 'ewb-kicker';
    kicker.textContent = existingInstance ? localText('EDIT SITE WIDGET', 'НАСТРОЙКА ВИДЖЕТА') : localText('ADD SITE WIDGET', 'ДОБАВИТЬ ВИДЖЕТ');
    const strong = document.createElement('strong');
    strong.textContent = String(item.title || existingInstance && existingInstance.title || localText('Site Widget', 'Виджет сайта'));
    heading.append(kicker, strong);
    head.appendChild(heading);
    widgetConfigR1W9H.appendChild(head);

    const grid = document.createElement('div');
    grid.className = 'ewb-widget-config-grid-r1w9h';
    const fields = Array.isArray(widget.settings.fields) ? widget.settings.fields : [];
    fields.forEach((field) => {
      const key = String(field && field.key || '');
      if (!key) return;
      grid.appendChild(widgetConfigRowR1W9H(widgetFieldLabelR1W9H(field), widgetSettingControlR1W9H(field, settings[key]), String(field.description || '')));
    });
    if (!fields.length) {
      const note = document.createElement('p');
      note.className = 'ewb-widget-config-note-r1w9h';
      note.textContent = localText('This Widget has no functional settings.', 'У этого Widget нет функциональных настроек.');
      grid.appendChild(note);
    }

    const placementTitle = document.createElement('strong');
    placementTitle.className = 'ewb-widget-placement-title-r1w9h';
    placementTitle.textContent = localText('Placement', 'Размещение');
    grid.appendChild(placementTitle);

    const p = widget.placement;
    const mode = document.createElement('select');
    mode.dataset.widgetPlacementField = 'mode';
    addWidgetSelectOptionsR1W9H(mode, p.modes, placement.mode || p.preferredMode, 'mode');
    grid.appendChild(widgetConfigRowR1W9H(localText('Mode', 'Режим'), mode));

    const size = document.createElement('select');
    size.dataset.widgetPlacementField = 'size';
    addWidgetSelectOptionsR1W9H(size, p.sizes, placement.size || p.preferredSize, 'size');
    grid.appendChild(widgetConfigRowR1W9H(localText('Size', 'Размер'), size));

    const align = document.createElement('select');
    align.dataset.widgetPlacementField = 'align';
    addWidgetSelectOptionsR1W9H(align, p.align, placement.align || p.preferredAlign, 'align');
    const alignRow = widgetConfigRowR1W9H(localText('Alignment', 'Выравнивание'), align);
    alignRow.dataset.placementFor = 'flow,region';
    grid.appendChild(alignRow);

    const region = document.createElement('select');
    region.dataset.widgetPlacementField = 'region';
    addWidgetSelectOptionsR1W9H(region, p.regions, placement.region || placement.slot || p.preferredRegion, 'region');
    const regionRow = widgetConfigRowR1W9H(localText('Site region', 'Область сайта'), region);
    regionRow.dataset.placementFor = 'flow,region,bar';
    grid.appendChild(regionRow);

    const floatingPosition = document.createElement('select');
    floatingPosition.dataset.widgetPlacementField = 'floatingPosition';
    addWidgetSelectOptionsR1W9H(floatingPosition, p.floatingPositions, placement.floatingPosition || p.preferredFloatingPosition, 'floatingPosition');
    const floatingRow = widgetConfigRowR1W9H(localText('Floating position', 'Плавающая позиция'), floatingPosition);
    floatingRow.dataset.placementFor = 'floating';
    grid.appendChild(floatingRow);

    const themeNote = document.createElement('p');
    themeNote.className = 'ewb-widget-config-note-r1w9h';
    themeNote.textContent = localText('Theme mode: ', 'Режим темы: ') + widgetPlacementOptionLabelR1W9H('theme', widget.theme && widget.theme.mode || 'self-contained');
    grid.appendChild(themeNote);
    widgetConfigR1W9H.appendChild(grid);

    const actions = document.createElement('div');
    actions.className = 'ewb-widget-config-actions-r1w9h';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.dataset.action = 'widget-config-cancel-r1w9h';
    cancel.textContent = localText('Cancel', 'Отмена');
    const confirm = document.createElement('button');
    confirm.type = 'button';
    confirm.className = 'is-primary';
    confirm.dataset.action = existingInstance ? 'widget-update-confirm-r1w9h' : 'widget-add-confirm-r1w9h';
    confirm.textContent = existingInstance ? localText('Save changes', 'Сохранить изменения') : localText('Add to Site', 'Добавить на сайт');
    actions.append(cancel, confirm);
    widgetConfigR1W9H.appendChild(actions);
    mode.addEventListener('change', updateWidgetPlacementVisibilityR1W9H);
    updateWidgetPlacementVisibilityR1W9H();
    widgetConfigR1W9H.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    reportWorkbenchHeightV094B();
  }

  function collectWidgetDraftR1W9H() {
    if (!widgetDraftR1W9H || !widgetConfigR1W9H) return null;
    const settings = {};
    widgetConfigR1W9H.querySelectorAll('[data-widget-setting-key]').forEach((control) => {
      const key = String(control.dataset.widgetSettingKey || '');
      const type = String(control.dataset.widgetSettingType || 'text');
      if (!key) return;
      if (type === 'boolean') settings[key] = !!control.checked;
      else if (type === 'number') settings[key] = control.value === '' ? '' : Number(control.value);
      else if (type === 'multi-select') settings[key] = Array.from(control.selectedOptions || []).map((option) => option.value);
      else settings[key] = control.value;
    });
    const placement = {};
    widgetConfigR1W9H.querySelectorAll('[data-widget-placement-field]').forEach((control) => {
      placement[String(control.dataset.widgetPlacementField || '')] = control.value;
    });
    return { settings, placement };
  }

  function widgetPlacementSummaryR1W9H2(instance) {
    const placement = instance && instance.placement && typeof instance.placement === 'object' ? instance.placement : {};
    return [
      placement.mode ? widgetPlacementOptionLabelR1W9H('mode', placement.mode) : '',
      (placement.region || placement.slot) ? widgetPlacementOptionLabelR1W9H('region', placement.region || placement.slot) : '',
      placement.size ? widgetPlacementOptionLabelR1W9H('size', placement.size) : '',
      placement.align ? widgetPlacementOptionLabelR1W9H('align', placement.align) : '',
      placement.floatingPosition ? widgetPlacementOptionLabelR1W9H('floatingPosition', placement.floatingPosition) : ''
    ].filter(Boolean).join(' · ');
  }

  function widgetEditorSurfaceBucketR1W9H2(instance) {
    const placement = instance && instance.placement && typeof instance.placement === 'object' ? instance.placement : {};
    const mode = String(placement.mode || 'flow');
    if (mode === 'floating') return 'floating';
    const slot = String(placement.region || placement.slot || 'main-end');
    return ['page-top', 'after-header', 'main-start'].includes(slot) ? 'before' : 'after';
  }

  function widgetEditorHostR1W9H2(instance) {
    const placement = instance && instance.placement && typeof instance.placement === 'object' ? instance.placement : {};
    const mode = String(placement.mode || 'flow');
    const size = String(placement.size || 'medium');
    const align = String(placement.align || 'center');
    const floatingPosition = String(placement.floatingPosition || 'bottom-right');
    const host = document.createElement('div');
    host.className = [
      'ewb-widget-editor-host-r1w9h2',
      'mode-' + mode,
      'size-' + size,
      'align-' + align,
      mode === 'floating' ? 'floating-' + floatingPosition : '',
      widgetFocusInstanceIdR1W9H && String(instance.instanceId || '') === widgetFocusInstanceIdR1W9H ? 'is-widget-focus-r1w9h' : ''
    ].filter(Boolean).join(' ');
    host.dataset.widgetInstanceId = String(instance.instanceId || '');
    host.dataset.widgetPlacementBucket = widgetEditorSurfaceBucketR1W9H2(instance);
    host.setAttribute('contenteditable', 'false');
    host.setAttribute('aria-label', String(instance.title || localText('Site Widget', 'Виджет сайта')) + ' · ' + widgetPlacementSummaryR1W9H2(instance));
    host.title = widgetPlacementSummaryR1W9H2(instance);
    const frame = widgetPreviewFrameR1W9H(instance);
    if (frame) host.appendChild(frame);
    return host;
  }

  function renderWidgetEditorSurfacesR1W9H2() {
    const surfaces = [widgetSurfaceBeforeR1W9H, widgetSurfaceAfterR1W9H, widgetSurfaceFloatingR1W9H];
    surfaces.forEach((surface) => {
      if (!surface) return;
      surface.replaceChildren();
      surface.hidden = true;
    });
    const list = Array.isArray(widgetInstancesR1W9H) ? widgetInstancesR1W9H : [];
    list.forEach((instance) => {
      const bucket = widgetEditorSurfaceBucketR1W9H2(instance);
      const surface = bucket === 'before' ? widgetSurfaceBeforeR1W9H : bucket === 'floating' ? widgetSurfaceFloatingR1W9H : widgetSurfaceAfterR1W9H;
      if (!surface) return;
      surface.hidden = false;
      surface.appendChild(widgetEditorHostR1W9H2(instance));
    });
    if (widgetEditorCanvasR1W9H) widgetEditorCanvasR1W9H.classList.toggle('has-floating-widgets-r1w9h2', !!(widgetSurfaceFloatingR1W9H && !widgetSurfaceFloatingR1W9H.hidden));
  }

  function widgetPresentationTargetR1W9H2(instanceId) {
    const id = String(instanceId || '');
    if (!id) return null;
    const escaped = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(id) : id.replace(/["\\]/g, '\\$&');
    const selector = '[data-widget-instance-id="' + escaped + '"]';
    return (widgetSurfaceFloatingR1W9H && widgetSurfaceFloatingR1W9H.querySelector(selector)) ||
      (widgetSurfaceBeforeR1W9H && widgetSurfaceBeforeR1W9H.querySelector(selector)) ||
      (widgetSurfaceAfterR1W9H && widgetSurfaceAfterR1W9H.querySelector(selector)) ||
      (widgetInstancesPanelR1W9H && widgetInstancesPanelR1W9H.querySelector(selector)) || null;
  }

  function renderWidgetInstancesR1W9H() {
    if (!widgetInstancesPanelR1W9H) return;
    const list = Array.isArray(widgetInstancesR1W9H) ? widgetInstancesR1W9H : [];
    widgetInstancesPanelR1W9H.replaceChildren();
    widgetInstancesPanelR1W9H.hidden = !list.length;

    if (list.length) {
      const head = document.createElement('header');
      head.className = 'ewb-widget-instances-head-r1w9h';
      const strong = document.createElement('strong');
      strong.textContent = localText('On this page', 'На этой странице') + ' · ' + String(list.length);
      const small = document.createElement('span');
      small.textContent = localText('Manage Site Widget instances here; live placement stays on the editor canvas.', 'Здесь только управление; сам Widget показан на холсте в месте размещения.');
      head.append(strong, small);
      widgetInstancesPanelR1W9H.appendChild(head);

      list.forEach((instance) => {
        const card = document.createElement('article');
        card.className = 'ewb-widget-instance-card-r1w9h ewb-widget-instance-row-r1w9h2';
        card.dataset.widgetInstanceId = String(instance.instanceId || '');
        if (widgetFocusInstanceIdR1W9H && card.dataset.widgetInstanceId === widgetFocusInstanceIdR1W9H) card.classList.add('is-widget-focus-r1w9h');
        const chrome = document.createElement('header');
        chrome.className = 'ewb-widget-instance-chrome-r1w9h';
        const label = document.createElement('div');
        const titleEl = document.createElement('strong');
        titleEl.textContent = String(instance.title || localText('Site Widget', 'Виджет сайта'));
        const meta = document.createElement('span');
        meta.textContent = widgetPlacementSummaryR1W9H2(instance);
        label.append(titleEl, meta);
        const actions = document.createElement('div');
        const edit = document.createElement('button');
        edit.type = 'button';
        edit.dataset.action = 'widget-instance-edit-r1w9h';
        edit.dataset.instanceId = String(instance.instanceId || '');
        edit.textContent = localText('Settings', 'Настройки');
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'is-danger';
        remove.dataset.action = 'widget-instance-remove-r1w9h';
        remove.dataset.instanceId = String(instance.instanceId || '');
        remove.textContent = localText('Remove', 'Удалить');
        actions.append(edit, remove);
        chrome.append(label, actions);
        card.appendChild(chrome);
        widgetInstancesPanelR1W9H.appendChild(card);
      });
    }

    renderWidgetEditorSurfacesR1W9H2();
    reportWorkbenchHeightV094B();
  }


  function widgetSnapshotByIdR1W9G(snapshotId) {
    const id = String(snapshotId || '');
    const snapshot = widgetSnapshotsR1W9G && typeof widgetSnapshotsR1W9G === 'object' ? widgetSnapshotsR1W9G[id] : null;
    return snapshot && typeof snapshot === 'object' ? snapshot : null;
  }

  function widgetCspR1W9H(snapshot, hostNonce) {
    const widget = snapshot && snapshot.widget && typeof snapshot.widget === 'object' ? snapshot.widget : {};
    const caps = widget.capabilities && typeof widget.capabilities === 'object' ? widget.capabilities : {};
    const origins = Array.isArray(caps.externalOrigins) ? caps.externalOrigins.filter((value) => /^https?:\/\//i.test(String(value || ''))) : [];
    const sources = origins.join(' ');
    const script = caps.javascript === true ? "'unsafe-inline'" : "'nonce-" + String(hostNonce || '') + "'";
    const connect = caps.network === true && sources ? sources : "'none'";
    const remote = caps.network === true && sources ? ' ' + sources : '';
    return [
      "default-src 'none'",
      "base-uri 'none'",
      "object-src 'none'",
      "script-src " + script,
      "style-src 'unsafe-inline'" + remote,
      "img-src data: blob:" + remote,
      "media-src data: blob:" + remote,
      "font-src data:" + remote,
      "connect-src " + connect,
      "frame-src " + connect,
      "form-action " + connect
    ].join('; ');
  }

  function widgetHostNonceR1W9H() {
    try {
      const bytes = new Uint32Array(2);
      crypto.getRandomValues(bytes);
      return Array.from(bytes).map((value) => value.toString(36)).join('');
    } catch {
      return Math.random().toString(36).slice(2) + Date.now().toString(36);
    }
  }

  // IRGEZTNE_WORKBENCH_WIDGET_INSTANCE_PREVIEW_R1W9H
  function widgetContextJsonR1W9H(value) {
    return JSON.stringify(value == null ? null : value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
  }

  function widgetSrcdocForInstanceR1W9H(snapshot, instance) {
    const html = String(snapshot && snapshot.html || '');
    const widget = widgetDescriptorR1W9H(snapshot || {});
    const caps = widget.capabilities && typeof widget.capabilities === 'object' ? widget.capabilities : {};
    const hostNonce = widgetHostNonceR1W9H();
    const csp = widgetCspR1W9H({ ...snapshot, widget }, hostNonce).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    const meta = '<meta http-equiv="Content-Security-Policy" content="' + csp + '">';
    const theme = widgetThemeContextR1W9H && typeof widgetThemeContextR1W9H === 'object' ? widgetThemeContextR1W9H : {};
    const hostStyle = '<style data-irgeztne-widget-host-context="r1w9h">:root{' +
      '--irgeztne-host-accent:' + String(theme.accentColor || '#2f7be6') + ';' +
      '--irgeztne-host-text:' + String(theme.textColor || '#101827') + ';' +
      '--irgeztne-host-muted:' + String(theme.mutedTextColor || '#52657c') + ';' +
      '--irgeztne-host-surface:' + String(theme.surfaceColor || '#ffffff') + ';' +
      '--irgeztne-host-border:' + String(theme.borderColor || '#e2e8f0') + ';' +
      '--irgeztne-host-radius:' + String(theme.radiusToken || '16px') + ';' +
      '--irgeztne-host-font:' + String(theme.fontFamilyToken || 'Inter') + ';' +
      'color-scheme:' + String(theme.colorScheme || 'light') + '}html,body{margin:0!important;width:100%!important;min-width:0!important;overflow:hidden!important;background:transparent!important}</style>';
    const context = {
      settings: instance && instance.settings && typeof instance.settings === 'object' ? instance.settings : {},
      theme,
      instance: { instanceId: String(instance && instance.instanceId || ''), placement: instance && instance.placement || {} }
    };
    const bridge = '<script nonce="' + hostNonce + '" data-irgeztne-widget-context="r1w9h">window.IRGEZTNE_WIDGET_CONTEXT=' + widgetContextJsonR1W9H(context) + ';(function(){function applyTheme(t){t=t||{};var r=document.documentElement,s=r.style;if(t.accentColor)s.setProperty("--irgeztne-host-accent",String(t.accentColor));if(t.textColor)s.setProperty("--irgeztne-host-text",String(t.textColor));if(t.mutedTextColor)s.setProperty("--irgeztne-host-muted",String(t.mutedTextColor));if(t.surfaceColor)s.setProperty("--irgeztne-host-surface",String(t.surfaceColor));if(t.borderColor)s.setProperty("--irgeztne-host-border",String(t.borderColor));if(t.radiusToken)s.setProperty("--irgeztne-host-radius",String(t.radiusToken));if(t.fontFamilyToken)s.setProperty("--irgeztne-host-font",String(t.fontFamilyToken));r.style.colorScheme=t.colorScheme==="dark"?"dark":"light";window.IRGEZTNE_WIDGET_CONTEXT.theme=t;try{window.dispatchEvent(new CustomEvent("irgeztne-widget-theme",{detail:t}))}catch(e){}}function report(){try{var h=Math.ceil(Math.max(document.documentElement.scrollHeight,document.body?document.body.scrollHeight:0));parent.postMessage({source:"irgeztne-site-widget-runtime-v1",type:"height",instanceId:' + widgetContextJsonR1W9H(String(instance && instance.instanceId || '')) + ',height:h},"*")}catch(e){}}addEventListener("message",function(event){var d=event.data||{};if(event.source!==parent||d.source!=="irgeztne-widget-host-v1"||d.type!=="theme")return;applyTheme(d.theme||{})});applyTheme(window.IRGEZTNE_WIDGET_CONTEXT.theme||{});if(typeof ResizeObserver==="function")new ResizeObserver(report).observe(document.documentElement);addEventListener("load",report);setTimeout(report,50)})();<\/script>';
    if (/<head\b[^>]*>/i.test(html)) return html.replace(/<head\b([^>]*)>/i, '<head$1>' + meta + hostStyle + bridge);
    return '<!doctype html><html><head><meta charset="utf-8">' + meta + hostStyle + bridge + '<meta name="viewport" content="width=device-width,initial-scale=1"></head><body>' + html + '</body></html>';
  }

  function widgetHostedUrlForInstanceR1W9H(snapshot, instance) {
    const widget = widgetDescriptorR1W9H(snapshot || {});
    const runtime = widget.runtime || {};
    if (runtime.mode !== 'hosted' || !runtime.url) return '';
    try {
      const url = new URL(String(runtime.url));
      const settings = instance && instance.settings && typeof instance.settings === 'object' ? instance.settings : {};
      const query = runtime.query && typeof runtime.query === 'object' ? runtime.query : {};
      Object.keys(query).forEach((param) => {
        const key = String(query[param] || '');
        if (key && Object.prototype.hasOwnProperty.call(settings, key) && settings[key] != null && settings[key] !== '') {
          url.searchParams.set(param, Array.isArray(settings[key]) ? settings[key].join(',') : String(settings[key]));
        }
      });
      return url.toString();
    } catch {
      return '';
    }
  }

  function widgetPreviewFrameR1W9H(instance) {
    const snapshot = widgetSnapshotByIdR1W9G(instance && instance.sourceSnapshotId);
    if (!snapshot) {
      const missing = document.createElement('p');
      missing.className = 'ewb-widget-config-note-r1w9h';
      missing.textContent = localText('Widget snapshot unavailable.', 'Снимок Widget недоступен.');
      return missing;
    }
    const widget = widgetDescriptorR1W9H(snapshot);
    const caps = widget.capabilities && typeof widget.capabilities === 'object' ? widget.capabilities : {};
    const frame = document.createElement('iframe');
    frame.className = 'ewb-widget-instance-runtime-r1w9h';
    frame.dataset.widgetInstanceRuntime = String(instance.instanceId || '');
    frame.title = String(snapshot.title || instance.title || localText('Site Widget', 'Виджет сайта'));
    frame.referrerPolicy = 'no-referrer';
    frame.setAttribute('scrolling', 'no');
    frame.setAttribute('sandbox', widget.runtime && widget.runtime.mode === 'hosted'
      ? 'allow-scripts allow-forms allow-same-origin'
      : (caps.javascript === true ? 'allow-scripts allow-forms' : 'allow-scripts allow-forms'));
    const size = widget.size && typeof widget.size === 'object' ? widget.size : {};
    const minHeight = Math.max(60, Number(size.minHeight || 80));
    const maxHeight = Math.max(minHeight, Number(size.maxHeight || 1200));
    const preferredHeight = Math.max(minHeight, Math.min(maxHeight, Number(size.preferredHeight || widget.height || 260)));
    frame.dataset.heightMode = String(size.heightMode || 'fixed');
    frame.dataset.minHeight = String(minHeight);
    frame.dataset.maxHeight = String(maxHeight);
    frame.style.height = preferredHeight + 'px';
    if (widget.runtime && widget.runtime.mode === 'hosted') {
      const src = widgetHostedUrlForInstanceR1W9H(snapshot, instance);
      if (!src) return null;
      frame.src = src;
    } else {
      frame.srcdoc = widgetSrcdocForInstanceR1W9H(snapshot, instance);
    }
    return frame;
  }

  function handleWidgetRuntimeHeightR1W9H(event, data) {
    if (!data || data.source !== 'irgeztne-site-widget-runtime-v1' || data.type !== 'height') return false;
    const frames = document.querySelectorAll('iframe[data-widget-instance-runtime]');
    for (const frame of frames) {
      if (frame.contentWindow !== event.source) continue;
      if (String(frame.dataset.widgetInstanceRuntime || '') !== String(data.instanceId || '')) return true;
      if (String(frame.dataset.heightMode || 'fixed') !== 'content') return true;
      const min = Number(frame.dataset.minHeight || 60);
      const max = Number(frame.dataset.maxHeight || 1200);
      const height = Math.max(min, Math.min(max, Number(data.height || 0)));
      if (height > 0) frame.style.height = Math.ceil(height) + 'px';
      reportWorkbenchHeightV094B();
      return true;
    }
    return false;
  }

  function setStatus(text) {
    status.textContent = text || 'ready';
  }

  function localText(en, ru) {
    return uiLang === 'en' ? en : ru;
  }

  function topLevelBlockFromNodeR1W9F6(node) {
    if (!editor || !node) return null;
    let element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
    if (!element || !editor.contains(element) || element === editor) return null;

    // R1W9F6C: image/video figures own the dedicated media inspector. They are
    // never generic structural blocks and therefore never receive the ⋮ handle.
    if (mediaBlockFromTargetV084J(element)) return null;

    // Prefer the nearest semantic page section. Official templates commonly
    // keep many sections inside one harmless layout wrapper; treating that
    // wrapper as the only block would make structural editing useless.
    const semantic = element.closest && element.closest(
      'section, article, header, footer, nav, aside, details, blockquote, pre, table'
    );
    if (semantic && editor.contains(semantic)) return semantic;

    // Simple pages may consist only of direct paragraphs/headings/divs.
    while (element && element.parentElement && element.parentElement !== editor) {
      element = element.parentElement;
    }
    return element && element.parentElement === editor ? element : null;
  }

  function activeBlockFromSelectionR1W9F6() {
    try {
      const selection = window.getSelection();
      if (!selection || !selection.rangeCount || !selectionInsideEditor()) return null;
      return topLevelBlockFromNodeR1W9F6(selection.getRangeAt(0).commonAncestorContainer);
    } catch {
      return null;
    }
  }

  function setActiveBlockR1W9F6(block) {
    activeBlockR1W9F6 = block && editor.contains(block) ? block : null;
    if (!activeBlockR1W9F6) {
      if (blockHandleR1W9F6) blockHandleR1W9F6.hidden = true;
      if (blockMenuR1W9F6) blockMenuR1W9F6.hidden = true;
      setBlocksPanelOpenR1W9F1(false);
    }
    window.requestAnimationFrame(positionBlockChromeR1W9F6);
  }

  function setBlockMenuOpenR1W9F6(open) {
    if (!blockMenuR1W9F6 || !blockHandleR1W9F6) return;
    const next = !!open && !!activeBlockR1W9F6;
    blockMenuR1W9F6.hidden = !next;
    blockHandleR1W9F6.setAttribute('aria-expanded', next ? 'true' : 'false');
    blockHandleR1W9F6.classList.toggle('is-open', next);
    if (!next) {
      setBlocksPanelOpenR1W9F1(false);
    }
    reportWorkbenchHeightV094B();
    window.requestAnimationFrame(positionBlockChromeR1W9F6);
  }

  function textElementFromHitR1W9F6B(target) {
    let element = target && target.nodeType === Node.ELEMENT_NODE ? target : target && target.parentElement;
    if (!element || !editor.contains(element)) return null;
    const preferred = element.closest && element.closest(
      'p,h1,h2,h3,h4,h5,h6,li,blockquote,figcaption,td,th,summary,a,span,strong,em,b,i,u,s,small,mark,code'
    );
    if (preferred && editor.contains(preferred)) return preferred;
    while (element && element !== editor) {
      const directText = Array.from(element.childNodes || []).some(
        (node) => node.nodeType === Node.TEXT_NODE && String(node.textContent || '').trim()
      );
      if (directText && !element.matches('section,article,header,footer,nav,aside,figure,table,tbody,thead,tr')) {
        return element;
      }
      element = element.parentElement;
    }
    return null;
  }

  function positionTextToolbarR1W9F6() {
    if (!toolbarR1W9F5 || toolbarR1W9F5.hidden || !shell || !editor) return;
    let anchor = null;
    try {
      const selection = window.getSelection();
      if (selection && selection.rangeCount && selectionInsideEditor()) {
        const rangeRect = selection.getRangeAt(0).getBoundingClientRect();
        if (rangeRect && (rangeRect.width || rangeRect.height)) anchor = rangeRect;
      }
    } catch {}
    if ((!anchor || (!anchor.width && !anchor.height)) && textAnchorElementR1W9F6B && editor.contains(textAnchorElementR1W9F6B)) {
      anchor = textAnchorElementR1W9F6B.getBoundingClientRect();
    }
    if (!anchor || (!anchor.width && !anchor.height)) return;

    const shellRect = shell.getBoundingClientRect();
    const editorRect = editor.getBoundingClientRect();
    const editorLeft = editorRect.left - shellRect.left + 10;
    const editorRight = editorRect.right - shellRect.left - 10;
    const available = Math.max(120, editorRight - editorLeft);
    toolbarR1W9F5.style.width = 'max-content';
    const naturalWidth = Math.max(1, toolbarR1W9F5.scrollWidth || toolbarR1W9F5.offsetWidth || 1);
    const width = Math.min(naturalWidth, available);
    toolbarR1W9F5.style.width = `${Math.ceil(width)}px`;
    const height = toolbarR1W9F5.offsetHeight || 50;
    let top = anchor.top - shellRect.top - height - 8;
    if (top < editorRect.top - shellRect.top + 4) top = anchor.bottom - shellRect.top + 8;
    let left = anchor.left - shellRect.left;
    left = Math.max(editorLeft, Math.min(left, editorRight - width));
    toolbarR1W9F5.style.left = `${Math.round(left)}px`;
    toolbarR1W9F5.style.top = `${Math.round(top)}px`;
  }

  function setTextToolsOpenR1W9F6(open) {
    if (!toolbarR1W9F5) return;
    toolbarR1W9F5.hidden = !open;
    toolbarR1W9F5.setAttribute('aria-hidden', open ? 'false' : 'true');
    reportWorkbenchHeightV094B();
    if (open) window.requestAnimationFrame(positionTextToolbarR1W9F6);
  }

  function updateTextInteractionToolsR1W9F6B() {
    try {
      const selection = window.getSelection();
      const inside = !!(selection && selection.rangeCount && selectionInsideEditor());
      const hasText = !!(inside && !selection.isCollapsed && String(selection.toString() || '').trim());
      if (hasText) {
        textInteractionActiveR1W9F6B = true;
        saveSelection();
        const block = activeBlockFromSelectionR1W9F6();
        if (block) activeBlockR1W9F6 = block;
        const anchorNode = selection.getRangeAt(0).commonAncestorContainer;
        textAnchorElementR1W9F6B = textElementFromHitR1W9F6B(
          anchorNode.nodeType === Node.ELEMENT_NODE ? anchorNode : anchorNode.parentElement
        ) || textAnchorElementR1W9F6B;
        setTextToolsOpenR1W9F6(true);
        return;
      }
      if (inside && textInteractionActiveR1W9F6B) {
        saveSelection();
        setTextToolsOpenR1W9F6(true);
        return;
      }
      setTextToolsOpenR1W9F6(false);
    } catch {
      setTextToolsOpenR1W9F6(false);
    }
  }

  function scheduleTextInteractionToolsR1W9F6B() {
    if (textInteractionFrameR1W9F6B) cancelAnimationFrame(textInteractionFrameR1W9F6B);
    textInteractionFrameR1W9F6B = requestAnimationFrame(() => {
      textInteractionFrameR1W9F6B = 0;
      requestAnimationFrame(updateTextInteractionToolsR1W9F6B);
    });
  }

  function activateTextToolsFromPointerR1W9F6B(event) {
    const textElement = textElementFromHitR1W9F6B(event && event.target);
    if (!textElement) {
      textInteractionActiveR1W9F6B = false;
      textAnchorElementR1W9F6B = null;
      setTextToolsOpenR1W9F6(false);
      return false;
    }
    textInteractionActiveR1W9F6B = true;
    textAnchorElementR1W9F6B = textElement;
    saveSelection();
    const block = activeBlockFromSelectionR1W9F6() || topLevelBlockFromNodeR1W9F6(textElement);
    if (block) activeBlockR1W9F6 = block;
    setTextToolsOpenR1W9F6(true);
    return true;
  }

  // IRGEZTNE_WIDGET_INSERT_UX_POLISH_R1W9G
  // Component and Widget libraries are contextual insertion popovers. They
  // must open beside the selected structural block instead of at the static
  // top of the Workbench document.
  function positionInsertLibraryPanelR1W9G(panel, rect, shellRect, editorRect, top) {
    if (!panel || panel.hidden) return;
    const panelW = Math.min(620, Math.max(320, editorRect.width - 24));
    let panelLeft = rect.left - shellRect.left;
    panelLeft = Math.max(
      editorRect.left - shellRect.left + 8,
      Math.min(panelLeft, editorRect.right - shellRect.left - panelW - 8)
    );
    panel.style.width = `${Math.round(panelW)}px`;
    panel.style.left = `${Math.round(panelLeft)}px`;
    panel.style.top = `${Math.round(top + 44)}px`;
  }

  function positionBlockChromeR1W9F6() {
    if (!editor || !shell || !blockHandleR1W9F6) return;
    const menuOpen = blockMenuR1W9F6 && !blockMenuR1W9F6.hidden;
    const focusedBlock = editor.contains(document.activeElement) ? activeBlockFromSelectionR1W9F6() : null;
    const block = menuOpen ? activeBlockR1W9F6 : (hoveredBlockR1W9F6 || focusedBlock);
    if (!block || !editor.contains(block)) {
      if (blockMenuR1W9F6 && blockMenuR1W9F6.hidden) blockHandleR1W9F6.hidden = true;
      return;
    }
    const shellRect = shell.getBoundingClientRect();
    const editorRect = editor.getBoundingClientRect();
    const rect = block.getBoundingClientRect();
    const visibleTop = Math.max(0, editorRect.top, widgetHostViewportR1W9H3 ? Number(widgetHostViewportR1W9H3.localTop || 0) : 0);
    const visibleBottom = Math.min(window.innerHeight, editorRect.bottom, widgetHostViewportR1W9H3 ? Number(widgetHostViewportR1W9H3.localBottom || window.innerHeight) : window.innerHeight);
    if (rect.top + 6 < visibleTop || rect.top + 40 > visibleBottom) {
      blockHandleR1W9F6.hidden = true;
      if (blockMenuR1W9F6) blockMenuR1W9F6.hidden = true;
      return;
    }
    const handleW = blockHandleR1W9F6.offsetWidth || 34;
    const left = Math.max(
      editorRect.left - shellRect.left + 8,
      Math.min(editorRect.right - shellRect.left - handleW - 8, rect.right - shellRect.left - handleW - 6)
    );
    const top = rect.top - shellRect.top + 6;
    blockHandleR1W9F6.style.left = `${Math.round(left)}px`;
    blockHandleR1W9F6.style.top = `${Math.round(top)}px`;
    blockHandleR1W9F6.hidden = false;

    if (blockMenuR1W9F6 && !blockMenuR1W9F6.hidden) {
      const menuW = blockMenuR1W9F6.offsetWidth || 220;
      let menuLeft = left + handleW - menuW;
      menuLeft = Math.max(editorRect.left - shellRect.left + 8, menuLeft);
      blockMenuR1W9F6.style.left = `${Math.round(menuLeft)}px`;
      blockMenuR1W9F6.style.top = `${Math.round(top + 40)}px`;
    }

    positionInsertLibraryPanelR1W9G(blocksPanelR1W9F1, rect, shellRect, editorRect, top);
    // R1W9H2: Site Widget management is global; it never follows the block handle.

    if (toolbarR1W9F5 && !toolbarR1W9F5.hidden) positionTextToolbarR1W9F6();
  }

  function adjacentTopLevelBlockR1W9F6(block, direction) {
    if (!block || !block.parentElement || !editor.contains(block)) return null;
    return direction < 0 ? block.previousElementSibling : block.nextElementSibling;
  }

  function moveActiveBlockR1W9F6(direction) {
    const block = activeBlockR1W9F6;
    const sibling = adjacentTopLevelBlockR1W9F6(block, direction);
    if (!block || !sibling || sibling.parentElement !== block.parentElement) return false;
    const parent = block.parentElement;
    recordEditorHistoryBoundaryR1W9F6C('block-move');
    if (direction < 0) parent.insertBefore(block, sibling);
    else parent.insertBefore(sibling, block);
    scheduleSave();
    window.requestAnimationFrame(positionBlockChromeR1W9F6);
    setStatus(localText('block moved', 'блок перемещён'));
    return true;
  }

  function deleteActiveBlockR1W9F6() {
    const block = activeBlockR1W9F6;
    if (!block || !block.parentElement || !editor.contains(block)) return false;
    const ok = window.confirm(localText('Delete this page block?', 'Удалить этот блок страницы?'));
    if (!ok) return false;
    const next = block.nextElementSibling || block.previousElementSibling;
    recordEditorHistoryBoundaryR1W9F6C('block-delete');
    block.remove();
    activeBlockR1W9F6 = next && editor.contains(next) ? next : null;
    hoveredBlockR1W9F6 = null;
    setBlockMenuOpenR1W9F6(false);
    if (blockHandleR1W9F6) blockHandleR1W9F6.hidden = !activeBlockR1W9F6;
    scheduleSave();
    setStatus(localText('block deleted', 'блок удалён'));
    window.requestAnimationFrame(positionBlockChromeR1W9F6);
    return true;
  }

  /*
   * IRGEZTNE_WORKBENCH_SAVE_STATE_V092D
   * Autosave stays active, while the button now reports its real state
   * instead of looking permanently selected.
   */
  function setSaveState(state) {
    if (!saveButton) return;

    const normalized =
      state === 'dirty' || state === 'saving'
        ? state
        : 'saved';

    const labels = {
      dirty: localText('Save changes', 'Сохранить изменения'),
      saving: localText('Saving…', 'Сохранение…'),
      saved: localText('Saved', 'Сохранено')
    };

    saveButton.dataset.saveState = normalized;
    saveButton.textContent = labels[normalized];
    saveButton.disabled = normalized === 'saved';
    saveButton.classList.toggle(
      'is-primary',
      normalized === 'dirty'
    );
  }

  function commitSave() {
    clearTimeout(saveTimer);
    saveTimer = null;
    setSaveState('saving');
    setStatus(localText('saving…', 'сохранение…'));
    send('save');
    setSaveState('saved');
    setStatus(localText('saved', 'сохранено'));
  }

  function esc(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function normalizeUrl(value) {
    let url = String(value || '').trim();
    if (!url || url === 'https://' || url === 'http://') return '';
    if (/^(https?:|mailto:|tel:|#|\/|data:)/i.test(url)) return url;
    return 'https://' + url;
  }

  function isDirectVideo(url) {
    return /\.(mp4|webm|ogg)(\?.*)?$/i.test(
      String(url || '')
    );
  }

  function youtubeEmbedUrl(url) {
    try {
      const parsed = new URL(url);
      const host = parsed.hostname
        .toLowerCase()
        .replace(/^www\./, '');

      let videoId = '';

      if (host === 'youtu.be') {
        videoId = parsed.pathname
          .split('/')
          .filter(Boolean)[0] || '';
      }

      if (
        host === 'youtube.com' ||
        host === 'm.youtube.com'
      ) {
        videoId =
          parsed.searchParams.get('v') ||
          (
            parsed.pathname.match(
              /^\/(?:shorts|embed)\/([^/?#]+)/
            ) || []
          )[1] ||
          '';
      }

      if (!/^[0-9A-Za-z_-]{6,}$/.test(videoId)) {
        return '';
      }

      return (
        'https://www.youtube.com/embed/' +
        encodeURIComponent(videoId)
      );
    } catch {
      return '';
    }
  }

  function vimeoEmbedUrl(url) {
    try {
      const parsed = new URL(url);
      const host = parsed.hostname
        .toLowerCase()
        .replace(/^www\./, '');

      if (
        host !== 'vimeo.com' &&
        host !== 'player.vimeo.com'
      ) {
        return '';
      }

      const match = parsed.pathname.match(
        /(?:video\/)?(\d{5,})/
      );

      if (!match) return '';

      return (
        'https://player.vimeo.com/video/' +
        encodeURIComponent(match[1])
      );
    } catch {
      return '';
    }
  }

  function videoEmbedUrl(url) {
    return youtubeEmbedUrl(url) || vimeoEmbedUrl(url);
  }

  function isWebVideoService(url) {
    return !!videoEmbedUrl(url);
  }

  function videoMarkup(url, caption) {
    caption = String(caption || '').trim() || 'Video';

    if (isDirectVideo(url)) {
      return (
        '<figure class="ewb-video ewb-video--direct is-size-medium is-align-center">' +
          '<video controls preload="metadata" src="' +
            esc(url) +
          '"></video>' +
          '<figcaption>' + esc(caption) + '</figcaption>' +
        '</figure><p><br></p>'
      );
    }

    const embedUrl = videoEmbedUrl(url);

    if (embedUrl) {
      return (
        '<figure class="ewb-video ewb-video--embed is-size-medium is-align-center">' +
          '<div class="ewb-video-frame">' +
            '<iframe' +
              ' src="' + esc(embedUrl) + '"' +
              ' title="' + esc(caption) + '"' +
              ' loading="lazy"' +
              ' allow="accelerometer; autoplay; ' +
                'clipboard-write; encrypted-media; ' +
                'gyroscope; picture-in-picture; web-share"' +
              ' allowfullscreen>' +
            '</iframe>' +
          '</div>' +
          '<figcaption>' + esc(caption) + '</figcaption>' +
        '</figure><p><br></p>'
      );
    }

    return (
      '<figure class="ewb-video-card is-size-medium is-align-center">' +
        '<a href="' + esc(url) + '"' +
          ' target="_blank" rel="noopener">' +
          '▶ ' + esc(caption) +
        '</a>' +
        '<figcaption>' + esc(url) + '</figcaption>' +
      '</figure><p><br></p>'
    );
  }

  function imageMarkup(url, caption, altText) {
    caption = String(caption || '').trim();
    altText = String(
      altText || caption || 'Image'
    ).trim() || 'Image';

    return (
      '<figure class="ewb-image is-size-medium is-align-center">' +
        '<img src="' + esc(url) + '"' +
          ' alt="' + esc(altText) + '">' +
        (
          caption
            ? '<figcaption>' + esc(caption) + '</figcaption>'
            : ''
        ) +
      '</figure><p><br></p>'
    );
  }

  function send(type, extra = {}) {
    window.parent.postMessage({
      source: SOURCE_CHILD,
      type,
      pageId,
      bodyHtml: editorHtmlForSaveV084H(),
      ...extra
    }, '*');
  }

  /* IRGEZTNE_WORKBENCH_GROWING_CANVAS_V094B
     The parent owns scrolling. Workbench reports its real document height so
     the iframe grows with content instead of creating a second scrollbar. */
  function reportWorkbenchHeightV094B() {
    if (heightReportFrameV094B) {
      cancelAnimationFrame(heightReportFrameV094B);
    }

    heightReportFrameV094B = requestAnimationFrame(() => {
      heightReportFrameV094B = 0;
      const height = Math.max(
        720,
        document.documentElement.scrollHeight || 0,
        document.body.scrollHeight || 0,
        shell ? shell.scrollHeight : 0
      );

      window.parent.postMessage({
        source: SOURCE_CHILD,
        type: 'height',
        pageId,
        height
      }, '*');
    });
  }

  function replaceMediaPathsV084H(html, direction) {
    let result = String(html || '');

    mediaAssetsV084H.forEach((asset) => {
      const publicPath = String(
        asset.publicPath || ''
      );

      const previewUrl = String(
        asset.previewUrl || ''
      );

      if (!publicPath || !previewUrl) return;

      const from = direction === 'view'
        ? publicPath
        : previewUrl;

      const to = direction === 'view'
        ? previewUrl
        : publicPath;

      result = result.split(from).join(to);
    });

    return result;
  }

  function editorHtmlForViewV084H(html) {
    return replaceMediaPathsV084H(
      html,
      'view'
    );
  }

  function editorHtmlForSaveV084H() {
    const clone = editor.cloneNode(true);

    clone
      .querySelectorAll('.ewb-media-edit-trigger')
      .forEach((element) => {
        element.remove();
      });

    clone
      .querySelectorAll('.is-media-selected')
      .forEach((element) => {
        element.classList.remove('is-media-selected');
      });


    return replaceMediaPathsV084H(
      clone.innerHTML || '',
      'save'
    );
  }


  // IRGEZTNE_EDITOR_UNIFIED_HISTORY_R1W9F6C
  function editorHistorySnapshotR1W9F6C() {
    return editorHtmlForSaveV084H();
  }

  function trimEditorHistoryR1W9F6C(list) {
    while (list.length > editorHistoryR1W9F6C.limit) list.shift();
  }

  function pushEditorHistorySnapshotR1W9F6C(list, html) {
    const snapshot = String(html || '<p><br></p>');
    if (list.length && list[list.length - 1] === snapshot) return false;
    list.push(snapshot);
    trimEditorHistoryR1W9F6C(list);
    return true;
  }

  function resetEditorHistoryR1W9F6C() {
    editorHistoryR1W9F6C.undo = [];
    editorHistoryR1W9F6C.redo = [];
    editorHistoryR1W9F6C.applying = false;
    editorHistoryR1W9F6C.initialized = true;
    editorHistoryR1W9F6C.lastInputKind = '';
    editorHistoryR1W9F6C.lastInputAt = 0;
  }

  function recordEditorHistoryBoundaryR1W9F6C(kind = '') {
    if (editorHistoryR1W9F6C.applying || !editorHistoryR1W9F6C.initialized) return;
    pushEditorHistorySnapshotR1W9F6C(editorHistoryR1W9F6C.undo, editorHistorySnapshotR1W9F6C());
    editorHistoryR1W9F6C.redo = [];
    editorHistoryR1W9F6C.lastInputKind = String(kind || 'boundary');
    editorHistoryR1W9F6C.lastInputAt = 0;
  }

  function recordEditorHistoryInputBoundaryR1W9F6C(inputType) {
    if (editorHistoryR1W9F6C.applying || !editorHistoryR1W9F6C.initialized) return;
    const raw = String(inputType || 'input');
    const kind = /^(insertText|insertCompositionText|deleteContentBackward|deleteContentForward)$/.test(raw)
      ? 'typing'
      : raw;
    const now = Date.now();
    const isSameBurst =
      kind === 'typing' &&
      editorHistoryR1W9F6C.lastInputKind === 'typing' &&
      now - editorHistoryR1W9F6C.lastInputAt < 900;
    if (!isSameBurst) {
      pushEditorHistorySnapshotR1W9F6C(editorHistoryR1W9F6C.undo, editorHistorySnapshotR1W9F6C());
      editorHistoryR1W9F6C.redo = [];
    }
    editorHistoryR1W9F6C.lastInputKind = kind;
    editorHistoryR1W9F6C.lastInputAt = now;
  }

  function applyEditorHistorySnapshotR1W9F6C(html, statusText) {
    const safeHtml = String(html || '<p><br></p>');
    editorHistoryR1W9F6C.applying = true;
    clearMediaSelectionV084J();
    editor.innerHTML = editorHtmlForViewV084H(safeHtml);
    decorateMediaBlocksV084P(editor);
    htmlField.value = safeHtml;
    savedRange = null;
    activeBlockR1W9F6 = null;
    hoveredBlockR1W9F6 = null;
    setBlockMenuOpenR1W9F6(false);
    if (blockHandleR1W9F6) blockHandleR1W9F6.hidden = true;
    textInteractionActiveR1W9F6B = false;
    textAnchorElementR1W9F6B = null;
    setTextToolsOpenR1W9F6(false);
    editorHistoryR1W9F6C.applying = false;
    editorHistoryR1W9F6C.lastInputKind = '';
    editorHistoryR1W9F6C.lastInputAt = 0;
    scheduleSave();
    reportWorkbenchHeightV094B();
    setStatus(statusText || localText('history restored', 'история восстановлена'));
  }

  function editorUndoR1W9F6C() {
    if (!editorHistoryR1W9F6C.undo.length) {
      setStatus(localText('nothing to undo', 'нечего отменять'));
      return false;
    }
    const current = editorHistorySnapshotR1W9F6C();
    let previous = editorHistoryR1W9F6C.undo.pop();
    while (previous === current && editorHistoryR1W9F6C.undo.length) {
      previous = editorHistoryR1W9F6C.undo.pop();
    }
    if (previous === current) return false;
    pushEditorHistorySnapshotR1W9F6C(editorHistoryR1W9F6C.redo, current);
    applyEditorHistorySnapshotR1W9F6C(previous, localText('undo', 'отмена'));
    return true;
  }

  function editorRedoR1W9F6C() {
    if (!editorHistoryR1W9F6C.redo.length) {
      setStatus(localText('nothing to redo', 'нечего повторять'));
      return false;
    }
    const current = editorHistorySnapshotR1W9F6C();
    let next = editorHistoryR1W9F6C.redo.pop();
    while (next === current && editorHistoryR1W9F6C.redo.length) {
      next = editorHistoryR1W9F6C.redo.pop();
    }
    if (next === current) return false;
    pushEditorHistorySnapshotR1W9F6C(editorHistoryR1W9F6C.undo, current);
    applyEditorHistorySnapshotR1W9F6C(next, localText('redo', 'повтор'));
    return true;
  }

  function applyExternalComponentInsertR1W9F6C(data) {
    const html = String(data && data.bodyHtml || '<p><br></p>');
    editorHistoryR1W9F6C.applying = true;
    clearMediaSelectionV084J();
    editor.innerHTML = editorHtmlForViewV084H(html);
    decorateMediaBlocksV084P(editor);
    htmlField.value = html;
    savedRange = null;
    activeBlockR1W9F6 = null;
    hoveredBlockR1W9F6 = null;
    setBlockMenuOpenR1W9F6(false);
    if (blockHandleR1W9F6) blockHandleR1W9F6.hidden = true;
    editorHistoryR1W9F6C.applying = false;
    editorHistoryR1W9F6C.lastInputKind = '';
    editorHistoryR1W9F6C.lastInputAt = 0;
    setSaveState('saved');
    setStatus(localText('component inserted', 'компонент вставлен'));
    reportWorkbenchHeightV094B();
  }

  // IRGEZTNE_WORKBENCH_VIDEO_ENTRY_V084N
  function requestLocalVideoV084H(caption = '') {
    saveSelection();

    const normalizedCaption = String(
      caption || ''
    ).trim() || 'Video';

    const requestId =
      'video_' +
      Date.now() +
      '_' +
      Math.random().toString(36).slice(2, 8);

    pendingMediaRequestV084H = {
      requestId,
      kind: 'video',
      caption: normalizedCaption
    };

    setStatus('choosing video…');

    send('media-pick-video', {
      requestId
    });
  }

  function requestLocalImageV092C(caption = '') {
    saveSelection();

    const requestId =
      'image_' +
      Date.now() +
      '_' +
      Math.random().toString(36).slice(2, 8);

    pendingMediaRequestV084H = {
      requestId,
      kind: 'image',
      caption: String(caption || '').trim()
    };

    setStatus('choosing image…');

    send('media-pick-image', {
      requestId
    });
  }

  function handleMediaResultV084H(data) {
    if (
      !pendingMediaRequestV084H ||
      data.requestId !==
        pendingMediaRequestV084H.requestId
    ) {
      return;
    }

    const pending = pendingMediaRequestV084H;
    pendingMediaRequestV084H = null;

    if (!data.ok || !data.asset) {
      if (data.canceled) {
        setStatus('ready');
        return;
      }

      setStatus(
        pending.kind === 'image'
          ? 'image import failed'
          : 'video import failed'
      );

      window.alert(
        (
          pending.kind === 'image'
            ? 'Не удалось добавить изображение с компьютера.'
            : 'Не удалось добавить видео с компьютера.'
        ) +
        (
          data.error
            ? '\n' + data.error
            : ''
        )
      );

      return;
    }

    const exists = mediaAssetsV084H.some(
      (asset) => asset &&
        asset.id === data.asset.id
    );

    if (!exists) {
      mediaAssetsV084H.push(data.asset);
    }

    if (pending.kind === 'image') {
      insertHtml(
        imageMarkup(
          data.asset.previewUrl,
          pending.caption,
          data.asset.name || 'Image'
        )
      );
      setStatus('image added');
    } else {
      insertHtml(
        videoMarkup(
          data.asset.previewUrl,
          pending.caption
        )
      );
      setStatus('video added');
    }
  }

  // IRGEZTNE_WORKBENCH_MEDIA_INSPECTOR_V084J
  function mediaBlockFromTargetV084J(target) {
    if (!target || !target.closest) return null;

    const block = target.closest(
      'figure.ewb-image, figure.ewb-video, figure.ewb-video-card'
    );

    return block && editor.contains(block)
      ? block
      : null;
  }

  // IRGEZTNE_MEDIA_EDIT_TRIGGER_V084P
  function decorateMediaBlocksV084P(root = editor) {
    root
      .querySelectorAll(
        'figure.ewb-image, figure.ewb-video, figure.ewb-video-card'
      )
      .forEach((block) => {
        const exists = Array.from(
          block.children
        ).some((child) => {
          return child.classList &&
            child.classList.contains(
              'ewb-media-edit-trigger'
            );
        });

        if (exists) return;

        const button =
          document.createElement('button');

        button.type = 'button';
        button.className =
          'ewb-media-edit-trigger';

        button.dataset.mediaEditTrigger = '1';
        button.contentEditable = 'false';
        button.title = block.matches('figure.ewb-image')
          ? 'Настроить изображение'
          : 'Настроить видео';
        button.setAttribute(
          'aria-label',
          button.title
        );
        button.textContent = '⋯';

        block.appendChild(button);
      });
  }

  function clearMediaSelectionV084J() {
    if (selectedMediaBlockV084J) {
      selectedMediaBlockV084J.classList.remove(
        'is-media-selected'
      );
    }

    selectedMediaBlockV084J = null;
    mediaKeyboardArmedV084N = false;

    if (mediaInspectorV084J) {
      mediaInspectorV084J.hidden = true;
    }
  }

  function deleteSelectedMediaV084J() {
    if (
      !selectedMediaBlockV084J ||
      !selectedMediaBlockV084J.isConnected
    ) {
      clearMediaSelectionV084J();
      return false;
    }

    const block = selectedMediaBlockV084J;

    recordEditorHistoryBoundaryR1W9F6C('media-delete');
    clearMediaSelectionV084J();
    block.remove();

    scheduleSave();
    setStatus('media deleted');

    return true;
  }

  function setSelectedMediaSizeV084J(size) {
    if (!selectedMediaBlockV084J) return;

    recordEditorHistoryBoundaryR1W9F6C('media-size');
    selectedMediaBlockV084J.classList.remove(
      'is-size-small',
      'is-size-medium',
      'is-size-large',
      'is-size-full'
    );

    selectedMediaBlockV084J.classList.add(
      'is-size-' + size
    );

    scheduleSave();
    setStatus('media resized');
  }

  function setSelectedMediaAlignV084J(align) {
    if (!selectedMediaBlockV084J) return;

    recordEditorHistoryBoundaryR1W9F6C('media-align');
    selectedMediaBlockV084J.classList.remove(
      'is-align-left',
      'is-align-center',
      'is-align-right'
    );

    selectedMediaBlockV084J.classList.add(
      'is-align-' + align
    );

    scheduleSave();
    setStatus('media aligned');
  }

  function selectedMovableBlockV094B() {
    if (!selectedMediaBlockV084J) return null;

    let movable = selectedMediaBlockV084J;
    const parent = movable.parentElement;

    if (
      parent &&
      parent !== editor &&
      /^(P|DIV)$/.test(parent.tagName || '') &&
      parent.querySelectorAll(
        'figure.ewb-image, figure.ewb-video, figure.ewb-video-card'
      ).length === 1 &&
      !String(parent.textContent || '').trim()
    ) {
      movable = parent;
    }

    return movable;
  }

  function moveSelectedMediaV094B(direction) {
    const movable = selectedMovableBlockV094B();
    if (!movable || !movable.parentNode) return false;

    const sibling = direction === 'up'
      ? movable.previousElementSibling
      : movable.nextElementSibling;

    if (!sibling) {
      setStatus(localText('media is already at the edge', 'медиа уже у края'));
      return false;
    }

    recordEditorHistoryBoundaryR1W9F6C('media-move');
    if (direction === 'up') {
      movable.parentNode.insertBefore(movable, sibling);
    } else {
      movable.parentNode.insertBefore(sibling, movable);
    }

    scheduleSave();
    reportWorkbenchHeightV094B();
    requestAnimationFrame(positionMediaInspectorV084O);
    setStatus(localText('media moved', 'медиа перемещено'));
    return true;
  }

  function ensureMediaInspectorV084J() {
    if (
      mediaInspectorV084J &&
      mediaInspectorV084J.isConnected
    ) {
      return mediaInspectorV084J;
    }

    const inspector = document.createElement('div');

    inspector.className = 'ewb-media-inspector';
    inspector.hidden = true;

    inspector.innerHTML = `
      <button
        type="button"
        data-media-command="delete"
        title="${localText('Delete media', 'Удалить медиа')}"
      >${localText('Delete', 'Удалить')}</button>

      <button
        type="button"
        data-media-command="move-up"
        title="${localText('Move block up', 'Переместить блок выше')}"
      >↑</button>

      <button
        type="button"
        data-media-command="move-down"
        title="${localText('Move block down', 'Переместить блок ниже')}"
      >↓</button>

      <span class="ewb-media-inspector-separator"></span>

      <button type="button" data-media-size="small">S</button>
      <button type="button" data-media-size="medium">M</button>
      <button type="button" data-media-size="large">L</button>
      <button type="button" data-media-size="full">100%</button>

      <span class="ewb-media-inspector-separator"></span>

      <button
        type="button"
        data-media-align="left"
        title="Слева"
      >←</button>

      <button
        type="button"
        data-media-align="center"
        title="По центру"
      >↔</button>

      <button
        type="button"
        data-media-align="right"
        title="Справа"
      >→</button>

      <button
        type="button"
        data-media-command="close"
        title="Закрыть"
      >×</button>
    `;

    inspector.addEventListener('click', (event) => {
      const button = event.target.closest('button');

      if (!button) return;

      event.preventDefault();
      event.stopPropagation();

      const command =
        button.dataset.mediaCommand || '';

      if (command === 'close') {
        clearMediaSelectionV084J();
        return;
      }

      if (command === 'delete') {
        deleteSelectedMediaV084J();
        return;
      }

      if (command === 'move-up' || command === 'move-down') {
        moveSelectedMediaV094B(
          command === 'move-up' ? 'up' : 'down'
        );
        return;
      }

      const size = button.dataset.mediaSize || '';

      if (size) {
        setSelectedMediaSizeV084J(size);
        return;
      }

      const align = button.dataset.mediaAlign || '';

      if (align) {
        setSelectedMediaAlignV084J(align);
      }
    });

    document.body.appendChild(inspector);
    mediaInspectorV084J = inspector;

    return inspector;
  }

  // IRGEZTNE_MEDIA_SELECTION_V084O
  function positionMediaInspectorV084O() {
    if (
      !selectedMediaBlockV084J ||
      !selectedMediaBlockV084J.isConnected ||
      !mediaInspectorV084J ||
      mediaInspectorV084J.hidden
    ) {
      return;
    }

    const blockRect =
      selectedMediaBlockV084J.getBoundingClientRect();

    const inspectorRect =
      mediaInspectorV084J.getBoundingClientRect();

    const margin = 12;
    const gap = 10;

    let left =
      blockRect.left +
      blockRect.width / 2;

    const halfWidth =
      inspectorRect.width / 2;

    left = Math.max(
      halfWidth + margin,
      Math.min(
        window.innerWidth -
          halfWidth -
          margin,
        left
      )
    );

    let top =
      blockRect.bottom + gap;

    if (
      top +
      inspectorRect.height >
      window.innerHeight - margin
    ) {
      top =
        blockRect.top -
        inspectorRect.height -
        gap;
    }

    top = Math.max(
      margin,
      Math.min(
        window.innerHeight -
          inspectorRect.height -
          margin,
        top
      )
    );

    mediaInspectorV084J.style.left =
      left + 'px';

    mediaInspectorV084J.style.top =
      top + 'px';
  }

  function selectMediaBlockV084J(block) {
    if (
      selectedMediaBlockV084J &&
      selectedMediaBlockV084J !== block
    ) {
      selectedMediaBlockV084J.classList.remove(
        'is-media-selected'
      );
    }

    selectedMediaBlockV084J = block || null;
    if (selectedMediaBlockV084J) {
      activeBlockR1W9F6 = null;
      hoveredBlockR1W9F6 = null;
      setBlockMenuOpenR1W9F6(false);
      if (blockHandleR1W9F6) blockHandleR1W9F6.hidden = true;
      textInteractionActiveR1W9F6B = false;
      textAnchorElementR1W9F6B = null;
      setTextToolsOpenR1W9F6(false);
    }
    mediaKeyboardArmedV084N =
      !!selectedMediaBlockV084J;

    const inspector = ensureMediaInspectorV084J();

    if (!selectedMediaBlockV084J) {
      inspector.hidden = true;
      return;
    }

    selectedMediaBlockV084J.classList.add(
      'is-media-selected'
    );

    inspector.hidden = false;

    positionMediaInspectorV084O();

    requestAnimationFrame(
      positionMediaInspectorV084O
    );
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    setSaveState('dirty');
    setStatus(localText('changes…', 'есть изменения…'));
    saveTimer = setTimeout(() => {
      commitSave();
    }, 250);
    reportWorkbenchHeightV094B();
  }

  function selectionInsideEditor() {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return false;
    const node = selection.anchorNode;
    return !!(node && editor.contains(node.nodeType === 1 ? node : node.parentNode));
  }

  function saveSelection() {
    try {
      const selection = window.getSelection();
      if (!selection || !selection.rangeCount || !selectionInsideEditor()) return;
      savedRange = selection.getRangeAt(0).cloneRange();
    } catch {}
  }

  // IRGEZTNE_WORKBENCH_COMPONENT_INSERT_BY_BLOCK_R1W9F6
  // Component placement is structural. The active top-level page block is the
  // source of truth; text caret geometry is never used to choose a component
  // insertion boundary.
  function editorCloneForComponentPlacementR1W9F6() {
    const clone = editor.cloneNode(true);
    clone.querySelectorAll('.ewb-media-edit-trigger').forEach((element) => element.remove());
    clone.querySelectorAll('.is-media-selected').forEach((element) => element.classList.remove('is-media-selected'));
    return clone;
  }

  function componentPlacementPayloadR1W9F6() {
    if (!activeBlockR1W9F6 || !activeBlockR1W9F6.parentElement || !editor.contains(activeBlockR1W9F6)) return null;
    const token =
      '__IRGEZTNE_COMPONENT_INSERT_' +
      Date.now().toString(36) + '_' +
      Math.random().toString(36).slice(2, 10) +
      '__';
    const clone = editorCloneForComponentPlacementR1W9F6();
    const marker = document.createTextNode(token);
    const path = [];
    let cursor = activeBlockR1W9F6;
    while (cursor && cursor !== editor) {
      const parent = cursor.parentElement;
      if (!parent) return null;
      const index = Array.prototype.indexOf.call(parent.children, cursor);
      if (index < 0) return null;
      path.unshift(index);
      cursor = parent;
    }
    if (cursor !== editor) return null;
    let cloneBlock = clone;
    for (const index of path) {
      cloneBlock = cloneBlock && cloneBlock.children ? cloneBlock.children[index] : null;
    }
    if (!cloneBlock || !cloneBlock.parentNode) return null;
    cloneBlock.parentNode.insertBefore(marker, cloneBlock.nextSibling);
    return {
      componentPlacementHtml: replaceMediaPathsV084H(clone.innerHTML || '', 'save'),
      insertionMarkerToken: token,
      insertionPlacement: 'after-selected-block'
    };
  }

  // R1W9H: no Widget insertion marker is generated from page.bodyHtml.

  function restoreSelection() {
    try {
      if (!savedRange) return false;
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(savedRange);
      return true;
    } catch {
      return false;
    }
  }

  function focusEditor() {
    editor.focus();
    restoreSelection();
    return editor;
  }

  function selectedText() {
    try {
      restoreSelection();
      const selection = window.getSelection();
      return selection ? String(selection.toString() || '') : '';
    } catch {
      return '';
    }
  }

  // IRGEZTNE_V084F_RELIABLE_UNLINK
  function closestLinkFromNodeV084F(node) {
    if (!node) return null;
    const element = node.nodeType === 1 ? node : node.parentElement;
    return element && element.closest ? element.closest('a') : null;
  }

  function unwrapLinkV084F(link) {
    if (!link || !link.parentNode) return false;
    const parent = link.parentNode;
    while (link.firstChild) {
      parent.insertBefore(link.firstChild, link);
    }
    parent.removeChild(link);
    return true;
  }

  function removeCurrentLinkV084F() {
    focusEditor();
    restoreSelection();

    try {
      const selection = window.getSelection();
      if (!selection || !selection.rangeCount) return false;

      const range = selection.getRangeAt(0);
      let link =
        closestLinkFromNodeV084F(selection.anchorNode) ||
        closestLinkFromNodeV084F(selection.focusNode) ||
        closestLinkFromNodeV084F(range.commonAncestorContainer);

      if (link && editor.contains(link)) {
        recordEditorHistoryBoundaryR1W9F6C('unlink');
        unwrapLinkV084F(link);
        savedRange = null;
        scheduleSave();
        setStatus('link removed');
        return true;
      }

      recordEditorHistoryBoundaryR1W9F6C('unlink');
      document.execCommand('unlink', false, null);
      saveSelection();
      scheduleSave();
      setStatus('link removed');
      return true;
    } catch (error) {
      console.warn('Editor unlink failed', error);
      return false;
    }
  }

  function exec(command, value = null) {
    if (command === 'undo') return editorUndoR1W9F6C();
    if (command === 'redo') return editorRedoR1W9F6C();
    focusEditor();
    try {
      recordEditorHistoryBoundaryR1W9F6C('command:' + command);
      document.execCommand(command, false, value);
      saveSelection();
      scheduleSave();
      return true;
    } catch (error) {
      console.warn('Editor command failed', command, error);
      return false;
    }
  }

  function insertHtml(html) {
    focusEditor();
    try {
      recordEditorHistoryBoundaryR1W9F6C('insert-html');
      document.execCommand('insertHTML', false, html);
      decorateMediaBlocksV084P(editor);
      saveSelection();
      scheduleSave();
      return true;
    } catch (error) {
      console.warn('Editor insert failed', error);
      return false;
    }
  }

  function fragmentHasVisibleContentV094B(fragment) {
    if (!fragment) return false;
    if (String(fragment.textContent || '').trim()) return true;
    return !!fragment.querySelector &&
      !!fragment.querySelector('img,video,iframe,figure,hr,br');
  }

  function splitSelectedTextIntoBlockV094B(tag) {
    restoreSelection();
    const selection = window.getSelection();

    if (!selection || !selection.rangeCount || selection.isCollapsed) {
      return false;
    }

    const range = selection.getRangeAt(0);
    const startElement = range.startContainer.nodeType === 1
      ? range.startContainer
      : range.startContainer.parentElement;
    const endElement = range.endContainer.nodeType === 1
      ? range.endContainer
      : range.endContainer.parentElement;
    const startBlock = startElement && startElement.closest
      ? startElement.closest('p,h1,h2,h3,h4,h5,h6,blockquote')
      : null;
    const endBlock = endElement && endElement.closest
      ? endElement.closest('p,h1,h2,h3,h4,h5,h6,blockquote')
      : null;

    if (
      !startBlock ||
      startBlock !== endBlock ||
      !editor.contains(startBlock)
    ) {
      return false;
    }

    try {
      recordEditorHistoryBoundaryR1W9F6C('format-block-selection');
      const beforeRange = document.createRange();
      beforeRange.selectNodeContents(startBlock);
      beforeRange.setEnd(range.startContainer, range.startOffset);

      const afterRange = document.createRange();
      afterRange.selectNodeContents(startBlock);
      afterRange.setStart(range.endContainer, range.endOffset);

      const beforeContent = beforeRange.cloneContents();
      const selectedContent = range.cloneContents();
      const afterContent = afterRange.cloneContents();
      const output = document.createDocumentFragment();

      if (fragmentHasVisibleContentV094B(beforeContent)) {
        const beforeBlock = startBlock.cloneNode(false);
        beforeBlock.appendChild(beforeContent);
        output.appendChild(beforeBlock);
      }

      const selectedBlock = document.createElement(tag);
      selectedBlock.appendChild(selectedContent);
      output.appendChild(selectedBlock);

      if (fragmentHasVisibleContentV094B(afterContent)) {
        const afterBlock = startBlock.cloneNode(false);
        afterBlock.appendChild(afterContent);
        output.appendChild(afterBlock);
      }

      startBlock.parentNode.replaceChild(output, startBlock);

      const nextRange = document.createRange();
      nextRange.selectNodeContents(selectedBlock);
      selection.removeAllRanges();
      selection.addRange(nextRange);
      savedRange = nextRange.cloneRange();
      scheduleSave();
      reportWorkbenchHeightV094B();
      return true;
    } catch (error) {
      console.warn('Editor selected block split failed', error);
      return false;
    }
  }

  function block(tag) {
    tag = String(tag || 'p').toLowerCase();
    focusEditor();
    try {
      if (splitSelectedTextIntoBlockV094B(tag)) {
        return;
      }
      recordEditorHistoryBoundaryR1W9F6C('format-block');
      document.execCommand('formatBlock', false, tag);
      saveSelection();
      scheduleSave();
    } catch (error) {
      console.warn('Editor block failed', tag, error);
    }
  }

  function applyHtmlToVisual() {
    recordEditorHistoryBoundaryR1W9F6C('html-apply');
    editor.innerHTML = editorHtmlForViewV084H(
      htmlField.value || '<p><br></p>'
    );
    htmlPanel.hidden = true;
    focusEditor();
    saveSelection();
    commitSave();
  }

  function toggleHtml() {
    if (htmlPanel.hidden) {
      htmlField.value = editorHtmlForSaveV084H();
      htmlPanel.hidden = false;
      htmlField.focus();
      setStatus('html');
    } else {
      applyHtmlToVisual();
    }
  }

  function ensureDialog() {
    let dialog = document.getElementById('ewbDialog');
    if (dialog) return dialog;

    dialog = document.createElement('section');
    dialog.id = 'ewbDialog';
    dialog.className = 'ewb-dialog';
    dialog.hidden = true;
    dialog.innerHTML = `
      <div class="ewb-dialog-card" role="dialog" aria-modal="false">
        <header class="ewb-dialog-head">
          <strong id="ewbDialogTitle">Insert</strong>
          <button type="button" class="ewb-dialog-close" data-dialog-close="1" title="Close / Закрыть">×</button>
        </header>
        <div class="ewb-dialog-body" data-dialog-body="1"></div>
        <footer class="ewb-dialog-foot">
          <button type="button" data-dialog-apply="1" class="is-primary">Insert / Вставить</button>
          <button type="button" data-dialog-close="1">Cancel / Отмена</button>
        </footer>
      </div>
    `;
    (shell || document.body).appendChild(dialog);

    dialog.addEventListener('click', (event) => {
      const close = event.target.closest('[data-dialog-close]');
      if (close) {
        closeDialog();
        return;
      }

      const emoji = event.target.closest('[data-emoji-value]');
      if (emoji) {
        insertHtml(esc(emoji.dataset.emojiValue || ''));
        closeDialog();
        return;
      }

      const swatch = event.target.closest('[data-color-value]');
      if (swatch) {
        const color = swatch.dataset.colorValue || '';
        if (dialogMode === 'color') exec('foreColor', color);
        if (dialogMode === 'highlight') exec('hiliteColor', color);
        closeDialog();
        return;
      }

      const apply = event.target.closest('[data-dialog-apply]');
      if (apply) applyDialog();
    });

    dialog.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeDialog();
      if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) applyDialog();
    });

    return dialog;
  }

  function closeDialog() {
    const dialog = ensureDialog();
    dialog.hidden = true;
    dialogMode = '';
    dialogAnchorR1W9F6C = null;
    focusEditor();
    reportWorkbenchHeightV094B();
  }

  function positionDialogPopoverR1W9F6C() {
    const dialog = ensureDialog();
    if (dialog.hidden || !shell) return;
    const shellRect = shell.getBoundingClientRect();
    const anchor = dialogAnchorR1W9F6C && dialogAnchorR1W9F6C.isConnected
      ? dialogAnchorR1W9F6C.getBoundingClientRect()
      : (toolbarR1W9F5 && !toolbarR1W9F5.hidden ? toolbarR1W9F5.getBoundingClientRect() : null);
    if (!anchor) return;
    const width = Math.min(560, Math.max(280, shell.clientWidth - 28));
    dialog.style.width = `${Math.round(width)}px`;
    const cardHeight = dialog.offsetHeight || 220;
    const minLeft = 14;
    const maxLeft = Math.max(minLeft, shell.clientWidth - width - 14);
    let left = anchor.left - shellRect.left;
    left = Math.max(minLeft, Math.min(left, maxLeft));
    let top = anchor.bottom - shellRect.top + 8;
    const editorTop = editor ? editor.getBoundingClientRect().top - shellRect.top : 0;
    if (top < editorTop) top = editorTop + 8;
    dialog.style.left = `${Math.round(left)}px`;
    dialog.style.top = `${Math.round(top)}px`;
  }

  function dialogInput(name) {
    return ensureDialog().querySelector(`[data-field="${name}"]`);
  }

  function paletteHtml() {
    return `<div class="ewb-color-grid">${PALETTE.map(color => `<button type="button" style="--swatch:${esc(color)}" data-color-value="${esc(color)}" title="${esc(color)}"></button>`).join('')}</div>
      <label>Pick color <input data-field="nativeColor" type="color" value="#60a5fa"></label>
      <label>Custom color <input data-field="customColor" type="text" placeholder="#60a5fa"></label>`;
  }

  function openDialog(mode, anchorElement = null) {
    saveSelection();
    dialogAnchorR1W9F6C = anchorElement && anchorElement.isConnected ? anchorElement : null;
    dialogMode = mode;
    const dialog = ensureDialog();
    const heading = dialog.querySelector('#ewbDialogTitle');
    const body = dialog.querySelector('[data-dialog-body]');
    const applyBtn = dialog.querySelector('[data-dialog-apply]');
    const selected = selectedText();

    applyBtn.hidden = false;

    if (mode === 'link') {
      heading.textContent = 'Insert link / Вставить ссылку';
      body.innerHTML = `
        <label>URL <input data-field="url" type="url" placeholder="https://example.com"></label>
        <label>Text / Текст <input data-field="text" type="text" placeholder="${esc(selected || 'Link text')}"></label>
        <p class="ewb-dialog-note">If text is empty, selected text will become the link.</p>
      `;
    }

    if (mode === 'image') {
      heading.textContent = 'Insert image / Вставить изображение';
      body.innerHTML = `
        <label>Image URL <input data-field="url" type="url" placeholder="https://example.com/image.jpg"></label>
        <label>Caption / Alt <input data-field="caption" type="text" placeholder="Image caption"></label>
      `;
    }

    if (mode === 'video') {
      heading.textContent =
        'Видео по ссылке / Video URL';

      body.innerHTML = `
        <label>
          Video URL / Ссылка
          <input
            data-field="url"
            type="url"
            placeholder="https://youtube.com/watch?v=..."
          >
        </label>

        <label>
          Caption / Подпись
          <input
            data-field="caption"
            type="text"
            placeholder="Video"
          >
        </label>

        <p class="ewb-dialog-note">
          YouTube, Vimeo и прямые ссылки остаются
          внешними встраиваниями.
        </p>
      `;
    }

    if (mode === 'emoji') {
      heading.textContent = 'Symbol / emoji';
      body.innerHTML = `
        <div class="ewb-emoji-grid">
          ${['🙂','😀','✨','🚀','✅','📌','🔥','🌿','💡','⭐','→','—','©','®','™','§','№','•','✓','✕'].map(item => `<button type="button" data-emoji-value="${esc(item)}">${esc(item)}</button>`).join('')}
        </div>
        <label>Custom <input data-field="custom" type="text" placeholder="🙂"></label>
      `;
    }

    if (mode === 'color') {
      heading.textContent = 'Text color / Цвет текста';
      body.innerHTML = paletteHtml();
    }

    if (mode === 'highlight') {
      heading.textContent = 'Marker color / Цвет маркера';
      body.innerHTML = paletteHtml();
    }

    dialog.hidden = false;
    positionDialogPopoverR1W9F6C();
    reportWorkbenchHeightV094B();
    setTimeout(() => {
      const first = dialog.querySelector('input, button[data-emoji-value], button[data-color-value]');
      if (first) first.focus();
    }, 20);
  }

  function applyDialog() {
    if (!dialogMode) return;

    if (dialogMode === 'link') {
      const url = normalizeUrl(dialogInput('url')?.value || '');
      const customText = String(dialogInput('text')?.value || '').trim();
      const selected = selectedText();

      if (!url) {
        dialogInput('url')?.focus();
        return;
      }

      if (selected && !customText) exec('createLink', url);
      else insertHtml(`<a href="${esc(url)}">${esc(customText || selected || url)}</a>`);
      closeDialog();
      return;
    }

    if (dialogMode === 'image') {
      const url = normalizeUrl(dialogInput('url')?.value || '');
      const caption = String(dialogInput('caption')?.value || '').trim();

      if (!url) {
        dialogInput('url')?.focus();
        return;
      }

      insertHtml(imageMarkup(url, caption));
      closeDialog();
      return;
    }

    if (dialogMode === 'video') {
      const url = normalizeUrl(dialogInput('url')?.value || '');
      const caption = String(dialogInput('caption')?.value || '').trim() || 'Video';

      if (!url) {
        dialogInput('url')?.focus();
        return;
      }

      insertHtml(videoMarkup(url, caption));
      closeDialog();
      return;
    }

    if (dialogMode === 'emoji') {
      const custom = String(dialogInput('custom')?.value || '').trim();
      if (custom) insertHtml(esc(custom));
      closeDialog();
      return;
    }

    if (dialogMode === 'color' || dialogMode === 'highlight') {
      const nativeColor = String(dialogInput('nativeColor')?.value || '').trim();
      const customColor = String(dialogInput('customColor')?.value || '').trim();
      const color = customColor || nativeColor;
      if (!/^#[0-9a-f]{3,8}$/i.test(color)) {
        (dialogInput('customColor') || dialogInput('nativeColor'))?.focus();
        return;
      }
      exec(dialogMode === 'color' ? 'foreColor' : 'hiliteColor', color);
      closeDialog();
    }
  }

  function initToolbarTitles() {
    Object.keys(TOOL_TITLES).forEach((selector) => {
      const list = document.querySelectorAll(selector);
      list.forEach((el) => {
        el.title = TOOL_TITLES[selector];
        el.setAttribute('aria-label', TOOL_TITLES[selector]);
      });
    });
  }

  if (blockSelect) {
    blockSelect.addEventListener('change', () => {
      const tag = String(blockSelect.value || '').toLowerCase();
      if (!tag) return;
      block(tag);
      blockSelect.value = '';
    });
  }

  // IRGEZTNE_WORKBENCH_CONTENT_FIRST_EVENTS_R1W9F6
  // Pointer clicks on chrome never steal an existing text selection.
  document.addEventListener('mousedown', (event) => {
    const chrome = event.target && event.target.closest
      ? event.target.closest('#ewbToolbar button, #ewbBlocksPanel button, #ewbWidgetsPanel button, #ewbBlockHandle, #ewbBlockMenu button')
      : null;
    if (!chrome || chrome.closest('#ewbDialog')) return;
    if (selectionInsideEditor()) saveSelection();
    event.preventDefault();
  });

  document.addEventListener('mousedown', (event) => {
    const inside = event.target && event.target.closest
      ? event.target.closest('#ewbToolbar, #ewbBlocksPanel, #ewbWidgetsPanel, #ewbBlockHandle, #ewbBlockMenu, #ewbEditor')
      : null;
    const insideWidgetManagement = event.target && event.target.closest
      ? event.target.closest('#ewbWidgetsPanel, [data-action="widgets-open-r1w9h"]')
      : null;
    if (!insideWidgetManagement && widgetsPanelR1W9G && !widgetsPanelR1W9G.hidden) {
      setWidgetsPanelOpenR1W9G(false);
    }
    if (!inside) {
      setBlockMenuOpenR1W9F6(false);
      textInteractionActiveR1W9F6B = false;
      textAnchorElementR1W9F6B = null;
      setTextToolsOpenR1W9F6(false);
      hoveredBlockR1W9F6 = null;
      if (blockHandleR1W9F6) blockHandleR1W9F6.hidden = true;
    }
  });

  document.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button || button.closest('#ewbDialog')) return;

    event.preventDefault();

    if (button.dataset.cmd) {
      if (button.dataset.cmd === 'unlink') {
        removeCurrentLinkV084F();
        return;
      }
      exec(button.dataset.cmd);
      return;
    }

    if (button.dataset.block) {
      block(button.dataset.block);
      return;
    }

    const action = button.dataset.action || '';

    if (action === 'tools-close') {
      restoreSelection();
      try {
        const selection = window.getSelection();
        if (selection && selection.rangeCount) selection.collapseToEnd();
      } catch {}
      savedRange = null;
      textInteractionActiveR1W9F6B = false;
      textAnchorElementR1W9F6B = null;
      setTextToolsOpenR1W9F6(false);
      return;
    }

    if (action === 'block-menu-toggle') {
      textInteractionActiveR1W9F6B = false;
      textAnchorElementR1W9F6B = null;
      setTextToolsOpenR1W9F6(false);
      setBlockMenuOpenR1W9F6(!!blockMenuR1W9F6 && blockMenuR1W9F6.hidden);
      return;
    }

    if (action === 'block-insert-after') {
      if (!activeBlockR1W9F6) return;
      renderInstalledComponentsR1W9F1();
      setBlockMenuOpenR1W9F6(false);
      setBlocksPanelOpenR1W9F1(true);
      return;
    }

    if (action === 'widgets-open-r1w9h') {
      renderInstalledWidgetsR1W9G();
      renderWidgetInstancesR1W9H();
      setBlockMenuOpenR1W9F6(false);
      setWidgetsPanelOpenR1W9G(true);
      window.requestAnimationFrame(positionWidgetsPanelR1W9H2);
      return;
    }

    if (action === 'block-move-up') {
      moveActiveBlockR1W9F6(-1);
      setBlockMenuOpenR1W9F6(false);
      return;
    }

    if (action === 'block-move-down') {
      moveActiveBlockR1W9F6(1);
      setBlockMenuOpenR1W9F6(false);
      return;
    }

    if (action === 'block-delete') {
      deleteActiveBlockR1W9F6();
      return;
    }

    if (action === 'blocks-close') {
      setBlocksPanelOpenR1W9F1(false);
      return;
    }

    if (action === 'component-insert-r1w9f1') {
      const packageId = String(button.dataset.packageId || '');
      if (!packageId || !activeBlockR1W9F6) return;
      const placement = componentPlacementPayloadR1W9F6();
      if (!placement) return;
      recordEditorHistoryBoundaryR1W9F6C('component-insert');
      send('component-insert-r1w9f1', { packageId, ...placement, historyHandshake: 'r1w9f6c' });
      setStatus(localText('inserting after selected block…', 'вставка после выбранного блока…'));
      setBlocksPanelOpenR1W9F1(false);
      return;
    }

    if (action === 'widgets-close-r1w9h') {
      setWidgetsPanelOpenR1W9G(false);
      return;
    }

    if (action === 'widget-configure-r1w9h') {
      const packageId = String(button.dataset.packageId || '');
      const item = installedWidgetByPackageIdR1W9H(packageId);
      if (!item) return;
      beginWidgetConfigurationR1W9H(item, null);
      return;
    }

    if (action === 'widget-config-cancel-r1w9h') {
      if (widgetSubmitPendingR1W9H) return;
      if (widgetConfigR1W9H) { widgetConfigR1W9H.hidden = true; widgetConfigR1W9H.replaceChildren(); }
      widgetDraftR1W9H = null;
      reportWorkbenchHeightV094B();
      return;
    }

    if (action === 'widget-add-confirm-r1w9h' || action === 'widget-update-confirm-r1w9h') {
      if (widgetSubmitPendingR1W9H) return;
      const draft = collectWidgetDraftR1W9H();
      if (!draft || !widgetDraftR1W9H) return;
      const isUpdate = action === 'widget-update-confirm-r1w9h' && !!widgetDraftR1W9H.instanceId;
      widgetSubmitPendingR1W9H = {
        action: isUpdate ? 'update' : 'add',
        instanceId: String(widgetDraftR1W9H.instanceId || ''),
        packageId: String(widgetDraftR1W9H.packageId || '')
      };
      const confirmButton = widgetConfigR1W9H && widgetConfigR1W9H.querySelector('[data-action="' + action + '"]');
      const cancelButton = widgetConfigR1W9H && widgetConfigR1W9H.querySelector('[data-action="widget-config-cancel-r1w9h"]');
      if (confirmButton) {
        confirmButton.disabled = true;
        confirmButton.setAttribute('aria-busy', 'true');
        confirmButton.textContent = isUpdate ? localText('Saving…', 'Сохранение…') : localText('Adding…', 'Добавление…');
      }
      if (cancelButton) cancelButton.disabled = true;
      if (isUpdate) {
        send('widget-update-r1w9h', { instanceId: widgetDraftR1W9H.instanceId, widgetSettings: draft.settings, widgetPlacement: draft.placement });
        setStatus(localText('saving Widget changes…', 'сохранение изменений виджета…'));
      } else {
        send('widget-add-r1w9h', { packageId: widgetDraftR1W9H.packageId, widgetSettings: draft.settings, widgetPlacement: draft.placement });
        setStatus(localText('adding Widget to site…', 'добавление виджета на сайт…'));
      }
      return;
    }

    if (action === 'widget-instance-edit-r1w9h') {
      const instance = widgetInstanceByIdR1W9H(button.dataset.instanceId || '');
      if (!instance) return;
      const snapshot = widgetSnapshotByIdR1W9G(instance.sourceSnapshotId);
      const installed = installedWidgetByPackageIdR1W9H(instance.packageId);
      const item = installed || (snapshot ? {
        packageId: instance.packageId, title: instance.title || snapshot.title, version: instance.version || snapshot.version,
        authorLabel: snapshot.authorLabel || '', category: instance.category || snapshot.category || '', description: '', widget: snapshot.widget
      } : null);
      if (!item) return;
      setWidgetsPanelOpenR1W9G(true);
      beginWidgetConfigurationR1W9H(item, instance);
      return;
    }

    if (action === 'widget-instance-remove-r1w9h') {
      const instanceId = String(button.dataset.instanceId || '');
      if (!instanceId) return;
      if (!window.confirm(localText('Remove this Widget from the site?', 'Удалить этот Widget с сайта?'))) return;
      send('widget-remove-r1w9h', { instanceId });
      setStatus(localText('removing Widget…', 'удаление Widget…'));
      return;
    }

    if (action === 'link') return openDialog('link', button);
    if (action === 'image') { requestLocalImageV092C(); return; }
    if (action === 'image-url') { openDialog('image', button); return; }
    if (action === 'video') { requestLocalVideoV084H(); return; }
    if (action === 'video-url') { openDialog('video', button); return; }
    if (action === 'emoji') return openDialog('emoji', button);
    if (action === 'color') return openDialog('color', button);
    if (action === 'highlight') return openDialog('highlight', button);

    if (action === 'divider') { insertHtml('<hr><p><br></p>'); return; }
    if (action === 'code') { insertHtml('<pre><code>Code</code></pre><p><br></p>'); return; }
    if (action === 'html') { toggleHtml(); return; }
    if (action === 'html-apply') { applyHtmlToVisual(); return; }
    if (action === 'html-close') { htmlPanel.hidden = true; focusEditor(); return; }
    if (action === 'save') { commitSave(); return; }
    if (action === 'preview') {
      send('preview');
      setStatus('preview');
    }
  });

  document.addEventListener(
    'pointerdown',
    (event) => {
      const inspector =
        mediaInspectorV084J;

      if (
        inspector &&
        inspector.contains(event.target)
      ) {
        return;
      }

      const trigger =
        event.target &&
        event.target.closest
          ? event.target.closest(
              '[data-media-edit-trigger]'
            )
          : null;

      if (trigger) {
        const block =
          mediaBlockFromTargetV084J(trigger);

        if (block) {
          event.preventDefault();
          event.stopPropagation();
          selectMediaBlockV084J(block);
        }

        return;
      }

      const block =
        mediaBlockFromTargetV084J(
          event.target
        );

      if (block) {
        /*
         * URL/embed выбирается кликом по рамке.
         * У локального MP4 клик остаётся управлением
         * воспроизведением; инструменты открывает ⋯.
         */
        if (
          block.matches(
            'figure.ewb-image,' +
            'figure.ewb-video--embed,' +
            'figure.ewb-video-card'
          )
        ) {
          event.preventDefault();
          selectMediaBlockV084J(block);
          return;
        }

        if (
          block === selectedMediaBlockV084J
        ) {
          positionMediaInspectorV084O();
        }

        return;
      }

      if (selectedMediaBlockV084J) {
        clearMediaSelectionV084J();
      }

      if (
        event.target &&
        editor.contains(event.target)
      ) {
        saveSelection();
      }
    },
    true
  );

  document.addEventListener('keydown', (event) => {
    const historyShortcut = (event.ctrlKey || event.metaKey) && !event.altKey && String(event.key || '').toLowerCase() === 'z';
    if (historyShortcut && !event.target.closest?.('input, textarea, select, #ewbDialog')) {
      event.preventDefault();
      if (event.shiftKey) editorRedoR1W9F6C();
      else editorUndoR1W9F6C();
      return;
    }

    if (
      event.key === 'Escape' &&
      selectedMediaBlockV084J
    ) {
      clearMediaSelectionV084J();
      return;
    }

    if (
      event.key !== 'Delete' &&
      event.key !== 'Backspace'
    ) {
      return;
    }

    if (
      !selectedMediaBlockV084J ||
      !mediaKeyboardArmedV084N
    ) {
      return;
    }

    const target = event.target;

    if (
      target &&
      target.closest &&
      target.closest(
        'input, textarea, select, #ewbDialog'
      )
    ) {
      return;
    }

    event.preventDefault();
    deleteSelectedMediaV084J();
  });

  editor.addEventListener('beforeinput', (event) => {
    const inputType = String(event.inputType || '');
    if (inputType === 'historyUndo') {
      event.preventDefault();
      editorUndoR1W9F6C();
      return;
    }
    if (inputType === 'historyRedo') {
      event.preventDefault();
      editorRedoR1W9F6C();
      return;
    }
    recordEditorHistoryInputBoundaryR1W9F6C(inputType);
  });

  editor.addEventListener('input', () => {
    saveSelection();
    scheduleSave();
    reportWorkbenchHeightV094B();
    updateTextInteractionToolsR1W9F6B();
  });

  editor.addEventListener('pointermove', (event) => {
    if (blockMenuR1W9F6 && !blockMenuR1W9F6.hidden) return;
    const block = topLevelBlockFromNodeR1W9F6(event.target);
    if (block === hoveredBlockR1W9F6) return;
    hoveredBlockR1W9F6 = block;
    if (block) {
      activeBlockR1W9F6 = block;
      window.requestAnimationFrame(positionBlockChromeR1W9F6);
    } else if (blockMenuR1W9F6 && blockMenuR1W9F6.hidden && blockHandleR1W9F6) {
      blockHandleR1W9F6.hidden = true;
    }
  });

  editor.addEventListener('pointerleave', (event) => {
    const related = event.relatedTarget;
    if (
      related && related.closest &&
      related.closest('#ewbBlockHandle, #ewbBlockMenu, #ewbBlocksPanel, #ewbWidgetsPanel')
    ) {
      return;
    }
    hoveredBlockR1W9F6 = null;
    if (blockMenuR1W9F6 && blockMenuR1W9F6.hidden && blockHandleR1W9F6) {
      blockHandleR1W9F6.hidden = true;
    }
  });

  if (blockHandleR1W9F6) blockHandleR1W9F6.addEventListener('pointerleave', (event) => {
    if (event.relatedTarget && (editor.contains(event.relatedTarget) || (blockMenuR1W9F6 && blockMenuR1W9F6.contains(event.relatedTarget)))) return;
    hoveredBlockR1W9F6 = null;
    window.requestAnimationFrame(positionBlockChromeR1W9F6);
  });
  document.addEventListener('focusout', () => window.requestAnimationFrame(positionBlockChromeR1W9F6));

  editor.addEventListener('pointerdown', (event) => {
    const block = topLevelBlockFromNodeR1W9F6(event.target);
    if (block) setActiveBlockR1W9F6(block);
    setBlockMenuOpenR1W9F6(false);
  });

  editor.addEventListener('mouseup', (event) => {
    saveSelection();
    if (!activateTextToolsFromPointerR1W9F6B(event)) {
      scheduleTextInteractionToolsR1W9F6B();
    }
  });

  editor.addEventListener('keyup', () => {
    saveSelection();
    scheduleTextInteractionToolsR1W9F6B();
  });

  document.addEventListener('selectionchange', () => {
    scheduleTextInteractionToolsR1W9F6B();
  });

  // Programmatic focus alone remains silent. A real pointer hit in editable
  // text, or a real text selection, is the explicit signal that opens tools.

  editor.addEventListener(
    'scroll',
    () => {
      saveSelection();
      positionMediaInspectorV084O();
    }
  );

  window.addEventListener(
    'resize',
    positionMediaInspectorV084O
  );

  htmlField.addEventListener('input', () => {
    scheduleSave();
  });

  window.addEventListener('resize', () => {
    window.requestAnimationFrame(positionBlockChromeR1W9F6);
    window.requestAnimationFrame(positionTextToolbarR1W9F6);
    window.requestAnimationFrame(positionDialogPopoverR1W9F6C);
    window.requestAnimationFrame(positionWidgetsPanelR1W9H2);
  });

  window.addEventListener('message', (event) => {
    const data = event.data || {};
    if (handleWidgetRuntimeHeightR1W9H(event, data)) return;
    if (event.source !== window.parent) return;

    if (!data || data.source !== SOURCE_PARENT) return;

    if (data.type === 'host-viewport-r1w9h3') {
      widgetHostViewportR1W9H3 = {
        localTop: Number(data.localTop || 0),
        localBottom: Number(data.localBottom || 0),
        visibleHeight: Number(data.visibleHeight || 0),
        frameHeight: Number(data.frameHeight || 0)
      };
      window.requestAnimationFrame(positionBlockChromeR1W9F6);
      if (widgetsPanelR1W9G && !widgetsPanelR1W9G.hidden) window.requestAnimationFrame(positionWidgetsPanelR1W9H2);
      return;
    }

    if (data.type === 'media-result') {
      handleMediaResultV084H(data);
      return;
    }

    if (data.type === 'component-inserted-r1w9f6c') {
      if (!pageId || !data.pageId || String(data.pageId) === String(pageId)) {
        applyExternalComponentInsertR1W9F6C(data);
      }
      return;
    }

    if (data.type === 'widget-instances-updated-r1w9h') {
      if (!pageId || !data.pageId || String(data.pageId) === String(pageId)) {
        installedWidgetsR1W9G = Array.isArray(data.installedWidgets) ? data.installedWidgets.map((item) => ({ ...item, widget: widgetDescriptorR1W9H(item) })) : installedWidgetsR1W9G;
        widgetSnapshotsR1W9G = data.widgetSnapshots && typeof data.widgetSnapshots === 'object' ? data.widgetSnapshots : widgetSnapshotsR1W9G;
        widgetInstancesR1W9H = Array.isArray(data.widgetInstances) ? data.widgetInstances.slice() : widgetInstancesR1W9H;
        widgetThemeContextR1W9H = data.widgetThemeContext && typeof data.widgetThemeContext === 'object' ? { ...data.widgetThemeContext } : widgetThemeContextR1W9H;
        const result = data.actionResult && typeof data.actionResult === 'object' ? data.actionResult : null;
        if (result && (result.action === 'add' || result.action === 'update')) {
          widgetFocusInstanceIdR1W9H = String(result.instanceId || '');
          widgetSubmitPendingR1W9H = null;
          widgetDraftR1W9H = null;
          if (widgetConfigR1W9H) { widgetConfigR1W9H.hidden = true; widgetConfigR1W9H.replaceChildren(); }
          setWidgetsPanelOpenR1W9G(false);
        }
        renderInstalledWidgetsR1W9G();
        renderWidgetInstancesR1W9H();
        setStatus(String(data.statusText || localText('Widget state updated', 'Widget обновлён')));
        if (widgetFocusInstanceIdR1W9H) {
          window.requestAnimationFrame(() => {
            const target = widgetPresentationTargetR1W9H2(widgetFocusInstanceIdR1W9H);
            if (!target) return;
            target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            window.setTimeout(() => {
              document.querySelectorAll('[data-widget-instance-id].is-widget-focus-r1w9h').forEach((node) => node.classList.remove('is-widget-focus-r1w9h'));
              if (String(target.dataset.widgetInstanceId || '') === widgetFocusInstanceIdR1W9H) widgetFocusInstanceIdR1W9H = '';
            }, 1700);
          });
        }
      }
      return;
    }

    if (data.type === 'widget-action-failed-r1w9h') {
      widgetSubmitPendingR1W9H = null;
      const confirmButton = widgetConfigR1W9H && widgetConfigR1W9H.querySelector('[data-action="widget-add-confirm-r1w9h"], [data-action="widget-update-confirm-r1w9h"]');
      const cancelButton = widgetConfigR1W9H && widgetConfigR1W9H.querySelector('[data-action="widget-config-cancel-r1w9h"]');
      if (confirmButton) {
        confirmButton.disabled = false;
        confirmButton.removeAttribute('aria-busy');
        confirmButton.textContent = widgetDraftR1W9H && widgetDraftR1W9H.instanceId ? localText('Save changes', 'Сохранить изменения') : localText('Add to Site', 'Добавить на сайт');
      }
      if (cancelButton) cancelButton.disabled = false;
      setStatus(String(data.statusText || localText('Widget action failed', 'Не удалось выполнить действие с виджетом')));
      return;
    }

    if (data.type !== 'init') return;

    pageId = String(data.pageId || '');
    title.textContent = data.pageLabel || 'Page';
    uiLang = data.lang === 'en' ? 'en' : 'ru';
    document.documentElement.lang = uiLang;
    activeBlockR1W9F6 = null;
    hoveredBlockR1W9F6 = null;
    installedComponentsR1W9F1 = Array.isArray(data.installedComponents)
      ? data.installedComponents.filter((item) => item && item.packageId).map((item) => ({
          packageId: String(item.packageId || ''),
          title: String(item.title || ''),
          version: String(item.version || ''),
          authorLabel: String(item.authorLabel || ''),
          category: String(item.category || ''),
          description: String(item.description || '')
        }))
      : [];
    renderInstalledComponentsR1W9F1();
    installedWidgetsR1W9G = Array.isArray(data.installedWidgets)
      ? data.installedWidgets.filter((item) => item && item.packageId).map((item) => ({
          packageId: String(item.packageId || ''),
          title: String(item.title || ''),
          version: String(item.version || ''),
          authorLabel: String(item.authorLabel || ''),
          category: String(item.category || ''),
          description: String(item.description || ''),
          widget: widgetDescriptorR1W9H(item)
        }))
      : [];
    widgetSnapshotsR1W9G = data.widgetSnapshots && typeof data.widgetSnapshots === 'object' ? data.widgetSnapshots : {};
    widgetInstancesR1W9H = Array.isArray(data.widgetInstances) ? data.widgetInstances.slice() : [];
    widgetThemeContextR1W9H = data.widgetThemeContext && typeof data.widgetThemeContext === 'object' ? { ...data.widgetThemeContext } : {};
    renderInstalledWidgetsR1W9G();
    renderWidgetInstancesR1W9H();
    const nextThemeV084R =
      data.theme === 'light' ? 'light' : 'dark';

    shell.dataset.theme = nextThemeV084R;
    document.documentElement.dataset.theme =
      nextThemeV084R;
    document.documentElement.style.background =
      nextThemeV084R === 'light'
        ? '#f7fbff'
        : '#0b1421';
    document.documentElement.style.colorScheme =
      nextThemeV084R;

    mediaAssetsV084H = Array.isArray(
      data.mediaAssets
    )
      ? data.mediaAssets.slice()
      : [];

    const html =
      String(data.bodyHtml || '').trim() ||
      '<p><br></p>';

    clearMediaSelectionV084J();

    editor.innerHTML =
      editorHtmlForViewV084H(html);

    decorateMediaBlocksV084P(editor);
    resetEditorHistoryR1W9F6C();

    htmlField.value = html;
    setSaveState('saved');
    setStatus(localText('ready', 'готово'));
    reportWorkbenchHeightV094B();
    setTextToolsOpenR1W9F6(false);
    setBlockMenuOpenR1W9F6(false);
    if (blockHandleR1W9F6) blockHandleR1W9F6.hidden = true;

    setTimeout(() => {
      try {
        editor.focus();
        saveSelection();
      } catch {}
      reportWorkbenchHeightV094B();
    }, 80);
  });

  initToolbarTitles();

  if (typeof ResizeObserver === 'function') {
    const heightObserverV094B = new ResizeObserver(
      reportWorkbenchHeightV094B
    );
    heightObserverV094B.observe(shell);
    heightObserverV094B.observe(editor);
  }

  window.parent.postMessage({ source: SOURCE_CHILD, type: 'ready' }, '*');
  reportWorkbenchHeightV094B();
})();
