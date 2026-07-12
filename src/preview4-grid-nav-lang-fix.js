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
    codehub: { ru: 'Каталог шаблонов, тем, блоков, виджетов и ассетов.', en: 'Catalog of templates, themes, blocks, widgets and assets.' },
    marketplace: { ru: 'Шаблоны', en: 'Templates' },
    rooms: { ru: 'Комнаты', en: 'Rooms' },
    analytics: { ru: 'Аналитика', en: 'Analytics' }
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
      ru: 'Аналитика сайта, экспортов и публикации.',
      en: 'Analytics for sites, exports, and publishing.'
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
          .replace(/Web Analytics/g, 'Analytics')
          .replace(/Веб Аналитика/g, 'Аналитика')
          .replace(/Шаблоныа/g, 'Шаблоны');
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
  }

  document.addEventListener('DOMContentLoaded', syncLabels);
  document.addEventListener('click', () => setTimeout(syncLabels, 80), true);
  setTimeout(syncLabels, 120);
  setTimeout(syncLabels, 600);
})();
