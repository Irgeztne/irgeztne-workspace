(function (root) {
  'use strict';

  var STORAGE_KEY = 'irgeztne.sitePages.v0';
  var DEFAULT_PAGES = [
    { title: 'Home', slug: 'index', status: 'published', type: 'home', menu: true, summary: 'Main landing page for this local site.' },
    { title: 'About', slug: 'about', status: 'draft', type: 'page', menu: true, summary: 'Project, team, or product description.' },
    { title: 'Contact', slug: 'contact', status: 'draft', type: 'page', menu: true, summary: 'Contact and next action page.' }
  ];

  function getLang() {
    try {
      if (root.__IRG_BROWSER_SHELL_API && typeof root.__IRG_BROWSER_SHELL_API.getLanguage === 'function') {
        return root.__IRG_BROWSER_SHELL_API.getLanguage() === 'en' ? 'en' : 'ru';
      }
    } catch (_) {}
    return (document.documentElement.getAttribute('lang') || '').toLowerCase() === 'en' ? 'en' : 'ru';
  }

  function t(ru, en) { return getLang() === 'en' ? en : ru; }

  function nowIso() { return new Date().toISOString(); }
  function uid(prefix) { return String(prefix || 'id') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8); }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function slugify(value) {
    return String(value || '')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^\p{L}\p{N}\s-]/gu, '')
      .trim()
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'page';
  }

  function clone(value) { return JSON.parse(JSON.stringify(value)); }

  function getSiteProfile() {
    if (root.NSSiteProfileStore && typeof root.NSSiteProfileStore.getProfile === 'function') {
      return root.NSSiteProfileStore.getProfile();
    }
    try {
      return JSON.parse(root.localStorage.getItem('ns.browser.v8.site-profile.v1') || '{}');
    } catch (_) { return {}; }
  }

  function updateSiteProfile(patch) {
    if (root.NSSiteProfileStore && typeof root.NSSiteProfileStore.updateProfile === 'function') {
      return root.NSSiteProfileStore.updateProfile(patch || {});
    }
    var next = Object.assign({}, getSiteProfile(), patch || {});
    try { root.localStorage.setItem('ns.browser.v8.site-profile.v1', JSON.stringify(next)); } catch (_) {}
    root.dispatchEvent(new CustomEvent('ns-site-profile:changed', { detail: { profile: clone(next) } }));
    return next;
  }

  function normalizePage(raw, index) {
    var source = raw && typeof raw === 'object' ? raw : {};
    var title = String(source.title || DEFAULT_PAGES[index] && DEFAULT_PAGES[index].title || 'Untitled page');
    var createdAt = source.createdAt || nowIso();
    return {
      id: String(source.id || uid('page')),
      title: title,
      slug: slugify(source.slug || title),
      status: ['draft', 'published', 'archived'].indexOf(String(source.status || '').toLowerCase()) >= 0 ? String(source.status).toLowerCase() : 'draft',
      type: String(source.type || 'page'),
      menu: source.menu !== false,
      summary: String(source.summary || ''),
      draftId: String(source.draftId || ''),
      createdAt: createdAt,
      updatedAt: source.updatedAt || createdAt
    };
  }

  function defaultState() {
    var time = nowIso();
    return {
      version: 1,
      activePageId: '',
      createdAt: time,
      updatedAt: time,
      publishConfig: {
        provider: 'manual',
        outputDir: 'output/',
        status: 'foundation-only'
      },
      pages: DEFAULT_PAGES.map(function (item, index) {
        return normalizePage(Object.assign({}, item, { id: 'page_' + item.slug, createdAt: time, updatedAt: time }), index);
      })
    };
  }

  function readState() {
    try {
      var raw = root.localStorage.getItem(STORAGE_KEY);
      var parsed = raw ? JSON.parse(raw) : null;
      var fallback = defaultState();
      var state = parsed && typeof parsed === 'object' ? parsed : fallback;
      var pages = Array.isArray(state.pages) && state.pages.length ? state.pages.map(normalizePage) : fallback.pages;
      var activePageId = state.activePageId && pages.some(function (page) { return page.id === state.activePageId; }) ? state.activePageId : pages[0].id;
      return {
        version: 1,
        activePageId: activePageId,
        createdAt: state.createdAt || fallback.createdAt,
        updatedAt: state.updatedAt || fallback.updatedAt,
        publishConfig: Object.assign({}, fallback.publishConfig, state.publishConfig || {}),
        pages: pages
      };
    } catch (error) {
      console.warn('[IRGEZTNE Site Pages] read failed', error);
      return defaultState();
    }
  }

  function writeState(state) {
    var next = Object.assign({}, state || readState(), { updatedAt: nowIso() });
    try { root.localStorage.setItem(STORAGE_KEY, JSON.stringify(next, null, 2)); } catch (error) { console.warn('[IRGEZTNE Site Pages] write failed', error); }
    root.dispatchEvent(new CustomEvent('irgeztne:site-pages-updated', { detail: { state: clone(next) } }));
    return next;
  }

  function getActivePage(state) {
    return (state.pages || []).find(function (page) { return page.id === state.activePageId; }) || state.pages[0] || null;
  }

  function createPage(state, template) {
    var title = template && template.title ? template.title : t('Новая страница', 'New page');
    var page = normalizePage({ title: title, slug: slugify(title), status: 'draft', type: 'page', menu: true, summary: t('Новая страница сайта.', 'New site page.') });
    page.slug = uniqueSlug(state.pages, page.slug);
    state.pages.unshift(page);
    state.activePageId = page.id;
    return writeState(state);
  }

  function uniqueSlug(pages, slug, currentId) {
    var base = slugify(slug);
    var next = base;
    var i = 2;
    while ((pages || []).some(function (page) { return page.id !== currentId && page.slug === next; })) {
      next = base + '-' + i;
      i += 1;
    }
    return next;
  }

  function statusLabel(status) {
    var value = String(status || '').toLowerCase();
    if (value === 'published') return t('опубликовано', 'published');
    if (value === 'archived') return t('архив', 'archived');
    return t('черновик', 'draft');
  }

  function typeLabel(type) {
    var value = String(type || '').toLowerCase();
    if (value === 'home') return t('главная', 'home');
    return t('страница', 'page');
  }

  function menuBadgeLabel() { return t('меню', 'menu'); }
  function draftLinkedLabel() { return t('черновик связан', 'draft linked'); }

  function buildMenu(state) {
    return (state.pages || [])
      .filter(function (page) { return page.menu && page.status !== 'archived'; })
      .map(function (page, index) {
        return { id: 'menu_' + page.id, pageId: page.id, label: page.title, slug: page.slug, order: index };
      });
  }

  function buildFoundationExport(state) {
    var profile = getSiteProfile();
    return {
      format: 'irgeztne.site.foundation',
      formatVersion: 1,
      site: {
        name: profile.siteName || 'Project Studio',
        tagline: profile.tagline || '',
        logoPath: profile.logoPath || '',
        faviconPath: profile.faviconPath || '',
        primaryColor: profile.primaryColor || '#2563eb'
      },
      pages: state.pages.map(function (page) {
        return { id: page.id, title: page.title, slug: page.slug, status: page.status, type: page.type, menu: page.menu, draftId: page.draftId || '' };
      }),
      menu: buildMenu(state),
      structure: {
        'site.config.json': t('идентичность сайта и настройки сборки', 'site identity and build settings'),
        'menu.json': t('пункты меню отдельно от страниц', 'menu items separate from pages'),
        'pages/': t('записи страниц и ссылки на контент', 'page records and content references'),
        'layouts/': t('шаблоны layouts позже', 'template layouts later'),
        'partials/': t('части шаблона позже', 'template partials later'),
        'assets/': t('assets сайта и превью', 'site assets and previews'),
        'output/': t('собранный статический сайт', 'built static site output'),
        'publish.config.json': t('metadata будущей публикации', 'future provider config metadata')
      },
      publish: state.publishConfig
    };
  }

  function downloadJson(name, data) {
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 900);
  }

  function getDraftById(draftId) {
    try {
      var api = root.NSEditorV1;
      var drafts = api && typeof api.getDrafts === 'function' ? api.getDrafts() : [];
      return Array.isArray(drafts) ? drafts.find(function (draft) { return draft && draft.id === draftId; }) : null;
    } catch (_) { return null; }
  }

  function pageToVisualHtml(page) {
    return '<section class="ns-page-section ns-page-hero ns-page-hero--split"><div class="ns-page-hero__content"><div class="ns-page-kicker">' + escapeHtml(page.type || 'Page') + '</div><h1>' + escapeHtml(page.title) + '</h1><p>' + escapeHtml(page.summary || 'Write this site page in IRGEZTNE Editor.') + '</p><div class="ns-page-actions"><a class="ns-page-button ns-page-button--primary" href="#content">Read more</a></div></div><aside class="ns-page-panel ns-page-panel--feature"><div class="ns-page-panel__eyebrow">Site / Pages</div><strong>Connected page</strong><p>This draft was opened from Site / Pages foundation v0.</p></aside></section><section class="ns-page-section" id="content"><div class="ns-page-section__head"><h2>Content</h2><p>Add page sections, text, links, images, or template blocks here.</p></div></section>';
  }

  function switchToEditor(surface) {
    var selectors = surface === 'cabinet'
      ? ['.cabinet-inner-nav-btn[data-section="editor"]', '[data-open-section="editor"]']
      : ['.workspace-nav-btn[data-section="editor"]', '.cabinet-inner-nav-btn[data-section="editor"]', '[data-section="editor"]'];
    for (var i = 0; i < selectors.length; i += 1) {
      var node = document.querySelector(selectors[i]);
      if (node && typeof node.click === 'function') {
        node.click();
        return true;
      }
    }
    return false;
  }

  function openInEditor(state, page, surfaceHint, retryCount) {
    var surface = surfaceHint || 'workspace';
    if (!page || !page.id) {
      setStatus(t('Сначала выберите страницу.', 'Select a page first.'));
      return state;
    }

    var instance = root.__nsEditorV1Instance;
    if (!instance || !instance.store || typeof instance.store.saveDraft !== 'function') {
      switchToEditor(surface);
      if ((retryCount || 0) < 8) {
        setStatus(t('Открываю Editor и готовлю черновик страницы…', 'Opening Editor and preparing the page draft…'));
        setTimeout(function () {
          var latest = readState();
          var freshPage = (latest.pages || []).find(function (item) { return item.id === page.id; });
          if (freshPage) openInEditor(latest, freshPage, surface, (retryCount || 0) + 1);
        }, 220);
      } else {
        setStatus(t('Editor не успел инициализироваться. Откройте Editor один раз и нажмите кнопку снова.', 'Editor did not initialize yet. Open Editor once and press the button again.'));
      }
      return state;
    }

    var draft = page.draftId ? getDraftById(page.draftId) : null;
    if (!draft) {
      if (root.NSEditorV1 && typeof root.NSEditorV1.createDraft === 'function') {
        draft = root.NSEditorV1.createDraft(null, { locale: getLang() });
      } else if (root.NSEditorV1 && typeof root.NSEditorV1.createDraftFromTemplate === 'function') {
        draft = root.NSEditorV1.createDraftFromTemplate(null, { locale: getLang(), initialTab: 'draft' });
      } else {
        draft = { id: uid('draft'), meta: {}, write: {}, project: {}, createdAt: nowIso(), updatedAt: nowIso() };
      }
    }

    var nextDraft = Object.assign({}, draft, {
      id: draft.id || uid('draft'),
      status: page.status === 'published' ? 'ready' : 'draft',
      project: Object.assign({}, draft.project || {}, { name: page.title, slug: page.slug }),
      meta: Object.assign({}, draft.meta || {}, {
        title: page.title,
        slug: page.slug,
        category: 'website',
        kicker: t('Страница сайта', 'Site page'),
        summary: page.summary || (draft.meta && draft.meta.summary) || '',
        seoTitle: page.title,
        seoDescription: page.summary || page.title,
        tags: Array.from(new Set([].concat((draft.meta && draft.meta.tags) || [], ['site-page']).filter(Boolean)))
      }),
      write: Object.assign({}, draft.write || {}, {
        visualHtml: (draft.write && draft.write.visualHtml && page.draftId) ? draft.write.visualHtml : pageToVisualHtml(page),
        markdown: (draft.write && draft.write.markdown && page.draftId) ? draft.write.markdown : '# ' + page.title + '\n\n' + (page.summary || '') + '\n',
        activeWorkspaceTab: 'draft',
        activeCabinetTab: 'write'
      }),
      sitePageId: page.id,
      updatedAt: nowIso()
    });

    try {
      draft = instance.store.saveDraft(nextDraft);
    } catch (error) {
      console.warn('[IRGEZTNE Site Pages] draft save failed', error);
      setStatus(t('Не удалось сохранить черновик страницы.', 'Could not save the page draft.'));
      return state;
    }

    page.draftId = draft.id;
    page.updatedAt = nowIso();
    state.activePageId = page.id;
    state = writeState(state);

    switchToEditor(surface);
    setTimeout(function () {
      if (root.NSEditorV1 && typeof root.NSEditorV1.openDraftById === 'function') {
        root.NSEditorV1.openDraftById(draft.id, surface === 'cabinet' ? 'cabinet' : 'workspace', surface === 'cabinet' ? 'write' : 'draft');
      }
      root.dispatchEvent(new CustomEvent('ns-editor-store-updated', { detail: { source: 'site-pages', draftId: draft.id, pageId: page.id } }));
    }, 160);

    setStatus(t('Страница связана с черновиком Editor.', 'Page linked to an Editor draft.'));
    return state;
  }

  var statusTimer = 0;
  function setStatus(message) {
    document.querySelectorAll('[data-site-pages-status]').forEach(function (node) { node.textContent = String(message || ''); });
    clearTimeout(statusTimer);
    statusTimer = setTimeout(function () {
      document.querySelectorAll('[data-site-pages-status]').forEach(function (node) { node.textContent = ''; });
    }, 4200);
  }

  function render(rootNode) {
    var state = readState();
    var page = getActivePage(state);
    var profile = getSiteProfile();
    var surface = rootNode.getAttribute('data-site-pages-surface') || rootNode.getAttribute('data-documents-surface') || (rootNode.closest('[data-cabinet-panel]') ? 'cabinet' : 'workspace');
    var exportJson = buildFoundationExport(state);
    var pagesHtml = state.pages.map(function (item) {
      var statusClass = item.status === 'published' ? 'site-pages-v0-badge--published' : 'site-pages-v0-badge--draft';
      return '<button class="site-pages-v0-page-item ' + (item.id === state.activePageId ? 'is-active' : '') + '" type="button" data-site-pages-select="' + escapeHtml(item.id) + '"><strong>' + escapeHtml(item.title) + '</strong><span>/' + escapeHtml(item.slug) + ' · ' + escapeHtml(typeLabel(item.type)) + '</span><div class="site-pages-v0-badges"><em class="site-pages-v0-badge ' + statusClass + '">' + escapeHtml(statusLabel(item.status)) + '</em>' + (item.menu ? '<em class="site-pages-v0-badge">' + escapeHtml(menuBadgeLabel()) + '</em>' : '') + (item.draftId ? '<em class="site-pages-v0-badge">' + escapeHtml(draftLinkedLabel()) + '</em>' : '') + '</div></button>';
    }).join('');

    rootNode.innerHTML = '<div class="site-pages-v0-shell" data-site-pages-shell data-surface="' + escapeHtml(surface) + '">' +
      '<section class="site-pages-v0-hero"><div class="site-pages-v0-kicker">' + escapeHtml(t('Сайт / Страницы · foundation v0', 'Site / Pages · foundation v0')) + '</div><h2 class="site-pages-v0-title">' + escapeHtml(t('Локальный сайт, страницы и меню', 'Local site, pages, and menu')) + '</h2><p class="site-pages-v0-subtitle">' + escapeHtml(t('Здесь собирается центр управления сайтом: идентичность, страницы, начальное меню, структура будущего export/publish. Редактор остаётся местом редактирования конкретной страницы.', 'This is the site control center: identity, pages, starting menu, and future export/publish structure. Editor remains the place to edit a specific page.')) + '</p><div class="site-pages-v0-actions"><button class="site-pages-v0-button site-pages-v0-button--primary" type="button" data-site-pages-action="new-page">' + escapeHtml(t('+ Новая страница', '+ New page')) + '</button><button class="site-pages-v0-button" type="button" data-site-pages-action="export-foundation">' + escapeHtml(t('Экспорт foundation JSON', 'Export foundation JSON')) + '</button><span class="site-pages-v0-status" data-site-pages-status></span></div></section>' +
      '<div class="site-pages-v0-grid"><aside class="site-pages-v0-stack"><section class="site-pages-v0-card"><h3>' + escapeHtml(t('Идентичность сайта / workspace', 'Site / Workspace Identity')) + '</h3><p>' + escapeHtml(t('Локальный профиль сайта. Это не онлайн-аккаунт.', 'Local site profile. This is not an online account.')) + '</p><div class="site-pages-v0-form"><label class="site-pages-v0-field"><span>' + escapeHtml(t('Название сайта', 'Site name')) + '</span><input class="site-pages-v0-input" data-site-pages-profile="siteName" value="' + escapeHtml(profile.siteName || 'Project Studio') + '"></label><label class="site-pages-v0-field"><span>' + escapeHtml(t('Слоган', 'Tagline')) + '</span><input class="site-pages-v0-input" data-site-pages-profile="tagline" value="' + escapeHtml(profile.tagline || '') + '"></label><label class="site-pages-v0-field"><span>' + escapeHtml(t('Основной цвет', 'Primary color')) + '</span><input class="site-pages-v0-input" type="color" data-site-pages-profile="primaryColor" value="' + escapeHtml(profile.primaryColor || '#2563eb') + '"></label><button class="site-pages-v0-button" type="button" data-site-pages-action="save-profile">' + escapeHtml(t('Сохранить профиль', 'Save identity')) + '</button></div></section><section class="site-pages-v0-card"><h3>' + escapeHtml(t('Менеджер страниц v0', 'Pages Manager v0')) + '</h3><p>' + escapeHtml(t('Страницы существуют отдельно от меню. Страницу можно открыть в Editor.', 'Pages exist separately from the menu. A page can be opened in Editor.')) + '</p><div class="site-pages-v0-page-list">' + pagesHtml + '</div></section></aside>' +
      '<main class="site-pages-v0-editor">' + (page ? '<section class="site-pages-v0-panel"><h3>' + escapeHtml(t('Активная страница', 'Active page')) + '</h3><div class="site-pages-v0-form"><label class="site-pages-v0-field"><span>' + escapeHtml(t('Заголовок', 'Title')) + '</span><input class="site-pages-v0-input" data-site-pages-field="title" value="' + escapeHtml(page.title) + '"></label><div class="site-pages-v0-meta-row"><label class="site-pages-v0-field"><span>' + escapeHtml(t('Slug / адрес страницы', 'Slug / page URL')) + '</span><input class="site-pages-v0-input" data-site-pages-field="slug" value="' + escapeHtml(page.slug) + '"></label><label class="site-pages-v0-field"><span>' + escapeHtml(t('Статус', 'Status')) + '</span><select class="site-pages-v0-select" data-site-pages-field="status"><option value="draft"' + (page.status === 'draft' ? ' selected' : '') + '>' + escapeHtml(t('черновик', 'draft')) + '</option><option value="published"' + (page.status === 'published' ? ' selected' : '') + '>' + escapeHtml(t('опубликовано', 'published')) + '</option><option value="archived"' + (page.status === 'archived' ? ' selected' : '') + '>' + escapeHtml(t('архив', 'archived')) + '</option></select></label></div><label class="site-pages-v0-field"><span>' + escapeHtml(t('Краткое описание', 'Short description')) + '</span><textarea class="site-pages-v0-textarea" data-site-pages-field="summary">' + escapeHtml(page.summary) + '</textarea></label><label class="site-pages-v0-field"><span><input type="checkbox" data-site-pages-field="menu"' + (page.menu ? ' checked' : '') + '> ' + escapeHtml(t('Показывать в меню', 'Show in menu')) + '</span></label><div class="site-pages-v0-actions"><button class="site-pages-v0-button site-pages-v0-button--primary" type="button" data-site-pages-action="save-page">' + escapeHtml(t('Сохранить страницу', 'Save page')) + '</button><button class="site-pages-v0-button" type="button" data-site-pages-action="open-editor">' + escapeHtml(t('Редактировать страницу', 'Edit page')) + '</button><button class="site-pages-v0-button" type="button" data-site-pages-action="duplicate-page">' + escapeHtml(t('Дублировать', 'Duplicate')) + '</button><button class="site-pages-v0-button site-pages-v0-button--danger" type="button" data-site-pages-action="delete-page"' + (state.pages.length <= 1 ? ' disabled' : '') + '>' + escapeHtml(t('Удалить', 'Delete')) + '</button></div></div></section><section class="site-pages-v0-panel"><h3>' + escapeHtml(t('Основа меню', 'Menu foundation')) + '</h3><p>' + escapeHtml(t('Пока меню собирается из страниц с включённым флагом меню. Позже добавим reorder/submenu.', 'For now, the menu is built from pages with the menu flag enabled. Reorder/submenu comes later.')) + '</p><pre class="site-pages-v0-code">' + escapeHtml(JSON.stringify(buildMenu(state), null, 2)) + '</pre></section><section class="site-pages-v0-panel"><h3>' + escapeHtml(t('Структура сборки / экспорта', 'Build / export structure')) + '</h3><p>' + escapeHtml(t('Это metadata-основа. Реальный deploy и provider tokens не добавляются в 1.0.0.', 'This is metadata foundation. Real deploy and provider tokens are not added in 1.0.0.')) + '</p><pre class="site-pages-v0-code">' + escapeHtml(JSON.stringify(exportJson.structure, null, 2)) + '</pre></section>' : '<div class="site-pages-v0-empty">' + escapeHtml(t('Страниц пока нет.', 'No pages yet.')) + '</div>') + '</main></div></div>';
  }

  function saveActivePage(rootNode) {
    var state = readState();
    var page = getActivePage(state);
    if (!page) return state;
    page.title = rootNode.querySelector('[data-site-pages-field="title"]')?.value.trim() || page.title;
    page.slug = uniqueSlug(state.pages, rootNode.querySelector('[data-site-pages-field="slug"]')?.value || page.title, page.id);
    page.status = rootNode.querySelector('[data-site-pages-field="status"]')?.value || 'draft';
    page.summary = rootNode.querySelector('[data-site-pages-field="summary"]')?.value || '';
    page.menu = Boolean(rootNode.querySelector('[data-site-pages-field="menu"]')?.checked);
    page.updatedAt = nowIso();
    return writeState(state);
  }

  function bindRoot(rootNode) {
    if (!rootNode || rootNode.dataset.sitePagesBound === 'true') return;
    rootNode.dataset.sitePagesBound = 'true';
    rootNode.addEventListener('click', function (event) {
      var select = event.target.closest('[data-site-pages-select]');
      if (select) {
        var state = readState();
        state.activePageId = String(select.getAttribute('data-site-pages-select') || '');
        writeState(state);
        renderAll();
        return;
      }

      var actionNode = event.target.closest('[data-site-pages-action]');
      if (!actionNode) return;
      var action = String(actionNode.getAttribute('data-site-pages-action') || '');
      var state = readState();
      var page = getActivePage(state);

      if (action === 'new-page') {
        state = createPage(state);
        setStatus(t('Страница создана.', 'Page created.'));
        renderAll();
        return;
      }
      if (action === 'save-profile') {
        updateSiteProfile({
          siteName: rootNode.querySelector('[data-site-pages-profile="siteName"]')?.value.trim() || 'Project Studio',
          tagline: rootNode.querySelector('[data-site-pages-profile="tagline"]')?.value.trim() || '',
          primaryColor: rootNode.querySelector('[data-site-pages-profile="primaryColor"]')?.value || '#2563eb'
        });
        setStatus(t('Identity сохранена.', 'Identity saved.'));
        renderAll();
        return;
      }
      if (action === 'save-page') {
        saveActivePage(rootNode);
        setStatus(t('Страница сохранена.', 'Page saved.'));
        renderAll();
        return;
      }
      if (action === 'open-editor' && page) {
        state = saveActivePage(rootNode);
        page = getActivePage(state);
        openInEditor(state, page, rootNode.closest('[data-cabinet-panel]') ? 'cabinet' : 'workspace');
        renderAll();
        return;
      }
      if (action === 'duplicate-page' && page) {
        var copy = normalizePage(Object.assign({}, page, { id: uid('page'), title: page.title + ' copy', slug: uniqueSlug(state.pages, page.slug + '-copy'), createdAt: nowIso(), updatedAt: nowIso(), draftId: '' }));
        state.pages.unshift(copy);
        state.activePageId = copy.id;
        writeState(state);
        setStatus(t('Страница продублирована.', 'Page duplicated.'));
        renderAll();
        return;
      }
      if (action === 'delete-page' && page && state.pages.length > 1) {
        state.pages = state.pages.filter(function (item) { return item.id !== page.id; });
        state.activePageId = state.pages[0] && state.pages[0].id || '';
        writeState(state);
        setStatus(t('Страница удалена.', 'Page deleted.'));
        renderAll();
        return;
      }
      if (action === 'export-foundation') {
        downloadJson('irgeztne-site-foundation.json', buildFoundationExport(state));
        setStatus(t('Foundation JSON экспортирован.', 'Foundation JSON exported.'));
      }
    });
  }

  function renderAll() {
    updateNavLabels();
    document.querySelectorAll('[data-site-pages-root]').forEach(function (node) {
      bindRoot(node);
      render(node);
    });
  }

  function updateNavLabels() {
    document.querySelectorAll('[data-section="site-pages"], [data-open-section="site-pages"], [data-home-open="site-pages"]').forEach(function (node) {
      if (node.matches('.workspace-nav-btn, .cabinet-inner-nav-btn')) {
        node.textContent = t('Сайт / Страницы', 'Site / Pages');
      }
    });
  }

  root.IRGEZTNESitePagesV0 = {
    init: renderAll,
    getState: readState,
    setState: writeState,
    buildFoundationExport: function () { return buildFoundationExport(readState()); }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderAll);
  } else {
    renderAll();
  }
  document.addEventListener('irg:language-changed', renderAll);
  root.addEventListener('ns-site-profile:changed', renderAll);
})(window);
