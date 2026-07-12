(function () {
  'use strict';

  var LINKS = {
    website: {
      url: 'https://irgeztne.com/',
      title: 'IRGEZTNE'
    },
    updates: {
      url: 'https://irgeztne.com/download.html',
      title: 'IRGEZTNE Latest Version'
    },
    releases: {
      url: 'https://irgeztne.com/releases.html',
      title: 'IRGEZTNE Releases'
    },
    github: {
      url: 'https://github.com/Irgeztne/irgeztne-workspace',
      title: 'IRGEZTNE GitHub'
    }
  };

  var TEXT = {
    ru: {
      menuTitle: 'Меню IRGEZTNE',
      website: 'Официальный сайт',
      updates: 'Проверить новую версию',
      releases: 'Релизы / история версий',
      docs: 'Документация — в разработке',
      github: 'GitHub репозиторий',
      about: 'О IRGEZTNE',
      bookmarks: 'Закладки',
      backup: 'Backup / перенос workspace',
      savedSitesTitle: 'Закладки',
      savedSitesSubtitle: 'Компактная строка сохранённых сайтов под адресной строкой.',
      savedSitesEmpty: '',
      savedSitesOpen: 'Открыть',
      savedSitesRemove: 'Удалить',
      savedSitesClose: 'Закрыть',
      docsStatus: 'Документация пока в разработке. Сейчас доступны официальный сайт, проверка новой версии, релизы и GitHub.',
      aboutStatus: 'IRGEZTNE Workspace — open-source, desktop-first, local-first пространство для файлов, проектов, заметок, документов, редактора, CodeHub и будущей файловой экосистемы.',
      bookmarkTitle: 'Закладка — сохранить или удалить текущий сайт',
      bookmarkSaved: 'Сайт сохранён в Закладки.',
      bookmarkRemoved: 'Сайт удалён из Закладок.',
      opened: 'Открываю: ',
      backupUnavailable: 'Backup-модуль ещё загружается. Попробуйте ещё раз.'
    },
    en: {
      menuTitle: 'IRGEZTNE menu',
      website: 'Official website',
      updates: 'Check for updates',
      releases: 'Releases / version history',
      docs: 'Documentation — in development',
      github: 'GitHub repository',
      about: 'About IRGEZTNE',
      bookmarks: 'Bookmarks',
      backup: 'Workspace Backup / Migration',
      savedSitesTitle: 'Bookmarks',
      savedSitesSubtitle: 'Compact saved-site row under the address bar.',
      savedSitesEmpty: '',
      savedSitesOpen: 'Open',
      savedSitesRemove: 'Remove',
      savedSitesClose: 'Close',
      docsStatus: 'Documentation is in development. For now, use the official website, update check, releases, and GitHub.',
      aboutStatus: 'IRGEZTNE Workspace is an open-source, desktop-first, local-first space for files, projects, notes, documents, Editor, CodeHub, and the future file ecosystem.',
      bookmarkTitle: 'Bookmark — save or remove the current site',
      bookmarkSaved: 'Site saved to Bookmarks.',
      bookmarkRemoved: 'Site removed from Bookmarks.',
      opened: 'Opening: ',
      backupUnavailable: 'Backup module is still loading. Try again.'
    }
  };

  function getLang() {
    try {
      if (window.__IRG_BROWSER_SHELL_API && typeof window.__IRG_BROWSER_SHELL_API.getLanguage === 'function') {
        return window.__IRG_BROWSER_SHELL_API.getLanguage() === 'ru' ? 'ru' : 'en';
      }
    } catch (_) {}
    var htmlLang = (document.documentElement.getAttribute('lang') || '').toLowerCase();
    return htmlLang === 'en' ? 'en' : 'ru';
  }

  function t(key) {
    var dict = TEXT[getLang()] || TEXT.ru;
    return dict[key] || TEXT.ru[key] || key;
  }

  function setButtonText(selector, text) {
    var node = document.querySelector(selector);
    if (node) node.textContent = text;
  }

  function showStatus(message) {
    var status = document.getElementById('topbarStatus');
    if (!status) return;
    status.textContent = message;
    status.classList.remove('hidden');
    window.clearTimeout(showStatus.timer);
    showStatus.timer = window.setTimeout(function () {
      status.classList.add('hidden');
    }, 4400);
  }

  function openBackupPanel() {
    closeMenu();
    if (window.NSWorkspaceBackup && typeof window.NSWorkspaceBackup.openPanel === 'function') {
      window.NSWorkspaceBackup.openPanel();
    } else {
      showStatus(t('backupUnavailable'));
    }
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getSavedSitesElements() {
    return {
      panel: document.getElementById('savedSitesPanel'),
      list: document.getElementById('savedSitesList')
    };
  }

  function getSavedSites() {
    try {
      var api = window.__IRG_BROWSER_SHELL_API;
      if (api && typeof api.getBookmarks === 'function') {
        var items = api.getBookmarks();
        return Array.isArray(items) ? items.slice() : [];
      }
    } catch (_) {}
    return Array.isArray(window.__IRG_BROWSER_BOOKMARKS__) ? window.__IRG_BROWSER_BOOKMARKS__.slice() : [];
  }


  function setBookmarksRowVisible(visible) {
    // 1.0.0: keep the browser viewport clean.
    // The star still saves/removes bookmarks, but the saved-sites row
    // should not auto-open over the web page.
    visible = false;

    var els = getSavedSitesElements();
    if (!els.panel) return;
    els.panel.classList.toggle('hidden', !visible);
    els.panel.setAttribute('aria-hidden', visible ? 'false' : 'true');
    document.body.classList.toggle('has-bookmarks-row', Boolean(visible));
  }

  function getUrlHost(value) {
    try {
      return new URL(String(value || '')).hostname.replace(/^www\./, '');
    } catch (_) {
      return String(value || '').replace(/^https?:\/\//, '').split('/')[0] || '';
    }
  }

  function getBookmarkInitial(title, url) {
    var source = String(title || getUrlHost(url) || '★').trim();
    return (source.charAt(0) || '★').toUpperCase();
  }

  function formatSavedDate(value) {
    if (!value) return '';
    try {
      var date = new Date(value);
      if (!Number.isFinite(date.getTime())) return '';
      return date.toLocaleDateString(getLang() === 'ru' ? 'ru-RU' : 'en-US', { year: 'numeric', month: 'short', day: '2-digit' });
    } catch (_) {
      return '';
    }
  }

  function renderSavedSitesPanel() {
    var els = getSavedSitesElements();
    if (!els.panel || !els.list) return;

    var items = getSavedSites().sort(function (a, b) {
      return new Date((b && b.savedAt) || 0).getTime() - new Date((a && a.savedAt) || 0).getTime();
    });

    if (!items.length) {
      els.list.innerHTML = '';
      setBookmarksRowVisible(false);
      return;
    }

    els.list.innerHTML = items.map(function (item) {
      var title = String((item && item.title) || (item && item.url) || '');
      var url = String((item && item.url) || '');
      var id = String((item && item.id) || url);
      var host = getUrlHost(url);
      var initial = getBookmarkInitial(title, url);
      return '' +
        '<div class="saved-sites-item" title="' + escapeHtml(title || url) + ' — ' + escapeHtml(url) + '">' +
          '<button type="button" class="saved-sites-chip" data-saved-sites-open="' + escapeHtml(url) + '" data-saved-sites-title="' + escapeHtml(title || url) + '">' +
            '<span class="saved-sites-favicon" aria-hidden="true">' + escapeHtml(initial) + '</span>' +
            '<span class="saved-sites-chip-text">' +
              '<span class="saved-sites-item-title">' + escapeHtml(title || host || url) + '</span>' +
              '<span class="saved-sites-item-url">' + escapeHtml(host || url) + '</span>' +
            '</span>' +
          '</button>' +
          '<button type="button" class="saved-sites-remove" data-saved-sites-remove="' + escapeHtml(id) + '" aria-label="' + escapeHtml(t('savedSitesRemove')) + '">×</button>' +
        '</div>';
    }).join('');

    setBookmarksRowVisible(true);
  }

  function openSavedSitesPanel() {
    renderSavedSitesPanel();
  }

  function closeSavedSitesPanel() {
    renderSavedSitesPanel();
  }

  function openInternalTab(link) {
    if (!link || !link.url) return;
    try {
      if (window.__IRG_BROWSER_SHELL_API && typeof window.__IRG_BROWSER_SHELL_API.createTab === 'function') {
        window.__IRG_BROWSER_SHELL_API.createTab({ title: link.title || link.url, url: link.url });
        if (typeof window.__IRG_BROWSER_SHELL_API.updateAddressFromActiveTab === 'function') {
          window.__IRG_BROWSER_SHELL_API.updateAddressFromActiveTab();
        }
        showStatus(t('opened') + (link.title || link.url));
        return;
      }
    } catch (error) {
      console.warn('[IRGEZTNE topbar menu] createTab failed', error);
    }
    try {
      window.open(link.url, '_blank', 'noopener');
    } catch (_) {}
  }

  function closeMenu() {
    var button = document.getElementById('topbarMoreBtn');
    var menu = document.getElementById('topbarMoreMenu');
    if (menu) menu.classList.add('hidden');
    if (button) button.setAttribute('aria-expanded', 'false');
  }

  function toggleMenu() {
    var button = document.getElementById('topbarMoreBtn');
    var menu = document.getElementById('topbarMoreMenu');
    if (!button || !menu) return;
    var open = menu.classList.contains('hidden');
    menu.classList.toggle('hidden', !open);
    button.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function updateLabels() {
    var button = document.getElementById('topbarMoreBtn');
    var menu = document.getElementById('topbarMoreMenu');
    var bookmark = document.getElementById('bookmarkBtn');
    var backupButton = document.getElementById('workspaceBackupTopbarBtn');

    if (button) {
      button.title = t('menuTitle');
      button.setAttribute('aria-label', t('menuTitle'));
    }
    if (menu) {
      menu.setAttribute('aria-label', t('menuTitle'));
    }
    if (backupButton) {
      backupButton.title = t('backup');
      backupButton.setAttribute('aria-label', t('backup'));
    }
    setButtonText('[data-topbar-link="website"]', t('website'));
    setButtonText('[data-topbar-link="updates"]', t('updates'));
    setButtonText('[data-topbar-link="releases"]', t('releases'));
    setButtonText('[data-topbar-link="github"]', t('github'));
    setButtonText('[data-topbar-action="docs-status"]', t('docs'));
    setButtonText('[data-topbar-action="about"]', t('about'));
    renderSavedSitesPanel();

    if (bookmark) {
      bookmark.title = t('bookmarkTitle');
      bookmark.setAttribute('aria-label', t('bookmarkTitle'));
    }
  }

  function init() {
    var wrapper = document.getElementById('topbarMore');
    var button = document.getElementById('topbarMoreBtn');
    var menu = document.getElementById('topbarMoreMenu');
    var bookmark = document.getElementById('bookmarkBtn');
    var backupButton = document.getElementById('workspaceBackupTopbarBtn');

    if (backupButton && !backupButton.__irgeztneBackupBound) {
      backupButton.__irgeztneBackupBound = true;
      backupButton.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        openBackupPanel();
      });
    }

    if (!wrapper || !button || !menu || button.__irgeztneMoreBound) {
      updateLabels();
      return;
    }

    button.__irgeztneMoreBound = true;
    button.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      toggleMenu();
    });

    menu.addEventListener('click', function (event) {
      var linkButton = event.target.closest('[data-topbar-link]');
      var actionButton = event.target.closest('[data-topbar-action]');
      if (!linkButton && !actionButton) return;
      event.preventDefault();
      event.stopPropagation();
      closeMenu();

      if (linkButton) {
        var key = String(linkButton.getAttribute('data-topbar-link') || '');
        openInternalTab(LINKS[key]);
        return;
      }

      var action = String(actionButton.getAttribute('data-topbar-action') || '');
      if (action === 'workspace-backup') {
        openBackupPanel();
        return;
      }
      if (action === 'docs-status') {
        showStatus(t('docsStatus'));
        return;
      }
      if (action === 'about') {
        showStatus(t('aboutStatus'));
        return;
      }
    });

    document.addEventListener('click', function (event) {
      if (!wrapper.contains(event.target)) closeMenu();
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        closeMenu();
        if (window.NSWorkspaceBackup && typeof window.NSWorkspaceBackup.closePanel === 'function') {
          window.NSWorkspaceBackup.closePanel();
        }
      }
    });

    document.addEventListener('click', function (event) {
      var removeBtn = event.target.closest('[data-saved-sites-remove]');
      if (removeBtn) {
        event.preventDefault();
        event.stopPropagation();
        var value = String(removeBtn.getAttribute('data-saved-sites-remove') || '');
        var api = window.__IRG_BROWSER_SHELL_API;
        if (value && api && typeof api.removeBookmark === 'function') {
          api.removeBookmark(value);
        }
        renderSavedSitesPanel();
        return;
      }

      var openBtn = event.target.closest('[data-saved-sites-open]');
      if (openBtn) {
        event.preventDefault();
        event.stopPropagation();
        var url = String(openBtn.getAttribute('data-saved-sites-open') || '');
        var title = String(openBtn.getAttribute('data-saved-sites-title') || url);
        if (url) {
          openInternalTab({ url: url, title: title });
        }
      }
    });

    document.addEventListener('irg:bookmarks-updated', renderSavedSitesPanel);

    if (bookmark && !bookmark.__irgeztneBookmarkStatusBound) {
      bookmark.__irgeztneBookmarkStatusBound = true;
      bookmark.addEventListener('click', function () {
        window.setTimeout(function () {
          var saved = bookmark.getAttribute('aria-pressed') === 'true';
          showStatus(saved ? t('bookmarkSaved') : t('bookmarkRemoved'));
          updateLabels();
          renderSavedSitesPanel();
        }, 0);
      });
    }

    updateLabels();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  document.addEventListener('irg:language-changed', updateLabels);
  document.addEventListener('irg:browser-shell-ready', updateLabels);
})();
