(function () {
  'use strict';

  if (window.__irgeztneEditorSitePageDirectBridgeV0) return;
  window.__irgeztneEditorSitePageDirectBridgeV0 = true;

  const EDITOR_STORE_KEY = 'ns.browser.v8.editor.v1';
  const SITE_PAGES_KEY = 'irgeztne.sitePages.v0';

  function nowIso() {
    return new Date().toISOString();
  }

  function uid(prefix) {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function isRu() {
    const lang = String(document.documentElement.lang || document.body?.dataset?.lang || '').toLowerCase();
    const buttonText = document.querySelector('[data-action="new-site-page"]')?.textContent || '';
    return lang.startsWith('ru') || /страниц|черновик|редактор/i.test(buttonText);
  }

  function tr(en, ru) {
    return isRu() ? ru : en;
  }

  function slugify(value) {
    const source = String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[а]/g, 'a').replace(/[б]/g, 'b').replace(/[в]/g, 'v')
      .replace(/[г]/g, 'g').replace(/[д]/g, 'd').replace(/[её]/g, 'e')
      .replace(/[ж]/g, 'zh').replace(/[з]/g, 'z').replace(/[и]/g, 'i')
      .replace(/[й]/g, 'y').replace(/[к]/g, 'k').replace(/[л]/g, 'l')
      .replace(/[м]/g, 'm').replace(/[н]/g, 'n').replace(/[о]/g, 'o')
      .replace(/[п]/g, 'p').replace(/[р]/g, 'r').replace(/[с]/g, 's')
      .replace(/[т]/g, 't').replace(/[у]/g, 'u').replace(/[ф]/g, 'f')
      .replace(/[х]/g, 'h').replace(/[ц]/g, 'c').replace(/[ч]/g, 'ch')
      .replace(/[ш]/g, 'sh').replace(/[щ]/g, 'sch').replace(/[ы]/g, 'y')
      .replace(/[э]/g, 'e').replace(/[ю]/g, 'yu').replace(/[я]/g, 'ya')
      .replace(/[ьъ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return source || 'site-page';
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : fallback;
    } catch (error) {
      console.warn('[IRGEZTNE] Could not read', key, error);
      return fallback;
    }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function defaultPagesState() {
    const time = nowIso();
    return {
      version: 1,
      activePageId: 'page_index',
      createdAt: time,
      updatedAt: time,
      publishConfig: { provider: 'manual', outputDir: 'output/', status: 'foundation-only' },
      pages: [
        { id: 'page_index', title: 'Home', slug: 'index', status: 'published', type: 'home', menu: true, summary: 'Main landing page for this local site.', draftId: '', createdAt: time, updatedAt: time },
        { id: 'page_about', title: 'About', slug: 'about', status: 'draft', type: 'page', menu: true, summary: 'Project, team, or product description.', draftId: '', createdAt: time, updatedAt: time },
        { id: 'page_contact', title: 'Contact', slug: 'contact', status: 'draft', type: 'page', menu: true, summary: 'Contact and next action page.', draftId: '', createdAt: time, updatedAt: time }
      ]
    };
  }

  function uniqueSlug(pages, baseSlug) {
    const base = slugify(baseSlug || 'site-page');
    let next = base;
    let index = 2;
    const used = new Set((pages || []).map((page) => String(page.slug || '')));
    while (used.has(next)) {
      next = `${base}-${index}`;
      index += 1;
    }
    return next;
  }

  function createBaseDraft(title, slug, summary) {
    const api = window.NSEditorV1;
    let draft = null;
    try {
      if (api && typeof api.createDraft === 'function') {
        draft = api.createDraft(null, { locale: isRu() ? 'ru' : 'en' });
      }
    } catch (error) {
      console.warn('[IRGEZTNE] Could not create draft from editor API, using fallback.', error);
    }

    const time = nowIso();
    if (!draft || typeof draft !== 'object') {
      draft = {
        id: uid('draft'),
        templateId: 'project-landing',
        locale: isRu() ? 'ru' : 'en',
        status: 'draft',
        createdAt: time,
        updatedAt: time,
        project: { name: title, slug },
        meta: {},
        content: {},
        write: {},
        deploy: { manual: { fileName: `${slug}.html` } },
        projectId: '',
        linkedFileIds: [],
        linkedNoteIds: [],
        output: { files: ['index.html', 'styles.css', 'page.json'] }
      };
    }

    const visualHtml = [
      '<section class="ns-page-section ns-page-hero ns-page-hero--split">',
      '<div class="ns-page-hero__content">',
      `<div class="ns-page-kicker">${escapeHtml(tr('Site page', 'Страница сайта'))}</div>`,
      `<h1>${escapeHtml(title)}</h1>`,
      `<p>${escapeHtml(summary)}</p>`,
      '</div>',
      '</section>',
      '<section class="ns-page-section">',
      `<h2>${escapeHtml(tr('Content', 'Контент'))}</h2>`,
      `<p>${escapeHtml(tr('Start writing this site page here.', 'Начните писать страницу сайта здесь.'))}</p>`,
      '</section>'
    ].join('');

    draft.id = draft.id || uid('draft');
    draft.status = 'draft';
    draft.updatedAt = time;
    draft.createdAt = draft.createdAt || time;
    draft.project = { ...(draft.project || {}), name: title, slug };
    draft.meta = {
      ...(draft.meta || {}),
      title,
      slug,
      category: 'website',
      kicker: tr('Site page', 'Страница сайта'),
      summary,
      excerpt: summary,
      seoTitle: title,
      seoDescription: summary,
      tags: Array.from(new Set([...(draft.meta?.tags || []), 'site-page'].filter(Boolean)))
    };
    draft.write = {
      ...(draft.write || {}),
      visualHtml,
      markdown: `# ${title}\n\n${summary}\n`,
      activeWorkspaceTab: 'draft',
      activeCabinetTab: 'write'
    };
    draft.content = { ...(draft.content || {}), body: visualHtml };
    draft.sitePageId = draft.sitePageId || '';
    return draft;
  }

  function saveEditorDraft(draft) {
    const state = readJson(EDITOR_STORE_KEY, { version: 2, drafts: [], activeDraftId: null });
    const drafts = Array.isArray(state.drafts) ? state.drafts : [];
    const nextDrafts = [draft, ...drafts.filter((item) => String(item.id || '') !== String(draft.id || ''))];
    const next = { version: 2, ...state, drafts: nextDrafts, activeDraftId: draft.id };
    writeJson(EDITOR_STORE_KEY, next);

    if (window.__nsEditorV1Instance && window.__nsEditorV1Instance.store) {
      window.__nsEditorV1Instance.store.state = next;
    }
    return next;
  }

  function saveSitePage(page) {
    const state = readJson(SITE_PAGES_KEY, defaultPagesState());
    const pages = Array.isArray(state.pages) ? state.pages : [];
    const nextPages = [page, ...pages.filter((item) => String(item.id || '') !== String(page.id || ''))];
    const next = { ...defaultPagesState(), ...state, pages: nextPages, activePageId: page.id, updatedAt: nowIso() };
    localStorage.setItem(SITE_PAGES_KEY, JSON.stringify(next, null, 2));
    return next;
  }

  function openDraft(draftId) {
    const api = window.NSEditorV1;
    const instance = window.__nsEditorV1Instance;

    try {
      if (instance && Array.isArray(instance.surfaces)) {
        instance.surfaces.forEach((surface) => {
          if (surface && typeof surface.openDraft === 'function') {
            surface.openDraft(draftId, true, false, surface.surfaceType === 'cabinet' ? 'write' : 'draft');
          }
        });
        return true;
      }
    } catch (error) {
      console.warn('[IRGEZTNE] Direct surface open failed:', error);
    }

    try {
      if (api && typeof api.openDraftById === 'function') {
        api.openDraftById(draftId, null, 'write');
        return true;
      }
    } catch (error) {
      console.warn('[IRGEZTNE] API openDraftById failed:', error);
    }
    return false;
  }

  function createAndOpenSitePage() {
    const pagesState = readJson(SITE_PAGES_KEY, defaultPagesState());
    const pages = Array.isArray(pagesState.pages) ? pagesState.pages : [];
    const baseTitle = tr('New site page', 'Новая страница сайта');
    const existing = pages.filter((page) => String(page.title || '').startsWith(baseTitle)).length;
    const title = existing ? `${baseTitle} ${existing + 1}` : baseTitle;
    const slug = uniqueSlug(pages, title);
    const time = nowIso();
    const summary = tr(
      'Write this page in Editor. Slug, menu, and export are managed by the site structure.',
      'Напишите эту страницу в Editor. Slug, меню и экспорт управляются структурой сайта.'
    );

    const draft = createBaseDraft(title, slug, summary);
    const pageId = uid('page');
    draft.sitePageId = pageId;

    const page = {
      id: pageId,
      title,
      slug,
      status: 'draft',
      type: 'page',
      menu: true,
      summary,
      draftId: draft.id,
      createdAt: time,
      updatedAt: time
    };

    const editorState = saveEditorDraft(draft);
    const siteState = saveSitePage(page);

    window.dispatchEvent(new CustomEvent('irgeztne:site-pages-updated', { detail: { state: siteState, source: 'editor-direct-bridge', pageId, draftId: draft.id } }));
    window.dispatchEvent(new CustomEvent('ns-editor-store-updated', { detail: { source: 'editor-direct-bridge', draftId: draft.id, state: editorState } }));

    requestAnimationFrame(() => {
      openDraft(draft.id);
      const status = document.querySelector('[data-role="status-badge"]');
      if (status) status.textContent = `${tr('Editing site page:', 'Страница сайта:')} ${title}`;
    });

    return { page, draft };
  }

  document.addEventListener('click', (event) => {
    const target = event.target && event.target.closest
      ? event.target.closest('[data-action="new-site-page"], [data-editor-action="new-site-page"], [data-irz-action="new-site-page"]')
      : null;
    if (!target) return;

    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();

    try {
      createAndOpenSitePage();
    } catch (error) {
      console.error('[IRGEZTNE] Could not create site page:', error);
      alert(tr('Could not create site page. Please check the console.', 'Не удалось создать страницу сайта. Проверьте консоль.'));
    }
  }, true);

  window.IRGEZTNEEditorSitePageBridge = { createAndOpenSitePage };
})();
