(function () {
  if (window.__IRGEZTNE_PREVIEW4_GRID_NAV_LANG_FIX__) return;
  window.__IRGEZTNE_PREVIEW4_GRID_NAV_LANG_FIX__ = true;

  const labels = {
    workspace: { ru: 'Главная', en: 'Home' },
    files: { ru: 'Файлы', en: 'Files' },
    projects: { ru: 'Проекты', en: 'Projects' },
    notes: { ru: 'Заметки', en: 'Notes' },
    documents: { ru: 'Офис', en: 'Office' },
    'site-pages': { ru: 'Веб-студия', en: 'Web Studio' },
    tools: { ru: 'Инструменты', en: 'Tools' },
    codehub: { ru: 'Мастерская', en: 'Workshop' },
    marketplace: { ru: 'Шаблоны', en: 'Templates' },
    rooms: { ru: 'Чат', en: 'Chat' },
    tasks: { ru: 'Задачи', en: 'Tasks' }
  };

  const descriptions = {
    workspace: {
      ru: 'Обзор кабинета, недавние пути и чистая точка запуска для основных модулей.',
      en: 'Cabinet overview, recent paths, and a clean launch point for the main modules.'
    },
    files: {
      ru: 'Библиотека, ассеты и активный исходный материал для текущего пространства.',
      en: 'Library, assets, and active source material for the current workspace.'
    },
    projects: {
      ru: 'Контейнеры для черновиков, файлов, заметок и публикации.',
      en: 'Containers for drafts, files, notes, and publishing flow.'
    },
    notes: {
      ru: 'Фиксируй фрагменты, ссылки и связанные заметки.',
      en: 'Capture fragments, references, and linked notes.'
    },
    documents: {
      ru: 'Офис, тексты и converter/export foundation: Markdown и HTML.',
      en: 'Office, writing, and converter/export foundation: Markdown and HTML.'
    },
    'site-pages': {
      ru: 'Страницы, меню, предпросмотр, экспорт и подготовка публикации сайта.',
      en: 'Pages, menus, preview, export, and site publishing preparation.'
    },
    tools: {
      ru: 'Перевод, вспомогательные инструменты и браузерные утилиты.',
      en: 'Translation, helper tools, and browser-side utilities.'
    },
    codehub: { ru: 'Каталог шаблонов, тем, блоков, виджетов и ассетов.', en: 'Catalog of templates, themes, blocks, widgets and assets.' },
    marketplace: {
      ru: 'Бесплатные официальные шаблоны IRGEZTNE для быстрого старта.',
      en: 'Free official IRGEZTNE templates for a quick start.'
    },
    rooms: {
      ru: 'Локальные комнаты проекта, решения, заметки и будущий слой коммуникации.',
      en: 'Local project rooms, decisions, tasks, notes, and links.'
    },
    tasks: {
      ru: 'Личные и проектные задачи, следующий шаг и рабочий контекст.',
      en: 'Personal and project tasks, next actions and working context.'
    }
  };

  function isRu() {
    const langText = (document.querySelector('[data-lang-toggle], #languageToggle, .language-toggle')?.textContent || '').trim().toLowerCase();
    const htmlLang = (document.documentElement.lang || '').toLowerCase();

    if (htmlLang.startsWith('ru')) return true;
    if (htmlLang.startsWith('en')) return false;

    return langText === 'ru' || /[А-Яа-яЁё]/.test(document.querySelector('.cabinet-title, .cabinet-tile-title')?.textContent || '');
  }

  function cleanDoubleWeb() {
    document.querySelectorAll('button, span, strong, h1, h2, h3, div').forEach((node) => {
      // Document editors own their text and Selection.  A global label cleanup
      // must never replace their text nodes (or any explicitly protected UI).
      if (node.closest('[data-ir-no-translate="true"], [contenteditable="true"]')) return;
      if (!node.children.length && node.textContent) {
        const currentText = node.textContent;
        const nextText = currentText
          .replace(/Шаблоныа/g, 'Шаблоны');
        if (nextText !== currentText) node.textContent = nextText;
      }
    });
  }

  // IRGEZTNE Workspace v031g Shell Navigation Owner Correction.
  // Короткие подписи навигации отделены от описаний модулей.
  // v031k: статические меню получают единый порядок.
  // Меню с собственным drag-owner здесь не переставляется.
  // IRGEZTNE_FULL_NAV_ORDER_V04P18
  // One visible Full-row order. P13 deep links (Templates / Workshop) are
  // first-class navigation items and must not be stranded before Home by the
  // old data-section-only sorter.
  function applyStaticNavigationOrder() {
    const order = [
      { key: 'workspace', selectors: ['[data-section="workspace"]'] },
      { key: 'files', selectors: ['[data-section="files"]'] },
      { key: 'projects', selectors: ['[data-section="projects"]'] },
      { key: 'documents', selectors: ['[data-section="documents"]'] },
      { key: 'notes', selectors: ['[data-section="notes"]'] },
      { key: 'rooms', selectors: ['[data-section="rooms"]'] },
      { key: 'tasks', selectors: ['[data-section="tasks"]'] },
      { key: 'tools', selectors: ['[data-section="tools"]'] },
      {
        key: 'templates',
        selectors: [
          '[data-workspace-deep-link="templates"]',
          '[data-section="marketplace"]'
        ]
      },
      {
        key: 'workshop',
        selectors: [
          '[data-workspace-deep-link="workshop"]',
          '[data-section="codehub"]'
        ]
      },
      { key: 'site-pages', selectors: ['[data-section="site-pages"]'] },
      // Legacy-only entries remain after the canonical release row if they are
      // visible on an older surface. P13 already hides them in the Full row.
      { key: 'map', selectors: ['[data-section="map"]'] },
      { key: 'editor', selectors: ['[data-section="editor"]'] },
      { key: 'fili-store', selectors: ['[data-section="fili-store"]'] },
      { key: 'fili-safe', selectors: ['[data-section="fili-safe"]'] }
    ];

    document.querySelectorAll(
      '.cabinet-inner-nav, ' +
      '#workspaceShellNav, ' +
      '.workspace-shell-nav'
    ).forEach((navigation) => {
      if (
        navigation.matches(
          '[data-preview4-grid-nav="true"]'
        )
      ) {
        return;
      }

      const children = Array.from(navigation.children);

      const pickItem = (selectors) => {
        for (const selector of selectors) {
          const matches = children.filter((item) => item.matches(selector));
          if (!matches.length) continue;

          // P13 intentionally keeps old marketplace/codehub nodes hidden for
          // compatibility. Prefer the visible deep-link node when both exist.
          const visible = matches.find((item) => (
            !item.hidden && item.style.getPropertyValue('display') !== 'none'
          ));
          if (visible) return visible;
          return matches[0];
        }
        return null;
      };

      const orderedItems = order
        .map((entry) => pickItem(entry.selectors))
        .filter(Boolean);
      const orderedSet = new Set(orderedItems);
      const currentItems = children.filter((item) => orderedSet.has(item));
      const alreadyOrdered = orderedItems.length === currentItems.length &&
        orderedItems.every((item, index) => item === currentItems[index]);

      // Re-appending an already ordered row removes/inserts every button and is
      // visible as hover jitter. Only touch the DOM when the order is wrong.
      if (!alreadyOrdered) {
        orderedItems.forEach((item) => navigation.appendChild(item));
      }
    });
  }

  function syncLabels() {
    const lang = isRu() ? 'ru' : 'en';

    document.querySelectorAll('[data-preview4-grid-nav="true"] button[data-open-section]').forEach((button) => {
      const section = button.getAttribute('data-open-section');
      if (labels[section] && button.textContent !== labels[section][lang]) {
        button.textContent = labels[section][lang];
      }
    });

    document.querySelectorAll('.cabinet-tile[data-open-section]').forEach((tile) => {
      const section = tile.getAttribute('data-open-section');
      const title = tile.querySelector('.cabinet-tile-title');
      const text = tile.querySelector('.cabinet-tile-text');

      if (labels[section] && title && title.textContent !== labels[section][lang]) {
        title.textContent = labels[section][lang];
      }
      if (descriptions[section] && text && text.textContent !== descriptions[section][lang]) {
        text.textContent = descriptions[section][lang];
      }
    });


    document.querySelectorAll('.cabinet-inner-nav-btn[data-section], .workspace-nav-btn[data-section]').forEach((button) => {
      const section = button.getAttribute('data-section');
      if (labels[section] && button.textContent !== labels[section][lang]) {
        button.textContent = labels[section][lang];
      }
    });

    cleanDoubleWeb();
    applyStaticNavigationOrder();
  }

  document.addEventListener('DOMContentLoaded', syncLabels);
  // Не перестраивать навигацию после каждого клика.
  // Синхронизация нужна только при настоящем переключении языка.
  document.addEventListener('click', (event) => {
    const toggle = event.target && event.target.closest
      ? event.target.closest(
          '[data-lang-toggle], #languageToggle, .language-toggle'
        )
      : null;

    if (toggle) {
      window.setTimeout(syncLabels, 80);
    }
  }, true);

  new MutationObserver(() => syncLabels()).observe(
    document.documentElement,
    {
      attributes: true,
      attributeFilter: ['lang']
    }
  );

  document.addEventListener(
    'irgeztne:language-changed',
    syncLabels
  );
  setTimeout(syncLabels, 120);
  setTimeout(syncLabels, 600);
})();
