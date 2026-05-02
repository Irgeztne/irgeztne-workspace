(function (root) {
  const TEMPLATE_LIBRARY_SRC = "src/ns-template-library.js";

  function loadTemplateLibrary(callback) {
    if (root.NSTemplateLibrary && typeof root.NSTemplateLibrary.listCatalogBuiltins === "function") {
      callback();
      return;
    }

    const existing = document.querySelector("script[data-ns-template-library-loader]");
    if (existing) {
      existing.addEventListener("load", callback, { once: true });
      existing.addEventListener("error", callback, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = TEMPLATE_LIBRARY_SRC;
    script.async = false;
    script.dataset.nsTemplateLibraryLoader = "true";
    script.addEventListener("load", callback, { once: true });
    script.addEventListener("error", callback, { once: true });
    (document.head || document.documentElement).appendChild(script);
  }

  function boot() {
  const STORAGE_KEY = 'ns.browser.v8.vitrina.v1';

  // v1 public Catalog guard:
  // folder-* templates are experimental file-backed templates from the old template folder layer.
  // They stay in the project for later work, but are hidden from the public Catalog v1 because
  // their preview/install state is not complete enough for the first release.
  const HIDDEN_V1_CATALOG_IDS = new Set([
    'catalog-template-folder-website-starter',
    'catalog-template-folder-blog-post',
    'catalog-template-folder-editorial-brief'
  ]);

  const HIDDEN_V1_TEMPLATE_IDS = new Set([
    'folder-website-starter',
    'folder-blog-post',
    'folder-editorial-brief'
  ]);


  function isProjectLandingCatalogItem(item) {
    const id = String(item && (item.id || item.itemId || item.catalogItemId || '') || '').toLowerCase();
    const templateId = String(item && item.templateId || '').toLowerCase();
    const title = String(item && (item.title || item.name || '') || '').toLowerCase();

    return id === 'template-project-landing'
      || id === 'catalog-template-project-landing'
      || id === 'project-landing'
      || templateId === 'project-landing'
      || title === 'project landing';
  }

  function isHiddenV1CatalogItem(item) {
    if (!item) return false;
    const id = String(item.id || item.itemId || '');
    const itemId = String(item.itemId || '');
    const templateId = String(item.templateId || (item.template && item.template.id) || '');
    return HIDDEN_V1_CATALOG_IDS.has(id)
      || HIDDEN_V1_CATALOG_IDS.has(itemId)
      || HIDDEN_V1_TEMPLATE_IDS.has(templateId);
  }

  function filterPublicV1CatalogItems(items) {
    return (Array.isArray(items) ? items : []).filter(function (item) {
      return !isHiddenV1CatalogItem(item) && isProjectLandingCatalogItem(item);
    });
  }

  function isRu() { return String(document && document.documentElement && document.documentElement.lang || '').toLowerCase() === 'ru'; }
  function tr(ru, en) { return isRu() ? ru : en; }

  function getTemplateLibrary() {
    return root.NSTemplateLibrary && typeof root.NSTemplateLibrary.listCatalogBuiltins === 'function' ? root.NSTemplateLibrary : null;
  }

  function getCatalogBuiltins() {
    const library = getTemplateLibrary();
    const items = library ? library.listCatalogBuiltins() : [];
    return filterPublicV1CatalogItems(Array.isArray(items) ? items : []);
  }

  const BUILTIN_ITEMS = getCatalogBuiltins();

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getRoots() {
    return Array.from(document.querySelectorAll('[data-vitrina-root]'));
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function isBuiltinItemId(itemId) {
    return BUILTIN_ITEMS.some(function (item) { return String(item.id) === String(itemId); });
  }

  function typeToCategory(type) {
    const map = {
      template: tr('Шаблоны', 'Templates'),
      theme: tr('Темы', 'Themes'),
      pack: tr('Паки', 'Packs'),
      plugin: tr('Плагины', 'Plugins'),
      widget: tr('Виджеты', 'Widgets'),
      'asset-pack': tr('Паки ассетов', 'Asset Packs'),
      starter: tr('Стартовые наборы', 'Starters')
    };
    return map[String(type || '').toLowerCase()] || tr('Пакеты', 'Packages');
  }

  function normalizeCatalogEntry(entry) {
    const source = entry || {};
    return {
      id: String(source.id || ''),
      type: String(source.type || 'pack'),
      category: String(source.category || typeToCategory(source.type)),
      name: String(source.name || source.title || 'Untitled package'),
      version: String(source.version || '0.1.0'),
      description: String(source.description || ''),
      trust: String(source.trust || 'local'),
      installed: Boolean(source.installed),
      enabled: source.enabled !== false,
      updatedAt: String(source.updatedAt || new Date().toISOString()),
      template: source.template ? clone(source.template) : null,
      preview: source.preview ? clone(source.preview) : { cover: '', gallery: [], note: '', surface: 'editor' },
      author: source.author ? clone(source.author) : null,
      compatibility: source.compatibility ? clone(source.compatibility) : null,
      tags: Array.isArray(source.tags) ? source.tags.slice(0, 6) : [],
      status: String(source.status || ''),
      source: String(source.source || (isBuiltinItemId(source.id) ? 'built-in' : 'codehub'))
    };
  }

  function makeCatalogEntryFromCodeHubItem(item) {
    const preview = item && item.preview ? item.preview : {};
    const description = item && item.description
      ? (item.description.short || item.description.full || '')
      : '';
    return normalizeCatalogEntry({
      id: item && item.id,
      type: item && item.type,
      category: typeToCategory(item && item.type),
      name: item && item.title,
      version: item && item.version,
      description: description,
      trust: 'local',
      installed: false,
      enabled: true,
      updatedAt: item && item.updatedAt,
      preview: {
        cover: preview && preview.cover || '',
        gallery: Array.isArray(preview && preview.gallery) ? preview.gallery : [],
        note: preview && preview.note || '',
        surface: preview && preview.surface || 'editor'
      },
      author: item && item.author ? item.author : null,
      compatibility: item && item.compatibility ? item.compatibility : null,
      tags: Array.isArray(item && item.tags) ? item.tags : [],
      status: item && item.status || 'submitted',
      source: 'codehub'
    });
  }

  function getCodeHubStore() {
    return root.NSCodeHubStore && typeof root.NSCodeHubStore.getSubmittedItems === 'function' ? root.NSCodeHubStore : null;
  }

  function mergeSubmittedItemsIntoRegistry(registry) {
    const store = getCodeHubStore();
    if (!store) return registry;
    const submitted = store.getSubmittedItems();
    if (!submitted || !submitted.length) return registry;

    const next = clone(registry || defaultRegistry());
    const byId = new Map((next.items || []).map(function (item) { return [String(item.id), item]; }));

    submitted.forEach(function (item) {
      if (isHiddenV1CatalogItem(item)) return;
      const incoming = makeCatalogEntryFromCodeHubItem(item);
      if (isHiddenV1CatalogItem(incoming)) return;
      const existing = byId.get(String(incoming.id));
      if (existing) {
        byId.set(String(incoming.id), Object.assign({}, existing, incoming, { installed: Boolean(existing.installed) }));
      } else {
        byId.set(String(incoming.id), incoming);
      }
    });

    next.items = Array.from(byId.values());
    return next;
  }


  function defaultRegistry() {
    return {
      version: 1,
      items: BUILTIN_ITEMS.map(function (item) {
        return normalizeCatalogEntry({
          id: item.id,
          type: item.type,
          category: item.category,
          name: item.name,
          version: item.version,
          description: item.description,
          trust: item.trust || 'built-in',
          installed: Boolean(item.installed),
          enabled: true,
          updatedAt: new Date().toISOString(),
          source: 'built-in'
        });
      })
    };
  }

  function mergeRegistry(saved) {
    const fallback = defaultRegistry();
    const savedItems = filterPublicV1CatalogItems(Array.isArray(saved && saved.items) ? saved.items : []);
    const savedMap = new Map(savedItems.map(function (item) { return [String(item.id), item || {}]; }));
    const merged = {
      version: 1,
      items: fallback.items.map(function (item) {
        const existing = savedMap.get(String(item.id)) || {};
        return normalizeCatalogEntry(Object.assign({}, item, existing, {
          installed: typeof existing.installed === 'boolean' ? existing.installed : item.installed,
          enabled: typeof existing.enabled === 'boolean' ? existing.enabled : true,
          trust: existing.trust ? String(existing.trust) : item.trust,
          updatedAt: existing.updatedAt || item.updatedAt,
          source: 'built-in'
        }));
      })
    };

    savedItems.forEach(function (item) {
      if (!item || isHiddenV1CatalogItem(item) || isBuiltinItemId(item.id)) return;
      merged.items.push(normalizeCatalogEntry(item));
    });

    return mergeSubmittedItemsIntoRegistry(merged);
  }

  function safeStorageGet() {
    try {
      const raw = root.localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : defaultRegistry();
    } catch (error) {
      console.warn('[NSVitrinaV1] local fallback read failed:', error);
      return defaultRegistry();
    }
  }

  function safeStorageSet(value) {
    try {
      root.localStorage.setItem(STORAGE_KEY, JSON.stringify(value || defaultRegistry()));
    } catch (error) {
      console.warn('[NSVitrinaV1] local fallback write failed:', error);
    }
  }

  async function loadRegistry() {
    try {
      if (root.nsAPI && typeof root.nsAPI.loadVitrinaRegistry === 'function') {
        const saved = await root.nsAPI.loadVitrinaRegistry();
        return mergeRegistry(saved);
      }
    } catch (error) {
      console.warn('[NSVitrinaV1] registry load failed:', error);
    }
    return mergeRegistry(safeStorageGet());
  }

  async function saveRegistry(registry) {
    const next = mergeRegistry(registry);
    safeStorageSet(next);
    try {
      if (root.nsAPI && typeof root.nsAPI.saveVitrinaRegistry === 'function') {
        await root.nsAPI.saveVitrinaRegistry(next);
      }
    } catch (error) {
      console.warn('[NSVitrinaV1] registry save failed:', error);
    }
    return next;
  }

  function getMeta(itemId, registry) {
    const meta = BUILTIN_ITEMS.find(function (item) { return item.id === itemId; }) || null;
    const state = (registry && Array.isArray(registry.items) ? registry.items : []).find(function (item) {
      return String(item.id) === String(itemId);
    }) || null;
    return { meta: meta || state || null, state: state };
  }

  function getInstalledTemplates(registry) {
    const reg = registry || runtime.registry || defaultRegistry();
    const library = getTemplateLibrary();
    return (reg.items || []).filter(function (entry) {
      return entry.type === 'template' && entry.installed && entry.enabled !== false && !isHiddenV1CatalogItem(entry);
    }).map(function (entry) {
      if (entry.template) {
        const next = clone(entry.template);
        next.catalogItemId = entry.id;
        return next;
      }
      if (library && typeof library.getTemplateByCatalogItemId === 'function') {
        const found = library.getTemplateByCatalogItemId(entry.id);
        if (found) {
          found.catalogItemId = entry.id;
          return found;
        }
      }
      return null;
    }).filter(Boolean);
  }

  function surfaceLabel(surface) {
    return surface === 'cabinet' ? 'Cabinet surface' : 'Workspace surface';
  }

  function getPublicRegistryItems(registry) {
    return filterPublicV1CatalogItems(registry && Array.isArray(registry.items) ? registry.items : []);
  }

  function isReadyV1TemplateItem(item) {
    if (!item || String(item.type || '').toLowerCase() !== 'template') return false;
    if (item.template && item.template.id) return true;
    const library = getTemplateLibrary();
    return Boolean(library && typeof library.getTemplateByCatalogItemId === 'function' && library.getTemplateByCatalogItemId(item.id));
  }

  function isRoadmapV1Item(item) {
    return Boolean(item) && !isReadyV1TemplateItem(item);
  }

  function countByType(registry, type) {
    return getPublicRegistryItems(registry).filter(function (item) { return item.type === type; }).length;
  }

  function countReadyV1Templates(registry) {
    return getPublicRegistryItems(registry).filter(isReadyV1TemplateItem).length;
  }

  function countInstalled(registry) {
    return getPublicRegistryItems(registry).filter(function (item) {
      return isReadyV1TemplateItem(item) && item.installed;
    }).length;
  }

  function getEditorApi() {
    return (root.NSEditorV1 && typeof root.NSEditorV1.getActiveDraft === 'function' ? root.NSEditorV1 : null)
      || (root.__nsEditorV1Instance && typeof root.__nsEditorV1Instance.getActiveDraft === 'function' ? root.__nsEditorV1Instance : null)
      || null;
  }

  function getActiveDraft() {
    const editorApi = getEditorApi();
    if (!editorApi || typeof editorApi.getActiveDraft !== 'function') return null;
    try {
      return editorApi.getActiveDraft() || null;
    } catch (error) {
      console.warn('[NSVitrinaV1] active draft lookup failed:', error);
      return null;
    }
  }

  function getCurrentDraftTemplateId() {
    const draft = getActiveDraft();
    return draft && draft.templateId ? String(draft.templateId) : '';
  }

  function getCurrentDraftId() {
    const draft = getActiveDraft();
    return draft && draft.id ? String(draft.id) : '';
  }

  function isCurrentTemplateItem(item) {
    if (!item || item.type !== 'template' || !item.template || !item.template.id) return false;
    const activeTemplateId = getCurrentDraftTemplateId();
    if (String(item.template.id) === activeTemplateId) return true;
    return Boolean(runtime && runtime.lastOpenedTemplateItemId && String(runtime.lastOpenedTemplateItemId) === String(item.id));
  }


  function typeToLabel(type) {
    const map = {
      template: 'Template',
      theme: 'Theme',
      pack: 'Pack',
      plugin: 'Plugin',
      widget: 'Widget',
      'asset-pack': 'Asset Pack',
      starter: 'Starter'
    };
    return map[String(type || '').toLowerCase()] || 'Package';
  }

  function sourceToLabel(source) {
    const value = String(source || '').toLowerCase();
    if (value === 'built-in') return 'Built-in';
    if (value === 'codehub') return 'CodeHub';
    return 'Local';
  }

  function getTemplateDefaults(item) {
    const template = item && item.template ? item.template : {};
    const defaults = template && template.defaults && typeof template.defaults === 'object'
      ? template.defaults
      : {};
    return defaults;
  }

  function inferTone(item) {
    const preview = item && item.preview ? item.preview : {};
    const haystack = [
      item && item.name ? item.name : '',
      item && item.description ? item.description : '',
      preview && preview.note ? preview.note : ''
    ].join(' ').toLowerCase();

    if (/dark/.test(haystack)) return 'Dark';
    if (/light/.test(haystack)) return 'Light';
    return '';
  }

  function getVisualFamily(item) {
    const type = String(item && item.type || '').toLowerCase();
    const category = String(
      item && item.template && item.template.category
        ? item.template.category
        : item && item.category
          ? item.category
          : ''
    ).toLowerCase();
    const id = String(item && item.id || '').toLowerCase();
    const tone = inferTone(item).toLowerCase();
    const haystack = [type, category, id].join(' ');

    if (type === 'theme') {
      if (tone === 'light') return 'theme-light';
      if (tone === 'dark') return 'theme-dark';
      return 'theme';
    }

    if (type === 'pack') return 'pack';
    if (type === 'plugin') return 'plugin';
    if (type === 'template') {
      if (/analysis/.test(haystack)) return 'analysis';
      if (/blog/.test(haystack)) return 'blog';
      if (/editorial|article|brief/.test(haystack)) return 'editorial';
      if (/press|landing|website/.test(haystack)) return 'website';
      return 'template';
    }

    return 'custom';
  }

  function getVisualToneClass(item, prefix) {
    return prefix + getVisualFamily(item);
  }

  function getPreviewCoverage(item) {
    const preview = item && item.preview ? item.preview : {};
    const gallery = Array.isArray(preview.gallery) ? preview.gallery.filter(Boolean) : [];

    if (preview.cover && gallery.length) {
      return 'Cover + ' + gallery.length + ' preview' + (gallery.length === 1 ? '' : 's');
    }
    if (preview.cover) return 'Cover ready';
    if (gallery.length) return gallery.length + ' preview' + (gallery.length === 1 ? '' : 's');
    return 'Preview pending';
  }

  function getSurfaceText(item) {
    const compatibility = item && item.compatibility ? item.compatibility : {};
    const surfaces = Array.isArray(compatibility.surface)
      ? compatibility.surface.filter(Boolean)
      : [];
    const preview = item && item.preview ? item.preview : {};

    if (surfaces.length) return surfaces.join(' · ');
    if (preview.surface) return String(preview.surface);
    return 'editor';
  }

  function getTargetText(item) {
    const compatibility = item && item.compatibility ? item.compatibility : {};
    const targets = Array.isArray(compatibility.moduleTarget)
      ? compatibility.moduleTarget.filter(Boolean)
      : [];
    if (!targets.length) return 'catalog';
    return targets.join(' · ');
  }

  function getValuePromise(item) {
    const type = String(item && item.type || '').toLowerCase();
    const tone = inferTone(item);

    if (type === 'template') return tr('Готовый шаблон редактора', 'Ready editor template');
    if (type === 'theme') return tr('Запланировано для v1.1', 'Planned for v1.1');
    if (type === 'pack') return tr('Запланировано для v1.1', 'Planned for v1.1');
    if (type === 'plugin') return tr('Запланировано для v1.1', 'Planned for v1.1');
    if (type === 'widget') return tr('Запланировано для v1.1', 'Planned for v1.1');
    if (type === 'asset-pack') return tr('Запланировано для v1.1', 'Planned for v1.1');
    if (type === 'starter') return tr('Запланировано для v1.1', 'Planned for v1.1');
    return 'Catalog package';
  }

  function renderTagRow(tags) {
    if (!Array.isArray(tags) || !tags.length) return '';
    return '<div class="ns-vitrina-v1__tag-row">' + tags.slice(0, 4).map(function (tag) {
      return '<span class="ns-vitrina-v1__tag">' + escapeHtml(tag) + '</span>';
    }).join('') + '</div>';
  }

  function renderFact(label, value) {
    if (!value) return '';
    return [
      '<div class="ns-vitrina-v1__fact">',
      '  <span>' + escapeHtml(label) + '</span>',
      '  <strong>' + escapeHtml(value) + '</strong>',
      '</div>'
    ].join('');
  }

  function renderCardFacts(item) {
    return '';
  }

  function renderSupportRow(item) {
    const parts = [
      sourceToLabel(item && item.source),
      item && item.author && item.author.name ? item.author.name : '',
      getSurfaceText(item)
    ].filter(Boolean).slice(0, 3);

    if (!parts.length) return '';
    return '<div class="ns-vitrina-v1__support-row">' + parts.map(function (part) {
      return '<span class="ns-vitrina-v1__support-pill">' + escapeHtml(part) + '</span>';
    }).join('') + '</div>';
  }

  function renderSceneStat(label, value) {
    if (!value) return '';
    return [
      '<div class="ns-vitrina-v1__scene-stat">',
      '  <span>' + escapeHtml(label) + '</span>',
      '  <strong>' + escapeHtml(value) + '</strong>',
      '</div>'
    ].join('');
  }



  function renderCustomPreview(item) {
    const preview = item && item.preview ? item.preview : {};
    const note = preview.note || item.description || 'Custom package prepared in CodeHub and linked to Catalog.';
    const tone = inferTone(item);
    const chips = [
      typeToLabel(item && item.type),
      tone ? tone : '',
      sourceToLabel(item && item.source)
    ].filter(Boolean).slice(0, 3);

    return [
      '<div class="ns-vitrina-v1__scene ns-vitrina-v1__scene--custom">',
      '  <div class="ns-vitrina-v1__scene-window">',
      '    <div class="ns-vitrina-v1__scene-window-bar"><span></span><span></span><span></span></div>',
      '    <div class="ns-vitrina-v1__scene-window-body">',
      '      <div class="ns-vitrina-v1__scene-kicker">' + escapeHtml(typeToCategory(item && item.type)) + '</div>',
      '      <div class="ns-vitrina-v1__scene-headline">' + escapeHtml(item && item.name ? item.name : 'Package preview') + '</div>',
      '      <div class="ns-vitrina-v1__scene-deck">' + escapeHtml(note) + '</div>',
      chips.length ? '      <div class="ns-vitrina-v1__scene-pill-row">' + chips.map(function (chip) { return '<span>' + escapeHtml(chip) + '</span>'; }).join('') + '</div>' : '',
      '      <div class="ns-vitrina-v1__scene-stat-row">',
      renderSceneStat('Preview', getPreviewCoverage(item)),
      renderSceneStat('Surface', getSurfaceText(item)),
      '      </div>',
      '    </div>',
      '  </div>',
      '</div>'
    ].join('');
  }


  function cardPreview(item) {
    const id = String(item && item.id || '');

    if (id === 'template-website-starter') {
      return [
        '<div class="ns-vitrina-v1__scene ns-vitrina-v1__scene--landing">',
        '  <div class="ns-vitrina-v1__scene-hero">',
        '    <div class="ns-vitrina-v1__scene-kicker">Website Starter</div>',
        '    <div class="ns-vitrina-v1__scene-headline">Launch your website faster</div>',
        '  </div>',
        '  <div class="ns-vitrina-v1__scene-grid">',
        '    <div class="ns-vitrina-v1__scene-tile"><span>About</span><div class="ns-vitrina-v1__scene-line short"></div></div>',
        '    <div class="ns-vitrina-v1__scene-tile"><span>Services</span><div class="ns-vitrina-v1__scene-line short"></div></div>',
        '  </div>',
        '</div>'
      ].join('');
    }

    if (id === 'template-blog-post') {
      return [
        '<div class="ns-vitrina-v1__scene ns-vitrina-v1__scene--article">',
        '  <div class="ns-vitrina-v1__scene-kicker">Blog Post</div>',
        '  <div class="ns-vitrina-v1__scene-headline">Your headline goes here</div>',
        '  <div class="ns-vitrina-v1__scene-deck">Lead, main point, and takeaway in a readable article flow.</div>',
        '  <div class="ns-vitrina-v1__scene-section">Main point</div>',
        '  <div class="ns-vitrina-v1__scene-line long"></div>',
        '  <div class="ns-vitrina-v1__scene-section">Takeaway</div>',
        '  <div class="ns-vitrina-v1__scene-line mid"></div>',
        '</div>'
      ].join('');
    }

    if (id === 'vitrina-template-editorial-brief') {
      return [
        '<div class="ns-vitrina-v1__scene ns-vitrina-v1__scene--article">',
        '  <div class="ns-vitrina-v1__scene-kicker">Editorial Brief</div>',
        '  <div class="ns-vitrina-v1__scene-headline">Main story headline</div>',
        '  <div class="ns-vitrina-v1__scene-deck">Strong lead, confirmed facts, and clean follow-up structure.</div>',
        '  <div class="ns-vitrina-v1__scene-section">What happened</div>',
        '  <div class="ns-vitrina-v1__scene-line long"></div>',
        '  <div class="ns-vitrina-v1__scene-section">Why it matters</div>',
        '  <div class="ns-vitrina-v1__scene-line mid"></div>',
        '</div>'
      ].join('');
    }

    if (id === 'vitrina-template-news-analysis') {
      return [
        '<div class="ns-vitrina-v1__scene ns-vitrina-v1__scene--analysis">',
        '  <div class="ns-vitrina-v1__scene-kicker">News Analysis</div>',
        '  <div class="ns-vitrina-v1__scene-headline">Context headline</div>',
        '  <div class="ns-vitrina-v1__scene-grid">',
        '    <div class="ns-vitrina-v1__scene-panel"><span>Background</span><div class="ns-vitrina-v1__scene-line long"></div><div class="ns-vitrina-v1__scene-line short"></div></div>',
        '    <div class="ns-vitrina-v1__scene-panel"><span>Signals</span><div class="ns-vitrina-v1__scene-line mid"></div><div class="ns-vitrina-v1__scene-line short"></div></div>',
        '  </div>',
        '  <div class="ns-vitrina-v1__scene-footer">Calm conclusion and next watchpoint</div>',
        '</div>'
      ].join('');
    }

    if (id === 'vitrina-template-landing-press') {
      return [
        '<div class="ns-vitrina-v1__scene ns-vitrina-v1__scene--landing">',
        '  <div class="ns-vitrina-v1__scene-hero">',
        '    <div class="ns-vitrina-v1__scene-kicker">Press Landing</div>',
        '    <div class="ns-vitrina-v1__scene-headline">Project or newsroom title</div>',
        '  </div>',
        '  <div class="ns-vitrina-v1__scene-grid">',
        '    <div class="ns-vitrina-v1__scene-tile"><span>Coverage</span><div class="ns-vitrina-v1__scene-line short"></div></div>',
        '    <div class="ns-vitrina-v1__scene-tile"><span>Contact</span><div class="ns-vitrina-v1__scene-line short"></div></div>',
        '  </div>',
        '</div>'
      ].join('');
    }

    if (id === 'vitrina-theme-light-editorial') {
      return [
        '<div class="ns-vitrina-v1__scene ns-vitrina-v1__scene--theme-light">',
        '  <div class="ns-vitrina-v1__scene-swatches">',
        '    <span></span><span></span><span></span><span></span>',
        '  </div>',
        '  <div class="ns-vitrina-v1__scene-theme-card">',
        '    <div class="ns-vitrina-v1__scene-kicker">Light Editorial</div>',
        '    <div class="ns-vitrina-v1__scene-headline">Readable article page</div>',
        '    <div class="ns-vitrina-v1__scene-line long"></div>',
        '    <div class="ns-vitrina-v1__scene-line mid"></div>',
        '  </div>',
        '</div>'
      ].join('');
    }

    if (id === 'vitrina-theme-dark-desk') {
      return [
        '<div class="ns-vitrina-v1__scene ns-vitrina-v1__scene--theme-dark">',
        '  <div class="ns-vitrina-v1__scene-swatches">',
        '    <span></span><span></span><span></span><span></span>',
        '  </div>',
        '  <div class="ns-vitrina-v1__scene-theme-card">',
        '    <div class="ns-vitrina-v1__scene-kicker">Dark Desk</div>',
        '    <div class="ns-vitrina-v1__scene-headline">Late-session editorial view</div>',
        '    <div class="ns-vitrina-v1__scene-line long"></div>',
        '    <div class="ns-vitrina-v1__scene-line mid"></div>',
        '  </div>',
        '</div>'
      ].join('');
    }

    if (id === 'vitrina-pack-seo-helper') {
      return [
        '<div class="ns-vitrina-v1__scene ns-vitrina-v1__scene--pack">',
        '  <div class="ns-vitrina-v1__scene-chip-row"><span>Title</span><span>Description</span><span>Keywords</span></div>',
        '  <div class="ns-vitrina-v1__scene-pack-card">',
        '    <div class="ns-vitrina-v1__scene-kicker">SEO Helper Pack</div>',
        '    <div class="ns-vitrina-v1__scene-line long"></div>',
        '    <div class="ns-vitrina-v1__scene-line short"></div>',
        '  </div>',
        '</div>'
      ].join('');
    }

    if (id === 'vitrina-plugin-quote-callout') {
      return [
        '<div class="ns-vitrina-v1__scene ns-vitrina-v1__scene--plugin">',
        '  <div class="ns-vitrina-v1__scene-kicker">Quote Callout</div>',
        '  <blockquote class="ns-vitrina-v1__scene-quote">Pull one important line out of the article and give it visual weight.</blockquote>',
        '  <div class="ns-vitrina-v1__scene-line short"></div>',
        '</div>'
      ].join('');
    }

    return renderCustomPreview(item);
  }

  function renderActions(item, state) {
    if (!isReadyV1TemplateItem(item)) {
      return '<button type="button" class="ns-vitrina-v1__btn ns-vitrina-v1__btn--muted" disabled>' + escapeHtml(tr('Запланировано v1.1', 'Planned v1.1')) + '</button>';
    }

    const isCurrent = isCurrentTemplateItem(item);
    const actions = [
      '<button type="button" class="ns-vitrina-v1__btn" data-vitrina-action="preview" data-vitrina-id="' + escapeHtml(item.id) + '">' + escapeHtml(tr('Превью', 'Preview')) + '</button>',
      '<button type="button" class="ns-vitrina-v1__btn ns-vitrina-v1__btn--primary' + (isCurrent ? ' is-active' : '') + '" data-vitrina-action="' + (isCurrent ? 'open-editor' : 'use-template') + '" data-vitrina-id="' + escapeHtml(item.id) + '">' + escapeHtml(isCurrent ? tr('Открыть в редакторе', 'Open in Editor') : tr('Добавить и открыть', 'Add and Open')) + '</button>',
      '<button type="button" class="ns-vitrina-v1__btn" data-vitrina-action="open-template-preview" data-vitrina-id="' + escapeHtml(item.id) + '">' + escapeHtml(tr('Открыть превью', 'Open Preview')) + '</button>'
    ];

    return actions.join('');
  }


  function renderRoot(surface, registry, filter, notice) {
    const items = getPublicRegistryItems(registry).filter(function (item) {
      if (!filter || filter === 'all') return true;
      return item.type === filter;
    }).sort(function (a, b) {
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

    const utilityCount =
      countByType(registry, 'pack') +
      countByType(registry, 'plugin') +
      countByType(registry, 'widget') +
      countByType(registry, 'asset-pack') +
      countByType(registry, 'starter');

    const grid = items.length
      ? items.map(function (item) {
          const found = (registry.items || []).find(function (entry) { return entry.id === item.id; }) || item || {};
          const installed = Boolean(found.installed);
          const tone = inferTone(item);
          const isCurrentTemplate = isCurrentTemplateItem(item);
          const stateLabel = isReadyV1TemplateItem(item)
            ? (isCurrentTemplate ? tr('Текущий шаблон', 'Current Template') : tr('Готово в редакторе', 'Ready in Editor'))
            : tr('Запланировано v1.1', 'Planned v1.1');
          return [
            '<article class="ns-vitrina-v1__card ' + getVisualToneClass(item, 'ns-vitrina-v1__card--') + '">',
            '  <div class="ns-vitrina-v1__preview ' + getVisualToneClass(item, 'ns-vitrina-v1__preview--') + '">' + cardPreview(item) + '</div>',
            '  <div class="ns-vitrina-v1__body">',
            '    <div class="ns-vitrina-v1__meta">',
            '      <span class="ns-vitrina-v1__chip">' + escapeHtml(typeToLabel(item.type)) + '</span>',
            tone ? '      <span class="ns-vitrina-v1__chip ns-vitrina-v1__chip--tone">' + escapeHtml(tone) + '</span>' : '',
            '      <span class="ns-vitrina-v1__chip ns-vitrina-v1__chip--source">' + escapeHtml(sourceToLabel(item.source)) + '</span>',
            '      <span class="ns-vitrina-v1__chip">' + escapeHtml(item.version) + '</span>',
            isReadyV1TemplateItem(item)
              ? '      <span class="ns-vitrina-v1__chip' + (isCurrentTemplate ? ' is-installed' : '') + '">' + escapeHtml(stateLabel) + '</span>'
              : '      <span class="ns-vitrina-v1__chip ns-vitrina-v1__chip--tone">' + escapeHtml(stateLabel) + '</span>',
            '    </div>',
            '    <div class="ns-vitrina-v1__copy">',
            '      <h5>' + escapeHtml(item.name) + '</h5>',
            '      <p>' + escapeHtml(item.description || 'Catalog package ready for local install and preview.') + '</p>',
            '    </div>',
            renderCardFacts(item),
            renderSupportRow(item),
            renderTagRow(item.tags),
            '    <div class="ns-vitrina-v1__actions">' + renderActions(item, found) + '</div>',
            '  </div>',
            '</article>'
          ].join('');
        }).join('')
      : '<div class="ns-vitrina-v1__empty">Nothing active in this category yet.</div>';

    return [
      '<div class="ns-vitrina-v1" data-vitrina-surface="' + escapeHtml(surface) + '">',
      '  <div class="ns-vitrina-v1__stage-row">',
      '    <span class="ns-vitrina-v1__stage">Catalog v1</span>',
      '    <span class="ns-vitrina-v1__surface">' + escapeHtml(surfaceLabel(surface)) + '</span>',
      '  </div>',
      '  <div class="ns-vitrina-v1__head">',
      '    <div>',
      '      <h4>Catalog v1: stable templates and planned items</h4>',
      '      <p>Only ready Editor templates are active in v1. Themes, packs, and plugins stay visible as roadmap items without fake Preview/Install actions.</p>',
      '    </div>',
      '  </div>',
      '  <div class="ns-vitrina-v1__summary">',
      '    <div class="ns-vitrina-v1__summary-card"><span>' + escapeHtml(tr('Активные v1', 'Active v1')) + '</span><strong>' + countReadyV1Templates(registry) + '</strong></div>',
      '    <div class="ns-vitrina-v1__summary-card"><span>' + escapeHtml(tr('Шаблоны', 'Templates')) + '</span><strong>' + countByType(registry, 'template') + '</strong></div>',
      '    <div class="ns-vitrina-v1__summary-card"><span>' + escapeHtml(tr('Темы позже', 'Themes later')) + '</span><strong>' + countByType(registry, 'theme') + '</strong></div>',
      '    <div class="ns-vitrina-v1__summary-card"><span>' + escapeHtml(tr('Паки/модули позже', 'Packs/modules later')) + '</span><strong>' + utilityCount + '</strong></div>',
      '  </div>',
      '  <div class="ns-vitrina-v1__filters">',
      '    <button type="button" class="ns-vitrina-v1__filter' + (filter === 'all' ? ' is-active' : '') + '" data-vitrina-filter="all">All</button>',
      '    <button type="button" class="ns-vitrina-v1__filter' + (filter === 'template' ? ' is-active' : '') + '" data-vitrina-filter="template">Templates</button>',
      '    <button type="button" class="ns-vitrina-v1__filter' + (filter === 'theme' ? ' is-active' : '') + '" data-vitrina-filter="theme">Themes</button>',
      '    <button type="button" class="ns-vitrina-v1__filter' + (filter === 'pack' ? ' is-active' : '') + '" data-vitrina-filter="pack">Packs</button>',
      '    <button type="button" class="ns-vitrina-v1__filter' + (filter === 'plugin' ? ' is-active' : '') + '" data-vitrina-filter="plugin">Plugins</button>',
      '  </div>',
      notice ? '  <div class="ns-vitrina-v1__notice">' + escapeHtml(notice) + '</div>' : '',
      '  <div class="ns-vitrina-v1__grid">' + grid + '</div>',
      renderPreviewModal(runtime.previewItemId, registry),
      '</div>'
    ].join('');
  }


  const runtime = {
    registry: defaultRegistry(),
    filters: Object.create(null),
    notice: '',
    previewItemId: '',
    lastOpenedTemplateItemId: ''
  };

  function emitTemplatesChanged() {
    root.dispatchEvent(new CustomEvent('ns-vitrina:templates-changed', {
      detail: {
        templates: getInstalledTemplates(runtime.registry)
      }
    }));

    const library = getTemplateLibrary();
    if (library && typeof library.upsertInstalledTemplates === 'function') {
      library.upsertInstalledTemplates(getInstalledTemplates(runtime.registry));
    }
  }


  function getItemById(itemId, registry) {
    const fromBuiltin = BUILTIN_ITEMS.find(function (item) { return item.id === itemId; }) || null;
    if (fromBuiltin && !isHiddenV1CatalogItem(fromBuiltin)) return fromBuiltin;
    if (registry && Array.isArray(registry.items)) {
      return getPublicRegistryItems(registry).find(function (item) { return String(item.id) === String(itemId); }) || null;
    }
    return null;
  }


  function renderPreviewModal(itemId, registry) {
    if (!itemId) return '';
    const item = getItemById(itemId, registry);
    if (!item) return '';

    const state = (registry.items || []).find(function (entry) { return entry.id === itemId; }) || {};
    const installed = Boolean(state.installed);
    const defaults = getTemplateDefaults(item);
    const preview = item && item.preview ? item.preview : {};
    const isCurrentTemplate = isCurrentTemplateItem(item);
    const actionInstall = '';
    const actionOpen = isReadyV1TemplateItem(item)
      ? '<button type="button" class="ns-vitrina-v1__btn ns-vitrina-v1__btn--primary' + (isCurrentTemplate ? ' is-active' : '') + '" data-vitrina-action="' + (isCurrentTemplate ? 'open-editor' : 'use-template') + '" data-vitrina-id="' + escapeHtml(item.id) + '">' + escapeHtml(isCurrentTemplate ? tr('Открыть в редакторе', 'Open in Editor') : tr('Добавить и открыть', 'Add and Open')) + '</button>'
      : '<button type="button" class="ns-vitrina-v1__btn ns-vitrina-v1__btn--muted" disabled>' + escapeHtml(tr('Запланировано v1.1', 'Planned v1.1')) + '</button>';
    const actionOpenPreview = isReadyV1TemplateItem(item)
      ? '<button type="button" class="ns-vitrina-v1__btn" data-vitrina-action="open-template-preview" data-vitrina-id="' + escapeHtml(item.id) + '">' + escapeHtml(tr('Открыть превью', 'Open Preview')) + '</button>'
      : '';

    const detailCards = [
      renderFact(tr('Тип', 'Type'), typeToLabel(item.type)),
      renderFact(tr('Источник', 'Source'), sourceToLabel(item.source)),
      renderFact(tr('Превью', 'Preview'), getPreviewCoverage(item)),
      renderFact(tr('Поверхность', 'Surface'), getSurfaceText(item)),
      renderFact(tr('Цель', 'Target'), getTargetText(item)),
      renderFact(tr('Автор', 'Author'), item.author && item.author.name ? item.author.name : '')
    ].filter(Boolean).join('');

    const templateCopy = item.type === 'template' && item.template
      ? [
          '<div class="ns-vitrina-v1__modal-copy">',
          '  <div><strong>Category:</strong> ' + escapeHtml(item.template.category || item.category || 'template') + '</div>',
          defaults.kicker ? '  <div><strong>Kicker:</strong> ' + escapeHtml(defaults.kicker) + '</div>' : '',
          (defaults.summary || item.description) ? '  <div><strong>Summary:</strong> ' + escapeHtml(defaults.summary || item.description || '') + '</div>' : '',
          Array.isArray(defaults.keywords) && defaults.keywords.length ? '  <div><strong>Keywords:</strong> ' + escapeHtml(defaults.keywords.slice(0, 5).join(' · ')) + '</div>' : '',
          '</div>'
        ].join('')
      : [
          '<div class="ns-vitrina-v1__modal-copy">',
          item.description ? '  <div><strong>Description:</strong> ' + escapeHtml(item.description || '') + '</div>' : '',
          preview.note ? '  <div><strong>Preview note:</strong> ' + escapeHtml(preview.note) + '</div>' : '',
          preview.cover ? '  <div><strong>Cover:</strong> ' + escapeHtml(preview.cover) + '</div>' : '',
          preview.gallery && preview.gallery.length ? '  <div><strong>Gallery:</strong> ' + escapeHtml(preview.gallery.slice(0, 4).join(' · ')) + '</div>' : '',
          '</div>'
        ].join('');

    return [
      '<div class="ns-vitrina-v1__modal-backdrop" data-vitrina-close-preview="true"></div>',
      '<section class="ns-vitrina-v1__modal ' + getVisualToneClass(item, 'ns-vitrina-v1__modal--') + '" aria-label="Catalog preview">',
      '  <div class="ns-vitrina-v1__modal-head">',
      '    <div>',
      '      <div class="ns-vitrina-v1__modal-kicker">' + escapeHtml(typeToLabel(item.type)) + ' · ' + escapeHtml(sourceToLabel(item.source)) + '</div>',
      '      <h5>' + escapeHtml(item.name) + '</h5>',
      '      <p>' + escapeHtml(item.description || '') + '</p>',
      '    </div>',
      '    <button type="button" class="ns-vitrina-v1__modal-close" data-vitrina-close-preview="true" aria-label="Close preview">✕</button>',
      '  </div>',
      '  <div class="ns-vitrina-v1__modal-preview ' + getVisualToneClass(item, 'ns-vitrina-v1__modal-preview--') + '">' + cardPreview(item) + '</div>',
      '  <div class="ns-vitrina-v1__modal-grid">' + detailCards + '</div>',
      templateCopy,
      renderTagRow(item.tags),
      '  <div class="ns-vitrina-v1__modal-actions">',
           actionInstall,
           actionOpen,
           actionOpenPreview,
      '  </div>',
      '</section>'
    ].join('');
  }


  function rerenderAll() {
    getRoots().forEach(function (host) {
      const surface = String(host.dataset.vitrinaSurface || 'workspace');
      const filter = runtime.filters[surface] || 'all';
      host.innerHTML = renderRoot(surface, runtime.registry, filter, runtime.notice);

      host.querySelectorAll('[data-vitrina-filter]').forEach(function (button) {
        button.addEventListener('click', function () {
          runtime.filters[surface] = String(button.getAttribute('data-vitrina-filter') || 'all');
          rerenderAll();
        });
      });

      host.querySelectorAll('[data-vitrina-action]').forEach(function (button) {
        button.addEventListener('click', function () {
          const action = String(button.getAttribute('data-vitrina-action') || '');
          const itemId = String(button.getAttribute('data-vitrina-id') || '');
          handleAction(action, itemId, surface);
        });
      });

      host.querySelectorAll('[data-vitrina-close-preview]').forEach(function (node) {
        node.addEventListener('click', function () {
          runtime.previewItemId = '';
          rerenderAll();
        });
      });
    });

    runtime.notice = '';
  }

  async function installItem(itemId) {
    const registry = clone(runtime.registry);
    const item = (registry.items || []).find(function (entry) { return entry.id === itemId; });
    if (!item) return;
    if (!isReadyV1TemplateItem(item)) {
      runtime.notice = tr('Этот элемент запланирован для v1.1 и пока не устанавливается.', 'This item is planned for v1.1 and is not installable yet.');
      rerenderAll();
      return;
    }
    item.installed = true;
    item.updatedAt = new Date().toISOString();
    runtime.registry = await saveRegistry(registry);
    emitTemplatesChanged();
    runtime.notice = 'Installed locally. The item is now available for Editor flow and the Editor template list.';
    rerenderAll();
  }

  function previewItem(itemId) {
    const meta = getItemById(itemId, runtime.registry);
    if (!meta) return;
    if (!isReadyV1TemplateItem(meta)) {
      runtime.notice = tr('Превью для этого элемента появится в v1.1.', 'Preview for this item is planned for v1.1.');
      runtime.previewItemId = '';
      rerenderAll();
      return;
    }
    runtime.previewItemId = itemId;
    runtime.notice = meta.name + ' · ' + (meta.description || 'Catalog preview opened.');
    rerenderAll();
  }

  function openEditorSurfaceFromCatalog(surface) {
    const targetSurface = surface === 'cabinet' ? 'cabinet' : 'workspace';
    const shell = root.NSWorkspaceShell || null;

    if (shell) {
      if (targetSurface === 'cabinet' && typeof shell.openCabinetSection === 'function') {
        shell.openCabinetSection('editor');
        return targetSurface;
      }
      if (typeof shell.openWorkspaceSection === 'function') {
        shell.openWorkspaceSection('editor', { enable: true, mode: 'split' });
        return targetSurface;
      }
    }

    const selector = targetSurface === 'cabinet'
      ? '.cabinet-inner-nav-btn[data-section="editor"], [data-open-section="editor"], [data-workspace-editor-open-cabinet="editor"]'
      : '.workspace-nav-btn[data-section="editor"], [data-workspace-editor-open="editor"], [data-open-section="editor"]';

    const button = document.querySelector(selector);
    if (button && typeof button.click === 'function') {
      button.click();
      return targetSurface;
    }

    document.dispatchEvent(new CustomEvent('ns-vitrina:open-editor-request', {
      detail: { surface: targetSurface }
    }));
    return targetSurface;
  }

  async function openTemplateInEditor(itemId, surface, options) {
  const library = getTemplateLibrary();
  const editorTemplate = library && typeof library.getTemplateByCatalogItemId === 'function'
    ? library.getTemplateByCatalogItemId(itemId)
    : null;
  const meta = getItemById(itemId, runtime.registry) || BUILTIN_ITEMS.find(function (item) { return item.id === itemId; });
  if (!meta || meta.type !== 'template' || !editorTemplate) return;

  runtime.previewItemId = '';
  runtime.lastOpenedTemplateItemId = itemId;
  runtime.notice = (meta.name || 'Шаблон') + ' открывается в редакторе…';
  rerenderAll();

  const state = runtime.registry.items.find(function (entry) { return entry.id === itemId; });
  if (!state || !state.installed) {
    await installItem(itemId);
  }

  const editorApi =
    (root.NSEditorV1 && typeof root.NSEditorV1.createDraftFromTemplate === 'function' && root.NSEditorV1) ||
    (root.__nsEditorV1Instance && typeof root.__nsEditorV1Instance.createDraftFromTemplate === 'function' && root.__nsEditorV1Instance) ||
    null;

  if (!editorApi) return;

  const targetSurface = surface === 'cabinet' ? 'cabinet' : 'workspace';
  const targetTab = options && options.initialTab ? options.initialTab : (surface === 'cabinet' ? 'write' : 'draft');
  const draft = editorApi.createDraftFromTemplate(editorTemplate.id, { initialTab: targetTab, surfaceType: targetSurface });
  openEditorSurfaceFromCatalog(surface);

  if (draft && draft.id) {
    if (root.NSEditorV1 && typeof root.NSEditorV1.openDraftById === 'function') {
      root.NSEditorV1.openDraftById(draft.id, targetSurface, targetTab);
    } else if (root.__nsEditorV1Instance && typeof root.__nsEditorV1Instance.openDraftById === 'function') {
      root.__nsEditorV1Instance.openDraftById(draft.id, targetSurface, targetTab);
    }
  }

  runtime.lastOpenedTemplateItemId = itemId;
  runtime.notice = (meta.name || 'Template') + ' · ' + tr('шаблон добавлен. Перехожу в редактор…', 'template added. Opening the editor…');
  runtime.previewItemId = '';
  rerenderAll();
}

  async function openTemplatePreviewExternal(itemId, surface) {
    runtime.previewItemId = '';
    rerenderAll();
    const library = getTemplateLibrary();
    const editorTemplate = library && typeof library.getTemplateByCatalogItemId === 'function'
      ? library.getTemplateByCatalogItemId(itemId)
      : null;
    const meta = getItemById(itemId, runtime.registry) || BUILTIN_ITEMS.find(function (item) { return item.id === itemId; });
    if (!meta || meta.type !== 'template' || !editorTemplate) return;

    const state = runtime.registry.items.find(function (entry) { return entry.id === itemId; });
    if (!state || !state.installed) {
      await installItem(itemId);
    }

    const editorApi =
      (root.NSEditorV1 && typeof root.NSEditorV1.createDraftFromTemplate === 'function' && root.NSEditorV1) ||
      (root.__nsEditorV1Instance && typeof root.__nsEditorV1Instance.createDraftFromTemplate === 'function' && root.__nsEditorV1Instance) ||
      null;

    if (!editorApi) return;

    const targetSurface = surface === 'cabinet' ? 'cabinet' : 'workspace';
    const draft = editorApi.createDraftFromTemplate(editorTemplate.id, { initialTab: targetSurface === 'cabinet' ? 'write' : 'draft' });
    const shell = root.NSWorkspaceShell || null;

    if (shell) {
      if (targetSurface === 'cabinet' && typeof shell.openCabinetSection === 'function') {
        shell.openCabinetSection('editor');
      } else if (typeof shell.openWorkspaceSection === 'function') {
        shell.openWorkspaceSection('editor', { enable: true, mode: 'split' });
      }
    }

    if (draft && draft.id) {
      if (root.NSEditorV1 && typeof root.NSEditorV1.openDraftPreviewExternal === 'function') {
        await root.NSEditorV1.openDraftPreviewExternal(draft.id, targetSurface);
      } else if (root.__nsEditorV1Instance && typeof root.__nsEditorV1Instance.openDraftPreviewExternal === 'function') {
        await root.__nsEditorV1Instance.openDraftPreviewExternal(draft.id, targetSurface);
      } else if (root.NSEditorV1 && typeof root.NSEditorV1.openDraftById === 'function') {
        root.NSEditorV1.openDraftById(draft.id, targetSurface, 'preview');
      }
    }

    runtime.notice = (meta.name || 'Template') + ' external preview opened.';
    runtime.previewItemId = '';
    rerenderAll();
  }

  function openCurrentTemplateDraftInEditor(itemId, surface) {
    const currentDraftId = getCurrentDraftId();
    const currentTemplateId = getCurrentDraftTemplateId();
    const library = getTemplateLibrary();
    const editorTemplate = library && typeof library.getTemplateByCatalogItemId === 'function'
      ? library.getTemplateByCatalogItemId(itemId)
      : null;

    if (!currentDraftId || !editorTemplate || String(editorTemplate.id) !== String(currentTemplateId)) {
      openTemplateInEditor(itemId, surface, { initialTab: surface === 'cabinet' ? 'write' : 'draft' });
      return;
    }

    const shell = root.NSWorkspaceShell || null;
    if (shell) {
      if (surface === 'cabinet' && typeof shell.openCabinetSection === 'function') {
        shell.openCabinetSection('editor');
      } else if (typeof shell.openWorkspaceSection === 'function') {
        shell.openWorkspaceSection('editor', { enable: true, mode: 'split' });
      }
    }

    if (root.NSEditorV1 && typeof root.NSEditorV1.openDraftById === 'function') {
      root.NSEditorV1.openDraftById(currentDraftId, surface === 'cabinet' ? 'cabinet' : 'workspace', surface === 'cabinet' ? 'write' : 'draft');
    } else if (root.__nsEditorV1Instance && typeof root.__nsEditorV1Instance.openDraftById === 'function') {
      root.__nsEditorV1Instance.openDraftById(currentDraftId, surface === 'cabinet' ? 'cabinet' : 'workspace', surface === 'cabinet' ? 'write' : 'draft');
    }

    runtime.notice = (editorTemplate.name || 'Template') + ' editor view opened.';
    runtime.previewItemId = '';
    rerenderAll();
  }

  async function handleAction(action, itemId, surface) {
    if (action === 'preview') {
      previewItem(itemId);
      return;
    }
    if (action === 'install') {
      await installItem(itemId);
      return;
    }
    if (action === 'use-template') {
      await openTemplateInEditor(itemId, surface, { initialTab: surface === 'cabinet' ? 'write' : 'draft' });
      return;
    }
    if (action === 'open-editor') {
      openCurrentTemplateDraftInEditor(itemId, surface);
      return;
    }
    if (action === 'open-template-preview') {
      await openTemplatePreviewExternal(itemId, surface);
    }
  }

  async function syncSubmittedToCatalog(persist) {
    const merged = mergeSubmittedItemsIntoRegistry(runtime.registry);
    const changed = JSON.stringify(merged) !== JSON.stringify(runtime.registry);
    runtime.registry = merged;
    if (changed && persist) {
      runtime.registry = await saveRegistry(runtime.registry);
    }
    return changed;
  }

  async function init() {
    runtime.registry = await loadRegistry();
    await syncSubmittedToCatalog(false);
    const library = getTemplateLibrary();
    if (library && typeof library.upsertInstalledTemplates === 'function') {
      library.upsertInstalledTemplates(getInstalledTemplates(runtime.registry));
    }

    document.addEventListener('ns-codehub:submitted', async function (event) {
      const item = event && event.detail ? event.detail.item : null;
      if (!item) return;
      const next = mergeSubmittedItemsIntoRegistry(runtime.registry);
      runtime.registry = await saveRegistry(next);
      runtime.notice = (item.title || item.name || 'Package') + ' added to Catalog.';
      rerenderAll();
    });

    root.NSVitrinaV1 = {
      getRegistry() {
        const next = clone(runtime.registry);
        next.items = getPublicRegistryItems(next);
        return next;
      },
      getInstalledTemplates() {
        return getInstalledTemplates(runtime.registry);
      }
    };
    emitTemplatesChanged();
    rerenderAll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
  }

  loadTemplateLibrary(boot);
})(window);
