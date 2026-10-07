'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const studioPath = path.join(root, 'src/modules/editor-site-studio-safe/editor-site-studio-safe-v5.js');
const workbenchHtmlPath = path.join(root, 'src/modules/editor-workbench/editor-workbench.html');
const workbenchJsPath = path.join(root, 'src/modules/editor-workbench/editor-workbench.js');
const officialTemplatesPath = path.join(root, 'src/preview4-official-templates-v1.js');
const mainPath = path.join(root, 'main.js');
const fullSource = fs.readFileSync(studioPath, 'utf8');
const workbenchHtmlSource = fs.readFileSync(workbenchHtmlPath, 'utf8');
const workbenchJsSource = fs.readFileSync(workbenchJsPath, 'utf8');
const officialTemplatesSource = fs.readFileSync(officialTemplatesPath, 'utf8');
const mainSource = fs.readFileSync(mainPath, 'utf8');
const firstIife = fullSource.split('// 1.0.0 v5 exit/back safe')[0];
const storage = new Map([['irgeztne.webStudio.lang.v1', 'en']]);
const documentElement = { getAttribute: (name) => name === 'lang' ? 'en' : '' };

function fakeCanvas() {
  const noop = () => {};
  return {
    width: 0,
    height: 0,
    getContext: () => ({
      clearRect: noop,
      beginPath: noop,
      moveTo: noop,
      arcTo: noop,
      closePath: noop,
      fill: noop,
      arc: noop,
      fillText: noop,
      set fillStyle(value) {},
      set textAlign(value) {},
      set textBaseline(value) {},
      set font(value) {}
    }),
    toDataURL: () => 'data:image/png;base64,iVBORw0KGgo='
  };
}

const document = {
  readyState: 'loading', documentElement, body: { innerText: '' }, addEventListener() {},
  createElement(tag) {
    if (tag === 'template') return { innerHTML: '', content: { querySelectorAll: () => [] } };
    if (tag === 'canvas') return fakeCanvas();
    return {};
  }
};
const window = { __IRGEZTNE_WEBSTUDIO_TEST__: true, addEventListener() {}, setTimeout, clearTimeout };
const context = {
  window, document,
  localStorage: {
    getItem: (key) => storage.has(key) ? storage.get(key) : null,
    setItem: (key, value) => storage.set(key, String(value))
  },
  console: { log() {}, warn() {}, error() {} }, URL, Blob, atob, btoa, setTimeout, clearTimeout,
  setInterval: () => 0, clearInterval() {},
  MutationObserver: class { observe() {} disconnect() {} }
};
window.window = window;
window.document = document;
window.localStorage = context.localStorage;
vm.runInNewContext(firstIife, context, { filename: studioPath });

const hooks = window.__IRGEZTNE_WEBSTUDIO_TEST_HOOKS__;
assert.ok(hooks, 'Web Studio public-page test hooks are available');
const templateIds = ['project-landing', 'business-product', 'blog-news', 'documentation-wide', 'studio-portfolio', 'agency-studio'];

function hooksForLanguage(lang) {
  const isolatedStorage = new Map([
    ['irgeztne.webStudio.lang.v1', lang]
  ]);
  const isolatedDocumentElement = {
    getAttribute: (name) => name === 'lang' ? lang : ''
  };
  const isolatedDocument = {
    readyState: 'loading',
    documentElement: isolatedDocumentElement,
    body: { innerText: '' },
    addEventListener() {},
    createElement(tag) {
      if (tag === 'template') return { innerHTML: '', content: { querySelectorAll: () => [] } };
      if (tag === 'canvas') return fakeCanvas();
      return {};
    }
  };
  const isolatedWindow = {
    __IRGEZTNE_WEBSTUDIO_TEST__: true,
    addEventListener() {},
    setTimeout,
    clearTimeout
  };
  const isolatedContext = {
    window: isolatedWindow,
    document: isolatedDocument,
    localStorage: {
      getItem: (key) => isolatedStorage.has(key) ? isolatedStorage.get(key) : null,
      setItem: (key, value) => isolatedStorage.set(key, String(value))
    },
    console: { log() {}, warn() {}, error() {} },
    URL,
    Blob,
    atob,
    btoa,
    setTimeout,
    clearTimeout,
    setInterval: () => 0,
    clearInterval() {},
    MutationObserver: class { observe() {} disconnect() {} }
  };

  isolatedWindow.window = isolatedWindow;
  isolatedWindow.document = isolatedDocument;
  isolatedWindow.localStorage = isolatedContext.localStorage;
  vm.runInNewContext(firstIife, isolatedContext, { filename: studioPath });
  return isolatedWindow.__IRGEZTNE_WEBSTUDIO_TEST_HOOKS__;
}

