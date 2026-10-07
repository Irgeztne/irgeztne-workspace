(() => {
  'use strict';

  const MARKER = 'IRGEZTNE_FLOATING_WINDOW_MANAGER_V04P17D';
  const BUTTON_ID = 'workspaceFloatModuleBtn';
  const DESKTOP_ID = 'irgeztneFloatingDesktopV04P17D';

  const SUPPORTED = {
    files:     { ru: 'Файлы',       en: 'Files',    minWidth: 650, minHeight: 420, widthRatio: 0.67, heightRatio: 0.78 },
    projects:  { ru: 'Проекты',     en: 'Projects', minWidth: 680, minHeight: 430, widthRatio: 0.70, heightRatio: 0.80 },
    documents: { ru: 'Офис',        en: 'Office',   minWidth: 720, minHeight: 450, widthRatio: 0.76, heightRatio: 0.82 },
    notes:     { ru: 'Заметки',     en: 'Notes',    minWidth: 500, minHeight: 360, widthRatio: 0.56, heightRatio: 0.72 },
    tasks:     { ru: 'Задачи',      en: 'Tasks',    minWidth: 720, minHeight: 450, widthRatio: 0.74, heightRatio: 0.82 },
    tools:     { ru: 'Инструменты', en: 'Tools',    minWidth: 650, minHeight: 420, widthRatio: 0.66, heightRatio: 0.76 },
    rooms:     { ru: 'Чат',         en: 'Chat',     minWidth: 680, minHeight: 440, widthRatio: 0.68, heightRatio: 0.80 }
  };

  const SECTION_ALIASES = Object.freeze({
    file: 'files',
    files: 'files',
    project: 'projects',
    projects: 'projects',
    office: 'documents',
    document: 'documents',
    documents: 'documents',
    note: 'notes',
    notes: 'notes',
    task: 'tasks',
    tasks: 'tasks',
    analytics: 'tasks',
    tool: 'tools',
    tools: 'tools',
    instruments: 'tools',
    chat: 'rooms',
    room: 'rooms',
    rooms: 'rooms'
  });

  const state = {
    active: false,
    desktop: null,
    windows: new Map(),
    anchors: new Map(),
    snapshots: new Map(),
    focusedSection: '',
    zCounter: 50,
    bypassSection: '',
    shellTitleLock: false
  };

  function isRu() {
    return String(document.documentElement.lang || '').toLowerCase().startsWith('ru');
  }

  function tr(en, ru) {
    return isRu() ? ru : en;
  }

  function normalizeSection(section) {
    const raw = String(section || '').trim().toLowerCase();
    return SECTION_ALIASES[raw] || raw;
  }

  function meta(section) {
    return SUPPORTED[normalizeSection(section)] || null;
  }

  function isSupported(section) {
    return Boolean(meta(section));
  }

  function getCurrentSection() {
    const overlay = document.getElementById('cabinetOverlay');
    const activeNav =
      document.querySelector('#cabinetInnerNav .cabinet-inner-nav-btn.active[data-section]') ||
      document.querySelector('#cabinetInnerNav .cabinet-inner-nav-btn[aria-pressed="true"][data-section]');

    const activePanel = Array.from(
      document.querySelectorAll('.cabinet-section-panel[data-cabinet-panel]')
    ).find((panel) => {
      if (panel.dataset.irgeztneFloatingWindow === '1') return false;
      if (panel.hidden) return false;
      if (panel.getAttribute('aria-hidden') === 'true') return false;
      return window.getComputedStyle(panel).display !== 'none';
    });

    const candidates = [
      document.body.dataset.workspaceFullModule,
      overlay?.dataset.cabinetSection,
      activeNav?.dataset.section,
      activePanel?.dataset.cabinetPanel
    ];

    for (const candidate of candidates) {
      const normalized = normalizeSection(candidate);
      if (isSupported(normalized)) return normalized;
    }

    return normalizeSection(candidates.find(Boolean) || '');
  }

  function getPanel(section) {
    const normalized = normalizeSection(section);

    if (normalized === 'tasks') {
      // Current native Task Core explicitly owns this Full root.
      const tasksPanel = document.querySelector(
        '.cabinet-section-panel[data-cabinet-panel="tasks"]'
      );

      if (!tasksPanel) return null;

      // Tasks renders into the same panel and continues to find it after a DOM move.
      let liveSurface = tasksPanel.querySelector('.ir-tasks-v1.ir-tasks-v1--full');

      if (!liveSurface && window.NSTasksV1 && typeof window.NSTasksV1.render === 'function') {
        try {
          window.NSTasksV1.render();
          liveSurface = tasksPanel.querySelector('.ir-tasks-v1.ir-tasks-v1--full');
        } catch (error) {
          console.warn('[P17D] Tasks render probe failed:', error);
        }
      }

      return liveSurface ? tasksPanel : null;
    }

    return document.querySelector(
      '.cabinet-section-panel[data-cabinet-panel="' + normalized + '"]'
    );
  }

  function canFloatSection(section) {
    const normalized = normalizeSection(section);
    if (!isSupported(normalized)) return false;

    const panel = getPanel(normalized);
    if (!panel) return false;

    if (normalized === 'tasks') {
      return Boolean(panel.querySelector('.ir-tasks-v1.ir-tasks-v1--full'));
    }

    return true;
  }

  function getBody() {
    return document.getElementById('cabinetExpandedBody');
  }

  function ensureStyle() {
    if (document.getElementById('irgeztneFloatingWindowsStyleV04P17D')) return;

    const style = document.createElement('style');
    style.id = 'irgeztneFloatingWindowsStyleV04P17D';
    style.textContent = `
      body.is-irgeztne-floating-workspace #cabinetExpandedBody {
        position: relative !important;
        overflow: hidden !important;
        min-height: 0 !important;
      }

      #${DESKTOP_ID} {
        position: absolute;
        inset: 0;
        overflow: hidden;
        isolation: isolate;
        background:
          radial-gradient(circle at 18% 0%, rgba(38, 88, 145, .13), transparent 34%),
          linear-gradient(180deg, rgba(7, 19, 36, .98), rgba(4, 13, 25, .99));
      }

      #${DESKTOP_ID}::before {
        content: '';
        position: absolute;
        inset: 0;
        pointer-events: none;
        background-image:
          linear-gradient(rgba(110, 160, 220, .032) 1px, transparent 1px),
          linear-gradient(90deg, rgba(110, 160, 220, .032) 1px, transparent 1px);
        background-size: 28px 28px;
      }

      .irg-fwm-window {
        position: absolute;
        display: flex;
        flex-direction: column;
        min-width: 360px;
        min-height: 280px;
        overflow: hidden;
        border: 1px solid rgba(85, 151, 223, .46);
        border-radius: 14px;
        background: rgba(7, 20, 37, .988);
        box-shadow: 0 18px 55px rgba(0, 0, 0, .42);
        contain: layout paint;
      }

      .irg-fwm-window.is-focused {
        border-color: rgba(93, 172, 255, .80);
        box-shadow: 0 24px 68px rgba(0, 0, 0, .49);
      }

      .irg-fwm-titlebar {
        flex: 0 0 38px;
        height: 38px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding: 0 8px 0 12px;
        border-bottom: 1px solid rgba(67, 126, 190, .28);
        background: linear-gradient(180deg, rgba(25, 57, 94, .96), rgba(13, 34, 59, .96));
        cursor: move;
        user-select: none;
        touch-action: none;
      }

      .irg-fwm-title-wrap {
        min-width: 0;
        display: flex;
        align-items: center;
        gap: 9px;
        color: #edf6ff;
        font: 700 13px/1 system-ui, sans-serif;
      }

      .irg-fwm-title-dot {
        width: 8px;
        height: 8px;
        flex: 0 0 auto;
        border-radius: 50%;
        background: #65d4c2;
        box-shadow: 0 0 12px rgba(101, 212, 194, .55);
      }

      .irg-fwm-title {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .irg-fwm-actions {
        display: flex;
        align-items: center;
        gap: 5px;
      }

      .irg-fwm-action {
        width: 28px;
        height: 28px;
        min-width: 28px;
        padding: 0;
        border: 1px solid rgba(89, 146, 207, .38);
        border-radius: 8px;
        background: rgba(20, 52, 86, .92);
        color: #dcecff;
        font: 700 14px/1 system-ui, sans-serif;
        cursor: pointer;
      }

      .irg-fwm-action:hover {
        border-color: rgba(103, 181, 255, .72);
        background: rgba(29, 72, 116, .98);
      }

      .irg-fwm-window-body {
        flex: 1 1 auto;
        min-width: 0;
        min-height: 0;
        overflow: auto;
        position: relative;
        background: rgba(4, 14, 27, .98);
      }

      .irg-fwm-window-body > .cabinet-section-panel {
        display: block !important;
        visibility: visible !important;
        pointer-events: auto !important;
        width: 100% !important;
        min-width: 0 !important;
        min-height: 100% !important;
        max-width: none !important;
        max-height: none !important;
        box-sizing: border-box !important;
      }

      .irg-fwm-handle {
        position: absolute;
        z-index: 4;
        touch-action: none;
      }

      .irg-fwm-handle[data-dir="n"],
      .irg-fwm-handle[data-dir="s"] {
        left: 10px; right: 10px; height: 8px; cursor: ns-resize;
      }
      .irg-fwm-handle[data-dir="n"] { top: -2px; }
      .irg-fwm-handle[data-dir="s"] { bottom: -2px; }

      .irg-fwm-handle[data-dir="e"],
      .irg-fwm-handle[data-dir="w"] {
        top: 10px; bottom: 10px; width: 8px; cursor: ew-resize;
      }
      .irg-fwm-handle[data-dir="e"] { right: -2px; }
      .irg-fwm-handle[data-dir="w"] { left: -2px; }

      .irg-fwm-handle[data-dir="ne"],
      .irg-fwm-handle[data-dir="nw"],
      .irg-fwm-handle[data-dir="se"],
      .irg-fwm-handle[data-dir="sw"] {
        width: 14px; height: 14px;
      }
      .irg-fwm-handle[data-dir="ne"] { right: -3px; top: -3px; cursor: nesw-resize; }
      .irg-fwm-handle[data-dir="nw"] { left: -3px; top: -3px; cursor: nwse-resize; }
      .irg-fwm-handle[data-dir="se"] { right: -3px; bottom: -3px; cursor: nwse-resize; }
      .irg-fwm-handle[data-dir="sw"] { left: -3px; bottom: -3px; cursor: nesw-resize; }

      #${BUTTON_ID} {
        display: none;
        width: 32px;
        min-width: 32px;
        height: 32px;
        min-height: 32px;
        margin: 0;
        padding: 0;
        border-radius: 9px;
        align-items: center;
        justify-content: center;
        font-size: 17px;
        line-height: 1;
      }

      body.is-workspace-full-module-open #${BUTTON_ID}.is-available,
      body.is-irgeztne-floating-workspace #${BUTTON_ID} {
        display: inline-flex;
      }
    `;
    document.head.appendChild(style);
  }

  function ensureDesktop() {
    if (state.desktop && state.desktop.isConnected) return state.desktop;

    const body = getBody();
    if (!body) return null;

    const desktop = document.createElement('div');
    desktop.id = DESKTOP_ID;
    desktop.setAttribute('role', 'region');
    desktop.setAttribute('aria-label', tr('Floating Workspace', 'Плавающий Workspace'));
    body.appendChild(desktop);

    state.desktop = desktop;
    return desktop;
  }

  function expectedShellTitle() {
    return tr('Workspace windows', 'Окна Workspace');
  }

  function expectedShellSubtitle() {
    return tr(
      'Drag modules, resize them, or return one to Full.',
      'Перетаскивайте модули, меняйте их размер или верните один в Full.'
    );
  }

  function lockShellTitle() {
    if (!state.active || state.shellTitleLock) return;

    const title = document.getElementById('cabinetExpandedTitle');
    const subtitle = document.getElementById('cabinetExpandedSubtitle');

    state.shellTitleLock = true;

    const nextTitle = expectedShellTitle();
    const nextSubtitle = expectedShellSubtitle();

    if (title && title.textContent !== nextTitle) title.textContent = nextTitle;
    if (subtitle && subtitle.textContent !== nextSubtitle) subtitle.textContent = nextSubtitle;

    state.shellTitleLock = false;
  }

  function ensureShellTitleObserver() {
    const title = document.getElementById('cabinetExpandedTitle');
    const subtitle = document.getElementById('cabinetExpandedSubtitle');

    [title, subtitle].forEach((node) => {
      if (!node || node.dataset.irgeztneFloatingTitleObserverP17D === '1') return;

      node.dataset.irgeztneFloatingTitleObserverP17D = '1';

      const observer = new MutationObserver(() => {
        if (!state.active || state.shellTitleLock) return;
        lockShellTitle();
      });

      observer.observe(node, {
        childList: true,
        characterData: true,
        subtree: true
      });
    });
  }

  function updateWindowTitles() {
    state.windows.forEach((entry, section) => {
      const info = meta(section);
      const title = entry.window.querySelector('.irg-fwm-title');
      if (title && info) title.textContent = isRu() ? info.ru : info.en;

      const maxBtn = entry.window.querySelector('[data-fwm-action="maximize"]');
      const fullBtn = entry.window.querySelector('[data-fwm-action="full"]');
      const closeBtn = entry.window.querySelector('[data-fwm-action="close"]');

      if (maxBtn) maxBtn.title = tr('Maximize inside Workspace', 'Развернуть внутри Workspace');
      if (fullBtn) fullBtn.title = tr('Return to Full mode', 'Вернуть в Full');
      if (closeBtn) closeBtn.title = tr('Close floating window', 'Закрыть плавающее окно');
    });
  }

  function ensureFloatButton() {
    const close = document.getElementById('cabinetCloseBtnExpanded');
    if (!close || !close.parentElement) return null;

    const right = close.parentElement;
    let button = document.getElementById(BUTTON_ID);

    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.id = BUTTON_ID;
      button.className = 'utility-btn';
      button.textContent = '□';

      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();

        if (state.active) {
          const section = state.focusedSection || Array.from(state.windows.keys()).pop() || '';
          if (section) exitToFull(section);
          return;
        }

        floatCurrent();
      });
    }

    if (button.parentElement !== right || button.nextElementSibling !== close) {
      right.insertBefore(button, close);
    }

    const current = getCurrentSection();
    const available = state.active || canFloatSection(current);

    button.classList.toggle('is-available', available);
    button.hidden = !available;
    button.title = state.active
      ? tr('Return focused module to Full', 'Вернуть активный модуль в Full')
      : tr('Float this module', 'Открыть модуль плавающим окном');
    button.setAttribute('aria-label', button.title);

    return button;
  }

  function snapshotPanel(panel) {
    return {
      hidden: panel.hidden,
      ariaHidden: panel.getAttribute('aria-hidden'),
      display: panel.style.display,
      pointerEvents: panel.style.pointerEvents
    };
  }

  function restorePanelState(panel, snapshot) {
    if (!snapshot) return;

    panel.hidden = Boolean(snapshot.hidden);

    if (snapshot.ariaHidden === null) panel.removeAttribute('aria-hidden');
    else panel.setAttribute('aria-hidden', snapshot.ariaHidden);

    if (snapshot.display) panel.style.display = snapshot.display;
    else panel.style.removeProperty('display');

    if (snapshot.pointerEvents) panel.style.pointerEvents = snapshot.pointerEvents;
    else panel.style.removeProperty('pointer-events');

    panel.classList.remove('active');
    delete panel.dataset.irgeztneFloatingWindow;
  }

  function forcePanelVisible(panel) {
    panel.hidden = false;
    panel.setAttribute('aria-hidden', 'false');
    panel.classList.add('active');
    panel.style.removeProperty('display');
    panel.style.pointerEvents = 'auto';
  }

  function reactivateFloatingPanels() {
    state.windows.forEach((entry) => {
      forcePanelVisible(entry.panel);
    });
  }

  function stabilizePanelAfterMove(section, panel) {
    const normalized = normalizeSection(section);
    if (!panel) return;

    forcePanelVisible(panel);

    if (normalized === 'tools') {
      panel.querySelectorAll('[data-tools-root]').forEach((root) => {
        root.hidden = false;
        root.removeAttribute('aria-hidden');
        root.style.removeProperty('display');
        root.style.removeProperty('visibility');
        root.style.removeProperty('opacity');
      });
    }

    const settle = () => {
      if (!panel.isConnected) return;

      forcePanelVisible(panel);
      panel.getBoundingClientRect();

      if (normalized === 'tools') {
        panel.querySelectorAll('[data-tools-root]').forEach((root) => {
          root.hidden = false;
          root.removeAttribute('aria-hidden');
          root.style.removeProperty('display');
          root.style.removeProperty('visibility');
          root.style.removeProperty('opacity');
        });
      }

      window.dispatchEvent(new Event('resize'));
    };

    window.requestAnimationFrame(() => {
      settle();
      window.requestAnimationFrame(settle);
    });
  }

  function focusWindow(section) {
    const entry = state.windows.get(section);
    if (!entry) return;

    state.zCounter += 1;
    state.focusedSection = section;

    state.windows.forEach((item, key) => {
      item.window.classList.toggle('is-focused', key === section);
    });

    entry.window.style.zIndex = String(state.zCounter);
    ensureFloatButton();
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function desktopSize() {
    const desktop = ensureDesktop();
    return {
      width: Math.max(desktop ? desktop.clientWidth : 0, 900),
      height: Math.max(desktop ? desktop.clientHeight : 0, 560)
    };
  }

  function applyRect(windowEl, rect) {
    windowEl.style.left = Math.round(rect.left) + 'px';
    windowEl.style.top = Math.round(rect.top) + 'px';
    windowEl.style.width = Math.round(rect.width) + 'px';
    windowEl.style.height = Math.round(rect.height) + 'px';
  }

  function readRect(windowEl) {
    return {
      left: parseFloat(windowEl.style.left || '0') || 0,
      top: parseFloat(windowEl.style.top || '0') || 0,
      width: parseFloat(windowEl.style.width || '0') || windowEl.offsetWidth,
      height: parseFloat(windowEl.style.height || '0') || windowEl.offsetHeight
    };
  }

  function initialRect(section) {
    const info = meta(section);
    const size = desktopSize();
    const index = state.windows.size;

    const width = clamp(
      Math.round(size.width * info.widthRatio),
      info.minWidth,
      Math.max(info.minWidth, size.width - 32)
    );

    const height = clamp(
      Math.round(size.height * info.heightRatio),
      info.minHeight,
      Math.max(info.minHeight, size.height - 32)
    );

    return {
      left: clamp(18 + index * 74, 12, Math.max(12, size.width - width - 12)),
      top: clamp(18 + index * 52, 12, Math.max(12, size.height - height - 12)),
      width,
      height
    };
  }

  function createAction(label, action, title) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'irg-fwm-action';
    button.dataset.fwmAction = action;
    button.textContent = label;
    button.title = title;
    button.setAttribute('aria-label', title);
    return button;
  }

  function bindDrag(windowEl, titlebar, section) {
    titlebar.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      if (event.target.closest('button')) return;
      if (windowEl.dataset.maximized === '1') return;

      event.preventDefault();
      focusWindow(section);

      const startX = event.clientX;
      const startY = event.clientY;
      const start = readRect(windowEl);
      const size = desktopSize();

      titlebar.setPointerCapture?.(event.pointerId);

      const move = (moveEvent) => {
        const left = clamp(
          start.left + (moveEvent.clientX - startX),
          0,
          Math.max(0, size.width - start.width)
        );

        const top = clamp(
          start.top + (moveEvent.clientY - startY),
          0,
          Math.max(0, size.height - 38)
        );

        applyRect(windowEl, { left, top, width: start.width, height: start.height });
      };

      const stop = () => {
        titlebar.removeEventListener('pointermove', move);
        titlebar.removeEventListener('pointerup', stop);
        titlebar.removeEventListener('pointercancel', stop);
      };

      titlebar.addEventListener('pointermove', move);
      titlebar.addEventListener('pointerup', stop);
      titlebar.addEventListener('pointercancel', stop);
    });
  }

  function bindResize(windowEl, handle, section, direction) {
    handle.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      if (windowEl.dataset.maximized === '1') return;

      event.preventDefault();
      event.stopPropagation();
      focusWindow(section);

      const info = meta(section);
      const startX = event.clientX;
      const startY = event.clientY;
      const start = readRect(windowEl);
      const size = desktopSize();

      handle.setPointerCapture?.(event.pointerId);

      const move = (moveEvent) => {
        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;

        let left = start.left;
        let top = start.top;
        let width = start.width;
        let height = start.height;

        if (direction.includes('e')) {
          width = clamp(start.width + dx, info.minWidth, size.width - start.left);
        }

        if (direction.includes('s')) {
          height = clamp(start.height + dy, info.minHeight, size.height - start.top);
        }

        if (direction.includes('w')) {
          const nextLeft = clamp(
            start.left + dx,
            0,
            start.left + start.width - info.minWidth
          );
          width = start.width + (start.left - nextLeft);
          left = nextLeft;
        }

        if (direction.includes('n')) {
          const nextTop = clamp(
            start.top + dy,
            0,
            start.top + start.height - info.minHeight
          );
          height = start.height + (start.top - nextTop);
          top = nextTop;
        }

        width = Math.min(width, size.width - left);
        height = Math.min(height, size.height - top);

        applyRect(windowEl, { left, top, width, height });
      };

      const stop = () => {
        handle.removeEventListener('pointermove', move);
        handle.removeEventListener('pointerup', stop);
        handle.removeEventListener('pointercancel', stop);
      };

      handle.addEventListener('pointermove', move);
      handle.addEventListener('pointerup', stop);
      handle.addEventListener('pointercancel', stop);
    });
  }

  function toggleInternalMaximize(section) {
    const entry = state.windows.get(section);
    if (!entry) return;

    const windowEl = entry.window;

    if (windowEl.dataset.maximized === '1') {
      windowEl.dataset.maximized = '0';
      applyRect(windowEl, entry.restoreRect || initialRect(section));
      return;
    }

    entry.restoreRect = readRect(windowEl);

    const size = desktopSize();
    windowEl.dataset.maximized = '1';

    applyRect(windowEl, {
      left: 8,
      top: 8,
      width: Math.max(meta(section).minWidth, size.width - 16),
      height: Math.max(meta(section).minHeight, size.height - 16)
    });
  }

  function createWindow(section, panel) {
    const desktop = ensureDesktop();
    const info = meta(section);
    if (!desktop || !info) return null;

    const windowEl = document.createElement('section');
    windowEl.className = 'irg-fwm-window';
    windowEl.dataset.section = section;
    windowEl.dataset.maximized = '0';
    windowEl.setAttribute('role', 'dialog');
    windowEl.setAttribute('aria-label', isRu() ? info.ru : info.en);

    const titlebar = document.createElement('div');
    titlebar.className = 'irg-fwm-titlebar';

    const titleWrap = document.createElement('div');
    titleWrap.className = 'irg-fwm-title-wrap';

    const dot = document.createElement('span');
    dot.className = 'irg-fwm-title-dot';

    const title = document.createElement('span');
    title.className = 'irg-fwm-title';
    title.textContent = isRu() ? info.ru : info.en;

    titleWrap.append(dot, title);

    const actions = document.createElement('div');
    actions.className = 'irg-fwm-actions';

    const maxButton = createAction(
      '▣',
      'maximize',
      tr('Maximize inside Workspace', 'Развернуть внутри Workspace')
    );

    const fullButton = createAction(
      '↗',
      'full',
      tr('Return to Full mode', 'Вернуть в Full')
    );

    const closeButton = createAction(
      '×',
      'close',
      tr('Close floating window', 'Закрыть плавающее окно')
    );

    actions.append(maxButton, fullButton, closeButton);
    titlebar.append(titleWrap, actions);

    const body = document.createElement('div');
    body.className = 'irg-fwm-window-body';
    body.appendChild(panel);

    windowEl.append(titlebar, body);

    ['n', 'e', 's', 'w', 'ne', 'nw', 'se', 'sw'].forEach((direction) => {
      const handle = document.createElement('div');
      handle.className = 'irg-fwm-handle';
      handle.dataset.dir = direction;
      windowEl.appendChild(handle);
      bindResize(windowEl, handle, section, direction);
    });

    maxButton.addEventListener('click', (event) => {
      event.stopPropagation();
      toggleInternalMaximize(section);
    });

    fullButton.addEventListener('click', (event) => {
      event.stopPropagation();
      exitToFull(section);
    });

    closeButton.addEventListener('click', (event) => {
      event.stopPropagation();
      closeFloatingWindow(section);
    });

    windowEl.addEventListener('pointerdown', () => focusWindow(section));
    bindDrag(windowEl, titlebar, section);

    desktop.appendChild(windowEl);
    applyRect(windowEl, initialRect(section));

    return windowEl;
  }

  function preparePanelForFloating(section, panel) {
    if (!state.anchors.has(section)) {
      const anchor = document.createComment('IRGEZTNE_FWM_ANCHOR_' + section);
      panel.parentNode?.insertBefore(anchor, panel);
      state.anchors.set(section, anchor);
      state.snapshots.set(section, snapshotPanel(panel));
    }

    forcePanelVisible(panel);
    panel.dataset.irgeztneFloatingWindow = '1';
  }

  function openWindow(section) {
    section = normalizeSection(section);
    if (!isSupported(section)) return false;

    if (state.windows.has(section)) {
      reactivateFloatingPanels();
      stabilizePanelAfterMove(section, state.windows.get(section).panel);
      focusWindow(section);
      lockShellTitle();
      return true;
    }

    // Critical P17D safety contract:
    // never switch to the dark Floating desktop before a real live surface exists.
    const panel = getPanel(section);
    if (!panel) {
      console.warn('[P17D] Live floating surface not found; keeping current Full mode:', section);
      return false;
    }

    if (!state.active && !enterFloatingMode()) {
      return false;
    }

    preparePanelForFloating(section, panel);

    const windowEl = createWindow(section, panel);
    if (!windowEl) return false;

    state.windows.set(section, {
      window: windowEl,
      panel,
      restoreRect: null
    });

    reactivateFloatingPanels();
    stabilizePanelAfterMove(section, panel);
    focusWindow(section);
    lockShellTitle();
    updateWindowTitles();

    return true;
  }

  function restoreOne(section, forceHidden = false) {
    const entry = state.windows.get(section);
    const anchor = state.anchors.get(section);
    const snapshot = state.snapshots.get(section);
    if (!entry) return;

    const panel = entry.panel;

    if (anchor && anchor.parentNode) {
      anchor.parentNode.insertBefore(panel, anchor);
      anchor.remove();
    } else {
      getBody()?.appendChild(panel);
    }

    restorePanelState(panel, snapshot);

    if (forceHidden) {
      panel.hidden = true;
      panel.setAttribute('aria-hidden', 'true');
      panel.style.display = 'none';
      panel.style.pointerEvents = 'none';
    }

    entry.window.remove();

    state.windows.delete(section);
    state.anchors.delete(section);
    state.snapshots.delete(section);

    if (state.focusedSection === section) {
      state.focusedSection = Array.from(state.windows.keys()).pop() || '';
    }
  }

  function closeFloatingWindow(section) {
    const wasLast = state.windows.size === 1;

    restoreOne(section, !wasLast);

    if (wasLast) {
      exitToFull(section);
      return;
    }

    reactivateFloatingPanels();

    if (state.focusedSection) {
      focusWindow(state.focusedSection);
    }

    lockShellTitle();
  }

  function restoreAll() {
    Array.from(state.windows.keys()).forEach((section) => {
      restoreOne(section, false);
    });
  }

  function enterFloatingMode() {
    if (state.active) return true;
    if (!ensureDesktop()) return false;

    state.active = true;
    document.body.classList.add('is-irgeztne-floating-workspace');

    lockShellTitle();
    ensureFloatButton();

    return true;
  }

  function leaveFloatingMode() {
    if (!state.active) return;

    restoreAll();

    state.active = false;
    state.focusedSection = '';
    document.body.classList.remove('is-irgeztne-floating-workspace');

    if (state.desktop) state.desktop.remove();
    state.desktop = null;

    ensureFloatButton();
  }

  function findNavButton(section) {
    const normalized = normalizeSection(section);

    const candidates = normalized === 'tasks'
      ? ['tasks', 'analytics']
      : [normalized];

    for (const candidate of candidates) {
      const button =
        document.querySelector('#cabinetInnerNav .cabinet-inner-nav-btn[data-section="' + candidate + '"]') ||
        document.querySelector('[data-open-section="' + candidate + '"]');

      if (button) return button;
    }

    return null;
  }

  function routeLegacySection(section) {
    const button = findNavButton(section);
    if (!button) return false;

    button.click();
    return true;
  }

  function exitToFull(section) {
    const target = String(
      section ||
      state.focusedSection ||
      getCurrentSection() ||
      'projects'
    );

    leaveFloatingMode();

    state.bypassSection = target;

    window.setTimeout(() => {
      if (!routeLegacySection(target)) {
        state.bypassSection = '';
      }
    }, 0);
  }

  function floatCurrent() {
    const section = normalizeSection(getCurrentSection());
    if (!canFloatSection(section)) {
      console.warn('[P17D] Current module has no capturable live surface:', section);
      return false;
    }

    return openWindow(section);
  }

  // Called by the official legacy owner BEFORE it changes active panel state.
  function beforeLegacyRoute(section) {
    const next = normalizeSection(section);

    if (state.bypassSection && next === state.bypassSection) {
      state.bypassSection = '';
      return null;
    }

    if (!state.active) return null;

    // Home/Web Studio/other unsupported destinations leave Floating Workspace
    // first, then continue through the existing route normally.
    if (!isSupported(next)) {
      leaveFloatingMode();
      return null;
    }

    return { captureAfterLegacy: true, section: normalizeSection(next) };
  }

  // Called by the same owner AFTER it has run its normal activation/sync logic.
  function afterLegacyRoute(section, intent) {
    if (!intent || !intent.captureAfterLegacy) return;

    const next = normalizeSection(section || intent.section || '');

    // Legacy activation may hide panels already living in floating windows.
    reactivateFloatingPanels();

    const opened = openWindow(next);

    if (!opened) {
      reactivateFloatingPanels();

      // If no floating windows exist, do not keep an empty Floating desktop alive.
      if (state.active && state.windows.size === 0) {
        leaveFloatingMode();
      }

      ensureFloatButton();
      return;
    }

    reactivateFloatingPanels();
    lockShellTitle();
    ensureFloatButton();
  }

  function refreshUi() {
    ensureStyle();
    ensureShellTitleObserver();

    // Retire the earlier external BrowserWindow square from P16.
    document.getElementById('workspaceFullWindowBtn')?.remove();
    document.querySelectorAll('.irgeztne-window-toggle-v04p16').forEach((node) => node.remove());

    ensureFloatButton();

    if (state.active) {
      reactivateFloatingPanels();
      lockShellTitle();
      updateWindowTitles();
    }
  }

  function start() {
    refreshUi();
    ensureShellTitleObserver();

    document.addEventListener('irg:language-changed', () => {
      window.setTimeout(refreshUi, 0);
    });

    // Templates/Workshop bypass showCabinetSection and deep-link directly to Web Studio.
    // Leave Floating Workspace before that direct owner runs.
    document.addEventListener('click', (event) => {
      const deepLink = event.target?.closest?.('[data-workspace-deep-link]');
      if (
        state.active &&
        deepLink &&
        ['templates', 'workshop'].includes(String(deepLink.dataset.workspaceDeepLink || ''))
      ) {
        leaveFloatingMode();
      }
    }, true);

    document.addEventListener('click', (event) => {
      const target = event.target;
      if (!target || !target.closest) return;

      if (target.closest(
        '[data-open-section], [data-section], #workspaceFullLanguageBtn, #languageToggleBtn'
      )) {
        window.setTimeout(refreshUi, 0);
        window.setTimeout(refreshUi, 90);
      }
    });

    window.addEventListener('resize', () => {
      if (!state.active) return;

      const size = desktopSize();

      state.windows.forEach((entry, section) => {
        const info = meta(section);
        const rect = readRect(entry.window);

        if (entry.window.dataset.maximized === '1') {
          applyRect(entry.window, {
            left: 8,
            top: 8,
            width: Math.max(info.minWidth, size.width - 16),
            height: Math.max(info.minHeight, size.height - 16)
          });
          return;
        }

        const width = Math.min(rect.width, size.width);
        const height = Math.min(rect.height, size.height);

        applyRect(entry.window, {
          left: clamp(rect.left, 0, Math.max(0, size.width - width)),
          top: clamp(rect.top, 0, Math.max(0, size.height - 38)),
          width,
          height
        });
      });
    }, { passive: true });

    // Tiny owner-only observers: no Web Studio subtree observation.
    const bodyObserver = new MutationObserver(() => {
      window.setTimeout(refreshUi, 0);
    });

    bodyObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ['class', 'data-workspace-full-module']
    });

    const overlay = document.getElementById('cabinetOverlay');
    if (overlay) {
      const overlayObserver = new MutationObserver(() => {
        window.setTimeout(refreshUi, 0);
      });

      overlayObserver.observe(overlay, {
        attributes: true,
        attributeFilter: ['data-cabinet-section', 'data-cabinet-mode']
      });
    }
  }

  const api = {
    marker: MARKER,
    isActive: () => state.active,
    isSupported,
    beforeLegacyRoute,
    afterLegacyRoute,
    openWindow,
    floatCurrent,
    exitToFull,
    leaveFloatingMode,
    refreshUi,
    getOpenSections: () => Array.from(state.windows.keys())
  };

  window.__IRGEZTNE_FLOATING_WINDOW_MANAGER_V04P17D = api;
  // legacy-shell P17B hook remains the stable routing owner.
  window.__IRGEZTNE_FLOATING_WINDOW_MANAGER_V04P17C = api;
  window.__IRGEZTNE_FLOATING_WINDOW_MANAGER_V04P17B = api;
  window.__IRGEZTNE_FLOATING_WINDOW_MANAGER_V04P17A = api;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
