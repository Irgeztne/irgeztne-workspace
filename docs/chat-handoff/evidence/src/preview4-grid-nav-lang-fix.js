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
    analytics: { ru: 'Задачи', en: 'Tasks' }
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
    analytics: {
      ru: 'Личные и проектные задачи, сроки и рабочие списки.',
      en: 'Personal and project tasks, deadlines and working lists.'
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
      if (!node.children.length && node.textContent) {
        node.textContent = node.textContent
          .replace(/Web Analytics/g, 'Tasks')
          .replace(/Веб Аналитика/g, 'Задачи')
          .replace(/Шаблоныа/g, 'Шаблоны');
      }
    });
  }

  // IRGEZTNE Workspace v031g Shell Navigation Owner Correction.
  // Короткие подписи навигации отделены от описаний модулей.
  // v031k: статические меню получают единый порядок.
  // Меню с собственным drag-owner здесь не переставляется.
  function applyStaticNavigationOrder() {
    const order = [
      'workspace',
      'files',
      'projects',
      'documents',
      'notes',
      'marketplace',
      'codehub',
      'rooms',
      'analytics',
      'tools',
      'map',
      'editor',
      'fili-store',
      'fili-safe',
      'site-pages'
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

      const bySection = new Map(
        Array.from(navigation.children).map((item) => [
          item.getAttribute('data-section'),
          item
        ])
      );

      order.forEach((section) => {
        const item = bySection.get(section);

        if (item) {
          navigation.appendChild(item);
        }
      });
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