function testOfficialTemplateSelectionRoute() {
  const selectionKey = 'irgeztne.preview4.selectedOfficialTemplate.v1';
  const originalSelection = JSON.stringify({
    selectedAt: 'preserve',
    template: { id: 'project-landing' }
  });
  storage.set(selectionKey, originalSelection);

  const wideMarkers = {
    'project-landing': /landing-home-v086a/,
    'business-product': /Meridian/,
    'blog-news': /class="ticker"/,
    'documentation-wide': /docs-layout-v068d/,
    'studio-portfolio': /class="works-grid"/,
    'agency-studio': /class="focus-strip surface"/
  };

  for (const templateId of templateIds) {
    const selected = hooks.prepareOfficialTemplateSelection({ id: templateId });
    assert.ok(selected, `${templateId}: gallery selection is accepted`);
    assert.equal(selected.id, templateId, `${templateId}: selected template reaches the new-site draft`);
    assert.equal(selected.path, '', `${templateId}: gallery selection no longer installs a Template Lab preview owner`);

    const previewState = hooks.templatePreviewState(templateId);
    const previewHtml = hooks.templatePreviewHtml(templateId);
    assert.equal(previewState.site.activeTemplate, templateId, `${templateId}: canonical preview uses the selected product template`);
    assert.equal(previewState.site.templateSource, 'webstudio-official', `${templateId}: canonical preview records the Web Studio owner`);
    assert.equal(previewState.site.templateLabPath, '', `${templateId}: canonical preview has no active Template Lab path`);
    assert.match(previewHtml, wideMarkers[templateId], `${templateId}: gallery preview renders its wide product layout`);
    assert.doesNotMatch(previewHtml, /template-lab\/.+\/index\.html/, `${templateId}: canonical preview never embeds a legacy Template Lab page`);
  }

  assert.equal(
    storage.get(selectionKey),
    originalSelection,
    'rendering six gallery previews does not mutate the user template selection'
  );

  assert.equal(
    hooks.prepareOfficialTemplateSelection({ id: 'unknown-template' }),
    null,
    'unknown gallery template is not silently replaced'
  );
}

function testTemplateLanguageContract() {
  const ruHooks = hooksForLanguage('ru');
  const ruMarkers = {
    'project-landing': /Превратите первое впечатление/,
    'business-product': /Покажите продукт и услуги так/,
    'blog-news': /Независимый цифровой журнал|Northline/,
    'documentation-wide': /Документация/,
    'studio-portfolio': /Aster Works|авторское портфолио/,
    'agency-studio': /Собираем сильные системы|Vector Atelier/
  };

  for (const templateId of templateIds) {
    const ruHtml = ruHooks.templatePreviewHtml(templateId);
    assert.match(ruHtml, /<html lang="ru"/, `${templateId}: RU Web Studio creates RU template output`);
    assert.match(ruHtml, ruMarkers[templateId], `${templateId}: RU starter copy is present`);
    assert.doesNotMatch(ruHtml, /class="lang-toggle"|data-lang-toggle/, `${templateId}: generated site has no internal RU/EN switch`);

    const storedRuState = JSON.parse(JSON.stringify(
      ruHooks.templatePreviewState(templateId)
    ));
    const storedRuHome = storedRuState.pages.find(
      (item) => item.slug === 'index'
    );
    const renderedWhileUiIsEn = hooks.renderSiteHtml(
      storedRuState,
      storedRuHome,
      { linkMode: 'file', inlineAssets: true }
    );
    assert.match(renderedWhileUiIsEn, /<html lang="ru"/, `${templateId}: stored site language survives an EN interface session`);
    assert.match(renderedWhileUiIsEn, /aria-label="(?:Главное меню|Основная навигация|Main navigation)"/, `${templateId}: generated chrome follows the stored RU site language`);
  }

  assert.match(
    fullSource,
    /__IRGEZTNE_CANONICAL_TEMPLATE_PREVIEW_V094A__/,
    'the canonical gallery disables obsolete template-preview owners'
  );
}

function comparablePackageFiles(payload) {
  const files = payload.package;
  return Object.fromEntries(
    Object.keys(files)
      .filter((name) => ![
        'meta.json',
        'content/page.json',
        'sitemap.xml'
      ].includes(name))
      .sort()
      .map((name) => [name, files[name]])
  );
}

function testCanonicalPreviewPackageParity() {
  const productIds = {
    'project-landing': 'landing-product',
    'business-product': 'business-product',
    'blog-news': 'blog-news',
    'documentation-wide': 'documentation',
    'studio-portfolio': 'portfolio-personal',
    'agency-studio': 'agency-studio'
  };
  const bodyMarkers = {
    'project-landing': /landing-home-v086a/,
    'business-product': /class="home-hero"/,
    'blog-news': /class="ticker"/,
    'documentation-wide': /docs-layout-v068d/,
    'studio-portfolio': /class="works-grid"/,
    'agency-studio': /class="focus-strip surface"/
  };

  for (const templateId of templateIds) {
    const state = hooks.templatePreviewState(templateId);
    const home = state.pages.find((item) => item.slug === 'index');
    const galleryPayload = hooks.templatePreviewPayload(templateId);
    const editorPayload = hooks.createEditorPreviewPayload(state, home);
    const zipPayload = hooks.createZipPayload(state, home);
    const publicationPayload = hooks.createPublicationPayload(state, home);

    assert.equal(
      hooks.officialTemplateProductId(templateId),
      productIds[templateId],
      `${templateId}: direct app-id to product-id mapping is stable`
    );
    assert.deepEqual(
      comparablePackageFiles(galleryPayload),
      comparablePackageFiles(editorPayload),
      `${templateId}: Templates preview and Editor Preview use the same package`
    );
    assert.deepEqual(
      comparablePackageFiles(galleryPayload),
      comparablePackageFiles(zipPayload),
      `${templateId}: Templates preview and ZIP use the same package`
    );
    assert.deepEqual(
      comparablePackageFiles(galleryPayload),
      comparablePackageFiles(publicationPayload),
      `${templateId}: Templates preview and publication use the same package`
    );
    assert.match(
      galleryPayload.package['index.html'],
      bodyMarkers[templateId],
      `${templateId}: canonical package contains its individual full home`
    );
    assert.match(
      galleryPayload.package['index.html'],
      /<header\b/,
      `${templateId}: canonical package contains the site header`
    );
  }

  storage.set(
    'irgeztne.preview4.selectedOfficialTemplate.v1',
    JSON.stringify({ template: { id: 'agency-studio' } })
  );
  const business = hooks.templatePreviewState('business-product');
  const businessHome = business.pages.find((item) => item.slug === 'index');
  const businessHtml = hooks.renderSiteHtml(business, businessHome, {
    linkMode: 'file',
    inlineAssets: true
  });
  assert.match(
    businessHtml,
    /Meridian/,
    'a stale gallery selection cannot change the active website renderer'
  );
  assert.doesNotMatch(
    businessHtml,
    /template-id-agency-studio/,
    'renderer selection no longer leaks from global localStorage'
  );
}

