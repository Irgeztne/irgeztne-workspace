(function () {
  'use strict';

  var VERSION = 'preview4-editor-site-studio-safe-v5-v7g1g-fix-menu-simplified';
  // Keep the v4 storage key so test pages created in v4 are not lost.
  var STORAGE_KEY = 'irgeztne.editorSiteStudioSafe.v4';
  var SITE_MANAGER_KEY = 'irgeztne.webStudioSites.v1';
  var WEBSTUDIO_MANAGER_STORAGE_KEY = 'webstudio.siteManager.v1';
  var LEGACY_PAGES_KEY = 'irgeztne.siteСтраницы.v0';
  var rootButton = null;
  var overlay = null;
  var activeTab = 'page';
  var collapsedLeft = true;
  var pagesSearch = '';
  var draggedPageId = '';
  var previewWide = true;
  var collapsedRight = false;
  var previewRequestId = 0;
  var siteManagerDraft = null;
  var siteManagerError = '';
  var siteManagerErrorField = '';
  var siteManagerMode = 'list';
  var siteSettingsSection = 'general';
  var STUDIO_LANG_KEY = 'irgeztne.webStudio.lang.v1';
  var STUDIO_THEME_KEY = 'irgeztne.webStudio.theme.v1';
  var JODIT_STYLE_SRC = 'node_modules/jodit/es2021/jodit.fat.min.css';
  var JODIT_SCRIPT_SRC = 'node_modules/jodit/es2021/jodit.fat.min.js';
  var studioLang = '';
  var studioTheme = '';
  var siteJodit = null;
  var siteEditorCoreBridge = null; // IRGEZTNE_WEBSTUDIO_EDITOR_CORE_BRIDGE_V065D
  var siteEditorCoreSaveTimer = null; // IRGEZTNE_WEBSTUDIO_EDITOR_CORE_BRIDGE_V065E
  var siteJoditPageId = '';
  var siteJoditReadyPromise = null;
  var publishProgress = { active: false, percent: 0, label: '' };
  var emergencyWebStudioStateCleanedV081C = false;

  function detectInitialLang() {
    var htmlLang = (document.documentElement.getAttribute('lang') || '').toLowerCase();
    var bodyText = (document.body && document.body.innerText || '').slice(0, 5000);
    return (htmlLang.indexOf('ru') === 0 || bodyText.indexOf('Редактор') !== -1 || bodyText.indexOf('Главная') !== -1) ? 'ru' : 'en';
  }

  function currentLang() {
    if (!studioLang) {
      try { studioLang = localStorage.getItem(STUDIO_LANG_KEY) || ''; } catch (error) { studioLang = ''; }
      if (studioLang !== 'ru' && studioLang !== 'en') studioLang = detectInitialLang();
    }
    return studioLang;
  }

  function isRu() { return currentLang() === 'ru'; }

  function t(en, ru) { return isRu() ? ru : en; }

  var UI_LABELS = {
    sites: { en: 'Sites', ru: 'Сайты' },
    editor: { en: 'Editor', ru: 'Редактор' },
    pages: { en: 'Pages', ru: 'Страницы' },
    menu: { en: 'Menu', ru: 'Меню' },
    design: { en: 'Design', ru: 'Дизайн' },
    preview: { en: 'Preview', ru: 'Предпросмотр' },
    publish: { en: 'Publish', ru: 'Опубликовать' },
    server: { en: 'Server', ru: 'Сервер' },
    settingsPanel: { en: 'Settings panel', ru: 'Панель настроек' },
    open: { en: 'Open', ru: 'Открыть' },
    edit: { en: 'Edit', ru: 'Править' },
    view: { en: 'View', ru: 'Вид' },
    delete: { en: 'Delete', ru: 'Удалить' },
    duplicate: { en: 'Duplicate', ru: 'Копия' },
    pageLink: { en: 'Page link', ru: 'Страница' },
    externalUrl: { en: 'External URL', ru: 'Внешний URL' },
    socialUrl: { en: 'Social link', ru: 'Социальная ссылка' }
  };

  function uiLabel(key) {
    var item = UI_LABELS[key];
    if (!item) return key;
    return currentLang() === 'ru' ? item.ru : item.en;
  }



  function normalizeVisibleRuLabels(root) {
    if (!root || currentLang() !== 'ru') return;
    var replacements = {
      'Open': 'Открыть',
      'Delete': 'Удалить',
      'Open site': 'Открыть сайт',
      'OpenSite': 'Открыть сайт',
      'Open сайт': 'Открыть сайт',
      'Open current': 'Открыть текущую',
      'Open текущую': 'Открыть текущую',
      'Open current page': 'Открыть текущую страницу',
      'Open текущую страницу': 'Открыть текущую страницу',
      'Open Backup Center': 'Открыть центр резервных копий',
      'Backup': 'Резервная копия',
      'Normal view': 'Превью',
      'Large view': 'Широкий вид'
    };
    var nodes = Array.prototype.slice.call(root.querySelectorAll('button, summary, [title], [aria-label]'));
    nodes.forEach(function (node) {
      var text = (node.textContent || '').trim();
      if (replacements[text]) node.textContent = replacements[text];
      var title = node.getAttribute && node.getAttribute('title');
      if (title && replacements[title]) node.setAttribute('title', replacements[title]);
      var aria = node.getAttribute && node.getAttribute('aria-label');
      if (aria && replacements[aria]) node.setAttribute('aria-label', replacements[aria]);
    });
  }

  function currentTheme() {
    if (!studioTheme) {
      try { studioTheme = localStorage.getItem(STUDIO_THEME_KEY) || ''; } catch (error) { studioTheme = ''; }
      if (studioTheme !== 'light' && studioTheme !== 'dark') studioTheme = 'dark';
    }
    return studioTheme;
  }

  function toggleStudioLang() {
    studioLang = currentLang() === 'ru' ? 'en' : 'ru';
    try { localStorage.setItem(STUDIO_LANG_KEY, studioLang); } catch (error) {}
    renderStudio();
  }

  function toggleStudioTheme() {
    studioTheme = currentTheme() === 'light' ? 'dark' : 'light';
    try { localStorage.setItem(STUDIO_THEME_KEY, studioTheme); } catch (error) {}
    renderStudio();
  }

  function loadJoditAssets(callback) {
    if (window.Jodit && typeof window.Jodit.make === 'function') { callback(true); return; }
    var finish = function (ok) { try { callback(!!ok); } catch (error) { log('Jodit callback failed', error); } };
    var existingScript = document.querySelector('script[data-ir-webstudio-jodit-loader]') || document.querySelector('script[data-ns-jodit-loader]');
    if (existingScript) {
      existingScript.addEventListener('load', function () { finish(true); }, { once: true });
      existingScript.addEventListener('error', function () { finish(false); }, { once: true });
      if (window.Jodit && typeof window.Jodit.make === 'function') finish(true);
      return;
    }
    if (!document.querySelector('link[data-ir-webstudio-jodit-style-loader], link[data-ns-jodit-style-loader]')) {
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = JODIT_STYLE_SRC;
      link.dataset.irWebstudioJoditStyleLoader = 'true';
      (document.head || document.documentElement).appendChild(link);
    }
    var script = document.createElement('script');
    script.src = JODIT_SCRIPT_SRC;
    script.async = true;
    script.dataset.irWebstudioJoditLoader = 'true';
    script.addEventListener('load', function () { finish(true); }, { once: true });
    script.addEventListener('error', function () { finish(false); }, { once: true });
    (document.head || document.documentElement).appendChild(script);
  }

  function ensureJoditReady() {
    if (window.Jodit && typeof window.Jodit.make === 'function') return Promise.resolve(true);
    if (siteJoditReadyPromise) return siteJoditReadyPromise;
    siteJoditReadyPromise = new Promise(function (resolve) { loadJoditAssets(function (ok) { resolve(!!ok); }); });
    return siteJoditReadyPromise;
  }

  function destroySiteJodit() {
    // IRGEZTNE_WEBSTUDIO_EDITOR_CORE_BRIDGE_V065D
    if (siteEditorCoreBridge && typeof siteEditorCoreBridge.destroy === 'function') {
      try { siteEditorCoreBridge.destroy(); } catch (error0) { log('Editor Core bridge destroy failed', error0); }
    }
    siteEditorCoreBridge = null;
    clearTimeout(siteEditorCoreSaveTimer);
    siteEditorCoreSaveTimer = null;

    if (siteJodit && typeof siteJodit.destruct === 'function') {
      try { siteJodit.destruct(); } catch (error) { log('Jodit destroy failed', error); }
    }
    siteJodit = null;
    siteJoditPageId = '';
  }

  function log() {
    try { console.log.apply(console, ['[SiteStudioSafeV5]'].concat([].slice.call(arguments))); } catch (error) {}
  }

  function safeJsonParse(value, fallback) {
    try { return JSON.parse(value); } catch (error) { return fallback; }
  }

  function uid(prefix) {
    var safePrefix = prefix || 'id';
    return safePrefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  function slugify(input) {
    var value = String(input || '').trim().toLowerCase();
    var map = {
      'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'e','ж':'zh','з':'z','и':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'h','ц':'c','ч':'ch','ш':'sh','щ':'sch','ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya'
    };
    value = value.replace(/[а-яё]/g, function (ch) { return map[ch] || ch; });
    value = value.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return value || 'page';
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function downloadText(filename, text, type) {
    var blob = new Blob([String(text == null ? '' : text)], { type: type || 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = filename || 'download.txt';
    link.style.display = 'none';
    document.body.appendChild(link);
    try { link.click(); } finally {
      window.setTimeout(function () {
        try { URL.revokeObjectURL(url); } catch (error) {}
        try { link.remove(); } catch (error2) {}
      }, 1200);
    }
  }

  /* IRGEZTNE_WEBSTUDIO_STABILITY_CORE_V074A */
  function sanitizeHtml(html) {
    var template = document.createElement('template');
    template.innerHTML = String(html || '');
    template.content.querySelectorAll('script, style, iframe, object, embed, link, meta').forEach(function (node) { node.remove(); });
    template.content.querySelectorAll('*').forEach(function (node) {
      [].slice.call(node.attributes || []).forEach(function (attr) {
        var name = attr.name.toLowerCase();
        var value = String(attr.value || '');
        if (name.indexOf('on') === 0 || value.toLowerCase().indexOf('javascript:') !== -1) node.removeAttribute(attr.name);
      });
    });
    return template.innerHTML;
  }

  function basicInitialsFromName(name) {
    var words = String(name || 'Project Studio').trim().split(/\s+/).filter(Boolean);
    if (!words.length) return 'PS';
    if (words.length === 1) return words[0].slice(0, 2) || 'PS';
    return (words[0][0] || '') + (words[1][0] || '') || 'PS';
  }

  function normalizeLogoLetters(value, fallbackName) {
    var fallback = basicInitialsFromName(fallbackName || 'Project Studio');
    var raw = String(value == null ? '' : value).trim();
    if (!raw) raw = fallback;
    raw = raw.replace(/\s+/g, '');
    try {
      raw = Array.from(raw).filter(function (char) { return /[0-9A-Za-zА-Яа-яЁё]/.test(char); }).join('');
    } catch (error) {
      raw = raw.replace(/[^0-9A-Za-zА-Яа-яЁё]/g, '');
    }
    raw = raw.toUpperCase();
    return raw.slice(0, 3) || String(fallback).slice(0, 3).toUpperCase() || 'PS';
  }

  function initialsFromName(name) {
    return normalizeLogoLetters(basicInitialsFromName(name), 'Project Studio');
  }

  function defaultPage(title, slug, status) {
    var pageTitle = title || t('Home', 'Главная');
    return {
      id: uid('page'),
      title: pageTitle,
      pageName: pageTitle,
      menuLabel: '',
      headline: '',
      slug: slug || slugify(pageTitle),
      summary: '',
      seoTitle: '',
      seoDescription: '',
      bodyHtml: '',
      status: status || 'draft',
      type: slug === 'index' ? 'home' : 'page',
      pagePreset: slug === 'index' ? 'landing' : 'blank',
      inMenu: true,
      inFooter: false,
      parentId: '',
      order: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      __preview4SeparatedFields: true
    };
  }

  function initialState() {
    var page = defaultPage(t('Home', 'Главная'), 'index', 'published');
    page.summary = t('Main landing page for this local site.', 'Главная страница локального сайта.');
    page.bodyHtml = '<p>' + escapeHtml(page.summary) + '</p>';
    page.inMenu = true;
    return {
      version: 5,
      site: {
        name: 'Project Studio',
        tagline: 'Local-first publishing workspace',
        logoLetters: 'PS',
        logoShape: 'rounded',
        logoBackgroundColor: '#2f7be6',
        logoTextColor: '#ffffff',
        logoFont: 'Inter',
        logoWeight: '900',
        logoFontSize: 110,
        logoHeaderSize: 'normal',
        icon: 'PS',
        faviconShape: 'rounded',
        faviconBackgroundColor: '#2f7be6',
        faviconTextColor: '#ffffff',
        faviconFont: 'Inter',
        faviconWeight: '950',
        menuColor: '#2f7be6',
        buttonColor: '#2f7be6',
        accentColor: '#2f7be6',
        backgroundColor: '',
        textColor: '#101827',
        fontFamily: 'Inter',
        headingFont: 'Inter',
        activeTemplate: 'project-landing',
        publishSettings: normalizePublishSettings(null)
      },
      pages: [page],
      menuGroups: [
        { id: 'menu-main-header', name: 'Главное меню', position: 'header', items: [createMenuItemFromPage(page, 0)] },
        { id: 'menu-main-footer', name: 'Меню подвала', position: 'footer', items: [] }
      ],
      activeMenuGroupId: 'menu-main-header',
      activePageId: page.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }


  // IRGEZTNE_TEMPLATE_STARTER_SITES_V068C
  function normalizeOfficialTemplateIdV068C(templateId) {
    var id = String(templateId || 'project-landing').toLowerCase();
    if (id === 'modern-landing-wide') return 'project-landing';
    if (id === 'studio-portfolio-wide') return 'studio-portfolio';
    if (id === 'knowledge-base-wide') return 'documentation-wide';
    return id;
  }

  function officialTemplateMetaV068C(templateId) {
    var id = normalizeOfficialTemplateIdV068C(templateId);
    var map = {
      'project-landing': { title: 'Landing / Product', titleRu: 'Лендинг / продукт', description: 'A wide product landing page template.', descriptionRu: 'Широкий продуктовый лендинг.' },
      'studio-portfolio': { title: 'Portfolio', titleRu: 'Портфолио', description: 'A portfolio and showcase template.', descriptionRu: 'Шаблон портфолио и showcase.' },
      'documentation-wide': { title: 'Documentation', titleRu: 'Документация', description: 'A wide documentation template.', descriptionRu: 'Широкий шаблон документации.' },
      'business-product': { title: 'Business / Product', titleRu: 'Бизнес / продукт', description: 'A business and product website template.', descriptionRu: 'Шаблон для бизнеса и продукта.' },
      'agency-studio': { title: 'Agency / Studio', titleRu: 'Студия / агентство', description: 'A studio and agency website template.', descriptionRu: 'Шаблон для студии и агентства.' },
      'blog-news': { title: 'Blog / News', titleRu: 'Блог / новости', description: 'A blog and news portal template.', descriptionRu: 'Шаблон для блога и новостей.' }
    };
    var meta = map[id] || map['project-landing'];
    return Object.assign({ id: id }, meta);
  }

  function persistSelectedOfficialTemplateV068C(templateId) {
    try {
      localStorage.setItem('irgeztne.preview4.selectedOfficialTemplate.v1', JSON.stringify({
        selectedAt: new Date().toISOString(),
        template: officialTemplateMetaV068C(templateId)
      }));
    } catch (error) {}
  }

  function officialTemplateCssV068C() {
    return [
      '.ir-starter-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin:24px 0}',
      '.ir-starter-card{border:1px solid var(--line);border-radius:18px;padding:18px;background:var(--panel);box-shadow:0 14px 34px rgba(15,23,42,.06)}',
      '.ir-starter-card strong{display:block;margin-bottom:7px;color:var(--ink)}',
      '.ir-starter-docs{display:grid;grid-template-columns:240px minmax(0,1fr);gap:22px;margin-top:22px}',
      '.ir-starter-docs aside{border:1px solid var(--line);border-radius:18px;padding:16px;background:var(--soft-bg)}',
      '.ir-starter-docs aside a{display:block;padding:8px 0;color:var(--muted);text-decoration:none;font-weight:800}',
      '.ir-starter-docs section{border:1px solid var(--line);border-radius:22px;padding:22px;background:var(--panel)}',
      '.ir-starter-news{display:grid;grid-template-columns:1.35fr .65fr;gap:18px;margin-top:22px}',
      '.ir-starter-news article,.ir-starter-news aside{border:1px solid var(--line);border-radius:20px;padding:18px;background:var(--panel)}',
      '.ir-starter-work{display:grid;grid-template-columns:1.15fr .85fr;gap:18px;margin-top:22px}',
      '.ir-starter-work div{border:1px solid var(--line);border-radius:20px;padding:18px;background:var(--panel)}',
      '@media(max-width:800px){.ir-starter-grid,.ir-starter-docs,.ir-starter-news,.ir-starter-work{grid-template-columns:1fr}}'
    ].join('\n');
  }

  function createStarterPageV068C(def) {
    var page = defaultPage(def.title, def.slug, 'published');
    page.pageName = def.title;
    page.title = def.title;
    page.slug = def.slug;
    page.status = 'published';
    page.summary = def.summary;
    page.bodyHtml = def.bodyHtml;
    page.inMenu = def.inMenu !== false;
    return page;
  }

  function starterPagesForTemplateV068C(templateId) {
    var id = normalizeOfficialTemplateIdV068C(templateId);



    // IRGEZTNE_LANDING_TEMPLATE_PARITY_V086A
    if (id === 'project-landing') {
      function landingI18nV086A(en, ru, tagName, className) {
        var tag = tagName || 'span';
        var classAttr = className
          ? ' class="' + escapeHtml(className) + '"'
          : '';

        return '<' + tag + classAttr +
          ' data-i18n-text="1"' +
          ' data-en="' + escapeHtml(en) + '"' +
          ' data-ru="' + escapeHtml(ru) + '">' +
          escapeHtml(t(en, ru)) +
          '</' + tag + '>';
      }

      var landingHomeV086A =
        '<div class="landing-home-v086a" data-landing-starter-v086a="1">' +

          '<section class="hero" id="product">' +
            '<div class="hero-copy">' +
              '<p class="kicker">Landing / Product</p>' +

              landingI18nV086A(
                'Turn first impression into action.',
                'Превратите первое впечатление в действие.',
                'h1'
              ) +

              landingI18nV086A(
                'A wide product landing for apps, tools, SaaS products and digital launches.',
                'Широкий продуктовый лендинг для приложений, инструментов, SaaS-продуктов и цифровых запусков.',
                'p'
              ) +

              '<div class="hero-actions">' +
                '<a class="btn" href="#cta">' +
                  landingI18nV086A(
                    'Get access',
                    'Получить доступ'
                  ) +
                '</a>' +

                '<a class="btn secondary" href="#features">' +
                  landingI18nV086A(
                    'View features',
                    'Смотреть возможности'
                  ) +
                '</a>' +
              '</div>' +
            '</div>' +

            '<aside class="hero-visual"' +
              ' data-template-slot="hero.productMockup"' +
              ' data-slot="hero.productMockup"' +
              ' data-slot-kind="image">' +

              '<div class="product-panel">' +
                landingI18nV086A(
                  'Launch panel',
                  'Панель запуска',
                  'h3'
                ) +

                '<div class="metric-row">' +
                  '<div class="metric"><strong>01</strong>' +
                    landingI18nV086A('Start', 'Старт') +
                  '</div>' +

                  '<div class="metric"><strong>02</strong>' +
                    landingI18nV086A('Build', 'Сборка') +
                  '</div>' +

                  '<div class="metric"><strong>03</strong>' +
                    landingI18nV086A('Launch', 'Запуск') +
                  '</div>' +
                '</div>' +
              '</div>' +

              '<div class="visual-footer">' +
                '<div class="visual-pill">' +
                  landingI18nV086A('Signup', 'Регистрация') +
                '</div>' +

                '<div class="visual-pill">' +
                  landingI18nV086A('Download', 'Скачивание') +
                '</div>' +

                '<div class="visual-pill">' +
                  landingI18nV086A('Demo', 'Демо') +
                '</div>' +
              '</div>' +
            '</aside>' +
          '</section>' +

          '<div class="strip">' +
            '<b>' +
              landingI18nV086A(
                'Demo visuals can be replaced before publishing.',
                'Демо-визуалы можно заменить перед публикацией.'
              ) +
            '</b>' +

            landingI18nV086A(
              'Product, SaaS, app or service landing.',
              'Лендинг продукта, SaaS, приложения или услуги.'
            ) +
          '</div>' +

          '<section id="features">' +
            '<div class="section-head">' +
              '<div>' +
                '<p class="kicker">Features</p>' +

                landingI18nV086A(
                  'A landing page needs rhythm, proof and one clear action.',
                  'Лендингу нужен ритм, доказательства и одно понятное действие.',
                  'h2'
                ) +
              '</div>' +

              landingI18nV086A(
                'Every section explains the product, shows value and guides the visitor forward.',
                'Каждая секция объясняет продукт, показывает пользу и ведёт посетителя дальше.',
                'p'
              ) +
            '</div>' +

            '<div class="feature-grid">' +
              '<article class="section-card">' +
                '<div class="num">01</div>' +

                landingI18nV086A(
                  'Hero with purpose',
                  'Hero с задачей',
                  'h3'
                ) +

                landingI18nV086A(
                  'Explain the product clearly on the first screen.',
                  'Понятно объясните продукт уже на первом экране.',
                  'p'
                ) +
              '</article>' +

              '<article class="section-card">' +
                '<div class="num">02</div>' +

                landingI18nV086A(
                  'Benefits, not noise',
                  'Польза, а не шум',
                  'h3'
                ) +

                landingI18nV086A(
                  'Focus sections on real outcomes instead of decorative filler.',
                  'Сфокусируйте секции на результате, а не на декоративном наполнении.',
                  'p'
                ) +
              '</article>' +

              '<article class="section-card">' +
                '<div class="num">03</div>' +

                landingI18nV086A(
                  'Ready for conversion',
                  'Готов к действию',
                  'h3'
                ) +

                landingI18nV086A(
                  'Make signup, download, demo or request access easy to find.',
                  'Сделайте регистрацию, скачивание, демо или запрос доступа заметными.',
                  'p'
                ) +
              '</article>' +
            '</div>' +
          '</section>' +

          '<section class="scenario landing-showcase-v086a">' +
            '<article class="section-card landing-feature-visual-v086a"' +
              ' data-template-slot="feature.productVisual"' +
              ' data-slot="feature.productVisual"' +
              ' data-slot-kind="image">' +

              '<p class="kicker">Product visual</p>' +

              landingI18nV086A(
                'Show the product before visitors have to imagine it.',
                'Покажите продукт раньше, чем посетителю придётся его воображать.',
                'h2'
              ) +

              '<div class="landing-interface-v086a">' +
                '<div><strong>84%</strong><span>Tasks organised</span></div>' +
                '<i></i><i></i><i></i>' +
              '</div>' +
            '</article>' +

            '<article class="section-card">' +
              '<p class="kicker">Product story</p>' +

              landingI18nV086A(
                'Connect the problem, the interface and the result.',
                'Свяжите проблему, интерфейс и результат.',
                'h2'
              ) +

              landingI18nV086A(
                'A believable product visual helps visitors understand what they are looking at and how it fits into their workflow.',
                'Убедительный визуал помогает посетителю понять, что перед ним и как продукт встраивается в рабочий процесс.',
                'p'
              ) +
            '</article>' +
          '</section>' +

          '<section id="workflow">' +
            '<div class="section-head">' +
              '<div>' +
                '<p class="kicker">Workflow</p>' +

                landingI18nV086A(
                  'Guide the visitor from interest to a useful result.',
                  'Проведите посетителя от интереса к полезному результату.',
                  'h2'
                ) +
              '</div>' +

              landingI18nV086A(
                'Keep the path simple and visible.',
                'Сделайте путь простым и заметным.',
                'p'
              ) +
            '</div>' +

            '<div class="feature-grid">' +
              '<article class="section-card">' +
                '<div class="num">01</div>' +

                landingI18nV086A(
                  'Understand',
                  'Понять',
                  'h3'
                ) +

                landingI18nV086A(
                  'Explain what the product is and who it is for.',
                  'Объясните, что это за продукт и для кого он создан.',
                  'p'
                ) +
              '</article>' +

              '<article class="section-card">' +
                '<div class="num">02</div>' +

                landingI18nV086A(
                  'Evaluate',
                  'Оценить',
                  'h3'
                ) +

                landingI18nV086A(
                  'Show benefits, use cases and proof.',
                  'Покажите преимущества, сценарии и доказательства.',
                  'p'
                ) +
              '</article>' +

              '<article class="section-card">' +
                '<div class="num">03</div>' +

                landingI18nV086A(
                  'Act',
                  'Действовать',
                  'h3'
                ) +

                landingI18nV086A(
                  'Offer one calm and clear next step.',
                  'Предложите один спокойный и понятный следующий шаг.',
                  'p'
                ) +
              '</article>' +
            '</div>' +
          '</section>' +

          '<section class="scenario landing-proof-v086a" id="proof">' +
            '<article class="section-card">' +
              '<p class="kicker">Proof</p>' +

              landingI18nV086A(
                'Use facts instead of empty promises.',
                'Используйте факты вместо пустых обещаний.',
                'h2'
              ) +

              landingI18nV086A(
                'Add metrics, customer results, release status or verified examples.',
                'Добавьте метрики, результаты клиентов, статус релиза или проверенные примеры.',
                'p'
              ) +
            '</article>' +

            '<article class="section-card landing-proof-metrics-v086a">' +
              '<div><strong>3×</strong>' +
                landingI18nV086A(
                  'Clearer onboarding',
                  'Понятнее знакомство'
                ) +
              '</div>' +

              '<div><strong>24/7</strong>' +
                landingI18nV086A(
                  'Product access',
                  'Доступ к продукту'
                ) +
              '</div>' +

              '<div><strong>1</strong>' +
                landingI18nV086A(
                  'Primary action',
                  'Главное действие'
                ) +
              '</div>' +
            '</article>' +
          '</section>' +

          '<section id="faq">' +
            '<div class="section-head">' +
              '<div>' +
                '<p class="kicker">FAQ</p>' +

                landingI18nV086A(
                  'Answer doubts before the visitor leaves.',
                  'Ответьте на сомнения до того, как посетитель уйдёт.',
                  'h2'
                ) +
              '</div>' +

              landingI18nV086A(
                'Use this section for access, price, support and product questions.',
                'Используйте этот раздел для вопросов о доступе, цене, поддержке и продукте.',
                'p'
              ) +
            '</div>' +

            '<div class="faq-list">' +
              '<details class="faq-item" open>' +
                landingI18nV086A(
                  'Can users replace the product visual?',
                  'Можно ли заменить визуал продукта?',
                  'summary'
                ) +

                landingI18nV086A(
                  'Yes. Demo visuals are placeholders for your own screenshots, product images or interface mockups.',
                  'Да. Демо-визуалы — это заглушки для собственных скриншотов, изображений продукта или макетов интерфейса.',
                  'p'
                ) +
              '</details>' +

              '<details class="faq-item">' +
                landingI18nV086A(
                  'Is this template only for SaaS?',
                  'Этот шаблон только для SaaS?',
                  'summary'
                ) +

                landingI18nV086A(
                  'No. It also works for apps, tools, services, launches and single-product campaigns.',
                  'Нет. Он также подходит для приложений, инструментов, сервисов, запусков и кампаний одного продукта.',
                  'p'
                ) +
              '</details>' +

              '<details class="faq-item">' +
                landingI18nV086A(
                  'Does a landing page need RSS?',
                  'Нужен ли лендингу RSS?',
                  'summary'
                ) +

                landingI18nV086A(
                  'No. RSS is not required for a product landing by default.',
                  'Нет. Продуктовому лендингу RSS по умолчанию не требуется.',
                  'p'
                ) +
              '</details>' +
            '</div>' +
          '</section>' +

          '<section class="final-cta" id="cta">' +
            '<div>' +
              '<p class="kicker">CTA</p>' +

              landingI18nV086A(
                'Give visitors a clear next step.',
                'Дайте посетителям понятный следующий шаг.',
                'h2'
              ) +

              landingI18nV086A(
                'Replace this action with signup, download, demo, preorder or an access request.',
                'Замените действие на регистрацию, скачивание, демо, предзаказ или запрос доступа.',
                'p'
              ) +
            '</div>' +

            '<a class="btn" href="mailto:hello@example.com">' +
              landingI18nV086A(
                'Get access',
                'Получить доступ'
              ) +
            '</a>' +
          '</section>' +
        '</div>';

      return [
        {
          title: t('Home', 'Главная'),
          slug: 'index',
          summary: t(
            'A wide product landing with hero, product visual, benefits, workflow, proof, FAQ and CTA.',
            'Широкий продуктовый лендинг с hero, визуалом продукта, преимуществами, сценарием, доказательствами, FAQ и CTA.'
          ),
          bodyHtml: landingHomeV086A
        }
      ];
    }


    if (id === 'documentation-wide') {
      function docsTextV085A(en, ru) {
        return escapeHtml(t(en, ru));
      }

      var docsHomeV085A =
        '<div class="docs-home-v085a">' +
          '<section class="docs-hero-v085a">' +
            '<div class="docs-hero-copy-v085a">' +
              '<span class="docs-eyebrow-v085a">' +
                docsTextV085A('Documentation template', 'Шаблон документации') +
              '</span>' +
              '<h2>' +
                docsTextV085A(
                  'A wide knowledge base for products, tools and technical guides.',
                  'Широкая база знаний для продуктов, инструментов и технических руководств.'
                ) +
              '</h2>' +
              '<p>' +
                docsTextV085A(
                  'Clean navigation, readable articles, code examples, callouts, API cards and a real documentation rhythm.',
                  'Чистая навигация, читаемые статьи, примеры кода, callout-блоки, API-карточки и настоящий ритм документации.'
                ) +
              '</p>' +
              '<div class="docs-hero-actions-v085a">' +
                '<a href="#quick-start">' +
                  docsTextV085A('Quick start', 'Быстрый старт') +
                '</a>' +
                '<a class="is-secondary" href="#api">' +
                  docsTextV085A('View API', 'Смотреть API') +
                '</a>' +
              '</div>' +
            '</div>' +

            '<aside class="docs-code-visual-v085a" ' +
              'data-template-slot="hero.codeVisual" ' +
              'data-slot="hero.codeVisual">' +
              '<div class="docs-window-dots-v085a"><i></i><i></i><i></i></div>' +
              '<pre><code>' +
                escapeHtml(
                  'site:\n' +
                  '  template: documentation\n' +
                  '  theme: light-dark\n' +
                  '  locale:\n' +
                  '    - en\n' +
                  '    - ru\n\n' +
                  'features:\n' +
                  '  search: true\n' +
                  '  codeBlocks: true\n' +
                  '  callouts: true'
                ) +
              '</code></pre>' +
            '</aside>' +
          '</section>' +

          '<section id="quick-start" class="docs-article-v085a">' +
            '<span class="docs-eyebrow-v085a">' +
              docsTextV085A('Quick start', 'Быстрый старт') +
            '</span>' +
            '<h2>' +
              docsTextV085A(
                'Give readers the answer first, then details.',
                'Сначала дайте читателю ответ, затем детали.'
              ) +
            '</h2>' +
            '<p>' +
              docsTextV085A(
                'A good documentation page starts with orientation: what it explains, who it is for and what the reader can do next.',
                'Хорошая страница сначала объясняет, о чём она, для кого предназначена и что читатель может сделать дальше.'
              ) +
            '</p>' +

            '<div class="docs-steps-v085a">' +
              '<article><span>01</span><h3>' +
                docsTextV085A('Install', 'Установка') +
              '</h3><p>' +
                docsTextV085A(
                  'Show the minimum setup without overwhelming the reader.',
                  'Покажите минимальную настройку, не перегружая читателя.'
                ) +
              '</p></article>' +

              '<article><span>02</span><h3>' +
                docsTextV085A('Configure', 'Настройка') +
              '</h3><p>' +
                docsTextV085A(
                  'Explain the important settings and safe defaults.',
                  'Объясните важные параметры и безопасные значения по умолчанию.'
                ) +
              '</p></article>' +

              '<article><span>03</span><h3>' +
                docsTextV085A('Publish', 'Публикация') +
              '</h3><p>' +
                docsTextV085A(
                  'Point the reader toward preview, export or deployment.',
                  'Направьте читателя к предпросмотру, экспорту или публикации.'
                ) +
              '</p></article>' +
            '</div>' +
          '</section>' +

          '<section class="docs-callout-v085a">' +
            '<strong>' +
              docsTextV085A(
                'Documentation should feel calm, not empty.',
                'Документация должна быть спокойной, но не пустой.'
              ) +
            '</strong>' +
            '<p>' +
              docsTextV085A(
                'Wide layouts work when navigation, article content, examples and context remain visible together.',
                'Широкий макет работает, когда навигация, статья, примеры и контекст видны вместе.'
              ) +
            '</p>' +
          '</section>' +

          '<section id="api" class="docs-article-v085a">' +
            '<span class="docs-eyebrow-v085a">' +
              docsTextV085A('API / Reference', 'API / Справочник') +
            '</span>' +
            '<h2>' +
              docsTextV085A(
                'Reference blocks should be structured and scannable.',
                'Справочные блоки должны быть структурными и быстрыми для чтения.'
              ) +
            '</h2>' +

            '<div class="docs-api-grid-v085a">' +
              '<article><small>GET</small><h3>/sites</h3><p>' +
                docsTextV085A(
                  'Returns available sites and metadata.',
                  'Возвращает доступные сайты и метаданные.'
                ) +
              '</p></article>' +

              '<article><small>POST</small><h3>/publish</h3><p>' +
                docsTextV085A(
                  'Starts export or publishing for the selected project.',
                  'Запускает экспорт или публикацию выбранного проекта.'
                ) +
              '</p></article>' +

              '<article><small>PATCH</small><h3>/settings</h3><p>' +
                docsTextV085A(
                  'Updates SEO, OpenGraph, robots and custom settings.',
                  'Обновляет SEO, OpenGraph, robots и пользовательские настройки.'
                ) +
              '</p></article>' +
            '</div>' +

            '<div class="docs-code-block-v085a">' +
              '<div><strong>' +
                docsTextV085A('Example request', 'Пример запроса') +
              '</strong><span>JSON</span></div>' +
              '<pre><code>' +
                escapeHtml(
                  '{\n' +
                  '  "siteId": "project-docs",\n' +
                  '  "template": "documentation",\n' +
                  '  "locale": "ru"\n' +
                  '}'
                ) +
              '</code></pre>' +
            '</div>' +
          '</section>' +

          '<section id="faq" class="docs-article-v085a">' +
            '<span class="docs-eyebrow-v085a">FAQ</span>' +
            '<h2>' +
              docsTextV085A(
                'Answer common questions before they become friction.',
                'Ответьте на частые вопросы до того, как они станут препятствием.'
              ) +
            '</h2>' +

            '<div class="docs-faq-v085a">' +
              '<details open><summary>' +
                docsTextV085A(
                  'Can this template use images?',
                  'Можно ли использовать изображения?'
                ) +
              '</summary><p>' +
                docsTextV085A(
                  'Yes. Product screenshots, interface examples, diagrams and tables work best.',
                  'Да. Лучше всего подходят скриншоты продукта, примеры интерфейса, схемы и таблицы.'
                ) +
              '</p></details>' +

              '<details><summary>' +
                docsTextV085A(
                  'Is RSS required?',
                  'Нужен ли RSS?'
                ) +
              '</summary><p>' +
                docsTextV085A(
                  'It is optional and useful mainly for changelogs or product updates.',
                  'Он необязателен и полезен прежде всего для changelog или обновлений продукта.'
                ) +
              '</p></details>' +

              '<details><summary>' +
                docsTextV085A(
                  'Can demo content be replaced?',
                  'Можно ли заменить демо-контент?'
                ) +
              '</summary><p>' +
                docsTextV085A(
                  'Yes. Demo content is a starting point and should be replaced with real documentation.',
                  'Да. Демо-контент — это отправная точка, его нужно заменить реальной документацией.'
                ) +
              '</p></details>' +
            '</div>' +
          '</section>' +
        '</div>';

      return [
        {
          title: t('Documentation', 'Документация'),
          slug: 'index',
          summary: t(
            'A wide documentation home with quick start, API examples and FAQ.',
            'Широкая главная документации с быстрым стартом, API-примерами и FAQ.'
          ),
          bodyHtml: docsHomeV085A
        },
        {
          title: t('Getting started', 'Начало'),
          slug: 'getting-started',
          summary: t(
            'Installation, setup and the first successful result.',
            'Установка, настройка и первый успешный результат.'
          ),
          bodyHtml:
            '<section id="overview" class="docs-article-v085a">' +
              '<span class="docs-eyebrow-v085a">' +
                docsTextV085A('Getting started', 'Начало') +
              '</span>' +
              '<h2>' +
                docsTextV085A(
                  'Start with the shortest path to a working result.',
                  'Начните с кратчайшего пути к рабочему результату.'
                ) +
              '</h2>' +
              '<p>' +
                docsTextV085A(
                  'Explain requirements, installation and the first successful preview before advanced details.',
                  'Объясните требования, установку и первый успешный предпросмотр до сложных деталей.'
                ) +
              '</p>' +
            '</section>' +
            '<section id="steps" class="docs-article-v085a">' +
              '<div class="docs-steps-v085a">' +
                '<article><span>01</span><h3>' +
                  docsTextV085A('Prepare', 'Подготовка') +
                '</h3><p>' +
                  docsTextV085A(
                    'Collect the required files and access details.',
                    'Соберите необходимые файлы и данные доступа.'
                  ) +
                '</p></article>' +
                '<article><span>02</span><h3>' +
                  docsTextV085A('Open', 'Открытие') +
                '</h3><p>' +
                  docsTextV085A(
                    'Open the project and verify the main page.',
                    'Откройте проект и проверьте главную страницу.'
                  ) +
                '</p></article>' +
                '<article><span>03</span><h3>' +
                  docsTextV085A('Preview', 'Предпросмотр') +
                '</h3><p>' +
                  docsTextV085A(
                    'Check the result before export or publishing.',
                    'Проверьте результат перед экспортом или публикацией.'
                  ) +
                '</p></article>' +
              '</div>' +
            '</section>' +
            '<section id="next" class="docs-callout-v085a">' +
              '<strong>' + docsTextV085A('Next step', 'Следующий шаг') + '</strong>' +
              '<p>' +
                docsTextV085A(
                  'Move advanced workflows into guides and exact fields into reference pages.',
                  'Перенесите сложные процессы в гайды, а точные поля — в справочные страницы.'
                ) +
              '</p>' +
            '</section>'
        },
        {
          title: t('Guides', 'Гайды'),
          slug: 'guides',
          summary: t(
            'Practical workflows, troubleshooting and examples.',
            'Практические процессы, решение проблем и примеры.'
          ),
          bodyHtml:
            '<section id="workflow" class="docs-article-v085a">' +
              '<span class="docs-eyebrow-v085a">' +
                docsTextV085A('Workflow', 'Рабочий процесс') +
              '</span>' +
              '<h2>' +
                docsTextV085A(
                  'Explain one practical task from start to finish.',
                  'Объясните одну практическую задачу от начала до результата.'
                ) +
              '</h2>' +
              '<p>' +
                docsTextV085A(
                  'Keep every guide focused on a real outcome and show the safest path.',
                  'Пусть каждый гайд ведёт к конкретному результату и показывает безопасный путь.'
                ) +
              '</p>' +
            '</section>' +
            '<section id="troubleshooting" class="docs-callout-v085a">' +
              '<strong>' +
                docsTextV085A('Troubleshooting', 'Проблемы и решения') +
              '</strong>' +
              '<p>' +
                docsTextV085A(
                  'Collect common symptoms, causes and short verified fixes.',
                  'Соберите частые симптомы, причины и короткие проверенные решения.'
                ) +
              '</p>' +
            '</section>' +
            '<section id="examples" class="docs-article-v085a">' +
              '<div class="docs-api-grid-v085a">' +
                '<article><small>01</small><h3>' +
                  docsTextV085A('Example', 'Пример') +
                '</h3><p>' +
                  docsTextV085A(
                    'Show a complete small example.',
                    'Покажите небольшой законченный пример.'
                  ) +
                '</p></article>' +
                '<article><small>02</small><h3>' +
                  docsTextV085A('Variation', 'Вариант') +
                '</h3><p>' +
                  docsTextV085A(
                    'Explain what changes in another scenario.',
                    'Объясните, что меняется в другом сценарии.'
                  ) +
                '</p></article>' +
                '<article><small>03</small><h3>' +
                  docsTextV085A('Result', 'Результат') +
                '</h3><p>' +
                  docsTextV085A(
                    'Show the expected final state.',
                    'Покажите ожидаемое итоговое состояние.'
                  ) +
                '</p></article>' +
              '</div>' +
            '</section>'
        },
        {
          title: t('Reference', 'Справка'),
          slug: 'reference',
          summary: t(
            'Settings, endpoints and exact technical details.',
            'Настройки, endpoints и точные технические детали.'
          ),
          bodyHtml:
            '<section id="settings" class="docs-article-v085a">' +
              '<span class="docs-eyebrow-v085a">' +
                docsTextV085A('Reference', 'Справка') +
              '</span>' +
              '<h2>' +
                docsTextV085A(
                  'Keep exact fields easy to scan.',
                  'Сделайте точные поля удобными для просмотра.'
                ) +
              '</h2>' +
              '<table class="docs-table-v068i">' +
                '<thead><tr><th>' +
                  docsTextV085A('Item', 'Элемент') +
                '</th><th>' +
                  docsTextV085A('Description', 'Описание') +
                '</th></tr></thead>' +
                '<tbody>' +
                  '<tr><td><code>site.name</code></td><td>' +
                    docsTextV085A(
                      'Public site name used in the header and metadata.',
                      'Публичное имя сайта в шапке и метаданных.'
                    ) +
                  '</td></tr>' +
                  '<tr><td><code>site.url</code></td><td>' +
                    docsTextV085A(
                      'Canonical URL used for sitemap and sharing.',
                      'Канонический URL для sitemap и публикации ссылок.'
                    ) +
                  '</td></tr>' +
                  '<tr><td><code>theme</code></td><td>' +
                    docsTextV085A(
                      'Light or dark generated-site mode.',
                      'Светлый или тёмный режим созданного сайта.'
                    ) +
                  '</td></tr>' +
                '</tbody>' +
              '</table>' +
            '</section>' +
            '<section id="endpoints" class="docs-article-v085a">' +
              '<div class="docs-api-grid-v085a">' +
                '<article><small>GET</small><h3>/sites</h3><p>' +
                  docsTextV085A('List sites.', 'Список сайтов.') +
                '</p></article>' +
                '<article><small>POST</small><h3>/publish</h3><p>' +
                  docsTextV085A('Start publishing.', 'Запуск публикации.') +
                '</p></article>' +
                '<article><small>PATCH</small><h3>/settings</h3><p>' +
                  docsTextV085A('Update settings.', 'Обновление настроек.') +
                '</p></article>' +
              '</div>' +
            '</section>' +
            '<section id="schema" class="docs-code-block-v085a">' +
              '<div><strong>' +
                docsTextV085A('Configuration example', 'Пример конфигурации') +
              '</strong><span>JSON</span></div>' +
              '<pre><code>' +
                escapeHtml(
                  '{\n' +
                  '  "site": "Project Docs",\n' +
                  '  "theme": "dark"\n' +
                  '}'
                ) +
              '</code></pre>' +
            '</section>'
        }
      ];
    }

    // IRGEZTNE_BUSINESS_PRODUCT_STARTER_V069A
    if (id === 'business-product') return [
      { title: t('Home', 'Главная'), slug: 'index', summary: t('A business website for a product, service or company.', 'Бизнес-сайт для продукта, услуги или компании.'), bodyHtml:
        '<section style="display:grid;grid-template-columns:minmax(0,1.05fr) minmax(280px,.95fr);gap:34px;align-items:center;margin:10px 0 34px">' +
          '<div><p style="margin:0 0 12px;color:var(--button-accent);font-weight:900;letter-spacing:.08em;text-transform:uppercase;font-size:13px">' + escapeHtml(t('Business / Product', 'Бизнес / продукт')) + '</p>' +
          '<h2 style="font-size:clamp(34px,5vw,58px);line-height:.98;letter-spacing:-.055em;margin:0 0 18px">' + escapeHtml(t('Present products and services clearly', 'Покажите продукты и услуги понятно')) + '</h2>' +
          '<p style="font-size:18px;line-height:1.7;color:var(--muted);margin:0 0 22px">' + escapeHtml(t('A calm business structure for a company, product, offer, service page or small studio.', 'Спокойная бизнес-структура для компании, продукта, предложения, услуги или небольшой студии.')) + '</p>' +
          '<div style="display:flex;flex-wrap:wrap;gap:10px"><a href="#services" style="display:inline-flex;padding:12px 16px;border-radius:999px;background:var(--button-accent);color:#fff;text-decoration:none;font-weight:900">' + escapeHtml(t('View services', 'Смотреть услуги')) + '</a><a href="contact.html" style="display:inline-flex;padding:12px 16px;border-radius:999px;border:1px solid var(--line);color:var(--ink);text-decoration:none;font-weight:900">' + escapeHtml(t('Contact', 'Контакты')) + '</a></div></div>' +
          '<div style="border-radius:34px;min-height:320px;background:radial-gradient(circle at 72% 26%,rgba(255,255,255,.72) 0 34px,transparent 35px),linear-gradient(135deg,color-mix(in srgb,var(--button-accent) 80%,#0f172a),color-mix(in srgb,var(--button-accent) 35%,#f8fafc));box-shadow:0 28px 70px color-mix(in srgb,var(--button-accent) 28%,transparent);position:relative;overflow:hidden">' +
            '<div style="position:absolute;left:28px;right:28px;bottom:28px;border-radius:24px;background:rgba(255,255,255,.82);backdrop-filter:blur(14px);padding:20px;color:#0f172a"><strong style="display:block;font-size:18px;margin-bottom:8px">' + escapeHtml(t('Business card', 'Карточка бизнеса')) + '</strong><span style="display:block;color:#475569;line-height:1.5">' + escapeHtml(t('Offer, trust, services and next step in one clean layout.', 'Предложение, доверие, услуги и следующий шаг в одном чистом макете.')) + '</span></div>' +
          '</div>' +
        '</section>' +
        '<section id="services" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;margin:34px 0">' +
          '<article style="border:1px solid var(--line);border-radius:24px;padding:22px;background:var(--panel-bg)"><strong style="display:block;font-size:18px;margin-bottom:8px">' + escapeHtml(t('Services', 'Услуги')) + '</strong><p style="color:var(--muted);line-height:1.65;margin:0">' + escapeHtml(t('Show your main services, product packages or client offers.', 'Покажите основные услуги, продуктовые пакеты или предложения для клиентов.')) + '</p></article>' +
          '<article style="border:1px solid var(--line);border-radius:24px;padding:22px;background:var(--panel-bg)"><strong style="display:block;font-size:18px;margin-bottom:8px">' + escapeHtml(t('Process', 'Процесс')) + '</strong><p style="color:var(--muted);line-height:1.65;margin:0">' + escapeHtml(t('Explain how work happens from request to result.', 'Объясните, как проходит работа от заявки до результата.')) + '</p></article>' +
          '<article style="border:1px solid var(--line);border-radius:24px;padding:22px;background:var(--panel-bg)"><strong style="display:block;font-size:18px;margin-bottom:8px">' + escapeHtml(t('Trust', 'Доверие')) + '</strong><p style="color:var(--muted);line-height:1.65;margin:0">' + escapeHtml(t('Add proof, numbers, testimonials or guarantees.', 'Добавьте доказательства, цифры, отзывы или гарантии.')) + '</p></article>' +
        '</section>' +
        '<section style="margin:34px 0;border:1px solid var(--line);border-radius:28px;padding:26px;background:var(--soft-bg)"><h2 style="margin-top:0">' + escapeHtml(t('Why choose this offer', 'Почему выбирают это предложение')) + '</h2><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:14px"><div><strong>01</strong><p style="color:var(--muted);line-height:1.6">' + escapeHtml(t('Clear value for the customer.', 'Понятная ценность для клиента.')) + '</p></div><div><strong>02</strong><p style="color:var(--muted);line-height:1.6">' + escapeHtml(t('Simple structure without visual noise.', 'Простая структура без визуального шума.')) + '</p></div><div><strong>03</strong><p style="color:var(--muted);line-height:1.6">' + escapeHtml(t('Direct path to contact or purchase.', 'Прямой путь к контакту или покупке.')) + '</p></div></div></section>' },
      { title: t('Services', 'Услуги'), slug: 'services', summary: t('Services and offers.', 'Услуги и предложения.'), bodyHtml:
        '<h2>' + escapeHtml(t('Services and offers', 'Услуги и предложения')) + '</h2>' +
        '<p>' + escapeHtml(t('Use this page to explain your main services, packages or product lines.', 'Используйте эту страницу, чтобы объяснить основные услуги, пакеты или продуктовые направления.')) + '</p>' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px;margin:24px 0">' +
          '<article style="border:1px solid var(--line);border-radius:22px;padding:22px;background:var(--panel-bg)"><strong>' + escapeHtml(t('Starter package', 'Стартовый пакет')) + '</strong><p style="color:var(--muted);line-height:1.65">' + escapeHtml(t('For first contact, audit, consultation or small launch.', 'Для первого контакта, аудита, консультации или небольшого запуска.')) + '</p></article>' +
          '<article style="border:1px solid var(--line);border-radius:22px;padding:22px;background:var(--panel-bg)"><strong>' + escapeHtml(t('Growth package', 'Пакет роста')) + '</strong><p style="color:var(--muted);line-height:1.65">' + escapeHtml(t('For regular work, improvements and ongoing support.', 'Для регулярной работы, улучшений и сопровождения.')) + '</p></article>' +
          '<article style="border:1px solid var(--line);border-radius:22px;padding:22px;background:var(--panel-bg)"><strong>' + escapeHtml(t('Custom project', 'Индивидуальный проект')) + '</strong><p style="color:var(--muted);line-height:1.65">' + escapeHtml(t('For complex tasks with a custom scope and timeline.', 'Для сложных задач с отдельным объёмом и сроками.')) + '</p></article>' +
        '</div>' },
      { title: t('About', 'О компании'), slug: 'about', summary: t('Company story and values.', 'История компании и ценности.'), bodyHtml:
        '<h2>' + escapeHtml(t('About the company', 'О компании')) + '</h2>' +
        '<p>' + escapeHtml(t('Tell the story, mission and strengths of the business.', 'Расскажите историю, миссию и сильные стороны бизнеса.')) + '</p>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;margin:24px 0"><div style="border:1px solid var(--line);border-radius:24px;padding:22px;background:var(--panel-bg)"><strong>' + escapeHtml(t('Mission', 'Миссия')) + '</strong><p style="color:var(--muted);line-height:1.65">' + escapeHtml(t('Explain what problem the company solves and why it exists.', 'Объясните, какую проблему решает компания и зачем она существует.')) + '</p></div><div style="border:1px solid var(--line);border-radius:24px;padding:22px;background:var(--panel-bg)"><strong>' + escapeHtml(t('Values', 'Ценности')) + '</strong><p style="color:var(--muted);line-height:1.65">' + escapeHtml(t('Describe principles, quality, speed, care or expertise.', 'Опишите принципы, качество, скорость, заботу или экспертизу.')) + '</p></div></div>' },
      { title: t('Contact', 'Контакты'), slug: 'contact', summary: t('Contact information.', 'Контактная информация.'), bodyHtml:
        '<h2>' + escapeHtml(t('Contact', 'Контакты')) + '</h2>' +
        '<p>' + escapeHtml(t('Make the next step simple: request, consultation, order or partnership.', 'Сделайте следующий шаг простым: заявка, консультация, заказ или партнёрство.')) + '</p>' +
        '<div style="border:1px solid var(--line);border-radius:26px;padding:24px;background:var(--soft-bg);margin:24px 0"><strong style="display:block;margin-bottom:10px">' + escapeHtml(t('Contact details', 'Контактные данные')) + '</strong><p style="color:var(--muted);line-height:1.7;margin:0">Email: hello@example.com<br>Phone: +000 000 000<br>' + escapeHtml(t('Address or working area', 'Адрес или регион работы')) + '</p></div>' }
    ];

    if (id === 'agency-studio') return [
      { title: t('Home', 'Главная'), slug: 'index', summary: t('A studio website for cases, services and team.', 'Сайт студии для кейсов, услуг и команды.'), bodyHtml: '<div class="ir-starter-work"><div><h2>' + escapeHtml(t('Selected cases', 'Избранные кейсы')) + '</h2><p>' + escapeHtml(t('Show several strong works and explain the result.', 'Покажите несколько сильных работ и объясните результат.')) + '</p></div><div><h2>' + escapeHtml(t('Services', 'Услуги')) + '</h2><p>' + escapeHtml(t('Design, web, branding, content or development.', 'Дизайн, веб, брендинг, контент или разработка.')) + '</p></div></div>' },
      { title: t('Cases', 'Кейсы'), slug: 'cases', summary: t('Projects and case studies.', 'Проекты и кейсы.'), bodyHtml: '<h2>' + escapeHtml(t('Cases', 'Кейсы')) + '</h2><p>' + escapeHtml(t('Add project cards, results and screenshots.', 'Добавьте карточки проектов, результаты и скриншоты.')) + '</p>' },
      { title: t('Services', 'Услуги'), slug: 'services', summary: t('Studio services.', 'Услуги студии.'), bodyHtml: '<h2>' + escapeHtml(t('Studio services', 'Услуги студии')) + '</h2><p>' + escapeHtml(t('Describe what the studio can do for clients.', 'Опишите, что студия может сделать для клиентов.')) + '</p>' },
      { title: t('Contact', 'Контакты'), slug: 'contact', summary: t('Project request and contacts.', 'Заявка на проект и контакты.'), bodyHtml: '<h2>' + escapeHtml(t('Start a project', 'Начать проект')) + '</h2><p>' + escapeHtml(t('Add a short project request and contact details.', 'Добавьте короткую заявку на проект и контактные данные.')) + '</p>' }
    ];

    // IRGEZTNE_BLOG_NEWS_WIDE_STARTER_V069G
    // IRGEZTNE_BLOG_NEWS_THREE_COLUMN_STARTER_V069H
    if (id === 'blog-news') return [
      { title: t('Journal', 'Журнал'), slug: 'index', summary: t('A blog and news layout for articles and updates.', 'Макет блога и новостей для статей и обновлений.'), bodyHtml:
        '<section class="ir-news-home-v069h">' +
          '<div class="ir-news-masthead-v069h"><div><p>' + escapeHtml(t('Newsroom', 'Редакция')) + '</p><h2>' + escapeHtml(t('Latest stories, news and guides', 'Последние материалы, новости и гайды')) + '</h2></div><a href="articles.html">' + escapeHtml(t('All articles', 'Все статьи')) + '</a></div>' +
          '<div class="ir-news-grid-v069h">' +
            '<article class="ir-news-card-v069h ir-news-card--lead-v069h"><div class="ir-news-thumb-v069h"></div><span>' + escapeHtml(t('Main story', 'Главная тема')) + '</span><h3>' + escapeHtml(t('Big headline for the main publication', 'Большой заголовок главной публикации')) + '</h3><p>' + escapeHtml(t('Use this card for the most important article, review, announcement or editorial material.', 'Используйте эту карточку для самой важной статьи, обзора, объявления или редакционного материала.')) + '</p><small>8 min read · Today</small></article>' +
            '<article class="ir-news-card-v069h"><div class="ir-news-thumb-v069h ir-news-thumb-v069h--blue"></div><span>' + escapeHtml(t('News', 'Новости')) + '</span><h3>' + escapeHtml(t('Short update from the project', 'Короткое обновление проекта')) + '</h3><p>' + escapeHtml(t('A compact news card for quick updates and announcements.', 'Компактная новостная карточка для быстрых обновлений и объявлений.')) + '</p><small>News · 3 min</small></article>' +
            '<article class="ir-news-card-v069h"><div class="ir-news-thumb-v069h ir-news-thumb-v069h--violet"></div><span>' + escapeHtml(t('Review', 'Обзор')) + '</span><h3>' + escapeHtml(t('Product or market analysis', 'Обзор продукта или рынка')) + '</h3><p>' + escapeHtml(t('Use this format for reviews, comparisons and explanations.', 'Используйте этот формат для обзоров, сравнений и объяснений.')) + '</p><small>Review · 6 min</small></article>' +
            '<article class="ir-news-card-v069h"><span>' + escapeHtml(t('Guide', 'Гайд')) + '</span><h3>' + escapeHtml(t('Practical guide for readers', 'Практический гайд для читателей')) + '</h3><p>' + escapeHtml(t('Step-by-step material with useful examples and clear structure.', 'Пошаговый материал с полезными примерами и понятной структурой.')) + '</p><small>Guide · 5 min</small></article>' +
            '<article class="ir-news-card-v069h"><span>' + escapeHtml(t('Update', 'Обновление')) + '</span><h3>' + escapeHtml(t('Release notes and changes', 'Заметки релиза и изменения')) + '</h3><p>' + escapeHtml(t('A place for changelog, release notes or progress reports.', 'Место для changelog, заметок релиза или отчётов о прогрессе.')) + '</p><small>Update · 2 min</small></article>' +
            '<article class="ir-news-card-v069h"><span>' + escapeHtml(t('Opinion', 'Мнение')) + '</span><h3>' + escapeHtml(t('Editorial note or column', 'Редакционная заметка или колонка')) + '</h3><p>' + escapeHtml(t('Short opinion, observation or project note from the author.', 'Короткое мнение, наблюдение или заметка проекта от автора.')) + '</p><small>Opinion · 4 min</small></article>' +
          '</div>' +
          '<section class="ir-news-strip-v069h"><strong>' + escapeHtml(t('Topics', 'Темы')) + '</strong><a href="topics.html">Technology</a><a href="topics.html">Business</a><a href="topics.html">Guides</a><a href="topics.html">Updates</a><a href="topics.html">Opinion</a></section>' +
        '</section>' },
      { title: t('Articles', 'Статьи'), slug: 'articles', summary: t('Articles and posts.', 'Статьи и публикации.'), bodyHtml:
        '<h2>' + escapeHtml(t('Articles', 'Статьи')) + '</h2>' +
        '<p>' + escapeHtml(t('Collect long-form articles, notes and posts here.', 'Собирайте здесь статьи, заметки и публикации.')) + '</p>' +
        '<div class="ir-news-grid-v069h ir-news-grid-v069h--simple">' +
          '<article class="ir-news-card-v069h"><span>' + escapeHtml(t('Feature', 'Большой материал')) + '</span><h3>' + escapeHtml(t('Deep article with context', 'Большая статья с контекстом')) + '</h3><p>' + escapeHtml(t('A long-form post with examples, details and conclusions.', 'Большой материал с примерами, деталями и выводами.')) + '</p></article>' +
          '<article class="ir-news-card-v069h"><span>' + escapeHtml(t('Interview', 'Интервью')) + '</span><h3>' + escapeHtml(t('Conversation or expert view', 'Разговор или экспертный взгляд')) + '</h3><p>' + escapeHtml(t('Use this card for interviews and expert comments.', 'Используйте эту карточку для интервью и комментариев экспертов.')) + '</p></article>' +
          '<article class="ir-news-card-v069h"><span>' + escapeHtml(t('Report', 'Отчёт')) + '</span><h3>' + escapeHtml(t('Project or event report', 'Отчёт о проекте или событии')) + '</h3><p>' + escapeHtml(t('Summaries, results, lessons and next steps.', 'Итоги, результаты, выводы и следующие шаги.')) + '</p></article>' +
        '</div>' },
      { title: t('Topics', 'Темы'), slug: 'topics', summary: t('Topics and categories.', 'Темы и категории.'), bodyHtml:
        '<h2>' + escapeHtml(t('Topics', 'Темы')) + '</h2>' +
        '<p>' + escapeHtml(t('Organize articles by topic or category.', 'Организуйте статьи по темам или категориям.')) + '</p>' +
        '<section class="ir-news-strip-v069h ir-news-strip-v069h--large"><strong>Topics</strong><a>News</a><a>Guides</a><a>Reviews</a><a>Updates</a><a>Opinion</a><a>Business</a></section>' },
      { title: t('About', 'О проекте'), slug: 'about', summary: t('About this publication.', 'О проекте публикации.'), bodyHtml:
        '<h2>' + escapeHtml(t('About this publication', 'О проекте публикации')) + '</h2>' +
        '<p>' + escapeHtml(t('Explain the purpose of the blog, journal or news page.', 'Объясните назначение блога, журнала или новостной страницы.')) + '</p>' +
        '<div class="ir-news-card-v069h"><span>' + escapeHtml(t('Editorial promise', 'Редакционное обещание')) + '</span><h3>' + escapeHtml(t('What readers can expect', 'Чего ждать читателям')) + '</h3><p>' + escapeHtml(t('Tell readers what you publish, how often and why they should return.', 'Расскажите читателям, что вы публикуете, как часто и почему стоит возвращаться.')) + '</p></div>' }
    ];

    if (id === 'studio-portfolio') return [
      { title: t('Home', 'Главная'), slug: 'index', summary: t('A portfolio website for works, projects and identity.', 'Сайт-портфолио для работ, проектов и образа.'), bodyHtml: '<div class="ir-starter-work"><div><h2>' + escapeHtml(t('Featured work', 'Избранная работа')) + '</h2><p>' + escapeHtml(t('Place the strongest project here.', 'Разместите здесь самый сильный проект.')) + '</p></div><div><h2>' + escapeHtml(t('Profile', 'Профиль')) + '</h2><p>' + escapeHtml(t('Short bio, focus and contact direction.', 'Коротко о себе, фокус и направление контакта.')) + '</p></div></div>' },
      { title: t('Works', 'Работы'), slug: 'works', summary: t('Selected works and projects.', 'Избранные работы и проекты.'), bodyHtml: '<h2>' + escapeHtml(t('Works', 'Работы')) + '</h2><p>' + escapeHtml(t('Add selected works, screenshots and descriptions.', 'Добавьте избранные работы, скриншоты и описания.')) + '</p>' },
      { title: t('About', 'О себе'), slug: 'about', summary: t('About the author or studio.', 'Об авторе или студии.'), bodyHtml: '<h2>' + escapeHtml(t('About', 'О себе')) + '</h2><p>' + escapeHtml(t('Tell who you are and what you create.', 'Расскажите, кто вы и что создаёте.')) + '</p>' },
      { title: t('Contact', 'Контакты'), slug: 'contact', summary: t('Contact and collaboration.', 'Контакты и сотрудничество.'), bodyHtml: '<h2>' + escapeHtml(t('Contact', 'Контакты')) + '</h2><p>' + escapeHtml(t('Add contact and collaboration details.', 'Добавьте контакты и условия сотрудничества.')) + '</p>' }
    ];

    return [
      { title: t('Home', 'Главная'), slug: 'index', summary: t('A modern landing page for a product, service or project.', 'Современный лендинг для продукта, сервиса или проекта.'), bodyHtml: '<div class="ir-starter-grid"><div class="ir-starter-card"><strong>01</strong>' + escapeHtml(t('Overview', 'Описание')) + '</div><div class="ir-starter-card"><strong>02</strong>' + escapeHtml(t('Benefits', 'Преимущества')) + '</div><div class="ir-starter-card"><strong>03</strong>' + escapeHtml(t('Publish', 'Публикация')) + '</div></div>' },
      { title: t('Product', 'Продукт'), slug: 'product', summary: t('Product details and benefits.', 'Описание продукта и преимущества.'), bodyHtml: '<h2>' + escapeHtml(t('Product', 'Продукт')) + '</h2><p>' + escapeHtml(t('Describe the product, service or project here.', 'Опишите здесь продукт, сервис или проект.')) + '</p>' },
      { title: t('Contact', 'Контакты'), slug: 'contact', summary: t('Contact and next step.', 'Контакты и следующий шаг.'), bodyHtml: '<h2>' + escapeHtml(t('Contact', 'Контакты')) + '</h2><p>' + escapeHtml(t('Add email, links or a call to action.', 'Добавьте email, ссылки или призыв к действию.')) + '</p>' }
    ];
  }

  function applyOfficialTemplateStarterV068C(state, templateId) {
    var id = normalizeOfficialTemplateIdV068C(templateId);
    var pages = starterPagesForTemplateV068C(id).map(createStarterPageV068C);
    var meta = officialTemplateMetaV068C(id);

    state.site.activeTemplate = id;
    state.site.tagline = t(meta.description, meta.descriptionRu) || state.site.tagline;

    if (state.site.accentColor === '#2f7be6') {
      var accent = id === 'business-product' ? '#0f766e' : id === 'agency-studio' || id === 'studio-portfolio' ? '#8b5cf6' : id === 'blog-news' ? '#dc2626' : '#2f7be6';
      state.site.accentColor = accent;
      state.site.menuColor = accent;
      state.site.buttonColor = accent;
      state.site.logoBackgroundColor = accent;
      state.site.faviconBackgroundColor = accent;
    }

    state.site.siteSettings = state.site.siteSettings || {};
    state.site.siteSettings.css = state.site.siteSettings.css || {};
    state.site.siteSettings.css.custom = officialTemplateCssV068C();

    state.pages = pages;
    state.menuGroups = [
      { id: 'menu-main-header', name: 'Главное меню', position: 'header', items: pages.filter(function (page) { return page.inMenu; }).map(function (page, index) { return createMenuItemFromPage(page, index); }) },
      { id: 'menu-main-footer', name: 'Меню подвала', position: 'footer', items: [] }
    ];
    state.activeMenuGroupId = 'menu-main-header';
    state.activePageId = pages[0] ? pages[0].id : state.activePageId;
    state.updatedAt = new Date().toISOString();

    persistSelectedOfficialTemplateV068C(id);
    return state;
  }


  function cloneJson(value) {
    return safeJsonParse(JSON.stringify(value || {}), {});
  }

  function siteIconOptions() {
    return ['☕', '✦', '◆', '⌂', '✎', '▣', '◈', '☁', '⚙', '★', '⌘', '🌐', '📰', '📚', '🎨', '🚀', '🧭', '💼', '🔬', '🛡'];
  }

  function siteColorOptions() {
    return ['#2f7be6', '#14b879', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#22c55e', '#f97316', '#0f172a', '#64748b'];
  }

  function normalizeSiteProfile(profile, fallbackState) {
    profile = profile && typeof profile === 'object' ? profile : {};
    fallbackState = fallbackState && typeof fallbackState === 'object' ? fallbackState : {};
    var site = fallbackState.site || {};
    var name = String(profile.name || site.name || t('New website', 'Новый сайт')).trim() || t('New website', 'Новый сайт');
    var color = normalizeHexColor(profile.color || site.accentColor || '#2f7be6', '#2f7be6');
    return {
      id: profile.id || site.localSiteId || uid('site'),
      name: name,
      author: String(profile.author || site.author || '').trim(),
      icon: String(profile.icon || site.icon || initialsFromName(name).slice(0, 1) || '◆').slice(0, 4),
      color: color,
      createdAt: profile.createdAt || fallbackState.createdAt || new Date().toISOString(),
      updatedAt: profile.updatedAt || fallbackState.updatedAt || new Date().toISOString()
    };
  }

  function applySiteProfileToState(state, profile) {
    state = normalizeState(state || initialState());
    profile = normalizeSiteProfile(profile, state);
    state.site.localSiteId = profile.id;
    state.site.name = profile.name;
    state.site.author = profile.author;
    state.site.icon = profile.icon;
    state.site.siteColor = profile.color;
    state.site.logoLetters = normalizeLogoLetters(state.site.logoLetters || initialsFromName(profile.name), profile.name);
    if (!state.site.accentColor) state.site.accentColor = profile.color;
    return state;
  }

  function profileFromState(state, existing) {
    existing = existing || {};
    state = state || initialState();
    var site = state.site || {};
    var name = String(site.name || existing.name || t('Website', 'Сайт')).trim() || t('Website', 'Сайт');
    return normalizeSiteProfile({
      id: existing.id || site.localSiteId,
      name: name,
      author: site.author || existing.author || '',
      icon: site.icon || existing.icon || initialsFromName(name).slice(0, 1),
      color: site.siteColor || site.accentColor || existing.color || '#2f7be6',
      createdAt: existing.createdAt || state.createdAt,
      updatedAt: new Date().toISOString()
    }, state);
  }

  function normalizeSiteManager(manager) {
    manager = manager && typeof manager === 'object' ? manager : {};
    var sites = Array.isArray(manager.sites) ? manager.sites : [];
    sites = sites.map(function (entry) {
      var state = normalizeState(entry && entry.state ? entry.state : initialState());
      var profile = normalizeSiteProfile(entry || {}, state);
      state = applySiteProfileToState(state, profile);
      return Object.assign({}, profile, { state: state });
    });
    if (!sites.length) {
      var legacy = safeJsonParse(localStorage.getItem(STORAGE_KEY), null);
      var state = normalizeState(legacy || initialState());
      var profile = profileFromState(state, { id: state.site && state.site.localSiteId });
      state = applySiteProfileToState(state, profile);
      sites.push(Object.assign({}, profile, { state: state }));
    }
    var activeSiteId = manager.activeSiteId && sites.some(function (site) { return site.id === manager.activeSiteId; }) ? manager.activeSiteId : sites[0].id;
    return {
      version: 1,
      activeSiteId: activeSiteId,
      sites: sites,
      createdAt: manager.createdAt || sites[0].createdAt || new Date().toISOString(),
      updatedAt: manager.updatedAt || new Date().toISOString()
    };
  }

  function cloneWebStudioManagerForStorage(manager) {
    try {
      return JSON.parse(JSON.stringify(manager, function (key, value) {
        if (/^(token|secretKey|accessKey|password|privateKey)$/i.test(String(key || ''))) return '';
        return value;
      }));
    } catch (error) {
      return manager;
    }
  }

  function webStudioStorageApi() {
    return window.nsAPI || null;
  }

  function readSiteManagerFromStorageCore() {
    var api = webStudioStorageApi();
    if (!api || typeof api.storageGetModuleStateSync !== 'function') return null;
    try {
      var stored = api.storageGetModuleStateSync(WEBSTUDIO_MANAGER_STORAGE_KEY, null);
      return stored && typeof stored === 'object' ? stored : null;
    } catch (error) {
      log('Web Studio Storage Core read failed', error);
      return null;
    }
  }

  function writeSiteManagerToStorageCore(manager) {
    var api = webStudioStorageApi();
    if (!api) return false;
    var clean = cloneWebStudioManagerForStorage(manager);
    try {
      if (typeof api.storageSetModuleStateSync === 'function') {
        var result = api.storageSetModuleStateSync(WEBSTUDIO_MANAGER_STORAGE_KEY, clean);
        return !result || result.ok !== false;
      }
      if (typeof api.storageSetModuleState === 'function') {
        api.storageSetModuleState(WEBSTUDIO_MANAGER_STORAGE_KEY, clean).catch(function (error) { log('Web Studio Storage Core async save failed', error); });
        return true;
      }
    } catch (error) {
      log('Web Studio Storage Core save failed', error);
    }
    return false;
  }

  function readLegacySiteManagerForMigration() {
    var manager = safeJsonParse(localStorage.getItem(SITE_MANAGER_KEY), null);
    if (manager && typeof manager === 'object') return manager;
    return null;
  }

  function writeSiteManager(manager) {
    manager = normalizeSiteManager(manager);
    manager.updatedAt = new Date().toISOString();
    if (!writeSiteManagerToStorageCore(manager)) {
      try {
        var cleanFallback = cloneWebStudioManagerForStorage(manager);
        localStorage.setItem(SITE_MANAGER_KEY, JSON.stringify(cleanFallback));
        var active = cleanFallback.sites.find(function (site) { return site.id === cleanFallback.activeSiteId; }) || cleanFallback.sites[0];
        if (active && active.state) localStorage.setItem(STORAGE_KEY, JSON.stringify(active.state));
      } catch (error) {
        log('Web Studio fallback LocalStorage save failed', error);
      }
    }
    return manager;
  }

  function readSiteManager() {
    var manager = readSiteManagerFromStorageCore();
    if (!manager) {
      manager = readLegacySiteManagerForMigration();
      manager = normalizeSiteManager(manager);
      writeSiteManager(manager);
      return manager;
    }
    manager = normalizeSiteManager(manager);

    // IRGEZTNE_V081C_SAFE_SAVE_CLEANED_MANAGER
    if (emergencyWebStudioStateCleanedV081C) {
      emergencyWebStudioStateCleanedV081C = false;
      try { writeSiteManager(manager); } catch (error) { log('Web Studio emergency clean save failed', error); }
    }

    return manager;
  }

  function activeSiteEntry(manager) {
    manager = manager || readSiteManager();
    return manager.sites.find(function (site) { return site.id === manager.activeSiteId; }) || manager.sites[0];
  }

  function resetSiteManagerDraft() {
    siteManagerDraft = {
      name: t('New website', 'Новый сайт'),
      author: '',
      icon: '☕',
      color: '#2f7be6',
      template: 'project-landing'
    };
  }

  function getSiteManagerDraft() {
    if (!siteManagerDraft) resetSiteManagerDraft();
    return siteManagerDraft;
  }

  function sameText(a, b) {
    return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
  }

  function shouldClearLegacyField(value, pageName, oldTitle) {
    if (!String(value || '').trim()) return false;
    return sameText(value, pageName) || sameText(value, oldTitle) || sameText(value, t('Home', 'Главная')) || sameText(value, t('New site page', 'Новая страница сайта'));
  }

  function migrateSeparatedFields(page) {
    if (!page || page.__preview4SeparatedFields) return page;
    var pageName = page.pageName || page.title || page.headline || '';
    var oldTitle = page.title || pageName;
    if (shouldClearLegacyField(page.menuLabel, pageName, oldTitle)) page.menuLabel = '';
    if (shouldClearLegacyField(page.headline, pageName, oldTitle)) page.headline = '';
    if (shouldClearLegacyField(page.seoTitle, pageName, oldTitle)) page.seoTitle = '';
    if (sameText(page.seoDescription, t('Local-first site page created in IRGEZTNE.', 'Локальная страница сайта, созданная в IRGEZTNE.'))) page.seoDescription = '';
    page.__preview4SeparatedFields = true;
    return page;
  }

  function pageLabel(page) {
    return String((page && (page.pageName || page.title || page.headline || page.slug)) || t('Untitled page', 'Страница без названия')).trim() || t('Untitled page', 'Страница без названия');
  }

  function pageFileName(page) {
    var slug = slugify((page && (page.slug || page.pageName || page.title)) || 'page');
    if (slug === 'index' || sameText(pageLabel(page), t('Home', 'Главная'))) return 'index.html';
    return slug + '.html';
  }

  function previewUrlForFile(indexUrl, fileName) {
    var url = String(indexUrl || '');
    var name = String(fileName || 'index.html');
    if (!url || name === 'index.html') return url;
    return url.replace(/index\.html(?:[#?].*)?$/, encodeURIComponent(name));
  }

  function createMenuItemFromPage(page, order) {
    return {
      id: uid('menuItem'),
      label: pageLabel(page),
      type: 'page',
      pageId: page && page.id ? page.id : '',
      url: '',
      order: Number.isFinite(Number(order)) ? Number(order) : 0
    };
  }

  function normalizeMenuItem(item, index) {
    if (!item || typeof item !== 'object') item = {};
    item.id = item.id || uid('menuItem');
    item.type = item.type === 'external' || item.type === 'social' ? item.type : 'page';
    item.label = item.label == null ? '' : String(item.label);
    item.pageId = item.pageId || '';
    item.url = item.url || '';
    item.order = Number.isFinite(Number(item.order)) ? Number(item.order) : index;
    return item;
  }

  function headerMenuGroup(state) {
    ensureMenuGroups(state);
    var groups = Array.isArray(state.menuGroups) ? state.menuGroups : [];
    return groups.find(function (group) { return group.position === 'header'; }) || groups[0] || null;
  }

  function isPageInHeaderMenu(state, pageId) {
    var group = headerMenuGroup(state);
    if (!group || !Array.isArray(group.items)) return false;
    return group.items.some(function (item) { return item.type !== 'external' && item.pageId === pageId; });
  }

  function pageNavigationStatus(state, page) {
    if (!page || !page.id) return t('not in navigation', 'не в навигации');
    if (page.inFooter === true) return t('footer/service page', 'служебная страница подвала');
    if (page.parentId) {
      var parent = (state.pages || []).find(function (item) { return item.id === page.parentId; });
      return t('submenu', 'подменю') + (parent ? ': ' + pageLabel(parent) : '');
    }
    return t('top-level navigation', 'верхняя навигация');
  }

  function ensurePageInHeaderMenu(state, page) {
    if (!page || !page.id || page.inFooter === true) return false;
    var group = headerMenuGroup(state);
    if (!group) return false;
    if (!Array.isArray(group.items)) group.items = [];
    if (group.items.some(function (item) { return item.type !== 'external' && item.pageId === page.id; })) return false;
    group.items.push(createMenuItemFromPage(page, group.items.length));
    return true;
  }

  function removePageFromMenus(state, pageId) {
    var changed = false;
    ensureMenuGroups(state);
    (state.menuGroups || []).forEach(function (group) {
      if (!Array.isArray(group.items)) return;
      var before = group.items.length;
      group.items = group.items.filter(function (item) { return item.type === 'external' || item.pageId !== pageId; });
      if (group.items.length !== before) changed = true;
      group.items.forEach(function (item, index) { item.order = index; });
    });
    return changed;
  }

  function syncMenuItemsWithPages(state) {
    var pages = Array.isArray(state.pages) ? state.pages : [];
    var byId = {};
    pages.forEach(function (page) { if (page && page.id) byId[page.id] = page; });
    var changed = false;
    (state.menuGroups || []).forEach(function (group) {
      if (!Array.isArray(group.items)) group.items = [];
      var seenInGroup = {};
      var nextItems = [];
      group.items.forEach(function (rawItem, index) {
        var item = normalizeMenuItem(rawItem, index);
        if (item.type === 'external' || item.type === 'social') {
          item.pageId = '';
          nextItems.push(item);
          return;
        }
        var target = byId[item.pageId];
        if (!target) { changed = true; return; }
        if (seenInGroup[target.id]) { changed = true; return; }
        seenInGroup[target.id] = true;
        var nextLabel = pageLabel(target);
        if (item.label !== nextLabel) { item.label = nextLabel; changed = true; }
        item.url = '';
        nextItems.push(item);
      });
      if (nextItems.length !== group.items.length) changed = true;
      group.items = nextItems;
      group.items.forEach(function (item, index) {
        if (item.order !== index) { item.order = index; changed = true; }
      });
    });
    return changed;
  }

  function syncPageMenuFlags(state) {
    /* v7g1g-fix: page settings are now the source of truth.
       Menu groups are kept as a simple overview/cache only. */
    ensureMenuGroups(state);
    var changed = false;
    var groups = Array.isArray(state.menuGroups) ? state.menuGroups : [];
    var header = groups.find(function (group) { return group.position === 'header'; }) || groups[0];
    var footer = groups.find(function (group) { return group.position === 'footer'; });
    var pages = orderedPageList(state);
    if (header) {
      var headerItems = pages.filter(function (page) { return page && page.inMenu === true && page.inFooter !== true && !page.parentId; }).map(function (page, index) { return createMenuItemFromPage(page, index); });
      var currentHeader = JSON.stringify((header.items || []).map(function (item) { return { pageId: item.pageId, type: item.type, label: item.label }; }));
      var nextHeader = JSON.stringify(headerItems.map(function (item) { return { pageId: item.pageId, type: item.type, label: item.label }; }));
      if (currentHeader !== nextHeader) { header.items = headerItems; changed = true; }
    }
    if (footer) {
      var footerItems = pages.filter(function (page) { return page && page.inFooter === true; }).map(function (page, index) { return createMenuItemFromPage(page, index); });
      var currentFooter = JSON.stringify((footer.items || []).map(function (item) { return { pageId: item.pageId, type: item.type, label: item.label }; }));
      var nextFooter = JSON.stringify(footerItems.map(function (item) { return { pageId: item.pageId, type: item.type, label: item.label }; }));
      if (currentFooter !== nextFooter) { footer.items = footerItems; changed = true; }
    }
    return changed;
  }

  function syncHeaderMenuWithPagesOnce(state) {
    if (state.__preview4AutoMenuSyncedV3) return false;
    var changed = false;
    (state.pages || []).forEach(function (page) {
      if (ensurePageInHeaderMenu(state, page)) changed = true;
    });
    state.__preview4AutoMenuSyncedV3 = true;
    return changed;
  }


  function findHomePage(state) {
    var pages = Array.isArray(state.pages) ? state.pages : [];
    return pages.find(function (page) { return page && page.slug === 'index'; }) ||
      pages.find(function (page) { return sameText(pageLabel(page), t('Home', 'Главная')); }) ||
      pages[0] || null;
  }

  function ensureManualMenuModel(state) {
    ensureMenuGroups(state);
    if (state.__preview4ManualMenuModelV1) return false;
    var header = headerMenuGroup(state);
    if (!header) return false;
    var home = findHomePage(state);
    var externalItems = Array.isArray(header.items) ? header.items.filter(function (item) { return item && item.type === 'external'; }) : [];
    header.items = [];
    if (home) {
      home.inMenu = true;
      header.items.push(createMenuItemFromPage(home, 0));
    }
    externalItems.forEach(function (item) {
      item.order = header.items.length;
      header.items.push(item);
    });
    (state.pages || []).forEach(function (page) {
      if (home && page.id === home.id) return;
      page.inMenu = false;
    });
    state.__preview4ManualMenuModelV1 = true;
    return true;
  }

  function getPreviewNavItems(state) {
    /* Header navigation is controlled from page settings.
       Top-level pages with “inMenu” enabled appear in the header;
       child pages with “inMenu” enabled appear in dropdowns under their parent. */
    var pages = orderedPageList(state).filter(Boolean);
    var items = [];
    var used = {};

    pages.forEach(function (page) {
      if (!page || !page.id || page.parentId || page.inMenu !== true || page.inFooter === true) return;
      if (used[page.id]) return;
      used[page.id] = true;
      items.push({
        id: 'page_nav_' + page.id,
        label: pageLabel(page),
        type: 'page',
        pageId: page.id,
        url: '',
        order: items.length
      });
    });

    if (!items.length) {
      var home = findHomePage(state);
      if (home) {
        items.push({ id: 'page_nav_' + home.id, label: pageLabel(home), type: 'page', pageId: home.id, url: '', order: 0 });
      }
    }

    return items;
  }

  function isChildOf(state, childId, parentId) {
    var cursor = (state.pages || []).find(function (page) { return page.id === childId; });
    var guard = 0;
    while (cursor && cursor.parentId && guard < 40) {
      if (cursor.parentId === parentId) return true;
      cursor = (state.pages || []).find(function (page) { return page.id === cursor.parentId; });
      guard += 1;
    }
    return false;
  }


  // IRGEZTNE_V081C_SAFE_CLEAN_WEBSTUDIO_STATE
  function emergencyStarterBodyHtmlV081C() {
    return [
      '<section class="ir-starter-section">',
      '<p class="ir-starter-kicker">Главная</p>',
      '<h2>Превратите первое впечатление в действие.</h2>',
      '<p>Стартовый лендинг продукта: hero, возможности, сценарии, FAQ и CTA доступа.</p>',
      '<ul class="ir-starter-list">',
      '<li><strong>Hero</strong> — explain the product fast</li>',
      '<li><strong>Features</strong> — show value</li>',
      '<li><strong>CTA</strong> — get access, start, download or request demo</li>',
      '</ul>',
      '</section>'
    ].join('');
  }

  function emergencyLooksBrokenBodyHtmlV081C(value) {
    value = String(value || '');

    if (!value) return false;

    return (
      value.indexOf('data:image/') >= 0 ||
      value.indexOf('base64,') >= 0 ||
      value.indexOf('ir-local-image') >= 0 ||
      value.indexOf('data-ir-image-id') >= 0 ||
      value.length > 30000 ||
      /base64,[A-Za-z0-9+/=]{500,}/.test(value)
    );
  }

  function emergencyCleanBodyHtmlV081C(value) {
    value = String(value || '');

    if (!emergencyLooksBrokenBodyHtmlV081C(value)) return value;

    emergencyWebStudioStateCleanedV081C = true;
    return emergencyStarterBodyHtmlV081C();
  }

  function normalizeState(state) {
    var base = initialState();
    if (!state || typeof state !== 'object') state = base;
    if (!state.site) state.site = {};
    /* IRGEZTNE_WEBSTUDIO_STABILITY_CORE_V074A
       Identity text fields may be temporarily empty while the user edits them.
       Do not restore PS/emoji fallbacks during normalizeState. */
    var allowEmptyIdentityV074A = {
      icon: true,
      logoLetters: true,
      faviconLetters: true,
      faviconSymbol: true,
      faviconText: true,
      faviconIcon: true
    };
    Object.keys(base.site).forEach(function (key) {
      if (state.site[key] == null || (state.site[key] === '' && !allowEmptyIdentityV074A[key])) state.site[key] = base.site[key];
    });
    state.site.logoLetters = String(state.site.logoLetters || '').toUpperCase().replace(/[^0-9A-ZА-ЯЁ]/gi, '').slice(0, 3);
    if (!state.site.logoHeaderSize) state.site.logoHeaderSize = 'normal';
    state.site.publishSettings = normalizePublishSettings(state.site.publishSettings);
    if (!Array.isArray(state.pages)) state.pages = [];
    if (!state.pages.length) state.pages.push(defaultPage(t('Home', 'Главная'), 'index', 'published'));
    state.pages = state.pages.map(function (page, index) {
      page = migrateSeparatedFields(page || {});
      page.id = page.id || uid('page');
      var internalName = page.pageName || page.title || page.headline || t('Untitled page', 'Страница без названия');
      page.pageName = String(internalName || '').trim() || t('Untitled page', 'Страница без названия');
      page.title = page.pageName;
      page.menuLabel = page.menuLabel == null ? '' : String(page.menuLabel);
      page.headline = page.headline == null ? '' : String(page.headline);
      page.slug = page.slug || slugify(page.pageName || 'page');
      page.summary = page.summary == null ? '' : String(page.summary);
      page.seoTitle = page.seoTitle == null ? '' : String(page.seoTitle);
      page.seoDescription = page.seoDescription == null ? '' : String(page.seoDescription);
      // IRGEZTNE_V081C_SAFE_PAGE_BODY_CLEAN
      page.bodyHtml = emergencyCleanBodyHtmlV081C(page.bodyHtml || '');
      page.status = page.status || 'draft';
      page.inFooter = page.inFooter === true;
      page.footerGroup = normalizeFooterGroup(page.footerGroup, page);
      /* v7g1h-fix: ordinary pages are shown in the header by default.
         Footer pages move out of the header; parent pages still create dropdowns. */
      page.inMenu = page.inFooter ? false : true;
      page.parentId = page.parentId || '';
      if (page.parentId === page.id || isChildOf({ pages: state.pages }, page.parentId, page.id)) page.parentId = '';
      page.order = Number.isFinite(Number(page.order)) ? Number(page.order) : index;
      page.createdAt = page.createdAt || new Date().toISOString();
      page.updatedAt = page.updatedAt || page.createdAt;
      page.__preview4SeparatedFields = true;
      return page;
    });
    if (!state.activePageId || !state.pages.some(function (page) { return page.id === state.activePageId; })) {
      state.activePageId = state.pages[0].id;
    }
    ensureMenuGroups(state);
    /* v7g1h-fix: do not reset existing pages into a manual menu model.
       Page placement is controlled by the page itself. */
    syncMenuItemsWithPages(state);
    syncPageMenuFlags(state);
    state.version = 5;
    return state;
  }

  function readLegacyСтраницы() {
    var legacy = safeJsonParse(localStorage.getItem(LEGACY_PAGES_KEY), null);
    if (!legacy || !Array.isArray(legacy.pages) || !legacy.pages.length) return [];
    return legacy.pages.slice(0, 12).map(function (item, index) {
      var title = item.title || item.label || t('Site page', 'Страница сайта');
      return {
        id: 'legacy_' + (item.id || uid('page')),
        title: title,
        pageName: item.pageName || title,
        menuLabel: item.menuLabel || '',
        headline: item.headline || '',
        slug: item.slug || slugify(title),
        summary: item.summary || item.description || '',
        seoTitle: item.seoTitle || '',
        seoDescription: item.seoDescription || item.summary || '',
        bodyHtml: item.bodyHtml || item.contentHtml || item.html || '',
        status: item.status || 'draft',
        inMenu: item.inMenu !== false,
        parentId: item.parentId || '',
        order: Number.isFinite(Number(item.order)) ? Number(item.order) : index,
        createdAt: item.createdAt || new Date().toISOString(),
        updatedAt: item.updatedAt || new Date().toISOString()
      };
    });
  }

  function readState() {
    var manager = readSiteManager();
    var active = activeSiteEntry(manager);
    var state = active && active.state ? active.state : safeJsonParse(localStorage.getItem(STORAGE_KEY), null);
    if (!state) {
      state = initialState();
      var legacyСтраницы = readLegacyСтраницы();
      if (legacyСтраницы.length && window.confirm && window.confirm(t('Import existing test pages into Web Studio?', 'Импортировать существующие тестовые страницы в Студию сайта?'))) {
        state.pages = legacyСтраницы;
        state.activePageId = state.pages[0].id;
      }
    }
    state = normalizeState(state);
    if (active) state = applySiteProfileToState(state, active);
    return state;
  }

  function writeState(state) {
    state = normalizeState(state || initialState());
    state.updatedAt = new Date().toISOString();
    var manager = readSiteManager();
    var active = activeSiteEntry(manager);
    if (!active) {
      var profileNew = profileFromState(state, {});
      active = Object.assign({}, profileNew, { state: state });
      manager.sites.push(active);
      manager.activeSiteId = active.id;
    }
    var profile = profileFromState(state, active);
    state = applySiteProfileToState(state, profile);
    var index = manager.sites.findIndex(function (site) { return site.id === active.id; });
    manager.sites[index >= 0 ? index : 0] = Object.assign({}, profile, { state: state });
    manager.activeSiteId = profile.id;
    writeSiteManager(manager);
  }

  function activePage(state) {
    return state.pages.find(function (page) { return page.id === state.activePageId; }) || state.pages[0];
  }

  function ensureUniqueSlug(state, base, currentId) {
    var root = slugify(base || 'page');
    var slug = root;
    var i = 2;
    while (state.pages.some(function (page) { return page.id !== currentId && page.slug === slug; })) {
      slug = root + '-' + i;
      i += 1;
    }
    return slug;
  }

  function isEditorVisible() {
    var text = (document.body && document.body.innerText || '').slice(0, 8000);
    if (text.indexOf('Cabinet Editor') !== -1 || text.indexOf('Редактор кабинета') !== -1 || text.indexOf('Черновик writing') !== -1 || text.indexOf('Поверхность для письма') !== -1) return true;
    if (document.querySelector('[data-action="new-draft"], [data-action="new-site-page"], [data-action="save-draft"], [data-action="open-site-studio-safe-v5"]')) return true;
    return [].slice.call(document.querySelectorAll('button, a')).some(function (el) {
      var tx = (el.textContent || '').trim().toLowerCase();
      var cls = String(el.className || '').toLowerCase();
      return (tx === 'editor' || tx === 'редактор') && (cls.indexOf('active') !== -1 || cls.indexOf('selected') !== -1);
    });
  }

  function findToolbarButton() {
    var selectors = ['[data-action="open-site-studio-safe-v5"]', '[data-action="new-site-page"]', '[data-action="new-draft"]', '[data-action="save-draft"]'];
    for (var i = 0; i < selectors.length; i += 1) {
      var el = document.querySelector(selectors[i]);
      if (el && el.parentElement) return el;
    }
    return null;
  }

  function ensureLauncher() {
    if (!document.body) return;
    if (!rootButton) {
      rootButton = document.createElement('button');
      rootButton.type = 'button';
      rootButton.className = 'ir-site-studio-v5-float-btn';
      rootButton.dataset.irSiteStudioV5Open = '1';
      rootButton.innerHTML = '<span class="ir-site-studio-v5-btn-dot"></span><span>' + escapeHtml(t('Web Studio', 'Студия сайта')) + '</span>';
      rootButton.setAttribute('aria-label', t('Open Web Studio', 'Открыть Студию сайта'));
      rootButton.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        openStudio();
      }, true);
      document.body.appendChild(rootButton);
    }
    var hasToolbarButton = !!findToolbarButton();
    rootButton.classList.toggle('is-visible', isEditorVisible() && !hasToolbarButton);
  }

  function execCommand(command, value) {
    try { document.execCommand(command, false, value || null); } catch (error) { log('execCommand failed', command, error); }
  }

  function updateActivePage(partial, rerender) {
    var state = readState();
    var page = activePage(state);
    Object.keys(partial || {}).forEach(function (key) { page[key] = partial[key]; });
    /* H1 is visible content only. It must not rename the page or force SEO заголовок. */
    page.updatedAt = new Date().toISOString();
    writeState(state);
    return state;
  }

  function prepareNewEditablePage(page) {
    page.title = '';
    page.menuLabel = '';
    page.headline = '';
    page.summary = '';
    page.seoTitle = '';
    page.seoDescription = '';
    page.type = 'page';
    page.pagePreset = 'blank';
    page.__preview4CleanNewPage = true;
    return page;
  }

  function createPage() {
    var state = readState();
    var title = t('New site page', 'Новая страница сайта');
    var existing = state.pages.filter(function (page) { return String(page.pageName || page.title || '').indexOf(title) === 0; }).length;
    if (existing) title += ' ' + (existing + 1);
    var page = prepareNewEditablePage(defaultPage(title, ensureUniqueSlug(state, title), 'draft'));
    page.inMenu = true;
    page.inFooter = false;
    page.order = state.pages.filter(function (item) { return !item.parentId; }).length;
    state.pages.push(page);
    state.activePageId = page.id;
    writeState(state);
    activeTab = 'page';
    collapsedRight = false;
    renderStudio();
  }

  function createChildPage(parentId) {
    var state = readState();
    var parent = (state.pages || []).find(function (item) { return item.id === parentId; });
    if (!parent) return;
    var baseTitle = t('New subpage', 'Новая подстраница');
    var existing = state.pages.filter(function (page) { return String(page.pageName || page.title || '').indexOf(baseTitle) === 0; }).length;
    var title = existing ? baseTitle + ' ' + (existing + 1) : baseTitle;
    var page = prepareNewEditablePage(defaultPage(title, ensureUniqueSlug(state, title), 'draft'));
    page.parentId = parent.id;
    page.inMenu = true;
    page.inFooter = false;
    page.order = state.pages.filter(function (item) { return item.parentId === parent.id; }).length;
    state.pages.push(page);
    state.activePageId = page.id;
    writeState(state);
    activeTab = 'page';
    collapsedRight = false;
    renderStudio();
  }

  function deletePage(pageId) {
    var state = readState();
    if (state.pages.length <= 1) {
      alert(t('Keep at least one page.', 'Нужно оставить хотя бы одну страницу.'));
      return;
    }
    var page = state.pages.find(function (item) { return item.id === pageId; });
    var question = t('Delete page?', 'Удалить страницу?') + ' ' + (page ? page.title : '');
    if (window.confirm && !window.confirm(question)) return;
    state.pages = state.pages.filter(function (item) { return item.id !== pageId; });
    state.pages.forEach(function (item) { if (item.parentId === pageId) item.parentId = ''; });
    removePageFromMenus(state, pageId);
    if (state.activePageId === pageId) state.activePageId = state.pages[0].id;
    writeState(state);
    renderStudio();
  }

  function resetTestСтраницы() {
    if (window.confirm && !window.confirm(t('Reset Web Studio pages and start clean?', 'Сбросить страницы Студии сайта и начать чисто?'))) return;
    writeState(initialState());
    activeTab = 'page';
    renderStudio();
  }

  function movePage(pageId, delta) {
    var state = readState();
    var page = (state.pages || []).find(function (item) { return item.id === pageId; });
    if (!page) return;
    var parentId = page.parentId || '';
    var siblings = state.pages.filter(function (item) { return (item.parentId || '') === parentId; })
      .sort(function (a, b) { return Number(a.order || 0) - Number(b.order || 0); });
    var index = siblings.findIndex(function (item) { return item.id === pageId; });
    var next = index + delta;
    if (index < 0 || next < 0 || next >= siblings.length) return;
    var tmp = siblings[index];
    siblings[index] = siblings[next];
    siblings[next] = tmp;
    siblings.forEach(function (item, order) { item.order = order; });
    writeState(state);
    activeTab = 'pages';
    renderStudio();
  }

  function logoShapeRadius(shape) {
    var key = String(shape || 'rounded').toLowerCase();
    if (key === 'square') return 0;
    if (key === 'circle' || key === 'round') return 110;
    return 58;
  }

  function logoCssRadius(shape) {
    var key = String(shape || 'rounded').toLowerCase();
    if (key === 'square') return '6px';
    if (key === 'circle' || key === 'round') return '999px';
    return '16px';
  }

  function logoShapeOptions(selected) {
    var current = String(selected || 'rounded');
    var options = [
      ['square', t('Square', 'Квадрат')],
      ['rounded', t('Rounded', 'Скруглённый')],
      ['circle', t('Round', 'Круглый')]
    ];
    return options.map(function (item) {
      return '<option value="' + escapeHtml(item[0]) + '"' + (current === item[0] ? ' selected' : '') + '>' + escapeHtml(item[1]) + '</option>';
    }).join('');
  }

  function logoWeightOptions(selected) {
    var current = String(selected || '900');
    var options = [
      ['700', t('Bold', 'Жирный') + ' 700'],
      ['800', t('Extra bold', 'Очень жирный') + ' 800'],
      ['900', t('Black', 'Чёрный') + ' 900'],
      ['950', t('Heavy', 'Мощный') + ' 950']
    ];
    return options.map(function (item) {
      return '<option value="' + escapeHtml(item[0]) + '"' + (current === item[0] ? ' selected' : '') + '>' + escapeHtml(item[1]) + '</option>';
    }).join('');
  }

  function faviconWeightOptions(selected) {
    var current = String(selected || '950');
    var options = [
      ['800', t('Extra bold', 'Очень жирный') + ' 800'],
      ['900', t('Black', 'Чёрный') + ' 900'],
      ['950', t('Heavy', 'Мощный') + ' 950']
    ];
    return options.map(function (item) {
      return '<option value="' + escapeHtml(item[0]) + '"' + (current === item[0] ? ' selected' : '') + '>' + escapeHtml(item[1]) + '</option>';
    }).join('');
  }

  function fieldMiniInput(field, label, value, maxLength) {
    return '<label class="ir-site-studio-v5-compact-field"><span>' + escapeHtml(label) + '</span><input class="ir-site-studio-v5-input" data-v5-site-field="' + escapeHtml(field) + '" maxlength="' + (maxLength || 3) + '" autocapitalize="characters" spellcheck="false" style="text-transform:uppercase" value="' + escapeHtml(value || '') + '"></label>';
  }

  function fieldMiniSelect(field, label, optionsHtml) {
    return '<label class="ir-site-studio-v5-compact-field"><span>' + escapeHtml(label) + '</span><select class="ir-site-studio-v5-select" data-v5-site-field="' + escapeHtml(field) + '">' + optionsHtml + '</select></label>';
  }

  function logoFontSizeForLetters(letters) {
    letters = normalizeLogoLetters(letters || 'PS', 'Project Studio');
    if (letters.length <= 1) return 124;
    if (letters.length === 2) return 108;
    return 86;
  }

  function safeLogoFontSize(site) {
    return logoFontSizeForLetters(site && (site.logoLetters || initialsFromName(site.name)) || 'PS');
  }

  function logoHeaderSizePx(value) {
    return String(value || 'normal') === 'large' ? 60 : 50;
  }

  function logoHeaderFontSizePx(letters, sizeValue) {
    var size = logoHeaderSizePx(sizeValue);
    var count = normalizeLogoLetters(letters || 'PS', 'Project Studio').length;
    var ratio = count <= 1 ? 0.68 : (count === 2 ? 0.58 : 0.46);
    return Math.max(24, Math.round(size * ratio));
  }

  function logoHeaderSizeOptions(selected) {
    var current = String(selected || 'normal');
    var options = [
      ['normal', t('Normal', 'Обычный')],
      ['large', t('Large', 'Крупный')]
    ];
    return options.map(function (item) {
      return '<option value="' + escapeHtml(item[0]) + '"' + (current === item[0] ? ' selected' : '') + '>' + escapeHtml(item[1]) + '</option>';
    }).join('');
  }

  function logoFontFamily(site) {
    return fontStack(site && (site.logoFont || site.headingFont || site.fontFamily) || 'Inter');
  }

  function faviconFontFamily(site) {
    return fontStack(site && (site.faviconFont || site.logoFont || site.headingFont || site.fontFamily) || 'Inter');
  }

  function iconLettersFromSite(site) {
    site = site || {};
    var raw = String(site.icon || '').trim();
    if (/[0-9A-Za-zА-Яа-яЁё]/.test(raw)) return normalizeLogoLetters(raw, site.name || 'Project Studio');
    return '';
  }

  // IRGEZTNE_IDENTITY_LOOSE_LOGO_FAVICON_V069E
  function normalizeLooseLogoLettersV069E(value) {
    return String(value || '').replace(/\s+/g, '').slice(0, 3);
  }

  /* IRGEZTNE_IDENTITY_SPLIT_V073B */
  function faviconLetters(site) {
    site = site || {};
    function cleanLetters(value, max) {
      return String(value || '')
        .toUpperCase()
        .replace(/[^0-9A-ZА-ЯЁ]/gi, '')
        .slice(0, max || 2);
    }

    var letters = cleanLetters(
      site.faviconLetters ||
      site.faviconText ||
      site.faviconSymbol ||
      site.faviconIcon ||
      '',
      2
    );

    /*
       IRGEZTNE_FAVICON_LETTERS_ONLY_V084U
       site.icon is a local Sites-manager marker only.
       Empty favicon override follows the website logo.
    */
    if (!letters) letters = cleanLetters(site.logoLetters, 2);
    if (!letters) letters = cleanLetters(initialsFromName(site.name || 'Project Studio'), 2);

    return letters || 'PS';
  }

  function faviconFontSizeForLetters(letters) {
    var count = String(letters || '').length;
    if (count <= 1) return 214;
    return 178;
  }

  function faviconLetterSpacingForLetters(letters) {
    var count = String(letters || '').length;
    if (count <= 1) return 0;
    return -16;
  }

  function faviconShapeRadius(shape) {
    var key = String(shape || 'rounded').toLowerCase();
    if (key === 'square') return 0;
    if (key === 'circle' || key === 'round') return 128;
    return 70;
  }

  function svgFavicon(site, size) {
    site = site || {};
    var lettersRaw = faviconLetters(site);
    var letters = escapeHtml(lettersRaw);
    var logoBg = escapeHtml(site.faviconBackgroundColor || site.logoBackgroundColor || site.accentColor || '#2f7be6');
    var logoText = escapeHtml(site.faviconTextColor || site.logoTextColor || '#ffffff');
    var radius = faviconShapeRadius(site.faviconShape || site.logoShape || 'rounded');
    var label = escapeHtml((site.name || 'Project Studio') + ' favicon');
    var n = size || 256;
    var fontSize = faviconFontSizeForLetters(lettersRaw);
    var fontFamily = escapeHtml(faviconFontFamily(site));
    var weight = escapeHtml(site.faviconWeight || '950');
    var spacing = faviconLetterSpacingForLetters(lettersRaw);
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + n + '" height="' + n + '" viewBox="0 0 256 256" role="img" aria-label="' + label + '"><rect x="0" y="0" width="256" height="256" rx="' + radius + '" fill="' + logoBg + '"/><text x="128" y="135" text-anchor="middle" dominant-baseline="middle" font-family="' + fontFamily + '" font-size="' + fontSize + '" font-weight="' + weight + '" fill="' + logoText + '" letter-spacing="' + spacing + '" style="paint-order:stroke;stroke:rgba(0,0,0,0);stroke-width:0">' + letters + '</text></svg>';
  }

  function svgLogo(site, size) {
    site = site || {};
    var letters = escapeHtml(normalizeLooseLogoLettersV069E(site.logoLetters || ''));
    var logoBg = escapeHtml(site.logoBackgroundColor || site.accentColor || '#2f7be6');
    var logoText = escapeHtml(site.logoTextColor || '#ffffff');
    var radius = logoShapeRadius(site.logoShape || site.faviconShape || 'rounded');
    var label = escapeHtml(site.name || 'Project Studio');
    var n = size || 256;
    var fontSize = safeLogoFontSize(site);
    var fontFamily = escapeHtml(logoFontFamily(site));
    var weight = escapeHtml(site.logoWeight || '900');
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + n + '" height="' + n + '" viewBox="0 0 256 256" role="img" aria-label="' + label + '"><rect x="18" y="18" width="220" height="220" rx="' + radius + '" fill="' + logoBg + '"/><circle cx="74" cy="58" r="42" fill="rgba(255,255,255,.20)"/><text x="128" y="148" text-anchor="middle" dominant-baseline="middle" font-family="' + fontFamily + '" font-size="' + fontSize + '" font-weight="' + weight + '" fill="' + logoText + '">' + letters + '</text></svg>';
  }

  function dataUrlSvg(svg) {
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  function dataUrlToBase64(dataUrl) {
    return String(dataUrl || '').replace(/^data:[^,]+,/, '');
  }

  function bytesToBase64(bytes) {
    var chunk = '';
    var output = '';
    for (var i = 0; i < bytes.length; i += 0x8000) {
      chunk = String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
      output += chunk;
    }
    return btoa(output);
  }

  function base64ToBytes(base64) {
    var binary = atob(String(base64 || ''));
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  function writeUInt16LE(bytes, offset, value) {
    bytes[offset] = value & 255;
    bytes[offset + 1] = (value >> 8) & 255;
  }

  function writeUInt32LE(bytes, offset, value) {
    bytes[offset] = value & 255;
    bytes[offset + 1] = (value >> 8) & 255;
    bytes[offset + 2] = (value >> 16) & 255;
    bytes[offset + 3] = (value >> 24) & 255;
  }

  function pngImagesToIcoBase64(entries) {
    entries = (entries || []).filter(function (entry) { return entry && entry.base64 && entry.size; });
    if (!entries.length) return '';
    var count = entries.length;
    var directorySize = 6 + count * 16;
    var payloadLength = entries.reduce(function (sum, entry) { return sum + base64ToBytes(entry.base64).length; }, 0);
    var bytes = new Uint8Array(directorySize + payloadLength);
    writeUInt16LE(bytes, 0, 0);
    writeUInt16LE(bytes, 2, 1);
    writeUInt16LE(bytes, 4, count);
    var dataOffset = directorySize;
    entries.forEach(function (entry, index) {
      var pngBytes = base64ToBytes(entry.base64);
      var dir = 6 + index * 16;
      bytes[dir] = entry.size >= 256 ? 0 : entry.size;
      bytes[dir + 1] = entry.size >= 256 ? 0 : entry.size;
      bytes[dir + 2] = 0;
      bytes[dir + 3] = 0;
      writeUInt16LE(bytes, dir + 4, 1);
      writeUInt16LE(bytes, dir + 6, 32);
      writeUInt32LE(bytes, dir + 8, pngBytes.length);
      writeUInt32LE(bytes, dir + 12, dataOffset);
      bytes.set(pngBytes, dataOffset);
      dataOffset += pngBytes.length;
    });
    return bytesToBase64(bytes);
  }

  function pngBase64ToIcoBase64(pngBase64, size) {
    return pngImagesToIcoBase64([{ base64: pngBase64, size: size }]);
  }

  function roundedRectPath(ctx, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, Math.min(w, h) / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function logoPngBase64(site, size) {
    try {
      site = site || {};
      var n = size || 256;
      var canvas = document.createElement('canvas');
      canvas.width = n;
      canvas.height = n;
      var ctx = canvas.getContext('2d');
      var scale = n / 256;
      ctx.clearRect(0, 0, n, n);
      roundedRectPath(ctx, 18 * scale, 18 * scale, 220 * scale, 220 * scale, logoShapeRadius(site.logoShape || site.faviconShape || 'rounded') * scale);
      ctx.fillStyle = site.logoBackgroundColor || site.accentColor || '#2f7be6';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(74 * scale, 58 * scale, 42 * scale, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,.20)';
      ctx.fill();
      ctx.fillStyle = site.logoTextColor || '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = String(site.logoWeight || '900') + ' ' + (safeLogoFontSize(site) * scale) + 'px ' + logoFontFamily(site);
      ctx.fillText(normalizeLogoLetters(site.logoLetters || initialsFromName(site.name), site.name), 128 * scale, 148 * scale);
      return dataUrlToBase64(canvas.toDataURL('image/png'));
    } catch (error) {
      log('Logo PNG generation failed', error);
      return '';
    }
  }

  function faviconPngBase64(site, size) {
    try {
      site = site || {};
      var n = size || 256;
      var canvas = document.createElement('canvas');
      canvas.width = n;
      canvas.height = n;
      var ctx = canvas.getContext('2d');
      var scale = n / 256;
      var shapeRadius = faviconShapeRadius(site.faviconShape || site.logoShape || 'rounded') * scale;
      ctx.clearRect(0, 0, n, n);
      roundedRectPath(ctx, 0, 0, n, n, shapeRadius);
      ctx.fillStyle = site.faviconBackgroundColor || site.logoBackgroundColor || site.accentColor || '#2f7be6';
      ctx.fill();
      ctx.fillStyle = site.faviconTextColor || site.logoTextColor || '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      var letters = faviconLetters(site);
      ctx.font = String(site.faviconWeight || '950') + ' ' + (faviconFontSizeForLetters(letters) * scale) + 'px ' + faviconFontFamily(site);
      ctx.fillText(letters, n / 2, n * 0.53);
      return dataUrlToBase64(canvas.toDataURL('image/png'));
    } catch (error) {
      log('Favicon PNG generation failed', error);
      return '';
    }
  }

  function faviconHeadTags() {
    return '<link rel="icon" type="image/svg+xml" href="favicon.svg">' +
      '<link rel="icon" type="image/png" sizes="32x32" href="favicon-32x32.png">' +
      '<link rel="icon" type="image/png" sizes="16x16" href="favicon-16x16.png">' +
      '<link rel="shortcut icon" href="favicon.ico">' +
      '<link rel="apple-touch-icon" sizes="180x180" href="apple-touch-icon.png">' +
      '<link rel="manifest" href="site.webmanifest">';
  }

  function faviconInstallSnippet() {
    return '<link rel="icon" type="image/svg+xml" href="/favicon.svg">\n' +
      '<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">\n' +
      '<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">\n' +
      '<link rel="shortcut icon" href="/favicon.ico">\n' +
      '<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">\n' +
      '<link rel="manifest" href="/site.webmanifest">';
  }

  function createFaviconPackage(site) {
    site = site || {};
    var svg = svgFavicon(site, 256);
    var png16 = faviconPngBase64(site, 16);
    var png32 = faviconPngBase64(site, 32);
    var png180 = faviconPngBase64(site, 180);
    var png192 = faviconPngBase64(site, 192);
    var png512 = faviconPngBase64(site, 512);
    var files = {
      'favicon.svg': svg,
      'site.webmanifest': JSON.stringify({
        name: site.name || 'IRGEZTNE site',
        short_name: normalizeLogoLetters(site.logoLetters || initialsFromName(site.name || 'IRGEZTNE'), site.name || 'IRGEZTNE'),
        icons: [
          { src: 'android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'android-chrome-512x512.png', sizes: '512x512', type: 'image/png' }
        ],
        theme_color: site.accentColor || site.logoBackgroundColor || '#2f7be6',
        background_color: site.backgroundColor || '#ffffff',
        display: 'standalone'
      }, null, 2)
    };
    if (png16) files['favicon-16x16.png'] = { contentBase64: png16, mimeType: 'image/png' };
    if (png32) files['favicon-32x32.png'] = { contentBase64: png32, mimeType: 'image/png' };
    try {
      var icoEntries = [];
      if (png16) icoEntries.push({ base64: png16, size: 16 });
      if (png32) icoEntries.push({ base64: png32, size: 32 });
      if (icoEntries.length) files['favicon.ico'] = { contentBase64: pngImagesToIcoBase64(icoEntries), mimeType: 'image/x-icon' };
    } catch (error) { log('ICO generation failed', error); }
    if (png180) files['apple-touch-icon.png'] = { contentBase64: png180, mimeType: 'image/png' };
    if (png192) files['android-chrome-192x192.png'] = { contentBase64: png192, mimeType: 'image/png' };
    if (png512) files['android-chrome-512x512.png'] = { contentBase64: png512, mimeType: 'image/png' };
    return files;
  }

  function updateIdentityLogoPreview(site) {
    var img = overlay && overlay.querySelector('.ir-site-studio-v5-logo-tile img');
    if (img) img.src = dataUrlSvg(svgLogo(site || {}, 256));
    var fav = overlay && overlay.querySelector('.ir-site-studio-v5-favicon-tile img');
    if (fav) fav.src = dataUrlSvg(svgFavicon(site || {}, 256));
  }

  async function downloadFaviconPack() {
    var state = readState();
    var pack = createFaviconPackage(state.site || {});
    pack['README.txt'] = t('Favicon pack generated by IRGEZTNE Web Studio. For this Web Studio site these files are added automatically during preview, export and publishing. Use this pack only if you want to install the favicon on another website.\n\nPlace the files in the root folder of that website and add these tags inside <head>:\n\n', 'Favicon-комплект создан IRGEZTNE Web Studio. Для этого сайта Web Studio эти файлы добавляются автоматически при предпросмотре, экспорте и публикации. Используйте этот комплект только если хотите установить favicon на другом сайте.\n\nПоложите файлы в корень другого сайта и добавьте эти теги внутри <head>:\n\n') + faviconInstallSnippet() + '\n';
    var api = window.nsAPI || null;
    if (api && typeof api.exportSiteZip === 'function') {
      try {
        await api.exportSiteZip({ title: 'IRGEZTNE favicon pack', slug: 'favicon-pack', fileName: 'favicon-pack.zip', package: Object.assign({ 'index.html': '<!doctype html><html><head>' + faviconHeadTags() + '</head><body><h1>Favicon pack</h1></body></html>', 'styles.css': '', 'content/page.json': '{}', 'meta.json': '{}' }, pack) });
        return;
      } catch (error) {
        log('Favicon pack export failed', error);
      }
    }
    downloadText('favicon.svg', svgFavicon(state.site || {}, 256), 'image/svg+xml;charset=utf-8');
    try { alert(t('ZIP export is unavailable. SVG favicon was downloaded instead.', 'ZIP export недоступен. Вместо комплекта скачан SVG favicon.')); } catch (error2) {}
  }

  function readSelectedOfficialTemplateV5() {
    try {
      var raw = localStorage.getItem('irgeztne.preview4.selectedOfficialTemplate.v1');
      var data = raw ? JSON.parse(raw) : null;
      return data && data.template ? data.template : null;
    } catch (error) {
      return null;
    }
  }

  // IRGEZTNE_OFFICIAL_TEMPLATES_V068A
  function templateVariantV5(template) {
    var id = String((template && template.id) || 'project-landing').toLowerCase();
    if (id.indexOf('documentation') !== -1 || id.indexOf('docs') !== -1 || id.indexOf('knowledge') !== -1) return 'documentation';
    if (id.indexOf('portfolio') !== -1) return 'portfolio';
    if (id.indexOf('business') !== -1 || id.indexOf('product') !== -1) return 'business';
    if (id.indexOf('agency') !== -1 || id.indexOf('studio') !== -1) return 'agency';
    if (id.indexOf('blog') !== -1 || id.indexOf('news') !== -1 || id.indexOf('portal') !== -1) return 'news';
    return 'landing';
  }

  function templateAccentV5(template, site) {
    var variant = templateVariantV5(template);

    if (site && site.accentColor) return site.accentColor;
    if (variant === 'documentation') return '#2563eb';
    if (variant === 'portfolio') return '#8b5cf6';
    if (variant === 'business') return '#0f766e';
    if (variant === 'agency') return '#7c3aed';
    if (variant === 'news') return '#dc2626';
    return '#2f7be6';
  }

  function selectedTemplateTitleV5(template) {
    if (!template) return t('Modern Landing', 'Modern Landing');
    return t(template.title || template.titleRu || 'Modern Landing', template.titleRu || template.title || 'Modern Landing');
  }


  function siteThemeLangCode() {
    return t('en', 'ru');
  }

  function currentSitePublicBaseUrl(state) {
    try {
      var settings = normalizePublishSettings((state.site || {}).publishSettings || {});
      var order = [settings.selectedProvider, 'netlify', 'vercel', 'cloudflare', 'github', 'gitlab', 'manual', 'ftp', 'sftp'].filter(Boolean);
      var seen = {};
      for (var i = 0; i < order.length; i += 1) {
        var id = order[i];
        if (seen[id]) continue;
        seen[id] = true;
        var config = settings.providers && settings.providers[id] ? settings.providers[id] : null;
        var url = config && config.websiteUrl ? String(config.websiteUrl).trim() : '';
        if (/^https?:\/\//i.test(url)) return url.replace(/\/+$/, '');
      }
    } catch (error) {}
    return '';
  }

  function absolutePageUrl(state, page) {
    var base = currentSitePublicBaseUrl(state);
    var fileName = pageFileName(page || findHomePage(state) || {});
    if (!base) return fileName === 'index.html' ? '/' : fileName;
    return base + '/' + (fileName === 'index.html' ? '' : fileName);
  }

  function siteMetaDescription(state, page, fallback) {
    var site = state.site || {};
    var value = String((page && (page.seoDescription || page.summary)) || site.description || site.tagline || fallback || '').trim();
    return value || t('A website created with IRGEZTNE Web Studio.', 'Сайт, созданный в IRGEZTNE Web Studio.');
  }

  function siteMetaTitle(state, page, fallbackTitle) {
    var site = state.site || {};
    var siteName = site.name || 'Project Studio';
    var value = String((page && page.seoTitle) || '').trim();
    if (value) return value;
    return siteName + ' · ' + String(fallbackTitle || pageLabel(page) || t('Page', 'Страница'));
  }

  function menuGroupByPosition(state, position) {
    ensureMenuGroups(state);
    var groups = Array.isArray(state.menuGroups) ? state.menuGroups : [];
    return groups.find(function (group) { return group && group.position === position; }) || null;
  }

  function menuItemsForPosition(state, position) {
    var group = menuGroupByPosition(state, position);
    if (!group || !Array.isArray(group.items)) return [];
    return group.items.slice().filter(function (item) {
      if (!item) return false;
      if (item.type === 'external' || item.type === 'social') return !!String(item.url || '').trim();
      return !!item.pageId;
    }).sort(function (a, b) { return Number(a.order || 0) - Number(b.order || 0); });
  }

  function footerPageLinkHtml(page, linkMode) {
    var href = linkMode === 'hash' ? ('#' + (page.slug || 'page')) : pageFileName(page);
    return '<a class="footer-service-link" href="' + escapeHtml(href) + '">' + escapeHtml(pageLabel(page)) + '</a>';
  }

  function footerNavHtml(state, linkMode) {
    var pages = orderedPageList(state).filter(function (page) { return page && page.inFooter === true; });
    if (!pages.length) return '';

    var buckets = {};
    pages.forEach(function (page) {
      var groupId = normalizeFooterGroup(page.footerGroup, page);
      if (!buckets[groupId]) buckets[groupId] = [];
      buckets[groupId].push(page);
    });

    return footerGroupDefinitions().filter(function (group) {
      return buckets[group.id] && buckets[group.id].length;
    }).map(function (group) {
      var links = buckets[group.id].map(function (page) {
        return footerPageLinkHtml(page, linkMode);
      }).join('');
      return '<section class="footer-column footer-column--' + escapeHtml(group.id) + '"><h2 class="footer-title">' + escapeHtml(t(group.en, group.ru)) + '</h2><nav class="footer-links" aria-label="' + escapeHtml(t(group.en, group.ru)) + '">' + links + '</nav></section>';
    }).join('');
  }

  function footerSocialHtml(state, linkMode) {
    /* Social links are postponed after 1.0.0; no rough text-only social block in the footer. */
    return '';
  }

  function generatedSiteCssV5() {
    return [
      '*{box-sizing:border-box}',
      'html{scroll-behavior:smooth}',
      'body{margin:0;font-family:var(--font-body);color:var(--ink);background:var(--site-bg);transition:background .18s ease,color .18s ease}',
      'body[data-theme="dark"]{--ink:#eef6ff;--muted:#a9bad2;--line:rgba(148,163,184,.28);--site-bg:#07111f;--panel-bg:rgba(15,31,53,.78);--panel-strong:rgba(18,38,64,.92);--soft-bg:rgba(255,255,255,.06);--shadow:0 32px 90px rgba(0,0,0,.34)}',
      'body[data-theme="light"]{--panel-bg:rgba(255,255,255,.74);--panel-strong:#fff;--soft-bg:rgba(255,255,255,.78);--shadow:0 32px 90px rgba(15,23,42,.12)}',
      '.page{width:min(1680px,calc(100vw - 48px));margin:0 auto;padding:26px 0 52px}',
      '.site-header{display:flex;align-items:center;justify-content:space-between;gap:24px;padding:16px 0;border-bottom:1px solid var(--line)}',
      '.brand{display:flex;align-items:center;gap:12px;min-width:220px;text-decoration:none;color:inherit}',
      '.logo{width:var(--logo-size);height:var(--logo-size);border-radius:var(--logo-radius);display:grid;place-items:center;background:var(--logo-bg);color:var(--logo-text);font-family:var(--font-heading);font-size:var(--logo-header-font-size);font-weight:900;line-height:1;letter-spacing:-.04em;box-shadow:inset 0 1px 0 rgba(255,255,255,.18)}',
      '.brand strong{display:block;font-size:18px;line-height:1.1}.brand span{display:block;color:var(--muted);font-size:13px;margin-top:3px}',
      '.site-nav{display:flex;align-items:center;justify-content:flex-end;gap:10px;flex-wrap:wrap;margin-left:auto}.nav-parent{position:relative;display:inline-flex;align-items:center}',
      '.nav-link{display:inline-flex;align-items:center;gap:6px;min-height:36px;padding:8px 13px;border-radius:999px;border:1px solid color-mix(in srgb,var(--nav-accent) 18%,transparent);background:var(--soft-bg);color:var(--nav-accent);font-weight:900;text-decoration:none;transition:transform .16s ease,box-shadow .16s ease,background .16s ease,color .16s ease,border-color .16s ease,filter .16s ease}',
      '.nav-link:hover{transform:translateY(-1px);box-shadow:0 10px 24px rgba(15,23,42,.12);background:var(--button-accent);color:white;border-color:transparent}.nav-link.is-active{background:var(--nav-accent);color:white;border-color:transparent}.nav-link.is-active:hover{background:var(--button-accent);color:white;border-color:transparent;filter:brightness(1.05)}.nav-caret{font-size:12px;opacity:.82}',
      '.submenu{display:flex;flex-direction:column;align-items:flex-end;gap:7px;position:absolute;right:0;left:auto;top:calc(100% + 7px);min-width:max-content;margin:0;padding:0;background:transparent;border:0;box-shadow:none;border-radius:0;z-index:50;opacity:0;visibility:hidden;transform:translateY(2px);pointer-events:none;transition:opacity .11s ease,transform .11s ease,visibility .11s ease}.submenu:before{content:"";position:absolute;left:0;right:0;top:-10px;height:10px}.submenu a{display:flex;align-items:center;justify-content:center;min-height:34px;padding:8px 13px;border-radius:999px;border:1px solid color-mix(in srgb,var(--nav-accent) 18%,transparent);background:var(--soft-bg);color:var(--nav-accent);font-weight:900;text-decoration:none;white-space:nowrap;outline:none;box-shadow:none}.submenu a:hover,.submenu a.is-active-child{background:var(--button-accent);border-color:transparent;color:white;box-shadow:0 8px 20px rgba(15,23,42,.10)}body[data-theme="dark"] .submenu a{background:rgba(255,255,255,.05);border-color:rgba(148,163,184,.22);color:#cfe5ff}body[data-theme="dark"] .submenu a:hover,body[data-theme="dark"] .submenu a.is-active-child{background:var(--button-accent);border-color:transparent;color:white}.nav-parent:hover .submenu,.nav-parent:focus-within .submenu{opacity:1;visibility:visible;transform:translateY(0);pointer-events:auto}',
      '.theme-toggle{display:inline-grid;place-items:center;border:1px solid var(--line);background:var(--panel-bg);color:var(--ink);border-radius:999px;width:36px;min-width:36px;height:36px;padding:0;font-size:16px;font-weight:900;line-height:1;cursor:pointer;transition:transform .16s ease,box-shadow .16s ease,background .16s ease}.theme-toggle:hover{transform:translateY(-1px);box-shadow:0 10px 24px rgba(15,23,42,.12);background:var(--soft-bg)}',
      '.hero{display:grid;grid-template-columns:minmax(0,1fr);gap:24px;align-items:center;padding:58px 0 40px}.kicker{letter-spacing:.14em;text-transform:uppercase;color:var(--button-accent);font-weight:900;font-size:13px}',
      '/* IRGEZTNE_SITE_STICKY_HEADER_V069D */.site-header{position:sticky;top:0;z-index:80;padding-top:14px;padding-bottom:14px;background:color-mix(in srgb,var(--bg,#ffffff) 88%,transparent);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px)}.site-header:after{content:"";position:absolute;left:0;right:0;bottom:-1px;height:1px;background:var(--line);opacity:.82}body[data-theme="dark"] .site-header{background:color-mix(in srgb,var(--bg,#07111f) 84%,rgba(2,6,23,.86))}body[data-theme="light"] .site-header{background:rgba(255,255,255,.88)}',
      'h1{font-family:var(--font-heading);font-size:clamp(44px,6vw,82px);line-height:.96;margin:14px 0 18px;letter-spacing:-.06em}.hero p{max-width:780px;font-size:20px;line-height:1.65;color:var(--muted);margin:0}',
      '.content{max-width:900px;margin:0 0 36px;padding:26px;border:1px solid var(--line);border-radius:26px;background:var(--panel-bg);box-shadow:var(--shadow)}.content p{font-size:18px;line-height:1.7;color:var(--muted);margin:0 0 14px}.content p:last-child{margin-bottom:0}',
      '.site-footer{margin-top:44px;padding:24px 0 0;border-top:1px solid var(--line);display:flex;flex-direction:column;align-items:stretch;gap:16px;color:var(--muted);font-size:14px}.site-footer.has-footer-links{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:start;column-gap:24px;row-gap:12px}.footer-brand{display:flex;flex-direction:column;align-items:flex-start;gap:3px}.footer-brand strong{color:var(--ink);font-size:14px;line-height:1.2}.footer-copy{color:var(--muted)}.footer-links{display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end;width:100%;padding-bottom:2px}.site-footer.has-footer-links .footer-links{grid-column:2;grid-row:1 / span 2;align-self:start;max-width:min(620px,62vw);padding-bottom:0}.footer-links a{display:inline-flex;align-items:center;min-height:32px;padding:7px 11px;border:1px solid color-mix(in srgb,var(--nav-accent) 22%,var(--line));border-radius:999px;background:var(--soft-bg);color:var(--nav-accent);font-weight:900;text-decoration:none;transition:transform .16s ease,box-shadow .16s ease,background .16s ease,color .16s ease,border-color .16s ease}.footer-links a:hover{transform:translateY(-1px);background:var(--button-accent);border-color:var(--button-accent);color:white;box-shadow:0 10px 24px rgba(15,23,42,.12)}body[data-theme="dark"] .footer-links a{background:rgba(255,255,255,.05);border-color:rgba(148,163,184,.28);color:#cfe5ff}body[data-theme="dark"] .footer-links a:hover{background:var(--button-accent);border-color:var(--button-accent);color:white}.footer-social-links{display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end;width:100%}.footer-social-links a{border:1px solid var(--line);border-radius:999px;padding:7px 10px;color:var(--muted);font-weight:900;text-decoration:none;background:var(--panel)}.footer-social-links a:hover{background:var(--button-accent);border-color:var(--button-accent);color:white}',
      '/* IRGEZTNE_WEBSTUDIO_FOOTER_SERVICE_PAGES_V058A IRGEZTNE_WEBSTUDIO_FOOTER_LINK_POLISH_V058C2 IRGEZTNE_WEBSTUDIO_FOOTER_LINK_SIZE_V058D */ IRGEZTNE_WEBSTUDIO_FOOTER_NO_UNDERLINE_V058B.site-footer.has-footer-links .footer-links{gap:10px 18px;align-items:flex-start}.site-footer.has-footer-links .footer-links a.footer-service-link,.site-footer.has-footer-links .footer-links a{min-height:auto;padding:0;border:0;border-radius:0;background:transparent;color:var(--muted);font-size:16px;line-height:1.55;font-weight:850;letter-spacing:.01em;text-decoration:none!important;box-shadow:none}.site-footer.has-footer-links .footer-links a.footer-service-link:hover,.site-footer.has-footer-links .footer-links a:hover{transform:none;background:transparent;color:var(--button-accent)!important;box-shadow:none;text-decoration:none!important;opacity:1}body[data-theme="dark"] .site-footer.has-footer-links .footer-links a.footer-service-link,body[data-theme="dark"] .site-footer.has-footer-links .footer-links a{background:transparent;border:0;color:#c2d1e7;text-decoration:none!important}body[data-theme="dark"] .site-footer.has-footer-links .footer-links a.footer-service-link:hover,body[data-theme="dark"] .site-footer.has-footer-links .footer-links a:hover{background:transparent;color:var(--button-accent)!important;text-decoration:none!important}',
      "/* IRGEZTNE_WEBSTUDIO_FOOTER_FOUNDATION_COLUMNS_V059A */.site-footer.has-footer-links{display:grid!important;grid-template-columns:minmax(260px,1fr) minmax(180px,auto)!important;align-items:start!important;column-gap:clamp(26px,6vw,90px)!important;row-gap:20px!important;padding-top:30px!important}.site-footer .footer-brand{display:flex!important;flex-direction:column!important;align-items:flex-start!important;gap:5px!important}.site-footer .footer-brand strong{font-size:17px!important;line-height:1.2!important;color:var(--ink)!important}.site-footer .footer-brand span{font-size:14px!important;line-height:1.45!important;color:var(--muted)!important}.site-footer .footer-copy{font-size:14px!important;color:var(--muted)!important}.footer-column{display:grid!important;gap:11px!important;justify-items:start!important;align-self:start!important}.footer-title{margin:0!important;color:var(--ink)!important;font-size:13px!important;line-height:1.2!important;font-weight:900!important;letter-spacing:.12em!important;text-transform:uppercase!important}.site-footer.has-footer-links .footer-links{display:grid!important;grid-auto-flow:row!important;gap:8px!important;justify-content:start!important;justify-items:start!important;width:auto!important;max-width:none!important;grid-column:auto!important;grid-row:auto!important;padding:0!important}.site-footer.has-footer-links .footer-links a.footer-service-link,.site-footer.has-footer-links .footer-links a{display:inline-flex!important;align-items:center!important;min-height:auto!important;padding:0!important;border:0!important;border-radius:0!important;background:transparent!important;color:var(--muted)!important;font-size:16px!important;line-height:1.45!important;font-weight:850!important;text-decoration:none!important;box-shadow:none!important;opacity:.96!important}.site-footer.has-footer-links .footer-links a.footer-service-link:hover,.site-footer.has-footer-links .footer-links a:hover{transform:none!important;background:transparent!important;color:var(--button-accent)!important;text-decoration:none!important;box-shadow:none!important;opacity:1!important}body[data-theme=\"dark\"] .footer-title{color:#eef6ff!important}body[data-theme=\"dark\"] .site-footer .footer-brand strong{color:#eef6ff!important}body[data-theme=\"dark\"] .site-footer.has-footer-links .footer-links a.footer-service-link,body[data-theme=\"dark\"] .site-footer.has-footer-links .footer-links a{color:#c2d1e7!important}body[data-theme=\"dark\"] .site-footer.has-footer-links .footer-links a.footer-service-link:hover,body[data-theme=\"dark\"] .site-footer.has-footer-links .footer-links a:hover{color:var(--button-accent)!important}@media(max-width:900px){.site-footer.has-footer-links{display:flex!important;flex-direction:column!important}.site-footer.has-footer-links .footer-links{display:flex!important;flex-wrap:wrap!important;gap:10px 18px!important}}",
      "/* IRGEZTNE_WEBSTUDIO_FOOTER_GROUPS_V059B2 */.site-footer.has-footer-links{grid-template-columns:minmax(260px,1fr) repeat(auto-fit,minmax(150px,190px))!important;align-items:start!important}.footer-column{min-width:140px!important}.footer-title{white-space:normal!important}.ir-site-studio-v5-mini-label{display:block;margin:10px 0 6px;color:var(--muted);font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:.08em}",
      '@media(max-width:900px){.site-header{align-items:flex-start;flex-direction:column}.site-nav{justify-content:flex-start;margin-left:0}.site-footer.has-footer-links{display:flex}.site-footer.has-footer-links .footer-links{max-width:none}.footer-links,.footer-social-links{justify-content:flex-start}.hero{padding-top:38px}}',
      '@media(max-width:620px){.page{width:min(100% - 28px,1680px)}h1{font-size:42px}.brand{min-width:0}.site-nav{gap:8px}.nav-link{min-height:34px;padding:7px 11px}.theme-toggle{width:34px;min-width:34px;height:34px}}'
    ].join('\n');
  }

  function generatedSiteJsV5() {
    return '(function(){\n' +
      '  var key="irgeztne.site.theme";\n' +
      '  function isRu(){return (document.documentElement.lang||"").toLowerCase().indexOf("ru")===0;}\n' +
      '  function label(theme){return theme==="dark"?(isRu()?"Светлый режим":"Light mode"):(isRu()?"Тёмный режим":"Dark mode");}\n' +
      '  function icon(theme){return theme==="dark"?"☀":"☾";}\n' +
      '  function apply(theme){document.body.setAttribute("data-theme",theme);document.querySelectorAll("[data-theme-toggle]").forEach(function(btn){var text=label(theme);btn.textContent=icon(theme);btn.setAttribute("aria-label",text);btn.setAttribute("title",text);});}\n' +
      '  var saved="light";try{saved=localStorage.getItem(key)||"light";}catch(e){}\n' +
      '  if(saved!=="dark") saved="light";\n' +
      '  apply(saved);\n' +
      '  document.addEventListener("click",function(event){var btn=event.target.closest&&event.target.closest("[data-theme-toggle]");if(!btn)return;var next=document.body.getAttribute("data-theme")==="dark"?"light":"dark";try{localStorage.setItem(key,next);}catch(e){}apply(next);});\n' +
      '})();\n';
  }


  // IRGEZTNE_SITE_SETTINGS_TO_GENERATOR_V067F
  function generatedSiteSettingV067F(site, path, fallback) {
    var settings = site && site.siteSettings ? site.siteSettings : {};
    var cursor = settings;
    String(path || '').split('.').forEach(function (part) {
      if (!part) return;
      cursor = cursor && Object.prototype.hasOwnProperty.call(cursor, part) ? cursor[part] : undefined;
    });
    return cursor == null || cursor === '' ? fallback : cursor;
  }

  function safeGeneratedRawHtmlV067F(html) {
    return String(html || '').replace(/<\/(script|style)/gi, '<\\/$1');
  }

  // IRGEZTNE_SITE_SETTINGS_CLEAR_TRIM_V067G
  function cleanGeneratedMetaTextV067G(text) {
    return String(text || '').replace(/\s+/g, ' ').trim();
  }

  function sitemapXmlV5(state) {
    var site = state && state.site ? state.site : {};
    if (generatedSiteSettingV067F(site, 'sitemap.enabled', true) === false) return '';
    var pages = orderedPageList(state).filter(Boolean);
    if (!pages.length && findHomePage(state)) pages = [findHomePage(state)];
    var base = currentSitePublicBaseUrl(state) || 'https://example.com';
    var now = new Date().toISOString();
    var urls = pages.map(function (page) {
      var file = pageFileName(page);
      var loc = base.replace(/\/+$/, '/') + (file === 'index.html' ? '' : file);
      return '  <url>\n    <loc>' + escapeHtml(loc) + '</loc>\n    <lastmod>' + escapeHtml(page.updatedAt || page.createdAt || now) + '</lastmod>\n  </url>';
    }).join('\n');
    return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls + '\n</urlset>\n';
  }

  function robotsTxtV5(state) {
    var site = state && state.site ? state.site : {};
    if (generatedSiteSettingV067F(site, 'robots.enabled', true) === false) return '';

    var base = currentSitePublicBaseUrl(state) || 'https://example.com';
    var noindex = !!generatedSiteSettingV067F(site, 'seo.noindex', false);
    var extra = String(generatedSiteSettingV067F(site, 'robots.extra', '') || '').trim();
    var sitemapEnabled = generatedSiteSettingV067F(site, 'sitemap.enabled', true) !== false;

    var out = 'User-agent: *\n' + (noindex ? 'Disallow: /\n' : 'Allow: /\n');
    if (extra) out += extra + '\n';
    if (sitemapEnabled) out += 'Sitemap: ' + base.replace(/\/+$/, '') + '/sitemap.xml\n';
    return out;
  }


  /* IRGEZTNE_OFFICIAL_TEMPLATE_RENDERER_V072A
     First real bridge: Web Studio data -> official Landing/Product renderer.
     Template Lab remains the visual reference; Web Studio keeps editable pages/data. */
  /* IRGEZTNE_TEMPLATE_ID_BRIDGE_V072C */
  function officialTemplateIdFromStateV072A(state) {
    var site = state && state.site || {};
    var values = [];

    function add(value) {
      if (!value) return;

      if (typeof value === 'string' || typeof value === 'number') {
        values.push(String(value));
        return;
      }

      if (typeof value === 'object') {
        [
          'id',
          'key',
          'slug',
          'value',
          'name',
          'title',
          'label',
          'type',
          'template',
          'templateId',
          'activeTemplate',
          'officialTemplateId'
        ].forEach(function (key) {
          if (value && value[key]) values.push(String(value[key]));
        });
      }
    }

    [
      site.templateId,
      site.template,
      site.activeTemplate,
      site.officialTemplateId,
      site.templateVariant,
      site.templateName,
      site.type,
      site.kind,
      site.description,
      site.tagline,
      state && state.templateId,
      state && state.template,
      state && state.activeTemplate,
      state && state.officialTemplateId,
      state && state.__irgeztneOfficialTemplateStarterV071A
    ].forEach(add);

    try {
      add(localStorage.getItem('irgeztne:selected-template'));
      add(localStorage.getItem('irgeztne:official-template'));
    } catch (_) {}

    var raw = values.join(' ').toLowerCase();
    var flat = raw.replace(/[\\/_\-]+/g, ' ');

    if (/landing\s*\/\s*product|landing product|product landing|project landing|modern landing|landing|лендинг|продуктовый лендинг/.test(flat)) return 'landing-product';
    if (/business\s*\/\s*product|business product|product business|business|бизнес|продукт/.test(flat)) return 'business-product';
    if (/portfolio\s*\/\s*personal|portfolio personal|portfolio|personal|портфолио|персональный/.test(flat)) return 'portfolio-personal';
    if (/agency\s*\/\s*studio|agency studio|agency|studio|агентство|студия/.test(flat)) return 'agency-studio';
    if (/blog\s*\/\s*news|blog news|blog|news|журнал|новости|блог/.test(flat)) return 'blog-news';
    if (/documentation|knowledge|docs|documentation wide|документация|знания/.test(flat)) return 'documentation';

    return '';
  }

  function pageBySlugV072A(state, slug) {
    var pages = Array.isArray(state && state.pages) ? state.pages : [];
    return pages.find(function (item) { return String(item && item.slug || '') === slug; }) || null;
  }

  function textPairV072A(value, fallbackEn, fallbackRu) {
    var current = String(value || '').trim();
    return { en: fallbackEn || current || '', ru: current || fallbackRu || fallbackEn || '' };
  }

  function langTextV072A(pair, lang) {
    pair = pair || {};
    return lang === 'en' ? (pair.en || pair.ru || '') : (pair.ru || pair.en || '');
  }

  function i18nSpanV072A(pair, className, tagName) {
    tagName = tagName || 'span';
    pair = pair || {};
    return '<' + tagName + (className ? ' class="' + escapeHtml(className) + '"' : '') + ' data-i18n-text="1" data-en="' + escapeHtml(pair.en || pair.ru || '') + '" data-ru="' + escapeHtml(pair.ru || pair.en || '') + '">' + escapeHtml(pair.ru || pair.en || '') + '</' + tagName + '>';
  }

  function landingCssV072A(accent) {
    return '' +
      ':root{--bg:#f4efe8;--paper:#fffaf2;--panel:#eee4d8;--ink:#101010;--muted:#665f58;--line:#dccfc1;--accent:' + accent + ';--shadow:0 28px 80px rgba(46,30,18,.14)}' +
      'html[data-theme="dark"]{--bg:#0b1013;--paper:#12191f;--panel:#18222a;--ink:#f7f0e8;--muted:#b7afa6;--line:#2c3843;--shadow:0 28px 80px rgba(0,0,0,.38)}' +
      '*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:radial-gradient(circle at 72% 8%,color-mix(in srgb,var(--accent) 18%,transparent),transparent 38%),var(--bg);color:var(--ink);font-family:Inter,system-ui,-apple-system,Segoe UI,Arial,sans-serif}' +
      'a{color:inherit;text-decoration:none}/* IRGEZTNE_LANDING_FULL_WIDTH_V086B *//* IRGEZTNE_LANDING_SINGLE_LANGUAGE_V086C */.page{width:100%;max-width:none;margin:0;padding:34px clamp(22px,2.2vw,44px) 54px}' +
      '/* IRGEZTNE_LANDING_HEADER_STRUCTURE_V072F */.site-header{position:sticky;top:0;z-index:80;display:flex;align-items:center;justify-content:space-between;gap:24px;width:100%;padding:18px clamp(22px,2.2vw,44px);border-bottom:1px solid var(--line);backdrop-filter:blur(18px);background:color-mix(in srgb,var(--bg) 94%,transparent);box-shadow:0 12px 38px rgba(16,16,16,.055)}' +
      '.brand{display:flex;align-items:center;gap:13px}.logo{width:54px;height:54px;border-radius:17px;display:grid;place-items:center;background:var(--ink);color:var(--bg);font-weight:950;font-size:22px}.brand strong{display:block;font-size:20px}.brand span{display:block;color:var(--muted);font-weight:700;font-size:13px}' +
      '.site-nav{display:flex;align-items:center;gap:10px;flex-wrap:wrap;justify-content:flex-end}.nav-link,.theme-toggle,.lang-toggle{border:1px solid var(--line);background:color-mix(in srgb,var(--paper) 74%,transparent);color:var(--ink);border-radius:999px;padding:11px 17px;font-weight:900;cursor:pointer}.nav-link.is-active,.nav-link:hover{background:var(--ink);color:var(--bg)}.theme-toggle,.lang-toggle{width:44px;height:44px;padding:0;display:grid;place-items:center}' +
      '.hero{display:grid;grid-template-columns:minmax(0,1fr) minmax(420px,.82fr);gap:28px;align-items:stretch;margin:0 0 30px}.hero-copy,.hero-visual,.section-card,.final-cta{border:1px solid var(--line);border-radius:32px;background:color-mix(in srgb,var(--paper) 82%,transparent);box-shadow:var(--shadow)}' +
      '.hero-copy{padding:52px 48px}.kicker{margin:0 0 18px;color:var(--accent);font-size:13px;font-weight:950;text-transform:uppercase;letter-spacing:.15em}.hero h1{margin:0 0 22px;font-size:clamp(48px,6.2vw,104px);line-height:.88;letter-spacing:-.075em}.hero p{margin:0;color:var(--muted);font-size:18px;line-height:1.7;max-width:760px}' +
      '.hero-actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:30px}.btn{border:1px solid var(--line);border-radius:999px;padding:14px 19px;font-weight:950;background:var(--ink);color:var(--bg)}.btn.secondary{background:transparent;color:var(--ink)}' +
      '.hero-visual{min-height:530px;overflow:hidden;position:relative;background:linear-gradient(135deg,color-mix(in srgb,var(--accent) 34%,#111),#101010)}.hero-visual:before{content:"";position:absolute;inset:28px;border:1px solid rgba(255,255,255,.32);border-radius:28px}.product-panel{position:absolute;inset:72px 44px auto 44px;border-radius:26px;background:rgba(255,255,255,.9);color:#111;padding:24px;box-shadow:0 35px 80px rgba(0,0,0,.25)}.product-panel h3{margin:0 0 14px;font-size:34px;letter-spacing:-.055em}.metric-row{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.metric{border-radius:18px;background:#f1ede7;padding:16px}.metric strong{display:block;font-size:28px}.visual-footer{position:absolute;left:44px;right:44px;bottom:42px;display:flex;gap:12px}.visual-pill{flex:1;border-radius:18px;background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.22);padding:18px;color:#fff;font-weight:900}' +
      '.strip{display:flex;gap:18px;align-items:center;justify-content:space-between;border:1px solid var(--line);border-radius:28px;padding:18px 24px;margin:0 0 26px;background:color-mix(in srgb,var(--paper) 72%,transparent)}.strip b{font-size:16px}.strip span{color:var(--muted);font-weight:700}' +
      '.section-head{display:grid;grid-template-columns:minmax(0,1fr) minmax(320px,.7fr);gap:28px;align-items:end;margin:54px 0 22px}.section-head h2{margin:0;font-size:clamp(36px,4.8vw,78px);line-height:.92;letter-spacing:-.065em}.section-head p{margin:0 0 8px;color:var(--muted);line-height:1.7}' +
      '.feature-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}.section-card{padding:26px}.section-card .num{color:var(--accent);font-weight:950;margin-bottom:42px}.section-card h3{margin:0 0 12px;font-size:28px;letter-spacing:-.04em}.section-card p{margin:0;color:var(--muted);line-height:1.65}' +
      '.scenario{display:grid;grid-template-columns:.78fr 1.22fr;gap:16px;margin-top:16px}.scenario .section-card:first-child{background:var(--ink);color:var(--bg)}.scenario .section-card:first-child p{color:color-mix(in srgb,var(--bg) 72%,transparent)}' +
      '.faq-list{display:grid;gap:10px}.faq-item{border:1px solid var(--line);border-radius:18px;background:color-mix(in srgb,var(--paper) 82%,transparent);padding:18px 20px}.faq-item strong{display:block;margin-bottom:8px}.faq-item p{margin:0;color:var(--muted);line-height:1.6}' +
      '.final-cta{margin-top:44px;padding:42px 44px;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:20px;align-items:center;background:var(--ink);color:var(--bg)}.final-cta .kicker{color:var(--accent)}.final-cta h2{margin:0 0 12px;font-size:clamp(36px,5vw,76px);line-height:.92;letter-spacing:-.07em}.final-cta p{margin:0;color:color-mix(in srgb,var(--bg) 72%,transparent);line-height:1.7}.final-cta .btn{background:var(--bg);color:var(--ink)}' +
      '.site-footer{margin-top:54px;padding-top:28px;border-top:1px solid var(--line);display:flex;justify-content:space-between;gap:20px;color:var(--muted)}.footer-brand strong{display:block;color:var(--ink)}.footer-copy{display:block;margin-top:8px}' +
      '/* IRGEZTNE_WEBSTUDIO_STABILITY_CORE_V074A */.ir-starter-section{max-width:980px;margin:0;padding:0}.ir-starter-section>p{max-width:760px}.ir-starter-kicker{margin:0 0 18px;font-size:14px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;opacity:.72}.ir-starter-section h2{margin:0 0 16px;font-size:clamp(28px,4.6vw,64px);line-height:.96;letter-spacing:-.055em}.ir-starter-list{display:grid;gap:10px;margin:24px 0 0;padding:0;list-style:none;max-width:760px}.ir-starter-list li{display:flex;gap:10px;align-items:baseline;padding:10px 12px;border:1px solid rgba(140,170,210,.22);border-radius:14px;background:rgba(70,120,190,.08)}.ir-starter-list li:before{content:"";width:7px;height:7px;flex:0 0 7px;margin-top:.55em;border-radius:999px;background:currentColor;opacity:.55}.ir-starter-list strong{font-weight:850;white-space:nowrap}.ir-starter-list strong:after{content:" —";opacity:.7;font-weight:650}.ir-starter-list span{opacity:.86}' +
      'html[lang="ru"] .hero h1{font-size:clamp(42px,5.35vw,86px);line-height:.91}html[lang="ru"] .section-head h2,html[lang="ru"] .final-cta h2{font-size:clamp(34px,4.3vw,66px);line-height:.94}' +
      '@media(max-width:980px){.page{padding:22px 18px 46px}.site-header{align-items:flex-start;flex-direction:column;padding:14px 18px}.hero,.section-head,.scenario,.final-cta{grid-template-columns:1fr}.hero-visual{min-height:430px}.feature-grid{grid-template-columns:1fr}.site-footer{flex-direction:column}}';
  }

  function landingJsV072A() {
    /* IRGEZTNE_LANDING_SITE_THEME_V089A
       One theme state across hosted pages and local file previews. */
    return [
      '(function(){',
      '/* IRGEZTNE_LANDING_SITE_THEME_V089A */',
      'var storageKey="irgeztne.site.theme";',
      'var activeTheme="light";',
      'function normalizeTheme(theme){return theme==="dark"?"dark":"light";}',
      'function setLang(lang){document.documentElement.lang=lang;document.querySelectorAll("[data-i18n-text]").forEach(function(el){var value=el.getAttribute("data-"+lang);if(value!==null)el.textContent=value;});}',
      'function themeIcon(theme){return theme==="dark"?"☀":"☾";}',
      'function themeLabel(theme){var ru=(document.documentElement.lang||"").toLowerCase().indexOf("ru")===0;return theme==="dark"?(ru?"Светлый режим":"Light mode"):(ru?"Тёмный режим":"Dark mode");}',
      'function themeFromUrl(){try{var value=new URL(window.location.href).searchParams.get("theme");return value==="dark"||value==="light"?value:"";}catch(error){return "";}}',
      'function themeFromStorage(){try{var value=localStorage.getItem(storageKey);return value==="dark"||value==="light"?value:"";}catch(error){return "";}}',
      'function saveTheme(theme){try{localStorage.setItem(storageKey,theme);}catch(error){}}',
      'function decorateInternalLinks(theme){document.querySelectorAll("a[href]").forEach(function(link){var raw=link.getAttribute("href")||"";if(!raw||raw.charAt(0)==="#"||/^(mailto:|tel:|javascript:|data:)/i.test(raw))return;try{var url=new URL(raw,window.location.href);var sameOrigin=url.origin===window.location.origin;var sameFile=window.location.protocol==="file:"&&url.protocol==="file:";if(!sameOrigin&&!sameFile)return;if(!/\\.html?$/i.test(url.pathname))return;url.searchParams.set("theme",theme);link.setAttribute("href",url.href);}catch(error){}});}',
      'function applyTheme(theme,persist){activeTheme=normalizeTheme(theme);document.documentElement.setAttribute("data-theme",activeTheme);if(persist)saveTheme(activeTheme);document.querySelectorAll("[data-theme-toggle]").forEach(function(btn){var label=themeLabel(activeTheme);btn.textContent=themeIcon(activeTheme);btn.setAttribute("aria-label",label);btn.setAttribute("title",label);});decorateInternalLinks(activeTheme);}',
      'var initialTheme=themeFromUrl()||themeFromStorage()||normalizeTheme(document.documentElement.getAttribute("data-theme"));',
      'applyTheme(initialTheme,true);',
      'document.addEventListener("DOMContentLoaded",function(){setLang(document.documentElement.lang==="en"?"en":"ru");applyTheme(activeTheme,false);});',
      'document.addEventListener("click",function(event){var toggle=event.target.closest&&event.target.closest("[data-theme-toggle]");if(!toggle)return;event.preventDefault();var next=activeTheme==="dark"?"light":"dark";applyTheme(next,true);});',
      'window.addEventListener("storage",function(event){if(event.key===storageKey&&(event.newValue==="dark"||event.newValue==="light"))applyTheme(event.newValue,false);});',
      '})();'
    ].join('');
  }

  function siteGeneratedEditorContentCssV076C() {
    return '' +
      'main figure.ir-site-studio-v5-content-image{max-width:100%;clear:both;margin:28px 0}' +
      'main figure.ir-site-studio-v5-content-image img{display:block;width:100%;max-width:100%;height:auto;border-radius:18px;object-fit:contain}' +
      'main figure.ir-site-studio-v5-content-image figcaption{margin-top:8px;font-size:13px;opacity:.72}' +
      'main figure.ir-site-studio-v5-content-image.is-size-small{width:min(32%,360px)}' +
      'main figure.ir-site-studio-v5-content-image.is-size-medium{width:min(52%,620px)}' +
      'main figure.ir-site-studio-v5-content-image.is-size-large{width:min(72%,820px)}' +
      'main figure.ir-site-studio-v5-content-image.is-size-full{width:100%}' +
      'main figure.ir-site-studio-v5-content-image.is-align-center{margin-left:auto;margin-right:auto}' +
      'main figure.ir-site-studio-v5-content-image.is-align-left{float:left;margin:6px 24px 18px 0}' +
      'main figure.ir-site-studio-v5-content-image.is-align-right{float:right;margin:6px 0 18px 24px}' +
      'main p,main li,main blockquote{overflow-wrap:anywhere;white-space:normal}' +
      'main iframe{max-width:100%;border:0;border-radius:18px}' +
      'html,body{max-width:100%;overflow-x:hidden}' +
      'main{min-width:0;max-width:100%;overflow-x:hidden}' +
      'main figure.ewb-video,main figure.ewb-video-card{display:block;box-sizing:border-box;max-width:100%;width:min(100%,620px);margin:28px auto;clear:both}' +
      'main figure.is-size-small{width:min(100%,360px)}' +
      'main figure.is-size-medium{width:min(100%,620px)}' +
      'main figure.is-size-large{width:min(100%,820px)}' +
      'main figure.is-size-full{width:100%}' +
      'main figure.is-align-left{margin-left:0;margin-right:auto}' +
      'main figure.is-align-center{margin-left:auto;margin-right:auto}' +
      'main figure.is-align-right{margin-left:auto;margin-right:0}' +
      'main figure.ewb-video video{display:block;width:100%;max-width:100%;height:auto;max-height:min(78vh,760px);object-fit:contain;border-radius:18px;background:#000;outline:none}' +
      'main .ewb-video-frame{position:relative;width:100%;aspect-ratio:16/9;overflow:hidden;border-radius:18px;background:#000}' +
      'main .ewb-video-frame iframe{position:absolute;inset:0;width:100%;height:100%;border:0}' +
      'main figure.ewb-video figcaption{margin-top:9px;font-size:13px;line-height:1.5;opacity:.72}';
  }

  function renderOfficialLandingProductV072A(state, page, options) {
    options = options || {};
    var site = state && state.site ? state.site : {};
    var pages = Array.isArray(state && state.pages) ? state.pages : [];
    var home = pageBySlugV072A(state, 'index') || findHomePage(state) || pages[0] || page || {};
    var features = pageBySlugV072A(state, 'features') || pages[1] || null;
    var faq = pageBySlugV072A(state, 'faq') || pages[2] || null;
    var current = page || home;
    var slug = String(current && current.slug || 'index');
    var isHome = slug === 'index' || String(current && current.type || '') === 'home';
    var accent = escapeHtml(site.buttonColor || site.accentColor || site.siteColor || '#e7743f');
    var siteName = site.name || 'LaunchOS';
    var tagline = site.tagline || t('Product landing', 'Продуктовый лендинг');
    var logoLetters = normalizeLooseLogoLettersV069E(site.logoLetters || initialsFromName(siteName)).slice(0,3) || normalizeLogoLetters(siteName, siteName).slice(0,2);
    var logoBgV074A = escapeHtml(site.logoBackgroundColor || site.accentColor || site.siteColor || '#2f7be6');
    var logoTextV074A = escapeHtml(site.logoTextColor || '#ffffff');
    var logoRadiusV074A = escapeHtml(logoCssRadius(site.logoShape || site.faviconShape || 'rounded'));
    var logoSizeV074A = logoHeaderSizePx(site.logoHeaderSize);
    var logoFontSizeV074A = logoHeaderFontSizePx(logoLetters, site.logoHeaderSize);
    var linkMode = options.linkMode || 'file';
    function fileFor(p){ return linkMode === 'hash' ? ('#' + ((p && p.slug) || 'index')) : pageFileName(p); }
    function anchorOrFile(p, anchor){ return (isHome || linkMode === 'hash') ? ('#' + anchor) : (fileFor(home) + '#' + anchor); }

    var heroTitle = textPairV072A(home.headline, 'Turn first impression into action.', 'Превратите первое впечатление в действие.');
    var heroSummary = textPairV072A(home.summary, 'A product landing starter with hero, features, scenarios, FAQ and a clear access CTA.', 'Стартовый лендинг продукта: первый экран, возможности, сценарии, FAQ и понятный CTA доступа.');
    var featuresTitle = textPairV072A(features && features.headline, 'Show what the product helps with.', 'Покажите, чем помогает продукт.');
    var featuresSummary = textPairV072A(features && features.summary, 'Features, use cases and benefits should be clear before the visitor decides.', 'Возможности, сценарии и преимущества должны быть понятны до решения пользователя.');
    var faqTitle = textPairV072A(faq && faq.headline, 'Answer doubts before the user leaves.', 'Ответьте на сомнения до того, как пользователь уйдёт.');
    var faqSummary = textPairV072A(faq && faq.summary, 'Use this area for access, price, download, support or product questions.', 'Используйте этот блок для вопросов о доступе, цене, скачивании, поддержке или продукте.');

    /* IRGEZTNE_LANDING_PAGES_BRIDGE_V087A */
    /* IRGEZTNE_LANDING_MENU_FLAGS_V087D
       Header and footer placement are independent page flags. */
    var landingMenuPagesV087A = orderedPageList(state).filter(function (candidate) {
      var candidateSlug = String(
        candidate && candidate.slug || ''
      ).toLowerCase();

      return candidate &&
        candidate.id !== home.id &&
        candidate.status === 'published' &&
        candidate.inMenu === true &&
        !candidate.parentId &&
        ['product', 'features', 'faq'].indexOf(candidateSlug) === -1;
    });

    var landingPageNavV087A = landingMenuPagesV087A.map(function (candidate) {
      var children = childPagesOf(state, candidate.id).filter(function (child) {
        return child &&
          child.status === 'published' &&
          child.inMenu === true;
      });

      var hasActiveChild = children.some(function (child) {
        return child.id === current.id;
      });

      var activeClass =
        candidate.id === current.id || hasActiveChild
          ? ' is-active'
          : '';

      var childLinks = children.length
        ? '<span class="submenu">' +
            children.map(function (child) {
              var childClass =
                child.id === current.id
                  ? ' class="is-active-child"'
                  : '';

              return '<a' + childClass +
                ' href="' + escapeHtml(fileFor(child)) + '">' +
                escapeHtml(pageLabel(child)) +
              '</a>';
            }).join('') +
          '</span>'
        : '';

      if (childLinks) {
        return '<span class="nav-parent has-children">' +
          '<a class="nav-link' + activeClass +
            '" href="' + escapeHtml(fileFor(candidate)) + '">' +
            escapeHtml(pageLabel(candidate)) +
            '<span class="nav-caret">▾</span>' +
          '</a>' +
          childLinks +
        '</span>';
      }

      return '<a class="nav-link' + activeClass +
        '" href="' + escapeHtml(fileFor(candidate)) + '">' +
        escapeHtml(pageLabel(candidate)) +
      '</a>';
    }).join('');

    var nav = '' +
      '<a class="nav-link' + (isHome ? ' is-active' : '') +
        '" href="' + escapeHtml(fileFor(home)) + '">' +
        i18nSpanV072A({en:'Product',ru:'Продукт'}) +
      '</a>' +
      '<a class="nav-link" href="' +
        escapeHtml(anchorOrFile(home, 'features')) + '">' +
        i18nSpanV072A({en:'Features',ru:'Возможности'}) +
      '</a>' +
      '<a class="nav-link" href="' +
        escapeHtml(anchorOrFile(home, 'faq')) +
      '">FAQ</a>' +
      landingPageNavV087A +
      '<button class="theme-toggle" data-theme-toggle="1" type="button">☾</button>';

    var css = landingCssV072A(accent) + '.logo{background:' + logoBgV074A + '!important;color:' + logoTextV074A + '!important;border-radius:' + logoRadiusV074A + '!important;width:' + logoSizeV074A + 'px!important;height:' + logoSizeV074A + 'px!important;font-size:' + logoFontSizeV074A + 'px!important}';
    css += siteGeneratedEditorContentCssV076C();
    css +=
      '/* IRGEZTNE_LANDING_PAGES_BRIDGE_V087A */' +
      '.nav-parent{position:relative;display:inline-flex;align-items:center}' +
      '.nav-caret{margin-left:7px;font-size:11px;opacity:.72}' +
      '.submenu{position:absolute;right:0;top:calc(100% + 8px);z-index:140;display:grid;gap:6px;min-width:max-content;padding:8px;border:1px solid var(--line);border-radius:17px;background:color-mix(in srgb,var(--paper) 97%,transparent);box-shadow:var(--shadow);opacity:0;visibility:hidden;transform:translateY(4px);pointer-events:none;transition:.14s ease}' +
      '.submenu a{display:block;padding:10px 13px;border-radius:11px;font-weight:850;white-space:nowrap}' +
      '.submenu a:hover,.submenu a.is-active-child{background:var(--ink);color:var(--bg)}' +
      '.nav-parent:hover .submenu,.nav-parent:focus-within .submenu{opacity:1;visibility:visible;transform:translateY(0);pointer-events:auto}' +
      '.site-footer{flex-wrap:wrap;align-items:flex-start}' +
      '.site-footer .footer-column{display:grid;gap:8px;min-width:150px}' +
      '.site-footer .footer-title{margin:0;color:var(--ink);font-size:12px;letter-spacing:.12em;text-transform:uppercase}' +
      '.site-footer .footer-links{display:grid;gap:7px}' +
      '.site-footer .footer-service-link{font-weight:760}';
    css += [
      '/* IRGEZTNE_LANDING_TEMPLATE_PARITY_V086A */',
      'html,body{overflow-x:clip!important;overflow-y:visible!important}',
      '.site-header{position:sticky!important;top:0!important;z-index:100!important}',
      'section[id]{scroll-margin-top:112px}',
      '.landing-home-v086a{display:block}',
      '/* IRGEZTNE_LANDING_CONTENT_PAGE_V088A */',
      '.landing-content-page-v088a{width:min(100%,1180px);margin:0 auto;padding:clamp(12px,1.5vw,24px) 0 56px}',
      '.landing-content-header-v088a{max-width:920px;padding:clamp(28px,4.5vw,72px) 0 clamp(22px,3vw,42px)}',
      '.landing-content-header-v088a h1{margin:0 0 18px;font-size:clamp(48px,7vw,104px);line-height:.92;letter-spacing:-.06em}',
      '.landing-content-summary-v088a{max-width:780px;margin:0;color:var(--muted);font-size:clamp(18px,1.55vw,24px);line-height:1.55}',
      '/* IRGEZTNE_LANDING_BODY_ONLY_PAGE_V088C */.landing-content-body-v088a{min-width:0;padding:clamp(40px,5vw,80px) 0 0;border-top:0}',
      '.landing-content-body-v088a>:first-child{margin-top:0}',
      '.landing-content-body-v088a>:last-child{margin-bottom:0}',
      '.landing-feature-visual-v086a{min-height:360px;position:relative;overflow:hidden}',
      '.landing-interface-v086a{margin-top:28px;padding:22px;border:1px solid rgba(255,255,255,.22);border-radius:24px;background:rgba(255,255,255,.10)}',
      '.landing-interface-v086a div{display:flex;align-items:end;justify-content:space-between;gap:18px;margin-bottom:18px}',
      '.landing-interface-v086a strong{font-size:52px}',
      '.landing-interface-v086a span{font-weight:850;opacity:.8}',
      '.landing-interface-v086a i{display:block;height:12px;margin-top:10px;border-radius:999px;background:rgba(255,255,255,.20)}',
      '.landing-interface-v086a i:nth-of-type(1){width:92%}',
      '.landing-interface-v086a i:nth-of-type(2){width:68%}',
      '.landing-interface-v086a i:nth-of-type(3){width:81%}',
      '.landing-proof-metrics-v086a{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}',
      '.landing-proof-metrics-v086a>div{padding:18px;border:1px solid var(--line);border-radius:18px;background:color-mix(in srgb,var(--paper) 72%,transparent)}',
      '.landing-proof-metrics-v086a strong{display:block;margin-bottom:7px;font-size:34px;color:var(--accent)}',
      '.faq-item summary{cursor:pointer;color:var(--ink);font-weight:950;list-style:none}',
      '.faq-item summary::-webkit-details-marker{display:none}',
      '.faq-item[open] summary{margin-bottom:10px}',
      '@media(max-width:980px){section[id]{scroll-margin-top:168px}.landing-proof-metrics-v086a{grid-template-columns:1fr}}'
    ].join('');
    var js = landingJsV072A().replace(/<\/script/gi, '<\\/script');
    var title = isHome ? langTextV072A(heroTitle, 'ru') : String(current.headline || pageLabel(current) || siteName);
    var description = isHome ? langTextV072A(heroSummary, 'ru') : String(current.summary || '');
    var seoTitle = siteMetaTitle(state, current, title);
    var seoDescription = siteMetaDescription(state, current, description);
    var canonicalUrl = absolutePageUrl(state, current);
    var ogImage = currentSitePublicBaseUrl(state) ? (currentSitePublicBaseUrl(state) + '/android-chrome-512x512.png') : 'android-chrome-512x512.png';
    var landingFooterStateV087A = Object.assign({}, state, {
      pages: orderedPageList(state).filter(function (candidate) {
        return candidate &&
          candidate.status !== 'draft';
      })
    });

    var landingFooterNavV087A = footerNavHtml(
      landingFooterStateV087A,
      linkMode
    );

    var pageContent = '';
    if (!isHome) {
      /* IRGEZTNE_LANDING_CONTENT_PAGE_V088A
         Ordinary pages use one editorial canvas.
         Do not manufacture an empty media/card column. */
      var landingPageBodyV088A =
        sanitizeHtml(current.bodyHtml || '');

      var landingPageSummaryV088A = current.summary
        ? '<p class="landing-content-summary-v088a">' +
            escapeHtml(current.summary) +
          '</p>'
        : '';

      var landingPageArticleV088A =
        String(landingPageBodyV088A || '').trim()
          ? '<section class="landing-content-body-v088a">' +
              landingPageBodyV088A +
            '</section>'
          : '';

      /* IRGEZTNE_LANDING_CONTENT_TITLE_ONLY_V088B
         Ordinary page title is rendered once, as H1 only. */
      /* IRGEZTNE_LANDING_BODY_ONLY_PAGE_V088C
         Page name belongs to navigation, settings and metadata.
         Public page body contains only editor-authored content. */
      pageContent =
        '<article class="landing-content-page-v088a">' +
          landingPageArticleV088A +
        '</article>';
    } else {
      var editableLandingBodyV086A = sanitizeHtml(home.bodyHtml || '');

      if (
        editableLandingBodyV086A.indexOf(
          'data-landing-starter-v086a'
        ) !== -1
      ) {
        pageContent = editableLandingBodyV086A;
      } else {
        pageContent = '' +
          '<section class="hero" id="product"><div class="hero-copy"><p class="kicker">Landing / Product</p>' +
            i18nSpanV072A(heroTitle, '', 'h1') +
            i18nSpanV072A(heroSummary, '', 'p') +
            '<div class="hero-actions"><a class="btn" href="#cta">' + i18nSpanV072A({en:'Get access',ru:'Получить доступ'}) + '</a><a class="btn secondary" href="#features">' + i18nSpanV072A({en:'View features',ru:'Смотреть возможности'}) + '</a></div>' +
          '</div><div class="hero-visual" aria-label="Product visual"><div class="product-panel"><h3>Launch panel</h3><div class="metric-row"><div class="metric"><strong>01</strong><span>Start</span></div><div class="metric"><strong>02</strong><span>Build</span></div><div class="metric"><strong>03</strong><span>Launch</span></div></div></div><div class="visual-footer"><div class="visual-pill">Signup</div><div class="visual-pill">Download</div><div class="visual-pill">Demo</div></div></div></section>' +
          '<div class="strip"><b>' + i18nSpanV072A({en:'Demo content can be replaced before publishing.',ru:'Демо-контент можно заменить перед публикацией.'}) + '</b><span>' + i18nSpanV072A({en:'Product, SaaS, app or service landing.',ru:'Лендинг продукта, SaaS, приложения или услуги.'}) + '</span></div>' +
          '<section id="features"><div class="section-head"><div><p class="kicker">Features</p>' + i18nSpanV072A(featuresTitle, '', 'h2') + '</div>' + i18nSpanV072A(featuresSummary, '', 'p') + '</div>' +
            '<div class="feature-grid"><article class="section-card"><div class="num">01</div><h3>' + i18nSpanV072A({en:'Explain fast',ru:'Объяснить быстро'}) + '</h3><p>' + i18nSpanV072A({en:'Make the product clear in the first screen.',ru:'Сделайте продукт понятным уже на первом экране.'}) + '</p></article><article class="section-card"><div class="num">02</div><h3>' + i18nSpanV072A({en:'Show value',ru:'Показать пользу'}) + '</h3><p>' + i18nSpanV072A({en:'Use feature blocks, scenarios and proof.',ru:'Используйте блоки возможностей, сценарии и доказательства.'}) + '</p></article><article class="section-card"><div class="num">03</div><h3>' + i18nSpanV072A({en:'Give next step',ru:'Дать следующий шаг'}) + '</h3><p>' + i18nSpanV072A({en:'Access, download, preorder, request demo or signup.',ru:'Доступ, скачивание, предзаказ, демо или регистрация.'}) + '</p></article></div></section>' +
          '<section class="scenario"><article class="section-card"><p class="kicker">Scenario</p><h2>' + i18nSpanV072A({en:'Use it as a product story.',ru:'Используйте как историю продукта.'}) + '</h2><p>' + i18nSpanV072A({en:'Lead the visitor from problem to decision.',ru:'Проведите посетителя от проблемы к решению.'}) + '</p></article><article class="section-card"><p class="kicker">Content</p>' + sanitizeHtml(home.bodyHtml || '') + '</article></section>' +
          '<section id="faq"><div class="section-head"><div><p class="kicker">FAQ</p>' + i18nSpanV072A(faqTitle, '', 'h2') + '</div>' + i18nSpanV072A(faqSummary, '', 'p') + '</div><div class="faq-list"><article class="faq-item"><strong>' + i18nSpanV072A({en:'Can I replace visuals?',ru:'Можно ли заменить визуалы?'}) + '</strong><p>' + i18nSpanV072A({en:'Yes. Demo visuals are placeholders for screenshots, product images or interface previews.',ru:'Да. Демо-визуалы — заглушки для скриншотов, изображений продукта или интерфейса.'}) + '</p></article><article class="faq-item"><strong>' + i18nSpanV072A({en:'What can the CTA be?',ru:'Каким может быть CTA?'}) + '</strong><p>' + i18nSpanV072A({en:'Signup, download, preorder, request access or contact form.',ru:'Регистрация, скачивание, предзаказ, запрос доступа или форма связи.'}) + '</p></article></div></section>' +
          '<section class="final-cta" id="cta"><div><p class="kicker">CTA</p><h2>' + i18nSpanV072A({en:'Turn interest into action.',ru:'Превратите интерес в действие.'}) + '</h2><p>' + i18nSpanV072A({en:'Replace this block with signup, download, preorder, contact or request access.',ru:'Замените этот блок на регистрацию, скачивание, предзаказ, контакт или запрос доступа.'}) + '</p></div><a class="btn" href="mailto:hello@example.com">' + i18nSpanV072A({en:'Get access',ru:'Получить доступ'}) + '</a></section>';
      }
    }

    var siteLangV084X = siteThemeLangCode();

    return '<!doctype html><html lang="' +
      escapeHtml(siteLangV084X) +
      '" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' + faviconHeadTags() + '<title>' + escapeHtml(seoTitle) + '</title><meta name="description" content="' + escapeHtml(seoDescription) + '"><link rel="canonical" href="' + escapeHtml(canonicalUrl) + '"><meta property="og:type" content="website"><meta property="og:title" content="' + escapeHtml(seoTitle) + '"><meta property="og:description" content="' + escapeHtml(seoDescription) + '"><meta property="og:url" content="' + escapeHtml(canonicalUrl) + '"><meta property="og:image" content="' + escapeHtml(ogImage) + '"><meta name="twitter:card" content="summary"><meta name="theme-color" content="' + accent + '"><style>' + css + '</style><script>' + js + '</script></head><body><header class="site-header"><a class="brand" href="' + escapeHtml(fileFor(home)) + '"><div class="logo" style="background:' + logoBgV074A + ';color:' + logoTextV074A + ';border-radius:' + logoRadiusV074A + ';width:' + logoSizeV074A + 'px;height:' + logoSizeV074A + 'px;font-size:' + logoFontSizeV074A + 'px">' + escapeHtml(logoLetters) + '</div><div><strong>' + escapeHtml(siteName) + '</strong><span>' + escapeHtml(tagline) + '</span></div></a><nav class="site-nav" aria-label="Main navigation">' + nav + '</nav></header><main class="page">' + pageContent + '<footer class="site-footer"><div class="footer-brand"><strong>' + escapeHtml(siteName) + '</strong><span>' + escapeHtml(tagline) + '</span><span class="footer-copy">© ' + new Date().getFullYear() + ' ' + escapeHtml(siteName) + '</span></div><nav><a href="' + escapeHtml(fileFor(home)) + '">' + i18nSpanV072A({en:'Product',ru:'Продукт'}) + '</a> · <a href="' + escapeHtml(anchorOrFile(features || home, 'features')) + '">' + i18nSpanV072A({en:'Features',ru:'Возможности'}) + '</a> · <a href="' + escapeHtml(anchorOrFile(home, 'faq')) + '">FAQ</a></nav>' + landingFooterNavV087A + '</footer></main></body></html>';
  }

  function renderSiteHtml(state, page, options) {
    options = options || {};
    var officialTemplateIdV072A = officialTemplateIdFromStateV072A(state);
    if (officialTemplateIdV072A === 'landing-product') {
      return renderOfficialLandingProductV072A(state, page, options);
    }
    var linkMode = options.linkMode || 'file';
    var inlineAssets = !!options.inlineAssets;
    var site = state.site || {};
    var selectedTemplateIdV068D = site.activeTemplate || ((readSelectedOfficialTemplateV5() || {}).id) || 'project-landing';
    var template = typeof officialTemplateMetaV068C === 'function' ? officialTemplateMetaV068C(selectedTemplateIdV068D) : (readSelectedOfficialTemplateV5() || {
      id: selectedTemplateIdV068D,
      title: 'Landing',
      titleRu: 'Лендинг',
      description: 'A modern landing page template.',
      descriptionRu: 'Современный шаблон landing-страницы.'
    });

    // IRGEZTNE_DOCS_TEMPLATE_RENDER_V068D
    var variant = templateVariantV5(template);
    var accent = templateAccentV5(template, site);
    var logoBg = site.logoBackgroundColor || accent;
    var logoText = site.logoTextColor || '#ffffff';
    var logoRadius = logoCssRadius(site.logoShape || site.faviconShape || 'rounded');
    var navAccent = site.menuColor || accent;
    var buttonAccent = site.buttonColor || accent;
    var templateTitle = selectedTemplateTitleV5(template);
    var siteName = site.name || 'Project Studio';
    var tagline = site.tagline || t('Local-first publishing workspace', 'Локальная студия публикации');
    var logoLetters = normalizeLooseLogoLettersV069E(site.logoLetters || '');
    var logoHeaderSize = logoHeaderSizePx(site.logoHeaderSize);
    var logoHeaderFontSize = logoHeaderFontSizePx(logoLetters, site.logoHeaderSize);
    var textColor = site.textColor || '#101827';
    var backgroundColor = site.backgroundColor || '#ffffff';
    var bodyFont = fontStack(site.fontFamily);
    var headingFont = fontStack(site.headingFont || site.fontFamily);
    var lang = siteThemeLangCode();

    var pages = Array.isArray(state.pages) ? state.pages : [];
    var menuItems = getPreviewNavItems(state);
    var isHomePage = String((page && page.slug) || '') === 'index' || String((page && page.type) || '') === 'home';
    var pagePreset = isHomePage ? 'landing' : String((page && page.pagePreset) || '').trim();
    if (!pagePreset || pagePreset === 'blank') {
      var pageKey = (String((page && page.slug) || '') + ' ' + pageLabel(page)).toLowerCase();
      if (/contact|contacts|kontakt|контакт|связ/.test(pageKey)) pagePreset = 'contact';
      else if (/privacy|terms|legal|policy|конфиденц|услов|политик|юрид/.test(pageKey)) pagePreset = 'legal';
      else pagePreset = 'blank';
    }
    var title = String(page.headline || '').trim() || t('Write page H1', 'Напишите H1 страницы');
    var description = String(page.summary || '').trim();
    if (!description && isHomePage) {
      description = t(template.description || 'Page description will appear here.', template.descriptionRu || 'Описание страницы появится здесь.');
    }
    var baseSeoTitle = siteMetaTitle(state, page, title);
    var baseSeoDescription = siteMetaDescription(state, page, description);
    var seoTitle = cleanGeneratedMetaTextV067G(generatedSiteSettingV067F(site, 'seo.title', baseSeoTitle) || baseSeoTitle);
    var seoDescription = cleanGeneratedMetaTextV067G(generatedSiteSettingV067F(site, 'seo.description', baseSeoDescription) || baseSeoDescription);
    var canonicalUrl = absolutePageUrl(state, page);

    var ogEnabled = generatedSiteSettingV067F(site, 'opengraph.enabled', true) !== false;
    var ogTitle = cleanGeneratedMetaTextV067G(generatedSiteSettingV067F(site, 'opengraph.title', seoTitle) || seoTitle);
    var ogDescription = cleanGeneratedMetaTextV067G(generatedSiteSettingV067F(site, 'opengraph.description', seoDescription) || seoDescription);
    var ogType = String(generatedSiteSettingV067F(site, 'opengraph.type', 'website') || 'website');
    var ogImage = String(generatedSiteSettingV067F(site, 'opengraph.image', currentSitePublicBaseUrl(state) ? (currentSitePublicBaseUrl(state) + '/android-chrome-512x512.png') : 'android-chrome-512x512.png') || '');

    var twitterEnabled = generatedSiteSettingV067F(site, 'twitter.enabled', true) !== false;
    var twitterCard = String(generatedSiteSettingV067F(site, 'twitter.cardType', 'summary_large_image') || 'summary_large_image');
    var twitterUsername = String(generatedSiteSettingV067F(site, 'twitter.username', '') || '').trim();

    var generatedNoindex = !!generatedSiteSettingV067F(site, 'seo.noindex', false);
    var customHeadEnd = safeGeneratedRawHtmlV067F(generatedSiteSettingV067F(site, 'html.headEnd', ''));
    var customBodyStart = safeGeneratedRawHtmlV067F(generatedSiteSettingV067F(site, 'html.bodyStart', ''));
    var customBodyEnd = safeGeneratedRawHtmlV067F(generatedSiteSettingV067F(site, 'html.bodyEnd', ''));
    var customCss = safeGeneratedRawHtmlV067F(generatedSiteSettingV067F(site, 'css.custom', ''));

    var body = sanitizeHtml(page.bodyHtml || '');

    /* IRGEZTNE_WEBSTUDIO_PAGE_EDITOR_PRINCIPLE_V061G
       Empty page body should stay empty.
       Page name/menu label is not page content. */
    if (!String(body || '').trim()) {
      body = '';
    }

    var nav = menuItems.length ? menuItems.map(function (item) {
      var targetPage = item.type === 'page' ? pages.find(function (candidate) { return candidate.id === item.pageId; }) : null;
      var children = targetPage ? childPagesOf(state, targetPage.id).filter(function (child) { return child.inMenu === true && child.inFooter !== true; }) : [];
      var hasActiveChild = children.some(function (child) { return child.id === page.id; });
      var active = targetPage && (targetPage.id === page.id || hasActiveChild) ? ' is-active' : '';
      var label = item.type === 'page' && targetPage ? pageLabel(targetPage) : (item.label || t('Link', 'Ссылка'));
      var href = item.type === 'external' ? (item.url || '#') : (linkMode === 'hash' ? ('#' + ((targetPage && targetPage.slug) || 'page')) : pageFileName(targetPage));
      var attrs = item.type === 'external' ? ' target="_blank" rel="noopener"' : '';
      var childLinks = '';
      if (children.length) {
        childLinks = '<span class="submenu">' + children.map(function (child) {
          var childActive = child.id === page.id ? ' class="is-active-child"' : '';
          var childHref = linkMode === 'hash' ? ('#' + (child.slug || 'page')) : pageFileName(child);
          return '<a' + childActive + ' href="' + escapeHtml(childHref) + '">' + escapeHtml(pageLabel(child)) + '</a>';
        }).join('') + '</span>';
      }
      if (childLinks) return '<span class="nav-parent has-children"><a class="nav-link' + active + '" href="' + escapeHtml(href) + '"' + attrs + '>' + escapeHtml(label) + '<span class="nav-caret">▾</span></a>' + childLinks + '</span>';
      return '<a class="nav-link' + active + '" href="' + escapeHtml(href) + '"' + attrs + '>' + escapeHtml(label) + '</a>';
    }).join('') : '<span class="nav-link is-active">' + escapeHtml(pageLabel(page)) + '</span>';

    /* IRGEZTNE_LANDING_RENDERER_POLISH_V072B
       Polish the old Web Studio preview path for Landing/Product:
       sticky full-width header, visible product visual, EN/RU button and cleaner starter list. */
    var rawTemplateV072B = [
      site.template,
      site.activeTemplate,
      site.officialTemplate,
      site.selectedTemplate,
      site.templateId,
      site.templateVariant,
      template && template.id,
      template && template.title,
      variant
    ].join(' ').toLowerCase();
    var isLandingTemplateV072B = /project-landing|landing-product|modern-landing|landing\s*\/\s*product|product landing/.test(rawTemplateV072B);

    var footerLinks = footerNavHtml(state, linkMode);
    var footerSocialLinks = footerSocialHtml(state, linkMode);
    var footerNav = footerLinks || '';
    var footerSocialNav = footerSocialLinks ? '<nav class="footer-social-links" aria-label="' + escapeHtml(t('Social links', 'Социальные ссылки')) + '">' + footerSocialLinks + '</nav>' : '';
    var footerClass = (footerLinks || footerSocialLinks) ? 'site-footer has-footer-links' : 'site-footer';
    var langButtonV072B = '';
    var themeButton = langButtonV072B + '<button class="theme-toggle" data-theme-toggle="1" type="button" aria-label="' + escapeHtml(t('Dark mode', 'Тёмный режим')) + '" title="' + escapeHtml(t('Dark mode', 'Тёмный режим')) + '">☾</button>';
    var cssVars = ':root{--accent:' + escapeHtml(accent) + ';--nav-accent:' + escapeHtml(navAccent) + ';--button-accent:' + escapeHtml(buttonAccent) + ';--logo-bg:' + escapeHtml(logoBg) + ';--logo-text:' + escapeHtml(logoText) + ';--logo-radius:' + escapeHtml(logoRadius) + ';--logo-size:' + logoHeaderSize + 'px;--logo-header-font-size:' + logoHeaderFontSize + 'px;--ink:' + escapeHtml(textColor) + ';--muted:#64748b;--line:#e2e8f0;--site-bg:' + escapeHtml(backgroundColor) + ';--font-body:' + escapeHtml(bodyFont) + ';--font-heading:' + escapeHtml(headingFont) + '}';
    var pagePresetCss = '.hero.hero--content-page>div{width:min(1120px,100%);margin-left:auto;margin-right:auto}.hero.hero--content-page{padding-top:46px;padding-bottom:30px}.hero.hero--content-page h1{font-size:clamp(42px,5.2vw,72px);line-height:1.02;max-width:1120px}.hero.hero--content-page p{max-width:920px}.hero.hero--content-page+.content{width:min(1120px,100%);max-width:1120px;margin-left:auto!important;margin-right:auto!important}body[data-theme=light]{--ink:#0f172a;--muted:#475569;--line:#cbd5e1}body[data-theme=light] .content p,body[data-theme=light] .hero p{color:#475569}body[data-theme=light] .kicker{color:color-mix(in srgb,var(--button-accent) 82%,#166534)}/* IRGEZTNE_WEBSTUDIO_CONTENT_PAGE_WIDTH_CONTRAST_V061H *//* IRGEZTNE_WEBSTUDIO_PAGE_PRESETS_FOUNDATION_V061D IRGEZTNE_WEBSTUDIO_CONTACT_LEGAL_PRESETS_V061E */.hero.hero--content-page{padding-top:42px;padding-bottom:28px;min-height:auto}.hero.hero--content-page h1{font-size:clamp(36px,7vw,74px)}.hero.hero--content-page p:empty,.content:empty{display:none}.content-card{max-width:780px;border:1px solid var(--line);border-radius:28px;background:var(--panel);padding:24px 26px;color:var(--ink);box-shadow:0 22px 70px rgba(15,23,42,.08)}.content-card h2{margin:0 0 10px;font-size:clamp(24px,4vw,38px)}.content-card p{margin:0 0 14px;color:var(--muted);line-height:1.7}.content-card ul{margin:12px 0 0;padding-left:20px;color:var(--muted);line-height:1.8}body[data-theme=dark] .content-card{background:rgba(255,255,255,.035);border-color:rgba(148,163,184,.24);box-shadow:none}.content.content--preset{max-width:min(1120px,100%);margin:0 0 36px;padding:0;border:0;background:transparent;box-shadow:none}.content.content--preset .content-card{max-width:100%;padding:30px 34px}.content.content--empty{display:none}';
    // IRGEZTNE_BUSINESS_BREAK_GENERIC_WRAPPER_V069C
    // IRGEZTNE_BLOG_NEWS_THREE_COLUMN_STARTER_V069H
    if (selectedTemplateIdV068D === 'blog-news') {
      pagePresetCss += [
        '.page{width:min(100% - 64px,1760px)!important}',
        '.hero{display:none!important}',
        '.content{width:min(100%,1480px)!important;max-width:1480px!important;margin:clamp(54px,7vw,96px) auto 70px!important;padding:0!important;border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important}',
        '.site-footer{max-width:1480px!important;margin-left:auto!important;margin-right:auto!important}',
        '.ir-news-masthead-v069h{display:flex;align-items:flex-end;justify-content:space-between;gap:24px;margin-bottom:24px}.ir-news-masthead-v069h p{margin:0 0 10px!important;color:var(--button-accent)!important;font-size:13px!important;font-weight:950!important;letter-spacing:.12em!important;text-transform:uppercase!important}.ir-news-masthead-v069h h2{margin:0!important;font-size:clamp(42px,6vw,86px)!important;line-height:.98!important;letter-spacing:-.075em!important}.ir-news-masthead-v069h a{display:inline-flex;padding:12px 16px;border-radius:999px;background:var(--button-accent);color:#fff;text-decoration:none;font-weight:900;white-space:nowrap}',
        '.ir-news-grid-v069h{display:grid;grid-template-columns:1.28fr 1fr 1fr;gap:18px;align-items:stretch}.ir-news-grid-v069h--simple{grid-template-columns:repeat(3,minmax(0,1fr));margin-top:24px}.ir-news-card-v069h{border:1px solid var(--line);border-radius:22px;padding:22px;background:var(--panel-bg);min-height:210px;display:flex;flex-direction:column;justify-content:flex-start;box-shadow:none!important}.ir-news-card--lead-v069h{grid-row:span 2;min-height:438px}.ir-news-card-v069h span{color:var(--button-accent);font-size:12px;font-weight:950;letter-spacing:.08em;text-transform:uppercase}.ir-news-card-v069h h3{margin:12px 0 10px!important;font-size:clamp(24px,3vw,46px)!important;line-height:1.02!important;letter-spacing:-.055em!important}.ir-news-card-v069h:not(.ir-news-card--lead-v069h) h3{font-size:clamp(20px,2vw,30px)!important}.ir-news-card-v069h p{margin:0!important;color:var(--muted)!important;line-height:1.62!important;font-size:16px!important}.ir-news-card-v069h small{display:block;margin-top:auto;padding-top:18px;color:var(--muted);font-weight:800}',
        '.ir-news-thumb-v069h{height:180px;border-radius:18px;margin-bottom:20px;background:linear-gradient(135deg,var(--button-accent),#f97316);position:relative;overflow:hidden}.ir-news-thumb-v069h:after{content:"";position:absolute;right:22px;top:22px;width:70px;height:70px;border-radius:50%;background:rgba(255,255,255,.45)}.ir-news-card--lead-v069h .ir-news-thumb-v069h{height:220px}.ir-news-thumb-v069h--blue{background:linear-gradient(135deg,#2563eb,#93c5fd)}.ir-news-thumb-v069h--violet{background:linear-gradient(135deg,#7c3aed,#c4b5fd)}',
        '.ir-news-strip-v069h{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:24px 0 0;padding:18px 20px;border:1px solid var(--line);border-radius:22px;background:var(--soft-bg)}.ir-news-strip-v069h strong{margin-right:8px}.ir-news-strip-v069h a{display:inline-flex;padding:9px 12px;border-radius:999px;border:1px solid var(--line);background:var(--panel-bg);color:var(--ink);text-decoration:none;font-weight:900}.ir-news-strip-v069h--large{margin-top:26px}',
        'body[data-theme=light]{--panel-bg:#ffffff;--soft-bg:#fff7ed}',
        'body[data-theme=dark]{--panel-bg:rgba(255,255,255,.035);--soft-bg:rgba(255,255,255,.055)}',
        '@media(max-width:1100px){.ir-news-grid-v069h{grid-template-columns:1fr 1fr}.ir-news-card--lead-v069h{grid-column:span 2;grid-row:auto}.ir-news-masthead-v069h{align-items:flex-start;flex-direction:column}}',
        '@media(max-width:720px){.page{width:min(100% - 28px,1760px)!important}.content{margin-top:34px!important}.ir-news-grid-v069h,.ir-news-grid-v069h--simple{grid-template-columns:1fr}.ir-news-card--lead-v069h{grid-column:auto}.ir-news-masthead-v069h h2{font-size:42px!important}}'
      ].join('');
    }

    if (selectedTemplateIdV068D === 'business-product') {
      pagePresetCss += '.page{width:min(100% - 64px,1760px)!important}.hero{display:none!important}.content{width:min(100%,1440px)!important;max-width:1440px!important;margin:clamp(54px,7vw,96px) auto 70px!important;padding:0!important;border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important}.content>section:first-child{width:100%!important;margin-top:0!important}.content h2{letter-spacing:-.055em}.content article{background:color-mix(in srgb,var(--panel-bg) 72%,transparent)!important}.site-footer{max-width:1440px!important;margin-left:auto!important;margin-right:auto!important}body[data-theme=light]{--panel-bg:#ffffff;--soft-bg:#f6faf8}body[data-theme=dark]{--panel-bg:rgba(255,255,255,.035);--soft-bg:rgba(255,255,255,.055)}@media(max-width:860px){.page{width:min(100% - 28px,1760px)!important}.content{margin-top:34px!important}.content>section:first-child{grid-template-columns:1fr!important}}';
    }

    var docsTemplateCssV068D = variant === 'documentation' ? [
      '/* IRGEZTNE_DOCUMENTATION_TEMPLATE_PARITY_V085A */',
      '/* IRGEZTNE_DOCUMENTATION_WIDE_LAYOUT_V090B */',
      'body.template-documentation .page{width:min(1920px,calc(100vw - 28px));padding-top:12px}',
      'body.template-documentation .site-header{position:sticky;top:0;z-index:30;padding:12px 0;background:color-mix(in srgb,var(--site-bg) 92%,transparent);backdrop-filter:blur(16px)}',
      'body.template-documentation .brand{min-width:250px}',
      'body.template-documentation .site-nav{gap:7px}',
      'body.template-documentation .nav-link{min-height:32px;padding:7px 11px;border-radius:12px;font-size:12px;background:transparent}',
      'body.template-documentation .nav-link:hover,body.template-documentation .nav-link.is-active{background:var(--soft-bg);color:var(--button-accent)}',

      '.docs-layout-v068d{display:grid;grid-template-columns:220px minmax(0,1fr) 180px;gap:26px;align-items:start;padding:28px 0 34px}',
      '.docs-sidebar-v068d{position:sticky;top:76px;min-height:calc(100vh - 118px);padding:4px 16px 24px 0;border-right:1px solid var(--line)}',
      '.docs-search-v068d{margin:0 0 18px;padding:11px 12px;border:1px solid var(--line);border-radius:12px;background:var(--soft-bg);color:var(--muted);font-size:12px;font-weight:850}',
      '.docs-sidebar-title-v068d{display:block;margin:0 0 10px;color:var(--ink);font-size:12px;font-weight:950;letter-spacing:.13em;text-transform:uppercase}',
      '.docs-sidebar-v068d a{display:flex;align-items:center;min-height:34px;margin:2px 0;padding:8px 10px;border-radius:12px;color:var(--muted);font-weight:850;text-decoration:none}',
      '.docs-sidebar-v068d a:hover,.docs-sidebar-v068d a.is-active{background:var(--soft-bg);color:var(--button-accent)}',

      '.docs-content-v068d{min-width:0;max-width:none;min-height:calc(100vh - 190px);padding:8px 0 62px;display:flex;flex-direction:column}',
      '.docs-content-v068d>h1{margin:10px 0 14px;font-size:clamp(34px,4.2vw,60px);line-height:1.03;letter-spacing:-.05em}',
      '.docs-content-v068d>.docs-lead-v068d{max-width:840px;margin:0 0 25px;color:var(--muted);font-size:17px;line-height:1.68}',
      '.docs-content-v068d>.content{max-width:none;margin:0;padding:0;border:0;background:transparent;box-shadow:none}',

      '.docs-right-toc-v085a{position:sticky;top:86px;padding:4px 0 22px 16px;border-left:1px solid var(--line)}',
      '.docs-right-toc-v085a>strong{display:block;margin:0 0 12px;color:var(--ink);font-size:12px;font-weight:950;letter-spacing:.12em;text-transform:uppercase}',
      '.docs-right-toc-v085a>a{display:block;padding:7px 0;color:var(--muted);font-size:13px;font-weight:800;text-decoration:none}',
      '.docs-right-toc-v085a>a:hover{color:var(--button-accent)}',
      '.docs-version-v085a{margin-top:22px;padding:15px;border:1px solid var(--line);border-radius:16px;background:var(--soft-bg)}',
      '.docs-version-v085a span,.docs-version-v085a small{display:block;color:var(--muted);font-size:11px}',
      '.docs-version-v085a strong{display:block;margin:4px 0;color:var(--ink);font-size:20px}',

      '.docs-hero-v085a{display:grid;grid-template-columns:minmax(0,1fr) minmax(300px,.72fr);gap:24px;align-items:stretch;margin:0 0 42px}',
      '.docs-hero-copy-v085a{padding:30px 0}',
      '.docs-eyebrow-v085a{display:block;margin:0 0 12px;color:var(--button-accent);font-size:12px;font-weight:950;letter-spacing:.13em;text-transform:uppercase}',
      '.docs-hero-copy-v085a h2{margin:0 0 18px;font-size:clamp(38px,5vw,68px);line-height:.98;letter-spacing:-.065em}',
      '.docs-hero-copy-v085a p{max-width:720px;margin:0;color:var(--muted);font-size:17px;line-height:1.7}',
      '.docs-hero-actions-v085a{display:flex;gap:10px;flex-wrap:wrap;margin-top:24px}',
      '.docs-hero-actions-v085a a{display:inline-flex;padding:12px 16px;border:1px solid var(--button-accent);border-radius:999px;background:var(--button-accent);color:#fff;font-weight:900;text-decoration:none}',
      '.docs-hero-actions-v085a a.is-secondary{background:transparent;color:var(--ink);border-color:var(--line)}',

      '.docs-code-visual-v085a{min-width:0;padding:18px;border:1px solid rgba(148,163,184,.26);border-radius:24px;background:#111827;color:#dbeafe;box-shadow:0 28px 70px rgba(15,23,42,.20)}',
      '.docs-code-visual-v085a pre{margin:14px 0 0;overflow:auto}',
      '.docs-code-visual-v085a code{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:13px;line-height:1.65}',
      '.docs-window-dots-v085a{display:flex;gap:7px}.docs-window-dots-v085a i{width:10px;height:10px;border-radius:50%;background:#64748b}.docs-window-dots-v085a i:first-child{background:#fb7185}.docs-window-dots-v085a i:nth-child(2){background:#fbbf24}.docs-window-dots-v085a i:nth-child(3){background:#34d399}',

      '.docs-article-v085a{margin:34px 0;padding-top:6px}',
      '.docs-article-v085a h2{margin:0 0 13px;font-size:clamp(26px,3vw,40px);line-height:1.12;letter-spacing:-.04em}',
      '.docs-article-v085a>p{max-width:820px;color:var(--muted);font-size:16px;line-height:1.75}',

      '.docs-steps-v085a,.docs-api-grid-v085a{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin:22px 0}',
      '.docs-steps-v085a article,.docs-api-grid-v085a article{padding:18px;border:1px solid var(--line);border-radius:18px;background:var(--panel)}',
      '.docs-steps-v085a article>span,.docs-api-grid-v085a small{display:block;margin-bottom:10px;color:var(--button-accent);font-weight:950}',
      '.docs-steps-v085a h3,.docs-api-grid-v085a h3{margin:0 0 8px;color:var(--ink);font-size:19px}',
      '.docs-steps-v085a p,.docs-api-grid-v085a p{margin:0;color:var(--muted);font-size:14px;line-height:1.6}',

      '.docs-callout-v085a{margin:26px 0;padding:20px 22px;border:1px solid color-mix(in srgb,var(--button-accent) 34%,var(--line));border-radius:18px;background:color-mix(in srgb,var(--button-accent) 9%,var(--panel))}',
      '.docs-callout-v085a strong{display:block;margin-bottom:7px;color:var(--ink)}',
      '.docs-callout-v085a p{margin:0;color:var(--muted);line-height:1.65}',

      '.docs-code-block-v085a{margin:22px 0;border:1px solid rgba(148,163,184,.26);border-radius:20px;overflow:hidden;background:#111827;color:#dbeafe}',
      '.docs-code-block-v085a>div{display:flex;justify-content:space-between;padding:13px 17px;border-bottom:1px solid rgba(148,163,184,.22)}',
      '.docs-code-block-v085a pre{margin:0;padding:18px;overflow:auto}',
      '.docs-code-block-v085a code{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:13px;line-height:1.7}',

      '.docs-faq-v085a{display:grid;gap:10px;margin-top:20px}',
      '.docs-faq-v085a details{padding:16px 18px;border:1px solid var(--line);border-radius:16px;background:var(--panel)}',
      '.docs-faq-v085a summary{cursor:pointer;color:var(--ink);font-weight:900}',
      '.docs-faq-v085a p{margin:12px 0 0;color:var(--muted);line-height:1.65}',

      '.docs-table-v068i{width:100%;margin:22px 0;border:1px solid var(--line);border-collapse:separate;border-spacing:0;border-radius:18px;overflow:hidden}',
      '.docs-table-v068i th,.docs-table-v068i td{padding:13px 15px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}',
      '.docs-table-v068i th{background:var(--soft-bg);color:var(--ink);font-size:12px;letter-spacing:.08em;text-transform:uppercase}',
      '.docs-table-v068i tr:last-child td{border-bottom:0}',

      '.docs-bottom-v068g{margin-top:auto;padding-top:34px;border-top:1px solid var(--line)}',
      '.docs-page-nav-v068g{display:grid;grid-template-columns:1fr 1fr;gap:12px}',
      '.docs-page-nav-v068g a{display:flex;flex-direction:column;gap:4px;padding:14px 16px;border:1px solid var(--line);border-radius:16px;background:var(--soft-bg);color:var(--ink);font-weight:900;text-decoration:none}',
      '.docs-page-nav-v068g a:last-child{text-align:right}',
      '.docs-page-nav-v068g span{color:var(--muted);font-size:11px;font-weight:850;letter-spacing:.08em;text-transform:uppercase}',
      '.docs-page-nav-v068g a:hover{border-color:color-mix(in srgb,var(--button-accent) 45%,var(--line));color:var(--button-accent)}',

      'body.template-documentation .site-footer{margin-top:10px;padding-top:22px;border-top:1px solid var(--line)}',

      '@media(max-width:1300px){.docs-layout-v068d{grid-template-columns:230px minmax(0,1fr)}.docs-right-toc-v085a{display:none}}',
      '@media(max-width:900px){body.template-documentation .page{width:min(100% - 28px,1880px)}.docs-layout-v068d{grid-template-columns:1fr}.docs-sidebar-v068d{position:relative;top:auto;min-height:0;padding:0 0 18px;border-right:0;border-bottom:1px solid var(--line)}.docs-content-v068d{max-width:none}.docs-hero-v085a{grid-template-columns:1fr}}',
      '@media(max-width:680px){.docs-steps-v085a,.docs-api-grid-v085a{grid-template-columns:1fr}.docs-page-nav-v068g{grid-template-columns:1fr}.docs-page-nav-v068g a:last-child{text-align:left}.docs-hero-copy-v085a h2{font-size:38px}}'
    ].join('\n') : '';

    var customCssBlock = customCss ? '\n/* IRGEZTNE custom site CSS */\n' + customCss : '';
    if (isLandingTemplateV072B) {
      pagePresetCss += '' +
        'body.template-' + escapeHtml(variant) + '{background:radial-gradient(circle at 78% 0,color-mix(in srgb,var(--button-accent) 18%,transparent),transparent 36%),var(--site-bg)}' +
        '.page{width:100%;max-width:none;margin:0;padding:0 34px 56px}' +
        '.site-header{position:sticky;top:0;z-index:50;margin:0 -34px 40px;padding:18px 34px;border-bottom:1px solid var(--line);background:color-mix(in srgb,var(--site-bg) 88%,transparent);backdrop-filter:blur(18px)}' +
        'body[data-theme=dark] .site-header{background:rgba(7,17,31,.86);border-bottom-color:rgba(148,163,184,.24)}' +
        '.site-nav{align-items:center}.site-nav .lang-toggle,.site-nav .theme-toggle{width:42px;height:42px;padding:0;display:inline-grid;place-items:center;border-radius:999px;border:1px solid var(--line);background:var(--panel);color:var(--ink);font-weight:900;cursor:pointer}' +
        '.landing-v072b-hero{display:grid;grid-template-columns:minmax(0,1fr) minmax(420px,.86fr);gap:28px;align-items:stretch;margin:0 0 28px;padding:0}' +
        '.landing-v072b-copy,.landing-v072b-visual,.landing-v072b-card{border:1px solid var(--line);border-radius:32px;background:var(--panel);box-shadow:0 28px 80px rgba(15,23,42,.10)}' +
        '.landing-v072b-copy{padding:52px 48px}.landing-v072b-copy .kicker{margin:0 0 18px;color:var(--button-accent);font-size:13px;font-weight:950;text-transform:uppercase;letter-spacing:.15em}' +
        '.landing-v072b-copy h1{margin:0 0 22px;font-family:var(--font-heading);font-size:clamp(48px,6vw,92px);line-height:.9;letter-spacing:-.07em;color:var(--ink)}' +
        '.landing-v072b-copy p{margin:0;color:var(--muted);font-size:18px;line-height:1.7;max-width:760px}' +
        '.landing-v072b-actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:30px}.landing-v072b-btn{border:1px solid var(--line);border-radius:999px;padding:14px 19px;font-weight:950;background:var(--button-accent);color:#fff;text-decoration:none}.landing-v072b-btn.secondary{background:transparent;color:var(--ink)}' +
        '.landing-v072b-visual{min-height:510px;position:relative;overflow:hidden;background:linear-gradient(135deg,color-mix(in srgb,var(--button-accent) 34%,#111),#101010)}' +
        '.landing-v072b-visual:before{content:"";position:absolute;inset:26px;border:1px solid rgba(255,255,255,.30);border-radius:28px}.landing-v072b-visual:after{content:"";position:absolute;inset:0;background:radial-gradient(circle at 70% 20%,rgba(255,255,255,.30),transparent 28%),linear-gradient(135deg,transparent,rgba(0,0,0,.38))}' +
        '.landing-v072b-panel{position:absolute;z-index:2;left:44px;right:44px;top:70px;border-radius:26px;background:rgba(255,255,255,.92);color:#101010;padding:24px;box-shadow:0 35px 80px rgba(0,0,0,.25)}.landing-v072b-panel h3{margin:0 0 14px;font-size:34px;letter-spacing:-.055em}.landing-v072b-metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.landing-v072b-metric{border-radius:18px;background:#f1ede7;padding:16px}.landing-v072b-metric strong{display:block;font-size:28px}' +
        '.landing-v072b-visual-footer{position:absolute;z-index:2;left:44px;right:44px;bottom:42px;display:flex;gap:12px}.landing-v072b-pill{flex:1;border-radius:18px;background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.22);padding:18px;color:#fff;font-weight:900}' +
        '.landing-v072b-content{display:grid;grid-template-columns:minmax(0,.72fr) minmax(360px,.28fr);gap:18px;margin:0 0 34px}.landing-v072b-card{padding:30px 34px}.landing-v072b-card .content{margin:0!important;padding:0!important;border:0!important;background:transparent!important;box-shadow:none!important;max-width:none!important}.landing-v072b-card .ir-starter-list li{margin:8px 0}.landing-v072b-card .ir-starter-list strong{margin-right:6px}.landing-v072b-card .ir-starter-list span:before{content:" — "}' +
        '.landing-v072b-side{display:grid;gap:12px}.landing-v072b-mini{border:1px solid var(--line);border-radius:22px;background:color-mix(in srgb,var(--panel) 78%,transparent);padding:20px}.landing-v072b-mini b{display:block;font-size:28px;color:var(--button-accent)}.landing-v072b-mini span{color:var(--muted);font-weight:700}' +
        'html[lang=ru] .landing-v072b-copy h1{font-size:clamp(42px,5.25vw,78px);line-height:.93}' +
        '@media(max-width:980px){.page{padding:0 18px 40px}.site-header{position:static;margin:0 -18px 28px;padding:16px 18px;align-items:flex-start;flex-direction:column}.landing-v072b-hero,.landing-v072b-content{grid-template-columns:1fr}.landing-v072b-visual{min-height:420px}}';
    }

    var cssBlock = inlineAssets ? '<style>' + cssVars + '\n' + generatedSiteCssV5() + '\n' + pagePresetCss + '\n' + docsTemplateCssV068D + customCssBlock + '</style>' : '<style>' + cssVars + '\n' + pagePresetCss + '\n' + docsTemplateCssV068D + customCssBlock + '</style><link rel="stylesheet" href="assets/css/style.css">';
    var jsBlock = inlineAssets ? '<script>' + generatedSiteJsV5().replace(/<\/script/gi, '<\\/script') + '</script>' : '<script src="assets/js/site.js" defer></script>';
    if (isLandingTemplateV072B) {
      var langJsV072B = '<script>(function(){function setLang(lang){document.documentElement.lang=lang;document.querySelectorAll("[data-i18n-text]").forEach(function(el){var v=el.getAttribute("data-"+lang);if(v!==null)el.textContent=v})}setLang(document.documentElement.lang==="en"?"en":"ru")})();<\/script>';
      jsBlock += langJsV072B;
    }

    var heroDescriptionHtml = description ? '<p>' + escapeHtml(description) + '</p>' : '';
    var pageKicker = pagePreset === 'contact' ? t('Contact', 'Контакты') : (pagePreset === 'legal' ? t('Legal page', 'Юридическая страница') : t('Page', 'Страница'));
    var pageHeroHtml = isHomePage
      ? '<section class="hero" id="' + escapeHtml(page.slug || 'page') + '"><div><div class="kicker">' + escapeHtml(templateTitle) + '</div><h1>' + escapeHtml(title) + '</h1>' + heroDescriptionHtml + '</div></section>'
      : '<section class="hero hero--content-page" id="' + escapeHtml(page.slug || 'page') + '"><div><div class="kicker">' + escapeHtml(pageKicker) + '</div><h1>' + escapeHtml(title) + '</h1>' + heroDescriptionHtml + '</div></section>';
    var hasBody = String(body || '').trim().length > 0;
    var contentSectionHtml = hasBody ? '<section class="content">' + body + '</section>' : '';

    if (isLandingTemplateV072B && isHomePage) {
      var titleRuV072B = title || 'Превратите первое впечатление в действие.';
      var descRuV072B = description || 'Стартовый лендинг продукта: первый экран, возможности, сценарии, FAQ и понятный CTA доступа.';
      var titleEnV072B = 'Turn first impression into action.';
      var descEnV072B = 'A product landing starter with hero, features, scenarios, FAQ and a clear access CTA.';
      pageHeroHtml = '' +
        '<section class="landing-v072b-hero" id="product">' +
          '<div class="landing-v072b-copy"><p class="kicker">Landing / Product</p>' +
            '<h1 data-i18n-text="1" data-ru="' + escapeHtml(titleRuV072B) + '" data-en="' + escapeHtml(titleEnV072B) + '">' + escapeHtml(titleRuV072B) + '</h1>' +
            '<p data-i18n-text="1" data-ru="' + escapeHtml(descRuV072B) + '" data-en="' + escapeHtml(descEnV072B) + '">' + escapeHtml(descRuV072B) + '</p>' +
            '<div class="landing-v072b-actions"><a class="landing-v072b-btn" href="#cta" data-i18n-text="1" data-ru="Получить доступ" data-en="Get access">Получить доступ</a><a class="landing-v072b-btn secondary" href="' + (linkMode === 'hash' ? '#features' : 'features.html') + '" data-i18n-text="1" data-ru="Смотреть возможности" data-en="View features">Смотреть возможности</a></div>' +
          '</div>' +
          '<div class="landing-v072b-visual" aria-label="Product visual"><div class="landing-v072b-panel"><h3>Launch panel</h3><div class="landing-v072b-metrics"><div class="landing-v072b-metric"><strong>01</strong><span>Start</span></div><div class="landing-v072b-metric"><strong>02</strong><span>Build</span></div><div class="landing-v072b-metric"><strong>03</strong><span>Launch</span></div></div></div><div class="landing-v072b-visual-footer"><div class="landing-v072b-pill">Signup</div><div class="landing-v072b-pill">Download</div><div class="landing-v072b-pill">Demo</div></div></div>' +
        '</section>';
      contentSectionHtml = '<section class="landing-v072b-content"><article class="landing-v072b-card">' + (hasBody ? body : '') + '</article><aside class="landing-v072b-side"><div class="landing-v072b-mini"><b>EN/RU</b><span>Localised demo copy</span></div><div class="landing-v072b-mini"><b>Light</b><span>Theme-ready layout</span></div><div class="landing-v072b-mini"><b>CTA</b><span>Access, download or request</span></div></aside></section>';
    }


    if (variant === 'documentation') {
      var docsPagesV068D = orderedPageList(state).filter(function (candidate) {
        return candidate && candidate.status !== 'draft';
      });

      if (!docsPagesV068D.length && page) docsPagesV068D = [page];

      var docsSidebarLinksV068D = docsPagesV068D.map(function (candidate) {
        var activeClass = candidate && page && candidate.id === page.id
          ? ' class="is-active"'
          : '';

        var href = linkMode === 'hash'
          ? ('#' + (candidate.slug || 'page'))
          : pageFileName(candidate);

        return '<a' + activeClass + ' href="' + escapeHtml(href) + '">' +
          escapeHtml(pageLabel(candidate)) +
        '</a>';
      }).join('');

      nav = docsPagesV068D.slice(1, 4).map(function (candidate) {
        var href = linkMode === 'hash'
          ? ('#' + (candidate.slug || 'page'))
          : pageFileName(candidate);

        var activeClass = candidate && page && candidate.id === page.id
          ? ' nav-link is-active'
          : ' nav-link';

        return '<a class="' + activeClass.trim() + '" href="' +
          escapeHtml(href) + '">' +
          escapeHtml(pageLabel(candidate)) +
        '</a>';
      }).join('');

      var docsBodyV068D = body || '';

      /* IRGEZTNE_DOCUMENTATION_CUSTOM_BODY_ONLY_V090A
         Preserve the accepted starter pages.
         User-created documentation pages render editor content only. */
      var docsSlugV090A =
        String(page && page.slug || '');

      var docsStarterSlugsV090A = [
        'index',
        'getting-started',
        'guides',
        'reference'
      ];

      var docsIsStarterPageV090A =
        docsStarterSlugsV090A.indexOf(docsSlugV090A) !== -1;

      if (
        docsIsStarterPageV090A &&
        !String(docsBodyV068D).trim()
      ) {
        docsBodyV068D =
          '<p>' +
            escapeHtml(
              description ||
              siteMetaDescription(state, page, '')
            ) +
          '</p>';
      }

      var docsPageIntroV090A = '';

      if (docsIsStarterPageV090A) {
        var docsTitleV068D =
          String(page.headline || '').trim() ||
          pageLabel(page);

        var docsLeadV068D = description
          ? '<p class="docs-lead-v068d">' +
              escapeHtml(description) +
            '</p>'
          : '';

        docsPageIntroV090A =
          '<div class="kicker">' +
            escapeHtml(
              t('Documentation', 'Документация')
            ) +
          '</div>' +
          '<h1>' +
            escapeHtml(docsTitleV068D) +
          '</h1>' +
          docsLeadV068D;
      }

      var currentDocsIndexV068G = docsPagesV068D.findIndex(function (candidate) {
        return candidate && page && candidate.id === page.id;
      });

      var prevDocsPageV068G = currentDocsIndexV068G > 0
        ? docsPagesV068D[currentDocsIndexV068G - 1]
        : null;

      var nextDocsPageV068G =
        currentDocsIndexV068G >= 0 &&
        currentDocsIndexV068G < docsPagesV068D.length - 1
          ? docsPagesV068D[currentDocsIndexV068G + 1]
          : null;

      function docsPageLinkV068G(candidate, label) {
        if (!candidate) return '<span></span>';

        var href = linkMode === 'hash'
          ? ('#' + (candidate.slug || 'page'))
          : pageFileName(candidate);

        return '<a href="' + escapeHtml(href) + '">' +
          '<span>' + escapeHtml(label) + '</span>' +
          escapeHtml(pageLabel(candidate)) +
        '</a>';
      }

      var docsPrevNextV068G =
        '<nav class="docs-page-nav-v068g" aria-label="' +
          escapeHtml(t(
            'Documentation page navigation',
            'Навигация по документации'
          )) +
        '">' +
          docsPageLinkV068G(prevDocsPageV068G, t('Previous', 'Назад')) +
          docsPageLinkV068G(nextDocsPageV068G, t('Next', 'Дальше')) +
        '</nav>';

      var slugV085A = String(page && page.slug || 'index');

      var docsTocMapV085A = {
        index: [
          ['quick-start', t('Quick start', 'Быстрый старт')],
          ['api', t('API reference', 'API справочник')],
          ['faq', 'FAQ']
        ],
        'getting-started': [
          ['overview', t('Overview', 'Обзор')],
          ['steps', t('Steps', 'Шаги')],
          ['next', t('Next step', 'Следующий шаг')]
        ],
        guides: [
          ['workflow', t('Workflow', 'Рабочий процесс')],
          ['troubleshooting', t('Troubleshooting', 'Проблемы и решения')],
          ['examples', t('Examples', 'Примеры')]
        ],
        reference: [
          ['settings', t('Settings', 'Настройки')],
          ['endpoints', 'Endpoints'],
          ['schema', t('Schema', 'Схема')]
        ]
      };

      var docsTocLinksV085A =
        (docsTocMapV085A[slugV085A] || []).map(function (item) {
          return '<a href="#' + escapeHtml(item[0]) + '">' +
            escapeHtml(item[1]) +
          '</a>';
        }).join('');

      var docsRightTocV085A =
        '<aside class="docs-right-toc-v085a">' +
          '<strong>' +
            escapeHtml(t('On this page', 'На этой странице')) +
          '</strong>' +
          docsTocLinksV085A +
          '<div class="docs-version-v085a">' +
            '<span>' + escapeHtml(t('Version', 'Версия')) + '</span>' +
            '<strong>0.1.0</strong>' +
            '<small>' +
              escapeHtml(t(
                'Documentation starter',
                'Стартовый шаблон документации'
              )) +
            '</small>' +
          '</div>' +
        '</aside>';

      pageHeroHtml = '';

      contentSectionHtml =
        '<section class="docs-layout-v068d">' +
          '<aside class="docs-sidebar-v068d">' +
            '<div class="docs-search-v068d">' +
              escapeHtml(t(
                'Search documentation…',
                'Поиск по документации…'
              )) +
            '</div>' +
            '<strong class="docs-sidebar-title-v068d">' +
              escapeHtml(t('Sections', 'Разделы')) +
            '</strong>' +
            '<nav aria-label="' +
              escapeHtml(t(
                'Documentation sections',
                'Разделы документации'
              )) +
            '">' +
              docsSidebarLinksV068D +
            '</nav>' +
          '</aside>' +

          '<article class="docs-content-v068d">' +
            docsPageIntroV090A +
            '<section class="content">' +
              docsBodyV068D +
            '</section>' +
            '<footer class="docs-bottom-v068g">' +
              docsPrevNextV068G +
            '</footer>' +
          '</article>' +

          docsRightTocV085A +
        '</section>';
    }

    return '<!doctype html>' +
      '<html lang="' + escapeHtml(lang) + '">' +
      '<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
      faviconHeadTags() +
      '<title>' + escapeHtml(seoTitle) + '</title>' +
      '<meta name="description" content="' + escapeHtml(seoDescription) + '">' +
      (generatedNoindex ? '<meta name="robots" content="noindex,nofollow">' : '') +
      '<link rel="canonical" href="' + escapeHtml(canonicalUrl) + '">' +
      (ogEnabled ? '<meta property="og:type" content="' + escapeHtml(ogType) + '"><meta property="og:title" content="' + escapeHtml(ogTitle) + '"><meta property="og:description" content="' + escapeHtml(ogDescription) + '"><meta property="og:url" content="' + escapeHtml(canonicalUrl) + '">' + (ogImage ? '<meta property="og:image" content="' + escapeHtml(ogImage) + '">' : '') : '') +
      (twitterEnabled ? '<meta name="twitter:card" content="' + escapeHtml(twitterCard) + '"><meta name="twitter:title" content="' + escapeHtml(ogTitle) + '"><meta name="twitter:description" content="' + escapeHtml(ogDescription) + '">' + (twitterUsername ? '<meta name="twitter:site" content="' + escapeHtml(twitterUsername) + '">' : '') : '') +
      '<meta name="theme-color" content="' + escapeHtml(accent) + '">' +
      customHeadEnd +
      cssBlock + jsBlock + '</head>' +
      '<body class="template-' + escapeHtml(variant) + '" data-template="' + escapeHtml(variant) + '" data-theme="light">' + customBodyStart + '<main class="page">' +
      '<header class="site-header"><a class="brand" href="' + (linkMode === 'hash' ? '#index' : 'index.html') + '"><div class="logo">' + escapeHtml(logoLetters) + '</div><div><strong>' + escapeHtml(siteName) + '</strong><span>' + escapeHtml(tagline) + '</span></div></a><nav class="site-nav" aria-label="' + escapeHtml(t('Main navigation', 'Главное меню')) + '">' + nav + themeButton + '</nav></header>' +
      pageHeroHtml +
      contentSectionHtml +
      '<footer class="' + footerClass + '"><div class="footer-brand"><strong>' + escapeHtml(siteName) + '</strong><span>' + escapeHtml(tagline) + '</span><span class="footer-copy">© ' + new Date().getFullYear() + ' ' + escapeHtml(siteName) + '</span></div>' + footerNav + footerSocialNav + '</footer>' +
      '</main>' + customBodyEnd + '</body></html>';
  }


  function publishProviderMeta(id) {
    var providers = {
      manual: {
        id: 'manual',
        icon: 'ZIP',
        name: 'Export / HTML',
        nameRu: 'Экспорт / HTML',
        short: 'Local export',
        shortRu: 'Локальный экспорт',
        note: 'Export the full site ZIP, current page HTML, or starter ZIP. No server connection is required.',
        noteRu: 'Скачайте ZIP сайта, текущий HTML или стартовый ZIP. Подключение к серверу не требуется.',
        required: []
      },
      netlify: {
        id: 'netlify', icon: 'NF', name: 'Netlify', nameRu: 'Netlify', short: 'Deploy site', shortRu: 'Публикация сайта',
        note: 'Token + Site ID. Set up once, then publish changes from the top Web Studio button.',
        noteRu: 'Token + Site ID. Настройте один раз, затем публикуйте изменения верхней кнопкой Web Studio.',
        required: ['token', 'siteId']
      },
      github: {
        id: 'github', icon: 'GH', name: 'GitHub Pages', nameRu: 'GitHub Pages', short: 'Repository pages', shortRu: 'Страницы репозитория',
        note: 'Token, owner, repository and branch. Later it will push the built site files.',
        noteRu: 'Token, owner, repository и branch. Позже сюда будет отправляться собранный сайт.',
        required: ['token', 'owner', 'repository', 'branch']
      },
      vercel: {
        id: 'vercel', icon: 'VC', name: 'Vercel', nameRu: 'Vercel', short: 'Project deploy', shortRu: 'Публикация проекта',
        note: 'Token + project/team foundation for future Vercel deployment.',
        noteRu: 'Основа token + project/team для будущей публикации на Vercel.',
        required: ['token', 'projectName']
      },
      cloudflare: {
        id: 'cloudflare', icon: 'CF', name: 'Cloudflare Pages', nameRu: 'Cloudflare Pages', short: 'Direct upload', shortRu: 'Прямая загрузка',
        note: 'Token, Account ID and Project name for future Pages direct upload.',
        noteRu: 'Token, Account ID и Project name для будущего direct upload в Pages.',
        required: ['token', 'accountId', 'projectName']
      },
      gitlab: {
        id: 'gitlab', icon: 'GL', name: 'GitLab Pages', nameRu: 'GitLab Pages', short: 'CI pages', shortRu: 'CI страницы',
        note: 'Token, namespace/project and branch foundation for GitLab Pages.',
        noteRu: 'Token, namespace/project и branch как основа GitLab Pages.',
        required: ['token', 'owner', 'repository', 'branch']
      },
      ipfs: {
        id: 'ipfs', icon: 'IP', name: 'IPFS / Web3', nameRu: 'IPFS / Web3', short: 'CID later', shortRu: 'CID позже',
        note: 'Export an IPFS-ready build. CID/IPNS/pinning provider integration comes later.',
        noteRu: 'Экспорт IPFS-ready сборки. CID/IPNS/pinning provider подключим позже.',
        required: []
      },
      s3: {
        id: 's3', icon: 'S3', name: 'S3 compatible', nameRu: 'S3 compatible', short: 'Bucket upload', shortRu: 'Загрузка в bucket',
        note: 'Endpoint, bucket and keys for Amazon S3, R2, B2, Wasabi, MinIO and similar services.',
        noteRu: 'Endpoint, bucket и keys для Amazon S3, R2, B2, Wasabi, MinIO и похожих сервисов.',
        required: ['endpoint', 'bucket', 'accessKey', 'secretKey']
      },
      ftp: {
        id: 'ftp', icon: 'FTP', name: 'FTP', nameRu: 'FTP', short: 'Classic hosting', shortRu: 'Обычный хостинг',
        note: 'Host, username and path foundation for classic hosting upload.',
        noteRu: 'Host, username и path как основа загрузки на обычный хостинг.',
        required: ['host', 'username', 'token']
      },
      sftp: {
        id: 'sftp', icon: 'SFTP', name: 'SFTP', nameRu: 'SFTP', short: 'Secure hosting', shortRu: 'Безопасный хостинг',
        note: 'Host, username and path foundation for secure server upload.',
        noteRu: 'Host, username и path как основа безопасной загрузки на сервер.',
        required: ['host', 'username', 'token']
      }
    };
    return providers[id] || providers.manual;
  }

  function publishProviderOrder() {
    return ['manual', 'netlify', 'github', 'vercel', 'cloudflare', 'gitlab', 'ipfs', 'ftp', 'sftp'];
  }

  function defaultPublishProviderConfig(id) {
    return {
      id: id,
      enabled: false,
      websiteUrl: '',
      token: '',
      owner: '',
      repository: '',
      branch: id === 'github' || id === 'gitlab' || id === 'cloudflare' ? 'main' : '',
      folder: 'site-preview',
      siteId: '',
      team: '',
      accountId: '',
      projectName: '',
      endpoint: '',
      bucket: '',
      region: '',
      accessKey: '',
      secretKey: '',
      host: '',
      username: '',
      remotePath: '/',
      lastStatus: '',
      lastResult: '',
      lastTestedAt: '',
      lastPublishedAt: ''
    };
  }

  function publishConfigHasRequiredValues(providerId, config) {
    config = config || {};
    var meta = publishProviderMeta(providerId);
    var required = meta && Array.isArray(meta.required) ? meta.required : [];
    if (!required.length) return config.enabled === true || !!config.lastStatus || !!config.lastPublishedAt;
    return required.every(function (key) {
      if (isPublishSecretField(key)) return !!String(config[key] || '').trim() || publishSecretHas(providerId, config, key);
      return !!String(config[key] || '').trim();
    });
  }

  function preferredConfiguredProvider(settings) {
    if (!settings || !settings.providers) return '';
    var priority = ['netlify', 'github', 'vercel', 'cloudflare', 'gitlab', 'ftp', 'sftp', 'ipfs'];
    for (var i = 0; i < priority.length; i += 1) {
      var id = priority[i];
      var config = settings.providers[id];
      if (!config) continue;
      if (publishConfigHasRequiredValues(id, config) && (config.enabled === true || !!config.lastStatus || !!config.lastTestedAt || !!config.websiteUrl)) return id;
    }
    return '';
  }

  function normalizePublishSettings(settings) {
    settings = settings && typeof settings === 'object' ? settings : {};
    var selected = settings.selectedProvider || settings.provider || 'manual';
    if (publishProviderOrder().indexOf(selected) === -1) selected = 'manual';
    var providers = settings.providers && typeof settings.providers === 'object' ? settings.providers : {};
    var normalizedProviders = {};
    publishProviderOrder().forEach(function (id) {
      normalizedProviders[id] = Object.assign(defaultPublishProviderConfig(id), providers[id] || {});
      normalizedProviders[id].id = id;
    });
    var normalized = {
      selectedProvider: selected,
      providers: normalizedProviders,
      includeSecretsInBackup: settings.includeSecretsInBackup === true,
      buildFolder: String(settings.buildFolder || 'site-preview'),
      lastBuildAt: settings.lastBuildAt || '',
      lastBuildFiles: Array.isArray(settings.lastBuildFiles) ? settings.lastBuildFiles : []
    };
    var manualExplicit = normalizedProviders.manual && normalizedProviders.manual.enabled === true;
    if (normalized.selectedProvider === 'manual' && !manualExplicit) {
      var preferred = preferredConfiguredProvider(normalized);
      if (preferred) normalized.selectedProvider = preferred;
    }
    return normalized;
  }

  function activePublishConfig(state) {
    state.site.publishSettings = normalizePublishSettings(state.site.publishSettings);
    return state.site.publishSettings.providers[state.site.publishSettings.selectedProvider] || state.site.publishSettings.providers.manual;
  }

  function publishFieldValue(config, key) {
    return escapeHtml(config && config[key] != null ? config[key] : '');
  }

  function tokenPreview(value) {
    value = String(value || '');
    if (!value) return t('empty', 'пусто');
    if (value.length <= 6) return '••••••';
    return '•••• ' + value.slice(-4);
  }

  function looksLikeMaskedSecret(value) {
    value = String(value || '').trim();
    if (!value) return false;
    if (/^[•●*\s.-]+$/.test(value)) return true;
    if (/[•●]/.test(value)) return true;
    if (/^\*{2,}/.test(value)) return true;
    if (/^(token:\s*)?[•●*]{2,}\s*[-–—]?\s*[A-Za-z0-9]{2,8}$/i.test(value)) return true;
    return false;
  }

  function isPublishSecretField(key) {
    return /^(token|secretKey|accessKey|password|privateKey)$/i.test(String(key || ''));
  }

  function publishSecretFlagKey(key) {
    key = String(key || 'token');
    return 'has' + key.slice(0, 1).toUpperCase() + key.slice(1);
  }

  function publishSecretPreviewKey(key) {
    return String(key || 'token') + 'Preview';
  }

  function publishSecretScopeFromState(state, providerId) {
    var site = state && state.site ? state.site : {};
    var siteId = String(site.localSiteId || site.id || site.name || 'default').trim() || 'default';
    return 'webstudio:' + siteId + ':' + String(providerId || 'manual');
  }

  function publishSecretScopeFromConfig(providerId, config) {
    return String(config && config.secretScope || ('webstudio:default:' + String(providerId || 'manual')));
  }

  function markPublishSecretSaved(config, key, preview) {
    if (!config) return;
    config[key] = '';
    config[publishSecretFlagKey(key)] = true;
    config[publishSecretPreviewKey(key)] = preview || config[publishSecretPreviewKey(key)] || '';
  }

  function markPublishSecretCleared(config, key) {
    if (!config) return;
    config[key] = '';
    config[publishSecretFlagKey(key)] = false;
    config[publishSecretPreviewKey(key)] = '';
  }

  function publishSecretHas(providerId, config, key) {
    if (!isPublishSecretField(key)) return false;
    if (config && config[publishSecretFlagKey(key)] === true) return true;
    var api = window.nsAPI || null;
    if (!api || typeof api.storageSecretHasSync !== 'function') return false;
    try {
      return !!api.storageSecretHasSync(publishSecretScopeFromConfig(providerId, config), key);
    } catch (error) {
      log('Secret has check failed', error);
      return false;
    }
  }

  function publishSecretPreviewFor(providerId, config, key) {
    if (!isPublishSecretField(key)) return '';
    if (config && config[publishSecretPreviewKey(key)]) return String(config[publishSecretPreviewKey(key)]);
    var api = window.nsAPI || null;
    if (!api || typeof api.storageSecretPreviewSync !== 'function') return '';
    try {
      return api.storageSecretPreviewSync(publishSecretScopeFromConfig(providerId, config), key) || '';
    } catch (error) {
      log('Secret preview failed', error);
      return '';
    }
  }

  function readPublishSecretValue(providerId, config, key) {
    if (!isPublishSecretField(key)) return String(config && config[key] || '');
    var current = String(config && config[key] || '').trim();
    if (current && !looksLikeMaskedSecret(current)) return current;
    var api = window.nsAPI || null;
    if (!api || typeof api.storageReadSecretSync !== 'function') return '';
    try {
      return api.storageReadSecretSync(publishSecretScopeFromConfig(providerId, config), key) || '';
    } catch (error) {
      log('Secret read failed', error);
      return '';
    }
  }

  function savePublishSecretValue(state, providerId, config, key, value) {
    if (!isPublishSecretField(key)) return false;
    value = String(value || '').trim();
    if (!value || looksLikeMaskedSecret(value)) {
      if (publishSecretHas(providerId, config, key)) markPublishSecretSaved(config, key, publishSecretPreviewFor(providerId, config, key));
      return false;
    }
    var api = window.nsAPI || null;
    if (!api || typeof api.storageSaveSecret !== 'function') return false;
    var scope = publishSecretScopeFromState(state, providerId);
    config.secretScope = scope;
    var preview = tokenPreview(value);
    markPublishSecretSaved(config, key, preview);
    try {
      api.storageSaveSecret(scope, key, value).then(function (result) {
        if (result && result.preview) {
          try {
            var latest = readState();
            latest.site.publishSettings = normalizePublishSettings(latest.site.publishSettings);
            var latestConfig = latest.site.publishSettings.providers[providerId] || defaultPublishProviderConfig(providerId);
            latestConfig.secretScope = scope;
            markPublishSecretSaved(latestConfig, key, result.preview);
            latest.site.publishSettings.providers[providerId] = latestConfig;
            writeState(latest);
          } catch (error) {
            log('Secret preview metadata refresh failed', error);
          }
        }
      }).catch(function (error) { log('Secret save failed', error); });
    } catch (error) {
      log('Secret save failed', error);
    }
    return true;
  }

  function clearPublishSecrets(providerId, config) {
    var api = window.nsAPI || null;
    var scope = publishSecretScopeFromConfig(providerId, config);
    ['token', 'secretKey', 'accessKey', 'password', 'privateKey'].forEach(function (key) {
      markPublishSecretCleared(config, key);
      if (api && typeof api.storageClearSecret === 'function') {
        try { api.storageClearSecret(scope, key).catch(function (error) { log('Secret clear failed', error); }); } catch (error) { log('Secret clear failed', error); }
      }
    });
  }

  function publishStatusText(config) {
    if (!config || !config.lastStatus) return t('Not tested yet', 'Пока не проверено');
    var raw = String(config.lastStatus || '');
    var kind = '';
    var match = raw.match(/^(ok|warn|info):\s*/i);
    if (match) {
      kind = match[1].toLowerCase();
      raw = raw.slice(match[0].length);
    }
    var pairs = [
      ['Saved draft, but required fields are still missing: ', 'Черновик сохранён, но ещё не заполнены обязательные поля: '],
      ['Fill required fields: ', 'Заполните обязательные поля: '],
      ['Publish blocked. Fill required fields first: ', 'Публикация остановлена. Сначала заполните поля: '],
      ['Settings saved. This website can now be published repeatedly without re-entering the connection data.', 'Настройки сохранены. Теперь этот сайт можно публиковать повторно без повторного ввода данных подключения.'],
      ['Settings saved and ready. Next publishes can use this saved provider setup.', 'Настройки сохранены и готовы. Следующие публикации смогут использовать эту сохранённую настройку провайдера.'],
      ['Build is ready. Saved provider setup will be reused for the next publish.', 'Сборка готова. Сохранённая настройка провайдера будет использоваться для следующей публикации.'],
      ['ZIP exported. Folder was opened.', 'ZIP экспортирован. Папка открыта.'],
      ['Testing Netlify connection…', 'Проверка подключения Netlify…'],
      ['Publishing to Netlify…', 'Публикация на Netlify…'],
      ['Check Netlify connection before publishing.', 'Сначала проверьте подключение Netlify.'],
      ['Checking Netlify before publishing…', 'Проверяем Netlify перед публикацией…'],
      ['Site published on Netlify: ', 'Сайт опубликован на Netlify: '],
      ['Netlify ZIP publish is unavailable in this build.', 'Netlify ZIP publish недоступен в этой сборке.'],
      ['Netlify deploy ready: ', 'Netlify deploy готов: '],
      ['Netlify deploy created: ', 'Netlify deploy создан: '],
      ['Netlify publish failed: ', 'Ошибка публикации Netlify: '],
      ['Netlify connected: ', 'Netlify подключён: '],
      ['Netlify token works, but the selected site was not found.', 'Netlify token работает, но выбранный сайт не найден.'],
      ['Netlify access denied. Check token.', 'Netlify отклонил доступ. Проверьте token.'],
      ['Netlify rate limit reached. Try again later.', 'Лимит Netlify достигнут. Попробуйте позже.'],
      ['Netlify connection failed: ', 'Ошибка подключения Netlify: '],
      ['Netlify API is unavailable in this environment: ', 'Netlify API недоступен в этой среде: '],
      ['Testing Cloudflare Pages connection…', 'Проверка подключения Cloudflare Pages…'],
      ['Publishing to Cloudflare Pages…', 'Публикация на Cloudflare Pages…'],
      ['Checking Cloudflare Pages before publishing…', 'Проверяем Cloudflare Pages перед публикацией…'],
      ['Check Cloudflare Pages connection before publishing.', 'Сначала проверьте подключение Cloudflare Pages.'],
      ['Cloudflare Pages connected: ', 'Cloudflare Pages подключён: '],
      ['Cloudflare Pages publish failed: ', 'Ошибка публикации Cloudflare Pages: '],
      ['Site published on Cloudflare Pages: ', 'Сайт опубликован на Cloudflare Pages: '],
      ['Cloudflare Pages API is unavailable in this build.', 'Cloudflare Pages API недоступен в этой сборке.'],
      ['Cloudflare Pages connection failed: ', 'Ошибка подключения Cloudflare Pages: '],
      ['Cloudflare Pages project was not found or token was rejected.', 'Cloudflare Pages project не найден или token отклонён.']
    ];
    pairs.some(function (pair) {
      var en = pair[0];
      var ru = pair[1];
      if (raw.indexOf(en) === 0) { raw = t(en, ru) + raw.slice(en.length); return true; }
      if (raw.indexOf(ru) === 0) { raw = t(en, ru) + raw.slice(ru.length); return true; }
      return false;
    });
    var prefix = '';
    if (kind === 'warn') prefix = t('Warning: ', 'Внимание: ');
    else if (kind === 'ok') prefix = t('Ready: ', 'Готово: ');
    return prefix + raw;
  }

  function publishMissingFields(config, meta) {
    var missing = [];
    var providerId = (config && config.id) || (meta && meta.id) || '';
    (meta.required || []).forEach(function (key) {
      if (isPublishSecretField(key)) {
        if (!String(config && config[key] || '').trim() && !publishSecretHas(providerId, config, key)) missing.push(key);
        return;
      }
      if (!String(config && config[key] || '').trim()) missing.push(key);
    });
    return missing;
  }

  function isPublishConfigured(providerId, config, meta) {
    if (providerId === 'manual' || providerId === 'ipfs') return true;
    return publishMissingFields(config, meta).length === 0 && config && config.enabled === true;
  }

  function publishReadyMessage(providerId, config, meta) {
    var missing = publishMissingFields(config, meta);
    if (providerId === 'manual') return t('Local export is ready. ZIP/HTML export works without server setup.', 'Локальный экспорт готов. ZIP/HTML работает без настройки сервера.');
    if (providerId === 'ipfs') return t('IPFS-ready export is prepared as a foundation. CID/pinning integration comes later.', 'IPFS-ready экспорт подготовлен как основа. CID/pinning подключим позже.');
    if (isPublishConfigured(providerId, config, meta)) return t('Connection is saved for this website. Continue editing pages, then use the top Publish button to send changes.', 'Подключение сохранено для этого сайта. Продолжайте редактировать страницы, затем используйте верхнюю кнопку «Опубликовать», чтобы отправить изменения.');
    if (missing.length) return t('Fill and save the required fields once. After that this provider becomes ready for repeated publishing.', 'Заполните и сохраните обязательные поля один раз. После этого провайдер будет готов для повторной публикации.');
    return t('Settings are filled but not confirmed yet. Press Save settings or Test settings once.', 'Поля заполнены, но ещё не подтверждены. Нажмите «Сохранить настройки» или «Проверить настройки» один раз.');
  }

  function publishFieldLabel(key) {
    var labels = {
      websiteUrl: t('Website URL', 'URL сайта'),
      token: 'Token',
      owner: t('Owner / namespace', 'Owner / namespace'),
      repository: t('Repository / project', 'Repository / project'),
      branch: 'Branch',
      folder: t('Build folder', 'Папка сборки'),
      siteId: 'Site ID',
      team: t('Team / account', 'Team / account'),
      accountId: 'Account ID',
      projectName: t('Project name', 'Имя проекта'),
      endpoint: 'Endpoint URL',
      bucket: 'Bucket',
      region: 'Region',
      accessKey: 'Access Key',
      secretKey: 'Secret Key',
      host: 'Host',
      username: t('Username', 'Username'),
      remotePath: t('Remote path', 'Remote path')
    };
    return labels[key] || key;
  }

  function publishFieldPlaceholder(key) {
    var placeholders = {
      websiteUrl: 'https://example.com',
      token: t('Paste provider token', 'Вставьте token провайдера'),
      owner: t('owner or namespace', 'owner или namespace'),
      repository: t('repository / project', 'repository / project'),
      branch: 'main',
      folder: 'site-preview',
      siteId: 'site_id',
      team: t('optional team/account', 'team/account, если нужно'),
      accountId: 'account_id',
      projectName: t('project name', 'имя проекта'),
      endpoint: 'https://s3.example.com',
      bucket: 'bucket-name',
      region: 'auto',
      accessKey: 'access_key',
      secretKey: 'secret_key',
      host: 'example.com',
      username: t('username', 'имя пользователя'),
      remotePath: '/public_html/'
    };
    return placeholders[key] || '';
  }

  function publishFieldInput(providerId, config, key, type) {
    type = type || (isPublishSecretField(key) ? 'password' : 'text');
    var placeholder = publishFieldPlaceholder(key);
    var value = isPublishSecretField(key) ? '' : publishFieldValue(config, key);
    var saved = isPublishSecretField(key) && publishSecretHas(providerId, config, key) ? '<small class="ir-site-studio-v5-publish-secret-hint">' + escapeHtml(t('Saved locally:', 'Сохранено локально:') + ' ' + publishSecretPreviewFor(providerId, config, key)) + '</small>' : '';
    return '<label class="ir-site-studio-v5-publish-field"><span>' + escapeHtml(publishFieldLabel(key)) + '</span><input class="ir-site-studio-v5-input" type="' + escapeHtml(type) + '" placeholder="' + escapeHtml(placeholder) + '" autocomplete="off" data-v5-publish-provider="' + escapeHtml(providerId) + '" data-v5-publish-field="' + escapeHtml(key) + '" value="' + value + '">' + saved + '</label>';
  }

  function publishFieldsForProvider(providerId, config) {
    if (providerId === 'manual') {
      return '';
    }
    if (providerId === 'ipfs') {
      return publishFieldInput(providerId, config, 'websiteUrl', 'url') + publishFieldInput(providerId, config, 'folder');
    }
    if (providerId === 'netlify') {
      return publishFieldInput(providerId, config, 'websiteUrl', 'url') + publishFieldInput(providerId, config, 'siteId') + publishFieldInput(providerId, config, 'token');
    }
    if (providerId === 'github' || providerId === 'gitlab') {
      return publishFieldInput(providerId, config, 'token') + publishFieldInput(providerId, config, 'owner') + publishFieldInput(providerId, config, 'repository') + publishFieldInput(providerId, config, 'branch') + publishFieldInput(providerId, config, 'folder') + publishFieldInput(providerId, config, 'websiteUrl', 'url');
    }
    if (providerId === 'vercel') {
      return publishFieldInput(providerId, config, 'token') + publishFieldInput(providerId, config, 'projectName') + publishFieldInput(providerId, config, 'team') + publishFieldInput(providerId, config, 'websiteUrl', 'url');
    }
    if (providerId === 'cloudflare') {
      return publishFieldInput(providerId, config, 'token') + publishFieldInput(providerId, config, 'accountId') + publishFieldInput(providerId, config, 'projectName') + publishFieldInput(providerId, config, 'branch') + publishFieldInput(providerId, config, 'websiteUrl', 'url');
    }
    if (providerId === 's3') {
      return publishFieldInput(providerId, config, 'endpoint', 'url') + publishFieldInput(providerId, config, 'bucket') + publishFieldInput(providerId, config, 'region') + publishFieldInput(providerId, config, 'accessKey') + publishFieldInput(providerId, config, 'secretKey') + publishFieldInput(providerId, config, 'websiteUrl', 'url');
    }
    if (providerId === 'ftp' || providerId === 'sftp') {
      return publishFieldInput(providerId, config, 'host') + publishFieldInput(providerId, config, 'username') + publishFieldInput(providerId, config, 'token') + publishFieldInput(providerId, config, 'remotePath') + publishFieldInput(providerId, config, 'websiteUrl', 'url');
    }
    return publishFieldInput(providerId, config, 'websiteUrl', 'url');
  }

  function publishProviderCard(state, providerId) {
    var settings = state.site.publishSettings = normalizePublishSettings(state.site.publishSettings);
    var config = settings.providers[providerId] || defaultPublishProviderConfig(providerId);
    var meta = publishProviderMeta(providerId);
    var active = settings.selectedProvider === providerId ? ' is-active' : '';
    var missing = publishMissingFields(config, meta).length;
    var ready = isPublishConfigured(providerId, config, meta);
    var status = providerId === 'manual' ? t('Ready', 'Готово') : (ready ? t('Ready to publish', 'Готово к публикации') : (missing ? t('Setup once', 'Настроить один раз') : t('Save to finish', 'Сохранить')));
    var readyClass = ready ? ' is-ready' : '';
    return '<button class="ir-site-studio-v5-publish-provider' + active + readyClass + '" data-v5-action="publish-select-provider" data-v5-provider="' + escapeHtml(providerId) + '" type="button"><span class="ir-site-studio-v5-publish-provider-icon">' + escapeHtml(meta.icon) + '</span><strong>' + escapeHtml(t(meta.name, meta.nameRu)) + '</strong><small data-v5-publish-short="1">' + escapeHtml(t(meta.short, meta.shortRu)) + '</small><em data-v5-publish-status="1">' + escapeHtml(status) + '</em></button>';
  }

  function publicSiteExportMeta(site) {
    site = site && typeof site === 'object' ? site : {};
    return {
      name: site.name || '',
      author: site.author || '',
      slogan: site.slogan || site.tagline || '',
      icon: site.icon || '',
      activeTemplate: site.activeTemplate || site.template || '',
      accentColor: site.accentColor || site.siteColor || '',
      logoLetters: site.logoLetters || '',
      generatedBy: 'IRGEZTNE Web Studio',
      tokenPolicy: 'provider tokens are local only and are not exported'
    };
  }

  // IRGEZTNE_V083K_TEMPLATE_LAB_PREVIEW_BRIDGE
  function normalizeTemplateIdV083K(value) {
    var id = String(value || '').trim().toLowerCase();
    if (id === 'landing' || id === 'modern-landing' || id === 'modern-landing-wide') return 'project-landing';
    if (id === 'portfolio' || id === 'personal' || id === 'portfolio-personal') return 'studio-portfolio';
    if (id === 'knowledge-base' || id === 'documentation' || id === 'docs') return 'documentation-wide';
    if (id === 'business' || id === 'product' || id === 'business-product') return 'business-product';
    if (id === 'agency' || id === 'studio' || id === 'agency-studio') return 'agency-studio';
    if (id === 'blog' || id === 'news' || id === 'blog-news') return 'blog-news';
    return id || 'project-landing';
  }

  function normalizeTemplateLabPathV083K(value) {
    var path = String(value || '').trim().replace(/\\/g, '/').replace(/^\.\/+/, '').replace(/^\/+/, '');
    if (!path) return '';
    if (path.indexOf('template-lab/') !== 0) return '';
    if (!/\.html?$/i.test(path)) path = path.replace(/\/?$/, '/index.html');
    return path;
  }

  function templateLabPathForTemplateIdV083K(templateId) {
    var id = normalizeTemplateIdV083K(templateId);
    var map = {
      'project-landing': 'template-lab/landing-product/index.html',
      'business-product': 'template-lab/business-product/index.html',
      'blog-news': 'template-lab/blog-news/index.html',
      'documentation-wide': 'template-lab/documentation/index.html',
      'studio-portfolio': 'template-lab/portfolio-personal/index.html',
      'agency-studio': 'template-lab/agency-studio/index.html'
    };
    return map[id] || map['project-landing'];
  }

  function templateLabPathForSiteV083K(state) {
    var site = state && state.site && typeof state.site === 'object' ? state.site : {};
    var stored = normalizeTemplateLabPathV083K(site.templateLabPath || site.templatePreviewPath || '');
    if (stored) return stored;
    if (site.templateSource === 'template-lab') {
      return templateLabPathForTemplateIdV083K(site.activeTemplate || site.template || 'project-landing');
    }
    return '';
  }

  function relativeTemplateLabSrcV083K(templateLabPath) {
    // Materialized preview files live in data/previews/site-preview-*/.
    // From there, ../../../ returns to the repository root.
    return '../../../' + normalizeTemplateLabPathV083K(templateLabPath);
  }

  function renderTemplateLabBridgeHtmlV083K(state, page, templateLabPath) {
    var site = state && state.site && typeof state.site === 'object' ? state.site : {};
    var title = site.name || pageLabel(page) || 'IRGEZTNE Template Preview';
    var src = relativeTemplateLabSrcV083K(templateLabPath);
    return '<!doctype html>' +
      '<html lang="' + escapeHtml(currentLang() === 'en' ? 'en' : 'ru') + '">' +
      '<head>' +
      '<meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width, initial-scale=1">' +
      '<title>' + escapeHtml(title) + '</title>' +
      '<style>' +
      'html,body{margin:0;width:100%;height:100%;background:#07101d;overflow:hidden;}' +
      'iframe{display:block;width:100%;height:100vh;border:0;background:#fff;}' +
      '.fallback{position:fixed;left:16px;bottom:16px;z-index:2;padding:10px 12px;border-radius:14px;background:rgba(7,16,29,.88);color:#dbeafe;font:13px system-ui,sans-serif;}' +
      '.fallback a{color:#93c5fd;}' +
      '</style>' +
      '</head>' +
      '<body>' +
      '<iframe src="' + escapeHtml(src) + '" title="' + escapeHtml(title) + '"></iframe>' +
      '<noscript><div class="fallback">Template preview: <a href="' + escapeHtml(src) + '">' + escapeHtml(templateLabPath) + '</a></div></noscript>' +
      '</body></html>';
  }

  function createPreviewPayload(state, page) {
    var pages = Array.isArray(state.pages) && state.pages.length ? state.pages : [page].filter(Boolean);
    var home = findHomePage(state) || pages[0] || page;
    var active = page || home;
    var files = {
      'styles.css': '@import url("assets/css/style.css");\n',
      'assets/css/style.css': generatedSiteCssV5(),
      'assets/js/site.js': generatedSiteJsV5(),
      'assets/images/.keep': '',
      'sitemap.xml': sitemapXmlV5(state),
      'robots.txt': robotsTxtV5(state),
      'content/page.json': JSON.stringify(active || {}, null, 2),
      'meta.json': JSON.stringify({ site: publicSiteExportMeta(state.site), activePageId: active && active.id || '', generatedAt: new Date().toISOString(), structure: 'v7g3g-public-export-safe' }, null, 2)
    };

    Object.assign(files, createFaviconPackage(state.site || {}));

    // IRGEZTNE_GENERATED_MEDIA_PACKAGE_V084H
    var generatedMediaAssetsV084H =
      state &&
      state.site &&
      Array.isArray(state.site.mediaAssets)
        ? state.site.mediaAssets
        : [];

    generatedMediaAssetsV084H.forEach(function (asset) {
      if (!asset || asset.kind !== 'video') return;

      var publicPath = String(
        asset.publicPath || ''
      )
        .replace(/\\/g, '/')
        .replace(/^\/+/, '');

      if (
        !/^assets\/media\/video\/[a-z0-9._-]+$/i.test(
          publicPath
        )
      ) {
        return;
      }

      if (!asset.sourcePath) return;

      files[publicPath] = {
        sourcePath: String(asset.sourcePath),
        mimeType: String(
          asset.mimeType || 'video/mp4'
        )
      };
    });

    /*
       IRGEZTNE_WEBSTUDIO_GENERATED_BUILD_ONLY_V084G

       Template Lab is the gallery/demo source only.
       A real site preview and export must be generated from the
       editable Web Studio state: pages, Editor content, Design,
       logo, favicon, colors and navigation.
    */
    files['index.html'] = renderSiteHtml(
      state,
      home,
      { linkMode: 'file' }
    );

    pages.forEach(function (item) {
      if (!item) return;
      var name = pageFileName(item);
      files[name] = renderSiteHtml(
        state,
        item,
        { linkMode: 'file' }
      );
    });

    var activeFileName = pageFileName(active || home);
    return {
      title: state.site && state.site.name ? state.site.name : pageLabel(home),
      slug: 'site-preview',
      activeFileName: activeFileName,
      package: files
    };
  }

  async function materializePreviewPackage(state, page) {
    var api = window.nsAPI || null;
    var payload = createPreviewPayload(state, page);
    if (api && typeof api.materializeSitePreview === 'function') {
      var preview = await api.materializeSitePreview(payload);
      if (preview && preview.ok) {
        preview.activeFileName = payload.activeFileName;
        preview.activePageUrl = previewUrlForFile(preview.indexUrl, payload.activeFileName);
        return preview;
      }
    }
    return { ok: false, activeFileName: payload.activeFileName, activePageUrl: '' };
  }


  async function openPreviewUrlInExternal(preview, url) {
    var api = window.nsAPI || null;
    if (!api || typeof api.openSitePreviewExternal !== 'function') return false;
    await api.openSitePreviewExternal({ indexPath: preview && preview.indexPath || '', indexUrl: url || preview.indexUrl || '' });
    return true;
  }

  function cleanPublicSiteUrl(url) {
    url = String(url || '').trim();
    if (!/^https?:\/\//i.test(url)) return url;
    try {
      var parsed = new URL(url);
      parsed.search = '';
      parsed.hash = '';
      return parsed.toString();
    } catch (errorCleanUrl) {
      return url.split('?')[0].split('#')[0];
    }
  }

  function preferredPublicPublishTarget(state) {
    state.site.publishSettings = normalizePublishSettings(state.site.publishSettings);
    var settings = state.site.publishSettings;
    var selected = settings.selectedProvider || 'manual';
    var config = settings.providers[selected] || defaultPublishProviderConfig(selected);
    var url = String(config.websiteUrl || '').trim();

    /* 1.0.0 v7g3i
       Open site must respect the selected provider.
       Do not fall back to another saved provider URL: if Cloudflare is selected,
       opening the site should use Cloudflare only, not an older Netlify URL. */
    if (/^https?:\/\//i.test(url)) {
      return { providerId: selected, config: config, url: url };
    }
    return { providerId: selected, config: config, url: '' };
  }

  async function openSiteInBrowser(forcePublic) {
    forcePublic = !!forcePublic;
    var state = readState();
    var home = findHomePage(state) || activePage(state);
    var api = window.nsAPI || null;

    if (forcePublic || activeTab === 'publish' || activeTab === 'server') {
      var target = preferredPublicPublishTarget(state);
      var publishedUrl = cleanPublicSiteUrl(target.url);
      if (/^https?:\/\//i.test(publishedUrl)) {
        try {
          if (api && typeof api.openSitePreviewExternal === 'function') {
            await api.openSitePreviewExternal({ indexUrl: publishedUrl });
          } else {
            window.open(publishedUrl, '_blank');
          }
          return;
        } catch (errorOpenPublished) {
          log('Open published site failed, falling back to local preview', errorOpenPublished);
        }
      }
      if (forcePublic) {
        try { alert(t('Selected provider has no website URL yet. Add URL/site address in server settings.', 'У выбранного провайдера пока нет URL сайта. Добавьте адрес сайта в настройках сервера.')); } catch (alertError) {}
        return;
      }
    }

    if (api && typeof api.materializeSitePreview === 'function' && typeof api.openSitePreviewExternal === 'function') {
      try {
        var preview = await materializePreviewPackage(state, home);
        if (preview && preview.ok) {
          await openPreviewUrlInExternal(preview, preview.indexUrl);
          return;
        }
      } catch (error) {
        log('Open whole site preview failed, falling back to popup/download', error);
      }
    }

    var html = renderSiteHtml(state, home, { linkMode: 'hash', inlineAssets: true });
    var win = null;
    try { win = window.open('', '_blank', 'width=1440,height=980'); } catch (error2) {}
    if (!win) {
      downloadText('site-preview.html', html, 'text/html;charset=utf-8');
      alert(t('Popup was blocked. HTML preview was downloaded instead.', 'Окно было заблокировано. HTML предпросмотра скачан вместо открытия окна.'));
      return;
    }
    try {
      win.document.open();
      win.document.write(html);
      win.document.close();
    } catch (error3) {
      downloadText('site-preview.html', html, 'text/html;charset=utf-8');
    }
  }

  async function openCurrentPageInBrowser() {
    var state = readState();
    var page = activePage(state);
    var api = window.nsAPI || null;

    if (api && typeof api.materializeSitePreview === 'function' && typeof api.openSitePreviewExternal === 'function') {
      try {
        var preview = await materializePreviewPackage(state, page);
        if (preview && preview.ok) {
          await openPreviewUrlInExternal(preview, preview.activePageUrl || preview.indexUrl);
          return;
        }
      } catch (error) {
        log('Open current page preview failed, falling back to popup/download', error);
      }
    }

    var html = renderSiteHtml(state, page, { linkMode: 'hash', inlineAssets: true });
    var win = null;
    try { win = window.open('', '_blank', 'width=1440,height=980'); } catch (error2) {}
    if (!win) {
      downloadText((page.slug || 'page') + '.html', html, 'text/html;charset=utf-8');
      alert(t('Popup was blocked. Current page HTML was downloaded instead.', 'Окно было заблокировано. HTML текущей страницы скачан вместо открытия окна.'));
      return;
    }
    try {
      win.document.open();
      win.document.write(html);
      win.document.close();
    } catch (error3) {
      downloadText((page.slug || 'page') + '.html', html, 'text/html;charset=utf-8');
    }
  }

  async function refreshPreviewFrame() {
    if (!overlay || activeTab !== 'preview') return;
    var requestId = ++previewRequestId;
    var frame = overlay.querySelector('[data-v5-preview-frame="1"]');
    var status = overlay.querySelector('[data-v5-preview-status="1"]');
    var address = overlay.querySelector('[data-v5-preview-address="1"]');
    if (!frame) return;
    if (status) status.textContent = t('Building preview…', 'Сборка предпросмотра…');
    var state = readState();
    var page = activePage(state);
    try {
      var preview = await materializePreviewPackage(state, page);
      if (requestId !== previewRequestId || !overlay || activeTab !== 'preview') return;
      if (preview && preview.ok && preview.activePageUrl) {
        frame.src = preview.activePageUrl;
        if (address) address.textContent = 'local-preview://' + (preview.activeFileName || 'index.html');
        if (status) status.textContent = t('Selected page is shown from the shared build. Top-level pages appear in navigation; nested pages appear in dropdown submenus. “Open site” opens Home / index.html.', 'Показана выбранная страница из общей сборки. Верхние страницы видны в навигации, вложенные страницы — в выпадающем подменю. Кнопка “Открыть сайт” откроет Главную / index.html.');
        return;
      }
    } catch (error) {
      log('Inline preview materialize failed, using data URL', error);
    }
    if (requestId !== previewRequestId || !overlay || activeTab !== 'preview') return;
    var fallbackHtml = renderSiteHtml(state, page, { linkMode: 'hash', inlineAssets: true });
    frame.src = 'data:text/html;charset=utf-8,' + encodeURIComponent(fallbackHtml);
    if (address) address.textContent = 'local-preview://fallback/' + (page.slug || 'page');
    if (status) status.textContent = t('Fallback preview is shown without writing to disk.', 'Показан fallback-предпросмотр без записи на диск.');
  }


  function downloadCurrentHtml() {
    var state = readState();
    var page = activePage(state);
    var filename = (page.slug || 'index') + '.html';
    downloadText(filename, renderSiteHtml(state, page, { linkMode: 'file', inlineAssets: true }), 'text/html;charset=utf-8');
    try { alert(t('HTML saved as ', 'HTML сохранён как ') + filename); } catch (error) {}
  }

  async function downloadSiteZip() {
    var state = readState();
    var page = activePage(state);
    var payload = createPreviewPayload(state, page);
    payload.fileName = slugify(state.site && state.site.name || 'irgeztne-site') + '.zip';
    payload.title = state.site && state.site.name || payload.title || 'IRGEZTNE Site';
    var api = window.nsAPI || null;
    if (api && typeof api.exportSiteZip === 'function') {
      try {
        var result = await api.exportSiteZip(payload);
        if (result && result.canceled) return;
        if (result && result.ok) {
          updatePublishStatus('manual', 'ok: ' + t('ZIP exported. Folder was opened.', 'ZIP экспортирован. Папка открыта.'), { lastPublishedAt: new Date().toISOString(), lastBuildFiles: Object.keys(payload.package || {}) });
          return;
        }
      } catch (error) {
        log('Site ZIP export failed', error);
      }
    }
    downloadText('site-preview.html', renderSiteHtml(state, findHomePage(state) || page, { linkMode: 'file' }), 'text/html;charset=utf-8');
    try { alert(t('ZIP export is unavailable. index HTML was downloaded instead.', 'ZIP export недоступен. Вместо него скачан index HTML.')); } catch (error2) {}
  }

  function scrollPublishAnchor(selector, mode) {
    function runScroll() {
      var target = overlay && overlay.querySelector(selector);
      if (!target) return;
      var scroller = overlay.querySelector('.ir-site-studio-v5-workspace') || overlay.querySelector('.ir-site-studio-v5-body') || null;
      if (scroller && typeof scroller.scrollTo === 'function' && typeof scroller.getBoundingClientRect === 'function') {
        var scrollerRect = scroller.getBoundingClientRect();
        var targetRect = target.getBoundingClientRect();
        var top = (scroller.scrollTop || 0) + (targetRect.top - scrollerRect.top) - 18;
        if (mode === 'center') {
          top = (scroller.scrollTop || 0) + (targetRect.top - scrollerRect.top) - Math.max(24, (scroller.clientHeight - targetRect.height) / 2);
        }
        scroller.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
        return;
      }
      if (target && typeof target.scrollIntoView === 'function') target.scrollIntoView({ block: mode === 'center' ? 'center' : 'start', behavior: 'smooth' });
    }
    try {
      window.requestAnimationFrame(function () {
        runScroll();
        window.setTimeout(runScroll, 120);
      });
    } catch (error) {
      try { runScroll(); } catch (error2) {}
    }
  }

  function updatePublishStatus(providerId, message, extra) {
    var state = readState();
    state.site.publishSettings = normalizePublishSettings(state.site.publishSettings);
    providerId = providerId || state.site.publishSettings.selectedProvider || 'manual';
    var config = state.site.publishSettings.providers[providerId] || defaultPublishProviderConfig(providerId);
    config.lastStatus = message || '';
    config.lastResult = String(message || '').indexOf('ok:') === 0 ? 'ok' : (String(message || '').indexOf('warn:') === 0 ? 'warn' : 'info');
    if (extra && extra.lastTestedAt) config.lastTestedAt = extra.lastTestedAt;
    if (extra && extra.lastPublishedAt) config.lastPublishedAt = extra.lastPublishedAt;
    if (extra && typeof extra.enabled === 'boolean') config.enabled = extra.enabled;
    if (extra && extra.patch && typeof extra.patch === 'object') {
      Object.keys(extra.patch).forEach(function (key) {
        if (Object.prototype.hasOwnProperty.call(config, key)) config[key] = extra.patch[key];
      });
    }
    state.site.publishSettings.providers[providerId] = config;
    if (providerId !== 'manual' || state.site.publishSettings.selectedProvider === 'manual') {
      state.site.publishSettings.selectedProvider = providerId;
    }
    if (extra && Array.isArray(extra.lastBuildFiles)) {
      state.site.publishSettings.lastBuildFiles = extra.lastBuildFiles;
      state.site.publishSettings.lastBuildAt = new Date().toISOString();
    }
    writeState(state);
    activeTab = 'server';
    renderStudio();
    scrollPublishAnchor('[data-v5-publish-settings="1"]', 'start');
  }

  function savePublishSettings() {
    var state = readState();
    state.site.publishSettings = normalizePublishSettings(state.site.publishSettings);
    var providerId = state.site.publishSettings.selectedProvider || 'manual';
    var config = state.site.publishSettings.providers[providerId] || defaultPublishProviderConfig(providerId);
    var meta = publishProviderMeta(providerId);
    var missing = publishMissingFields(config, meta);
    if (missing.length) {
      setPublishProgress(0, '', false);
      updatePublishStatus(providerId, 'warn: ' + t('Saved draft, but required fields are still missing: ', 'Черновик сохранён, но ещё не заполнены обязательные поля: ') + missing.map(publishFieldLabel).join(', '), { lastTestedAt: new Date().toISOString(), enabled: false });
      return;
    }
    if (providerId === 'netlify' || providerId === 'cloudflare') {
      updatePublishStatus(providerId, 'info: ' + t('Server saved. Press Test connection once to verify it.', 'Сервер сохранён. Один раз нажмите «Проверить подключение», чтобы подтвердить связь.'), { lastTestedAt: new Date().toISOString(), enabled: false });
      return;
    }
    updatePublishStatus(providerId, 'ok: ' + t('Settings saved. This website can now be published repeatedly without re-entering the connection data.', 'Настройки сохранены. Теперь этот сайт можно публиковать повторно без повторного ввода данных подключения.'), { lastTestedAt: new Date().toISOString(), enabled: true });
  }

  async function testNetlifyConnection(config) {
    var token = String(readPublishSecretValue('netlify', config, 'token') || '').trim();
    var siteId = String(config && config.siteId || '').trim();
    if (!token || !siteId) return { ok: false, status: 'warn: ' + t('Fill required fields: ', 'Заполните обязательные поля: ') + [publishFieldLabel('token'), publishFieldLabel('siteId')].join(', ') };
    if (looksLikeMaskedSecret(token)) return { ok: false, status: 'warn: ' + t('Paste the full Netlify token, not the masked preview.', 'Вставьте полный Netlify token, а не замаскированный preview.') };
    var endpoint = 'https://api.netlify.com/api/v1/sites/' + encodeURIComponent(siteId);
    var response;
    try {
      response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer ' + token,
          'User-Agent': 'IRGEZTNE Workspace',
          'Accept': 'application/json'
        }
      });
    } catch (error) {
      return { ok: false, status: 'warn: ' + t('Netlify API is unavailable in this environment: ', 'Netlify API недоступен в этой среде: ') + (error && error.message ? error.message : String(error || 'network error')) };
    }
    var raw = '';
    var data = null;
    try { raw = await response.text(); } catch (error2) { raw = ''; }
    try { data = raw ? JSON.parse(raw) : null; } catch (error3) { data = null; }
    if (response.status === 401 || response.status === 403) {
      return { ok: false, status: 'warn: ' + t('Netlify access denied. Check token.', 'Netlify отклонил доступ. Проверьте token.') + ' HTTP ' + response.status };
    }
    if (response.status === 404) {
      return { ok: false, status: 'warn: ' + t('Netlify token works, but the selected site was not found.', 'Netlify token работает, но выбранный сайт не найден.') };
    }
    if (response.status === 429) {
      return { ok: false, status: 'warn: ' + t('Netlify rate limit reached. Try again later.', 'Лимит Netlify достигнут. Попробуйте позже.') };
    }
    if (!response.ok) {
      var message = data && (data.message || data.error) ? (data.message || data.error) : ('HTTP ' + response.status);
      return { ok: false, status: 'warn: ' + t('Netlify connection failed: ', 'Ошибка подключения Netlify: ') + message };
    }
    var siteName = data && (data.name || data.id) ? (data.name || data.id) : siteId;
    var siteUrl = data && (data.ssl_url || data.url) ? (data.ssl_url || data.url) : (config.websiteUrl || '');
    var adminUrl = data && data.admin_url ? data.admin_url : '';
    var connectedText = siteName + (siteUrl ? ' · ' + siteUrl : '');
    return {
      ok: true,
      status: 'ok: ' + t('Netlify connected: ', 'Netlify подключён: ') + connectedText,
      patch: {
        websiteUrl: siteUrl || config.websiteUrl || '',
        projectName: siteName || config.projectName || '',
        endpoint: adminUrl || config.endpoint || ''
      }
    };
  }

  async function testCloudflarePagesConnection(config) {
    var token = String(readPublishSecretValue('cloudflare', config, 'token') || '').trim();
    var accountId = String(config && config.accountId || '').trim();
    var projectName = String(config && config.projectName || '').trim();
    if (!token || !accountId || !projectName) return { ok: false, status: 'warn: ' + t('Fill required fields: ', 'Заполните обязательные поля: ') + [publishFieldLabel('token'), publishFieldLabel('accountId'), publishFieldLabel('projectName')].join(', ') };
    if (looksLikeMaskedSecret(token)) return { ok: false, status: 'warn: ' + t('Paste the full Cloudflare token, not the masked preview.', 'Вставьте полный Cloudflare token, а не замаскированный preview.') };
    var api = window.nsAPI || null;
    if (!api || typeof api.testCloudflarePages !== 'function') {
      return { ok: false, status: 'warn: ' + t('Cloudflare Pages API is unavailable in this build.', 'Cloudflare Pages API недоступен в этой сборке.') };
    }
    var result;
    try {
      result = await api.testCloudflarePages({ token: token, accountId: accountId, projectName: projectName, websiteUrl: config.websiteUrl || '' });
    } catch (error) {
      return { ok: false, status: 'warn: ' + t('Cloudflare Pages connection failed: ', 'Ошибка подключения Cloudflare Pages: ') + (error && error.message ? error.message : String(error || 'network error')) };
    }
    if (!result || result.ok !== true) {
      return { ok: false, status: 'warn: ' + t('Cloudflare Pages connection failed: ', 'Ошибка подключения Cloudflare Pages: ') + (result && result.message ? result.message : t('Cloudflare Pages project was not found or token was rejected.', 'Cloudflare Pages project не найден или token отклонён.')) };
    }
    var name = result.projectName || projectName;
    var siteUrl = result.websiteUrl || config.websiteUrl || '';
    return {
      ok: true,
      status: 'ok: ' + t('Cloudflare Pages connected: ', 'Cloudflare Pages подключён: ') + name + (siteUrl ? ' · ' + siteUrl : ''),
      patch: {
        websiteUrl: siteUrl || config.websiteUrl || '',
        projectName: name || config.projectName || '',
        branch: config.branch || 'main'
      }
    };
  }


  async function testPublishSettings() {
    var state = readState();
    state.site.publishSettings = normalizePublishSettings(state.site.publishSettings);
    var providerId = state.site.publishSettings.selectedProvider || 'manual';
    var config = state.site.publishSettings.providers[providerId] || defaultPublishProviderConfig(providerId);
    var meta = publishProviderMeta(providerId);
    var missing = publishMissingFields(config, meta);
    if (missing.length) {
      setPublishProgress(0, '', false);
      updatePublishStatus(providerId, 'warn: ' + t('Fill required fields: ', 'Заполните обязательные поля: ') + missing.map(publishFieldLabel).join(', '), { lastTestedAt: new Date().toISOString(), enabled: false, scrollToStatus: true });
      return;
    }
    if (providerId === 'netlify') {
      updatePublishStatus(providerId, 'info: ' + t('Testing Netlify connection…', 'Проверка подключения Netlify…'), { lastTestedAt: new Date().toISOString(), enabled: false, scrollToStatus: true });
      var result = await testNetlifyConnection(config);
      updatePublishStatus(providerId, result.status, { lastTestedAt: new Date().toISOString(), enabled: result.ok === true, patch: result.patch || {}, scrollToStatus: true });
      return;
    }
    if (providerId === 'cloudflare') {
      updatePublishStatus(providerId, 'info: ' + t('Testing Cloudflare Pages connection…', 'Проверка подключения Cloudflare Pages…'), { lastTestedAt: new Date().toISOString(), enabled: false, scrollToStatus: true });
      var cfResult = await testCloudflarePagesConnection(config);
      updatePublishStatus(providerId, cfResult.status, { lastTestedAt: new Date().toISOString(), enabled: cfResult.ok === true, patch: cfResult.patch || {}, scrollToStatus: true });
      return;
    }
    updatePublishStatus(providerId, 'ok: ' + t('Settings saved and ready. Next publishes can use this saved provider setup.', 'Настройки сохранены и готовы. Следующие публикации смогут использовать эту сохранённую настройку провайдера.'), { lastTestedAt: new Date().toISOString(), enabled: true, scrollToStatus: true });
  }

  function describeNetlifyDeployResult(result, config) {
    var state = String(result && result.state || '').trim();
    var url = String(result && (result.websiteUrl || result.deployUrl) || config && config.websiteUrl || '').trim();
    var deployId = String(result && result.deployId || '').trim();
    var parts = [];
    if (url) parts.push(url);
    if (state) parts.push('status: ' + state);
    if (deployId) parts.push('deploy: ' + deployId.slice(0, 10));
    return parts.join(' · ') || t('deploy created', 'deploy создан');
  }

  function netlifyConnectionLooksVerified(config) {
    if (!config) return false;
    if (config.enabled === true) return true;
    var status = String(config.lastStatus || '').toLowerCase();
    return status.indexOf('ok:') === 0 && (status.indexOf('netlify connected') !== -1 || status.indexOf('netlify подключ') !== -1);
  }

  function describeCloudflareDeployResult(result, config) {
    var state = String(result && result.state || '').trim();
    var url = String(result && result.websiteUrl || config && config.websiteUrl || '').trim();
    var deployId = String(result && result.deployId || '').trim();
    var parts = [];
    if (url) parts.push(url);
    if (state) parts.push('status: ' + state);
    if (deployId) parts.push('deploy: ' + deployId.slice(0, 10));
    return parts.join(' · ') || t('deployment created', 'deployment создан');
  }

  function cloudflareConnectionLooksVerified(config) {
    if (!config) return false;
    if (config.enabled === true) return true;
    var status = String(config.lastStatus || '').toLowerCase();
    return status.indexOf('ok:') === 0 && (status.indexOf('cloudflare pages connected') !== -1 || status.indexOf('cloudflare pages подключ') !== -1 || status.indexOf('сайт опубликован на cloudflare') !== -1);
  }

  async function publishCloudflarePagesDeploy(state, config, payload) {
    var api = window.nsAPI || null;
    if (!api || typeof api.publishCloudflarePages !== 'function') {
      setPublishProgress(0, '', false);
      updatePublishStatus('cloudflare', 'warn: ' + t('Cloudflare Pages API is unavailable in this build.', 'Cloudflare Pages API недоступен в этой сборке.'), { enabled: !!config.enabled, lastBuildFiles: Object.keys(payload.package || {}) });
      return;
    }
    if (!cloudflareConnectionLooksVerified(config)) {
      setPublishProgress(0, '', false);
      updatePublishStatus('cloudflare', 'warn: ' + t('Check Cloudflare Pages connection before publishing.', 'Сначала проверьте подключение Cloudflare Pages.'), { enabled: false, lastBuildFiles: Object.keys(payload.package || {}) });
      return;
    }
    if (!payload || !payload.package || !payload.package['index.html']) {
      setPublishProgress(0, '', false);
      updatePublishStatus('cloudflare', 'warn: ' + t('Cloudflare Pages needs index.html in the site root.', 'Cloudflare Pages нужен index.html в корне сайта.'), { enabled: !!config.enabled, lastBuildFiles: Object.keys(payload && payload.package || {}) });
      return;
    }

    updatePublishStatus('cloudflare', 'info: ' + t('Publishing to Cloudflare Pages…', 'Публикация на Cloudflare Pages…'), { enabled: true, lastBuildFiles: Object.keys(payload.package || {}) });

    try {
      var result = await api.publishCloudflarePages({
        token: readPublishSecretValue('cloudflare', config, 'token'),
        accountId: config.accountId,
        projectName: config.projectName,
        branch: config.branch || 'main',
        websiteUrl: config.websiteUrl,
        title: (state.site && state.site.name ? state.site.name : 'IRGEZTNE Site') + ' · Cloudflare Pages deploy',
        fileName: slugify(state.site && state.site.name || 'irgeztne-site') + '.zip',
        package: payload.package || {}
      });
      if (!result || !result.ok) {
        var statusCode = result && result.status ? ' HTTP ' + result.status : '';
        var message = result && result.message ? result.message : t('unknown error', 'неизвестная ошибка');
        setPublishProgress(0, '', false);
        updatePublishStatus('cloudflare', 'warn: ' + t('Cloudflare Pages publish failed: ', 'Ошибка публикации Cloudflare Pages: ') + message + statusCode, { enabled: !!config.enabled, lastBuildFiles: Object.keys(payload.package || {}) });
        return;
      }
      var url = String(result.websiteUrl || config.websiteUrl || '').trim();
      updatePublishStatus('cloudflare', 'ok: ' + t('Site published on Cloudflare Pages: ', 'Сайт опубликован на Cloudflare Pages: ') + describeCloudflareDeployResult(result, config), {
        enabled: true,
        lastPublishedAt: result.publishedAt || new Date().toISOString(),
        lastBuildFiles: Array.isArray(result.files) ? result.files : Object.keys(payload.package || {}),
        patch: {
          websiteUrl: url || config.websiteUrl || '',
          projectName: result.projectName || config.projectName || '',
          branch: config.branch || 'main'
        }
      });
    } catch (error) {
      setPublishProgress(0, '', false);
      updatePublishStatus('cloudflare', 'warn: ' + t('Cloudflare Pages publish failed: ', 'Ошибка публикации Cloudflare Pages: ') + (error && error.message ? error.message : String(error || 'network error')), { enabled: !!config.enabled, lastBuildFiles: Object.keys(payload.package || {}) });
    }
  }


  async function publishNetlifyZipDeploy(state, config, payload) {
    var api = window.nsAPI || null;
    if (!api || typeof api.publishNetlifyZip !== 'function') {
      setPublishProgress(0, '', false);
      updatePublishStatus('netlify', 'warn: ' + t('Netlify ZIP publish is unavailable in this build.', 'Netlify ZIP publish недоступен в этой сборке.'), { enabled: !!config.enabled, lastBuildFiles: Object.keys(payload.package || {}) });
      return;
    }
    if (!netlifyConnectionLooksVerified(config)) {
      setPublishProgress(0, '', false);
      updatePublishStatus('netlify', 'warn: ' + t('Check Netlify connection before publishing.', 'Сначала проверьте подключение Netlify.'), { enabled: false, lastBuildFiles: Object.keys(payload.package || {}) });
      return;
    }

    updatePublishStatus('netlify', 'info: ' + t('Publishing to Netlify…', 'Публикация на Netlify…'), { enabled: true, lastBuildFiles: Object.keys(payload.package || {}) });

    try {
      var result = await api.publishNetlifyZip({
        token: readPublishSecretValue('netlify', config, 'token'),
        siteId: config.siteId,
        websiteUrl: config.websiteUrl,
        title: (state.site && state.site.name ? state.site.name : 'IRGEZTNE Site') + ' · Web Studio ZIP deploy',
        fileName: slugify(state.site && state.site.name || 'irgeztne-site') + '.zip',
        package: payload.package || {}
      });
      if (!result || !result.ok) {
        var statusCode = result && result.status ? ' HTTP ' + result.status : '';
        var message = result && result.message ? result.message : t('unknown error', 'неизвестная ошибка');
        setPublishProgress(0, '', false);
        setPublishProgress(0, '', false);
      updatePublishStatus('netlify', 'warn: ' + t('Netlify publish failed: ', 'Ошибка публикации Netlify: ') + message + statusCode, { enabled: !!config.enabled, lastBuildFiles: Object.keys(payload.package || {}) });
        return;
      }
      var deployState = String(result.state || '').toLowerCase();
      var prefix = t('Site published on Netlify: ', 'Сайт опубликован на Netlify: ');
      var url = String(result.websiteUrl || config.websiteUrl || '').trim();
      updatePublishStatus('netlify', 'ok: ' + prefix + describeNetlifyDeployResult(result, config), {
        enabled: true,
        lastPublishedAt: result.publishedAt || new Date().toISOString(),
        lastBuildFiles: Array.isArray(result.files) ? result.files : Object.keys(payload.package || {}),
        patch: {
          websiteUrl: url || config.websiteUrl || '',
          projectName: config.projectName || ''
        }
      });
    } catch (error) {
      setPublishProgress(0, '', false);
      updatePublishStatus('netlify', 'warn: ' + t('Netlify publish failed: ', 'Ошибка публикации Netlify: ') + (error && error.message ? error.message : String(error || 'network error')), { enabled: !!config.enabled, lastBuildFiles: Object.keys(payload.package || {}) });
    }
  }

  async function publishFoundation() {
    setPublishProgress(12, t('Preparing website build…', 'Подготовка сборки сайта…'), activeTab === 'server' || activeTab === 'publish');
    var state = readState();
    state.site.publishSettings = normalizePublishSettings(state.site.publishSettings);
    var providerId = state.site.publishSettings.selectedProvider || 'manual';
    var config = state.site.publishSettings.providers[providerId] || defaultPublishProviderConfig(providerId);
    var meta = publishProviderMeta(providerId);
    var missing = publishMissingFields(config, meta);
    if (missing.length) {
      setPublishProgress(0, '', false);
      updatePublishStatus(providerId, 'warn: ' + t('Publish blocked. Fill required fields first: ', 'Публикация остановлена. Сначала заполните поля: ') + missing.map(publishFieldLabel).join(', '), { lastTestedAt: new Date().toISOString(), enabled: false });
      return;
    }
    setPublishProgress(35, t('Collecting pages and files…', 'Собираем страницы и файлы…'), activeTab === 'server' || activeTab === 'publish');
    var payload = createPreviewPayload(state, activePage(state));
    if (providerId === 'netlify') {
      if (!netlifyConnectionLooksVerified(config)) {
        setPublishProgress(55, t('Checking Netlify connection…', 'Проверяем подключение Netlify…'), activeTab === 'server' || activeTab === 'publish');
        updatePublishStatus('netlify', 'info: ' + t('Checking Netlify before publishing…', 'Проверяем Netlify перед публикацией…'), { enabled: false, lastBuildFiles: Object.keys(payload.package || {}) });
        var result = await testNetlifyConnection(config);
        if (!result || result.ok !== true) {
          updatePublishStatus('netlify', result && result.status ? result.status : ('warn: ' + t('Check Netlify connection before publishing.', 'Сначала проверьте подключение Netlify.')), { enabled: false, lastTestedAt: new Date().toISOString(), lastBuildFiles: Object.keys(payload.package || {}) });
          return;
        }
        state = readState();
        state.site.publishSettings = normalizePublishSettings(state.site.publishSettings);
        config = state.site.publishSettings.providers.netlify || defaultPublishProviderConfig('netlify');
        if (result.patch && typeof result.patch === 'object') {
          Object.keys(result.patch).forEach(function (key) {
            if (Object.prototype.hasOwnProperty.call(config, key)) config[key] = result.patch[key];
          });
        }
        config.enabled = true;
        config.lastResult = 'ok';
        config.lastStatus = result.status || ('ok: ' + t('Netlify connected: ', 'Netlify подключён: ') + (config.websiteUrl || config.siteId));
        config.lastTestedAt = new Date().toISOString();
        state.site.publishSettings.providers.netlify = config;
        writeState(state);
      }
      setPublishProgress(72, t('Uploading ZIP to Netlify…', 'Отправляем ZIP на Netlify…'), activeTab === 'server' || activeTab === 'publish');
      await publishNetlifyZipDeploy(state, config, payload);
      setPublishProgress(100, t('Last publication', 'Последняя публикация'), activeTab === 'server' || activeTab === 'publish');
      return;
    }
    if (providerId === 'cloudflare') {
      if (!cloudflareConnectionLooksVerified(config)) {
        setPublishProgress(55, t('Checking Cloudflare Pages connection…', 'Проверяем подключение Cloudflare Pages…'), activeTab === 'server' || activeTab === 'publish');
        updatePublishStatus('cloudflare', 'info: ' + t('Checking Cloudflare Pages before publishing…', 'Проверяем Cloudflare Pages перед публикацией…'), { enabled: false, lastBuildFiles: Object.keys(payload.package || {}) });
        var cfResult = await testCloudflarePagesConnection(config);
        if (!cfResult || cfResult.ok !== true) {
          updatePublishStatus('cloudflare', cfResult && cfResult.status ? cfResult.status : ('warn: ' + t('Check Cloudflare Pages connection before publishing.', 'Сначала проверьте подключение Cloudflare Pages.')), { enabled: false, lastTestedAt: new Date().toISOString(), lastBuildFiles: Object.keys(payload.package || {}) });
          return;
        }
        state = readState();
        state.site.publishSettings = normalizePublishSettings(state.site.publishSettings);
        config = state.site.publishSettings.providers.cloudflare || defaultPublishProviderConfig('cloudflare');
        if (cfResult.patch && typeof cfResult.patch === 'object') {
          Object.keys(cfResult.patch).forEach(function (key) {
            if (Object.prototype.hasOwnProperty.call(config, key)) config[key] = cfResult.patch[key];
          });
        }
        config.enabled = true;
        config.lastResult = 'ok';
        config.lastStatus = cfResult.status || ('ok: ' + t('Cloudflare Pages connected: ', 'Cloudflare Pages подключён: ') + (config.websiteUrl || config.projectName));
        config.lastTestedAt = new Date().toISOString();
        state.site.publishSettings.providers.cloudflare = config;
        writeState(state);
      }
      setPublishProgress(72, t('Uploading to Cloudflare Pages…', 'Отправляем на Cloudflare Pages…'), activeTab === 'server' || activeTab === 'publish');
      await publishCloudflarePagesDeploy(state, config, payload);
      setPublishProgress(100, t('Website published', 'Сайт опубликован'), activeTab === 'server' || activeTab === 'publish');
      return;
    }
    setPublishProgress(100, t('Build ready', 'Сборка готова'), false);
    updatePublishStatus(providerId, 'ok: ' + t('Build is ready. Saved provider setup will be reused for the next publish.', 'Сборка готова. Сохранённая настройка провайдера будет использоваться для следующей публикации.'), { lastPublishedAt: new Date().toISOString(), enabled: true, lastBuildFiles: Object.keys(payload.package || {}) });
  }


  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(function () {});
    } else {
      var area = document.createElement('textarea');
      area.value = text;
      document.body.appendChild(area);
      area.select();
      try { document.execCommand('copy'); } catch (error) {}
      area.remove();
    }
  }

  function pageDepth(state, page) {
    var depth = 0;
    var cursor = page;
    var guard = 0;
    while (cursor && cursor.parentId && guard < 20) {
      cursor = state.pages.find(function (candidate) { return candidate.id === cursor.parentId; });
      if (cursor) depth += 1;
      guard += 1;
    }
    return depth;
  }


  function orderedPageEntries(state) {
    var pages = Array.isArray(state.pages) ? state.pages.slice() : [];
    var exists = {};
    pages.forEach(function (page) { exists[page.id] = true; });
    var groups = {};
    pages.forEach(function (page) {
      var parentId = page.parentId && exists[page.parentId] ? page.parentId : '';
      if (!groups[parentId]) groups[parentId] = [];
      groups[parentId].push(page);
    });
    Object.keys(groups).forEach(function (key) {
      groups[key].sort(function (a, b) { return Number(a.order || 0) - Number(b.order || 0); });
    });
    var result = [];
    function visit(parentId, depth) {
      (groups[parentId || ''] || []).forEach(function (page) {
        result.push({ page: page, depth: depth });
        visit(page.id, depth + 1);
      });
    }
    visit('', 0);
    pages.forEach(function (page) {
      if (!result.some(function (entry) { return entry.page.id === page.id; })) result.push({ page: page, depth: 0 });
    });
    return result;
  }

  function orderedPageList(state) {
    return orderedPageEntries(state).map(function (entry) { return entry.page; });
  }

  function childPagesOf(state, parentId) {
    return orderedPageList(state).filter(function (page) { return page.parentId === parentId; });
  }

  function setPageParent(state, pageId, parentId) {
    var page = (state.pages || []).find(function (item) { return item.id === pageId; });
    if (!page) return false;
    parentId = parentId || '';
    if (parentId === page.id || (parentId && isChildOf(state, parentId, page.id))) return false;
    page.parentId = parentId;
    page.updatedAt = new Date().toISOString();
    state.activePageId = page.id;
    return true;
  }

  function indentPage(pageId) {
    var state = readState();
    var entries = orderedPageEntries(state);
    var index = entries.findIndex(function (entry) { return entry.page.id === pageId; });
    if (index <= 0) return;
    var previous = entries[index - 1].page;
    if (!setPageParent(state, pageId, previous.id)) return;
    writeState(state);
    activeTab = 'pages';
    renderStudio();
  }

  function outdentPage(pageId) {
    var state = readState();
    var page = (state.pages || []).find(function (item) { return item.id === pageId; });
    if (!page || !page.parentId) return;
    var parent = (state.pages || []).find(function (item) { return item.id === page.parentId; });
    page.parentId = parent && parent.parentId ? parent.parentId : '';
    page.updatedAt = new Date().toISOString();
    state.activePageId = page.id;
    writeState(state);
    activeTab = 'pages';
    renderStudio();
  }

  function movePageToRoot(pageId) {
    var state = readState();
    if (!setPageParent(state, pageId, '')) return;
    writeState(state);
    activeTab = 'pages';
    renderStudio();
  }

  function fontStack(value) {
    var key = String(value || 'Inter').toLowerCase();
    if (key === 'system') return 'system-ui,-apple-system,Segoe UI,sans-serif';
    if (key === 'serif') return 'Georgia,Times New Roman,serif';
    if (key === 'mono') return 'ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace';
    if (key === 'geometric') return 'Montserrat,Inter,system-ui,sans-serif';
    if (key === 'manrope') return 'Manrope,Inter,system-ui,sans-serif';
    if (key === 'montserrat') return 'Montserrat,Inter,system-ui,sans-serif';
    if (key === 'rubik') return 'Rubik,Inter,system-ui,sans-serif';
    if (key === 'nunito') return 'Nunito,Inter,system-ui,sans-serif';
    if (key === 'comfortaa') return 'Comfortaa,Inter,system-ui,sans-serif';
    if (key === 'oswald') return 'Oswald,Arial,sans-serif';
    if (key === 'playfair') return 'Playfair Display,Georgia,serif';
    if (key === 'jetbrains') return 'JetBrains Mono,ui-monospace,monospace';
    return 'Inter,system-ui,-apple-system,Segoe UI,sans-serif';
  }

  function fontOptions(selected) {
    var options = [
      ['Inter', 'Inter / modern'],
      ['system', 'System UI'],
      ['Manrope', 'Manrope / clean'],
      ['Montserrat', 'Montserrat / brand'],
      ['Rubik', 'Rubik / friendly'],
      ['Nunito', 'Nunito / soft'],
      ['Comfortaa', 'Comfortaa / rounded'],
      ['Oswald', 'Oswald / headline'],
      ['Playfair', 'Playfair Display / editorial'],
      ['serif', 'Serif / editorial'],
      ['geometric', 'Geometric / brand'],
      ['JetBrains', 'JetBrains Mono / technical'],
      ['mono', 'Mono / technical']
    ];
    return options.map(function (item) {
      return '<option value="' + escapeHtml(item[0]) + '"' + (String(selected || 'Inter') === item[0] ? ' selected' : '') + '>' + escapeHtml(item[1]) + '</option>';
    }).join('');
  }

  function normalizeHexColor(value, fallback) {
    var raw = String(value || '').trim();
    if (/^#[0-9a-fA-F]{6}$/.test(raw)) return raw;
    if (/^#[0-9a-fA-F]{3}$/.test(raw)) {
      return '#' + raw.slice(1).split('').map(function (ch) { return ch + ch; }).join('');
    }
    return fallback || '#ffffff';
  }

  function colorControl(field, label, value, fallback) {
    var safe = normalizeHexColor(value, fallback);
    var textValue = String(value || safe || '').trim() || safe;
    return '<div class="ir-site-studio-v5-setting-row ir-site-studio-v5-color-row"><label>' + escapeHtml(label) + '</label>' +
      '<div class="ir-site-studio-v5-color-control">' +
        '<input class="ir-site-studio-v5-color-picker" type="color" data-v5-site-field="' + escapeHtml(field) + '" value="' + escapeHtml(safe) + '">' +
        '<input class="ir-site-studio-v5-input ir-site-studio-v5-color-text" data-v5-site-field="' + escapeHtml(field) + '" value="' + escapeHtml(textValue) + '" placeholder="#ffffff">' +
        '<span class="ir-site-studio-v5-color-chip" style="background:' + escapeHtml(safe) + '"></span>' +
      '</div></div>';
  }

  function colorSwatches(field, colors) {
    return '<div class="ir-site-studio-v5-swatches">' + colors.map(function (color) {
      return '<button class="ir-site-studio-v5-swatch" data-v5-action="set-site-color" data-v5-site-color-field="' + escapeHtml(field) + '" data-v5-site-color-value="' + escapeHtml(color) + '" style="background:' + escapeHtml(color) + '" type="button" title="' + escapeHtml(color) + '"></button>';
    }).join('') + '</div>';
  }

  function renderSidebar(state) {
    var entries = orderedPageEntries(state);
    return '<div class="ir-site-studio-v5-panel-head"><h3>' + escapeHtml(t('Pages', 'Страницы')) + '</h3><p>' + escapeHtml(t('Quick page list. Full management is now in the Pages tab.', 'Быстрый список страниц. Полное управление теперь во вкладке “Страницы”.')) + '</p><div class="ir-site-studio-v5-panel-actions"><button class="ir-site-studio-v5-btn ir-site-studio-v5-btn--primary ir-site-studio-v5-btn--sm" data-v5-action="new-page" type="button">+ ' + escapeHtml(t('New page', 'Новая страница')) + '</button></div></div>' +
      '<div class="ir-site-studio-v5-page-list">' + entries.map(function (entry) {
        var page = entry.page;
        var active = page.id === state.activePageId ? ' is-active' : '';
        var visibleName = pageLabel(page);
        var depth = entry.depth;
        return '<article class="ir-site-studio-v5-page-row' + active + '"><button class="ir-site-studio-v5-page-select" style="padding-left:' + (2 + depth * 14) + 'px" data-v5-action="select-page" data-v5-page-id="' + escapeHtml(page.id) + '" type="button"><strong>' + escapeHtml(visibleName) + '</strong><span>/' + escapeHtml(page.slug) + ' · ' + escapeHtml(page.status) + '</span></button></article>';
      }).join('') + '</div>';
  }

  /* IRGEZTNE_WEBSTUDIO_FOOTER_GROUPS_V059B2 */
  function footerGroupDefinitions() {
    return [
      { id: 'pages', en: 'Pages', ru: 'Страницы' },
      { id: 'product', en: 'Product', ru: 'Продукт' },
      { id: 'download', en: 'Download', ru: 'Скачать' },
      { id: 'contact', en: 'Contacts', ru: 'Контакты' },
      { id: 'legal', en: 'Legal', ru: 'Юридический раздел' }
    ];
  }

  function footerGroupLabel(groupId) {
    var id = String(groupId || 'pages');
    var groups = footerGroupDefinitions();
    var item = groups.find(function (group) { return group.id === id; }) || groups[0];
    return t(item.en, item.ru);
  }

  function normalizeFooterGroup(value, page) {
    var raw = String(value || '').trim().toLowerCase();
    var allowed = footerGroupDefinitions().map(function (group) { return group.id; });
    if (allowed.indexOf(raw) !== -1) return raw;

    var label = String((page && (page.pageName || page.title || page.headline || page.slug)) || '').toLowerCase();

    if (/privacy|terms|policy|legal|license|политик|услов|правов|юрид|лиценз/.test(label)) return 'legal';
    if (/contact|support|email|help|контакт|поддерж|почт/.test(label)) return 'contact';
    if (/download|release|github|скач|релиз|загруз/.test(label)) return 'download';
    if (/about|docs|documentation|features|templates|о нас|докум|возможн|шаблон/.test(label)) return 'product';

    return 'pages';
  }

  function footerGroupOptionsHtml(selected, page) {
    var current = normalizeFooterGroup(selected, page);
    return footerGroupDefinitions().map(function (group) {
      return '<option value="' + escapeHtml(group.id) + '"' + (group.id === current ? ' selected' : '') + '>' + escapeHtml(t(group.en, group.ru)) + '</option>';
    }).join('');
  }

  function renderSettings(state, page) {
    var parentOptions = '<option value="">' + escapeHtml(t('No parent', 'Без родителя')) + '</option>' + state.pages.filter(function (item) { return item.id !== page.id && !isChildOf(state, item.id, page.id); }).map(function (item) {
      return '<option value="' + escapeHtml(item.id) + '"' + (page.parentId === item.id ? ' selected' : '') + '>' + escapeHtml(pageLabel(item)) + '</option>';
    }).join('');
    return '<div class="ir-site-studio-v5-settings-head"><div><h3>' + escapeHtml(t('Page settings', 'Настройки страницы')) + '</h3><p>' + escapeHtml(t('Page name, slug, SEO, parent and footer placement are configured here.', 'Имя страницы, slug, SEO, родитель и меню подвала настраиваются здесь.')) + '</p></div><button class="ir-site-studio-v5-settings-close" data-v5-action="toggle-right" type="button" title="' + escapeHtml(t('Close settings', 'Закрыть настройки')) + '">×</button></div>' +
      '<div class="ir-site-studio-v5-settings-scroll">' +
      '<div class="ir-site-studio-v5-setting-row"><label>' + escapeHtml(t('Page name', 'Имя страницы')) + '</label><input class="ir-site-studio-v5-input" data-v5-field="pageName" value="' + escapeHtml(page.pageName || page.title || '') + '"></div>' +
      '<div class="ir-site-studio-v5-setting-row"><label>' + escapeHtml(t('Page address / Slug', 'Адрес страницы / Slug')) + '</label><input class="ir-site-studio-v5-input" data-v5-field="slug" value="' + escapeHtml(page.slug) + '"></div>' +
      '<div class="ir-site-studio-v5-setting-row"><label>' + escapeHtml(t('Short description', 'Краткое описание')) + '</label><textarea class="ir-site-studio-v5-textarea" data-v5-field="summary">' + escapeHtml(page.summary) + '</textarea></div>' +
      '<div class="ir-site-studio-v5-setting-row"><label>' + escapeHtml(t('SEO title', 'SEO заголовок')) + '</label><input class="ir-site-studio-v5-input" data-v5-field="seoTitle" value="' + escapeHtml(page.seoTitle || '') + '"></div>' +
      '<div class="ir-site-studio-v5-setting-row"><label>' + escapeHtml(t('SEO description', 'SEO описание')) + '</label><textarea class="ir-site-studio-v5-textarea" data-v5-field="seoDescription">' + escapeHtml(page.seoDescription || '') + '</textarea></div>' +
      '<div class="ir-site-studio-v5-setting-row"><label>' + escapeHtml(t('Status', 'Статус')) + '</label><select class="ir-site-studio-v5-select" data-v5-field="status"><option value="draft"' + (page.status === 'draft' ? ' selected' : '') + '>' + escapeHtml(t('Draft', 'Черновик')) + '</option><option value="published"' + (page.status === 'published' ? ' selected' : '') + '>' + escapeHtml(t('Published', 'Опубликовано')) + '</option></select></div>' +
      '<div class="ir-site-studio-v5-setting-row"><label>' + escapeHtml(t('Parent page', 'Родительская страница')) + '</label><select class="ir-site-studio-v5-select" data-v5-field="parentId">' + parentOptions + '</select></div>' +
      '<div class="ir-site-studio-v5-setting-row ir-site-studio-v5-page-placement"><label>' + escapeHtml(t('Page placement', 'Место показа страницы')) + '</label>' +
        '<label class="ir-site-studio-v5-checkline"><input type="checkbox" data-v5-field="inFooter"' + (page.inFooter ? ' checked' : '') + '> ' + escapeHtml(t('Show in footer menu', 'Показывать в меню подвала')) + '</label>' +
        '<label class="ir-site-studio-v5-mini-label">' + escapeHtml(t('Footer section', 'Раздел подвала')) + '</label>' +
        '<select class="ir-site-studio-v5-select" data-v5-field="footerGroup">' + footerGroupOptionsHtml(page.footerGroup, page) + '</select>' +
        '<p class="ir-site-studio-v5-note">' + escapeHtml(t('Footer section is used only when the footer checkbox is enabled.', 'Раздел подвала используется только когда включена галочка подвала.')) + '</p>' +
      '</div>' +
      '<button class="ir-site-studio-v5-btn ir-site-studio-v5-btn--primary" data-v5-action="save-page" type="button">' + escapeHtml(t('Save page', 'Сохранить страницу')) + '</button>' +
      '<p class="ir-site-studio-v5-note">' + escapeHtml(t('Parent page creates dropdown/submenu. Footer is controlled by the checkbox above.', 'Родительская страница создаёт подменю. Подвал управляется галочкой выше.')) + '</p>' +
      '</div>';
  }


  function renderNativeEditorToolbar() {

    function button(icon, labelEn, labelRu, attrs, extraClass) {
      var label = escapeHtml(t(labelEn, labelRu));
      return '<button class="ir-site-studio-v5-native-tool-btn ' + (extraClass || '') + '" ' + attrs + ' title="' + label + '" aria-label="' + label + '" onmousedown="event.preventDefault()" type="button">' + escapeHtml(icon) + '</button>';
    }

    function select(labelEn, labelRu, attrs, options) {
      var label = escapeHtml(t(labelEn, labelRu));
      return '<label class="ir-site-studio-v5-native-select-label"><span>' + label + '</span><select class="ir-site-studio-v5-native-select" ' + attrs + '>' + options + '</select></label>';
    }

    return '<div class="ir-site-studio-v5-native-editor-toolbar ir-site-studio-v5-native-editor-toolbar--publii" data-v5-native-toolbar="1" data-v078a-publii-shell="1">' +

      '<div class="ir-site-studio-v5-publii-row ir-site-studio-v5-publii-row--main">' +

        '<div class="ir-site-studio-v5-native-tool-group"><span>' + escapeHtml(t('Text', 'Текст')) + '</span>' +
          button('B', 'Bold', 'Жирный', 'data-v5-command="bold"', 'is-strong') +
          button('I', 'Italic', 'Курсив', 'data-v5-command="italic"', 'is-italic') +
          button('U', 'Underline', 'Подчёркивание', 'data-v5-command="underline"', 'is-under') +
          button('S', 'Strikethrough', 'Зачёркивание', 'data-v5-command="strikeThrough"', 'is-strike') +
          button('A', 'Text color', 'Цвет текста', 'data-v5-action="quick-text-color"') +
          button('▰', 'Marker', 'Маркер', 'data-v5-action="quick-marker-color"') +
        '</div>' +

        '<div class="ir-site-studio-v5-native-tool-group"><span>' + escapeHtml(t('Link', 'Ссылка')) + '</span>' +
          button('🔗', 'Add link', 'Добавить ссылку', 'data-v5-action="insert-link-prompt"', 'is-icon') +
          button('⛓', 'Remove link', 'Убрать ссылку', 'data-v5-action="unlink"', 'is-icon') +
        '</div>' +

        '<div class="ir-site-studio-v5-native-tool-group"><span>' + escapeHtml(t('Blocks', 'Блоки')) + '</span>' +
          button('🙂', 'Symbol / emoji', 'Символ / emoji', 'data-v5-action="insert-symbol"', 'is-icon') +
          button('❞', 'Quote', 'Цитата', 'data-v5-block="quote"', 'is-icon') +
          button('☰', 'Align left', 'По левому краю', 'data-v5-command="justifyLeft"', 'is-icon') +
          button('≡', 'Align center', 'По центру', 'data-v5-command="justifyCenter"', 'is-icon') +
          button('☷', 'Align right', 'По правому краю', 'data-v5-command="justifyRight"', 'is-icon') +
          button('•', 'Bulleted list', 'Маркированный список', 'data-v5-command="insertUnorderedList"', 'is-icon') +
          button('1.', 'Numbered list', 'Нумерованный список', 'data-v5-command="insertOrderedList"', 'is-icon') +
        '</div>' +

        '<div class="ir-site-studio-v5-native-tool-group"><span>' + escapeHtml(t('Media', 'Медиа')) + '</span>' +
          button('🖼', 'Choose image from computer', 'Выбрать изображение с компьютера', 'data-v5-action="pick-local-image"', 'is-icon') +
          button('🌐', 'Image URL', 'URL изображения', 'data-v5-action="insert-image-url-prompt"', 'is-icon') +
          button('▶', 'Video / embed', 'Видео / embed', 'data-v5-action="insert-video-prompt"', 'is-icon') +
          button('▦', 'Table', 'Таблица', 'data-v5-action="insert-table"', 'is-icon') +
          button('─', 'Divider', 'Разделитель', 'data-v5-action="insert-hr"', 'is-icon') +
        '</div>' +

      '</div>' +

      '<div class="ir-site-studio-v5-publii-row ir-site-studio-v5-publii-row--sub">' +

        '<div class="ir-site-studio-v5-native-tool-group ir-site-studio-v5-native-tool-group--selects"><span>' + escapeHtml(t('Format', 'Формат')) + '</span>' +
          select('Block', 'Блок', 'data-v5-publii-block-select="1"', '<option value="p">P</option><option value="h1">H1</option><option value="h2">H2</option><option value="h3">H3</option><option value="quote">Quote</option>') +
          select('Style', 'Стиль', 'data-v5-publii-format-select="1"', '<option value="p">P</option><option value="blockquote">Quote</option><option value="pre">Code</option>') +
        '</div>' +

        '<div class="ir-site-studio-v5-native-tool-group"><span>' + escapeHtml(t('Tools', 'Инструменты')) + '</span>' +
          button('{}', 'Code block', 'Блок кода', 'data-v5-action="insert-code-block"') +
          button('⌕', 'Search', 'Поиск', 'data-v5-action="editor-search"', 'is-icon') +
          button('More', 'Read more', 'Read more', 'data-v5-action="insert-read-more"', 'is-wide') +
          button('↶', 'Undo', 'Отменить', 'data-v5-command="undo"', 'is-icon') +
          button('↷', 'Redo', 'Повторить', 'data-v5-command="redo"', 'is-icon') +
          button('⟲', 'Remove formatting', 'Очистить форматирование', 'data-v5-action="clear-format"', 'is-icon') +
          button('⌫', 'Delete selected block/image', 'Удалить выбранный блок/картинку', 'data-v5-action="delete-selection"', 'is-icon') +
          button('⧉', 'Copy selected text / HTML', 'Копировать текст / HTML', 'data-v5-action="copy-content"', 'is-icon') +
          button('HTML', 'HTML source', 'HTML код', 'data-v5-action="toggle-html-panel"', 'is-wide') +
        '</div>' +

      '</div>' +
    '</div>';
  }

  // IRGEZTNE_V084B_EDITOR_WORKBENCH_PARENT_BRIDGE
  var editorWorkbenchMessageBoundV084B = false;

  function editorWorkbenchFrameV084B() {
    return overlay && overlay.querySelector ? overlay.querySelector('[data-v084b-editor-frame="1"]') : null;
  }

  function editorWorkbenchHiddenFieldV084B() {
    return overlay && overlay.querySelector ? overlay.querySelector('[data-v5-content="1"]') : null;
  }

  // IRGEZTNE_EDITOR_LOCAL_VIDEO_BRIDGE_V084H
  function editorWorkbenchPostMediaV084H(payload) {
    var frame = editorWorkbenchFrameV084B();

    if (!frame || !frame.contentWindow) return false;

    try {
      frame.contentWindow.postMessage(
        Object.assign(
          {
            source: 'irgeztne-webstudio-v084b'
          },
          payload || {}
        ),
        '*'
      );

      return true;
    } catch (error) {
      log('Workbench media post failed', error);
      return false;
    }
  }

  function editorWorkbenchMediaAssetsV084H(state) {
    var site = state &&
      state.site &&
      typeof state.site === 'object'
        ? state.site
        : {};

    var assets = Array.isArray(site.mediaAssets)
      ? site.mediaAssets
      : [];

    return assets
      .filter(function (asset) {
        return asset &&
          asset.kind === 'video' &&
          asset.publicPath &&
          asset.sourceUrl;
      })
      .map(function (asset) {
        return {
          id: String(asset.id || ''),
          kind: 'video',
          name: String(asset.name || ''),
          mimeType: String(asset.mimeType || ''),
          publicPath: String(asset.publicPath || ''),
          previewUrl: String(asset.sourceUrl || '')
        };
      });
  }

  async function editorWorkbenchImportVideoV084H(data) {
    var api = window.nsAPI || null;
    var requestId = data && data.requestId || '';

    if (!api || typeof api.importSiteVideo !== 'function') {
      editorWorkbenchPostMediaV084H({
        type: 'media-result',
        requestId: requestId,
        ok: false,
        error: 'media-import-unavailable'
      });

      return;
    }

    var state = readState();
    state.site = state.site || {};

    var siteId = '';

    try {
      var manager = JSON.parse(
        localStorage.getItem(SITE_MANAGER_KEY) || 'null'
      );

      siteId = manager && manager.activeSiteId
        ? String(manager.activeSiteId)
        : '';
    } catch (errorManager) {}

    if (!siteId) {
      siteId = String(
        state.site.name || 'active-site'
      );
    }

    try {
      var result = await api.importSiteVideo({
        siteId: siteId
      });

      if (!result || !result.ok || !result.asset) {
        editorWorkbenchPostMediaV084H({
          type: 'media-result',
          requestId: requestId,
          ok: false,
          canceled: !!(result && result.canceled),
          error: result && result.error || ''
        });

        return;
      }

      var assets = Array.isArray(state.site.mediaAssets)
        ? state.site.mediaAssets.slice()
        : [];

      var alreadyExists = assets.some(function (asset) {
        return asset &&
          asset.id === result.asset.id;
      });

      if (!alreadyExists) {
        assets.push(result.asset);
      }

      state.site.mediaAssets = assets;
      writeState(state);

      editorWorkbenchPostMediaV084H({
        type: 'media-result',
        requestId: requestId,
        ok: true,
        asset: {
          id: String(result.asset.id || ''),
          kind: 'video',
          name: String(result.asset.name || ''),
          mimeType: String(result.asset.mimeType || ''),
          publicPath: String(result.asset.publicPath || ''),
          previewUrl: String(result.asset.sourceUrl || '')
        }
      });
    } catch (error) {
      log('Workbench video import failed', error);

      editorWorkbenchPostMediaV084H({
        type: 'media-result',
        requestId: requestId,
        ok: false,
        error: String(
          error && error.message || error || ''
        )
      });
    }
  }

  function editorWorkbenchPostInitV084B(page) {
    var frame = editorWorkbenchFrameV084B();
    if (!frame || !frame.contentWindow || !page) return;
    var stateV084H = readState();
    var payload = {
      source: 'irgeztne-webstudio-v084b',
      type: 'init',
      pageId: page.id || '',
      pageLabel: pageLabel(page),
      bodyHtml: sanitizeHtml(page.bodyHtml || '<p><br></p>'),
      theme: currentTheme() === 'light' ? 'light' : 'dark',
      lang: currentLang(),
      mediaAssets: editorWorkbenchMediaAssetsV084H(
        stateV084H
      )
    };
    try { frame.contentWindow.postMessage(payload, '*'); } catch (error) { log('Editor Workbench init post failed', error); }
  }

  function saveEditorWorkbenchPayloadV084B(data) {
    if (!data || !data.pageId) return;
    var state = readState();
    var page = state.pages.find(function (item) { return item && item.id === data.pageId; }) || activePage(state);
    if (!page) return;

    var html = sanitizeHtml(data.bodyHtml || '<p><br></p>');
    page.bodyHtml = html;
    page.updatedAt = new Date().toISOString();

    var hidden = editorWorkbenchHiddenFieldV084B();
    if (hidden) hidden.value = html;

    var titleInput = overlay && overlay.querySelector ? overlay.querySelector('.ir-site-studio-v5-page-title') : null;
    if (titleInput && page.id === (activePage(state) || {}).id) {
      page.headline = titleInput.value || page.headline || '';
    }

    writeState(state);
  }

  function handleEditorWorkbenchMessageV084B(event) {
    var frame = editorWorkbenchFrameV084B();
    if (!frame || event.source !== frame.contentWindow) return;
    var data = event.data || {};
    if (!data || data.source !== 'irgeztne-editor-workbench-v084b') return;

    if (data.type === 'ready') {
      editorWorkbenchPostInitV084B(activePage(readState()));
      return;
    }

    if (data.type === 'media-pick-video') {
      editorWorkbenchImportVideoV084H(data);
      return;
    }

    if (data.type === 'save') {
      saveEditorWorkbenchPayloadV084B(data);
      return;
    }

    if (data.type === 'preview') {
      saveEditorWorkbenchPayloadV084B(data);
      activeTab = 'preview';
      collapsedRight = true;
      renderStudio();
    }
  }

  function mountEditorWorkbenchV084B(page) {
    destroySiteJodit();
    try { destroyTinyMCEEditorV076A(); } catch (errorTiny) {}
    if (siteEditorCoreBridge && typeof siteEditorCoreBridge.destroy === 'function') {
      try { siteEditorCoreBridge.destroy(); } catch (errorBridge) {}
    }
    siteEditorCoreBridge = null;
    siteJodit = null;
    siteJoditPageId = '';

    if (!editorWorkbenchMessageBoundV084B) {
      window.addEventListener('message', handleEditorWorkbenchMessageV084B);
      editorWorkbenchMessageBoundV084B = true;
    }

    var frame = editorWorkbenchFrameV084B();
    if (!frame) return false;

    frame.addEventListener('load', function () {
      editorWorkbenchPostInitV084B(page);
    }, { once: true });

    setTimeout(function () {
      editorWorkbenchPostInitV084B(page);
    }, 120);

    return true;
  }

  function renderPageTab(state, page) {
    var safeHtml = sanitizeHtml(page.bodyHtml || '<p><br></p>');
    return '<div class="ir-site-studio-v5-editor-card ir-site-studio-v5-editor-card--workbench-v084b" data-v5-page-editor-card="1" data-v084b-editor-card="1" data-v084b-page-id="' + escapeHtml(page.id) + '">' +
      '<div class="ir-site-studio-v5-editor-context"><strong>' + escapeHtml(t('Editing page:', 'Редактируется страница:')) + ' ' + escapeHtml(pageLabel(page)) + '</strong><span>/' + escapeHtml(page.slug || 'page') + ' · ' + escapeHtml(t('Editor Workbench is isolated from old Web Studio editor layers.', 'Editor Workbench изолирован от старых слоёв редактора Web Studio.')) + '</span></div>' +
      '<label class="ir-site-studio-v5-label">' + escapeHtml(t('Template hero H1', 'Hero/H1 заголовок шаблона')) + '<input class="ir-site-studio-v5-input ir-site-studio-v5-page-title" data-v5-field="headline" value="' + escapeHtml(page.headline || '') + '"></label>' +
      '<input type="hidden" data-v5-content="1" data-v5-jodit-textarea="1" value="' + escapeHtml(safeHtml) + '">' +
      '<iframe class="ir-site-studio-v5-editor-workbench-frame-v084b" data-v084b-editor-frame="1" title="IRGEZTNE Editor Workbench" style="background:' + (currentTheme() === 'light' ? '#f7fbff' : '#0b1421') + '" src="./src/modules/editor-workbench/editor-workbench.html?v=v084r&amp;theme=' + (currentTheme() === 'light' ? 'light' : 'dark') + '"></iframe>' +
      '<p class="ir-site-studio-v5-note">' + escapeHtml(t('This editor is a separate cabin: one document, one toolbar, one save bridge.', 'Этот редактор — отдельная кабина: один документ, одна панель, один мост сохранения.')) + '</p>' +
    '</div>';
  }


  function renderПредпросмотрTab(state, page) {
    var pageButtons = orderedPageEntries(state).map(function (entry) {
      var item = entry.page;
      var active = item.id === page.id ? ' is-active' : '';
      var prefix = entry.depth ? Array(entry.depth + 1).join('↳ ') : '';
      return '<button class="ir-site-studio-v5-preview-page-btn' + active + '" data-v5-action="preview-select-page" data-v5-page-id="' + escapeHtml(item.id) + '" type="button">' + escapeHtml(prefix + pageLabel(item)) + '</button>';
    }).join('');
    return '<div class="ir-site-studio-v5-preview-card' + (previewWide ? ' is-wide' : '') + '"><div class="ir-site-studio-v5-preview-head"><div><h3>' + escapeHtml(t('Site preview', 'Предпросмотр сайта')) + '</h3><p class="ir-site-studio-v5-note">' + escapeHtml(t('Preview uses one generated build. Use “Edit this page” to switch from preview to editing the selected page.', 'Предпросмотр использует одну сборку. Выберите страницу ниже и нажмите “Править страницу”, чтобы открыть её в редакторе.')) + '</p></div><div class="ir-site-studio-v5-preview-actions"><button class="ir-site-studio-v5-btn ir-site-studio-v5-btn--primary" data-v5-action="toggle-preview-wide" type="button">' + escapeHtml(previewWide ? t('Preview', 'Превью') : t('Wide preview', 'Широкий вид')) + '</button><button class="ir-site-studio-v5-btn" data-v5-action="open-site-window" type="button">' + escapeHtml(t('Open site', 'Открыть сайт')) + '</button><button class="ir-site-studio-v5-btn" data-v5-action="edit-current-page" type="button">' + escapeHtml(t('Edit page', 'Править страницу')) + '</button><button class="ir-site-studio-v5-btn" data-v5-action="download-html" type="button">' + escapeHtml(t('Download HTML', 'Скачать HTML')) + '</button></div></div><div class="ir-site-studio-v5-preview-pages ir-site-studio-v5-preview-pages--switcher"><span>' + escapeHtml(t('Check page:', 'Проверить страницу:')) + '</span>' + pageButtons + '</div><p class="ir-site-studio-v5-preview-status" data-v5-preview-status="1">' + escapeHtml(t('Building preview…', 'Сборка предпросмотра…')) + '</p><div class="ir-site-studio-v5-browser-preview"><div class="ir-site-studio-v5-browser-bar"><i></i><i></i><i></i><span data-v5-preview-address="1">local-preview://building</span></div><iframe class="ir-site-studio-v5-preview-frame" data-v5-preview-frame="1" src="about:blank"></iframe></div></div>';
  }


  function publishStarterHtml() {
    var state = readState();
    var siteName = state && state.site && state.site.name ? state.site.name : 'Project Studio';
    return '<!doctype html>\n' +
      '<html lang="' + escapeHtml(t('en', 'ru')) + '">\n' +
      '<head>\n' +
      '  <meta charset="utf-8">\n' +
      '  <meta name="viewport" content="width=device-width, initial-scale=1">\n' +
      '  <title>' + escapeHtml(siteName) + ' · starter</title>\n' +
      '  <style>body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:Inter,Arial,sans-serif;background:#07111f;color:#eaf4ff}.box{max-width:720px;padding:44px;border:1px solid rgba(96,165,250,.35);border-radius:28px;background:linear-gradient(135deg,rgba(47,123,230,.18),rgba(14,165,233,.08));box-shadow:0 40px 90px rgba(0,0,0,.28)}h1{margin:0 0 12px;font-size:42px;letter-spacing:-.04em}p{margin:0;color:#a9bed8;line-height:1.65}.tag{display:inline-flex;margin-bottom:18px;padding:8px 12px;border-radius:999px;background:rgba(47,123,230,.18);color:#9bd3ff;font-weight:800}</style>\n' +
      '</head>\n' +
      '<body><main class="box"><span class="tag">Project Studio starter</span><h1>' + escapeHtml(siteName) + '</h1><p>' + escapeHtml(t('This temporary starter page helps create a hosting project and obtain the generated website URL. Replace it later by publishing the real site build.', 'Эта временная стартовая страница помогает создать проект на хостинге и получить сгенерированный URL сайта. Позже замените её настоящей сборкой сайта через публикацию.')) + '</p></main></body>\n' +
      '</html>\n';
  }

  async function downloadPublishStarterZip() {
    var state = readState();
    var siteName = state && state.site && state.site.name ? state.site.name : 'Project Studio';
    var payload = {
      title: siteName + ' starter',
      slug: 'project-studio-starter',
      fileName: 'project-studio-starter.zip',
      package: {
        'index.html': publishStarterHtml()
      }
    };
    var api = window.nsAPI || null;
    if (api && typeof api.exportSiteZip === 'function') {
      try {
        var result = await api.exportSiteZip(payload);
        if (result && result.canceled) return;
        if (result && result.ok) {
          try { alert(t('Starter ZIP saved as ', 'Стартовый ZIP сохранён как ') + (result.fileName || 'project-studio-starter.zip')); } catch (alertError) {}
          return;
        }
      } catch (error) {
        log('Starter ZIP export failed', error);
      }
    }
    downloadText('index.html', publishStarterHtml(), 'text/html;charset=utf-8');
    try { alert(t('Starter ZIP export is unavailable. index.html was downloaded instead.', 'Экспорт стартового ZIP недоступен. Вместо него скачан index.html.')); } catch (fallbackError) {}
  }

  function publishGuideBlock(titleEn, titleRu, items, footerHtml, extraClass) {
    extraClass = extraClass ? ' ' + extraClass : '';
    return '<div class="ir-site-studio-v5-publish-first-setup' + extraClass + '"><strong>' + escapeHtml(t(titleEn, titleRu)) + '</strong><ol>' + items.map(function (item) {
      return '<li>' + escapeHtml(t(item.en, item.ru)) + '</li>';
    }).join('') + '</ol>' + (footerHtml || '') + '</div>';
  }

  function publishStarterButton() {
    return '<button class="ir-site-studio-v5-btn ir-site-studio-v5-btn--sm" data-v5-action="publish-download-starter-zip" type="button">' + escapeHtml(t('Starter ZIP', 'Стартовый ZIP')) + '</button>';
  }

  function publishFirstSetupGuide(providerId) {
    if (providerId === 'manual') {
      return publishGuideBlock('Manual export path', 'Ручной экспорт', [
        { en: 'Download the full site ZIP when you need the whole build.', ru: 'Скачайте ZIP всего сайта, когда нужна полная сборка.' },
        { en: 'Download current HTML when you only need the selected page.', ru: 'Скачайте текущий HTML, когда нужна только выбранная страница.' },
        { en: 'Download starter ZIP when a hosting provider needs initial files to create a project.', ru: 'Скачайте стартовый ZIP, если хостингу нужны начальные файлы для создания проекта.' },
        { en: 'No token, website URL, or server connection is required for manual export.', ru: 'Для ручного экспорта не нужны token, URL сайта или подключение сервера.' }
      ]);
    }
    if (providerId === 'netlify') {
      return publishGuideBlock('Netlify flow', 'Логика Netlify', [
        { en: 'Create an empty Netlify site first, or upload the starter ZIP if Netlify asks for initial files.', ru: 'Сначала создайте пустой сайт Netlify или загрузите стартовый ZIP, если Netlify просит первые файлы.' },
        { en: 'Copy the generated Netlify URL and Site ID from the provider dashboard.', ru: 'Скопируйте сгенерированный Netlify URL и Site ID из панели провайдера.' },
        { en: 'Paste Token + Site ID here, save once, then publish later builds with one button.', ru: 'Вставьте здесь Token + Site ID, сохраните один раз, затем публикуйте следующие сборки одной кнопкой.' }
      ], publishStarterButton());
    }
    if (providerId === 'vercel') {
      return publishGuideBlock('Vercel flow', 'Логика Vercel', [
        { en: 'Create a Vercel project first. If the provider needs initial files, use the starter ZIP or manual ZIP.', ru: 'Сначала создайте проект Vercel. Если провайдеру нужны первые файлы, используйте стартовый ZIP или ручной ZIP.' },
        { en: 'Copy the project name, team/account if needed, and the generated URL.', ru: 'Скопируйте имя проекта, team/account при необходимости и сгенерированный URL.' },
        { en: 'Paste Token + project data here and save the connection for repeated publishing.', ru: 'Вставьте Token + данные проекта здесь и сохраните подключение для повторной публикации.' }
      ], publishStarterButton());
    }
    if (providerId === 'cloudflare') {
      return publishGuideBlock('Cloudflare Pages flow', 'Логика Cloudflare Pages', [
        { en: 'Create a Pages project first, or prepare it through direct upload when available.', ru: 'Сначала создайте Pages project или подготовьте его через direct upload, когда он доступен.' },
        { en: 'Copy Account ID, Project name and the generated pages.dev URL.', ru: 'Скопируйте Account ID, Project name и сгенерированный pages.dev URL.' },
        { en: 'Paste Token + Account ID + Project name here. Later Publish will replace the uploaded build.', ru: 'Вставьте Token + Account ID + Project name здесь. Позже Publish будет заменять загруженную сборку.' }
      ], publishStarterButton());
    }
    if (providerId === 'github') {
      return publishGuideBlock('GitHub Pages flow', 'Логика GitHub Pages', [
        { en: 'Create a repository and enable GitHub Pages for the selected branch/folder.', ru: 'Создайте репозиторий и включите GitHub Pages для выбранной ветки/папки.' },
        { en: 'Use owner, repository, branch and build folder to define where the static files will go.', ru: 'Укажите owner, repository, branch и папку сборки — туда будут отправляться статические файлы.' },
        { en: 'Paste the token once. Later publishing will update the repository content.', ru: 'Вставьте token один раз. Позже публикация будет обновлять содержимое репозитория.' }
      ], publishStarterButton());
    }
    if (providerId === 'gitlab') {
      return publishGuideBlock('GitLab Pages flow', 'Логика GitLab Pages', [
        { en: 'Create a GitLab project and prepare Pages/CI publishing for the selected branch.', ru: 'Создайте GitLab project и подготовьте Pages/CI публикацию для выбранной ветки.' },
        { en: 'Use namespace, project, branch and build folder to define the publish target.', ru: 'Укажите namespace, project, branch и папку сборки — это цель публикации.' },
        { en: 'Paste the token once. Later publishing will update the project files.', ru: 'Вставьте token один раз. Позже публикация будет обновлять файлы проекта.' }
      ], publishStarterButton());
    }
    if (providerId === 's3') {
      return publishGuideBlock('S3 compatible flow', 'Логика S3 compatible', [
        { en: 'Create a bucket first. This is not a normal “site project”; it is storage that can serve static files.', ru: 'Сначала создайте bucket. Это не обычный “site project”, а хранилище, которое может отдавать статические файлы.' },
        { en: 'Enable static website/public access according to the provider rules, then copy endpoint, bucket and region.', ru: 'Включите static website/public access по правилам провайдера, затем скопируйте endpoint, bucket и region.' },
        { en: 'Paste Access Key + Secret Key locally. Website URL is the bucket website/gateway URL.', ru: 'Вставьте Access Key + Secret Key локально. URL сайта — это bucket website/gateway URL.' }
      ]);
    }
    if (providerId === 'ftp') {
      return publishGuideBlock('FTP hosting flow', 'Логика FTP-хостинга', [
        { en: 'Use FTP only when your hosting gives classic FTP access to a public folder.', ru: 'Используйте FTP только если ваш хостинг даёт обычный FTP-доступ к публичной папке.' },
        { en: 'Paste host, username, password and remote path such as /public_html/.', ru: 'Вставьте host, username, пароль и remote path, например /public_html/.' },
        { en: 'FTP can be unencrypted. Prefer SFTP/FTPS when your hosting supports it.', ru: 'FTP может быть незашифрованным. Лучше использовать SFTP/FTPS, если хостинг это поддерживает.' }
      ], '', 'is-warning');
    }
    if (providerId === 'sftp') {
      return publishGuideBlock('SFTP hosting flow', 'Логика SFTP-хостинга', [
        { en: 'Use SFTP when your hosting gives secure SSH/SFTP access to the public folder.', ru: 'Используйте SFTP, если хостинг даёт безопасный SSH/SFTP-доступ к публичной папке.' },
        { en: 'Paste host, username, password/key and remote path such as /public_html/.', ru: 'Вставьте host, username, пароль/key и remote path, например /public_html/.' },
        { en: 'After the connection is saved, publishing will reuse this secure target.', ru: 'После сохранения подключения публикация будет повторно использовать эту безопасную цель.' }
      ]);
    }
    if (providerId === 'ipfs') {
      return publishGuideBlock('IPFS / Web3 flow', 'Логика IPFS / Web3', [
        { en: 'Each new upload usually creates a new CID, so edits create a new published address.', ru: 'Каждая новая загрузка обычно создаёт новый CID, поэтому правки создают новый опубликованный адрес.' },
        { en: 'For a stable address, later we will need IPNS, DNSLink or a gateway domain.', ru: 'Для постоянного адреса позже понадобится IPNS, DNSLink или gateway-domain.' },
        { en: 'For 1.0.0 this stays as an IPFS-ready export foundation before real pinning integration.', ru: 'В 1.0.0 это остаётся основой IPFS-ready экспорта до настоящего подключения pinning.' }
      ]);
    }
    return publishGuideBlock('First connection flow', 'Первичная связка', [
      { en: 'Create the target on the provider first.', ru: 'Сначала создайте цель у провайдера.' },
      { en: 'Copy the generated URL, id and token from the provider dashboard.', ru: 'Скопируйте сгенерированный URL, id и token из панели провайдера.' },
      { en: 'Paste them here, save once, then publish future builds with one button.', ru: 'Вставьте их здесь, сохраните один раз, потом публикуйте следующие сборки одной кнопкой.' }
    ], publishStarterButton());
  }

  function setPublishProgress(percent, label, shouldRender) {
    publishProgress = { active: percent > 0 && percent < 100, percent: Math.max(0, Math.min(100, Number(percent) || 0)), label: String(label || '') };
    if (shouldRender && overlay) {
      try { renderStudio(); } catch (error) { log('Publish progress render failed', error); }
    }
  }

  function renderPublishProgress() {
    var pct = Math.max(0, Math.min(99, Number(publishProgress && publishProgress.percent) || 0));
    var label = publishProgress && publishProgress.label ? publishProgress.label : t('Publishing…', 'Публикация…');
    if (!publishProgress || !publishProgress.active || pct <= 0) return '';
    return '<div class="ir-site-studio-v5-publish-progress" aria-live="polite"><div class="ir-site-studio-v5-publish-progress-head"><strong>' + escapeHtml(label) + '</strong><span>' + pct + '%</span></div><div class="ir-site-studio-v5-publish-progress-track"><span style="width:' + pct + '%"></span></div></div>';
  }

  function renderPublishSuccess(selected, config) {
    if (!config || selected === 'manual') return '';
    var status = String(config.lastStatus || '');
    var ok = String(config.lastResult || '').indexOf('ok') === 0 && (config.lastPublishedAt || /(published|опублик|deploy)/i.test(status));
    if (!ok) return '';
    var files = Array.isArray(config.lastBuildFiles) ? config.lastBuildFiles.length : 0;
    var publishedAt = config.lastPublishedAt ? new Date(config.lastPublishedAt) : null;
    var timeText = publishedAt && !isNaN(publishedAt.getTime()) ? publishedAt.toLocaleString(currentLang() === 'ru' ? 'ru-RU' : 'en-US') : '';
    var metaParts = [];
    if (files) metaParts.push(t('Files:', 'Файлов:') + ' ' + files);
    if (timeText) metaParts.push(timeText);
    var meta = metaParts.length ? '<span>' + escapeHtml(metaParts.join(' · ')) + '</span>' : '';
    var publishTitleText = currentLang() === 'ru' ? 'Последняя публикация' : 'Last publication';
    var publishOpenText = currentLang() === 'ru' ? 'Открыть сайт' : 'Open site';
    return '<div class="ir-site-studio-v5-publish-success" aria-live="polite"><div><strong>' + escapeHtml(publishTitleText) + '</strong>' + meta + '</div><button class="ir-site-studio-v5-btn ir-site-studio-v5-btn--success-open" data-v5-action="publish-open-site" type="button">' + escapeHtml(publishOpenText) + '</button></div>';
  }

  function renderPublishTab(state, page) {
    state.site.publishSettings = normalizePublishSettings(state.site.publishSettings);
    var settings = state.site.publishSettings;
    var selected = settings.selectedProvider || 'manual';
    var isManualProvider = selected === 'manual';
    var config = settings.providers[selected] || defaultPublishProviderConfig(selected);
    var meta = publishProviderMeta(selected);
    var payload = createPreviewPayload(state, page || activePage(state));
    var fileCount = Object.keys(payload.package || {}).length;
    var providerCards = publishProviderOrder().map(function (id) { return publishProviderCard(state, id); }).join('');
    var fields = publishFieldsForProvider(selected, config);
    var missingFields = publishMissingFields(config, meta);
    var ready = isPublishConfigured(selected, config, meta);
    var showSelectedSettings = !(selected === 'manual' && config.enabled !== true && !config.lastStatus && !config.lastPublishedAt && !config.lastTestedAt);
    var statusClass = String(config.lastResult || '').indexOf('ok') === 0 ? ' is-ok' : (String(config.lastResult || '').indexOf('warn') === 0 ? ' is-warn' : '');
    var readyClass = ready ? ' is-ready' : ' is-setup';
    var lastPublishStatusText = String(config.lastStatus || '');
    var connectionVerified = config.lastResult === 'ok' && config.enabled === true && (/(connected|подключ|published|опублик|deploy)/i.test(lastPublishStatusText) || !!config.websiteUrl);
    var connectedTitle = selected === 'netlify' ? t('Netlify is connected', 'Netlify подключён') : (selected === 'cloudflare' ? t('Cloudflare Pages is connected', 'Cloudflare Pages подключён') : t('Connection verified', 'Подключение проверено'));
    var readyTitle = isManualProvider ? t('Manual export', 'Ручной экспорт') : (connectionVerified ? connectedTitle : (ready ? t('Connection saved', 'Подключение сохранено') : t('Set up publishing once', 'Настройте публикацию один раз')));
    var readyMessage = isManualProvider
      ? t('Use local export: full site ZIP, current page HTML, or starter ZIP. No token or server connection is required.', 'Экспортируйте полный ZIP сайта, текущий HTML страницы или стартовый ZIP. Token и подключение к серверу не нужны.')
      : (connectionVerified
        ? t('Continue editing in Web Studio. Use the top “Publish changes” button when you want to update the live site.', 'Продолжайте редактировать сайт в Web Studio. Когда нужно обновить сайт в интернете, нажимайте верхнюю кнопку «Опубликовать».')
        : (ready ? t('Connection setup is saved. The top Publish button will reuse it for the next build.', 'Настройка подключения сохранена. Верхняя кнопка «Опубликовать» будет использовать её для следующей сборки.') : publishReadyMessage(selected, config, meta)));
    var missingText = missingFields.length ? '<span class="ir-site-studio-v5-publish-missing">' + escapeHtml(t('Missing:', 'Не заполнено:') + ' ' + missingFields.map(publishFieldLabel).join(', ')) + '</span>' : '';
    var setupBody = publishFirstSetupGuide(selected) + '<div class="ir-site-studio-v5-publish-form-note">' + escapeHtml(publishReadyMessage(selected, config, meta)) + '</div>' +
      (isManualProvider ? '' : ('<div class="ir-site-studio-v5-publish-fields">' + fields + '</div>' +
      '<div class="ir-site-studio-v5-publish-actions"><button class="ir-site-studio-v5-btn ir-site-studio-v5-btn--primary" data-v5-action="publish-save-settings" type="button">' + escapeHtml(t('Save server', 'Сохранить сервер')) + '</button><button class="ir-site-studio-v5-btn" data-v5-action="publish-test-settings" type="button">' + escapeHtml(t('Test connection', 'Проверить подключение')) + '</button><button class="ir-site-studio-v5-btn" data-v5-action="publish-clear-token" type="button">' + escapeHtml(t('Clear token', 'Очистить token')) + '</button></div>'));
    var setupBlock = ready && selected !== 'manual' && selected !== 'ipfs'
      ? '<details class="ir-site-studio-v5-publish-setup"><summary>' + escapeHtml(t('Edit connection settings', 'Изменить настройки подключения')) + '</summary>' + setupBody + '</details>'
      : '<div class="ir-site-studio-v5-publish-setup is-open">' + setupBody + '</div>';
    var hasFocusedProvider = showSelectedSettings && selected;
    var pickerBlock = hasFocusedProvider
      ? '<details class="ir-site-studio-v5-publish-picker ir-site-studio-v5-publish-picker--collapsed"><summary>← ' + escapeHtml(t('Change server type', 'Сменить тип сервера')) + '</summary><div class="ir-site-studio-v5-publish-provider-grid">' + providerCards + '</div></details>'
      : '<section class="ir-site-studio-v5-publish-picker"><div class="ir-site-studio-v5-publish-picker-title"><h4>' + escapeHtml(t('Select server type', 'Выберите тип сервера')) + '</h4><p>' + escapeHtml(t('Choose this once. Tokens stay local and are not included in backup by default.', 'Выберите это один раз. Токены остаются локально и по умолчанию не входят в backup.')) + '</p></div><div class="ir-site-studio-v5-publish-provider-grid">' + providerCards + '</div></section>';
    var selectedPublicUrl = cleanPublicSiteUrl(config.websiteUrl || '');
    var canOpenSelectedProvider = ready && selected !== 'manual' && /^https?:\/\//i.test(selectedPublicUrl);
    var progressBlock = renderPublishProgress();
    var successBlock = renderPublishSuccess(selected, config);
    var topPublishHint = ready && selected !== 'manual' ? '<span class="ir-site-studio-v5-publish-top-hint">' + escapeHtml(t('Publishing is done from the top Publish button. After a successful publish, “Open site” appears below.', 'Публикация выполняется верхней кнопкой «Опубликовать». После успешной публикации кнопка «Открыть сайт» появится ниже.')) + '</span>' : '';
    var openSelectedProviderButton = '';
    var mainActions = (topPublishHint || openSelectedProviderButton) ? '<div class="ir-site-studio-v5-publish-actions ir-site-studio-v5-publish-actions--main">' + topPublishHint + openSelectedProviderButton + '</div>' : '';
    var manualToolButtons = '<div class="ir-site-studio-v5-publish-actions ir-site-studio-v5-publish-actions--manual"><button class="ir-site-studio-v5-btn ir-site-studio-v5-btn--primary" data-v5-action="publish-download-zip" type="button">' + escapeHtml(t('Export site ZIP', 'Экспорт ZIP сайта')) + '</button><button class="ir-site-studio-v5-btn" data-v5-action="download-html" type="button">' + escapeHtml(t('Export current HTML', 'Экспорт текущего HTML')) + '</button><button class="ir-site-studio-v5-btn" data-v5-action="publish-download-starter-zip" type="button">' + escapeHtml(t('Starter ZIP', 'Стартовый ZIP')) + '</button></div>';
    var manualActions = '<section class="ir-site-studio-v5-publish-manual-export"><h5>' + escapeHtml(t('Export actions', 'Действия экспорта')) + '</h5><p class="ir-site-studio-v5-note">' + escapeHtml(isManualProvider ? t('Use these files for manual hosting upload. Tokens are never needed for this export.', 'Используйте эти файлы для ручной загрузки на хостинг. Для этого экспорта token не нужен.') : t('Manual export files are available here too. They do not use provider tokens.', 'Файлы ручного экспорта доступны здесь же. Они не используют token провайдера.')) + '</p>' + manualToolButtons + '</section>';
    var statusText = (isManualProvider && !String(config.lastStatus || '')) ? '' : publishStatusText(config);
    var statusBlock = statusText ? ('<p class="ir-site-studio-v5-publish-status' + statusClass + '" data-v5-publish-status="1">' + escapeHtml(statusText) + '</p>') : '';
    return '<div class="ir-site-studio-v5-publish-card ir-site-studio-v5-publish-center ir-site-studio-v5-publish-center--publii ir-site-studio-v5-publish-center--v7c">' +
      '<div class="ir-site-studio-v5-publish-hero"><div><span class="ir-site-studio-v5-kicker">' + escapeHtml(t('Publishing setup', 'Настройка публикации')) + '</span><h3>' + escapeHtml(t('Server connection', 'Подключение сервера')) + '</h3><p class="ir-site-studio-v5-note">' + escapeHtml(t('Set up the server once. After that, publish changes from the top Web Studio button without returning to tokens.', 'Настройте сервер один раз. После этого публикуйте изменения верхней кнопкой Web Studio, не возвращаясь к token.')) + '</p></div><div class="ir-site-studio-v5-publish-site"><strong>' + escapeHtml(state.site.icon || '◆') + ' ' + escapeHtml(state.site.name || t('Website', 'Сайт')) + '</strong><span>' + escapeHtml(t('Build files:', 'Файлов сборки:')) + ' ' + fileCount + '</span></div></div>' +
      pickerBlock +
      (showSelectedSettings ? '<section class="ir-site-studio-v5-publish-settings" data-v5-publish-settings="1"><div class="ir-site-studio-v5-publish-settings-head"><div><span class="ir-site-studio-v5-publish-provider-icon ir-site-studio-v5-publish-provider-icon--large">' + escapeHtml(meta.icon) + '</span><div><h4>' + escapeHtml(t(meta.name, meta.nameRu)) + '</h4><p>' + escapeHtml(t(meta.note, meta.noteRu)) + '</p></div></div>' + (isManualProvider ? '<span class="ir-site-studio-v5-publish-token-chip">' + escapeHtml(t('No token needed', 'Token не нужен')) + '</span>' : '<span class="ir-site-studio-v5-publish-token-chip">' + escapeHtml(t('Token:', 'Token:')) + ' ' + escapeHtml(publishSecretPreviewFor(selected, config, 'token') || publishSecretPreviewFor(selected, config, 'secretKey') || tokenPreview(config.token || config.secretKey)) + '</span>') + '</div>' +
      '<div class="ir-site-studio-v5-publish-ready' + readyClass + '"><strong>' + escapeHtml(readyTitle) + '</strong><span>' + escapeHtml(readyMessage) + '</span>' + missingText + '</div>' +
      (ready && selected !== 'manual' && selected !== 'ipfs' ? mainActions + setupBlock : setupBlock + mainActions) +
      progressBlock +
      successBlock +
      statusBlock +
      manualActions +
      '<details class="ir-site-studio-v5-publish-details"><summary>' + escapeHtml(t('Build summary', 'Сводка сборки')) + '</summary><pre class="ir-site-studio-v5-code">' + escapeHtml(JSON.stringify({ site: state.site.name, provider: selected, activePage: { title: pageLabel(page), slug: page.slug, status: page.status }, files: Object.keys(payload.package || {}), tokenPolicy: 'local only; not included in backup by default' }, null, 2)) + '</pre></details>' +
      '</section>' : '') + '</div>';
  }

  function renderIdentityTab(state) {
    var site = state.site || {};
    var logoSvg = svgLogo(site, 256);
    var faviconSvg = svgFavicon(site, 256);
    var bgColors = ['#ffffff', '#f8fafc', '#eef6ff', '#ecfdf5', '#fff7ed', '#f7f2ff', '#f1f5f9', '#e0f2fe', '#0f172a', '#020617'];
    var textColors = ['#101827', '#1f2937', '#334155', '#475569', '#0f172a', '#ffffff'];
    var logoBg = site.logoBackgroundColor || site.accentColor || '#2f7be6';
    var logoText = site.logoTextColor || '#ffffff';
    var faviconBg = site.faviconBackgroundColor || logoBg;
    var faviconText = site.faviconTextColor || logoText;
    var logoShape = site.logoShape || 'rounded';
    var faviconShape = site.faviconShape || logoShape;
    var faviconInitials = normalizeLooseLogoLettersV069E(
      site.faviconLetters ||
      site.faviconText ||
      site.faviconSymbol ||
      site.faviconIcon ||
      site.logoLetters ||
      initialsFromName(site.name || 'Project Studio')
    ).slice(0, 2);
    var siteIconValue = faviconInitials;
    var logoBlock = '<article class="ir-site-studio-v5-compact-generator ir-site-studio-v5-compact-generator--logo"><div class="ir-site-studio-v5-compact-generator-head"><strong>' + escapeHtml(t('Logo', 'Логотип')) + '</strong><span>' + escapeHtml(t('Header mark', 'Знак в шапке')) + '</span></div><div class="ir-site-studio-v5-compact-row">' +
      fieldMiniInput('logoLetters', t('Letters / mark', 'Буквы / знак'), normalizeLooseLogoLettersV069E(site.logoLetters || ''), 3) +
      colorControl('logoBackgroundColor', t('Background', 'Фон'), logoBg, '#2f7be6') +
      colorControl('logoTextColor', t('Letters color', 'Цвет букв'), logoText, '#ffffff') +
      fieldMiniSelect('logoFont', t('Font', 'Шрифт'), fontOptions(site.logoFont || site.headingFont || site.fontFamily)) +
      fieldMiniSelect('logoWeight', t('Weight', 'Толщина'), logoWeightOptions(site.logoWeight || '900')) +
      fieldMiniSelect('logoShape', t('Shape', 'Форма'), logoShapeOptions(logoShape)) +
      fieldMiniSelect('logoHeaderSize', t('Header size', 'Размер в шапке'), logoHeaderSizeOptions(site.logoHeaderSize || 'normal')) +
      '</div></article>';
    var faviconBlock = '<article class="ir-site-studio-v5-compact-generator ir-site-studio-v5-compact-generator--favicon"><div class="ir-site-studio-v5-compact-generator-head"><strong>' + escapeHtml(t('Favicon', 'Favicon')) + '</strong><span>' + escapeHtml(t('Browser icon', 'Иконка браузера')) + '</span></div><div class="ir-site-studio-v5-compact-row">' +
      fieldMiniInput('faviconLetters', t('Symbol / letter', 'Символ / буква'), siteIconValue, 4) +
      colorControl('faviconBackgroundColor', t('Background', 'Фон'), faviconBg, '#2f7be6') +
      colorControl('faviconTextColor', t('Symbol color', 'Цвет символа'), faviconText, '#ffffff') +
      fieldMiniSelect('faviconFont', t('Font', 'Шрифт'), fontOptions(site.faviconFont || site.logoFont || site.headingFont || site.fontFamily)) +
      fieldMiniSelect('faviconWeight', t('Weight', 'Толщина'), faviconWeightOptions(site.faviconWeight || '950')) +
      fieldMiniSelect('faviconShape', t('Shape', 'Форма'), logoShapeOptions(faviconShape)) +
      '<button class="ir-site-studio-v5-btn ir-site-studio-v5-compact-generate ir-site-studio-v5-compact-download" data-v5-action="download-favicon-pack" type="button">' + escapeHtml(t('Download', 'Скачать')) + '</button></div></article>';
    return '<div class="ir-site-studio-v5-identity-card ir-site-studio-v5-identity-card--compact"><div class="ir-site-studio-v5-identity-grid"><section class="ir-site-studio-v5-logo-preview"><div class="ir-site-studio-v5-brand-previews"><div><span>' + escapeHtml(t('Logo preview', 'Превью логотипа')) + '</span><div class="ir-site-studio-v5-logo-tile"><img alt="Logo preview" src="' + dataUrlSvg(logoSvg) + '"></div></div><div><span>' + escapeHtml(t('Favicon preview', 'Превью favicon')) + '</span><div class="ir-site-studio-v5-favicon-tile"><img alt="Favicon preview" src="' + dataUrlSvg(faviconSvg) + '"></div><div class="ir-site-studio-v5-favicon-sizes"><i>32</i><i>16</i></div></div></div><p>' + escapeHtml(t('Logo and favicon are installed automatically in preview, export and publishing. Downloads are only for using them outside Web Studio.', 'Логотип и favicon автоматически добавляются в предпросмотр, экспорт и публикацию. Скачивание нужно только для использования вне Web Studio.')) + '</p><details class="ir-site-studio-v5-publish-details ir-site-studio-v5-publish-details--tools"><summary>' + escapeHtml(t('Advanced / export', 'Дополнительно / экспорт')) + '</summary><div class="ir-site-studio-v5-identity-actions"><button class="ir-site-studio-v5-btn" data-v5-action="download-logo-svg" type="button">' + escapeHtml(t('Download SVG logo', 'Скачать SVG logo')) + '</button><button class="ir-site-studio-v5-btn" data-v5-action="download-favicon-pack" type="button">' + escapeHtml(t('Download favicon pack', 'Скачать favicon pack')) + '</button></div><p class="ir-site-studio-v5-note">' + escapeHtml(t('The pack includes favicon.svg, PNG icons, favicon.ico and site.webmanifest. Web Studio adds them to this site automatically.', 'Комплект включает favicon.svg, PNG-иконки, favicon.ico и site.webmanifest. Web Studio добавляет их в этот сайт автоматически.')) + '</p></details></section><section class="ir-site-studio-v5-identity-controls"><div class="ir-site-studio-v5-identity-site-fields"><div class="ir-site-studio-v5-setting-row"><label>' + escapeHtml(t('Site name', 'Название сайта')) + '</label><input class="ir-site-studio-v5-input" data-v5-site-field="name" value="' + escapeHtml(site.name || '') + '"></div><div class="ir-site-studio-v5-setting-row"><label>' + escapeHtml(t('Author / owner', 'Автор / владелец')) + '</label><input class="ir-site-studio-v5-input" data-v5-site-field="author" value="' + escapeHtml(site.author || '') + '"></div><div class="ir-site-studio-v5-setting-row"><label>' + escapeHtml(t('Tagline', 'Слоган')) + '</label><input class="ir-site-studio-v5-input" data-v5-site-field="tagline" value="' + escapeHtml(site.tagline || '') + '"></div></div><h4 class="ir-site-studio-v5-section-title">' + escapeHtml(t('Compact logo / favicon generators', 'Компактные генераторы logo / favicon')) + '</h4><div class="ir-site-studio-v5-compact-generators">' + logoBlock + faviconBlock + '</div><h4 class="ir-site-studio-v5-section-title">' + escapeHtml(t('Site colors', 'Цвета сайта')) + '</h4>' + colorControl('accentColor', t('Site accent color', 'Акцентный цвет сайта'), site.accentColor || '#2f7be6', '#2f7be6') + colorControl('menuColor', t('Menu active color', 'Цвет активного меню'), site.menuColor || site.accentColor || '#2f7be6', '#2f7be6') + colorControl('buttonColor', t('Button color', 'Цвет кнопок'), site.buttonColor || site.accentColor || '#2f7be6', '#2f7be6') + '<div class="ir-site-studio-v5-paint-blocks"><article><h4>' + escapeHtml(t('Page background quick colors', 'Быстрые фоны страницы')) + '</h4><p class="ir-site-studio-v5-note">' + escapeHtml(t('Optional quick selection. You can also type any HEX color below.', 'Необязательный быстрый выбор. Ниже можно ввести любой HEX-цвет.')) + '</p>' + colorSwatches('backgroundColor', bgColors) + '</article><article><h4>' + escapeHtml(t('Text quick colors', 'Быстрые цвета текста')) + '</h4><p class="ir-site-studio-v5-note">' + escapeHtml(t('Optional quick text color presets.', 'Необязательные быстрые цвета текста.')) + '</p>' + colorSwatches('textColor', textColors) + '</article></div>' + colorControl('backgroundColor', t('Background color', 'Цвет фона'), site.backgroundColor || '#ffffff', '#ffffff') + colorControl('textColor', t('Text color', 'Цвет текста'), site.textColor || '#101827', '#101827') + '<h4 class="ir-site-studio-v5-section-title">' + escapeHtml(t('Fonts', 'Шрифты')) + '</h4><div class="ir-site-studio-v5-setting-row"><label>' + escapeHtml(t('Body font', 'Шрифт текста')) + '</label><select class="ir-site-studio-v5-select" data-v5-site-field="fontFamily">' + fontOptions(site.fontFamily) + '</select></div><div class="ir-site-studio-v5-setting-row"><label>' + escapeHtml(t('Heading font', 'Шрифт заголовков')) + '</label><select class="ir-site-studio-v5-select" data-v5-site-field="headingFont">' + fontOptions(site.headingFont || site.fontFamily) + '</select></div></section></div></div>';
  }

  function renderPagesManagerTab(state, page) {
    var query = String(pagesSearch || '').trim().toLowerCase();
    var entries = orderedPageEntries(state);
    if (query) {
      entries = entries.filter(function (entry) {
        var item = entry.page;
        return (pageLabel(item) + ' ' + item.slug + ' ' + item.status).toLowerCase().indexOf(query) !== -1;
      });
    }

    var rows = entries.map(function (entry) {
      var item = entry.page;
      var active = item.id === state.activePageId ? ' is-active' : '';
      var depth = entry.depth;
      var parent = item.parentId ? state.pages.find(function (candidate) { return candidate.id === item.parentId; }) : null;
      /* IRGEZTNE_WEBSTUDIO_PARENT_NESTING_LABELS_V059C */
      var parentOptions = '<option value="">' + escapeHtml(t('No parent', 'Без родителя')) + '</option>' + orderedPageList(state).filter(function (candidate) {
        return candidate.id !== item.id && !isChildOf(state, candidate.id, item.id);
      }).map(function (candidate) {
        return '<option value="' + escapeHtml(candidate.id) + '"' + (item.parentId === candidate.id ? ' selected' : '') + '>' + escapeHtml(pageLabel(candidate)) + '</option>';
      }).join('');
      var placementLabel = item.inFooter
        ? t('footer/service page', 'страница подвала')
        : (parent
          ? (t('under:', 'под:') + ' ' + pageLabel(parent))
          : t('header/top page', 'верхняя страница'));
      var badges = [];
      if (item.inFooter) badges.push(t('Footer: ', 'Подвал: ') + footerGroupLabel(normalizeFooterGroup(item.footerGroup, item)));
      else if (item.parentId) badges.push(t('Subpage', 'Подстраница'));
      else badges.push(t('Header', 'В шапке'));
      badges.push(statusLabel(item.status || 'draft'));
      if (item.id === state.activePageId) badges.push(t('active', 'активная'));
      var badgeHtml = '<div class="ir-site-studio-v5-page-badges">' + badges.map(function (badge) {
        return '<span class="ir-site-studio-v5-page-badge">' + escapeHtml(badge) + '</span>';
      }).join('') + '</div>';
      return '<article class="ir-site-studio-v5-pages-row ir-site-studio-v5-pages-row--compact' + active + ' depth-' + Math.min(depth, 6) + '" draggable="true" data-v5-page-drag-id="' + escapeHtml(item.id) + '" data-v5-page-drop-child-id="' + escapeHtml(item.id) + '">' +
        '<div class="ir-site-studio-v5-pages-main" style="padding-left:' + (depth * 22) + 'px">' +
          '<span class="ir-site-studio-v5-drag-handle" title="' + escapeHtml(t('Drag page onto a parent', 'Перетащить страницу на родителя')) + '">☰</span>' +
          '<div class="ir-site-studio-v5-pages-title-block"><strong>' + (depth ? '<span class="ir-site-studio-v5-tree-mark">↳</span> ' : '') + escapeHtml(pageLabel(item)) + '</strong>' +
          '<span>/' + escapeHtml(item.slug || 'page') + ' · ' + escapeHtml(placementLabel) + '</span>' + badgeHtml + '</div>' +
        '</div>' +
        '<label class="ir-site-studio-v5-menu-group-label ir-site-studio-v5-parent-select-label"><span>' + escapeHtml(t('Parent / nesting', 'Родитель / вложенность')) + '</span><select class="ir-site-studio-v5-select" data-v5-page-field="parentId" data-v5-page-id="' + escapeHtml(item.id) + '">' + parentOptions + '</select></label>' +
        '<div class="ir-site-studio-v5-menu-group-actions ir-site-studio-v5-page-actions">' +
          '<button class="ir-site-studio-v5-btn ir-site-studio-v5-btn--sm ir-site-studio-v5-btn--primary" data-v5-action="select-page" data-v5-page-id="' + escapeHtml(item.id) + '" type="button" title="' + escapeHtml(t('Edit page', 'Редактировать страницу')) + '">' + escapeHtml(t('Edit', 'Править')) + '</button>' +
          '<button class="ir-site-studio-v5-btn ir-site-studio-v5-btn--sm" data-v5-action="preview-page" data-v5-page-id="' + escapeHtml(item.id) + '" type="button" title="' + escapeHtml(t('View page', 'Посмотреть страницу')) + '">' + escapeHtml(t('View', 'Вид')) + '</button>' +
          '<button class="ir-site-studio-v5-btn ir-site-studio-v5-btn--sm" data-v5-action="create-child-page" data-v5-page-id="' + escapeHtml(item.id) + '" type="button" title="' + escapeHtml(t('Create subpage', 'Создать подстраницу')) + '">+ ' + escapeHtml(t('Subpage', 'Под')) + '</button>' +
          '<button class="ir-site-studio-v5-icon-btn" data-v5-action="page-indent" data-v5-page-id="' + escapeHtml(item.id) + '" type="button" title="' + escapeHtml(t('Make child of page above', 'Сделать дочерней к странице выше')) + '">↳</button>' +
          '<button class="ir-site-studio-v5-icon-btn" data-v5-action="page-outdent" data-v5-page-id="' + escapeHtml(item.id) + '" type="button" title="' + escapeHtml(t('Move one level up', 'На уровень выше')) + '">↰</button>' +
          '<button class="ir-site-studio-v5-icon-btn" data-v5-action="page-root" data-v5-page-id="' + escapeHtml(item.id) + '" type="button" title="' + escapeHtml(t('Move to top level', 'На верхний уровень')) + '">⌂</button>' +
          '<button class="ir-site-studio-v5-icon-btn" data-v5-action="move-up" data-v5-page-id="' + escapeHtml(item.id) + '" type="button" title="' + escapeHtml(t('Move up within this level', 'Выше внутри этого уровня')) + '">↑</button>' +
          '<button class="ir-site-studio-v5-icon-btn" data-v5-action="move-down" data-v5-page-id="' + escapeHtml(item.id) + '" type="button" title="' + escapeHtml(t('Move down within this level', 'Ниже внутри этого уровня')) + '">↓</button>' +
          '<button class="ir-site-studio-v5-btn ir-site-studio-v5-btn--danger ir-site-studio-v5-btn--xs" data-v5-action="delete-page" data-v5-page-id="' + escapeHtml(item.id) + '" type="button" title="' + escapeHtml(uiLabel('delete')) + '">' + escapeHtml(uiLabel('delete')) + '</button>' +
        '</div>' +
      '</article>';
    }).join('');

    return '<div class="ir-site-studio-v5-editor-card ir-site-studio-v5-pages-manager">' +
      '<div class="ir-site-studio-v5-menu-groups-head"><div><h3>' + escapeHtml(t('Pages', 'Страницы')) + '</h3><p class="ir-site-studio-v5-note">' + escapeHtml(t('Pages manage the site structure. Click “Edit” to open page content. Click “View” to check the page in preview.', 'Страницы управляют структурой сайта. Нажмите “Редактировать”, чтобы открыть контент страницы. Нажмите “Смотреть”, чтобы проверить страницу в предпросмотре.')) + '</p></div><div class="ir-site-studio-v5-menu-group-actions"><button class="ir-site-studio-v5-btn ir-site-studio-v5-btn--primary" data-v5-action="new-page" type="button">+ ' + escapeHtml(t('New page', 'Новая страница')) + '</button></div></div>' +
      '<div class="ir-site-studio-v5-pages-help"><strong>' + escapeHtml(t('Page placement:', 'Размещение страниц:')) + '</strong> ' + escapeHtml(t('Use page settings to show a page in the header or footer. “Parent / nesting” is only for subpages and dropdown menus.', 'В настройках страницы выберите показ в шапке или подвале. Поле «Родитель / вложенность» используется только для подстраниц и выпадающего меню.')) + '</div>' +
      '<input class="ir-site-studio-v5-input" data-v5-pages-search="1" value="' + escapeHtml(pagesSearch) + '" placeholder="' + escapeHtml(t('Search pages', 'Поиск страниц')) + '">' +
      '<div class="ir-site-studio-v5-pages-list" data-v5-page-drop-root="1">' + (rows || '<p class="ir-site-studio-v5-note">' + escapeHtml(t('No pages found.', 'Страницы не найдены.')) + '</p>') + '</div>' +
    '</div>';
  }

  function ensureMenuGroups(state) {
    var changed = false;
    var pages = Array.isArray(state.pages) ? state.pages : [];

    if (!Array.isArray(state.menuGroups)) {
      state.menuGroups = [
        { id: 'menu-main-header', name: 'Главное меню', position: 'header', items: pages.length ? [createMenuItemFromPage(findHomePage({ pages: pages }) || pages[0], 0)] : [] },
        { id: 'menu-main-footer', name: 'Меню подвала', position: 'footer', items: [] }
      ];
      state.activeMenuGroupId = 'menu-main-header';
      state.menuGroupsSeeded = true;
      return true;
    }

    if (!state.menuGroups.some(function (group) { return group.position === 'header'; })) {
      state.menuGroups.unshift({ id: 'menu-main-header', name: 'Главное меню', position: 'header', items: pages.length ? [createMenuItemFromPage(findHomePage({ pages: pages }) || pages[0], 0)] : [] });
      changed = true;
    }

    if (!state.menuGroups.some(function (group) { return group.position === 'footer'; })) {
      state.menuGroups.push({ id: 'menu-main-footer', name: 'Меню подвала', position: 'footer', items: [] });
      changed = true;
    }

    state.menuGroups.forEach(function (group, index) {
      if (!group.id) { group.id = uid('menuGroup'); changed = true; }
      if (!group.name) { group.name = index === 0 ? 'Главное меню' : 'Меню'; changed = true; }
      if (!group.position) { group.position = 'unassigned'; changed = true; }
      if (!Array.isArray(group.items)) { group.items = []; changed = true; }
      group.items = group.items.map(function (item, itemIndex) { return normalizeMenuItem(item, itemIndex); });
      group.items.sort(function (a, b) { return Number(a.order || 0) - Number(b.order || 0); });
      group.items.forEach(function (item, itemIndex) {
        if (item.order !== itemIndex) { item.order = itemIndex; changed = true; }
      });
    });

    if (state.menuGroups.length) {
      if (!state.activeMenuGroupId || !state.menuGroups.some(function (group) { return group.id === state.activeMenuGroupId; })) {
        state.activeMenuGroupId = state.menuGroups[0].id;
        changed = true;
      }
    } else if (state.activeMenuGroupId) {
      state.activeMenuGroupId = '';
      changed = true;
    }

    state.menuGroupsSeeded = true;
    return changed;
  }

  function getHeaderMenuItems(state) {
    ensureMenuGroups(state);
    var groups = Array.isArray(state.menuGroups) ? state.menuGroups : [];
    var header = groups.find(function (group) { return group.position === 'header'; }) || groups[0];
    if (!header || !Array.isArray(header.items)) return [];
    return header.items.slice().sort(function (a, b) { return Number(a.order || 0) - Number(b.order || 0); });
  }

  function menuItemTargetLabel(state, item) {
    if (!item) return '';
    if (item.type === 'external') return item.url || 'External URL';
    var page = (state.pages || []).find(function (candidate) { return candidate.id === item.pageId; });
    return page ? pageLabel(page) : t('Select page', 'Выберите страницу');
  }

  function menuPositionLabel(position) {
    if (position === 'header') return t('Header menu', 'Главное меню / Header');
    if (position === 'footer') return t('Footer menu', 'Меню подвала / Footer');
    return t('Unassigned', 'Не назначено');
  }

  function isDefaultHeaderMenuName(value) {
    return sameText(value, 'Главное меню') || sameText(value, 'Main menu') || sameText(value, 'Header menu');
  }

  function isDefaultFooterMenuName(value) {
    return sameText(value, 'Меню подвала') || sameText(value, 'Footer menu');
  }

  function menuGroupDisplayName(group) {
    var name = group && group.name ? String(group.name) : '';
    if ((group && group.id === 'menu-main-header') || isDefaultHeaderMenuName(name)) return t('Main menu', 'Главное меню');
    if ((group && group.id === 'menu-main-footer') || isDefaultFooterMenuName(name)) return t('Footer menu', 'Меню подвала');
    return name || t('Menu', 'Меню');
  }

  function menuGroupInputValue(group) {
    var name = group && group.name ? String(group.name) : '';
    if ((group && group.id === 'menu-main-header') && isDefaultHeaderMenuName(name)) return t('Main menu', 'Главное меню');
    if ((group && group.id === 'menu-main-footer') && isDefaultFooterMenuName(name)) return t('Footer menu', 'Меню подвала');
    return name;
  }

  function statusLabel(status) {
    return status === 'published' ? t('published', 'опубликовано') : t('draft', 'черновик');
  }

  function pageListLinksForMenuOverview(state, pages) {
    if (!pages.length) return '<span class="ir-site-studio-v5-note">' + escapeHtml(t('No pages selected.', 'Страницы не выбраны.')) + '</span>';
    return pages.map(function (page) {
      return '<button class="ir-site-studio-v5-btn ir-site-studio-v5-btn--sm" data-v5-action="menu-open-page" data-v5-page-id="' + escapeHtml(page.id) + '" type="button">' + escapeHtml(pageLabel(page)) + '</button>';
    }).join('');
  }

  function renderMenuManagerTab(state, page) {
    if (ensureMenuGroups(state)) writeState(state);
    var pages = orderedPageList(state);
    var headerPages = pages.filter(function (item) { return item && item.inMenu === true && item.inFooter !== true && !item.parentId; });
    var footerPages = pages.filter(function (item) { return item && item.inFooter === true; });
    var childPages = pages.filter(function (item) { return item && item.parentId && item.inMenu === true; });
    return '<div class="ir-site-studio-v5-editor-card ir-site-studio-v5-menu-manager ir-site-studio-v5-menu-manager--simple">' +
      '<div class="ir-site-studio-v5-menu-groups-head"><div><h3>' + escapeHtml(t('Menu', 'Меню')) + '</h3><p class="ir-site-studio-v5-note">' + escapeHtml(t('Menus are built from pages. Create and name pages in Pages/Editor, then choose where each page is shown in the page settings panel.', 'Меню собирается из страниц. Создавайте и называйте страницы в «Страницы/Редактор», а место показа выбирайте в настройках страницы.')) + '</p></div></div>' +
      '<div class="ir-site-studio-v5-menu-group-list">' +
        '<article class="ir-site-studio-v5-menu-group-row is-active"><div class="ir-site-studio-v5-menu-group-main"><strong>' + escapeHtml(t('Main menu', 'Главное меню')) + '</strong><span>' + escapeHtml(t('Default header pages appear in the site header.', 'Здесь показываются обычные страницы верхнего меню.')) + '</span></div><div class="ir-site-studio-v5-menu-overview-links">' + pageListLinksForMenuOverview(state, headerPages) + '</div></article>' +
        '<article class="ir-site-studio-v5-menu-group-row"><div class="ir-site-studio-v5-menu-group-main"><strong>' + escapeHtml(t('Footer menu', 'Меню подвала')) + '</strong><span>' + escapeHtml(t('Pages marked “Footer menu” appear in the footer.', 'Здесь показываются страницы с галочкой «Меню подвала».')) + '</span></div><div class="ir-site-studio-v5-menu-overview-links">' + pageListLinksForMenuOverview(state, footerPages) + '</div></article>' +
        '<article class="ir-site-studio-v5-menu-group-row"><div class="ir-site-studio-v5-menu-group-main"><strong>' + escapeHtml(t('Subpages', 'Подстраницы')) + '</strong><span>' + escapeHtml(t('Parent page creates dropdowns. It is not used for footer placement.', 'Родительская страница создаёт выпадающее подменю. Для подвала она не используется.')) + '</span></div><div class="ir-site-studio-v5-menu-overview-links">' + pageListLinksForMenuOverview(state, childPages) + '</div></article>' +
      '</div>' +
      '<section class="ir-site-studio-v5-pages-help"><strong>' + escapeHtml(t('1.0.0 note:', '1.0.0:')) + '</strong> ' + escapeHtml(t('Social links and custom external footer links are postponed until a cleaner footer block with icons.', 'Социальные ссылки и внешние ссылки подвала отложены до аккуратного блока с иконками.')) + '</section>' +
    '</div>';
  }



  // IRGEZTNE_SITE_SETTINGS_LAYER_V067C
  function siteSettingsGet(settings, path, fallback) {
    var cursor = settings || {};
    String(path || '').split('.').forEach(function (part) {
      if (!part) return;
      cursor = cursor && Object.prototype.hasOwnProperty.call(cursor, part) ? cursor[part] : undefined;
    });
    return cursor == null ? (fallback == null ? '' : fallback) : cursor;
  }

  function siteSettingsSet(settings, path, value) {
    var parts = String(path || '').split('.').filter(Boolean);
    var cursor = settings;
    parts.forEach(function (part, index) {
      if (index === parts.length - 1) {
        cursor[part] = value;
        return;
      }
      if (!cursor[part] || typeof cursor[part] !== 'object') cursor[part] = {};
      cursor = cursor[part];
    });
  }

  function siteSettingsDelete(settings, path) {
    var parts = String(path || '').split('.').filter(Boolean);
    var cursor = settings;
    for (var i = 0; i < parts.length - 1; i += 1) {
      cursor = cursor && cursor[parts[i]];
      if (!cursor || typeof cursor !== 'object') return;
    }
    if (cursor && parts.length) delete cursor[parts[parts.length - 1]];
  }

  function renderSiteSettingsInput(key, label, value, hint) {
    return '<label class="ir-site-settings-field"><span>' + escapeHtml(label) + '</span><input data-v5-site-setting="' + escapeHtml(key) + '" value="' + escapeHtml(value || '') + '" type="text">' + (hint ? '<small>' + escapeHtml(hint) + '</small>' : '') + '</label>';
  }

  function renderSiteSettingsTextarea(key, label, value, hint) {
    return '<label class="ir-site-settings-field"><span>' + escapeHtml(label) + '</span><textarea data-v5-site-setting="' + escapeHtml(key) + '">' + escapeHtml(value || '') + '</textarea>' + (hint ? '<small>' + escapeHtml(hint) + '</small>' : '') + '</label>';
  }

  function renderSiteSettingsToggle(key, label, checked, hint) {
    return '<label class="ir-site-settings-toggle"><input data-v5-site-setting="' + escapeHtml(key) + '" type="checkbox"' + (checked ? ' checked' : '') + '><span><strong>' + escapeHtml(label) + '</strong>' + (hint ? '<small>' + escapeHtml(hint) + '</small>' : '') + '</span></label>';
  }

  function renderSiteSettingsNav(id, label) {
    return '<button class="' + (siteSettingsSection === id ? 'is-active' : '') + '" data-v5-action="site-settings-section" data-v5-settings-section="' + escapeHtml(id) + '" type="button">' + escapeHtml(label) + '</button>';
  }

  // IRGEZTNE_SITE_SETTINGS_POLISH_V067D
  function siteSettingsCount(text) {
    return String(text || '').length;
  }

  function renderSiteSettingsCounter(text, max, label) {
    var count = siteSettingsCount(text);
    var warn = count > max ? ' is-warn' : '';
    return '<small class="ir-site-settings-counter' + warn + '">' + escapeHtml(label) + ': ' + count + ' / ' + max + '</small>';
  }

  function renderSiteSettingsPanel(settings, site) {
    var section = siteSettingsSection || 'general';

    if (section === 'seo') {
      var seoTitle = siteSettingsGet(settings, 'seo.title', site.seoTitle || site.name || '');
      var seoDescription = siteSettingsGet(settings, 'seo.description', site.seoDescription || site.description || site.tagline || '');
      return '<h4>SEO</h4><p class="ir-site-settings-note">' + escapeHtml(t('General SEO settings for the whole website. Page-specific SEO remains in the page settings panel.', 'Общие SEO настройки всего сайта. SEO конкретной страницы остаётся в правой панели страницы.')) + '</p>' +
        renderSiteSettingsToggle('seo.noindex', t('Noindex website', 'Не индексировать сайт'), !!siteSettingsGet(settings, 'seo.noindex', false), t('Ask search engines not to index the whole website.', 'Попросить поисковые системы не индексировать весь сайт.')) +
        renderSiteSettingsInput('seo.title', t('Main SEO title', 'Главный SEO заголовок'), seoTitle, t('Recommended length: about 50–60 characters.', 'Рекомендуемая длина: примерно 50–60 символов.')) +
        renderSiteSettingsCounter(seoTitle, 60, t('Title length', 'Длина заголовка')) +
        renderSiteSettingsTextarea('seo.description', t('SEO description', 'SEO описание'), seoDescription, t('Recommended length: about 120–160 characters.', 'Рекомендуемая длина: примерно 120–160 символов.')) +
        renderSiteSettingsCounter(seoDescription, 160, t('Description length', 'Длина описания')) +
        renderSiteSettingsInput('seo.keywords', t('Keywords', 'Ключевые слова'), siteSettingsGet(settings, 'seo.keywords', ''), t('Optional. Comma-separated.', 'Необязательно. Через запятую.'));
    }

    if (section === 'urls') {
      return '<h4>URLs</h4><p class="ir-site-settings-note">' + escapeHtml(t('URL behavior for generated static pages.', 'Поведение URL для сгенерированных статических страниц.')) + '</p>' +
        renderSiteSettingsToggle('urls.pretty', t('Use pretty URLs', 'Красивые URL'), siteSettingsGet(settings, 'urls.pretty', true) !== false, '/about/ вместо /about.html') +
        renderSiteSettingsToggle('urls.addIndexHtml', t('Always add index.html', 'Всегда добавлять index.html'), !!siteSettingsGet(settings, 'urls.addIndexHtml', false), '') +
        renderSiteSettingsInput('urls.pagesPrefix', t('Pages prefix', 'Префикс страниц'), siteSettingsGet(settings, 'urls.pagesPrefix', ''), t('Example: docs, blog, pages.', 'Например: docs, blog, pages.'));
    }

    if (section === 'sitemap') {
      return '<h4>Sitemap / Robots</h4><p class="ir-site-settings-note">' + escapeHtml(t('Search indexing files generated with the website.', 'Файлы индексации, которые генерируются вместе с сайтом.')) + '</p>' +
        renderSiteSettingsToggle('sitemap.enabled', t('Generate sitemap.xml', 'Создавать sitemap.xml'), siteSettingsGet(settings, 'sitemap.enabled', true) !== false, '') +
        renderSiteSettingsToggle('robots.enabled', t('Generate robots.txt', 'Создавать robots.txt'), siteSettingsGet(settings, 'robots.enabled', true) !== false, '') +
        renderSiteSettingsTextarea('robots.extra', t('Custom robots rules', 'Дополнительные правила robots'), siteSettingsGet(settings, 'robots.extra', ''), 'Disallow: /drafts/');
    }

    if (section === 'opengraph') {
      var seoTitleForOg = siteSettingsGet(settings, 'seo.title', site.seoTitle || site.name || '');
      var seoDescForOg = siteSettingsGet(settings, 'seo.description', site.seoDescription || site.description || site.tagline || '');
      var ogTitle = siteSettingsGet(settings, 'opengraph.title', seoTitleForOg);
      var ogDesc = siteSettingsGet(settings, 'opengraph.description', seoDescForOg);
      var ogImage = siteSettingsGet(settings, 'opengraph.image', '');
      return '<h4>OpenGraph</h4><p class="ir-site-settings-note">' + escapeHtml(t('Social preview used by Telegram, Facebook, LinkedIn and many messengers.', 'Социальная карточка для Telegram, Facebook, LinkedIn и многих мессенджеров.')) + '</p>' +
        renderSiteSettingsToggle('opengraph.enabled', t('Generate OpenGraph tags', 'Создавать OpenGraph теги'), siteSettingsGet(settings, 'opengraph.enabled', true) !== false, '') +
        renderSiteSettingsInput('opengraph.title', 'OG title', ogTitle, t('Can inherit the main SEO title.', 'Может совпадать с главным SEO заголовком.')) +
        renderSiteSettingsCounter(ogTitle, 70, 'OG title') +
        renderSiteSettingsTextarea('opengraph.description', 'OG description', ogDesc, t('Short text for social preview.', 'Короткий текст для социальной карточки.')) +
        renderSiteSettingsCounter(ogDesc, 200, 'OG description') +
        renderSiteSettingsInput('opengraph.image', 'OG image', ogImage, t('Image URL or site asset path. Recommended ratio: 1200×630.', 'URL изображения или путь к asset. Рекомендуемое соотношение: 1200×630.')) +
        renderSiteSettingsInput('opengraph.type', 'OG type', siteSettingsGet(settings, 'opengraph.type', 'website'), 'website / article') +
        '<div class="ir-site-settings-og-preview"><div class="ir-site-settings-og-image">' + escapeHtml(ogImage ? 'IMG' : 'NO IMAGE') + '</div><strong>' + escapeHtml(ogTitle || site.name || 'IRGEZTNE') + '</strong><span>' + escapeHtml(ogDesc || t('Social preview description', 'Описание социальной карточки')) + '</span><em>' + escapeHtml(ogImage || t('No image selected', 'Изображение не выбрано')) + '</em></div>';
    }

    if (section === 'twitter') {
      return '<h4>Twitter / X Cards</h4><p class="ir-site-settings-note">' + escapeHtml(t('Optional cards for X/Twitter previews.', 'Дополнительные карточки предпросмотра для X/Twitter.')) + '</p>' +
        renderSiteSettingsToggle('twitter.enabled', t('Generate Twitter/X cards', 'Создавать Twitter/X cards'), siteSettingsGet(settings, 'twitter.enabled', true) !== false, '') +
        renderSiteSettingsInput('twitter.username', 'X / Twitter username', siteSettingsGet(settings, 'twitter.username', ''), '@username') +
        renderSiteSettingsInput('twitter.cardType', t('Card type', 'Тип карточки'), siteSettingsGet(settings, 'twitter.cardType', 'summary_large_image'), 'summary / summary_large_image');
    }

    if (section === 'privacy') {
      return '<h4>Privacy</h4><p class="ir-site-settings-note">' + escapeHtml(t('Privacy-related site behavior.', 'Поведение сайта, связанное с приватностью.')) + '</p>' +
        renderSiteSettingsToggle('privacy.cookieBanner', t('Cookie banner', 'Cookie banner'), !!siteSettingsGet(settings, 'privacy.cookieBanner', false), '') +
        renderSiteSettingsToggle('privacy.youtubeNoCookie', t('Privacy-enhanced YouTube embeds', 'Приватный режим YouTube embed'), !!siteSettingsGet(settings, 'privacy.youtubeNoCookie', false), '') +
        renderSiteSettingsToggle('privacy.vimeoDnt', t('Do Not Track for Vimeo', 'Do Not Track для Vimeo'), !!siteSettingsGet(settings, 'privacy.vimeoDnt', false), '');
    }

    if (section === 'speed') {
      return '<h4>' + escapeHtml(t('Speed', 'Скорость')) + '</h4><p class="ir-site-settings-note">' + escapeHtml(t('Output optimization for generated static files.', 'Оптимизация выходных статических файлов.')) + '</p>' +
        renderSiteSettingsToggle('speed.minifyHtml', t('Compress HTML', 'Сжимать HTML'), !!siteSettingsGet(settings, 'speed.minifyHtml', false), '') +
        renderSiteSettingsToggle('speed.minifyCss', t('Compress CSS', 'Сжимать CSS'), !!siteSettingsGet(settings, 'speed.minifyCss', false), '') +
        renderSiteSettingsToggle('speed.lazyImages', t('Lazy-load images', 'Ленивая загрузка изображений'), siteSettingsGet(settings, 'speed.lazyImages', true) !== false, '');
    }

    if (section === 'feed') {
      return '<h4>RSS / JSON Feed</h4><p class="ir-site-settings-note">' + escapeHtml(t('Optional feeds for sites that publish updates or articles.', 'Необязательные feed-файлы для сайтов с обновлениями или статьями.')) + '</p>' +
        renderSiteSettingsToggle('feed.rss', t('Enable RSS feed', 'Включить RSS feed'), !!siteSettingsGet(settings, 'feed.rss', false), '') +
        renderSiteSettingsToggle('feed.json', t('Enable JSON feed', 'Включить JSON feed'), !!siteSettingsGet(settings, 'feed.json', false), '') +
        renderSiteSettingsInput('feed.title', t('Feed title', 'Заголовок feed'), siteSettingsGet(settings, 'feed.title', site.name || ''), '');
    }

    if (section === 'backup') {
      return '<h4>Backup</h4><p class="ir-site-settings-note">' + escapeHtml(t('Backup policy for this local site. Full backup center can stay separate.', 'Политика резервных копий для этого локального сайта. Полный центр backup может оставаться отдельно.')) + '</p>' +
        renderSiteSettingsToggle('backup.autoBeforePublish', t('Backup before publish', 'Backup перед публикацией'), siteSettingsGet(settings, 'backup.autoBeforePublish', true) !== false, '') +
        renderSiteSettingsInput('backup.keepLast', t('Keep last backups', 'Хранить последних backup'), siteSettingsGet(settings, 'backup.keepLast', '10'), '') +
        renderSiteSettingsToggle('backup.includeGeneratedSite', t('Include generated site output', 'Включать сгенерированный сайт'), !!siteSettingsGet(settings, 'backup.includeGeneratedSite', false), t('Usually not needed because the site can be generated again.', 'Обычно не нужно, потому что сайт можно сгенерировать снова.')) +
        '<p class="ir-site-settings-note">' + escapeHtml(t('Provider tokens are not included in ordinary backups by default.', 'Токены провайдеров по умолчанию не входят в обычный backup.')) + '</p>';
    }

    // IRGEZTNE_SITE_SETTINGS_UI_TUNE_V067E
    if (section === 'html') {
      return '<h4>Custom HTML</h4><p class="ir-site-settings-note">' + escapeHtml(t('Advanced HTML injection points for the generated site.', 'Продвинутые HTML-вставки для сгенерированного сайта.')) + '</p>' +
        renderSiteSettingsTextarea('html.headEnd', t('Before closing </head>', 'Перед закрывающим </head>'), siteSettingsGet(settings, 'html.headEnd', ''), '') +
        renderSiteSettingsTextarea('html.bodyStart', t('After opening <body>', 'После открывающего <body>'), siteSettingsGet(settings, 'html.bodyStart', ''), '') +
        renderSiteSettingsTextarea('html.bodyEnd', t('Before closing </body>', 'Перед закрывающим </body>'), siteSettingsGet(settings, 'html.bodyEnd', ''), '');
    }

    if (section === 'css') {
      return '<h4>Custom CSS</h4><p class="ir-site-settings-note">' + escapeHtml(t('Site-level CSS overrides. This is for advanced styling and does not replace the Design tab.', 'CSS-переопределения уровня сайта. Это для продвинутой стилизации и не заменяет вкладку Дизайн.')) + '</p>' +
        renderSiteSettingsTextarea('css.custom', 'Custom CSS', siteSettingsGet(settings, 'css.custom', ''), t('Example: .site-header { border-radius: 18px; }', 'Например: .site-header { border-radius: 18px; }')) +
        '<div class="ir-site-settings-code-hint">' + escapeHtml(t('CSS will be saved with the current site and later injected into generated HTML.', 'CSS сохранится с текущим сайтом и позже будет подключаться к сгенерированному HTML.')) + '</div>';
    }

    return '<h4>' + escapeHtml(t('General', 'Общее')) + '</h4><p class="ir-site-settings-note">' + escapeHtml(t('Basic metadata for the current local site.', 'Базовые данные текущего локального сайта.')) + '</p>' +
      renderSiteSettingsInput('general.siteName', t('Site name', 'Название сайта'), siteSettingsGet(settings, 'general.siteName', site.name || ''), '') +
      renderSiteSettingsTextarea('general.description', t('Internal site description', 'Внутреннее описание сайта'), siteSettingsGet(settings, 'general.description', site.description || site.tagline || ''), '') +
      renderSiteSettingsInput('general.language', t('Language', 'Язык'), siteSettingsGet(settings, 'general.language', currentLang() === 'ru' ? 'ru' : 'en'), 'ru / en');
  }


  function saveSiteSettingsFromPanel() {
    if (!overlay) return;
    var state = readState();
    state.site = state.site || {};
    var settings = state.site.siteSettings || {};
    var inputs = overlay.querySelectorAll('[data-v5-site-setting]');
    Array.prototype.forEach.call(inputs, function (input) {
      var key = input.getAttribute('data-v5-site-setting');
      if (!key) return;
      var value = input.type === 'checkbox' ? !!input.checked : String(input.value || '').trim();
      if (input.type !== 'checkbox' && value === '') {
        siteSettingsDelete(settings, key);
      } else {
        siteSettingsSet(settings, key, value);
      }
    });
    state.site.siteSettings = settings;
    writeState(state);
    renderStudio();
  }

  function renderSiteCockpitLayer(state, manager, activeSite) {
    state = state || readState();
    manager = manager || readSiteManager();
    activeSite = activeSite || activeSiteEntry(manager);

    var site = state.site || {};
    var settings = site.siteSettings || {};
    var section = siteSettingsSection || 'general';

    return '<div class="ir-site-studio-v5-sites-manager ir-site-settings-layer">' +
      '<section class="ir-site-settings-head"><div><div class="ir-site-studio-v5-kicker">SITE SETTINGS</div><h3>' + escapeHtml(t('Site settings', 'Настройки сайта')) + ': ' + escapeHtml(site.name || (activeSite && activeSite.name) || 'Website') + '</h3><p>' + escapeHtml(t('Site-level options only. Editor, pages, design, preview, server and publish stay in their own top tabs.', 'Только настройки уровня сайта. Редактор, страницы, дизайн, предпросмотр, сервер и публикация остаются в своих верхних вкладках.')) + '</p></div><button class="ir-site-studio-v5-btn" data-v5-action="site-cockpit-back" type="button">← ' + escapeHtml(t('Back to websites', 'К сайтам')) + '</button></section>' +
      '<section class="ir-site-settings-shell">' +
        '<nav class="ir-site-settings-nav">' +
          renderSiteSettingsNav('general', t('General', 'Общее')) +
          renderSiteSettingsNav('seo', 'SEO') +
          renderSiteSettingsNav('urls', 'URLs') +
          renderSiteSettingsNav('sitemap', 'Sitemap / Robots') +
          renderSiteSettingsNav('opengraph', 'OpenGraph') +
          renderSiteSettingsNav('twitter', 'Twitter / X Cards') +
          renderSiteSettingsNav('privacy', 'Privacy') +
          renderSiteSettingsNav('speed', t('Speed', 'Скорость')) +
          renderSiteSettingsNav('feed', 'RSS / Feed') +
          renderSiteSettingsNav('backup', 'Backup') +
          renderSiteSettingsNav('html', 'Custom HTML') +
          renderSiteSettingsNav('css', 'Custom CSS') +
        '</nav>' +
        '<main class="ir-site-settings-panel">' +
          renderSiteSettingsPanel(settings, site) +
          '<div class="ir-site-settings-savebar"><button class="ir-site-studio-v5-btn ir-site-studio-v5-btn--primary" data-v5-action="site-settings-save" type="button">' + escapeHtml(t('Save settings', 'Сохранить настройки')) + '</button><span>' + escapeHtml(t('These settings are saved with the current local site.', 'Эти настройки сохраняются в текущем локальном сайте.')) + '</span></div>' +
        '</main>' +
      '</section>' +
    '</div>';
  }


  // IRGEZTNE_V082_CLEAN_11_TEMPLATES_TAB_RENDERER
  // IRGEZTNE_V083I_TEMPLATE_LAB_PREVIEW_HELPERS
  function closeTemplateLabPreviewV083I() {
    try {
      var oldModal = overlay && overlay.querySelector ? overlay.querySelector('.ir-site-studio-v5-template-preview-modal-v083i') : null;
      if (oldModal && oldModal.parentNode) oldModal.parentNode.removeChild(oldModal);
    } catch (error) {
      console.warn('IRGEZTNE template preview close failed', error);
    }
  }

  function openTemplateLabPreviewV083I(path, title) {
    if (!path) return;
    closeTemplateLabPreviewV083I();

    var modal = document.createElement('div');
    modal.className = 'ir-site-studio-v5-template-preview-modal-v083i';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');

    modal.innerHTML = '' +
      '<div class="ir-site-studio-v5-template-preview-shell-v083i">' +
      '  <header class="ir-site-studio-v5-template-preview-head-v083i">' +
      '    <div>' +
      '      <div class="ir-site-studio-v5-kicker">' + escapeHtml(t('Template preview', 'Превью шаблона')) + '</div>' +
      '      <strong>' + escapeHtml(title || t('Template preview', 'Превью шаблона')) + '</strong>' +
      '      <span>' + escapeHtml(path) + '</span>' +
      '    </div>' +
      '    <div class="ir-site-studio-v5-template-preview-actions-v083i">' +
      '      <a class="ir-site-studio-v5-btn ir-site-studio-v5-btn--ghost" href="' + escapeHtml(path) + '" target="_blank" rel="noopener">' + escapeHtml(t('Open in window', 'Открыть в окне')) + '</a>' +
      '      <button class="ir-site-studio-v5-btn ir-site-studio-v5-btn--danger" data-v5-action="template-lab-preview-close-v083i" type="button">×</button>' +
      '    </div>' +
      '  </header>' +
      '  <iframe class="ir-site-studio-v5-template-preview-iframe-v083i" src="' + escapeHtml(path) + '" title="' + escapeHtml(title || 'Template preview') + '"></iframe>' +
      '</div>';

    (overlay || document.body).appendChild(modal);
  }

  function renderTemplatesTabV082Clean11() {
    var templatesV083H = [
      {
        id: 'project-landing',
        titleEn: 'Landing / Product',
        titleRu: 'Лендинг / продукт',
        kindEn: 'Product landing',
        kindRu: 'Продуктовая страница',
        descEn: 'A wide starter template for a product, app, service, or project presentation.',
        descRu: 'Широкий стартовый шаблон для продукта, приложения, сервиса или презентации проекта.',
        path: 'template-lab/landing-product/index.html'
      },
      {
        id: 'business-product',
        titleEn: 'Business / Product',
        titleRu: 'Бизнес / продукт',
        kindEn: 'Company / product',
        kindRu: 'Компания / продукт',
        descEn: 'A serious product and service page for teams, companies, offers, and presentations.',
        descRu: 'Серьёзная продуктовая страница для команд, компаний, услуг, предложений и презентаций.',
        path: 'template-lab/business-product/index.html'
      },
      {
        id: 'blog-news',
        titleEn: 'Blog / News',
        titleRu: 'Блог / новости',
        kindEn: 'Blog / portal',
        kindRu: 'Блог / портал',
        descEn: 'An editorial template for articles, news, notes, publications, and journal-style pages.',
        descRu: 'Редакционный шаблон для статей, новостей, заметок, публикаций и журнальных страниц.',
        path: 'template-lab/blog-news/index.html'
      },
      {
        id: 'documentation-wide',
        titleEn: 'Documentation',
        titleRu: 'Документация',
        kindEn: 'Docs / help center',
        kindRu: 'Документация / справка',
        descEn: 'A documentation template with navigation, search, guides, API blocks, and reference pages.',
        descRu: 'Шаблон документации с навигацией, поиском, инструкциями, API-блоками и справочными страницами.',
        path: 'template-lab/documentation/index.html'
      },
      {
        id: 'studio-portfolio',
        titleEn: 'Portfolio / Personal',
        titleRu: 'Портфолио / личный сайт',
        kindEn: 'Portfolio / showcase',
        kindRu: 'Портфолио / showcase',
        descEn: 'A visual portfolio template for a creator, studio, team, work showcase, and case studies.',
        descRu: 'Визуальный шаблон для автора, студии, команды, работ, showcase и кейсов.',
        path: 'template-lab/portfolio-personal/index.html'
      },
      {
        id: 'agency-studio',
        titleEn: 'Agency / Studio',
        titleRu: 'Студия / агентство',
        kindEn: 'Agency / web studio',
        kindRu: 'Агентство / веб-студия',
        descEn: 'A template for a web studio, designer, agency, project team, services, and cases.',
        descRu: 'Шаблон для веб-студии, дизайнера, агентства, проектной команды, услуг и кейсов.',
        path: 'template-lab/agency-studio/index.html'
      }
    ];

    function templateCardV083H(item) {
      var title = t(item.titleEn, item.titleRu);
      var kind = t(item.kindEn, item.kindRu);
      var desc = t(item.descEn, item.descRu);
      var path = item.path;

      return '' +
        '<article class="ir-site-studio-v5-template-lab-card-v083h" data-template-id="' + escapeHtml(item.id) + '">' +
        '  <div class="ir-site-studio-v5-template-lab-card-head-v083h">' +
        '    <div>' +
        '      <div class="ir-site-studio-v5-template-lab-kicker-v083h">' + escapeHtml(t('Real preview', 'Реальное превью')) + '</div>' +
        '      <h4>' + escapeHtml(title) + '</h4>' +
        '    </div>' +
        '    <span>' + escapeHtml(kind) + '</span>' +
        '  </div>' +
        '  <div class="ir-site-studio-v5-template-lab-frame-v083h">' +
        '    <iframe loading="lazy" src="' + escapeHtml(path) + '" title="' + escapeHtml(title) + '"></iframe>' +
        '  </div>' +
        '  <p>' + escapeHtml(desc) + '</p>' +
        '  <div class="ir-site-studio-v5-template-lab-actions-v083h">' +
        '    <button class="ir-site-studio-v5-btn ir-site-studio-v5-btn--ghost ir-site-studio-v5-template-lab-link-v083h" data-v5-action="template-lab-open-preview-v083i" data-v5-template-id="' + escapeHtml(item.id) + '" data-v5-template-title="' + escapeHtml(title) + '" data-v5-template-path="' + escapeHtml(path) + '" type="button">' + escapeHtml(t('Open preview', 'Открыть превью')) + '</button>' +
        '    <button class="ir-site-studio-v5-btn ir-site-studio-v5-btn--primary" data-v5-action="template-lab-use-v083h" data-v5-template-id="' + escapeHtml(item.id) + '" data-v5-template-path="' + escapeHtml(path) + '" type="button">' + escapeHtml(t('Choose template', 'Выбрать шаблон')) + '</button>' +
        '  </div>' +
        '</article>';
    }

    return '' +
      '<section class="ir-site-studio-v5-templates-real-v083h">' +
      '  <div class="ir-site-studio-v5-templates-real-head-v083h">' +
      '    <div>' +
      '      <div class="ir-site-studio-v5-kicker">' + escapeHtml(t('Templates', 'Шаблоны')) + '</div>' +
      '      <h3>' + escapeHtml(t('Official templates', 'Официальные шаблоны')) + '</h3>' +
      '      <p>' + escapeHtml(t('The Web Studio template tab now shows real Template Lab pages, not simplified mockups. Open a preview to inspect the actual HTML template.', 'Вкладка шаблонов Web Studio теперь показывает реальные страницы Template Lab, а не упрощённые муляжи. Откройте превью, чтобы посмотреть настоящий HTML-шаблон.')) + '</p>' +
      '    </div>' +
      '    <span>' + escapeHtml(t('6 real previews', '6 реальных превью')) + '</span>' +
      '  </div>' +
      '  <div class="ir-site-studio-v5-template-lab-grid-v083h">' +
      templatesV083H.map(templateCardV083H).join('') +
      '  </div>' +
      '</section>';
  }

  function normalizeStudioTabId(tabId, fallback) {
    var id = String(tabId || '').trim().toLowerCase();

    var textMap = {
      sites: 'sites',
      site: 'sites',
      'сайты': 'sites',
      'сайт': 'sites',

      'site-settings': 'site-settings',
      'site settings': 'site-settings',
      'настройки сайта': 'site-settings',

      templates: 'templates',
      template: 'templates',
      'шаблоны': 'templates',
      'шаблон': 'templates',

      page: 'page',
      editor: 'page',
      edit: 'page',
      'редактор': 'page',

      pages: 'pages',
      'страницы': 'pages',

      menu: 'menu',
      'меню': 'menu',

      identity: 'identity',
      design: 'identity',
      'дизайн': 'identity',

      preview: 'preview',
      'предпросмотр': 'preview',

      server: 'server',
      setup: 'server',
      settings: 'server',
      'сервер': 'server',
      'настройка публикации': 'server',
      'настроить сервер': 'server',

      publish: 'publish',
      publishing: 'publish',
      deploy: 'publish',
      publication: 'publish',
      polish: 'server',
      'публикация': 'server',
      'настроить публикацию': 'server',
      'опубликовать': 'publish'
    };

    if (textMap[id]) return textMap[id];

    /*
      Important:
      Unknown tab ids must NOT silently become "page".
      That was the reason new shell tabs became duplicate "Редактор".
      If caller passed fallback, return fallback exactly.
    */
    if (arguments.length > 1) return fallback;

    return 'page';
  }

  function renderSiteManagerTab(state) {
    var manager = readSiteManager();
    var activeSite = activeSiteEntry(manager);
    var draft = getSiteManagerDraft();
    var icons = siteIconOptions().map(function (icon) {
      return '<button class="ir-site-studio-v5-site-icon-choice' + (draft.icon === icon ? ' is-active' : '') + '" data-v5-action="site-draft-icon" data-v5-site-icon="' + escapeHtml(icon) + '" type="button">' + escapeHtml(icon) + '</button>';
    }).join('');
    var colors = siteColorOptions().map(function (color) {
      return '<button class="ir-site-studio-v5-site-color-choice' + (normalizeHexColor(draft.color, '#2f7be6') === color ? ' is-active' : '') + '" data-v5-action="site-draft-color" data-v5-site-color="' + escapeHtml(color) + '" type="button" style="--site-color:' + escapeHtml(color) + '"></button>';
    }).join('');
    var templateOptions = [
      ['project-landing', 'Landing / Product'],
      ['business-product', 'Business / Product'],
      ['blog-news', 'Blog / News'],
      ['documentation-wide', 'Documentation'],
      ['studio-portfolio', 'Portfolio / Personal'],
      ['agency-studio', 'Agency / Studio']
    ].map(function (item) {
      return '<option value="' + escapeHtml(item[0]) + '"' + (draft.template === item[0] ? ' selected' : '') + '>' + escapeHtml(item[1]) + '</option>';
    }).join('');
    var siteCards = manager.sites.map(function (site) {
      var isActive = activeSite && site.id === activeSite.id;
      var siteState = normalizeState(site.state || initialState());
      var pagesCount = Array.isArray(siteState.pages) ? siteState.pages.length : 0;
      var menuCount = getPreviewNavItems(siteState).length;
      return '<article class="ir-site-studio-v5-site-card' + (isActive ? ' is-active' : '') + '">' +
        '<div class="ir-site-studio-v5-site-card-icon" style="--site-color:' + escapeHtml(site.color || '#2f7be6') + '">' + escapeHtml(site.icon || '◆') + '</div>' +
        '<div class="ir-site-studio-v5-site-card-main"><strong>' + escapeHtml(site.name || 'Website') + '</strong><span>' + escapeHtml((site.author ? site.author + ' · ' : '') + pagesCount + ' ' + t('pages', 'стр.') + ' · ' + menuCount + ' ' + t('nav', 'нав.')) + '</span></div>' +
        '<div class="ir-site-studio-v5-site-card-actions">' +
          '<button class="ir-site-studio-v5-btn ir-site-studio-v5-btn--sm' + (isActive ? ' ir-site-studio-v5-btn--primary' : '') + '" data-v5-action="site-switch" data-v5-site-id="' + escapeHtml(site.id) + '" type="button">' + escapeHtml(isActive ? t('Open', 'Открыт') : uiLabel('open')) + '</button>' +
          '<button class="ir-site-studio-v5-btn ir-site-studio-v5-btn--sm" data-v5-action="site-duplicate" data-v5-site-id="' + escapeHtml(site.id) + '" type="button">' + escapeHtml(uiLabel('duplicate')) + '</button>' +
          '<button class="ir-site-studio-v5-btn ir-site-studio-v5-btn--danger ir-site-studio-v5-btn--sm" data-v5-action="site-delete" data-v5-site-id="' + escapeHtml(site.id) + '" type="button"' + (manager.sites.length <= 1 ? ' disabled' : '') + '>' + escapeHtml(uiLabel('delete')) + '</button>' +
        '</div>' +
      '</article>';
    }).join('');
    return '<div class="ir-site-studio-v5-sites-manager">' +
      '<section class="ir-site-studio-v5-sites-hero">' +
        '<div><div class="ir-site-studio-v5-kicker">Local Site Identity</div><h3>' + escapeHtml(t('Sites / local websites', 'Сайты / локальные сайты')) + '</h3><p>' + escapeHtml(t('Each website has its own pages, menu, template, colors and future publish settings. No cloud account is required.', 'У каждого сайта свои страницы, меню, шаблон, цвета и будущие настройки публикации. Облачный аккаунт не нужен.')) + '</p></div>' +
        '<div class="ir-site-studio-v5-current-site-badge"><span style="--site-color:' + escapeHtml(activeSite ? activeSite.color : '#2f7be6') + '">' + escapeHtml(activeSite ? activeSite.icon : '◆') + '</span><strong>' + escapeHtml(activeSite ? activeSite.name : 'Website') + '</strong><small>' + escapeHtml(activeSite && activeSite.author ? activeSite.author : t('Local workspace', 'Локальный workspace')) + '</small></div>' +
      '</section>' +
      '<section class="ir-site-studio-v5-sites-grid">' +
        '<article class="ir-site-studio-v5-create-site-card">' +
          '<h4>' + escapeHtml(t('Create website', 'Создать сайт')) + '</h4>' +
          '<div class="ir-site-studio-v5-site-create-top"><div class="ir-site-studio-v5-site-big-icon" style="--site-color:' + escapeHtml(draft.color || '#2f7be6') + '">' + escapeHtml(draft.icon || '☕') + '</div><div class="ir-site-studio-v5-site-icon-grid">' + icons + '</div></div>' +
          '<label class="ir-site-studio-v5-setting-row"><span>' + escapeHtml(t('Website name', 'Название сайта')) + '</span><input class="ir-site-studio-v5-input' + (siteManagerError && siteManagerErrorField === 'name' ? ' is-invalid' : '') + '" data-v5-site-manager-field="name" placeholder="' + escapeHtml(t('Example: Project Studio', 'Например: Project Studio')) + '" value="' + escapeHtml(draft.name || '') + '"></label>' +
          '<label class="ir-site-studio-v5-setting-row"><span>' + escapeHtml(t('Author / owner *', 'Автор / владелец *')) + '</span><input class="ir-site-studio-v5-input' + (siteManagerError && siteManagerErrorField === 'author' ? ' is-invalid' : '') + '" data-v5-site-manager-field="author" placeholder="' + escapeHtml(t('Write the site owner name', 'Напишите имя владельца сайта')) + '" value="' + escapeHtml(draft.author || '') + '"></label>' +
          '<label class="ir-site-studio-v5-setting-row"><span>' + escapeHtml(t('Template', 'Шаблон')) + '</span><select class="ir-site-studio-v5-select" data-v5-site-manager-field="template">' + templateOptions + '</select></label>' +
          '<div class="ir-site-studio-v5-site-color-row">' + colors + '<input class="ir-site-studio-v5-color-picker" type="color" data-v5-site-manager-field="color" value="' + escapeHtml(normalizeHexColor(draft.color, '#2f7be6')) + '"></div>' +
          (siteManagerError ? '<p class="ir-site-studio-v5-form-error">' + escapeHtml(siteManagerError) + '</p>' : '') +
          '<button class="ir-site-studio-v5-btn ir-site-studio-v5-btn--primary" data-v5-action="site-create" type="button">' + escapeHtml(t('Create website', 'Создать сайт')) + '</button>' +
        '</article>' +
        '<article class="ir-site-studio-v5-restore-site-card">' +
          '<h4>' + escapeHtml(t('Restore / backup', 'Восстановить / backup')) + '</h4>' +
          '<p class="ir-site-studio-v5-note">' + escapeHtml(t('Use Backup before updates. Publish tokens are not included by default.', 'Перед обновлениями используйте резервную копию. Токены публикации по умолчанию не входят в backup.')) + '</p>' +
          '<div class="ir-site-studio-v5-backup-drop">↻<span>' + escapeHtml(t('Backup protects local sites, pages, menus and settings.', 'Backup защищает локальные сайты, страницы, меню и настройки.')) + '</span></div>' +
          '<button class="ir-site-studio-v5-btn" data-v5-action="open-backup-center" type="button">' + escapeHtml(t('Open Backup Center', 'Открыть центр резервных копий')) + '</button>' +
        '</article>' +
      '</section>' +
      '<section class="ir-site-studio-v5-site-list-section"><div class="ir-site-studio-v5-menu-groups-head"><div><h4>' + escapeHtml(t('Existing websites', 'Существующие сайты')) + '</h4><p class="ir-site-studio-v5-note">' + escapeHtml(t('Switch website before editing or publishing. Future publish settings will be saved per website.', 'Переключайте сайт перед редактированием или публикацией. Будущие настройки публикации будут храниться отдельно для каждого сайта.')) + '</p></div></div><div class="ir-site-studio-v5-site-card-list">' + siteCards + '</div></section>' +
    '</div>';
  }


  // IRGEZTNE_V082_CLEAN_4_SAFE_TAB_NORMALIZER
  function normalizeStudioTabId(tabId, fallback) {
    var id = String(tabId || '').trim().toLowerCase();

    var textMap = {
      sites: 'sites',
      site: 'sites',
      'сайты': 'sites',
      'сайт': 'sites',

      'site-settings': 'site-settings',
      'site settings': 'site-settings',
      'настройки сайта': 'site-settings',

      templates: 'templates',
      template: 'templates',
      'шаблоны': 'templates',
      'шаблон': 'templates',

      page: 'page',
      editor: 'page',
      edit: 'page',
      'редактор': 'page',

      pages: 'pages',
      'страницы': 'pages',

      menu: 'menu',
      'меню': 'menu',

      identity: 'identity',
      design: 'identity',
      'дизайн': 'identity',

      preview: 'preview',
      'предпросмотр': 'preview',

      server: 'server',
      setup: 'server',
      settings: 'server',
      'сервер': 'server',
      'настройка публикации': 'server',
      'настроить сервер': 'server',

      publish: 'publish',
      publishing: 'publish',
      deploy: 'publish',
      publication: 'publish',
      polish: 'server',
      'публикация': 'server',
      'настроить публикацию': 'server',
      'опубликовать': 'publish'
    };

    if (textMap[id]) return textMap[id];

    /*
      Important:
      Unknown tab ids must NOT silently become "page".
      That was the reason new shell tabs became duplicate "Редактор".
      If caller passed fallback, return fallback exactly.
    */
    if (arguments.length > 1) return fallback;

    return 'page';
  }

  function renderWorkspace(state, page) {
    activeTab = normalizeStudioTabId(activeTab, 'page');
    if (activeTab === 'sites') return renderSiteManagerTab(state);
    if (activeTab === 'site-settings') return renderSiteCockpitLayer(state);
    if (activeTab === 'templates') return renderTemplatesTabV082Clean11(state);
    if (activeTab === 'preview') return renderПредпросмотрTab(state, page);
    if (activeTab === 'pages') return renderPagesManagerTab(state, page);
    if (activeTab === 'menu') return renderMenuManagerTab(state, page);
    if (activeTab === 'server' || activeTab === 'publish') return renderPublishTab(state, page);
    if (activeTab === 'identity') return renderIdentityTab(state);
    return renderPageTab(state, page);
  }

  function isPageSettingsRelevant(tab) {
    tab = normalizeStudioTabId(tab, 'page');
    return tab === 'page' || tab === 'pages';
  }

  // IRGEZTNE_V082_CLEAN_3_TOPNAV_SINGLE_ORDER

  function webStudioCurrentTopTabIdsV082Clean3() {
    // IRGEZTNE_V082_CLEAN_11_TEMPLATES_TAB_STABLE
    // IRGEZTNE_V084S_SITE_SETTINGS_TAB_STABLE
    return ['sites', 'site-settings', 'templates', 'page', 'pages', 'menu', 'identity', 'preview', 'server'];
  }

  function webStudioCurrentTopTabsV082Clean3() {
    return webStudioCurrentTopTabIdsV082Clean3().map(function (id) {
      return [id, studioTopTabLabel(id)];
    });
  }


  function studioTopTabLabel(tabId) {
    tabId = normalizeStudioTabId(tabId, tabId || 'page');
    var ru = currentLang() === 'ru';
    var map = {
      sites: ru ? 'Сайты' : 'Sites',
      'site-settings': ru ? 'Настройки' : 'Settings',
      templates: ru ? 'Шаблоны' : 'Templates',
      page: ru ? 'Редактор' : 'Editor',
      pages: ru ? 'Страницы' : 'Pages',
      menu: ru ? 'Меню' : 'Menu',
      identity: ru ? 'Дизайн' : 'Design',
      preview: ru ? 'Предпросмотр' : 'Preview',
      server: ru ? 'Сервер' : 'Server',
      publish: ru ? 'Опубликовать' : 'Publish'
    };
    return map[tabId] || uiLabel(tabId);
  }

  function studioQuickPublishButton(state) {
    state.site.publishSettings = normalizePublishSettings(state.site.publishSettings);
    var selected = state.site.publishSettings.selectedProvider || 'manual';
    var config = state.site.publishSettings.providers[selected] || defaultPublishProviderConfig(selected);
    var meta = publishProviderMeta(selected);
    var missing = publishMissingFields(config, meta);
    var ready = isPublishConfigured(selected, config, meta) || (selected === 'netlify' && missing.length === 0 && !!String(config.token || '').trim() && !!String(config.siteId || '').trim());
    var label = t('Publish changes', 'Опубликовать');
    var cls = ready ? ' ir-site-studio-v5-btn--primary ir-site-studio-v5-quick-publish ir-site-studio-v5-top-publish-action is-ready' : ' ir-site-studio-v5-quick-publish ir-site-studio-v5-top-publish-action is-not-ready';
    var title = ready ? t('Publish current website using saved provider settings', 'Опубликовать текущий сайт через сохранённые настройки') : t('Server is not configured yet. Open Server setup first.', 'Сервер ещё не настроен. Сначала откройте настройку сервера.');
    return '<button class="ir-site-studio-v5-btn' + cls + '" data-v5-action="quick-publish" data-v5-top-publish="1" type="button" title="' + escapeHtml(title) + '">' + escapeHtml(label) + '</button>';
  }


  // IRGEZTNE_V082_CLEAN_6_SINGLE_TOPNAV_OWNER
  function isWebStudioServerConfiguredV082Clean6() {
    try {
      var state = readState();
      state.site.publishSettings = normalizePublishSettings(state.site.publishSettings);
      var providerId = state.site.publishSettings.selectedProvider || 'manual';
      var config = state.site.publishSettings.providers[providerId] || defaultPublishProviderConfig(providerId);
      return providerId !== 'manual' && isPublishConfigured(providerId, config, publishProviderMeta(providerId));
    } catch (error) {
      return false;
    }
  }


  function renderWebStudioTopNavigationV082Clean6(activeId, serverConfigured, quickPublishButton) {
    var ids = webStudioCurrentTopTabIdsV082Clean3();
    return '<div class="ir-site-studio-v5-tabs ir-site-studio-v5-tabs--top ir-site-studio-v5-tabs--shell-v082clean13">' + ids.map(function (id) {
      var label = studioTopTabLabel(id);
      var extraClass = id === 'server' && serverConfigured ? ' is-server-ready' : '';
      var labelText = id === 'server' && serverConfigured ? ('✓ ' + label) : label;

      return '<button class="ir-site-studio-v5-shell-tab-v082clean13' +
        (activeId === id ? ' is-active' : '') +
        extraClass +
        '" data-v5-tab="' + escapeHtml(id) +
        '" type="button" title="' + escapeHtml(label) +
        '" aria-label="' + escapeHtml(label) +
        '">' + escapeHtml(labelText) + '</button>';
    }).join('') + quickPublishButton + '</div>';
  }


  function syncWebStudioTopNavigationV082Clean6() {
    if (!overlay) return;

    var ids = webStudioCurrentTopTabIdsV082Clean3();
    var serverConfigured = isWebStudioServerConfiguredV082Clean6();
    var buttons = Array.prototype.slice.call(overlay.querySelectorAll('.ir-site-studio-v5-tabs--top [data-v5-tab]'));

    buttons.forEach(function (button, index) {
      var id = ids[index];
      if (!id) return;

      var label = studioTopTabLabel(id);
      var labelText = id === 'server' && serverConfigured ? ('✓ ' + label) : label;

      button.classList.remove('ir-site-studio-v5-tab');
      button.classList.add('ir-site-studio-v5-shell-tab-v082clean13');

      button.setAttribute('data-v5-tab', id);
      button.setAttribute('title', label);
      button.setAttribute('aria-label', label);
      button.setAttribute('data-v5-shell-owner', 'v082-clean-13');
      button.textContent = labelText;

      button.classList.toggle('is-active', activeTab === id);
      button.classList.toggle('is-server-ready', id === 'server' && serverConfigured);
    });
  }

  function syncStudioTopTabLabels() {
    syncWebStudioTopNavigationV082Clean6();
  }


  function forceStudioTopTabLabels() {
    syncWebStudioTopNavigationV082Clean6();
  }


  function scheduleStudioTopTabLabelSync() {
    syncWebStudioTopNavigationV082Clean6();
    setTimeout(syncWebStudioTopNavigationV082Clean6, 0);
    setTimeout(syncWebStudioTopNavigationV082Clean6, 50);
    setTimeout(syncWebStudioTopNavigationV082Clean6, 160);
  }

  function renderStudio() {
    if (!overlay) return;
    activeTab = normalizeStudioTabId(activeTab, 'page');
    var state = readState();
    var page = activePage(state);
    var tabs = webStudioCurrentTopTabsV082Clean3();
    overlay.classList.toggle('is-left-collapsed', collapsedLeft);
    overlay.classList.toggle('is-right-collapsed', collapsedRight);
    var pageSettingsRelevant = isPageSettingsRelevant(activeTab);
    overlay.classList.toggle('is-preview-tab', activeTab === 'preview');
    overlay.classList.toggle('is-server-tab', activeTab === 'server' || activeTab === 'publish');
    overlay.classList.toggle('is-site-manager-tab', activeTab === 'sites' || activeTab === 'site-settings');
    overlay.classList.toggle('is-settings-irrelevant', !pageSettingsRelevant);
    overlay.classList.toggle('is-preview-wide', activeTab === 'preview' && previewWide);
    /*
       IRGEZTNE_WEBSTUDIO_HEADER_SITE_LOGO_V084T

       site.icon belongs to the local Sites manager card.
       The global Web Studio header shows the actual website logo.
    */
    var headerSiteMark = normalizeLooseLogoLettersV069E(
      state.site.logoLetters ||
      initialsFromName(state.site.name || 'Website')
    ).slice(0, 3) || initialsFromName(state.site.name || 'Website').slice(0, 2);
    var headerSiteMarkBg = state.site.logoBackgroundColor || state.site.accentColor || state.site.siteColor || '#2f7be6';
    var headerSiteMarkText = state.site.logoTextColor || '#ffffff';
    var headerSitePill = '<button class="ir-site-studio-v5-header-site" data-v5-action="open-sites" type="button" title="' + escapeHtml(t('Switch website', 'Переключить сайт')) + '"><span class="ir-site-studio-v5-header-site-icon" style="--site-color:' + escapeHtml(headerSiteMarkBg) + ';color:' + escapeHtml(headerSiteMarkText) + '">' + escapeHtml(headerSiteMark) + '</span><span><strong>' + escapeHtml(state.site.name || 'Website') + '</strong><small>' + escapeHtml(state.site.author || t('Local site', 'Локальный сайт')) + '</small></span></button>';
    var langLabel = currentLang() === 'ru' ? 'RU' : 'EN';
    var themeLabel = currentTheme() === 'light' ? '☀' : '☾';
    var settingsButton = ''; // v082-clean-2: page settings button does not belong in the global Web Studio header.
    var publishSettingsForTop = normalizePublishSettings(state.site.publishSettings);
    var topProviderId = publishSettingsForTop.selectedProvider || 'manual';
    var topProviderConfig = publishSettingsForTop.providers[topProviderId] || defaultPublishProviderConfig(topProviderId);
    var serverConfigured = topProviderId !== 'manual' && isPublishConfigured(topProviderId, topProviderConfig, publishProviderMeta(topProviderId));
    var quickPublishButton = studioQuickPublishButton(state);
    var topNavigation = renderWebStudioTopNavigationV082Clean6(activeTab, serverConfigured, quickPublishButton);
    var html = '<div class="ir-site-studio-v5-modal" role="dialog" aria-modal="true"><header class="ir-site-studio-v5-head"><div class="ir-site-studio-v5-title"><div class="ir-site-studio-v5-kicker">IRGEZTNE Workspace</div><strong>' + escapeHtml(t('Web Studio', 'Студия сайта')) + '</strong><span>' + escapeHtml(t('Sites, pages, design, preview and publish are separated.', 'Сайты, страницы, дизайн, предпросмотр и публикация разделены.')) + '</span></div><div class="ir-site-studio-v5-head-center">' + topNavigation + '</div><div class="ir-site-studio-v5-head-actions">' + headerSitePill + settingsButton + '<button class="ir-site-studio-v5-btn ir-site-studio-v5-toggle-btn" data-v5-action="toggle-studio-lang" type="button" title="Language">' + escapeHtml(langLabel) + '</button><button class="ir-site-studio-v5-btn ir-site-studio-v5-toggle-btn" data-v5-action="toggle-studio-theme" type="button" title="Theme">' + escapeHtml(themeLabel) + '</button><button class="ir-site-studio-v5-btn ir-site-studio-v5-btn--danger" data-v5-action="close" type="button" title="Close Web Studio" aria-label="Close Web Studio">×</button></div></header><div class="ir-site-studio-v5-body"><aside class="ir-site-studio-v5-panel">' + renderSidebar(state) + '</aside><main class="ir-site-studio-v5-main"><div class="ir-site-studio-v5-workspace">' + renderWorkspace(state, page) + '</div></main><aside class="ir-site-studio-v5-settings">' + renderSettings(state, page) + '</aside></div></div>';
    destroySiteJodit();
    overlay.innerHTML = html;
    overlay.classList.toggle('ir-site-studio-v5-theme-light', currentTheme() === 'light');
    overlay.classList.toggle('ir-site-studio-v5-theme-dark', currentTheme() !== 'light');
    overlay.classList.toggle('ir-site-studio-v5-lang-ru', currentLang() === 'ru');
    overlay.classList.toggle('ir-site-studio-v5-lang-en', currentLang() !== 'ru');
    try { scheduleStudioTopTabLabelSync(); } catch (error) { log('Top tab label sync failed', error); }
    // IRGEZTNE_V083J_DISABLE_RU_NORMALIZER_IN_EN
    // This normalizer is only allowed in RU mode.
    // In EN/N mode it rewrites Templates/Editor back to Шаблоны/Редактор.
    if (currentLang() === 'ru') {
      try { normalizeVisibleRuLabels(overlay); } catch (error) { log('RU label normalization failed', error); }
    }
    if (activeTab === 'preview') refreshPreviewFrame();
    if (activeTab === 'page') mountEditorWorkbenchV084B(page);
  }


  function repairPublishTabDom() {
    syncWebStudioTopNavigationV082Clean6();
  }

  function openStudio() {
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'ir-site-studio-v5-overlay';
      overlay.dataset.irSiteStudioV5 = '1';
      document.body.appendChild(overlay);
      overlay.addEventListener('click', handleOverlayClick, true);
      overlay.addEventListener('input', handleOverlayInput, true);
      overlay.addEventListener('change', handleOverlayInput, true);
      overlay.addEventListener('keydown', handleOverlayKeydown, true);
      overlay.addEventListener('keyup', handleOverlayKeyup, true);
      overlay.addEventListener('dragstart', handleOverlayDragStart, true);
      overlay.addEventListener('dragover', handleOverlayDragOver, true);
      overlay.addEventListener('drop', handleOverlayDrop, true);
    }
    overlay.classList.add('is-open');
    renderStudio();
  }

  function openStudioTab(tabId) {
    activeTab = normalizeStudioTabId(tabId, 'page');

    if (activeTab === 'page') {
      collapsedRight = false;
    } else if (!isPageSettingsRelevant(activeTab)) {
      collapsedRight = true;
    }

    openStudio();
  }

  function closeStudio() { destroySiteJodit(); if (overlay) overlay.classList.remove('is-open'); }

  function activeMenuGroup(state) {
    ensureMenuGroups(state);
    return (state.menuGroups || []).find(function (group) { return group.id === state.activeMenuGroupId; }) || (state.menuGroups || [])[0];
  }

  function addMenuItem(type) {
    var state = readState();
    var group = activeMenuGroup(state);
    if (!group) return;
    var pages = Array.isArray(state.pages) ? state.pages : [];
    var targetPage = pages.find(function (item) { return item.id === state.activePageId; }) || pages[0];
    var itemType = type === 'external' || type === 'social' ? type : 'page';
    var item = {
      id: uid('menuItem'),
      label: itemType === 'social' ? t('Social link', 'Соцссылка') : (itemType === 'external' ? t('External link', 'Внешняя ссылка') : pageLabel(targetPage)),
      type: itemType,
      pageId: itemType === 'page' ? (targetPage && targetPage.id ? targetPage.id : '') : '',
      url: itemType === 'page' ? '' : 'https://',
      order: Array.isArray(group.items) ? group.items.length : 0
    };
    if (!Array.isArray(group.items)) group.items = [];
    group.items.push(item);
    writeState(state);
    activeTab = 'menu';
    renderStudio();
  }

  function moveMenuItem(groupId, itemId, delta) {
    var state = readState();
    ensureMenuGroups(state);
    var group = (state.menuGroups || []).find(function (candidate) { return candidate.id === groupId; });
    if (!group) return;
    group.items.sort(function (a, b) { return Number(a.order || 0) - Number(b.order || 0); });
    var index = group.items.findIndex(function (item) { return item.id === itemId; });
    var next = index + delta;
    if (index < 0 || next < 0 || next >= group.items.length) return;
    var tmp = group.items[index];
    group.items[index] = group.items[next];
    group.items[next] = tmp;
    group.items.forEach(function (item, order) { item.order = order; });
    writeState(state);
    activeTab = 'menu';
    renderStudio();
  }

  function deleteMenuItem(groupId, itemId) {
    var state = readState();
    ensureMenuGroups(state);
    var group = (state.menuGroups || []).find(function (candidate) { return candidate.id === groupId; });
    if (!group) return;
    group.items = group.items.filter(function (item) { return item.id !== itemId; });
    group.items.forEach(function (item, order) { item.order = order; });
    writeState(state);
    activeTab = 'menu';
    renderStudio();
  }

  function addPageToHeaderMenu(pageId) {
    var state = readState();
    var page = (state.pages || []).find(function (item) { return item.id === pageId; });
    if (!page) return;
    page.inMenu = true;
    var parent = page.parentId ? (state.pages || []).find(function (item) { return item.id === page.parentId; }) : null;
    if (parent) {
      parent.inMenu = true;
      ensurePageInHeaderMenu(state, parent);
    } else {
      ensurePageInHeaderMenu(state, page);
    }
    writeState(state);
    activeTab = 'pages';
    renderStudio();
  }

  function resetHeaderMenuToHome() {
    var state = readState();
    var header = headerMenuGroup(state);
    var home = findHomePage(state);
    if (!header || !home) return;
    header.items = [createMenuItemFromPage(home, 0)];
    (state.pages || []).forEach(function (page) { page.inMenu = page.id === home.id; });
    state.__preview4ManualMenuModelV1 = true;
    writeState(state);
    activeTab = 'menu';
    renderStudio();
  }

  function addTopLevelPagesToHeaderMenu() {
    var state = readState();
    var changed = false;
    orderedPageList(state).forEach(function (page) {
      if (!page || page.parentId) return;
      if (ensurePageInHeaderMenu(state, page)) changed = true;
    });
    if (changed) syncPageMenuFlags(state);
    writeState(state);
    activeTab = 'pages';
    renderStudio();
  }


  // IRGEZTNE_SITE_CREATE_FIELD_FOCUS_V084W
  function focusSiteCreateFieldV084W(fieldName) {
    function run() {
      if (!overlay) return;

      var input = overlay.querySelector(
        '[data-v5-site-manager-field="' + fieldName + '"]'
      );

      if (!input || typeof input.focus !== 'function') return;

      input.focus();

      try {
        var len = String(input.value || '').length;
        input.setSelectionRange(len, len);
      } catch (error) {}
    }

    run();
    setTimeout(run, 40);
    setTimeout(run, 140);

    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(run);
    }
  }

  function focusSiteCreateAuthorFieldV068J() {
    focusSiteCreateFieldV084W('author');
  }

  function focusSiteCreateNameFieldV084W() {
    focusSiteCreateFieldV084W('name');
  }

  function normalizeLocalSiteNameV084W(value) {
    var normalized = String(value || '');

    try {
      normalized = normalized.normalize('NFKC');
    } catch (error) {}

    return normalized
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function createLocalSite() {
    /* IRGEZTNE_OFFICIAL_TEMPLATE_STARTERS_V071A */
    function normalizeTemplateIdV071A(value) {
      var id = String(value || '').trim().toLowerCase();
      if (id === 'landing' || id === 'modern-landing' || id === 'modern-landing-wide') return 'project-landing';
      if (id === 'portfolio' || id === 'personal' || id === 'portfolio-personal') return 'studio-portfolio';
      if (id === 'knowledge-base' || id === 'documentation' || id === 'docs') return 'documentation-wide';
      if (id === 'business' || id === 'product' || id === 'business-product') return 'business-product';
      if (id === 'agency' || id === 'studio' || id === 'agency-studio') return 'agency-studio';
      if (id === 'blog' || id === 'news' || id === 'blog-news') return 'blog-news';
      return id || 'project-landing';
    }

    function templateMetaV071A(templateId) {
      var id = normalizeTemplateIdV071A(templateId);
      var map = {
        'project-landing': { accent:'#e7743f', tagline:t('Product landing page', 'Продуктовый лендинг'), icon:'L' },
        'business-product': { accent:'#647c54', tagline:t('Business / product site', 'Бизнес / продуктовый сайт'), icon:'B' },
        'blog-news': { accent:'#e24872', tagline:t('Editorial site', 'Редакционный сайт'), icon:'N' },
        'documentation-wide': { accent:'#27a67a', tagline:t('Documentation / help center', 'Документация / help center'), icon:'D' },
        'studio-portfolio': { accent:'#b87a4b', tagline:t('Portfolio / personal site', 'Портфолио / персональный сайт'), icon:'A' },
        'agency-studio': { accent:'#ff805c', tagline:t('Agency / studio site', 'Агентство / студия'), icon:'V' }
      };
      return map[id] || map['project-landing'];
    }

    function starterBodyV071A(kicker, title, text, items) {
      /* IRGEZTNE_STARTER_PAGE_POLISH_V071B */
      var chips = (items || []).map(function (item) {
        var label = item && item[0] ? item[0] : '';
        var desc = item && item[1] ? item[1] : '';
        return '<li><strong>' + escapeHtml(label) + '</strong><span>' + escapeHtml(desc) + '</span></li>';
      }).join('');
      return '' +
        '<section class="ir-starter-section">' +
          '<p class="ir-starter-kicker">' + escapeHtml(kicker) + '</p>' +
          '<h2>' + escapeHtml(title) + '</h2>' +
          '<p>' + escapeHtml(text) + '</p>' +
          (chips ? '<ul class="ir-starter-list">' + chips + '</ul>' : '') +
        '</section>';
    }

    function makePageV071A(titleEn, titleRu, slug, headlineEn, headlineRu, summaryEn, summaryRu, items, order) {
      var pageTitle = t(titleEn, titleRu);
      var headline = t(headlineEn, headlineRu);
      var summary = t(summaryEn, summaryRu);
      var page = defaultPage(pageTitle, slug, 'published');
      page.order = order || 0;
      page.pageName = pageTitle;
      page.title = pageTitle;
      page.menuLabel = pageTitle;
      page.headline = headline;
      page.summary = summary;
      page.seoTitle = headline || pageTitle;
      page.seoDescription = summary;
      page.bodyHtml = starterBodyV071A(pageTitle, headline, summary, items || []);
      page.inMenu = true;
      page.inFooter = slug === 'contact' || slug === 'faq' || slug === 'about';
      page.parentId = '';
      page.status = 'published';
      page.updatedAt = new Date().toISOString();
      return page;
    }

    function starterPagesForTemplateV071A(templateId) {
      var id = normalizeTemplateIdV071A(templateId);
      if (id === 'business-product') {
        return [
          makePageV071A('Home', 'Главная', 'index', 'Build trust before the first click.', 'Создайте доверие до первого клика.', 'A business/product starter with a strong first screen, proof blocks and a clear consultation request.', 'Стартовая структура для бизнеса или продукта: первый экран, доказательства и понятная заявка.', [['Offer','What you sell and why it matters'], ['Proof','Cases, numbers, partners or reviews'], ['CTA','Request a consultation or product demo']], 0),
          makePageV071A('Product', 'Продукт', 'product', 'Explain the offer clearly.', 'Объясните предложение понятно.', 'Describe the product, service, package or main business direction.', 'Опишите продукт, услугу, пакет или основное направление бизнеса.', [['Problem','What the client wants to solve'], ['Solution','How the offer helps'], ['Result','What changes after launch']], 1),
          makePageV071A('Cases', 'Кейсы', 'cases', 'Show results, not noise.', 'Покажите результат, а не шум.', 'Use this page for examples, numbers, testimonials or before/after stories.', 'Используйте страницу для кейсов, цифр, отзывов или историй до/после.', [['Case 01','Context and result'], ['Case 02','Process and measurable value']], 2),
          makePageV071A('Contact', 'Контакт', 'contact', 'Request a consultation.', 'Запросить консультацию.', 'Add email, form, phone, messenger or booking link here.', 'Добавьте email, форму, телефон, мессенджер или ссылку на запись.', [['Email','hello@example.com'], ['Form','Replace this block with a contact form']], 3)
        ];
      }
      if (id === 'blog-news') {
        return [
          makePageV071A('Home', 'Главная', 'index', 'A live editorial homepage.', 'Живая главная редакции.', 'News, categories, featured stories and editorial blocks for a magazine-style site.', 'Новости, рубрики, избранные материалы и редакционные блоки для сайта-журнала.', [['Featured','Lead story and key article'], ['Categories','Topics and sections'], ['RSS','Optional feed for readers']], 0),
          makePageV071A('Articles', 'Материалы', 'articles', 'Publish articles with structure.', 'Публикуйте материалы структурно.', 'Use this page as an archive, category overview or latest posts section.', 'Используйте страницу как архив, рубрику или список последних публикаций.', [['Article list','Titles, dates and summaries'], ['Tags','Topics and navigation']], 1),
          makePageV071A('About', 'О редакции', 'about', 'Explain the editorial direction.', 'Объясните направление редакции.', 'Add mission, authors, topics, contact and publication policy.', 'Добавьте миссию, авторов, темы, контакты и правила публикаций.', [['Mission','Why the publication exists'], ['Authors','Who writes and edits']], 2)
        ];
      }
      if (id === 'documentation-wide') {
        return [
          makePageV071A('Home', 'Главная', 'index', 'Documentation that helps fast.', 'Документация, которая быстро помогает.', 'A docs starter with search-oriented structure, guides, API notes and FAQ logic.', 'Структура документации: быстрый вход, guides, API и FAQ.', [['Start','First steps and overview'], ['Search','Make answers easy to find'], ['Support','Add contact/support path']], 0),
          makePageV071A('Guide', 'Руководство', 'guide', 'Guide the user step by step.', 'Проведите пользователя по шагам.', 'Use this page for onboarding, setup, concepts and examples.', 'Используйте страницу для onboarding, настройки, понятий и примеров.', [['Step 01','Install or open'], ['Step 02','Configure'], ['Step 03','Publish or export']], 1),
          makePageV071A('API', 'API', 'api', 'Keep technical details readable.', 'Сделайте технические детали читаемыми.', 'Add endpoints, parameters, examples and integration notes.', 'Добавьте endpoints, параметры, примеры и заметки интеграции.', [['Endpoint','GET /example'], ['Response','JSON example']], 2),
          makePageV071A('FAQ', 'FAQ', 'faq', 'Answer common questions early.', 'Закройте частые вопросы заранее.', 'Add common doubts, limits, support rules and next steps.', 'Добавьте частые вопросы, ограничения, правила поддержки и следующие шаги.', [['Question','Short answer'], ['Next step','Where to go now']], 3)
        ];
      }
      if (id === 'studio-portfolio') {
        return [
          makePageV071A('Home', 'Главная', 'index', 'A visual portfolio for real work.', 'Визуальное портфолио для реальных работ.', 'A portfolio starter for selected works, biography, process and contact path.', 'Стартовая структура портфолио: работы, о себе, процесс и контакт.', [['Selected works','Show only strong examples'], ['About','Who you are and what you do'], ['Contact','Email, form or project request']], 0),
          makePageV071A('Works', 'Работы', 'works', 'Show projects with hierarchy.', 'Покажите проекты с иерархией.', 'Use big and small cases, notes, captions and context blocks.', 'Используйте большие и малые кейсы, заметки, подписи и контекст.', [['Featured case','Large visual story'], ['Small works','Short project cards']], 1),
          makePageV071A('About', 'О себе', 'about', 'Make the person clear, not loud.', 'Покажите автора ясно, без лишнего шума.', 'Add biography, skills, tools, experience and working style.', 'Добавьте биографию, навыки, инструменты, опыт и стиль работы.', [['Profile','Short introduction'], ['Method','How you work']], 2),
          makePageV071A('Contact', 'Контакт', 'contact', 'Write by email or discuss a project.', 'Написать на почту или обсудить проект.', 'Add email, form, commission request or collaboration link.', 'Добавьте email, форму, заказ или ссылку для сотрудничества.', [['Email','hello@example.com'], ['Project request','Replace with your form/link']], 3)
        ];
      }
      if (id === 'agency-studio') {
        return [
          makePageV071A('Home', 'Главная', 'index', 'A studio page for strategy, style and launch.', 'Студийная страница для стратегии, стиля и запуска.', 'Agency starter with cases, services, process and a project request.', 'Стартовая структура агентства: кейсы, услуги, процесс и заявка.', [['Cases','Show the work as a story'], ['Services','Make the offer clear'], ['Request','Let visitors start a project']], 0),
          makePageV071A('Cases', 'Кейсы', 'cases', 'Show the work as a story.', 'Покажите работу как историю.', 'Use this page for main case, smaller cases and proof blocks.', 'Используйте страницу для главного кейса, малых кейсов и proof-блоков.', [['Main case','Goal, process, result'], ['Proof','Numbers, launch materials, next step']], 1),
          makePageV071A('Services', 'Услуги', 'services', 'Make services easy to choose.', 'Сделайте услуги понятными для выбора.', 'Strategy, brand style, web, content, launch and support blocks.', 'Стратегия, фирменный стиль, web, контент, запуск и поддержка.', [['Strategy','Positioning and direction'], ['Web','Landing, product site, documentation'], ['Launch','Publishing and support']], 2),
          makePageV071A('Contact', 'Контакт', 'contact', 'Leave a project request.', 'Оставить заявку на проект.', 'Add brief form, email, booking link or consultation request.', 'Добавьте brief-форму, email, запись или заявку на консультацию.', [['Brief','What should the visitor send?'], ['Email','hello@example.com']], 3)
        ];
      }
      return [
        makePageV071A('Home', 'Главная', 'index', 'Turn first impression into action.', 'Превратите первое впечатление в действие.', 'Product landing starter with hero, features, scenarios, FAQ and access CTA.', 'Стартовый лендинг продукта: hero, возможности, сценарии, FAQ и CTA доступа.', [['Hero','Explain the product fast'], ['Features','Show value'], ['CTA','Get access, start, download or request demo']], 0),
        makePageV071A('Features', 'Возможности', 'features', 'Show what the product helps with.', 'Покажите, чем помогает продукт.', 'Use this page for product features, use cases and benefits.', 'Используйте страницу для возможностей продукта, сценариев и преимуществ.', [['Feature 01','Main value'], ['Feature 02','Second value'], ['Feature 03','Why it is useful']], 1),
        makePageV071A('FAQ', 'FAQ', 'faq', 'Answer doubts before the user leaves.', 'Ответьте на сомнения до ухода пользователя.', 'Add questions about product, access, pricing, download or support.', 'Добавьте вопросы о продукте, доступе, цене, скачивании или поддержке.', [['Can I replace visuals?','Yes, demo images are placeholders'], ['How to start?','Use access/download/request CTA']], 2)
      ];
    }

    var draft = getSiteManagerDraft();
    /* IRGEZTNE_WEBSTUDIO_STABILITY_CORE_V074A
       Create should read visible form values directly, even if an input event was lost. */
    try {
      if (overlay && overlay.querySelectorAll) {
        overlay.querySelectorAll('[data-v5-site-manager-field]').forEach(function (field) {
          var key = field.getAttribute('data-v5-site-manager-field');
          if (!key) return;
          draft[key] = field.value;
        });
      }
    } catch (error) {}
    var name = String(draft.name || '').trim() || t('New website', 'Новый сайт');
    var author = String(draft.author || '').trim();
    if (!author) {
      siteManagerError = t('Write the author / owner name before creating the website.', 'Перед созданием сайта напишите автора / владельца.');
      siteManagerErrorField = 'author';
      activeTab = 'sites';
      renderStudio();
      /*
         IRGEZTNE_SITE_CREATE_AUTHOR_FOCUS_V084V
         renderStudio rebuilds the form. Use the existing multi-stage
         focus helper so late UI work cannot steal the caret.
      */
      focusSiteCreateAuthorFieldV068J();
      return;
    }

    var manager = readSiteManager();
    var normalizedNameV084W = normalizeLocalSiteNameV084W(name);

    var duplicateNameV084W = manager.sites.some(function (site) {
      return normalizeLocalSiteNameV084W(site && site.name) ===
        normalizedNameV084W;
    });

    if (duplicateNameV084W) {
      siteManagerError = t(
        'A website with this name already exists.',
        'Сайт с таким названием уже существует.'
      );
      siteManagerErrorField = 'name';
      activeTab = 'sites';
      renderStudio();
      focusSiteCreateNameFieldV084W();
      return;
    }

    var templateId = normalizeTemplateIdV071A(draft.template || 'project-landing');
    var meta = templateMetaV071A(templateId);
    var profile = normalizeSiteProfile({
      id: uid('site'),
      name: name,
      author: author,
      icon: draft.icon || '☕',
      color: draft.color || meta.accent || '#2f7be6'
    }, null);

    var state = initialState();
    state.site.name = profile.name;
    state.site.author = profile.author;
    state.site.icon = profile.icon;
    state.site.siteColor = profile.color;
    state.site.accentColor = profile.color;
    state.site.menuColor = profile.color;
    state.site.buttonColor = profile.color;
    state.site.logoBackgroundColor = profile.color;
    state.site.faviconBackgroundColor = profile.color;
    state.site.logoLetters = initialsFromName(profile.name);
    /*
       Empty values mean: follow logoLetters automatically.
       A user-entered favicon letter remains an explicit override.
    */
    state.site.faviconSymbol = '';
    state.site.faviconLetters = '';
    state.site.faviconText = '';
    state.site.faviconIcon = '';
    state.site.tagline = meta.tagline;
    state.site.activeTemplate = templateId;
    state.site.template = templateId;
    var templateLabPathForNewSiteV083K = normalizeTemplateLabPathV083K(draft.templatePreviewPath || '') || templateLabPathForTemplateIdV083K(templateId);
    state.site.templateSource = 'template-lab';
    state.site.templateLabPath = templateLabPathForNewSiteV083K;
    state.site.templatePreviewPath = templateLabPathForNewSiteV083K;
    state = applySiteProfileToState(state, profile);

    /*
       IRGEZTNE_CANONICAL_TEMPLATE_STARTER_V084X

       Create new local sites from the existing canonical V068C
       template owner. V071A remains historical code but no longer
       owns newly created sites.
    */
    applyOfficialTemplateStarterV068C(state, templateId);

    var pages = Array.isArray(state.pages)
      ? state.pages
      : [];

    state.activePageId = pages[0] ? pages[0].id : '';
    state.menuGroups = [
      { id: 'menu-main-header', name: 'Главное меню', position: 'header', items: pages.filter(function(page){ return page.inMenu; }).map(function(page, index){ return createMenuItemFromPage(page, index); }) },
      { id: 'menu-main-footer', name: 'Меню подвала', position: 'footer', items: pages.filter(function(page){ return page.inFooter; }).map(function(page, index){ return createMenuItemFromPage(page, index); }) }
    ];
    state.activeMenuGroupId = 'menu-main-header';
    state.menuGroupsSeeded = true;
    state.__irgeztneOfficialTemplateStarterV068C = templateId;
    state.updatedAt = new Date().toISOString();

    manager.sites.push(Object.assign({}, profile, { state: state, template: templateId, templateSource: 'template-lab', templateLabPath: templateLabPathForNewSiteV083K }));
    manager.activeSiteId = profile.id;
    writeSiteManager(manager);
    resetSiteManagerDraft();
    siteManagerError = '';
    siteManagerErrorField = '';
    activeTab = 'page';
    collapsedRight = false;
    renderStudio();
  }

  function switchLocalSite(siteId) {
    var manager = readSiteManager();
    if (!manager.sites.some(function (site) { return site.id === siteId; })) return;
    manager.activeSiteId = siteId;
    writeSiteManager(manager);
    activeTab = 'page';
    collapsedRight = false;
    renderStudio();
  }

  function duplicateLocalSite(siteId) {
    var manager = readSiteManager();
    var source = manager.sites.find(function (site) { return site.id === siteId; });
    if (!source) return;
    var clone = cloneJson(source);
    clone.id = uid('site');
    clone.name = (source.name || t('Website', 'Сайт')) + ' Copy';
    clone.createdAt = new Date().toISOString();
    clone.updatedAt = clone.createdAt;
    clone.state = clone.state || initialState();
    clone.state.site = clone.state.site || {};
    clone.state.site.localSiteId = clone.id;
    clone.state.site.name = clone.name;
    clone.state.site.author = clone.author || '';
    clone.state.site.icon = clone.icon || initialsFromName(clone.name).slice(0, 1);
    clone.state.site.siteColor = clone.color || clone.state.site.accentColor || '#2f7be6';
    clone.state = normalizeState(clone.state);
    manager.sites.push(clone);
    manager.activeSiteId = clone.id;
    writeSiteManager(manager);
    activeTab = 'sites';
    renderStudio();

    // IRGEZTNE_SITE_DELETE_RETURN_FOCUS_V068L
    if (typeof focusSiteCreateAuthorFieldV068J === 'function') {
      focusSiteCreateAuthorFieldV068J();
    }
  }

  function deleteLocalSite(siteId) {
    var manager = readSiteManager();
    if (manager.sites.length <= 1) return;
    var site = manager.sites.find(function (item) { return item.id === siteId; });
    if (!site) return;
    if (!window.confirm(t('Delete website “', 'Удалить сайт “') + site.name + '”?')) return;
    manager.sites = manager.sites.filter(function (item) { return item.id !== siteId; });
    if (manager.activeSiteId === siteId) manager.activeSiteId = manager.sites[0].id;
    writeSiteManager(manager);
    activeTab = 'sites';
    renderStudio();
  }

  function handleOverlayDragStart(event) {
    var row = event.target.closest('[data-v5-page-drag-id]');
    if (!row) return;
    draggedPageId = row.dataset.v5PageDragId || '';
    try { event.dataTransfer.setData('text/plain', draggedPageId); } catch (error) {}
  }

  function handleOverlayDragOver(event) {
    if (!draggedPageId) return;
    if (event.target.closest('[data-v5-page-drop-child-id], [data-v5-page-drop-root]')) event.preventDefault();
  }

  function handleOverlayDrop(event) {
    if (!draggedPageId) return;
    var childTarget = event.target.closest('[data-v5-page-drop-child-id]');
    var root = event.target.closest('[data-v5-page-drop-root]');
    if (!childTarget && !root) return;
    event.preventDefault();
    var state = readState();
    var targetId = childTarget ? childTarget.dataset.v5PageDropChildId : '';
    if (targetId && targetId !== draggedPageId) {
      setPageParent(state, draggedPageId, targetId);
    } else if (root && !childTarget) {
      setPageParent(state, draggedPageId, '');
    }
    writeState(state);
    draggedPageId = '';
    activeTab = 'pages';
    renderStudio();
  }



  function isEditorCoreEventTarget(event) {
    // IRGEZTNE_WEBSTUDIO_EDITOR_CORE_EVENT_GUARD_V065I
    var target = event && event.target;
    return !!(target && target.closest && target.closest('.ir-editor-core-webstudio-bridge, .ir-editor-core-webstudio-surface'));
  }

  function closeNativeEditorPopovers(except) {
    if (!overlay || !overlay.querySelectorAll) return;
    var list = overlay.querySelectorAll('.ir-site-studio-v5-native-popover[open]');
    for (var i = 0; i < list.length; i += 1) {
      if (except && list[i] === except) continue;
      list[i].removeAttribute('open');
    }
  }


  function bindNativeEditorPopoverAutoCloseV077B() {
    if (!overlay || overlay.dataset.v077bPopoverAutocloseBound === '1') return;
    overlay.dataset.v077bPopoverAutocloseBound = '1';

    overlay.addEventListener('click', function (event) {
      var target = event.target;
      if (!target || !target.closest) return;

      var summary = target.closest('.ir-site-studio-v5-native-popover > summary');
      if (summary) {
        var current = summary.closest('.ir-site-studio-v5-native-popover');
        window.setTimeout(function () {
          closeNativeEditorPopovers(current && current.hasAttribute('open') ? current : null);
        }, 0);
        return;
      }

      if (!target.closest('.ir-site-studio-v5-native-popover')) {
        closeNativeEditorPopovers();
      }
    }, true);

    overlay.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') closeNativeEditorPopovers();
    }, true);
  }


  function normalizeEditorColorValue(value) {
    var color = String(value || '').trim();
    if (/^#[0-9a-f]{3}$/i.test(color)) {
      return '#' + color[1] + color[1] + color[2] + color[2] + color[3] + color[3];
    }
    if (/^#[0-9a-f]{6}$/i.test(color)) return color;
    return '';
  }

  function editorApplyColorFromToolbar(actionEl, command, inputSelector, hexSelector) {
    var scope = editorToolbarScope(actionEl);
    var colorInput = scope && scope.querySelector ? scope.querySelector(inputSelector) : null;
    var hexInput = scope && scope.querySelector ? scope.querySelector(hexSelector) : null;
    var color = normalizeEditorColorValue(hexInput && hexInput.value ? hexInput.value : (colorInput ? colorInput.value : ''));

    if (!color && colorInput) color = normalizeEditorColorValue(colorInput.value);
    if (!color) {
      if (hexInput) hexInput.focus();
      return;
    }

    if (hexInput) hexInput.value = color;
    if (colorInput) colorInput.value = color;

    execCommand(command, color);
    closeNativeEditorPopovers();
    saveContentFromDom();
  }

  function editorToolbarScope(actionEl) {
    return actionEl && actionEl.closest ? (actionEl.closest('[data-v5-native-toolbar="1"]') || overlay) : overlay;
  }

  function editorToolbarValue(actionEl, selector) {
    var scope = editorToolbarScope(actionEl);
    var input = scope && scope.querySelector ? scope.querySelector(selector) : null;
    return input ? String(input.value || '').trim() : '';
  }

  function clearEditorToolbarField(actionEl, selector) {
    var scope = editorToolbarScope(actionEl);
    var input = scope && scope.querySelector ? scope.querySelector(selector) : null;
    if (input) input.value = '';
  }

  function normalizeEditorInsertUrl(value) {
    var url = String(value || '').trim();
    if (!url || url === 'http://' || url === 'https://') return '';
    if (/^(https?:|mailto:|tel:|#|\/)/i.test(url)) return url;
    return 'https://' + url;
  }

  function editorInsertHtml(html) {
    try {
      if (siteJodit) {
        if (siteJodit.s && typeof siteJodit.s.insertHTML === 'function') {
          siteJodit.s.insertHTML(html);
          return true;
        }
        if (siteJodit.selection && typeof siteJodit.selection.insertHTML === 'function') {
          siteJodit.selection.insertHTML(html);
          return true;
        }
        if (typeof siteJodit.execCommand === 'function') {
          siteJodit.execCommand('insertHTML', false, html);
          return true;
        }
      }

      var editable = overlay && overlay.querySelector ? overlay.querySelector('.jodit-wysiwyg[contenteditable="true"], .ir-site-studio-v5-jodit-content, [data-v5-jodit-textarea="1"]') : null;
      if (editable && typeof editable.focus === 'function') editable.focus();
      document.execCommand('insertHTML', false, html);
      return true;
    } catch (error) {
      log('Native editor insert failed', error);
      return false;
    }
  }

  function insertEditorLinkFromToolbar(actionEl) {
    var text = editorToolbarValue(actionEl, '[data-v5-editor-link-text="1"]');
    var url = normalizeEditorInsertUrl(editorToolbarValue(actionEl, '[data-v5-editor-link-url="1"]'));
    var selected = '';

    if (!url) {
      var scope = editorToolbarScope(actionEl);
      var urlInput = scope && scope.querySelector ? scope.querySelector('[data-v5-editor-link-url="1"]') : null;
      if (urlInput) urlInput.focus();
      return;
    }

    try {
      var sel = window.getSelection ? window.getSelection() : null;
      selected = sel ? String(sel.toString() || '').trim() : '';
    } catch (error) {}

    if (text) {
      editorInsertHtml('<a href="' + escapeHtml(url) + '">' + escapeHtml(text) + '</a>');
    } else if (selected) {
      execCommand('createLink', url);
    } else {
      editorInsertHtml('<a href="' + escapeHtml(url) + '">' + escapeHtml(url) + '</a>');
    }

    clearEditorToolbarField(actionEl, '[data-v5-editor-link-text="1"]');
    clearEditorToolbarField(actionEl, '[data-v5-editor-link-url="1"]');
    saveContentFromDom();
  }

  function insertEditorImageFromToolbar(actionEl) {
    var url = normalizeEditorInsertUrl(editorToolbarValue(actionEl, '[data-v5-editor-image-url="1"]'));
    var alt = editorToolbarValue(actionEl, '[data-v5-editor-image-alt="1"]');

    if (!url) {
      var scope = editorToolbarScope(actionEl);
      var urlInput = scope && scope.querySelector ? scope.querySelector('[data-v5-editor-image-url="1"]') : null;
      if (urlInput) urlInput.focus();
      return;
    }

    var caption = alt ? '<figcaption>' + escapeHtml(alt) + '</figcaption>' : '';
    editorInsertHtml('<figure class="ir-site-studio-v5-content-image"><img src="' + escapeHtml(url) + '" alt="' + escapeHtml(alt) + '">' + caption + '</figure><p><br></p>');

    clearEditorToolbarField(actionEl, '[data-v5-editor-image-url="1"]');
    clearEditorToolbarField(actionEl, '[data-v5-editor-image-alt="1"]');
    saveContentFromDom();
  }

  /* IRGEZTNE_EDITOR_LITE_PRO_FOUNDATION_V075A */
  function editorSafeTextareaV075A() {
    return overlay && overlay.querySelector ? overlay.querySelector('[data-v5-safe-writing-textarea="1"]') : null;
  }

  function editorSaveSafeTextareaV075A(textarea) {
    if (!textarea) return;
    try { textarea.dispatchEvent(new Event('input', { bubbles: true })); } catch (error) {}
    saveContentFromDom();
  }

  function editorReplaceSelectionV075A(textarea, value, selectStart, selectEnd) {
    if (!textarea) return;
    var start = textarea.selectionStart || 0;
    var end = textarea.selectionEnd || start;
    var before = textarea.value.slice(0, start);
    var after = textarea.value.slice(end);
    textarea.value = before + value + after;
    var caretStart = start + (selectStart == null ? value.length : selectStart);
    var caretEnd = start + (selectEnd == null ? caretStart - start : selectEnd);
    textarea.focus();
    try { textarea.setSelectionRange(caretStart, caretEnd); } catch (error) {}
    editorSaveSafeTextareaV075A(textarea);
  }

  function editorWrapSelectionV075A(prefix, suffix, placeholder) {
    var textarea = editorSafeTextareaV075A();
    if (!textarea) return false;
    var start = textarea.selectionStart || 0;
    var end = textarea.selectionEnd || start;
    var selected = textarea.value.slice(start, end) || placeholder || '';
    var value = prefix + selected + suffix;
    editorReplaceSelectionV075A(textarea, value, prefix.length, prefix.length + selected.length);
    return true;
  }

  function editorPrefixLinesV075A(prefix, placeholder) {
    var textarea = editorSafeTextareaV075A();
    if (!textarea) return false;
    var start = textarea.selectionStart || 0;
    var end = textarea.selectionEnd || start;
    var selected = textarea.value.slice(start, end) || placeholder || '';
    var lines = selected.split('\n').map(function (line) {
      return line.trim() ? prefix + line.replace(/^\s*([-•]|\d+\.)\s+/, '') : line;
    });
    editorReplaceSelectionV075A(textarea, lines.join('\n'), 0, lines.join('\n').length);
    return true;
  }

  function editorBlockV075A(kind) {
    var textarea = editorSafeTextareaV075A();
    if (!textarea) return false;
    if (kind === 'h1') return editorWrapSelectionV075A('# ', '', t('Heading', 'Заголовок'));
    if (kind === 'h2') return editorWrapSelectionV075A('## ', '', t('Heading', 'Заголовок'));
    if (kind === 'h3') return editorWrapSelectionV075A('### ', '', t('Heading', 'Заголовок'));
    if (kind === 'quote') return editorPrefixLinesV075A('> ', t('Quote text', 'Текст цитаты'));
    return true;
  }

  function editorClearMarkupV075A() {
    var textarea = editorSafeTextareaV075A();
    if (!textarea) return false;
    var start = textarea.selectionStart || 0;
    var end = textarea.selectionEnd || start;
    var selected = textarea.value.slice(start, end) || textarea.value;
    var clean = selected
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/\+\+([^+]+)\+\+/g, '$1')
      .replace(/\[\[color:[^\]]+\]\]([\s\S]*?)\[\[\/color\]\]/g, '$1')
      .replace(/\[\[mark:[^\]]+\]\]([\s\S]*?)\[\[\/mark\]\]/g, '$1')
      .replace(/^\s*(#{1,3}|>|[-•]|\d+\.)\s+/gm, '');
    if (end > start) editorReplaceSelectionV075A(textarea, clean, 0, clean.length);
    else {
      textarea.value = clean;
      textarea.focus();
      editorSaveSafeTextareaV075A(textarea);
    }
    return true;
  }

  function editorToolbarFieldV075A(actionEl, selectors) {
    var scope = actionEl && actionEl.closest ? (actionEl.closest('.ir-site-studio-v5-native-popover') || actionEl.closest('[data-v5-native-toolbar]') || overlay) : overlay;
    for (var i = 0; i < selectors.length; i += 1) {
      var el = scope && scope.querySelector ? scope.querySelector(selectors[i]) : null;
      if (el && String(el.value || '').trim()) return String(el.value || '').trim();
    }
    return '';
  }

  function editorInsertLinkV075A(actionEl) {
    var textarea = editorSafeTextareaV075A();
    if (!textarea) return false;
    var selected = textarea.value.slice(textarea.selectionStart || 0, textarea.selectionEnd || textarea.selectionStart || 0);
    var url = editorToolbarFieldV075A(actionEl, ['[data-v5-editor-link-url="1"]', '[data-v5-link-url="1"]']);
    var label = editorToolbarFieldV075A(actionEl, ['[data-v5-editor-link-label="1"]', '[data-v5-editor-link-text="1"]']);
    if (!url && window.prompt) url = window.prompt(t('Link URL', 'URL ссылки'), 'https://') || '';
    if (!url) return true;
    label = label || selected || t('link text', 'текст ссылки');
    editorReplaceSelectionV075A(textarea, '[' + label + '](' + url + ')', 1, 1 + label.length);
    return true;
  }

  function editorInsertImageV075A(actionEl) {
    var textarea = editorSafeTextareaV075A();
    if (!textarea) return false;
    var url = editorToolbarFieldV075A(actionEl, ['[data-v5-editor-image-url="1"]', '[data-v5-image-url="1"]']);
    var alt = editorToolbarFieldV075A(actionEl, ['[data-v5-editor-image-alt="1"]', '[data-v5-image-alt="1"]']);
    if (!url && window.prompt) url = window.prompt(t('Image URL', 'URL изображения'), 'https://') || '';
    if (!url) return true;
    alt = alt || t('Image', 'Изображение');
    editorReplaceSelectionV075A(textarea, '\n\n![' + alt + '](' + url + ')\n\n', 0, 0);
    return true;
  }

  function editorInsertVideoV075A(actionEl) {
    var textarea = editorSafeTextareaV075A();
    if (!textarea) return false;
    var url = editorToolbarFieldV075A(actionEl, ['[data-v5-editor-video-url="1"]', '[data-v5-video-url="1"]']);
    if (!url && window.prompt) url = window.prompt(t('Video / embed URL', 'URL видео / embed'), 'https://') || '';
    if (!url) return true;
    editorReplaceSelectionV075A(textarea, '\n\n[[video:' + url + ']]\n\n', 0, 0);
    return true;
  }

  /* IRGEZTNE_EDITOR_LITE_PRO_VISUAL_TOOLS_V075C */
  var editorVisualSavedRangeV075C = null;

  function editorVisualSurfaceV075C() {
    return overlay && overlay.querySelector ? overlay.querySelector('[data-v5-editor-visual-surface="1"]') : null;
  }

  function editorVisualRangeBelongsV075C(range) {
    var surface = editorVisualSurfaceV075C();
    if (!surface || !range) return false;
    var node = range.commonAncestorContainer;
    return node === surface || surface.contains(node);
  }

  function editorVisualSaveSelectionV075C() {
    var surface = editorVisualSurfaceV075C();
    if (!surface || !window.getSelection) return;
    var sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    var range = sel.getRangeAt(0);
    if (!editorVisualRangeBelongsV075C(range)) return;
    editorVisualSavedRangeV075C = range.cloneRange();
  }

  function editorVisualRestoreSelectionV075C() {
    var surface = editorVisualSurfaceV075C();
    if (!surface || !window.getSelection) return false;

    surface.focus();

    var sel = window.getSelection();
    if (!sel) return false;

    if (editorVisualSavedRangeV075C && editorVisualRangeBelongsV075C(editorVisualSavedRangeV075C)) {
      sel.removeAllRanges();
      sel.addRange(editorVisualSavedRangeV075C.cloneRange());
      return true;
    }

    var range = document.createRange();
    range.selectNodeContents(surface);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
    editorVisualSavedRangeV075C = range.cloneRange();
    return true;
  }

  function editorVisualSelectedTextV075C() {
    editorVisualRestoreSelectionV075C();
    var sel = window.getSelection ? window.getSelection() : null;
    return sel ? String(sel.toString() || '') : '';
  }

  function editorVisualSyncV075C() {
    var surface = editorVisualSurfaceV075C();
    if (!surface) return;
    var textarea = overlay.querySelector('[data-v5-jodit-textarea="1"]');
    if (textarea) textarea.value = sanitizeHtml(surface.innerHTML || '');
    editorVisualSaveSelectionV075C();
    saveContentFromDom();
  }

  function editorVisualExecV075C(command, value) {
    var surface = editorVisualSurfaceV075C();
    if (!surface) return false;
    editorVisualRestoreSelectionV075C();
    try { document.execCommand(command, false, value || null); } catch (error) { log('visual exec failed', command, error); }
    editorVisualSyncV075C();
    return true;
  }

  function editorVisualInsertHtmlV075C(html) {
    var surface = editorVisualSurfaceV075C();
    if (!surface) return false;
    editorVisualRestoreSelectionV075C();
    try { document.execCommand('insertHTML', false, html); } catch (error) { log('visual insertHTML failed', error); }
    editorVisualSyncV075C();
    return true;
  }

  function editorVisualToolbarFieldV075C(actionEl, selectors, fallbackUrlOnly) {
    var scope = actionEl && actionEl.closest ? (actionEl.closest('.ir-site-studio-v5-native-popover') || actionEl.closest('[data-v5-native-toolbar]') || overlay) : overlay;

    for (var i = 0; i < selectors.length; i += 1) {
      var el = scope && scope.querySelector ? scope.querySelector(selectors[i]) : null;
      if (el && String(el.value || '').trim()) return String(el.value || '').trim();
    }

    var inputs = scope && scope.querySelectorAll ? Array.prototype.slice.call(scope.querySelectorAll('input, textarea')) : [];
    for (var j = 0; j < inputs.length; j += 1) {
      var value = String(inputs[j].value || '').trim();
      if (!value) continue;
      if (!fallbackUrlOnly) return value;
      if (/^(https?:\/\/|data:image\/|\/)/i.test(value)) return value;
    }

    return '';
  }

  function editorVisualNormalizeUrlV075C(url) {
    var value = String(url || '').trim();
    if (!value) return '';
    if (/^(https?:\/\/|mailto:|tel:|data:image\/|\/|#)/i.test(value)) return value;
    return '';
  }

  function editorVisualApplyLinkV075C(actionEl) {
    var selected = editorVisualSelectedTextV075C();
    var url = editorVisualToolbarFieldV075C(actionEl, [
      '[data-v5-editor-link-url="1"]',
      '[data-v5-link-url="1"]',
      '[data-v5-url="1"]',
      'input[type="url"]'
    ], true);

    if (!url && window.prompt) url = window.prompt(t('Link URL', 'URL ссылки'), 'https://') || '';
    url = editorVisualNormalizeUrlV075C(url);
    if (!url) return true;

    if (!selected) {
      var label = editorVisualToolbarFieldV075C(actionEl, [
        '[data-v5-editor-link-label="1"]',
        '[data-v5-editor-link-text="1"]',
        '[data-v5-link-text="1"]'
      ], false) || url;
      return editorVisualInsertHtmlV075C('<a href="' + escapeHtml(url) + '">' + escapeHtml(label) + '</a>');
    }

    return editorVisualExecV075C('createLink', url);
  }

  function editorVisualApplyImageV075C(actionEl) {
    var url = editorVisualToolbarFieldV075C(actionEl, [
      '[data-v5-editor-image-url="1"]',
      '[data-v5-image-url="1"]',
      '[data-v5-url="1"]',
      'input[type="url"]'
    ], true);

    if (!url && window.prompt) url = window.prompt(t('Image URL', 'URL изображения'), 'https://') || '';
    url = editorVisualNormalizeUrlV075C(url);
    if (!url) return true;

    var alt = editorVisualToolbarFieldV075C(actionEl, [
      '[data-v5-editor-image-alt="1"]',
      '[data-v5-image-alt="1"]',
      '[data-v5-alt="1"]'
    ], false) || t('Image', 'Изображение');

    return editorVisualInsertHtmlV075C('<figure class="ir-site-studio-v5-content-image"><img src="' + escapeHtml(url) + '" alt="' + escapeHtml(alt) + '"><figcaption>' + escapeHtml(alt) + '</figcaption></figure>');
  }

  function editorVisualApplyVideoV075C(actionEl) {
    var url = editorVisualToolbarFieldV075C(actionEl, [
      '[data-v5-editor-video-url="1"]',
      '[data-v5-video-url="1"]',
      '[data-v5-url="1"]',
      'input[type="url"]'
    ], true);

    if (!url && window.prompt) url = window.prompt(t('Video / embed URL', 'URL видео / embed'), 'https://') || '';
    url = editorVisualNormalizeUrlV075C(url);
    if (!url) return true;

    return editorVisualInsertHtmlV075C('<figure class="ir-site-studio-v5-content-video"><iframe src="' + escapeHtml(url) + '" loading="lazy" allowfullscreen></iframe></figure>');
  }

  function editorVisualHandleToolbarV075C(event, actionEl, cmdEl, blockEl) {
    var surface = editorVisualSurfaceV075C();
    if (!surface) return false;

    function inToolbar(el) {
      return !!(el && el.closest && (el.closest('[data-v5-native-toolbar="1"]') || el.closest('.ir-site-studio-v5-native-popover')));
    }

    if (cmdEl && inToolbar(cmdEl)) {
      event.preventDefault();
      var command = cmdEl.dataset.v5Command || '';
      var value = cmdEl.dataset.v5Value || '';

      if (command === 'bold' || command === 'italic' || command === 'underline' || command === 'strikeThrough') editorVisualExecV075C(command);
      else if (command === 'insertUnorderedList' || command === 'insertOrderedList') editorVisualExecV075C(command);
      else if (command === 'justifyLeft' || command === 'justifyCenter' || command === 'justifyRight') editorVisualExecV075C(command);
      else if (command === 'foreColor' && value) editorVisualExecV075C('foreColor', value);
      else if ((command === 'backColor' || command === 'hiliteColor') && value) editorVisualExecV075C('hiliteColor', value);
      else if (command === 'undo' || command === 'redo') editorVisualExecV075C(command);
      else return false;

      if (cmdEl.closest && cmdEl.closest('.ir-site-studio-v5-native-popover')) closeNativeEditorPopovers();
      return true;
    }

    if (blockEl && inToolbar(blockEl)) {
      event.preventDefault();
      var block = blockEl.dataset.v5Block || 'p';
      if (block === 'quote') editorVisualExecV075C('formatBlock', 'blockquote');
      else editorVisualExecV075C('formatBlock', block);
      return true;
    }

    if (actionEl && inToolbar(actionEl)) {
      var action = actionEl.dataset.v5Action || '';

      if (/^(insert-link|apply-link|create-link|set-link)$/.test(action)) {
        event.preventDefault();
        editorVisualApplyLinkV075C(actionEl);
        closeNativeEditorPopovers();
        return true;
      }

      if (/^(insert-image|apply-image|add-image|set-image|insert-image-url)$/.test(action)) {
        event.preventDefault();
        editorVisualApplyImageV075C(actionEl);
        closeNativeEditorPopovers();
        return true;
      }

      if (/^(insert-video|apply-video|add-video|set-video|insert-embed|apply-embed)$/.test(action)) {
        event.preventDefault();
        editorVisualApplyVideoV075C(actionEl);
        closeNativeEditorPopovers();
        return true;
      }

      if (action === 'insert-hr') {
        event.preventDefault();
        editorVisualInsertHtmlV075C('<hr>');
        return true;
      }

      if (action === 'clear-format') {
        event.preventDefault();
        editorVisualExecV075C('removeFormat');
        closeNativeEditorPopovers();
        return true;
      }
    }

    return false;
  }

  /* IRGEZTNE_TINYMCE_ENGINE_ADAPTER_V076A */
  var siteTinyMCEEditorV076A = null;
  var siteTinyMCEPageIdV076A = null;
  var siteTinyMCELoadPromiseV076A = null;
  var siteTinyMCEBookmarkV076A = null;

  function ensureTinyMCEReadyV076A() {

    if (window.tinymce && typeof window.tinymce.init === 'function') return Promise.resolve(true);
    if (siteTinyMCELoadPromiseV076A) return siteTinyMCELoadPromiseV076A;

    siteTinyMCELoadPromiseV076A = new Promise(function (resolve) {
      var sources = ['node_modules/tinymce/tinymce.min.js', './node_modules/tinymce/tinymce.min.js'];
      var index = 0;

      function tryNext() {
        if (window.tinymce && typeof window.tinymce.init === 'function') {
          resolve(true);
          return;
        }

        if (index >= sources.length) {
          resolve(false);
          return;
        }

        var src = sources[index++];
        var script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.dataset.irTinymceEngineLoaderV077a = '1';
        script.onload = function () { resolve(!!(window.tinymce && window.tinymce.init)); };
        script.onerror = tryNext;
        document.head.appendChild(script);
      }

      tryNext();
    });

    return siteTinyMCELoadPromiseV076A;
  }

  function destroyTinyMCEEditorV076A() {
    try {
      if (siteTinyMCEEditorV076A && typeof siteTinyMCEEditorV076A.remove === 'function') {
        siteTinyMCEEditorV076A.remove();
      }
    } catch (error) {
      log('TinyMCE remove failed', error);
    }
    siteTinyMCEEditorV076A = null;
    siteTinyMCEPageIdV076A = null;
    siteTinyMCEBookmarkV076A = null;
  }

  function tinyMCESyncV076A(editor, textarea) {
    if (!editor || !textarea) return;
    var html = '';
    try { html = editor.getContent({ format: 'html' }) || ''; } catch (error) { html = textarea.value || ''; }
    html = sanitizeHtml(html);
    textarea.value = html;
    updateActivePage({ bodyHtml: html }, false);
  }

  function tinyMCESaveBookmarkV076A() {
    var editor = siteTinyMCEEditorV076A;
    if (!editor || !editor.selection) return;
    try { siteTinyMCEBookmarkV076A = editor.selection.getBookmark(2, true); } catch (error) {}
  }

  function tinyMCERestoreBookmarkV076A() {
    var editor = siteTinyMCEEditorV076A;
    if (!editor || !editor.selection) return false;
    try {
      editor.focus();
      if (siteTinyMCEBookmarkV076A) editor.selection.moveToBookmark(siteTinyMCEBookmarkV076A);
      return true;
    } catch (error) {
      try { editor.focus(); } catch (focusError) {}
      return false;
    }
  }

  function tinyMCEFieldV076A(actionEl, selectors, urlOnly) {
    var scopes = [];
    if (actionEl && actionEl.closest) {
      var popover = actionEl.closest('.ir-site-studio-v5-native-popover');
      var group = actionEl.closest('.ir-site-studio-v5-native-tool-group');
      if (popover) scopes.push(popover);
      if (group) scopes.push(group);
    }
    scopes.push(overlay);

    for (var sIndex = 0; sIndex < scopes.length; sIndex += 1) {
      var scope = scopes[sIndex];
      if (!scope || !scope.querySelectorAll) continue;

      for (var i = 0; i < selectors.length; i += 1) {
        var el = scope.querySelector(selectors[i]);
        var value = el ? String(el.value || '').trim() : '';
        if (value) return value;
      }

      var inputs = Array.prototype.slice.call(scope.querySelectorAll('input, textarea'));
      for (var j = 0; j < inputs.length; j += 1) {
        var raw = String(inputs[j].value || '').trim();
        if (!raw) continue;
        if (!urlOnly) return raw;
        if (/^(https?:\/\/|data:image\/|\/|#)/i.test(raw)) return raw;
      }
    }

    return '';
  }

  function tinyMCENormalizeUrlV076A(url) {
    var value = String(url || '').trim();
    if (!value) return '';
    if (/^(https?:\/\/|mailto:|tel:|data:image\/|\/|#)/i.test(value)) return value;
    return '';
  }

  function tinyMCEExecV076A(command, value) {
    var editor = siteTinyMCEEditorV076A;
    if (!editor) return false;
    tinyMCERestoreBookmarkV076A();

    try {
      editor.execCommand(command, false, value || null);
      tinyMCESaveBookmarkV076A();
      tinyMCESyncV076A(editor, editor.getElement());
      return true;
    } catch (error) {
      log('TinyMCE command failed', command, error);
      return false;
    }
  }

  function tinyMCEInsertContentV076A(html) {
    var editor = siteTinyMCEEditorV076A;
    if (!editor) return false;
    tinyMCERestoreBookmarkV076A();

    try {
      editor.insertContent(html);
      tinyMCESaveBookmarkV076A();
      tinyMCESyncV076A(editor, editor.getElement());
      return true;
    } catch (error) {
      log('TinyMCE insert failed', error);
      return false;
    }
  }

  function tinyMCEApplyLinkV076A(actionEl) {
    var editor = siteTinyMCEEditorV076A;
    if (!editor) return false;

    tinyMCERestoreBookmarkV076A();

    var url = tinyMCEFieldV076A(actionEl, [
      '[data-v5-editor-link-url="1"]',
      '[data-v5-link-url="1"]',
      '[data-v5-url="1"]',
      'input[type="url"]'
    ], true);

    if (!url && window.prompt) url = window.prompt(t('Link URL', 'URL ссылки'), 'https://') || '';
    url = tinyMCENormalizeUrlV076A(url);
    if (!url) return true;

    var selected = '';
    try { selected = editor.selection.getContent({ format: 'html' }) || ''; } catch (error) {}

    if (selected) {
      editor.selection.setContent('<a href="' + escapeHtml(url) + '">' + selected + '</a>');
    } else {
      var label = tinyMCEFieldV076A(actionEl, [
        '[data-v5-editor-link-label="1"]',
        '[data-v5-editor-link-text="1"]',
        '[data-v5-link-text="1"]'
      ], false) || url;
      editor.insertContent('<a href="' + escapeHtml(url) + '">' + escapeHtml(label) + '</a>');
    }

    tinyMCESaveBookmarkV076A();
    tinyMCESyncV076A(editor, editor.getElement());
    return true;
  }

  function tinyMCEApplyImageV076A(actionEl) {
    var url = tinyMCEFieldV076A(actionEl, [
      '[data-v5-editor-image-url="1"]',
      '[data-v5-image-url="1"]',
      '[data-v5-url="1"]',
      'input[type="url"]'
    ], true);

    if (!url && window.prompt) url = window.prompt(t('Image URL', 'URL изображения'), 'https://') || '';
    url = tinyMCENormalizeUrlV076A(url);
    if (!url) return true;

    var alt = tinyMCEFieldV076A(actionEl, [
      '[data-v5-editor-image-alt="1"]',
      '[data-v5-image-alt="1"]',
      '[data-v5-alt="1"]'
    ], false) || t('Image', 'Изображение');

    return tinyMCEInsertContentV076A(
      '<figure class="ir-site-studio-v5-content-image">' +
      '<img src="' + escapeHtml(url) + '" alt="' + escapeHtml(alt) + '">' +
      '<figcaption>' + escapeHtml(alt) + '</figcaption>' +
      '</figure><p></p>'
    );
  }

  function tinyMCEApplyVideoV076A(actionEl) {
    var url = tinyMCEFieldV076A(actionEl, [
      '[data-v5-editor-video-url="1"]',
      '[data-v5-video-url="1"]',
      '[data-v5-url="1"]',
      'input[type="url"]'
    ], true);

    if (!url && window.prompt) url = window.prompt(t('Video / embed URL', 'URL видео / embed'), 'https://') || '';
    url = tinyMCENormalizeUrlV076A(url);
    if (!url) return true;

    return tinyMCEInsertContentV076A(
      '<figure class="ir-site-studio-v5-content-video">' +
      '<iframe src="' + escapeHtml(url) + '" loading="lazy" allowfullscreen></iframe>' +
      '</figure><p></p>'
    );
  }

  function tinyMCEHandleToolbarV076A(event, actionEl, cmdEl, blockEl) {
    var editor = siteTinyMCEEditorV076A;
    if (!editor) return false;

    function inEditorToolbar(el) {
      return !!(el && el.closest && (el.closest('[data-v5-native-toolbar="1"]') || el.closest('.ir-site-studio-v5-native-popover')));
    }

    if (cmdEl && inEditorToolbar(cmdEl)) {
      event.preventDefault();

      var command = cmdEl.dataset.v5Command || '';
      var value = cmdEl.dataset.v5Value || '';

      if (command === 'bold') return tinyMCEExecV076A('Bold');
      if (command === 'italic') return tinyMCEExecV076A('Italic');
      if (command === 'underline') return tinyMCEExecV076A('Underline');
      if (command === 'strikeThrough' || command === 'strike') return tinyMCEExecV076A('Strikethrough');
      if (command === 'insertUnorderedList') return tinyMCEExecV076A('InsertUnorderedList');
      if (command === 'insertOrderedList') return tinyMCEExecV076A('InsertOrderedList');
      if (command === 'justifyLeft') return tinyMCEExecV076A('JustifyLeft');
      if (command === 'justifyCenter') return tinyMCEExecV076A('JustifyCenter');
      if (command === 'justifyRight') return tinyMCEExecV076A('JustifyRight');
      if (command === 'indent') return tinyMCEExecV076A('Indent');
      if (command === 'outdent') return tinyMCEExecV076A('Outdent');
      if (command === 'undo') return tinyMCEExecV076A('Undo');
      if (command === 'redo') return tinyMCEExecV076A('Redo');
      if (command === 'foreColor' && value) { var okColorTextV077B = tinyMCEExecV076A('ForeColor', value); closeNativeEditorPopovers(); return okColorTextV077B; }
      if ((command === 'backColor' || command === 'hiliteColor') && value) { var okColorMarkerV077B = tinyMCEExecV076A('HiliteColor', value); closeNativeEditorPopovers(); return okColorMarkerV077B; }

      return false;
    }

    if (blockEl && inEditorToolbar(blockEl)) {
      event.preventDefault();
      var block = blockEl.dataset.v5Block || 'p';
      if (block === 'quote') return tinyMCEExecV076A('FormatBlock', 'blockquote');
      return tinyMCEExecV076A('FormatBlock', block);
    }

    if (actionEl && inEditorToolbar(actionEl)) {
      var action = actionEl.dataset.v5Action || '';

      if (/^(insert-link|apply-link|create-link|set-link)$/.test(action)) {
        event.preventDefault();
        tinyMCEApplyLinkV076A(actionEl);
        closeNativeEditorPopovers();
        return true;
      }

      if (/^(insert-image|apply-image|add-image|set-image|insert-image-url)$/.test(action)) {
        event.preventDefault();
        tinyMCEApplyImageV076A(actionEl);
        closeNativeEditorPopovers();
        return true;
      }

      if (/^(insert-video|apply-video|add-video|set-video|insert-embed|apply-embed)$/.test(action)) {
        event.preventDefault();
        tinyMCEApplyVideoV076A(actionEl);
        closeNativeEditorPopovers();
        return true;
      }

      if (action === 'insert-hr') {
        event.preventDefault();
        return tinyMCEInsertContentV076A('<hr><p></p>');
      }

      if (action === 'clear-format') {
        event.preventDefault();
        tinyMCEExecV076A('RemoveFormat');
        closeNativeEditorPopovers();
        return true;
      }

      if (action === 'copy-content') {
        event.preventDefault();
        tinyMCECopyContentV077B();
        closeNativeEditorPopovers();
        return true;
      }
    }

    return false;
  }


  function tinyMCEContentStyleV078C() {
    var isLight = currentTheme && currentTheme() === 'light';
    var bg = isLight ? '#ffffff' : '#223140';
    var fg = isLight ? '#111827' : '#eef6ff';
    var link = isLight ? '#2563eb' : '#58a6ff';

    return [
      'html,body{width:100%;max-width:100%;overflow-x:hidden;box-sizing:border-box;background:' + bg + ';color:' + fg + ';}',
      '*,*:before,*:after{box-sizing:border-box;}',
      'body{margin:0!important;padding:28px 34px;font-family:Inter,system-ui,-apple-system,"Segoe UI",Arial,sans-serif;font-size:17px;line-height:1.7;}',
      'body.mce-content-body{min-height:620px;}',
      'p{margin:0 0 1.05em;}',
      'h1,h2,h3{line-height:1.18;margin:1.1em 0 .5em;font-weight:900;color:' + fg + ';}',
      'h1{font-size:40px;}h2{font-size:30px;}h3{font-size:24px;}',
      'a{color:' + link + ';text-decoration-thickness:2px;}',
      'mark{background:#fff3bf;color:#111827;border-radius:4px;padding:0 .12em;}',
      'img{max-width:100%;height:auto;border-radius:14px;}',
      'figure{max-width:100%;box-sizing:border-box;margin:24px auto;clear:both;}',
      'figure.ir-site-studio-v5-content-image{display:block;overflow:visible;}',
      'figure.ir-site-studio-v5-content-image img{display:block;width:100%;max-width:100%;height:auto;object-fit:contain;}',
      'figcaption{max-width:100%;overflow-wrap:anywhere;font-size:13px;line-height:1.45;opacity:.68;margin-top:8px;text-align:center;}',
      'blockquote{border-left:4px solid #60a5fa;margin:20px 0;padding:10px 16px;background:rgba(96,165,250,.10);border-radius:12px;}',
      'pre{white-space:pre-wrap;background:rgba(15,23,42,.32);padding:14px;border-radius:12px;}',
      'hr{border:0;border-top:1px solid rgba(148,163,184,.45);margin:28px 0;}'
    ].join(' ');
  }

  function tinyMCEApplyCanvasThemeV078C() {
    var editor = siteTinyMCEEditorV076A;
    if (!editor || !editor.getBody) return;

    var isLight = currentTheme && currentTheme() === 'light';
    var body = editor.getBody();
    if (!body) return;

    body.style.background = isLight ? '#ffffff' : '#223140';
    body.style.color = isLight ? '#111827' : '#eef6ff';
  }

  function mountTinyMCEEditorV076A(page, host, textarea, hint) {
    if (!page || !host || !textarea) return false;

    destroySiteJodit();
    if (siteEditorCoreBridge && typeof siteEditorCoreBridge.destroy === 'function') {
      try { siteEditorCoreBridge.destroy(); } catch (error) {}
    }
    siteEditorCoreBridge = null;

    var visual = host.querySelector('[data-v5-editor-visual-surface="1"]');
    if (visual && visual.parentNode) visual.parentNode.removeChild(visual);

    var safe = host.querySelector('[data-v5-safe-writing-textarea="1"]');
    if (safe && safe.parentNode) safe.parentNode.removeChild(safe);

    destroyTinyMCEEditorV076A();

    siteTinyMCEPageIdV076A = page.id;
    textarea.style.display = '';
    textarea.value = sanitizeHtml(page.bodyHtml || textarea.value || '');
    textarea.id = textarea.id || ('ir-webstudio-editor-' + page.id.replace(/[^a-z0-9_-]/gi, '-'));

    host.classList.add('is-tinymce-engine-loading-v076a');
    host.classList.remove('is-editor-lite-visual-ready-v075b', 'is-safe-writing-ready-v074b', 'is-jodit-ready', 'is-editor-core-ready');

    if (hint) {
      hint.hidden = false;
      hint.textContent = t('Loading editor engine…', 'Загрузка движка редактора…');
    }

    ensureTinyMCEReadyV076A().then(function (ready) {
      if (!overlay || activeTab !== 'page' || siteTinyMCEPageIdV076A !== page.id || !textarea.isConnected) return;

      if (!ready || !window.tinymce) {
        host.classList.remove('is-tinymce-engine-loading-v076a');
        textarea.style.display = '';
        if (hint) { hint.hidden = true; hint.textContent = ''; }
        return;
      }

      try {
        window.tinymce.init({
          target: textarea,
          base_url: './node_modules/tinymce',
          suffix: '.min',
          menubar: false,
          toolbar: false,
          statusbar: false,
          branding: false,
          promotion: false,
          resize: false,
          min_height: 660,
          height: 680,
          skin: currentTheme() === 'light' ? 'oxide' : 'oxide-dark',
          content_css: currentTheme() === 'light' ? 'default' : 'dark',
          content_style: tinyMCEContentStyleV078C(),
          plugins: 'lists link image media table code autoresize',
          browser_spellcheck: true,
          object_resizing: 'img,table',
          convert_urls: false,
          relative_urls: false,
          remove_script_host: false,
          automatic_uploads: false,
          paste_data_images: true,
          setup: function (editor) {
            editor.on('init', function () {
              siteTinyMCEEditorV076A = editor;
              host.classList.remove('is-tinymce-engine-loading-v076a');
              host.classList.add('is-tinymce-engine-ready-v076a');
              if (hint) {
                hint.hidden = true;
                hint.textContent = '';
              }
              tinyMCEApplyCanvasThemeV078C();
              tinyMCESaveBookmarkV076A();
              tinyMCESyncV076A(editor, textarea);
            });

            editor.on('keyup mouseup focus NodeChange SetContent', function () {
              tinyMCESaveBookmarkV076A();
            });

            editor.on('click keydown', function () {
              closeNativeEditorPopovers();
            });

            editor.on('change input undo redo', function () {
              tinyMCESaveBookmarkV076A();
              tinyMCESyncV076A(editor, textarea);
            });
          }
        });
      } catch (error) {
        log('TinyMCE init failed', error);
        host.classList.remove('is-tinymce-engine-loading-v076a');
        textarea.style.display = '';
        if (hint) { hint.hidden = true; hint.textContent = ''; }
      }
    });

    return true;
  }

  /* IRGEZTNE_TINYMCE_ENGINE_POLISH_V076B */
  function tinyMCEPopoverFieldV076B(actionEl, selectors, urlOnly) {
    var scopes = [];

    if (actionEl && actionEl.closest) {
      var popover = actionEl.closest('.ir-site-studio-v5-native-popover');
      var group = actionEl.closest('.ir-site-studio-v5-native-tool-group');
      if (popover) scopes.push(popover);
      if (group) scopes.push(group);
    }

    for (var scopeIndex = 0; scopeIndex < scopes.length; scopeIndex += 1) {
      var scope = scopes[scopeIndex];
      if (!scope || !scope.querySelectorAll) continue;

      for (var i = 0; i < selectors.length; i += 1) {
        var el = scope.querySelector(selectors[i]);
        var value = el ? String(el.value || '').trim() : '';
        if (value) return value;
      }

      var inputs = Array.prototype.slice.call(scope.querySelectorAll('input, textarea'));
      for (var j = 0; j < inputs.length; j += 1) {
        var raw = String(inputs[j].value || '').trim();
        if (!raw) continue;
        if (!urlOnly) return raw;
        if (/^(https?:\/\/|data:image\/|\/|#)/i.test(raw)) return raw;
      }
    }

    return '';
  }

  function tinyMCECleanUrlV076B(url) {
    var value = String(url || '').trim();
    if (!value) return '';
    if (/^(https?:\/\/|mailto:|tel:|data:image\/|\/|#)/i.test(value)) return value;
    return '';
  }

  function tinyMCEInsertHtmlV076B(html) {
    var editor = siteTinyMCEEditorV076A;
    if (!editor) return false;

    tinyMCERestoreBookmarkV076A();

    try {
      editor.insertContent(html);
      tinyMCESaveBookmarkV076A();
      tinyMCESyncV076A(editor, editor.getElement());
      return true;
    } catch (error) {
      log('TinyMCE v076b insert failed', error);
      return false;
    }
  }

  function tinyMCEApplyLinkV076B(actionEl) {
    var editor = siteTinyMCEEditorV076A;
    if (!editor) return false;

    tinyMCERestoreBookmarkV076A();

    var url = tinyMCEPopoverFieldV076B(actionEl, [
      '[data-v5-editor-link-url="1"]',
      '[data-v5-link-url="1"]',
      '[data-v5-url="1"]',
      'input[type="url"]'
    ], true);

    if (!url && window.prompt) url = window.prompt(t('Link URL', 'URL ссылки'), 'https://') || '';
    url = tinyMCECleanUrlV076B(url);
    if (!url) return true;

    var selected = '';
    try { selected = editor.selection.getContent({ format: 'html' }) || ''; } catch (error) {}

    if (selected) {
      editor.selection.setContent('<a href="' + escapeHtml(url) + '">' + selected + '</a>');
    } else {
      var label = tinyMCEPopoverFieldV076B(actionEl, [
        '[data-v5-editor-link-label="1"]',
        '[data-v5-editor-link-text="1"]',
        '[data-v5-link-text="1"]'
      ], false) || url;
      editor.insertContent('<a href="' + escapeHtml(url) + '">' + escapeHtml(label) + '</a>');
    }

    tinyMCESaveBookmarkV076A();
    tinyMCESyncV076A(editor, editor.getElement());
    return true;
  }

  function tinyMCEInsertImageFromUrlV076B(url, alt) {
    url = tinyMCECleanUrlV076B(url);
    if (!url) return false;

    alt = String(alt || t('Image', 'Изображение')).trim() || t('Image', 'Изображение');

    return tinyMCEInsertHtmlV076B(
      '<figure class="ir-site-studio-v5-content-image">' +
        '<img src="' + escapeHtml(url) + '" alt="' + escapeHtml(alt) + '" style="max-width:100%;height:auto;">' +
        '<figcaption>' + escapeHtml(alt) + '</figcaption>' +
      '</figure><p></p>'
    );
  }

  function tinyMCEPickLocalImageV076B() {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';

    input.addEventListener('change', function () {
      var file = input.files && input.files[0];
      if (!file) return;

      var reader = new FileReader();
      reader.onload = function () {
        tinyMCEInsertImageFromUrlV076B(String(reader.result || ''), file.name || t('Image', 'Изображение'));
      };
      reader.readAsDataURL(file);
    });

    input.click();
    return true;
  }

  function tinyMCEApplyImageV076B(actionEl) {
    var url = tinyMCEPopoverFieldV076B(actionEl, [
      '[data-v5-editor-image-url="1"]',
      '[data-v5-image-url="1"]',
      '[data-v5-url="1"]',
      'input[type="url"]'
    ], true);

    var alt = tinyMCEPopoverFieldV076B(actionEl, [
      '[data-v5-editor-image-alt="1"]',
      '[data-v5-image-alt="1"]',
      '[data-v5-alt="1"]'
    ], false) || t('Image', 'Изображение');

    if (url) return tinyMCEInsertImageFromUrlV076B(url, alt);

    if (window.confirm && window.confirm(t('Choose image from computer?', 'Выбрать изображение с компьютера?'))) {
      return tinyMCEPickLocalImageV076B();
    }

    if (window.prompt) {
      url = window.prompt(t('Image URL', 'URL изображения'), 'https://') || '';
      if (url) return tinyMCEInsertImageFromUrlV076B(url, alt);
    }

    return true;
  }

  function tinyMCEApplyVideoV076B(actionEl) {
    var url = tinyMCEPopoverFieldV076B(actionEl, [
      '[data-v5-editor-video-url="1"]',
      '[data-v5-video-url="1"]',
      '[data-v5-url="1"]',
      'input[type="url"]'
    ], true);

    if (!url && window.prompt) url = window.prompt(t('Video / embed URL', 'URL видео / embed'), 'https://') || '';
    url = tinyMCECleanUrlV076B(url);
    if (!url) return true;

    return tinyMCEInsertHtmlV076B(
      '<figure class="ir-site-studio-v5-content-video">' +
        '<iframe src="' + escapeHtml(url) + '" loading="lazy" allowfullscreen></iframe>' +
      '</figure><p></p>'
    );
  }

  function tinyMCECopyContentV077B() {
    var editor = siteTinyMCEEditorV076A;
    if (!editor) return false;

    var selectedText = '';
    var html = '';

    try { selectedText = String(editor.selection.getContent({ format: 'text' }) || '').trim(); } catch (error) {}
    try { html = String(editor.getContent({ format: 'html' }) || '').trim(); } catch (error2) {}

    var text = selectedText || html;
    if (!text) return true;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(function () { copyText(text); });
    } else {
      copyText(text);
    }

    return true;
  }

  function tinyMCEHandleToolbarV076B(event, actionEl, cmdEl, blockEl) {
    var editor = siteTinyMCEEditorV076A;
    if (!editor) return false;

    function inToolbar(el) {
      return !!(el && el.closest && (el.closest('[data-v5-native-toolbar="1"]') || el.closest('.ir-site-studio-v5-native-popover')));
    }

    if (cmdEl && inToolbar(cmdEl)) {
      event.preventDefault();

      var command = cmdEl.dataset.v5Command || '';
      var value = cmdEl.dataset.v5Value || '';

      if (command === 'bold') return tinyMCEExecV076A('Bold');
      if (command === 'italic') return tinyMCEExecV076A('Italic');
      if (command === 'underline') return tinyMCEExecV076A('Underline');
      if (command === 'strikeThrough' || command === 'strike') return tinyMCEExecV076A('Strikethrough');
      if (command === 'insertUnorderedList') return tinyMCEExecV076A('InsertUnorderedList');
      if (command === 'insertOrderedList') return tinyMCEExecV076A('InsertOrderedList');
      if (command === 'justifyLeft') return tinyMCEExecV076A('JustifyLeft');
      if (command === 'justifyCenter') return tinyMCEExecV076A('JustifyCenter');
      if (command === 'justifyRight') return tinyMCEExecV076A('JustifyRight');
      if (command === 'indent') return tinyMCEExecV076A('Indent');
      if (command === 'outdent') return tinyMCEExecV076A('Outdent');
      if (command === 'undo') return tinyMCEExecV076A('Undo');
      if (command === 'redo') return tinyMCEExecV076A('Redo');
      if (command === 'foreColor' && value) { var okColorTextV077B = tinyMCEExecV076A('ForeColor', value); closeNativeEditorPopovers(); return okColorTextV077B; }
      if ((command === 'backColor' || command === 'hiliteColor') && value) { var okColorMarkerV077B = tinyMCEExecV076A('HiliteColor', value); closeNativeEditorPopovers(); return okColorMarkerV077B; }

      return false;
    }

    if (blockEl && inToolbar(blockEl)) {
      event.preventDefault();

      var block = blockEl.dataset.v5Block || 'p';
      if (block === 'quote') return tinyMCEExecV076A('FormatBlock', 'blockquote');
      return tinyMCEExecV076A('FormatBlock', block);
    }

    if (actionEl && inToolbar(actionEl)) {
      var action = actionEl.dataset.v5Action || '';

      if (/^(insert-link|apply-link|create-link|set-link)$/.test(action)) {
        event.preventDefault();
        tinyMCEApplyLinkV076B(actionEl);
        closeNativeEditorPopovers();
        return true;
      }

      if (/^(insert-image|apply-image|add-image|set-image|insert-image-url)$/.test(action)) {
        event.preventDefault();
        tinyMCEApplyImageV076B(actionEl);
        closeNativeEditorPopovers();
        return true;
      }

      if (/^(insert-video|apply-video|add-video|set-video|insert-embed|apply-embed)$/.test(action)) {
        event.preventDefault();
        tinyMCEApplyVideoV076B(actionEl);
        closeNativeEditorPopovers();
        return true;
      }

      if (action === 'insert-hr') {
        event.preventDefault();
        return tinyMCEInsertHtmlV076B('<hr><p></p>');
      }

      if (action === 'clear-format') {
        event.preventDefault();
        tinyMCEExecV076A('RemoveFormat');
        closeNativeEditorPopovers();
        return true;
      }
    }

    return false;
  }

  /* IRGEZTNE_TINYMCE_MEDIA_LAYOUT_V076C */
  function tinyMCESelectedImageFigureV076C() {
    var editor = siteTinyMCEEditorV076A;
    if (!editor || !editor.selection) return null;

    var node = editor.selection.getNode();
    if (!node) return null;

    if (node.nodeName === 'IMG') {
      return node.closest ? node.closest('figure.ir-site-studio-v5-content-image') : null;
    }

    if (node.closest) {
      return node.closest('figure.ir-site-studio-v5-content-image');
    }

    return null;
  }

  function tinyMCEFigureSetSizeV076C(figure, size) {
    if (!figure) return;
    ['is-size-small', 'is-size-medium', 'is-size-large', 'is-size-full'].forEach(function (cls) {
      figure.classList.remove(cls);
    });
    figure.classList.add('is-size-' + (size || 'large'));
  }

  function tinyMCEFigureSetAlignV076C(figure, align) {
    if (!figure) return;
    ['is-align-left', 'is-align-center', 'is-align-right'].forEach(function (cls) {
      figure.classList.remove(cls);
    });
    figure.classList.add('is-align-' + (align || 'center'));
  }

  function tinyMCEImageSettingsV076C() {
    var editor = siteTinyMCEEditorV076A;
    var figure = tinyMCESelectedImageFigureV076C();
    if (!editor || !figure) return false;

    var size = 'large';
    if (window.prompt) {
      size = window.prompt(t('Image size: small / medium / large / full', 'Размер изображения: small / medium / large / full'), 'large') || 'large';
    }
    size = /^(small|medium|large|full)$/i.test(size) ? size.toLowerCase() : 'large';

    var align = 'center';
    if (window.prompt) {
      align = window.prompt(t('Image align: left / center / right', 'Выравнивание: left / center / right'), 'center') || 'center';
    }
    align = /^(left|center|right)$/i.test(align) ? align.toLowerCase() : 'center';

    tinyMCEFigureSetSizeV076C(figure, size);
    tinyMCEFigureSetAlignV076C(figure, align);

    tinyMCESaveBookmarkV076A();
    tinyMCESyncV076A(editor, editor.getElement());
    return true;
  }

  function tinyMCEInsertImageV076C(url, alt) {
    url = String(url || '').trim();
    if (!url) return false;

    alt = String(alt || t('Image', 'Изображение')).trim() || t('Image', 'Изображение');

    return tinyMCEInsertContentV076A(
      '<figure class="ir-site-studio-v5-content-image is-size-large is-align-center">' +
        '<img src="' + escapeHtml(url) + '" alt="' + escapeHtml(alt) + '" style="max-width:100%;height:auto;">' +
        '<figcaption>' + escapeHtml(alt) + '</figcaption>' +
      '</figure><p></p>'
    );
  }

  function tinyMCEPickLocalImageV076C() {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';

    input.addEventListener('change', function () {
      var file = input.files && input.files[0];
      if (!file) return;

      var reader = new FileReader();
      reader.onload = function () {
        tinyMCEInsertImageV076C(String(reader.result || ''), file.name || t('Image', 'Изображение'));
      };
      reader.readAsDataURL(file);
    });

    input.click();
    return true;
  }

  function tinyMCEFieldStrictV076C(actionEl, selectors) {
    var scopes = [];
    if (actionEl && actionEl.closest) {
      var popover = actionEl.closest('.ir-site-studio-v5-native-popover');
      var group = actionEl.closest('.ir-site-studio-v5-native-tool-group');
      if (popover) scopes.push(popover);
      if (group) scopes.push(group);
    }

    for (var sIndex = 0; sIndex < scopes.length; sIndex += 1) {
      var scope = scopes[sIndex];
      for (var i = 0; i < selectors.length; i += 1) {
        var el = scope && scope.querySelector ? scope.querySelector(selectors[i]) : null;
        var value = el ? String(el.value || '').trim() : '';
        if (value) return value;
      }
      var inputs = scope && scope.querySelectorAll ? Array.prototype.slice.call(scope.querySelectorAll('input, textarea')) : [];
      for (var j = 0; j < inputs.length; j += 1) {
        var raw = String(inputs[j].value || '').trim();
        if (/^(https?:\/\/|data:image\/|\/)/i.test(raw)) return raw;
      }
    }

    return '';
  }

  function tinyMCEHandleMediaToolbarV076C(event, actionEl, cmdEl) {
    var editor = siteTinyMCEEditorV076A;
    if (!editor) return false;

    var figure = tinyMCESelectedImageFigureV076C();

    if (figure && cmdEl && cmdEl.closest && cmdEl.closest('[data-v5-native-toolbar="1"]')) {
      var command = cmdEl.dataset.v5Command || '';

      if (command === 'justifyLeft') {
        event.preventDefault();
        tinyMCEFigureSetAlignV076C(figure, 'left');
        tinyMCESyncV076A(editor, editor.getElement());
        return true;
      }

      if (command === 'justifyCenter') {
        event.preventDefault();
        tinyMCEFigureSetAlignV076C(figure, 'center');
        tinyMCESyncV076A(editor, editor.getElement());
        return true;
      }

      if (command === 'justifyRight') {
        event.preventDefault();
        tinyMCEFigureSetAlignV076C(figure, 'right');
        tinyMCESyncV076A(editor, editor.getElement());
        return true;
      }
    }

    if (actionEl && actionEl.closest && (actionEl.closest('[data-v5-native-toolbar="1"]') || actionEl.closest('.ir-site-studio-v5-native-popover'))) {
      var action = actionEl.dataset.v5Action || '';

      if (/^(insert-image|apply-image|add-image|set-image|insert-image-url)$/.test(action)) {
        event.preventDefault();

        if (figure && !tinyMCEFieldStrictV076C(actionEl, ['[data-v5-editor-image-url="1"]', '[data-v5-image-url="1"]', '[data-v5-url="1"]', 'input[type="url"]'])) {
          tinyMCEImageSettingsV076C();
          closeNativeEditorPopovers();
          return true;
        }

        var url = tinyMCEFieldStrictV076C(actionEl, [
          '[data-v5-editor-image-url="1"]',
          '[data-v5-image-url="1"]',
          '[data-v5-url="1"]',
          'input[type="url"]'
        ]);

        var alt = tinyMCEFieldStrictV076C(actionEl, [
          '[data-v5-editor-image-alt="1"]',
          '[data-v5-image-alt="1"]',
          '[data-v5-alt="1"]'
        ]) || t('Image', 'Изображение');

        if (url) {
          tinyMCEInsertImageV076C(url, alt);
          closeNativeEditorPopovers();
          return true;
        }

        tinyMCEPickLocalImageV076C();
        closeNativeEditorPopovers();
        return true;
      }
    }

    return false;
  }


  function tinyMCEPromptV078A(messageEn, messageRu, value) {
    if (!window.prompt) return '';
    return String(window.prompt(t(messageEn, messageRu), value || '') || '').trim();
  }

  function tinyMCECopyContentV078A() {
    var editor = siteTinyMCEEditorV076A;
    if (!editor) return false;

    var text = '';
    try { text = String(editor.selection.getContent({ format: 'text' }) || '').trim(); } catch (error) {}

    if (!text) {
      try { text = String(editor.getContent({ format: 'html' }) || '').trim(); } catch (error2) {}
    }

    if (!text) return true;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(function () { copyText(text); });
    } else {
      copyText(text);
    }

    return true;
  }

  function tinyMCEDeleteSelectionV078A() {
    var editor = siteTinyMCEEditorV076A;
    if (!editor) return false;

    tinyMCERestoreBookmarkV076A();

    try {
      var node = editor.selection.getNode();
      var figure = node && node.closest ? node.closest('figure.ir-site-studio-v5-content-image, figure.ir-site-studio-v5-content-video') : null;

      if (figure && figure.parentNode) {
        figure.parentNode.removeChild(figure);
        tinyMCESaveBookmarkV076A();
        tinyMCESyncV076A(editor, editor.getElement());
        return true;
      }

      editor.execCommand('Delete');
      tinyMCESaveBookmarkV076A();
      tinyMCESyncV076A(editor, editor.getElement());
      return true;
    } catch (error) {
      return false;
    }
  }

  function tinyMCEInsertImageUrlPromptV078A() {
    var url = tinyMCEPromptV078A('Image URL', 'URL изображения', 'https://');
    if (!url) return true;

    var alt = tinyMCEPromptV078A('Alt / caption (optional)', 'Alt / подпись (необязательно)', '');
    return tinyMCEInsertImageV076C(url, alt || t('Image', 'Изображение'));
  }

  function tinyMCEInsertVideoPromptV078A() {
    var url = tinyMCEPromptV078A('YouTube / Vimeo / iframe src', 'YouTube / Vimeo / iframe src', 'https://');
    if (!url) return true;

    return tinyMCEInsertHtmlV076B(
      '<figure class="ir-site-studio-v5-content-video">' +
        '<iframe src="' + escapeHtml(url) + '" loading="lazy" allowfullscreen></iframe>' +
      '</figure><p></p>'
    );
  }

  function tinyMCEHandlePubliiShellV078A(event, actionEl, cmdEl, blockEl) {
    var inShell = function (el) {
      return !!(el && el.closest && el.closest('[data-v078a-publii-shell="1"]'));
    };

    if (!inShell(actionEl || cmdEl || blockEl)) return false;

    var editor = siteTinyMCEEditorV076A;
    if (!editor) return false;

    if (cmdEl || blockEl) return false;

    var action = actionEl ? (actionEl.dataset.v5Action || '') : '';
    if (!action) return false;

    event.preventDefault();

    if (action === 'insert-link-prompt') { tinyMCEApplyLinkV076B(actionEl); return true; }
    if (action === 'unlink') { tinyMCEExecV076A('Unlink'); return true; }
    if (action === 'pick-local-image') { tinyMCEPickLocalImageV076C(); return true; }
    if (action === 'insert-image-url-prompt') { tinyMCEInsertImageUrlPromptV078A(); return true; }
    if (action === 'insert-video-prompt') { tinyMCEInsertVideoPromptV078A(); return true; }
    if (action === 'insert-table') { tinyMCEInsertHtmlV076B('<table><tbody><tr><td> </td><td> </td></tr><tr><td> </td><td> </td></tr></tbody></table><p></p>'); return true; }
    if (action === 'insert-code-block') { tinyMCEInsertHtmlV076B('<pre><code>' + escapeHtml(t('Code', 'Код')) + '</code></pre><p></p>'); return true; }
    if (action === 'insert-symbol') {
      var symbol = tinyMCEPromptV078A('Symbol / emoji', 'Символ / emoji', '🙂');
      if (symbol) tinyMCEInsertHtmlV076B(escapeHtml(symbol));
      return true;
    }
    if (action === 'insert-read-more') { tinyMCEInsertHtmlV076B('<hr data-ir-read-more="1"><p></p>'); return true; }
    if (action === 'editor-search') {
      try { editor.execCommand('SearchReplace'); } catch (error) { tinyMCEPromptV078A('Search text', 'Найти текст', ''); }
      return true;
    }
    if (action === 'clear-format') { tinyMCEExecV076A('RemoveFormat'); return true; }
    if (action === 'delete-selection') { tinyMCEDeleteSelectionV078A(); return true; }
    if (action === 'copy-content') { tinyMCECopyContentV078A(); return true; }
    if (action === 'toggle-html-panel') {
      try { editor.execCommand('mceCodeEditor'); } catch (error2) { window.alert(editor.getContent({ format: 'html' })); }
      return true;
    }
    if (action === 'quick-text-color') {
      var color = tinyMCEPromptV078A('Text color', 'Цвет текста', '#2f7be6');
      if (color) tinyMCEExecV076A('ForeColor', color);
      return true;
    }

    return false;
  }


  function tinyMCEPromptV078B(messageEn, messageRu, value) {
    if (!window.prompt) return '';
    return String(window.prompt(t(messageEn, messageRu), value || '') || '').trim();
  }

  function tinyMCEFocusForShellV078B() {
    var editor = siteTinyMCEEditorV076A;
    if (!editor) return null;

    try { tinyMCERestoreBookmarkV076A(); } catch (error0) {}
    try { editor.focus(false); } catch (error1) {}

    return editor;
  }

  function tinyMCEExecShellV078B(command, value) {
    var editor = tinyMCEFocusForShellV078B();
    if (!editor) return false;

    try {
      editor.execCommand(command, false, value || null);
      try { tinyMCESaveBookmarkV076A(); } catch (error0) {}
      try { tinyMCESyncV076A(editor, editor.getElement()); } catch (error1) {}
      return true;
    } catch (error) {
      log('Publii shell command failed', command, error);
      return true;
    }
  }

  function tinyMCEInsertShellV078B(html) {
    var editor = tinyMCEFocusForShellV078B();
    if (!editor) return false;

    try {
      editor.insertContent(html);
      try { tinyMCESaveBookmarkV076A(); } catch (error0) {}
      try { tinyMCESyncV076A(editor, editor.getElement()); } catch (error1) {}
      return true;
    } catch (error) {
      log('Publii shell insert failed', error);
      return true;
    }
  }

  function tinyMCEEscapeAttrV078B(value) {
    return escapeHtml(String(value || ''));
  }

  function tinyMCEInsertImageShellV078B(src, caption) {
    src = String(src || '').trim();
    if (!src) return true;

    caption = String(caption || '').trim();
    var captionHtml = caption && !/^(https?:\/\/|data:image\/|blob:|file:)/i.test(caption)
      ? '<figcaption>' + escapeHtml(caption) + '</figcaption>'
      : '';

    return tinyMCEInsertShellV078B(
      '<figure class="ir-site-studio-v5-content-image is-size-large is-align-center">' +
        '<img src="' + tinyMCEEscapeAttrV078B(src) + '" alt="' + tinyMCEEscapeAttrV078B(caption || t('Image', 'Изображение')) + '">' +
        captionHtml +
      '</figure><p><br></p>'
    );
  }

  function tinyMCEPickLocalImageShellV078B() {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';

    input.addEventListener('change', function () {
      var file = input.files && input.files[0];
      if (!file) return;

      var reader = new FileReader();
      reader.onload = function () {
        tinyMCEInsertImageShellV078B(String(reader.result || ''), '');
      };
      reader.readAsDataURL(file);
    });

    input.click();
    return true;
  }

  function tinyMCEApplyLinkShellV078B() {
    var editor = tinyMCEFocusForShellV078B();
    if (!editor) return false;

    var url = tinyMCEPromptV078B('Link URL', 'URL ссылки', 'https://');
    if (!url) return true;

    if (!/^[a-z]+:/i.test(url) && !/^#/.test(url) && !/^\//.test(url)) {
      url = 'https://' + url;
    }

    try {
      var selected = String(editor.selection.getContent({ format: 'html' }) || '');
      if (selected) {
        editor.selection.setContent('<a href="' + escapeHtml(url) + '" target="_blank" rel="noopener noreferrer">' + selected + '</a>');
      } else {
        var label = tinyMCEPromptV078B('Link text', 'Текст ссылки', url) || url;
        editor.insertContent('<a href="' + escapeHtml(url) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(label) + '</a>');
      }

      tinyMCESaveBookmarkV076A();
      tinyMCESyncV076A(editor, editor.getElement());
      return true;
    } catch (error) {
      log('Publii shell link failed', error);
      return true;
    }
  }

  function tinyMCEDeleteShellV078B() {
    var editor = tinyMCEFocusForShellV078B();
    if (!editor) return false;

    try {
      var node = editor.selection.getNode();
      var figure = node && node.closest ? node.closest('figure.ir-site-studio-v5-content-image, figure.ir-site-studio-v5-content-video') : null;

      if (figure && figure.parentNode) {
        figure.parentNode.removeChild(figure);
      } else {
        editor.execCommand('Delete');
      }

      tinyMCESaveBookmarkV076A();
      tinyMCESyncV076A(editor, editor.getElement());
      return true;
    } catch (error) {
      log('Publii shell delete failed', error);
      return true;
    }
  }

  function tinyMCECopyShellV078B() {
    var editor = siteTinyMCEEditorV076A;
    if (!editor) return false;

    var text = '';
    try { text = String(editor.selection.getContent({ format: 'text' }) || '').trim(); } catch (error0) {}
    if (!text) {
      try { text = String(editor.getContent({ format: 'html' }) || '').trim(); } catch (error1) {}
    }
    if (!text) return true;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(function () { copyText(text); });
    } else {
      copyText(text);
    }

    return true;
  }

  function tinyMCEHandlePubliiShellDirectV078B(event, actionEl, cmdEl, blockEl) {
    var target = actionEl || cmdEl || blockEl;
    if (!target || !target.closest || !target.closest('[data-v078a-publii-shell="1"]')) return false;

    var editor = siteTinyMCEEditorV076A;
    if (!editor) return false;

    event.preventDefault();
    if (event.stopPropagation) event.stopPropagation();

    if (cmdEl) {
      var raw = cmdEl.dataset.v5Command || '';
      var value = cmdEl.dataset.v5Value || '';

      var map = {
        bold: 'Bold',
        italic: 'Italic',
        underline: 'Underline',
        strikeThrough: 'StrikeThrough',
        insertUnorderedList: 'InsertUnorderedList',
        insertOrderedList: 'InsertOrderedList',
        justifyLeft: 'JustifyLeft',
        justifyCenter: 'JustifyCenter',
        justifyRight: 'JustifyRight',
        outdent: 'Outdent',
        indent: 'Indent',
        undo: 'Undo',
        redo: 'Redo',
        foreColor: 'ForeColor',
        backColor: 'HiliteColor',
        hiliteColor: 'HiliteColor'
      };

      if (map[raw]) return tinyMCEExecShellV078B(map[raw], value);
      return true;
    }

    if (blockEl) {
      var block = blockEl.dataset.v5Block || 'p';
      var format = block === 'quote' ? 'blockquote' : block;
      return tinyMCEExecShellV078B('FormatBlock', format);
    }

    var action = actionEl ? (actionEl.dataset.v5Action || '') : '';
    if (!action) return true;

    if (action === 'insert-link-prompt' || action === 'insert-link') return tinyMCEApplyLinkShellV078B();
    if (action === 'unlink') return tinyMCEExecShellV078B('Unlink');

    if (action === 'quick-text-color') {
      var color = tinyMCEPromptV078B('Text color', 'Цвет текста', '#2f7be6');
      return color ? tinyMCEExecShellV078B('ForeColor', color) : true;
    }

    if (action === 'quick-marker-color') {
      var marker = tinyMCEPromptV078B('Marker color', 'Цвет маркера', '#fff3bf');
      return marker ? tinyMCEExecShellV078B('HiliteColor', marker) : true;
    }

    if (action === 'pick-local-image') return tinyMCEPickLocalImageShellV078B();

    if (action === 'insert-image-url-prompt') {
      var src = tinyMCEPromptV078B('Image URL', 'URL изображения', 'https://');
      if (!src) return true;
      var caption = tinyMCEPromptV078B('Caption / alt', 'Подпись / alt', '');
      return tinyMCEInsertImageShellV078B(src, caption);
    }

    if (action === 'insert-video-prompt') {
      var video = tinyMCEPromptV078B('YouTube / Vimeo / iframe src', 'YouTube / Vimeo / iframe src', 'https://');
      if (!video) return true;
      return tinyMCEInsertShellV078B(
        '<figure class="ir-site-studio-v5-content-video">' +
          '<iframe src="' + escapeHtml(video) + '" loading="lazy" allowfullscreen></iframe>' +
        '</figure><p><br></p>'
      );
    }

    if (action === 'insert-table') {
      return tinyMCEInsertShellV078B('<table><tbody><tr><td> </td><td> </td></tr><tr><td> </td><td> </td></tr></tbody></table><p><br></p>');
    }

    if (action === 'insert-hr') return tinyMCEInsertShellV078B('<hr><p><br></p>');
    if (action === 'insert-read-more') return tinyMCEInsertShellV078B('<hr data-ir-read-more="1"><p><br></p>');
    if (action === 'insert-code-block') return tinyMCEInsertShellV078B('<pre><code>' + escapeHtml(t('Code', 'Код')) + '</code></pre><p><br></p>');

    if (action === 'insert-symbol') {
      var symbol = tinyMCEPromptV078B('Symbol / emoji', 'Символ / emoji', '🙂');
      return symbol ? tinyMCEInsertShellV078B(escapeHtml(symbol)) : true;
    }

    if (action === 'clear-format') return tinyMCEExecShellV078B('RemoveFormat');
    if (action === 'delete-selection') return tinyMCEDeleteShellV078B();
    if (action === 'copy-content') return tinyMCECopyShellV078B();

    if (action === 'toggle-html-panel') {
      try { editor.execCommand('mceCodeEditor'); } catch (error) { window.alert(editor.getContent({ format: 'html' })); }
      return true;
    }

    return true;
  }


  function editorShellIsInsideV078C(el) {
    return !!(el && el.closest && el.closest('[data-v078a-publii-shell="1"]'));
  }

  function editorShellFocusV078C() {
    var editor = siteTinyMCEEditorV076A;
    if (!editor) return null;

    try { tinyMCERestoreBookmarkV076A(); } catch (error0) {}
    try { editor.focus(false); } catch (error1) {}

    return editor;
  }

  function editorShellExecV078C(command, value) {
    var editor = editorShellFocusV078C();
    if (!editor) return false;

    try {
      editor.execCommand(command, false, value || null);
      tinyMCESaveBookmarkV076A();
      tinyMCESyncV076A(editor, editor.getElement());
      return true;
    } catch (error) {
      log('Editor shell command failed', command, error);
      return true;
    }
  }

  function editorShellInsertV078C(html) {
    var editor = editorShellFocusV078C();
    if (!editor) return false;

    try {
      editor.insertContent(html);
      tinyMCESaveBookmarkV076A();
      tinyMCESyncV076A(editor, editor.getElement());
      return true;
    } catch (error) {
      log('Editor shell insert failed', error);
      return true;
    }
  }

  function editorShellPromptV078C(en, ru, value) {
    if (!window.prompt) return '';
    var result = window.prompt(t(en, ru), value || '');
    if (result === null) return '';
    return String(result || '').trim();
  }

  function editorShellLinkV078C() {
    var editor = editorShellFocusV078C();
    if (!editor) return false;

    var bookmark = null;
    var selectedHtml = '';
    var selectedText = '';

    try { bookmark = editor.selection.getBookmark(2, true); } catch (error0) {}
    try { selectedHtml = String(editor.selection.getContent({ format: 'html' }) || ''); } catch (error1) {}
    try { selectedText = String(editor.selection.getContent({ format: 'text' }) || ''); } catch (error2) {}

    var url = editorShellPromptV078C('Link URL', 'URL ссылки', 'https://');
    if (!url) return true;

    if (!/^[a-z]+:/i.test(url) && !/^#/.test(url) && !/^\//.test(url)) {
      url = 'https://' + url;
    }

    try {
      editor.focus(false);
      if (bookmark) editor.selection.moveToBookmark(bookmark);

      if (selectedHtml || selectedText) {
        editor.selection.setContent(
          '<a href="' + escapeHtml(url) + '" target="_blank" rel="noopener noreferrer">' +
            (selectedHtml || escapeHtml(selectedText)) +
          '</a>'
        );
      } else {
        var label = editorShellPromptV078C('Link text', 'Текст ссылки', url) || url;
        editor.insertContent('<a href="' + escapeHtml(url) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(label) + '</a>');
      }

      tinyMCESaveBookmarkV076A();
      tinyMCESyncV076A(editor, editor.getElement());
      return true;
    } catch (error3) {
      log('Editor shell link failed', error3);
      return true;
    }
  }

  function editorShellCopyV078C() {
    var editor = siteTinyMCEEditorV076A;
    if (!editor) return false;

    var text = '';
    try { text = String(editor.selection.getContent({ format: 'text' }) || '').trim(); } catch (error0) {}
    if (!text) {
      try { text = String(editor.getContent({ format: 'html' }) || '').trim(); } catch (error1) {}
    }
    if (!text) return true;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(function () { copyText(text); });
    } else {
      copyText(text);
    }

    return true;
  }

  function editorShellHtmlPanelV078C() {
    var editor = siteTinyMCEEditorV076A;
    if (!editor || !overlay) return false;

    var old = overlay.querySelector('[data-v078c-html-panel="1"]');
    if (old && old.parentNode) {
      old.parentNode.removeChild(old);
      return true;
    }

    var panel = document.createElement('div');
    panel.className = 'ir-site-studio-v5-html-panel-v078c';
    panel.dataset.v078cHtmlPanel = '1';
    panel.innerHTML =
      '<div class="ir-site-studio-v5-html-panel-head-v078c">' +
        '<strong>HTML</strong>' +
        '<div>' +
          '<button type="button" data-v078c-html-apply="1">Apply</button>' +
          '<button type="button" data-v078c-html-copy="1">Copy</button>' +
          '<button type="button" data-v078c-html-close="1">×</button>' +
        '</div>' +
      '</div>' +
      '<textarea spellcheck="false"></textarea>';

    var textarea = panel.querySelector('textarea');
    textarea.value = editor.getContent({ format: 'html' }) || '';

    panel.addEventListener('click', function (event) {
      if (event.target.closest('[data-v078c-html-close="1"]')) {
        panel.remove();
      } else if (event.target.closest('[data-v078c-html-copy="1"]')) {
        var value = textarea.value || '';
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(value).catch(function () { copyText(value); });
        else copyText(value);
      } else if (event.target.closest('[data-v078c-html-apply="1"]')) {
        editor.setContent(textarea.value || '');
        tinyMCESaveBookmarkV076A();
        tinyMCESyncV076A(editor, editor.getElement());
        panel.remove();
      }
    });

    var host = overlay.querySelector('[data-v5-jodit-host="1"]');
    if (host && host.parentNode) host.parentNode.insertBefore(panel, host);
    else overlay.appendChild(panel);

    return true;
  }

  function editorShellDeleteV078C() {
    var editor = editorShellFocusV078C();
    if (!editor) return false;

    try {
      var node = editor.selection.getNode();
      var figure = node && node.closest ? node.closest('figure.ir-site-studio-v5-content-image, figure.ir-site-studio-v5-content-video') : null;

      if (figure && figure.parentNode) figure.parentNode.removeChild(figure);
      else editor.execCommand('Delete');

      tinyMCESaveBookmarkV076A();
      tinyMCESyncV076A(editor, editor.getElement());
      return true;
    } catch (error) {
      return true;
    }
  }

  function editorShellRunV078C(event, target) {
    if (!target || !editorShellIsInsideV078C(target)) return false;
    if (!siteTinyMCEEditorV076A) return false;

    event.preventDefault();
    if (event.stopPropagation) event.stopPropagation();
    if (event.stopImmediatePropagation) event.stopImmediatePropagation();

    var command = target.dataset.v5Command || '';
    var block = target.dataset.v5Block || '';
    var action = target.dataset.v5Action || '';
    var value = target.dataset.v5Value || '';

    var map = {
      bold: 'Bold',
      italic: 'Italic',
      underline: 'Underline',
      strikeThrough: 'StrikeThrough',
      insertUnorderedList: 'InsertUnorderedList',
      insertOrderedList: 'InsertOrderedList',
      justifyLeft: 'JustifyLeft',
      justifyCenter: 'JustifyCenter',
      justifyRight: 'JustifyRight',
      undo: 'Undo',
      redo: 'Redo'
    };

    if (command && map[command]) return editorShellExecV078C(map[command], value);
    if (block) return editorShellExecV078C('FormatBlock', block === 'quote' ? 'blockquote' : block);

    if (action === 'insert-link-prompt' || action === 'insert-link') return editorShellLinkV078C();
    if (action === 'unlink') return editorShellExecV078C('Unlink');
    if (action === 'quick-text-color') {
      var color = editorShellPromptV078C('Text color', 'Цвет текста', '#2f7be6');
      return color ? editorShellExecV078C('ForeColor', color) : true;
    }
    if (action === 'quick-marker-color') return editorShellExecV078C('HiliteColor', '#fff3bf');
    if (action === 'insert-symbol') {
      var symbol = editorShellPromptV078C('Symbol / emoji', 'Символ / emoji', '🙂');
      return symbol ? editorShellInsertV078C(escapeHtml(symbol)) : true;
    }
    if (action === 'insert-hr') return editorShellInsertV078C('<hr><p><br></p>');
    if (action === 'insert-read-more') return editorShellInsertV078C('<hr data-ir-read-more="1"><p><br></p>');
    if (action === 'insert-code-block') return editorShellInsertV078C('<pre><code>' + escapeHtml(t('Code', 'Код')) + '</code></pre><p><br></p>');
    if (action === 'clear-format') return editorShellExecV078C('RemoveFormat');
    if (action === 'delete-selection') return editorShellDeleteV078C();
    if (action === 'copy-content') return editorShellCopyV078C();
    if (action === 'toggle-html-panel') return editorShellHtmlPanelV078C();

    return true;
  }

  function bindPubliiShellEventsV078C() {
    if (!overlay || overlay.dataset.v078cShellBound === '1') return;
    overlay.dataset.v078cShellBound = '1';

    overlay.addEventListener('mousedown', function (event) {
      var target = event.target && event.target.closest ? event.target.closest('[data-v078a-publii-shell="1"] button, [data-v078a-publii-shell="1"] select') : null;
      if (target) event.preventDefault();
    }, true);

    overlay.addEventListener('click', function (event) {
      var target = event.target && event.target.closest ? event.target.closest('[data-v5-action], [data-v5-command], [data-v5-block]') : null;
      if (!target || !editorShellIsInsideV078C(target)) return;
      editorShellRunV078C(event, target);
    }, true);

    overlay.addEventListener('change', function (event) {
      var select = event.target && event.target.closest ? event.target.closest('[data-v5-publii-block-select="1"], [data-v5-publii-format-select="1"]') : null;
      if (!select || !editorShellIsInsideV078C(select)) return;

      event.preventDefault();
      if (event.stopPropagation) event.stopPropagation();
      if (event.stopImmediatePropagation) event.stopImmediatePropagation();

      var value = select.value || 'p';
      if (value === 'quote') value = 'blockquote';
      editorShellExecV078C('FormatBlock', value);
    }, true);
  }

  function handleLiteProToolbarClickV075A(event, actionEl, cmdEl, blockEl) {

    if (tinyMCEHandlePubliiShellDirectV078B(event, actionEl, cmdEl, blockEl)) return true;

    if (tinyMCEHandlePubliiShellV078A(event, actionEl, cmdEl, blockEl)) return true;
    if (tinyMCEHandleMediaToolbarV076C(event, actionEl, cmdEl)) return true;
    if (tinyMCEHandleToolbarV076B(event, actionEl, cmdEl, blockEl)) return true;
    if (tinyMCEHandleToolbarV076A(event, actionEl, cmdEl, blockEl)) return true;

    return false;
  }

  function handleOverlayClick(event) {
    if (event && event.target && event.target.closest) {
      var insideEditorPopoverV076B = event.target.closest('.ir-site-studio-v5-native-popover') || event.target.closest('[data-v5-native-toolbar="1"]');
      if (!insideEditorPopoverV076B) closeNativeEditorPopovers();
    }
    if (isEditorCoreEventTarget(event)) {
      // IRGEZTNE_WEBSTUDIO_EDITOR_CORE_STOP_CLICK_BUBBLE_V065J
      // The editor owns its caret/selection. Do not let Web Studio document-level
      // click handlers react to ordinary editor clicks.
      if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
      return;
    }
    var nativePopoverForClick = event.target && event.target.closest ? event.target.closest('.ir-site-studio-v5-native-popover') : null;
    closeNativeEditorPopovers(nativePopoverForClick);
    var tabEl = event.target.closest('[data-v5-tab]');
    var actionEl = event.target.closest('[data-v5-action]');
    var cmdEl = event.target.closest('[data-v5-command]');
    var blockEl = event.target.closest('[data-v5-block]');
    if (handleLiteProToolbarClickV075A(event, actionEl, cmdEl, blockEl)) return;
    if (tabEl) {
      event.preventDefault();
      activeTab = normalizeStudioTabId(tabEl.dataset.v5Tab || tabEl.textContent || 'page', 'page');
      tabEl.setAttribute('data-v5-tab', activeTab);
      try {
        saveContentFromDom();
      } catch (error) {
        console.warn('IRGEZTNE Web Studio tab switch save skipped', error);
      }
      if (activeTab === 'page') collapsedRight = false;
      else if (!isPageSettingsRelevant(activeTab)) collapsedRight = true;
      renderStudio();
      return;
    }
    if (cmdEl) {
      event.preventDefault();
      execCommand(cmdEl.dataset.v5Command, cmdEl.dataset.v5Value || null);
      if (cmdEl.closest && cmdEl.closest('.ir-site-studio-v5-native-popover')) closeNativeEditorPopovers();
      saveContentFromDom();
      return;
    }
    if (blockEl) {
      event.preventDefault();
      var blockMap = { h1: 'H1', h2: 'H2', h3: 'H3', p: 'P', quote: 'BLOCKQUOTE' };
      execCommand('formatBlock', blockMap[blockEl.dataset.v5Block] || 'P');
      saveContentFromDom();
      return;
    }
    if (!actionEl) return;
    var action = actionEl.dataset.v5Action;
    event.preventDefault();
    if (action === 'close' || action === 'back-editor' || action === 'exit-studio') { closeStudio(); return; }
    // IRGEZTNE_V083I_TEMPLATE_LAB_ACTIONS
    if (action === 'template-lab-open-preview-v083i') {
      event.preventDefault();
      openTemplateLabPreviewV083I(actionEl.dataset.v5TemplatePath || '', actionEl.dataset.v5TemplateTitle || '');
      return;
    }

    if (action === 'template-lab-preview-close-v083i') {
      event.preventDefault();
      closeTemplateLabPreviewV083I();
      return;
    }

    if (action === 'template-lab-use-v083h') {
      event.preventDefault();
      var selectedTemplateIdV083I = actionEl.dataset.v5TemplateId || 'project-landing';
      var selectedTemplatePathV083I = actionEl.dataset.v5TemplatePath || '';
      var draftV083I = getSiteManagerDraft();
      draftV083I.template = selectedTemplateIdV083I;
      draftV083I.templateSource = 'template-lab';
      draftV083I.templatePreviewPath = normalizeTemplateLabPathV083K(selectedTemplatePathV083I) || templateLabPathForTemplateIdV083K(selectedTemplateIdV083I);
      activeTab = 'sites';
      siteManagerMode = 'list';
      collapsedRight = true;
      renderStudio();
      return;
    }

    if (action === 'open-sites') { activeTab = 'sites'; siteManagerMode = 'list'; collapsedRight = true; renderStudio(); return; }
    if (action === 'site-cockpit-open') { activeTab = 'site-settings'; siteManagerMode = 'cockpit'; siteSettingsSection = 'general'; collapsedRight = true; renderStudio(); return; }
    if (action === 'site-cockpit-back') { activeTab = 'sites'; siteManagerMode = 'list'; collapsedRight = true; renderStudio(); return; }
    if (action === 'site-settings-section') { siteSettingsSection = actionEl.dataset.v5SettingsSection || 'general'; activeTab = 'site-settings'; siteManagerMode = 'cockpit'; collapsedRight = true; renderStudio(); return; }
    if (action === 'site-settings-save') { saveSiteSettingsFromPanel(); return; }
    if (action === 'quick-publish') {
      saveAllFromDom(false);
      var quickState = readState();
      quickState.site.publishSettings = normalizePublishSettings(quickState.site.publishSettings);
      var quickProviderId = quickState.site.publishSettings.selectedProvider || 'manual';
      var quickConfig = quickState.site.publishSettings.providers[quickProviderId] || defaultPublishProviderConfig(quickProviderId);
      var quickMissing = publishMissingFields(quickConfig, publishProviderMeta(quickProviderId));
      if (quickProviderId === 'manual' || quickMissing.length) {
        activeTab = 'server';
        collapsedRight = true;
        renderStudio();
        return;
      }
      publishFoundation();
      return;
    }
    if (action === 'site-draft-icon') { getSiteManagerDraft().icon = actionEl.dataset.v5SiteIcon || '◆'; activeTab = 'sites'; renderStudio(); return; }
    if (action === 'site-draft-color') { getSiteManagerDraft().color = actionEl.dataset.v5SiteColor || '#2f7be6'; activeTab = 'sites'; renderStudio(); return; }
    if (action === 'site-create') { createLocalSite(); return; }
    if (action === 'site-switch') { switchLocalSite(actionEl.dataset.v5SiteId); return; }
    if (action === 'site-duplicate') { duplicateLocalSite(actionEl.dataset.v5SiteId); return; }
    if (action === 'site-delete') { deleteLocalSite(actionEl.dataset.v5SiteId); return; }
    if (action === 'open-backup-center') { closeStudio(); if (window.NSWorkspaceBackup && typeof window.NSWorkspaceBackup.openPanel === 'function') window.NSWorkspaceBackup.openPanel(); return; }
    if (action === 'toggle-studio-lang') { toggleStudioLang(); return; }
    if (action === 'toggle-studio-theme') { toggleStudioTheme(); return; }
    if (action === 'toggle-left') { collapsedLeft = !collapsedLeft; renderStudio(); return; }
    if (action === 'toggle-right') {
      if (!isPageSettingsRelevant(activeTab)) { activeTab = 'page'; collapsedRight = false; renderStudio(); return; }
      collapsedRight = !collapsedRight;
      renderStudio();
      return;
    }
    if (action === 'new-page') { createPage(); return; }
    if (action === 'create-child-page') { createChildPage(actionEl.dataset.v5PageId); return; }
    if (action === 'reset-pages') { resetTestСтраницы(); return; }
    if (action === 'select-page') { var state = readState(); state.activePageId = actionEl.dataset.v5PageId; writeState(state); activeTab = 'page'; collapsedRight = false; renderStudio(); return; }
    if (action === 'preview-page') { var statePreviewPage = readState(); statePreviewPage.activePageId = actionEl.dataset.v5PageId; writeState(statePreviewPage); activeTab = 'preview'; renderStudio(); return; }
    if (action === 'edit-current-page') { activeTab = 'page'; collapsedRight = false; renderStudio(); return; }
    if (action === 'menu-open-page') { var stateMenuOpen = readState(); stateMenuOpen.activePageId = actionEl.dataset.v5PageId; writeState(stateMenuOpen); activeTab = 'page'; collapsedRight = false; renderStudio(); return; }
    if (action === 'delete-page') { deletePage(actionEl.dataset.v5PageId); return; }
    if (action === 'move-up') { movePage(actionEl.dataset.v5PageId, -1); return; }
    if (action === 'move-down') { movePage(actionEl.dataset.v5PageId, 1); return; }
    if (action === 'page-indent') { indentPage(actionEl.dataset.v5PageId); return; }
    if (action === 'page-outdent') { outdentPage(actionEl.dataset.v5PageId); return; }
    if (action === 'page-root') { movePageToRoot(actionEl.dataset.v5PageId); return; }
    if (action === 'page-add-menu') { addPageToHeaderMenu(actionEl.dataset.v5PageId); return; }
    if (action === 'preview-select-page') { var stPreview = readState(); stPreview.activePageId = actionEl.dataset.v5PageId; writeState(stPreview); activeTab = 'preview'; renderStudio(); return; }
    if (action === 'pages-add-top-level-menu') { addTopLevelPagesToHeaderMenu(); return; }
    if (action === 'toggle-preview-wide') { previewWide = !previewWide; collapsedRight = previewWide; renderStudio(); return; }
    if (action === 'open-site-window') { saveAllFromDom(false); openSiteInBrowser(); return; }
    if (action === 'open-current-page-window') { saveAllFromDom(false); openCurrentPageInBrowser(); return; }
    if (action === 'download-html') { saveAllFromDom(false); downloadCurrentHtml(); return; }
    if (action === 'publish-select-provider') { var stPublishSelect = readState(); stPublishSelect.site.publishSettings = normalizePublishSettings(stPublishSelect.site.publishSettings); var selectedProvider = actionEl.dataset.v5Provider || 'manual'; stPublishSelect.site.publishSettings.selectedProvider = selectedProvider; if (selectedProvider === 'manual' || selectedProvider === 'ipfs') { stPublishSelect.site.publishSettings.providers[selectedProvider] = stPublishSelect.site.publishSettings.providers[selectedProvider] || defaultPublishProviderConfig(selectedProvider); stPublishSelect.site.publishSettings.providers[selectedProvider].enabled = true; } writeState(stPublishSelect); activeTab = 'server'; renderStudio(); try { window.requestAnimationFrame(function () { var target = overlay && overlay.querySelector('[data-v5-publish-settings="1"]') || overlay && overlay.querySelector('.ir-site-studio-v5-publish-picker'); if (target && typeof target.scrollIntoView === 'function') target.scrollIntoView({ block: 'start', behavior: 'smooth' }); }); } catch (error) {} return; }
    if (action === 'publish-download-starter-zip' || action === 'publish-download-starter-html') { saveAllFromDom(false); downloadPublishStarterZip(); return; }
    if (action === 'publish-save-settings') { saveAllFromDom(false); savePublishSettings(); return; }
    if (action === 'publish-clear-token') { var stClear = readState(); stClear.site.publishSettings = normalizePublishSettings(stClear.site.publishSettings); var pidClear = stClear.site.publishSettings.selectedProvider || 'manual'; if (stClear.site.publishSettings.providers[pidClear]) { clearPublishSecrets(pidClear, stClear.site.publishSettings.providers[pidClear]); stClear.site.publishSettings.providers[pidClear].enabled = false; stClear.site.publishSettings.providers[pidClear].lastStatus = t('Token cleared locally.', 'Token локально очищен.'); stClear.site.publishSettings.providers[pidClear].lastResult = 'info'; } writeState(stClear); activeTab = 'server'; renderStudio(); return; }
    if (action === 'publish-test-settings') { saveAllFromDom(false); testPublishSettings(); return; }
    if (action === 'publish-foundation') { saveAllFromDom(false); publishFoundation(); return; }
    if (action === 'publish-download-zip') { saveAllFromDom(false); downloadSiteZip(); return; }
    if (action === 'publish-open-site') { saveAllFromDom(false); openSiteInBrowser(true); return; }
    if (action === 'save-page') { saveAllFromDom(true); return; }
    if (action === 'menu-add-group') {
      var stateMenuAdd = readState();
      ensureMenuGroups(stateMenuAdd);
      var menuName = window.prompt(t('New menu name', 'Название нового меню'), t('New menu', 'Новое меню'));
      if (!menuName) return;
      var newGroupId = uid();
      stateMenuAdd.menuGroups.push({ id: newGroupId, name: menuName.trim(), position: 'unassigned', items: [] });
      stateMenuAdd.activeMenuGroupId = newGroupId;
      writeState(stateMenuAdd);
      renderStudio();
      return;
    }
    if (action === 'menu-select-group') {
      var stateMenuSelect = readState();
      ensureMenuGroups(stateMenuSelect);
      stateMenuSelect.activeMenuGroupId = actionEl.dataset.v5MenuGroupId;
      writeState(stateMenuSelect);
      activeTab = 'menu';
      renderStudio();
      return;
    }
    if (action === 'menu-delete-group') {
      var stateMenuDelete = readState();
      ensureMenuGroups(stateMenuDelete);
      var groupIdToDelete = actionEl.dataset.v5MenuGroupId;
      var groupToDelete = stateMenuDelete.menuGroups.find(function (group) { return group.id === groupIdToDelete; });
      if (!groupToDelete) return;
      if (!window.confirm(t('Delete menu “', 'Удалить меню “') + groupToDelete.name + '”?')) return;
      stateMenuDelete.menuGroups = stateMenuDelete.menuGroups.filter(function (group) { return group.id !== groupIdToDelete; });
      stateMenuDelete.activeMenuGroupId = stateMenuDelete.menuGroups[0] ? stateMenuDelete.menuGroups[0].id : '';
      writeState(stateMenuDelete);
      activeTab = 'menu';
      renderStudio();
      return;
    }
    if (action === 'menu-reset-home') { resetHeaderMenuToHome(); return; }
    if (action === 'menu-add-page-item') { addMenuItem('page'); return; }
    if (action === 'menu-add-external-item') { addMenuItem('external'); return; }
    if (action === 'menu-add-social-item') { addMenuItem('social'); return; }
    if (action === 'menu-item-up') { moveMenuItem(actionEl.dataset.v5MenuGroupId, actionEl.dataset.v5MenuItemId, -1); return; }
    if (action === 'menu-item-down') { moveMenuItem(actionEl.dataset.v5MenuGroupId, actionEl.dataset.v5MenuItemId, 1); return; }
    if (action === 'menu-delete-item') { deleteMenuItem(actionEl.dataset.v5MenuGroupId, actionEl.dataset.v5MenuItemId); return; }
    if (action === 'focus-h1') { var h1 = overlay.querySelector('.ir-site-studio-v5-page-title'); if (h1) { h1.focus(); h1.select(); } return; }
    if (action === 'apply-text-color') { editorApplyColorFromToolbar(actionEl, 'foreColor', '[data-v5-color-text-input="1"]', '[data-v5-color-text-hex="1"]'); return; }
    if (action === 'apply-marker-color') { editorApplyColorFromToolbar(actionEl, 'backColor', '[data-v5-color-marker-input="1"]', '[data-v5-color-marker-hex="1"]'); return; }
    if (action === 'insert-link') { insertEditorLinkFromToolbar(actionEl); closeNativeEditorPopovers(); return; }
    if (action === 'unlink') { execCommand('unlink'); closeNativeEditorPopovers(); saveContentFromDom(); return; }
    if (action === 'insert-image') { insertEditorImageFromToolbar(actionEl); closeNativeEditorPopovers(); return; }
    if (action === 'insert-hr') { execCommand('insertHorizontalRule'); saveContentFromDom(); return; }
    if (action === 'clear-format') { execCommand('removeFormat'); execCommand('unlink'); saveContentFromDom(); return; }
    if (action === 'set-site-color') {
      var stColor = readState();
      var colorField = actionEl.dataset.v5SiteColorField;
      var colorValue = actionEl.dataset.v5SiteColorValue;
      if (colorField) stColor.site[colorField] = colorValue;
      writeState(stColor);
      activeTab = 'identity';
      renderStudio();
      return;
    }
    if (action === 'generate-logo') { generateLogoLetters(); return; }
    if (action === 'download-logo-svg') { var st = readState(); downloadText('irgeztne-site-logo.svg', svgLogo(st.site, 512), 'image/svg+xml;charset=utf-8'); return; }
    if (action === 'download-favicon-pack') { saveAllFromDom(false); downloadFaviconPack(); return; }
    if (action === 'download-favicon-svg') { var st2 = readState(); downloadText('favicon.svg', svgFavicon(st2.site, 256), 'image/svg+xml;charset=utf-8'); return; }
  }

  function handleOverlayInput(event) {
    /* IRGEZTNE_V078B_DIRECT_SELECTS */
    var selectV078B = event && event.target && event.target.closest ? event.target.closest('[data-v5-publii-block-select="1"], [data-v5-publii-format-select="1"]') : null;
    if (selectV078B && siteTinyMCEEditorV076A) {
      var valueV078B = selectV078B.value || 'p';
      if (valueV078B === 'quote') valueV078B = 'blockquote';
      tinyMCEExecShellV078B('FormatBlock', valueV078B);
      return;
    }

    if (isEditorCoreEventTarget(event)) return;
    if (!overlay || !overlay.classList.contains('is-open')) return;
    /* IRGEZTNE_INPUT_FAVICON_STABILITY_V073A
       Text inputs inside Web Studio should not bubble into document-level helpers while typing.
       State is still updated below, but DOM should not be recreated just because one character was typed. */
    var inputTargetV073A = event && event.target;
    var isLiveTextInputV073A = !!(inputTargetV073A && inputTargetV073A.matches && inputTargetV073A.matches('input:not([type]), input[type="text"], input[type="search"], input[type="url"], input[type="email"], input[type="tel"], textarea'));
    if (event.type === 'input' && isLiveTextInputV073A && typeof event.stopPropagation === 'function') {
      event.stopPropagation();
    }
    var contentInputV074B = event.target.closest('[data-v5-content="1"]');
    if (contentInputV074B) {
      // IRGEZTNE_WEBSTUDIO_SAFE_WRITING_BOUNDARIES_V074B
      saveContentFromDom();
      return;
    }
    var siteManagerFieldEl = event.target.closest('[data-v5-site-manager-field]');
    if (siteManagerFieldEl) {
      // IRGEZTNE_INPUT_FAVICON_STABILITY_V073A: do not refocus while typing; it can disturb caret.
      var draft = getSiteManagerDraft();
      var draftKeyV074A = siteManagerFieldEl.dataset.v5SiteManagerField;
      draft[draftKeyV074A] = siteManagerFieldEl.value;

      if (
        siteManagerError &&
        draftKeyV074A === siteManagerErrorField
      ) {
        siteManagerError = '';
        siteManagerErrorField = '';

        siteManagerFieldEl.classList.remove('is-invalid');

        var createCardV084W = siteManagerFieldEl.closest(
          '.ir-site-studio-v5-create-site-card'
        );

        var formErrorV084W = createCardV084W &&
          createCardV084W.querySelector(
            '.ir-site-studio-v5-form-error'
          );

        if (formErrorV084W) formErrorV084W.remove();
      }

      if (draftKeyV074A === 'color') {
        var color = normalizeHexColor(siteManagerFieldEl.value, '#2f7be6');
        var big = overlay.querySelector('.ir-site-studio-v5-site-big-icon');
        if (big) big.style.setProperty('--site-color', color);
      }
      return;
    }
    var pagesSearchEl = event.target.closest('[data-v5-pages-search]');
    if (pagesSearchEl) {
      pagesSearch = pagesSearchEl.value || '';
      renderStudio();
      var searchAgain = overlay && overlay.querySelector('[data-v5-pages-search]');
      if (searchAgain) {
        searchAgain.focus();
        try { searchAgain.setSelectionRange(searchAgain.value.length, searchAgain.value.length); } catch (error) {}
      }
      return;
    }

    var pageFieldEl = event.target.closest('[data-v5-page-field]');
    if (pageFieldEl) {
      var statePageField = readState();
      var targetPageId = pageFieldEl.dataset.v5PageId;
      var keyPageField = pageFieldEl.dataset.v5PageField;
      var pageToUpdate = (statePageField.pages || []).find(function (item) { return item.id === targetPageId; });
      if (!pageToUpdate) return;
      if (keyPageField === 'parentId') {
        if (!setPageParent(statePageField, targetPageId, pageFieldEl.value)) return;
      } else {
        pageToUpdate[keyPageField] = pageFieldEl.value;
        pageToUpdate.updatedAt = new Date().toISOString();
      }
      writeState(statePageField);
      if (event.type === 'change') {
        activeTab = 'pages';
        renderStudio();
      }
      return;
    }

    var menuItemFieldEl = event.target.closest('[data-v5-menu-item-field]');
    if (menuItemFieldEl) {
      var stateMenuItem = readState();
      ensureMenuGroups(stateMenuItem);
      var groupIdItem = menuItemFieldEl.dataset.v5MenuGroupId;
      var itemId = menuItemFieldEl.dataset.v5MenuItemId;
      var keyItem = menuItemFieldEl.dataset.v5MenuItemField;
      var groupItem = (stateMenuItem.menuGroups || []).find(function (group) { return group.id === groupIdItem; });
      if (!groupItem) return;
      var itemToUpdate = (groupItem.items || []).find(function (item) { return item.id === itemId; });
      if (!itemToUpdate) return;
      itemToUpdate[keyItem] = menuItemFieldEl.value;
      if (keyItem === 'type') {
        if (itemToUpdate.type === 'page') itemToUpdate.url = '';
        if (itemToUpdate.type === 'external' || itemToUpdate.type === 'social') itemToUpdate.pageId = '';
        if (itemToUpdate.type === 'social' && (!itemToUpdate.label || itemToUpdate.label === 'External link' || itemToUpdate.label === 'Внешняя ссылка')) itemToUpdate.label = t('Social link', 'Соцссылка');
      }
      if (keyItem === 'pageId') {
        var targetPageForItem = (stateMenuItem.pages || []).find(function (candidate) { return candidate.id === menuItemFieldEl.value; });
        if (targetPageForItem) itemToUpdate.label = pageLabel(targetPageForItem);
      }
      writeState(stateMenuItem);
      return;
    }

    var menuGroupFieldEl = event.target.closest('[data-v5-menu-group-field]');
    if (menuGroupFieldEl) {
      var stateMenuGroup = readState();
      ensureMenuGroups(stateMenuGroup);
      var groupId = menuGroupFieldEl.dataset.v5MenuGroupId;
      var keyGroup = menuGroupFieldEl.dataset.v5MenuGroupField;
      var group = stateMenuGroup.menuGroups.find(function (item) { return item.id === groupId; });
      if (!group) return;
      group[keyGroup] = menuGroupFieldEl.value;
      writeState(stateMenuGroup);
      return;
    }

    var menuFieldEl = event.target.closest('[data-v5-menu-field]');
    if (menuFieldEl) {
      var stateMenu = readState();
      var pageId = menuFieldEl.dataset.v5PageId;
      var keyMenu = menuFieldEl.dataset.v5MenuField;
      var targetPage = (stateMenu.pages || []).find(function (item) { return item.id === pageId; });
      if (!targetPage) return;
      targetPage[keyMenu] = menuFieldEl.type === 'checkbox' ? !!menuFieldEl.checked : menuFieldEl.value;
      targetPage.updatedAt = new Date().toISOString();
      writeState(stateMenu);
      return;
    }

    var publishFieldEl = event.target.closest('[data-v5-publish-field]');
    if (publishFieldEl) {
      var statePublishField = readState();
      statePublishField.site.publishSettings = normalizePublishSettings(statePublishField.site.publishSettings);
      var publishProviderId = publishFieldEl.dataset.v5PublishProvider || statePublishField.site.publishSettings.selectedProvider || 'manual';
      var publishKey = publishFieldEl.dataset.v5PublishField;
      if (!statePublishField.site.publishSettings.providers[publishProviderId]) statePublishField.site.publishSettings.providers[publishProviderId] = defaultPublishProviderConfig(publishProviderId);
      var liveConfig = statePublishField.site.publishSettings.providers[publishProviderId];

      if (isPublishSecretField(publishKey)) {
        // v7g4 step4B-2: do not save or clear secrets while the user is typing/pasting.
        // The encrypted save happens in saveAllFromDom() when Save/Test/Publish is clicked.
        liveConfig.enabled = false;
        liveConfig.lastStatus = t('Unsaved local secret changes', 'Несохранённые локальные изменения секрета');
        liveConfig.lastResult = 'info';
        writeState(statePublishField);
        return;
      }
      liveConfig[publishKey] = publishFieldEl.value;
      liveConfig.enabled = false;
      liveConfig.lastStatus = t('Unsaved local changes', 'Несохранённые локальные изменения');
      liveConfig.lastResult = 'info';
      writeState(statePublishField);
      return;
    }

    var fieldEl = event.target.closest('[data-v5-field]');
    var siteEl = event.target.closest('[data-v5-site-field]');
    if (fieldEl) {
      var key = fieldEl.dataset.v5Field;
      var value = fieldEl.type === 'checkbox' ? !!fieldEl.checked : fieldEl.value;
      var state = readState();
      var page = activePage(state);
      var previousPageName = page.pageName || page.title || '';
      var previousSlug = page.slug || '';
      if (key === 'slug') value = ensureUniqueSlug(state, value, page.id);
      if (key === 'pageName') {
        page.pageName = value;
        page.title = value;
        if (!previousSlug || previousSlug === slugify(previousPageName)) page.slug = ensureUniqueSlug(state, value || 'page', page.id);
      } else if (key === 'footerGroup') {
        page.footerGroup = normalizeFooterGroup(value, page);
      } else if (key === 'inFooter') {
        page.inFooter = !!value;
        page.footerGroup = normalizeFooterGroup(page.footerGroup, page);
        page.inMenu = page.inFooter ? false : true;
        if (page.inFooter) page.parentId = '';
      } else {
        page[key] = value;
      }
      page.updatedAt = new Date().toISOString();
      writeState(state);
      return;
    }
    if (siteEl) {
      var state2 = readState();
      var key2 = siteEl.dataset.v5SiteField;
      var siteValue = siteEl.value;

      var previousLogoLettersV084U = normalizeLooseLogoLettersV069E(
        state2.site.logoLetters || ''
      ).slice(0, 3);

      var previousFaviconLettersV084U = normalizeLooseLogoLettersV069E(
        state2.site.faviconLetters ||
        state2.site.faviconText ||
        state2.site.faviconSymbol ||
        state2.site.faviconIcon ||
        ''
      ).slice(0, 2);

      var faviconWasFollowingLogoV084U =
        !previousFaviconLettersV084U ||
        previousFaviconLettersV084U === previousLogoLettersV084U.slice(0, 2);

      if (key2 === 'logoLetters' || key2 === 'faviconLetters' || key2 === 'faviconSymbol' || key2 === 'faviconText' || key2 === 'faviconIcon' || key2 === 'icon') {
        var maxLettersV073B = key2 === 'logoLetters' ? 3 : 2;
        siteValue = String(siteValue || '').toUpperCase().replace(/[^0-9A-ZА-ЯЁ]/gi, '').slice(0, maxLettersV073B);
        if (siteEl.value !== siteValue) siteEl.value = siteValue;
      }

      state2.site[key2] = siteValue;

      if (key2 === 'faviconLetters') {
        state2.site.faviconSymbol = siteValue;
        state2.site.faviconText = siteValue;
        state2.site.faviconIcon = siteValue;
      }

      if (key2 === 'logoLetters' && faviconWasFollowingLogoV084U) {
        state2.site.faviconLetters = '';
        state2.site.faviconSymbol = '';
        state2.site.faviconText = '';
        state2.site.faviconIcon = '';

        var liveFaviconFieldV084U = overlay && overlay.querySelector(
          '[data-v5-site-field="faviconLetters"]'
        );

        if (liveFaviconFieldV084U) {
          liveFaviconFieldV084U.value =
            normalizeLooseLogoLettersV069E(siteValue).slice(0, 2);
        }
      }

      writeState(state2);
      if (/(accentColor|backgroundColor|textColor|logoBackgroundColor|logoTextColor|faviconBackgroundColor|faviconTextColor|menuColor|buttonColor)/.test(key2)) {
        var colorFallback = key2 === 'textColor' ? '#101827' : (key2 === 'logoTextColor' ? '#ffffff' : (key2 === 'backgroundColor' ? '#ffffff' : '#2f7be6'));
        var colorValue = normalizeHexColor(siteEl.value, colorFallback);
        overlay.querySelectorAll('[data-v5-site-field="' + key2 + '"]').forEach(function (linked) {
          if (linked === siteEl) return;
          if (linked.type === 'color') linked.value = colorValue;
          if (linked.classList && linked.classList.contains('ir-site-studio-v5-color-text')) linked.value = siteEl.value;
        });
        var row = siteEl.closest('.ir-site-studio-v5-color-row');
        var chip = row && row.querySelector('.ir-site-studio-v5-color-chip');
        if (chip) chip.style.background = colorValue;
      }
      if (/(name|icon|logoLetters|faviconLetters|faviconSymbol|faviconText|faviconIcon|logoShape|faviconShape|logoBackgroundColor|logoTextColor|faviconBackgroundColor|faviconTextColor|logoFont|faviconFont|logoWeight|faviconWeight|logoHeaderSize)/.test(key2)) {
        updateIdentityLogoPreview(state2.site);
      }
      if (key2 === 'logoShape' || key2 === 'faviconShape') {
        activeTab = 'identity';
        renderStudio();
      }
    }
  }

  function handleOverlayKeydown(event) {
    var target = event && event.target;
    if (!target || !target.closest) return;
    if (target.closest('input, textarea, select, [contenteditable="true"]')) {
      // IRGEZTNE_WEBSTUDIO_STABILITY_CORE_V074A
      // Let the field receive the keystroke, but keep app-level shortcuts/listeners away.
      if (event.key !== 'Escape' && typeof event.stopPropagation === 'function') event.stopPropagation();
    }
  }

  /* IRGEZTNE_WEBSTUDIO_SAFE_WRITING_BOUNDARIES_V074B */
  function editorPlainTextFromHtmlV074B(html) {
    var value = sanitizeHtml(String(html || ''))
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<li\b[^>]*>/gi, '• ')
      .replace(/<\/(p|div|section|article|header|footer|h1|h2|h3|h4|h5|h6|blockquote|li|ul|ol|tr)>/gi, '\n')
      .replace(/<\/(table|thead|tbody|tfoot)>/gi, '\n');
    var box = document.createElement('div');
    box.innerHTML = value;
    return String(box.textContent || box.innerText || '')
      .replace(/\u00a0/g, ' ')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  /* IRGEZTNE_EDITOR_LITE_PRO_FOUNDATION_V075A */
  function editorSafeUrlV075A(url) {
    var value = String(url || '').trim();
    if (!value) return '#';
    if (/^(https?:\/\/|mailto:|tel:|\/|#)/i.test(value)) return escapeHtml(value);
    return '#';
  }

  function editorInlineHtmlV075A(text) {
    var value = escapeHtml(String(text || ''));

    value = value.replace(/\[\[color:([#a-zA-Z0-9(),.%\s-]+)\]\]([\s\S]*?)\[\[\/color\]\]/g, function (_, color, body) {
      return '<span style="color:' + escapeHtml(color.trim()) + '">' + body + '</span>';
    });

    value = value.replace(/\[\[mark:([#a-zA-Z0-9(),.%\s-]+)\]\]([\s\S]*?)\[\[\/mark\]\]/g, function (_, color, body) {
      return '<mark style="background:' + escapeHtml(color.trim()) + '">' + body + '</mark>';
    });

    value = value.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
    value = value.replace(/\+\+([^+\n]+)\+\+/g, '<u>$1</u>');
    value = value.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
    value = value.replace(/`([^`\n]+)`/g, '<code>$1</code>');

    value = value.replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, function (_, label, url) {
      return '<a href="' + editorSafeUrlV075A(url) + '">' + label + '</a>';
    });

    return value;
  }

  function editorHtmlFromPlainTextV074B(text) {
    var raw = String(text || '').replace(/\r\n?/g, '\n').trim();
    if (!raw) return '';

    function renderParagraph(lines) {
      return '<p>' + lines.map(editorInlineHtmlV075A).join('<br>') + '</p>';
    }

    function renderList(lines, ordered) {
      var tag = ordered ? 'ol' : 'ul';
      return '<' + tag + '>' + lines.map(function (line) {
        var item = ordered ? line.replace(/^\s*\d+\.\s+/, '') : line.replace(/^\s*[-•]\s+/, '');
        return '<li>' + editorInlineHtmlV075A(item) + '</li>';
      }).join('') + '</' + tag + '>';
    }

    return raw.split(/\n{2,}/).map(function (block) {
      var trimmed = block.trim();
      var lines = trimmed.split('\n');

      if (/^-{3,}$/.test(trimmed)) return '<hr>';

      var image = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
      if (image) {
        return '<figure class="ir-site-studio-v5-content-image"><img src="' + editorSafeUrlV075A(image[2]) + '" alt="' + escapeHtml(image[1] || '') + '">' + (image[1] ? '<figcaption>' + escapeHtml(image[1]) + '</figcaption>' : '') + '</figure>';
      }

      var video = trimmed.match(/^\[\[video:([^\]]+)\]\]$/) || trimmed.match(/^\[video\]\(([^)]+)\)$/);
      if (video) {
        return '<figure class="ir-site-studio-v5-content-video"><iframe src="' + editorSafeUrlV075A(video[1]) + '" loading="lazy" allowfullscreen></iframe></figure>';
      }

      if (/^###\s+/.test(trimmed)) return '<h3>' + editorInlineHtmlV075A(trimmed.replace(/^###\s+/, '')) + '</h3>';
      if (/^##\s+/.test(trimmed)) return '<h2>' + editorInlineHtmlV075A(trimmed.replace(/^##\s+/, '')) + '</h2>';
      if (/^#\s+/.test(trimmed)) return '<h1>' + editorInlineHtmlV075A(trimmed.replace(/^#\s+/, '')) + '</h1>';

      if (lines.every(function (line) { return /^\s*[-•]\s+/.test(line); })) return renderList(lines, false);
      if (lines.every(function (line) { return /^\s*\d+\.\s+/.test(line); })) return renderList(lines, true);

      if (lines.every(function (line) { return /^\s*>\s?/.test(line); })) {
        return '<blockquote>' + lines.map(function (line) {
          return editorInlineHtmlV075A(line.replace(/^\s*>\s?/, ''));
        }).join('<br>') + '</blockquote>';
      }

      return renderParagraph(lines);
    }).join('');
  }

  function handleOverlayKeyup(event) {
    if (isEditorCoreEventTarget(event)) return;
    if (event.target && event.target.matches && event.target.matches('[data-v5-content="1"]')) saveContentFromDom();
    if (event.key === 'Escape') { if (overlay && overlay.querySelector && overlay.querySelector('.ir-site-studio-v5-native-popover[open]')) { closeNativeEditorPopovers(); return; } closeStudio(); }
  }

  function scheduleEditorCoreBridgeSave() {
    // IRGEZTNE_WEBSTUDIO_EDITOR_CORE_BRIDGE_V065E
    clearTimeout(siteEditorCoreSaveTimer);
    siteEditorCoreSaveTimer = window.setTimeout(function () {
      siteEditorCoreSaveTimer = null;
      saveContentFromDom();
    }, 180);
  }

  function mountPageJodit(page) {

    // IRGEZTNE_V077A_EDITOR_RESET_ONE_ENGINE
    if (!overlay || !page) return;

    var host = overlay.querySelector('[data-v5-jodit-host="1"]');
    var textarea = overlay.querySelector('[data-v5-jodit-textarea="1"]');
    var hint = overlay.querySelector('[data-v5-jodit-hint="1"]');
    if (!host || !textarea) return;

    try { destroySiteJodit(); } catch (error0) { log('Editor reset: old Jodit/Core destroy failed', error0); }
    try { if (typeof destroyTinyMCEEditorV076A === 'function') destroyTinyMCEEditorV076A(); } catch (error1) { log('Editor reset: old TinyMCE destroy failed', error1); }

    siteEditorCoreBridge = null;
    siteJodit = null;
    siteJoditPageId = page.id;

    Array.prototype.slice.call(host.querySelectorAll(
      '[data-v5-editor-visual-surface="1"], ' +
      '[data-v5-safe-writing-textarea="1"], ' +
      '.ir-editor-core-webstudio-bridge, ' +
      '.ir-editor-core-webstudio-surface, ' +
      '.ir-editor-toolbar, ' +
      '.jodit-container, .jodit, .tox-tinymce'
    )).forEach(function (node) {
      try { if (node && node.parentNode) node.parentNode.removeChild(node); } catch (error) {}
    });

    host.classList.remove(
      'is-editor-lite-visual-ready-v075b',
      'is-safe-writing-ready-v074b',
      'is-jodit-ready',
      'is-editor-core-ready',
      'is-tinymce-engine-loading-v076a',
      'is-tinymce-engine-ready-v076a'
    );
    host.classList.add('is-editor-next-reset-v077a');

    textarea.style.display = '';
    textarea.hidden = false;
    textarea.classList.remove('is-fallback');
    textarea.value = sanitizeHtml(page.bodyHtml || textarea.value || '');
    textarea.id = textarea.id || ('ir-webstudio-editor-next-' + String(page.id || 'page').replace(/[^a-z0-9_-]/gi, '-'));

    if (hint) {
      hint.hidden = true;
      hint.textContent = '';
    }

    if (typeof mountTinyMCEEditorV076A === 'function' && mountTinyMCEEditorV076A(page, host, textarea, hint)) return;

    host.classList.add('is-editor-next-textarea-fallback-v077a');
    textarea.addEventListener('input', saveContentFromDom);
    textarea.addEventListener('blur', saveContentFromDom);
  }

  function looksLikeAppShellHtml(html) {
    var value = String(html || '').toLowerCase();
    return value.indexOf('browser shell') !== -1 ||
      value.indexOf('browser-webview') !== -1 ||
      value.indexOf('webview') !== -1 ||
      value.indexOf('google') !== -1 ||
      value.indexOf('data-tab-id') !== -1 ||
      value.indexOf('workspace-shell') !== -1 ||
      value.indexOf('cabinet-tile') !== -1 ||
      value.indexOf('data-open-section') !== -1;
  }

  /* IRGEZTNE_EDITOR_LITE_PRO_VISUAL_SURFACE_V075B */
  function saveContentFromDom() {
    if (!overlay) return;

    var html = '';
    var sourceTextV075A = null;

    var visualSurfaceV075B = overlay.querySelector('[data-v5-editor-visual-surface="1"]');
    if (visualSurfaceV075B) {
      html = visualSurfaceV075B.innerHTML || '';
      var visualSourceV075B = overlay.querySelector('[data-v5-jodit-textarea="1"]');
      if (visualSourceV075B) visualSourceV075B.value = html;
    } else {
      var safeTextAreaV074B = overlay.querySelector('[data-v5-safe-writing-textarea="1"]');
      if (safeTextAreaV074B) {
        sourceTextV075A = safeTextAreaV074B.value || '';
        html = editorHtmlFromPlainTextV074B(sourceTextV075A);
        var safeSourceV074B = overlay.querySelector('[data-v5-jodit-textarea="1"]');
        if (safeSourceV074B) safeSourceV074B.value = html;
      } else if (siteEditorCoreBridge && typeof siteEditorCoreBridge.getHtml === 'function') {
        html = siteEditorCoreBridge.getHtml();
      } else if (siteJodit && typeof siteJodit.value === 'string') {
        html = siteJodit.value;
      } else {
        var textarea = overlay.querySelector('[data-v5-jodit-textarea="1"]');
        var content = overlay.querySelector('[data-v5-content="1"]');
        if (textarea) html = textarea.value;
        else if (content) html = content.innerHTML;
        else return;
      }
    }

    html = sanitizeHtml(html);
    if (looksLikeAppShellHtml(html)) return;

    var updatePayloadV075B = { bodyHtml: html };
    if (sourceTextV075A != null) updatePayloadV075B.bodySourceV075A = sourceTextV075A;
    updateActivePage(updatePayloadV075B, false);
  }

  function saveAllFromDom(rerender) {
    if (!overlay) return;
    saveContentFromDom();
    var state = readState();
    var page = activePage(state);
    overlay.querySelectorAll('[data-v5-field]').forEach(function (fieldEl) {
      var key = fieldEl.dataset.v5Field;
      var value = fieldEl.type === 'checkbox' ? !!fieldEl.checked : fieldEl.value;
      if (key === 'slug') value = ensureUniqueSlug(state, value, page.id);
      if (key === 'pageName') {
        page.pageName = value;
        page.title = value;
      } else if (key === 'footerGroup') {
        page.footerGroup = normalizeFooterGroup(value, page);
      } else if (key === 'inFooter') {
        page.inFooter = !!value;
        page.footerGroup = normalizeFooterGroup(page.footerGroup, page);
        page.inMenu = page.inFooter ? false : true;
        if (page.inFooter) page.parentId = '';
      } else {
        page[key] = value;
      }
    });
    overlay.querySelectorAll('[data-v5-site-field]').forEach(function (siteEl) {
      var siteKey = siteEl.dataset.v5SiteField;
      var nextSiteValue = siteEl.value;
      if (siteKey === 'logoLetters' || siteKey === 'faviconLetters' || siteKey === 'faviconSymbol' || siteKey === 'faviconText' || siteKey === 'faviconIcon' || siteKey === 'icon') nextSiteValue = String(nextSiteValue || '').toUpperCase().replace(/[^0-9A-ZА-ЯЁ]/gi, '').slice(0, siteKey === 'logoLetters' ? 3 : 2);
      state.site[siteKey] = nextSiteValue;
    });
    state.site.publishSettings = normalizePublishSettings(state.site.publishSettings);
    overlay.querySelectorAll('[data-v5-publish-field]').forEach(function (publishEl) {
      var publishProviderId = publishEl.dataset.v5PublishProvider || state.site.publishSettings.selectedProvider || 'manual';
      var publishKey = publishEl.dataset.v5PublishField;
      if (!publishKey) return;
      if (!state.site.publishSettings.providers[publishProviderId]) state.site.publishSettings.providers[publishProviderId] = defaultPublishProviderConfig(publishProviderId);
      var publishConfig = state.site.publishSettings.providers[publishProviderId];
      var nextValue = publishEl.value;
      if (isPublishSecretField(publishKey)) {
        var secretChanged = savePublishSecretValue(state, publishProviderId, publishConfig, publishKey, nextValue);
        if (secretChanged) {
          publishEl.value = '';
          publishConfig.enabled = false;
          publishConfig.lastStatus = t('Unsaved local secret changes', 'Несохранённые локальные изменения секрета');
          publishConfig.lastResult = 'info';
        }
        return;
      }
      var previousValue = publishConfig[publishKey] == null ? '' : String(publishConfig[publishKey]);
      var changed = previousValue !== String(nextValue == null ? '' : nextValue);
      publishConfig[publishKey] = nextValue;
      if (changed) {
        publishConfig.enabled = false;
        publishConfig.lastStatus = t('Unsaved local changes', 'Несохранённые локальные изменения');
        publishConfig.lastResult = 'info';
      }
    });
    page.updatedAt = new Date().toISOString();
    writeState(state);
    if (rerender !== false) renderStudio();
  }

  function generateLogoLetters() {
    var state = readState();
    state.site.logoLetters = normalizeLogoLetters(initialsFromName(state.site.name || 'Project Studio'), state.site.name || 'Project Studio');
    if (!state.site.faviconLetters) state.site.faviconLetters = state.site.logoLetters;
    writeState(state);
    activeTab = 'identity';
    renderStudio();
  }

  function boot() {
    document.addEventListener('click', function (event) {
      var trigger = event.target && event.target.closest ? event.target.closest('[data-action="open-site-studio-safe-v5"], [data-action="open-site-studio-safe-v4"], [data-ir-site-studio-v5-open="1"], [data-ir-site-studio-v4-open="1"]') : null;
      if (!trigger) return;
      event.preventDefault();
      event.stopPropagation();
      openStudio();
    }, true);
    ensureLauncher();
    setInterval(ensureLauncher, 1000);
    var observer = new MutationObserver(function () { ensureLauncher(); });
    observer.observe(document.documentElement || document.body, { childList: true, subtree: true });
    window.IRGEZTNESiteStudioSafeV5 = {
      open: openStudio,
      openTab: openStudioTab,
      readState: readState,
      reset: resetTestСтраницы,
      version: VERSION
    };
    log('loaded');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();

// 1.0.0 v5 exit/back safe

/* IRGEZTNE_TEMPLATE_PREVIEW_PICKER_V070A */
(function () {
  if (window.__IRGEZTNE_TEMPLATE_PREVIEW_PICKER_V070A__) return;
  window.__IRGEZTNE_TEMPLATE_PREVIEW_PICKER_V070A__ = true;

  var templates = [
    {
      value: 'blog-news',
      path: 'template-lab/blog-news/index.html',
      title: 'Blog / News',
      titleRu: 'Blog / News',
      desc: 'Editorial layout for news, magazine and publishing sites.',
      descRu: 'Редакционный шаблон для новостей, журнала и публикаций.'
    },
    {
      value: 'business-product',
      path: 'template-lab/business-product/index.html',
      title: 'Business / Product',
      titleRu: 'Business / Product',
      desc: 'Company, product or service page with clear trust and CTA blocks.',
      descRu: 'Страница компании, продукта или услуги с блоками доверия и действия.'
    },
    {
      value: 'documentation-wide',
      altValues: ['knowledge-base'],
      path: 'template-lab/documentation/index.html',
      title: 'Documentation',
      titleRu: 'Документация',
      desc: 'Docs, help center, API guide and changelog-style pages.',
      descRu: 'Документация, help center, API-разделы и страницы справки.'
    },
    {
      value: 'project-landing',
      path: 'template-lab/landing-product/index.html',
      title: 'Landing / Product',
      titleRu: 'Landing / Product',
      desc: 'One-page product or app landing with strong first screen.',
      descRu: 'Одностраничный лендинг продукта или приложения с сильным первым экраном.'
    },
    {
      value: 'studio-portfolio',
      path: 'template-lab/portfolio-personal/index.html',
      title: 'Portfolio / Personal',
      titleRu: 'Portfolio / Personal',
      desc: 'Personal or studio portfolio with selected works and contact block.',
      descRu: 'Портфолио автора или студии с работами и понятным контактом.'
    },
    {
      value: 'agency-studio',
      path: 'template-lab/agency-studio/index.html',
      title: 'Agency / Studio',
      titleRu: 'Agency / Studio',
      desc: 'Agency website with services, cases, process and request CTA.',
      descRu: 'Сайт агентства: услуги, кейсы, процесс и заявка на проект.'
    }
  ];

  function isRu() {
    var htmlLang = (document.documentElement.getAttribute('lang') || '').toLowerCase();
    if (htmlLang.indexOf('ru') === 0) return true;
    try {
      var text = document.body ? document.body.innerText || '' : '';
      return /Студия сайта|Сайты|Шаблон|Создать сайт/.test(text);
    } catch (_) {}
    return false;
  }

  function label(en, ru) { return isRu() ? (ru || en) : en; }

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
    });
  }

  function currentSelect() {
    return document.querySelector('[data-v5-site-manager-field="template"]');
  }

  function normalizeOptionLabel(item) {
    return isRu() ? item.titleRu : item.title;
  }

  function ensureOfficialOptions(select) {
    if (!select) return;
    var oldValue = select.value || 'project-landing';
    var allowed = {};
    templates.forEach(function (item) {
      allowed[item.value] = true;
      (item.altValues || []).forEach(function (v) { allowed[v] = true; });
    });

    var existing = Array.prototype.slice.call(select.options || []);
    var hasAnyOfficial = existing.some(function (opt) { return allowed[opt.value]; });
    if (!hasAnyOfficial || existing.length < 6) {
      select.innerHTML = templates.map(function (item) {
        return '<option value="' + esc(item.value) + '">' + esc(normalizeOptionLabel(item)) + '</option>';
      }).join('');
      select.value = allowed[oldValue] ? oldValue : 'project-landing';
      try { select.dispatchEvent(new Event('input', { bubbles: true })); } catch (_) {}
      return;
    }

    templates.forEach(function (item) {
      var hasValue = Array.prototype.some.call(select.options || [], function (opt) { return opt.value === item.value; });
      if (!hasValue) {
        var opt = document.createElement('option');
        opt.value = item.value;
        opt.textContent = normalizeOptionLabel(item);
        select.appendChild(opt);
      }
    });
  }

  function selectedTemplate() {
    var select = currentSelect();
    var value = select ? select.value : 'project-landing';
    var match = templates.find(function (item) {
      return item.value === value || (item.altValues || []).indexOf(value) !== -1;
    });
    return match || templates[3];
  }

  function makeEntryHtml() {
    var item = selectedTemplate();
    return '' +
      '<div class="ir-template-preview-entry-v070a" data-ir-template-preview-entry-v070a="1">' +
        '<button class="ir-site-studio-v5-btn ir-site-studio-v5-btn--sm" data-ir-template-preview-open-v070a="1" type="button">' + esc(label('Preview template', 'Просмотр шаблона')) + '</button>' +
        '<span>' + esc(label('Opens a full template preview without changing the current site preview.', 'Открывает отдельный просмотр шаблона, не меняя предпросмотр сайта.')) + '</span>' +
      '</div>';
  }

  function injectEntry() {
    var select = currentSelect();
    if (!select) return;
    ensureOfficialOptions(select);
    var labelEl = select.closest('label') || select.parentElement;
    if (!labelEl || !labelEl.parentNode) return;
    if (document.querySelector('[data-ir-template-preview-entry-v070a]')) return;
    var box = document.createElement('div');
    box.innerHTML = makeEntryHtml();
    labelEl.parentNode.insertBefore(box.firstChild, labelEl.nextSibling);
  }

  function modalHtml(item) {
    var rows = templates.map(function (tpl) {
      var active = tpl.value === item.value || (tpl.altValues || []).indexOf(item.value) !== -1;
      return '<button class="ir-template-preview-item-v070a' + (active ? ' is-active' : '') + '" data-ir-template-preview-select-v070a="' + esc(tpl.value) + '" type="button">' +
          '<strong>' + esc(isRu() ? tpl.titleRu : tpl.title) + '</strong>' +
          '<span>' + esc(isRu() ? tpl.descRu : tpl.desc) + '</span>' +
        '</button>';
    }).join('');

    return '' +
      '<div class="ir-template-preview-modal-v070a" data-ir-template-preview-modal-v070a="1" role="dialog" aria-modal="true">' +
        '<div class="ir-template-preview-shell-v070a">' +
          '<header class="ir-template-preview-head-v070a">' +
            '<div><div class="ir-template-preview-kicker-v070a">IRGEZTNE Web Studio</div>' +
            '<h3>' + esc(label('Template preview', 'Просмотр шаблона')) + '</h3>' +
            '<p>' + esc(label('This is not the edited-site preview. It is a separate preview before choosing a template.', 'Это не предпросмотр редактируемого сайта. Это отдельный просмотр перед выбором шаблона.')) + '</p></div>' +
            '<div class="ir-template-preview-head-actions-v070a">' +
              '<button class="ir-site-studio-v5-btn ir-site-studio-v5-btn--sm" data-ir-template-preview-use-v070a="1" type="button">' + esc(label('Use in new site form', 'Выбрать в форме сайта')) + '</button>' +
              '<button class="ir-site-studio-v5-btn ir-site-studio-v5-btn--danger" data-ir-template-preview-close-v070a="1" type="button" aria-label="Close">×</button>' +
            '</div>' +
          '</header>' +
          '<div class="ir-template-preview-body-v070a">' +
            '<aside class="ir-template-preview-list-v070a">' + rows + '</aside>' +
            '<main class="ir-template-preview-frame-wrap-v070a">' +
              '<iframe class="ir-template-preview-frame-v070a" src="' + esc(item.path) + '" title="' + esc(item.title) + '"></iframe>' +
            '</main>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  function openModal(startItem) {
    closeModal();
    var item = startItem || selectedTemplate();
    var holder = document.createElement('div');
    holder.innerHTML = modalHtml(item);
    document.body.appendChild(holder.firstChild);
  }

  function closeModal() {
    var modal = document.querySelector('[data-ir-template-preview-modal-v070a]');
    if (modal) modal.remove();
  }

  function setModalTemplate(value) {
    var item = templates.find(function (tpl) { return tpl.value === value; }) || templates[3];
    var modal = document.querySelector('[data-ir-template-preview-modal-v070a]');
    if (!modal) return;
    modal.querySelectorAll('[data-ir-template-preview-select-v070a]').forEach(function (btn) {
      btn.classList.toggle('is-active', btn.getAttribute('data-ir-template-preview-select-v070a') === item.value);
    });
    var frame = modal.querySelector('.ir-template-preview-frame-v070a');
    if (frame) frame.src = item.path;
    modal.__irgeztneCurrentTemplate = item.value;
  }

  function useTemplateFromModal() {
    var modal = document.querySelector('[data-ir-template-preview-modal-v070a]');
    var value = modal && modal.__irgeztneCurrentTemplate ? modal.__irgeztneCurrentTemplate : selectedTemplate().value;
    var select = currentSelect();
    if (select) {
      ensureOfficialOptions(select);
      select.value = value;
      try { select.dispatchEvent(new Event('input', { bubbles: true })); } catch (_) {}
      try { select.dispatchEvent(new Event('change', { bubbles: true })); } catch (_) {}
    }
    closeModal();
  }

  document.addEventListener('click', function (event) {
    var open = event.target.closest && event.target.closest('[data-ir-template-preview-open-v070a]');
    if (open) {
      event.preventDefault();
      event.stopPropagation();
      openModal(selectedTemplate());
      return;
    }
    var close = event.target.closest && event.target.closest('[data-ir-template-preview-close-v070a]');
    if (close) {
      event.preventDefault();
      closeModal();
      return;
    }
    var select = event.target.closest && event.target.closest('[data-ir-template-preview-select-v070a]');
    if (select) {
      event.preventDefault();
      setModalTemplate(select.getAttribute('data-ir-template-preview-select-v070a'));
      return;
    }
    var use = event.target.closest && event.target.closest('[data-ir-template-preview-use-v070a]');
    if (use) {
      event.preventDefault();
      useTemplateFromModal();
      return;
    }
  }, true);

  document.addEventListener('input', function (event) {
    if (event.target && event.target.matches && event.target.matches('[data-v5-site-manager-field="template"]')) {
      var entry = document.querySelector('[data-ir-template-preview-entry-v070a]');
      if (entry) {
        var button = entry.querySelector('[data-ir-template-preview-open-v070a]');
        if (button) button.textContent = label('Preview template', 'Просмотр шаблона');
      }
    }
  }, true);

  var mo = new MutationObserver(function () { injectEntry(); });
  try { mo.observe(document.documentElement, { childList: true, subtree: true }); } catch (_) {}
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', injectEntry);
  else injectEntry();
})();

/* IRGEZTNE_TEMPLATE_PREVIEW_OPEN_FIX_V070B */
(function(){
  if (window.__IRGEZTNE_TEMPLATE_PREVIEW_OPEN_FIX_V070B__) return;
  window.__IRGEZTNE_TEMPLATE_PREVIEW_OPEN_FIX_V070B__ = true;

  var templates = [
    { value:'blog-news', path:'template-lab/blog-news/index.html', title:'Blog / News', titleRu:'Blog / News', desc:'Editorial preview for news and magazine sites.', descRu:'Редакционный просмотр для новостей и журнала.' },
    { value:'business-product', path:'template-lab/business-product/index.html', title:'Business / Product', titleRu:'Business / Product', desc:'Company, product or service page.', descRu:'Страница компании, продукта или услуги.' },
    { value:'documentation-wide', altValues:['knowledge-base','documentation'], path:'template-lab/documentation/index.html', title:'Documentation', titleRu:'Документация', desc:'Docs, help center and API guide.', descRu:'Документация, help center и API-разделы.' },
    { value:'project-landing', altValues:['landing-product'], path:'template-lab/landing-product/index.html', title:'Landing / Product', titleRu:'Landing / Product', desc:'One-page product landing.', descRu:'Одностраничный лендинг продукта.' },
    { value:'studio-portfolio', altValues:['portfolio-personal'], path:'template-lab/portfolio-personal/index.html', title:'Portfolio / Personal', titleRu:'Portfolio / Personal', desc:'Portfolio with works and contact block.', descRu:'Портфолио с работами и контактным блоком.' },
    { value:'agency-studio', path:'template-lab/agency-studio/index.html', title:'Agency / Studio', titleRu:'Agency / Studio', desc:'Agency site with services and cases.', descRu:'Сайт агентства с услугами и кейсами.' }
  ];

  function isRu(){
    var lang = (document.documentElement.getAttribute('lang') || '').toLowerCase();
    if (lang.indexOf('ru') === 0) return true;
    try { return /Создать сайт|Сайты|Шаблон|Просмотр шаблона|Настройки сайта/.test(document.body ? document.body.innerText || '' : ''); } catch(_){ return false; }
  }
  function t(en, ru){ return isRu() ? (ru || en) : en; }
  function esc(v){ return String(v == null ? '' : v).replace(/[&<>"']/g, function(ch){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[ch]; }); }

  function currentSelect(){
    return document.querySelector('[data-v5-site-manager-field="template"]') ||
           document.querySelector('select[name="template"]') ||
           Array.prototype.find.call(document.querySelectorAll('select'), function(sel){
             return /template|шаблон/i.test((sel.getAttribute('name')||'') + ' ' + (sel.getAttribute('aria-label')||'') + ' ' + (sel.closest('label') ? sel.closest('label').innerText : ''));
           });
  }

  function templateByValue(value){
    return templates.find(function(item){
      return item.value === value || (item.altValues || []).indexOf(value) !== -1;
    }) || templates[3];
  }

  function selectedTemplate(){
    var sel = currentSelect();
    return templateByValue(sel ? sel.value : 'project-landing');
  }

  function fileCandidates(path){
    var result = [];
    function add(v){ if (v && result.indexOf(v) === -1) result.push(v); }
    try {
      if (window.process && window.process.cwd) {
        add('file://' + window.process.cwd().replace(/\\/g, '/') + '/' + path);
      }
    } catch(_) {}
    add(path);
    add('./' + path);
    add('/' + path);
    add('../' + path);
    add('../../' + path);
    return result;
  }

  function frameSrc(path){
    return fileCandidates(path)[0];
  }

  function rows(activeValue){
    return templates.map(function(item){
      var active = item.value === activeValue || (item.altValues || []).indexOf(activeValue) !== -1;
      return '<button type="button" class="ir-template-preview-item-v070b' + (active ? ' is-active' : '') + '" data-ir-template-preview-select-v070b="' + esc(item.value) + '">' +
        '<strong>' + esc(isRu() ? item.titleRu : item.title) + '</strong>' +
        '<span>' + esc(isRu() ? item.descRu : item.desc) + '</span>' +
      '</button>';
    }).join('');
  }

  function closeModal(){
    document.querySelectorAll('[data-ir-template-preview-modal-v070b]').forEach(function(m){ m.remove(); });
  }

  function openModal(start){
    var item = start || selectedTemplate();
    closeModal();
    var html = '' +
      '<div class="ir-template-preview-modal-v070b" data-ir-template-preview-modal-v070b="1" role="dialog" aria-modal="true">' +
        '<div class="ir-template-preview-shell-v070b">' +
          '<header class="ir-template-preview-head-v070b">' +
            '<div><div class="ir-template-preview-kicker-v070b">IRGEZTNE Web Studio</div>' +
            '<h3>' + esc(t('Template preview','Просмотр шаблона')) + '</h3>' +
            '<p>' + esc(t('Separate template preview. It does not replace the current site preview.','Отдельный просмотр шаблона. Он не заменяет предпросмотр текущего сайта.')) + '</p></div>' +
            '<div class="ir-template-preview-head-actions-v070b">' +
              '<button class="ir-template-preview-use-v070b" data-ir-template-preview-use-v070b="1" type="button">' + esc(t('Choose this template','Выбрать шаблон')) + '</button>' +
              '<button class="ir-template-preview-close-v070b" data-ir-template-preview-close-v070b="1" type="button" aria-label="Close">×</button>' +
            '</div>' +
          '</header>' +
          '<div class="ir-template-preview-body-v070b">' +
            '<aside class="ir-template-preview-list-v070b">' + rows(item.value) + '</aside>' +
            '<main class="ir-template-preview-frame-wrap-v070b">' +
              '<iframe class="ir-template-preview-frame-v070b" data-ir-template-preview-frame-v070b="1" src="' + esc(frameSrc(item.path)) + '" title="' + esc(item.title) + '"></iframe>' +
            '</main>' +
          '</div>' +
        '</div>' +
      '</div>';
    var holder = document.createElement('div');
    holder.innerHTML = html;
    document.body.appendChild(holder.firstChild);
    var modal = document.querySelector('[data-ir-template-preview-modal-v070b]');
    if (modal) modal.__irCurrentTemplate = item.value;
  }

  function setModalTemplate(value){
    var item = templateByValue(value);
    var modal = document.querySelector('[data-ir-template-preview-modal-v070b]');
    if (!modal) return;
    modal.__irCurrentTemplate = item.value;
    modal.querySelectorAll('[data-ir-template-preview-select-v070b]').forEach(function(btn){
      btn.classList.toggle('is-active', btn.getAttribute('data-ir-template-preview-select-v070b') === item.value);
    });
    var frame = modal.querySelector('[data-ir-template-preview-frame-v070b]');
    if (frame) frame.src = frameSrc(item.path);
  }

  function chooseModalTemplate(){
    var modal = document.querySelector('[data-ir-template-preview-modal-v070b]');
    var value = modal && modal.__irCurrentTemplate ? modal.__irCurrentTemplate : selectedTemplate().value;
    var sel = currentSelect();
    if (sel) {
      var opt = Array.prototype.find.call(sel.options || [], function(o){ return o.value === value; });
      if (!opt) {
        opt = document.createElement('option');
        opt.value = value;
        opt.textContent = (templateByValue(value) || {}).title || value;
        sel.appendChild(opt);
      }
      sel.value = value;
      try { sel.dispatchEvent(new Event('input', {bubbles:true})); } catch(_) {}
      try { sel.dispatchEvent(new Event('change', {bubbles:true})); } catch(_) {}
    }
    closeModal();
  }

  function looksLikeStrongAction(el){
    var text = (el.textContent || '').trim().toLowerCase();
    var meta = [el.getAttribute('aria-label')||'', el.getAttribute('title')||'', el.className||'', el.dataset ? Object.values(el.dataset).join(' ') : ''].join(' ').toLowerCase();
    var all = text + ' ' + meta;
    return /просмотр шаблона|preview template|template preview|настройки сайта|кабинет сайта|site settings/.test(all);
  }

  function strengthenButtons(){
    document.querySelectorAll('button,a,[role="button"]').forEach(function(el){
      if (!looksLikeStrongAction(el)) return;
      el.classList.add('ir-site-action-strong-v070b');
      if (/просмотр шаблона|preview template|template preview/.test(((el.textContent||'') + ' ' + (el.getAttribute('aria-label')||'')).toLowerCase())) {
        el.setAttribute('data-ir-template-preview-open-v070b','1');
        el.onclick = function(ev){
          try { ev.preventDefault(); ev.stopPropagation(); } catch(_) {}
          openModal(selectedTemplate());
          return false;
        };
      }
    });
  }

  function handle(ev){
    var target = ev.target && ev.target.closest ? ev.target : null;
    if (!target) return;
    var open = target.closest('[data-ir-template-preview-open-v070b],[data-ir-template-preview-open-v070a]');
    if (open) {
      ev.preventDefault(); ev.stopPropagation();
      openModal(selectedTemplate());
      return false;
    }
    var close = target.closest('[data-ir-template-preview-close-v070b]');
    if (close) { ev.preventDefault(); ev.stopPropagation(); closeModal(); return false; }
    var select = target.closest('[data-ir-template-preview-select-v070b]');
    if (select) { ev.preventDefault(); ev.stopPropagation(); setModalTemplate(select.getAttribute('data-ir-template-preview-select-v070b')); return false; }
    var use = target.closest('[data-ir-template-preview-use-v070b]');
    if (use) { ev.preventDefault(); ev.stopPropagation(); chooseModalTemplate(); return false; }
    var modal = target.closest('[data-ir-template-preview-modal-v070b]');
    if (modal && target === modal) { closeModal(); return false; }
  }

  document.addEventListener('click', handle, true);
  document.addEventListener('pointerup', handle, true);
  document.addEventListener('keydown', function(ev){ if (ev.key === 'Escape') closeModal(); }, true);

  var mo = new MutationObserver(function(){ strengthenButtons(); });
  try { mo.observe(document.documentElement, {childList:true, subtree:true}); } catch(_) {}
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', strengthenButtons);
  else strengthenButtons();
})();


/* IRGEZTNE_TEMPLATE_PREVIEW_HIDE_OLD_BUTTON_V070D
   The old inline "Просмотр шаблона" button was confusing and could stay alive
   after earlier patches. Hide only that old button; keep the gallery entry. */
(function irgeztneHideOldTemplatePreviewButtonV070D(){
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.__irgeztneHideOldTemplatePreviewButtonV070D) return;
  window.__irgeztneHideOldTemplatePreviewButtonV070D = true;

  const normalize = (value) => String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  const oldPreviewLabels = new Set([
    'просмотр шаблона',
    'просмотр шаблонов',
    'template preview',
    'view template',
    'preview template'
  ]);

  const isGalleryControl = (value) => {
    const v = normalize(value);
    return v.includes('галере') || v.includes('gallery') || v.includes('открыть галерею');
  };

  const looksLikeOldPreviewButton = (el) => {
    if (!el) return false;
    const text = normalize(el.textContent);
    const aria = normalize(el.getAttribute && el.getAttribute('aria-label'));
    const title = normalize(el.getAttribute && el.getAttribute('title'));
    const dataLabel = normalize(el.dataset ? Object.values(el.dataset).join(' ') : '');
    const cls = normalize(el.className || '');
    const all = [text, aria, title, dataLabel, cls].filter(Boolean).join(' ');

    if (isGalleryControl(all)) return false;
    if (oldPreviewLabels.has(text) || oldPreviewLabels.has(aria) || oldPreviewLabels.has(title)) return true;

    return (
      all.includes('template-preview') ||
      all.includes('template preview button') ||
      all.includes('preview-template')
    ) && !isGalleryControl(all);
  };

  const hideOldPreviewButtons = () => {
    const nodes = document.querySelectorAll('button, a, [role="button"], .template-preview-btn, .irgeztne-template-preview-btn');
    nodes.forEach((el) => {
      if (!looksLikeOldPreviewButton(el)) return;
      el.setAttribute('data-irgeztne-hidden-old-template-preview-v070d', '1');
      el.setAttribute('aria-hidden', 'true');
      el.tabIndex = -1;
      el.style.setProperty('display', 'none', 'important');
      el.style.setProperty('visibility', 'hidden', 'important');
      el.style.setProperty('pointer-events', 'none', 'important');
    });
  };

  const install = () => {
    hideOldPreviewButtons();
    try {
      const root = document.body || document.documentElement;
      const observer = new MutationObserver(() => hideOldPreviewButtons());
      observer.observe(root, { childList: true, subtree: true, characterData: true });
      window.__irgeztneHideOldTemplatePreviewObserverV070D = observer;
    } catch (_) {}
    window.setInterval(hideOldPreviewButtons, 900);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
})();



/* IRGEZTNE_V070E_HIDE_OLD_TEMPLATE_PREVIEW_HINT
   Removes the leftover explanatory strip from the old broken template-preview button.
   The correct entry is now the Template Gallery block. */
(() => {
  const PHRASES = [
    'Открывает отдельный просмотр шаблона, не меняя предпросмотр сайта.',
    'Открывает отдельный просмотр шаблона, не меняя предосмотр сайта.',
    'Открывает отдельный просмотр шаблона'
  ];

  function norm(value){
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function isOldHintText(text){
    const clean = norm(text);
    if (!clean) return false;
    return PHRASES.some((phrase) => clean === phrase || clean.includes(phrase));
  }

  function pickSmallWrapper(el){
    let target = el;
    for (let i = 0; i < 5 && target.parentElement; i += 1) {
      const currentText = norm(target.textContent);
      const parent = target.parentElement;
      const parentText = norm(parent.textContent);
      const parentLooksOnlyLikeHint = parentText === currentText && parent.children.length <= 4;
      if (!parentLooksOnlyLikeHint) break;
      target = parent;
    }
    return target;
  }

  function cleanupOldTemplatePreviewHintV070E(root){
    const scope = root && root.querySelectorAll ? root : document;
    const nodes = scope.querySelectorAll('button, a, div, p, span, small, label, section');

    nodes.forEach((el) => {
      if (el.dataset && el.dataset.irgV070eHidden === '1') return;
      const text = norm(el.textContent);
      if (!isOldHintText(text)) return;

      /* Do not hide big containers that only happen to contain the phrase together with a form. */
      if (text.length > 180) return;

      const target = pickSmallWrapper(el);
      if (target && target.style) {
        target.style.display = 'none';
        target.setAttribute('data-irg-v070e-hidden', '1');
      }
    });
  }

  function startCleanup(){
    cleanupOldTemplatePreviewHintV070E(document);
    setTimeout(() => cleanupOldTemplatePreviewHintV070E(document), 100);
    setTimeout(() => cleanupOldTemplatePreviewHintV070E(document), 500);
    setTimeout(() => cleanupOldTemplatePreviewHintV070E(document), 1200);

    try {
      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          mutation.addedNodes && mutation.addedNodes.forEach((node) => {
            if (node && node.nodeType === 1) cleanupOldTemplatePreviewHintV070E(node);
          });
        }
        cleanupOldTemplatePreviewHintV070E(document);
      });
      observer.observe(document.documentElement, { childList: true, subtree: true });
    } catch (_) {}
  }

  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    window.irgeztneCleanupOldTemplatePreviewHintV070E = cleanupOldTemplatePreviewHintV070E;
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', startCleanup, { once: true });
    } else {
      startCleanup();
    }
  }
})();
