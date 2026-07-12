(function () {
  'use strict';

  if (window.__IRGEZTNE_V008_MENU_FINAL_POLISH__) return;
  window.__IRGEZTNE_V008_MENU_FINAL_POLISH__ = true;

  var labelsRu = {
    workspace: 'Главная',
    files: 'Файлы',
    projects: 'Проекты',
    notes: 'Заметки',
    documents: 'Офис',
    'site-pages': 'Веб-студия',
    tools: 'Инструменты',
    map: 'Карта',
    editor: 'Редактор',
    codehub: 'Мастерская',
    marketplace: 'Шаблоны',
    rooms: 'Чат',
    analytics: 'Аналитика',
  };

  function normalizeMenuLabels() {
    document.querySelectorAll('[data-section], [data-open-section]').forEach(function (node) {
      var section = node.getAttribute('data-section') || node.getAttribute('data-open-section');
      if (!section || !labelsRu[section]) return;

      if (
        node.classList.contains('workspace-nav-btn') ||
        node.classList.contains('cabinet-inner-nav-btn') ||
        node.closest('[data-preview4-grid-nav="true"]')
      ) {
        node.textContent = labelsRu[section];
      }
    });

    document.querySelectorAll('[data-home-open="codehub"], [data-open-section="codehub"]').forEach(function (node) {
      var strong = node.querySelector && node.querySelector('strong');
      var title = node.querySelector && node.querySelector('.cabinet-tile-title');
      if (strong) strong.textContent = 'Мастерская пакетов';
      if (title) title.textContent = 'Мастерская пакетов';
    });
  }

  function polishSiteSettingsButton() {
    document.querySelectorAll('button').forEach(function (button) {
      var text = (button.textContent || '').replace(/\s+/g, ' ').trim();
      if (text === 'Настройки сайта' || text === 'Site settings') {
        button.classList.add('irgeztne-site-settings-cta-v008');
      }
    });
  }

  function run() {
    normalizeMenuLabels();
    polishSiteSettingsButton();
  }

  var timer = 0;
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(run, 60);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once: true });
  } else {
    run();
  }

  new MutationObserver(schedule).observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true
  });

  document.addEventListener('click', function () {
    setTimeout(run, 80);
  }, true);
})();