function testThemeHeaderAndBuiltInAssetContract() {
  for (const templateId of templateIds) {
    const payload = hooks.templatePreviewPayload(templateId);
    const html = payload.package['index.html'];
    const sharedCss = payload.package['assets/css/style.css'];
    const sharedJs = payload.package['assets/js/site.js'];

    if (templateId === 'project-landing') {
      assert.match(html, /\.site-header\{position:sticky/, 'Landing keeps its sticky product header');
      assert.match(html, /scroll-padding-top:104px/, 'Landing anchors account for the sticky header');
    } else {
      assert.match(sharedCss, /IRGEZTNE_SITE_STICKY_HEADER_V069D/, `${templateId}: shared sticky header contract is packaged`);
      assert.match(sharedCss, /scroll-padding-top:104px/, `${templateId}: anchors account for the sticky header`);
    }

    assert.match(
      sharedJs,
      /DOMContentLoaded/,
      `${templateId}: theme initialization waits for the generated body`
    );
    assert.match(
      html,
      /data-theme-toggle(?:="1")?\b/,
      `${templateId}: generated site exposes the light/dark control`
    );
  }

  const businessFiles = hooks.templatePreviewPayload('business-product').package;
  const blogFiles = hooks.templatePreviewPayload('blog-news').package;
  for (const name of [
    'assets/template/business/hero-office.webp',
    'assets/template/business/process-team.webp',
    'assets/template/business/case-city.webp'
  ]) {
    assert.match(
      businessFiles[name].templateAsset,
      /^template-lab\/business-product\/assets\//,
      `Business packages its official local image: ${name}`
    );
  }
  for (const name of [
    'assets/template/blog/main.jpg',
    'assets/template/blog/tech.jpg',
    'assets/template/blog/business.jpg',
    'assets/template/blog/guide.jpg',
    'assets/template/blog/workspace.jpg',
    'assets/template/blog/city.jpg'
  ]) {
    assert.match(
      blogFiles[name].templateAsset,
      /^template-lab\/blog-news\/assets\//,
      `Blog packages its official local image: ${name}`
    );
  }

  assert.match(mainSource, /entry\.templateAsset/, 'Electron package writer accepts official template assets');
  assert.match(mainSource, /Template asset is outside the official Template Lab/, 'template asset reads are confined to Template Lab');
}

function testLandingDocumentationCanonV096A() {
  const ruHooks = hooksForLanguage('ru');
  const landingPayload = ruHooks.templatePreviewPayload('project-landing');
  const landingHtml = String(landingPayload.package['index.html']);

  assert.match(
    landingHtml,
    /IRGEZTNE_LANDING_FULL_WIDTH_V086B[\s\S]*?\.page\{width:100%;max-width:none/,
    'Landing keeps the canonical full-width shell'
  );
  assert.match(
    landingHtml,
    /data-ru="Лендинг \/ продукт">Лендинг \/ продукт<\/p>/,
    'Landing RU output localizes its template label'
  );
  assert.match(
    landingHtml,
    /data-ru="Задачи организованы">Задачи организованы<\/span>/,
    'Landing RU output localizes its product-visual status'
  );

  const docsPayload = ruHooks.templatePreviewPayload('documentation-wide');
  const docsHtml = String(docsPayload.package['index.html']);
  const docsJs = String(docsPayload.package['assets/js/site.js']);
  const docsHeader = docsHtml.match(/<header class="site-header">[\s\S]*?<\/header>/);
  const docsSidebar = docsHtml.match(/<aside class="docs-sidebar-v068d">[\s\S]*?<\/aside>/);

  assert.ok(docsHeader, 'Documentation header is rendered');
  assert.ok(docsSidebar, 'Documentation sidebar is rendered');
  assert.match(docsHtml, /IRGEZTNE_LANDING_DOCUMENTATION_CANON_V096A/, 'Documentation packages the V096A canonical wide layout');
  assert.match(docsHtml, /main\.page\{[^}]*overflow:visible!important/, 'Documentation sticky header is not trapped by the shared main overflow');
  assert.match(docsHeader[0], /data-docs-search-v096a="1"/, 'Documentation places the real search control in the header');
  assert.doesNotMatch(docsHeader[0], /class="nav-link/, 'Documentation does not duplicate page navigation in the header');
  assert.doesNotMatch(docsSidebar[0], /docs-search-v068d/, 'Documentation sidebar no longer contains the old fake search label');
  assert.match(docsJs, /function initDocsSearchV096A\(\)/, 'Documentation packages its local search behavior');
  assert.match(docsJs, /ArrowDown/, 'Documentation search supports keyboard result navigation');

  const docsState = hooks.normalizeState(stateFor('documentation-wide'));
  const docsHome = docsState.pages.find((item) => item.id === 'home');
  const customDocsHtml = String(
    hooks.createPublicSitePayload(docsState, docsHome).package['index.html']
  );
  const customSidebar = customDocsHtml.match(/<aside class="docs-sidebar-v068d">[\s\S]*?<\/aside>/);
  const searchIndex = customDocsHtml.match(/<script type="application\/json" data-docs-search-index-v096a="1">([\s\S]*?)<\/script>/);

  assert.ok(customSidebar, 'Documentation custom-site sidebar is rendered');
  assert.match(customSidebar[0], /Published Custom/, 'Documentation sidebar includes a published page enabled for menu');
  assert.match(customSidebar[0], /Published Child/, 'Documentation sidebar includes a published child enabled for menu');
  assert.doesNotMatch(customSidebar[0], /Published Footer/, 'Documentation sidebar respects a footer-only page setting');
  assert.ok(searchIndex, 'Documentation embeds a local page search index');
  assert.match(searchIndex[1], /Published Footer/, 'Documentation search can still find a public footer-only page');
}

function testGeneratedRouteClosure() {
  const expectedHtml = {
    'project-landing': ['index.html'],
    'business-product': ['about.html', 'contacts.html', 'index.html', 'services.html'],
    'blog-news': ['about.html', 'article-clear-product-pages.html', 'article-editorial-rhythm.html', 'article-modern-web-products.html', 'article-prepublish-check.html', 'article-publishing-tools.html', 'article-wide-layouts.html', 'articles.html', 'index.html', 'topics.html'],
    'documentation-wide': ['getting-started.html', 'guides.html', 'index.html', 'reference.html'],
    'studio-portfolio': ['about.html', 'contact.html', 'index.html', 'works.html'],
    'agency-studio': ['cases.html', 'contact.html', 'index.html', 'process.html', 'services.html']
  };

  function localReference(value) {
    const ref = String(value || '').trim();
    if (
      !ref ||
      ref.startsWith('#') ||
      ref.startsWith('/') ||
      /^(?:data:|https?:|mailto:|tel:|javascript:)/i.test(ref)
    ) {
      return '';
    }
    return ref.split('#')[0].split('?')[0];
  }

  for (const templateId of templateIds) {
    const payload = hooks.templatePreviewPayload(templateId);
    const files = payload.package;
    const htmlNames = Object.keys(files)
      .filter((name) => name.endsWith('.html'))
      .sort();

    assert.deepEqual(
      htmlNames,
      expectedHtml[templateId],
      `${templateId}: official starter exposes the expected page routes`
    );
    assert.equal(
      payload.activeFileName,
      'index.html',
      `${templateId}: canonical preview starts at index.html`
    );

    for (const htmlName of htmlNames) {
      const html = String(files[htmlName]);
      const attributePattern = /\b(?:href|src)="([^"]+)"/g;
      let match;
      while ((match = attributePattern.exec(html))) {
        const ref = localReference(match[1]);
        if (!ref) continue;
        assert.ok(
          Object.hasOwn(files, ref),
          `${templateId}/${htmlName}: local route or asset exists: ${ref}`
        );
      }

      assert.doesNotMatch(
        html,
        /template-lab\/.+\/index\.html/,
        `${templateId}/${htmlName}: generated pages never route into Template Lab`
      );
    }

    const cssSources = [
      String(files['assets/css/style.css'] || ''),
      ...htmlNames.map((name) => String(files[name]))
    ].join('\n');
    const cssUrlPattern = /url\((?:"|')?([^"')]+)(?:"|')?\)/g;
    let cssMatch;
    while ((cssMatch = cssUrlPattern.exec(cssSources))) {
      const ref = localReference(cssMatch[1]);
      if (!ref) continue;
      assert.ok(
        Object.hasOwn(files, ref),
        `${templateId}: CSS asset exists in Preview/browser/ZIP package: ${ref}`
      );
    }
  }
}

function testUntouchedStarterMigration() {
  const fixtures = {
    'business-product': '<div class="ir-starter-grid"><div>Legacy business</div></div>',
    'blog-news': '<div class="ir-starter-news"><article>Legacy news</article></div>',
    'studio-portfolio': '<div class="ir-starter-work"><div>Legacy portfolio</div></div>',
    'agency-studio': '<div class="ir-starter-work"><div>Legacy agency</div></div>'
  };
  const expected = {
    'business-product': /class="home-hero"/,
    'blog-news': /class="ticker"/,
    'studio-portfolio': /class="works-grid"/,
    'agency-studio': /class="focus-strip surface"/
  };

  for (const [templateId, legacyBody] of Object.entries(fixtures)) {
    const state = stateFor(templateId);
    state.pages[0].bodyHtml = legacyBody;
    const migrated = hooks.normalizeState(state);
    assert.match(
      migrated.pages[0].bodyHtml,
      expected[templateId],
      `${templateId}: known untouched compact starter migrates to the full home`
    );

    const custom = stateFor(templateId);
    custom.pages[0].bodyHtml = '<section data-user-authored="1"><h1>Keep my work</h1></section>';
    const preserved = hooks.normalizeState(custom);
    assert.equal(
      preserved.pages[0].bodyHtml,
      '<section data-user-authored="1"><h1>Keep my work</h1></section>',
      `${templateId}: user-authored home is never replaced`
    );
  }

  assert.match(
    officialTemplatesSource,
    /owner:\s*'webstudio-official'/,
    'the legacy Workspace template surface is a route into the canonical Web Studio owner'
  );
  assert.match(
    officialTemplatesSource,
    /complete official starter/,
    'the legacy template card no longer claims that official starter pages are absent'
  );
}

function writeQaPackages(outputRoot) {
  if (!outputRoot) return;
  const targetRoot = path.resolve(outputRoot);

  for (const templateId of templateIds) {
    const payload = hooks.templatePreviewPayload(templateId);
    const templateDir = path.join(targetRoot, templateId);

    for (const [rawName, value] of Object.entries(payload.package)) {
      const name = String(rawName).replace(/\\/g, '/');
      if (!name || name.startsWith('/') || name.split('/').includes('..')) {
        throw new Error(`Unsafe QA package path: ${rawName}`);
      }
      const target = path.join(templateDir, name);
      fs.mkdirSync(path.dirname(target), { recursive: true });

      if (value && typeof value === 'object' && value.templateAsset) {
        fs.copyFileSync(path.join(root, value.templateAsset), target);
      } else if (value && typeof value === 'object' && value.contentBase64) {
        fs.writeFileSync(target, Buffer.from(value.contentBase64, 'base64'));
      } else if (value && typeof value === 'object' && Object.hasOwn(value, 'content')) {
        fs.writeFileSync(target, String(value.content));
      } else if (typeof value === 'string') {
        fs.writeFileSync(target, value);
      }
    }
  }
}

function page(id, slug, name, status, extra = {}) {
  const result = {
    id, slug, pageName: name, title: name, headline: name, summary: `${name} summary`,
    bodyHtml: `<p>${name} body</p>`, inMenu: false, inFooter: false,
    parentId: '', order: 0, ...extra
  };
  if (status !== undefined) result.status = status;
  return result;
}

function stateFor(templateId) {
  const home = page('home', 'index', 'Home', 'published', {
    inMenu: true,
    order: 0,
    bodyHtml: '<p>Before local image</p><figure class="ewb-image is-size-small is-align-left"><img src="assets/media/image/contract.png" alt="Contract image"><figcaption>Contract image</figcaption></figure><p>After local image</p>'
  });
  const published = page('published', 'published-custom', 'Published Custom', 'published', { inMenu: true, order: 1 });
  const missingStatus = page('missing-status', 'missing-status', 'Missing Status', undefined, { inMenu: true, order: 2 });
  const legacyArchived = page('legacy-archived', 'legacy-archived', 'Legacy Archived', 'archived', { inMenu: true, order: 3 });
  const draftTop = page('draft-top', 'draft-top', 'Draft Top', 'draft', { inMenu: true, order: 4 });
  const publishedChild = page('published-child', 'published-child', 'Published Child', 'published', { inMenu: true, parentId: published.id, order: 0 });
  const draftChild = page('draft-child', 'draft-child', 'Draft Child', 'draft', { inMenu: true, parentId: published.id, order: 1 });
  const publishedFooter = page('published-footer', 'published-footer', 'Published Footer', 'published', { inFooter: true, footerGroup: 'legal', order: 5 });
  const draftFooter = page('draft-footer', 'draft-footer', 'Draft Footer', 'draft', { inFooter: true, footerGroup: 'legal', order: 6 });
  return {
    site: {
      name: `Contract ${templateId}`, tagline: 'Contract test', activeTemplate: templateId, template: templateId,
      accentColor: '#2f7be6', menuColor: '#2f7be6', buttonColor: '#2f7be6', backgroundColor: '#ffffff', textColor: '#101827',
      logoLetters: 'IR', logoBackgroundColor: '#2f7be6', logoTextColor: '#ffffff', faviconLetters: 'IR', faviconBackgroundColor: '#2f7be6', faviconTextColor: '#ffffff',
      siteSettings: {}, publishSettings: {},
      mediaAssets: [
        {
          id: 'contract-image',
          kind: 'image',
          publicPath: 'assets/media/image/contract.png',
          sourcePath: '/tmp/irgeztne-contract-image.png',
          sourceUrl: 'file:///tmp/irgeztne-contract-image.png',
          mimeType: 'image/png'
        },
        {
          id: 'contract-video',
          kind: 'video',
          publicPath: 'assets/media/video/contract.mp4',
          sourcePath: '/tmp/irgeztne-contract-video.mp4',
          sourceUrl: 'file:///tmp/irgeztne-contract-video.mp4',
          mimeType: 'video/mp4'
        },
        {
          id: 'unsafe-image-path',
          kind: 'image',
          publicPath: '../unsafe.png',
          sourcePath: '/tmp/unsafe.png',
          sourceUrl: 'file:///tmp/unsafe.png',
          mimeType: 'image/png'
        }
      ]
    },
    pages: [home, published, missingStatus, legacyArchived, draftTop, publishedChild, draftChild, publishedFooter, draftFooter],
    activePageId: home.id, menuGroups: []
  };
}

function assertPublicPayload(payload, templateId, label) {
  const files = payload.package;
  for (const name of ['published-custom.html', 'missing-status.html', 'published-child.html', 'published-footer.html']) {
    assert.ok(files[name], `${templateId}/${label}: ${name} is public`);
  }
  for (const name of ['legacy-archived.html', 'draft-top.html', 'draft-child.html', 'draft-footer.html']) {
    assert.ok(!files[name], `${templateId}/${label}: ${name} is not public`);
  }
  assert.doesNotMatch(files['sitemap.xml'], /legacy-archived|draft-(?:top|child|footer)/, `${templateId}/${label}: non-public pages are absent from sitemap`);
  assert.ok(files['favicon.svg'], `${templateId}/${label}: favicon asset is preserved`);
  assert.ok(files['site.webmanifest'], `${templateId}/${label}: favicon manifest is preserved`);
  assert.equal(files['assets/media/image/contract.png'].sourcePath, '/tmp/irgeztne-contract-image.png', `${templateId}/${label}: local image is packaged`);
  assert.equal(files['assets/media/video/contract.mp4'].sourcePath, '/tmp/irgeztne-contract-video.mp4', `${templateId}/${label}: local video remains packaged`);
  assert.ok(!files['../unsafe.png'], `${templateId}/${label}: unsafe media path is excluded`);
  assert.match(files['assets/css/style.css'], /main figure\.ewb-image/, `${templateId}/${label}: generated CSS supports image sizing and alignment`);
}

function testDocumentationRepairAndFaq() {
  const originalBody = '<div class="docs-home-v085a"><p data-preserve="yes">Preserve this content</p>' +
    '<div class="docs-faq-v085a"><details open=""><summary>First</summary><p>First answer</p></details>' +
    '<details data-keep="yes"><summary>Second</summary><p>Second answer</p></details>' +
    '<details><summary>Third</summary><p>Third answer</p></details></div></div>';
  const expectedBody = originalBody.replace('<details open="">', '<details>');
  const createdAt = '2026-07-22T08:28:04.258Z';
  const damagedHome = page('docs-home-id', 'getting-started-2', 'Начало', 'published', {
    type: 'home', pagePreset: 'landing', bodyHtml: originalBody, createdAt, updatedAt: createdAt, inMenu: true
  });
  const gettingStarted = page('getting-started-id', 'getting-started', 'Getting started', 'published', {
    type: 'page', pagePreset: 'blank', bodyHtml: '<p>Keep getting started</p>', order: 1, inMenu: true
  });
  const userArticle = page('user-article-id', 'novaya-stranica-sayta', 'Тестовая статья', 'published', {
    type: 'page', pagePreset: 'blank', bodyHtml: '<details open><summary>User detail</summary><p>User body</p></details>', order: 2, inMenu: true
  });
  const fixture = {
    site: {
      name: 'Documentation migration', activeTemplate: 'documentation-wide', template: 'documentation-wide',
      accentColor: '#8b5cf6', menuColor: '#8b5cf6', buttonColor: '#8b5cf6', backgroundColor: '#ffffff', textColor: '#101827',
      logoLetters: 'DO', logoBackgroundColor: '#8b5cf6', logoTextColor: '#ffffff', faviconLetters: 'DO',
      faviconBackgroundColor: '#8b5cf6', faviconTextColor: '#ffffff', siteSettings: {}, publishSettings: {}
    },
    pages: [damagedHome, gettingStarted, userArticle], activePageId: damagedHome.id, menuGroups: []
  };

  const migrated = hooks.normalizeState(fixture);
  const home = migrated.pages.find((item) => item.id === 'docs-home-id');
  const article = migrated.pages.find((item) => item.id === 'user-article-id');
  assert.equal(home.slug, 'index', 'Documentation migration restores index slug');
  assert.equal(home.id, 'docs-home-id', 'Documentation migration preserves home ID');
  assert.equal(home.createdAt, createdAt, 'Documentation migration preserves createdAt');
  assert.equal(home.pageName, 'Documentation', 'Documentation migration restores localized home name');
  assert.equal(home.type, 'home');
  assert.equal(home.pagePreset, 'landing');
  assert.equal(home.bodyHtml, expectedBody, 'Documentation migration changes only the first starter FAQ open attribute');
  assert.match(home.bodyHtml, /data-preserve="yes">Preserve this content/, 'Documentation home content is preserved');
  assert.match(home.bodyHtml, /details data-keep="yes"/, 'remaining Documentation FAQ markup is preserved');
  assert.equal(article.slug, 'novaya-stranica-sayta', 'user article slug is unchanged');
  assert.equal(article.pageName, 'Тестовая статья', 'user article name is unchanged');
  assert.equal(article.bodyHtml, '<details open><summary>User detail</summary><p>User body</p></details>', 'user details remain open and unchanged');
  assert.ok(migrated.pages.some((item) => item.id === 'getting-started-id' && item.slug === 'getting-started'), 'separate Getting started page is preserved');

  const once = JSON.stringify(migrated);
  hooks.normalizeState(migrated);
  assert.equal(JSON.stringify(migrated), once, 'Documentation migration is idempotent');

  const payload = hooks.createPublicSitePayload(migrated, home);
  const html = payload.package['index.html'];
  const sidebarMatch = html.match(/<aside class="docs-sidebar-v068d">[\s\S]*?<\/aside>/);
  assert.ok(sidebarMatch, 'Documentation sidebar is rendered');
  assert.equal((sidebarMatch[0].match(/>Getting started<\/a>/g) || []).length, 1, 'Documentation sidebar has one Getting started entry');
  assert.doesNotMatch(html, /getting-started-2\.html/, 'damaged duplicate slug is absent from Documentation output');
  assert.match(html, /Тестовая статья/, 'user article remains in Documentation sidebar');

  const docsStarter = hooks.starterPagesForTemplate('documentation-wide')[0].bodyHtml;
  assert.doesNotMatch(docsStarter, /<details\s+open(?:[\s=>])/, 'future Documentation starter FAQ is closed');
  const landingStarter = hooks.starterPagesForTemplate('project-landing')[0].bodyHtml;
  assert.match(landingStarter, /<details class="faq-item" open>/, 'Landing FAQ remains unchanged and open');

  const landingState = hooks.normalizeState(stateFor('project-landing'));
  const landingHtml = hooks.createPublicSitePayload(landingState, landingState.pages[0]).package['index.html'];
  assert.match(landingHtml, /IRGEZTNE_LANDING_SITE_THEME_V089A/, 'Landing V089A theme mechanism remains present');
}

function testIndependentSiteNameLogoAndH1() {
  const newSite = hooks.normalizeState(stateFor('project-landing'));
  newSite.site.name = 'Siti';
  newSite.site.logoLetters = 'SI';
  newSite.site.faviconLetters = 'SI';
  hooks.resetNewSiteIdentity(newSite);

  assert.equal(newSite.site.logoLetters, '', 'new site finalization clears a name-derived logo default');
  assert.equal(newSite.site.faviconLetters, '', 'new site finalization clears a name-derived favicon default');
  assert.equal(hooks.faviconLetters(newSite.site), '', 'an empty favicon does not derive letters from the site name or logo');

  const newSiteHome = newSite.pages.find((item) => item.id === 'home');
  const newSitePayload = hooks.createPublicSitePayload(newSite, newSiteHome).package;
  assert.doesNotMatch(newSitePayload['index.html'], /<div class="logo"(?:\s|>)/, 'Siti is exported without an automatic SI header mark');
  assert.doesNotMatch(newSitePayload['favicon.svg'], />SI</, 'Siti favicon stays independent until configured in Design');

  for (const templateId of templateIds) {
    const state = hooks.normalizeState(stateFor(templateId));
    state.site.name = 'A Very Long Website Name That Is Not A Logo';
    state.site.logoLetters = '';
    state.site.faviconLetters = 'FV';

    const home = state.pages.find((item) => item.id === 'home');
    const unbrandedHtml = hooks.createPublicSitePayload(state, home).package['index.html'];

    assert.doesNotMatch(
      unbrandedHtml,
      /<div class="logo"(?:\s|>)/,
      `${templateId}: an empty Design logo does not derive a mark from the site name`
    );
    assert.match(
      unbrandedHtml,
      /A Very Long Website Name That Is Not A Logo/,
      `${templateId}: the site name remains visible as identity text`
    );

    const contentPage = state.pages.find((item) => item.id === 'published');
    contentPage.headline = '';
    contentPage.bodyHtml = '<h1>Author controlled H1</h1><p>Article body</p>';
    const authoredHtml = hooks.createPublicSitePayload(state, contentPage).package['published-custom.html'];
    const h1Count = (authoredHtml.match(/<h1\b/gi) || []).length;

    assert.equal(
      h1Count,
      1,
      `${templateId}: a body-authored H1 is not duplicated by the template`
    );
    assert.match(authoredHtml, /<h1>Author controlled H1<\/h1>/, `${templateId}: the authored H1 is preserved`);
    assert.doesNotMatch(authoredHtml, /Write page H1|Напишите H1 страницы/, `${templateId}: editor instructions are never public content`);

    contentPage.bodyHtml = '<p>Article without an authored H1</p>';
    const fallbackHtml = hooks.createPublicSitePayload(state, contentPage).package['published-custom.html'];
    assert.doesNotMatch(fallbackHtml, /Write page H1|Напишите H1 страницы/, `${templateId}: empty separate H1 never exports a placeholder`);

    if (!['project-landing', 'documentation-wide'].includes(templateId)) {
      assert.match(fallbackHtml, /<h1>Published Custom<\/h1>/, `${templateId}: ordinary templates use the page name as the safe H1 fallback`);
    }
  }

  assert.doesNotMatch(
    fullSource,
    /state\.site\.logoLetters\s*=\s*initialsFromName\(profile\.name\)/,
    'new website creation does not copy the site name into Design logo letters'
  );
  assert.doesNotMatch(
    fullSource,
    /state\.site\.logoLetters\s*\|\|\s*initialsFromName\(state\.site\.name/,
    'the Web Studio header does not use the site name as a logo fallback'
  );
}

function testWorkbenchSaveStateContract() {
  assert.match(
    workbenchHtmlSource,
    /data-action="save"\s+data-save-state="saved"\s+disabled/,
    'the initial Save control is a disabled saved state, not a permanently highlighted action'
  );
  assert.match(workbenchJsSource, /function setSaveState\(state\)/, 'the workbench owns explicit dirty/saving/saved states');
  assert.match(workbenchJsSource, /data\.lang === 'en'/, 'the Save state follows the Web Studio RU/EN language');
  assert.match(workbenchJsSource, /localText\('Save changes', 'Сохранить изменения'\)/, 'the dirty Save label is localized');
  assert.match(workbenchJsSource, /function reportWorkbenchHeightV094B\(\)/, 'the Workbench reports its real growing-canvas height');
  assert.match(workbenchJsSource, /function moveSelectedMediaV094B\(direction\)/, 'media blocks can move up or down');
  assert.match(workbenchJsSource, /function splitSelectedTextIntoBlockV094B\(tag\)/, 'a selected fragment can become its own heading block');
  assert.match(workbenchHtmlSource, /editor-workbench\.js\?v=1\.0\.0-closure-20261007/, 'the Workbench loads the growing-canvas/editor correction');
  assert.match(fullSource, /data\.type === 'height'/, 'Web Studio receives Workbench height updates');
}

async function main() {
  testOfficialTemplateSelectionRoute();
  testTemplateLanguageContract();
  testCanonicalPreviewPackageParity();
  testThemeHeaderAndBuiltInAssetContract();
  testLandingDocumentationCanonV096A();
  testGeneratedRouteClosure();
  testUntouchedStarterMigration();
  testDocumentationRepairAndFaq();
  testIndependentSiteNameLogoAndH1();
  testWorkbenchSaveStateContract();
  assert.equal(hooks.normalizePageStatus('draft', 'published'), 'draft');
  assert.equal(hooks.normalizePageStatus('published', 'draft'), 'published');
  assert.equal(hooks.normalizePageStatus(undefined, 'published'), 'published');
  assert.equal(hooks.normalizePageStatus('archived', 'published'), 'draft');

  for (const templateId of templateIds) {
    const state = hooks.normalizeState(stateFor(templateId));
    const byId = (id) => state.pages.find((item) => item.id === id);
    assert.equal(byId('missing-status').status, 'published', `${templateId}: missing legacy status migrates to published`);
    assert.equal(byId('legacy-archived').status, 'draft', `${templateId}: archived migrates to draft`);
    assert.equal(byId('draft-top').status, 'draft', `${templateId}: explicit draft stays draft`);
    assert.equal(byId('published').status, 'published', `${templateId}: explicit published stays published`);
    const expectedEditorPages = templateId === 'blog-news' ? 15 : 9;
    const expectedPublicPages = templateId === 'blog-news' ? 11 : 5;
    assert.equal(hooks.editorPages(state).length, expectedEditorPages, `${templateId}: editor sees all normalized pages`);
    assert.equal(hooks.publicPages(state).length, expectedPublicPages, `${templateId}: public set sees normalized published pages`);

    const publicPayload = hooks.createPublicSitePayload(state, byId('draft-top'));
    assertPublicPayload(publicPayload, templateId, 'open-site');
    const zipPayload = hooks.createZipPayload(state, byId('draft-top'));
    assertPublicPayload(zipPayload, templateId, 'zip');
    const publicationPayload = hooks.createPublicationPayload(state, byId('draft-top'));
    assertPublicPayload(publicationPayload, templateId, 'publication');

    const editorPayload = hooks.createEditorPreviewPayload(state, byId('draft-top'));
    assert.ok(editorPayload.package['draft-top.html'], `${templateId}: selected draft is previewable`);
    assert.ok(!editorPayload.package['draft-child.html'], `${templateId}: unrelated draft child stays excluded`);
    assert.ok(!editorPayload.package['draft-footer.html'], `${templateId}: unrelated draft footer stays excluded`);
    assert.equal(editorPayload.activeFileName, 'draft-top.html', `${templateId}: selected draft is active`);

    let materializedPublic;
    window.nsAPI = {
      async materializeSitePreview(payload) {
        materializedPublic = payload;
        return { ok: false };
      }
    };
    await hooks.materializePreviewPackage(state, byId('draft-top'));
    assertPublicPayload(materializedPublic, templateId, 'materialized-open-site');

    const homeHtml = publicPayload.package['index.html'];
    assert.match(homeHtml, /class="ewb-image is-size-small is-align-left"/, `${templateId}: local image block survives generated HTML`);
    assert.match(homeHtml, /assets\/media\/image\/contract\.png/, `${templateId}: local image keeps its public relative path`);
    assert.match(homeHtml, /Published Custom/, `${templateId}: published top page is rendered`);
    assert.match(homeHtml, /Missing Status/, `${templateId}: migrated published page is rendered`);
    assert.match(homeHtml, /Published Child/, `${templateId}: published child is rendered in public navigation/sidebar`);
    assert.doesNotMatch(homeHtml, /Draft Child/, `${templateId}: draft child is hidden`);
    assert.doesNotMatch(homeHtml, /Draft Top|Draft Footer|Legacy Archived/, `${templateId}: non-public pages are hidden`);
    assert.match(homeHtml, /Published Footer/, `${templateId}: published footer is rendered`);
    assert.match(homeHtml, />IR</, `${templateId}: logo output is preserved`);

    const fallbackHtml = hooks.renderPublicSiteHtml(state, byId('draft-top'), { linkMode: 'file', inlineAssets: true });
    assert.match(fallbackHtml, /Published Custom/, `${templateId}: public fallback renders published state`);
    assert.doesNotMatch(fallbackHtml, /Draft Top|Draft Child|Draft Footer|Legacy Archived/, `${templateId}: public fallback never renders draft state`);

    if (templateId === 'documentation-wide') {
      assert.match(homeHtml, /docs-sidebar-v068d/, 'Documentation keeps sidebar navigation');
      assert.match(homeHtml, /Missing Status|Published Custom/, 'Documentation sidebar shows published custom pages');
      assert.doesNotMatch(homeHtml, /Draft Top|Draft Child/, 'Documentation sidebar hides drafts');
      assert.match(homeHtml, /aria-label="Main navigation"><button class="theme-toggle"/, 'Documentation does not restore top page menu');
    }
    if (templateId === 'project-landing') {
      assert.match(homeHtml, /Published Custom|Missing Status/, 'Landing menu shows published custom pages');
      assert.match(homeHtml, /Published Footer/, 'Landing footer shows published footer page');
      assert.doesNotMatch(homeHtml, /Draft Top|Draft Child|Draft Footer/, 'Landing menu/footer hide drafts');
    }
  }
  writeQaPackages(process.env.WEBSTUDIO_QA_OUT || '');
  console.log(`PASS: normalized public/fallback contract verified for ${templateIds.length} official templates`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
