(function () {
  'use strict';

  var MARK = 'IRGEZTNE_V005_WORKSPACE_SECTION_RAIL';

  if (window.__IRGEZTNE_WORKSPACE_SECTION_RAIL_V005__) return;
  window.__IRGEZTNE_WORKSPACE_SECTION_RAIL_V005__ = true;

  var ITEMS = [
    ['workspace', 'Главная'],
    ['site-pages', 'Веб-студия'],
    ['files', 'Файлы'],
    ['projects', 'Проекты'],
    ['documents', 'Офис'],
    ['notes', 'Заметки'],
    ['marketplace', 'Шаблоны'],
    ['codehub', 'Мастерская'],
    ['analytics', 'Аналитика'],
    ['tools', 'Инструменты']
  ];

  function cssEscape(value) {
    if (window.CSS && typeof window.CSS.escape === 'function') {
      return window.CSS.escape(value);
    }
    return String(value || '').replace(/"/g, '\\"');
  }

  function makeRail() {
    var rail = document.createElement('nav');
    rail.className = 'irg-workspace-section-rail-v005';
    rail.setAttribute('aria-label', 'Быстрые переходы пространства');
    rail.dataset.irWorkspaceSectionRail = MARK;

    var html = '<span class="irg-workspace-section-rail-v005__label">Разделы</span>';
    html += ITEMS.map(function (item) {
      return '<button type="button" class="irg-workspace-section-rail-v005__btn" data-ir-workspace-open="' +
        item[0] + '">' + item[1] + '</button>';
    }).join('');

    rail.innerHTML = html;
    return rail;
  }

  function getMounts() {
    var list = [];

    [
      document.getElementById('cabinetExpandedBody'),
      document.querySelector('.cabinet-expanded-body'),
      document.querySelector('.cabinet-body'),
      document.querySelector('.cabinet-content'),
      document.getElementById('workspaceShell'),
      document.querySelector('.workspace-shell')
    ].forEach(function (node) {
      if (node && list.indexOf(node) === -1) list.push(node);
    });

    return list;
  }

  function detectActiveSection() {
    var active =
      document.querySelector('.workspace-nav-btn.active[data-section]') ||
      document.querySelector('[data-section].active') ||
      document.querySelector('[data-open-section].active');

    if (active) {
      return active.dataset.section || active.dataset.openSection || '';
    }

    var visiblePanel = Array.prototype.find.call(
      document.querySelectorAll('.workspace-panel[data-panel]'),
      function (panel) {
        var style = window.getComputedStyle(panel);
        return style.display !== 'none' && style.visibility !== 'hidden' && panel.offsetParent !== null;
      }
    );

    if (visiblePanel) return visiblePanel.dataset.panel || '';

    return '';
  }

  function updateActive() {
    var active = detectActiveSection();

    document.querySelectorAll('.irg-workspace-section-rail-v005__btn').forEach(function (button) {
      button.classList.toggle('is-active', button.dataset.irWorkspaceOpen === active);
    });
  }

  function clickExistingSection(section) {
    var escaped = cssEscape(section);

    var selectors = [
      '.workspace-nav-btn[data-section="' + escaped + '"]',
      '[data-open-section="' + escaped + '"]',
      '[data-home-open="' + escaped + '"]',
      '[data-section="' + escaped + '"]'
    ];

    for (var i = 0; i < selectors.length; i += 1) {
      var button = document.querySelector(selectors[i]);
      if (button && !button.closest('.irg-workspace-section-rail-v005')) {
        button.click();
        return true;
      }
    }

    return false;
  }

  function openSection(section) {
    if (!section) return;

    if (clickExistingSection(section)) {
      setTimeout(updateActive, 40);
      return;
    }

    document.dispatchEvent(new CustomEvent('irgeztne:workspace-open-section', {
      detail: { section: section }
    }));
  }

  function mountRails() {
    getMounts().forEach(function (mount) {
      if (!mount || mount.querySelector(':scope > .irg-workspace-section-rail-v005')) return;
      mount.insertBefore(makeRail(), mount.firstChild);
    });

    updateActive();
  }

  document.addEventListener('click', function (event) {
    var button = event.target && event.target.closest
      ? event.target.closest('[data-ir-workspace-open]')
      : null;

    if (!button) return;

    event.preventDefault();
    event.stopPropagation();

    openSection(String(button.dataset.irWorkspaceOpen || ''));
  }, true);

  var observer = new MutationObserver(function () {
    mountRails();
  });

  function boot() {
    mountRails();

    if (document.body) {
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'style']
      });
    }

    setInterval(updateActive, 800);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
