'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const studioPath = path.join(
  root,
  'src/modules/editor-site-studio-safe/editor-site-studio-safe-v5.js'
);
const fullSource = fs.readFileSync(studioPath, 'utf8');
const firstIife = fullSource.split('// 1.0.0 v5 exit/back safe')[0];

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

function hooksForLanguage(lang) {
  const storage = new Map([['irgeztne.webStudio.lang.v1', lang]]);
  const documentElement = {
    getAttribute: (name) => name === 'lang' ? lang : ''
  };
  const document = {
    readyState: 'loading',
    documentElement,
    body: { innerText: '' },
    addEventListener() {},
    createElement(tag) {
      if (tag === 'template') {
        return { innerHTML: '', content: { querySelectorAll: () => [] } };
      }
      if (tag === 'canvas') return fakeCanvas();
      return {};
    }
  };
  const window = {
    __IRGEZTNE_WEBSTUDIO_TEST__: true,
    addEventListener() {},
    setTimeout,
    clearTimeout
  };
  const context = {
    window,
    document,
    localStorage: {
      getItem: (key) => storage.has(key) ? storage.get(key) : null,
      setItem: (key, value) => storage.set(key, String(value))
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

  window.window = window;
  window.document = document;
  window.localStorage = context.localStorage;
  vm.runInNewContext(firstIife, context, { filename: studioPath });
  return window.__IRGEZTNE_WEBSTUDIO_TEST_HOOKS__;
}

function page(id, slug, name, extra = {}) {
  return {
    id,
    slug,
    pageName: name,
    title: name,
    headline: name,
    summary: `${name} summary`,
    bodyHtml: `<p>${name} body</p>`,
    status: 'published',
    inMenu: false,
    inFooter: false,
    parentId: '',
    order: 0,
    ...extra
  };
}

const hooks = hooksForLanguage('ru');
assert.ok(hooks, 'Web Studio test hooks are available');

const landingPayload = hooks.templatePreviewPayload('project-landing');
const landingHtml = String(landingPayload.package['index.html']);
assert.match(
  landingHtml,
  /IRGEZTNE_LANDING_FULL_WIDTH_V086B[\s\S]*?\.page\{width:100%;max-width:none/,
  'Landing is full width'
);
assert.match(
  landingHtml,
  /data-ru="Лендинг \/ продукт">Лендинг \/ продукт<\/p>/,
  'Landing Russian label is visible'
);
assert.match(
  landingHtml,
  /data-ru="Задачи организованы">Задачи организованы<\/span>/,
  'Landing product visual is localized'
);
assert.doesNotMatch(
  landingHtml,
  /class="lang-toggle"|data-lang-toggle/,
  'Landing keeps one generated language'
);
assert.match(
  landingHtml,
  /data-en="FAQ" data-ru="Вопросы">Вопросы<\/span>/,
  'Landing Russian navigation has no English FAQ label'
);
assert.match(
  landingHtml,
  /data-en="Next step" data-ru="Следующий шаг">Следующий шаг<\/p>/,
  'Landing Russian CTA label is localized'
);

const enHooks = hooksForLanguage('en');
const landingEnHtml = String(
  enHooks.templatePreviewPayload('project-landing').package['index.html']
);
assert.match(landingEnHtml, /<html lang="en"/, 'Landing inherits English from Web Studio');
assert.match(
  landingEnHtml,
  /data-en="Landing \/ Product" data-ru="Лендинг \/ продукт">Landing \/ Product<\/p>/,
  'Landing English starter is English before runtime initialization'
);
assert.match(
  landingEnHtml,
  /data-en="Tasks organised" data-ru="Задачи организованы">Tasks organised<\/span>/,
  'Landing English product visual is English before runtime initialization'
);

const docsPayload = hooks.templatePreviewPayload('documentation-wide');
const docsHtml = String(docsPayload.package['index.html']);
const docsJs = String(docsPayload.package['assets/js/site.js']);
const docsHeader = docsHtml.match(/<header class="site-header">[\s\S]*?<\/header>/);
const docsSidebar = docsHtml.match(/<aside class="docs-sidebar-v068d">[\s\S]*?<\/aside>/);

assert.ok(docsHeader, 'Documentation header exists');
assert.ok(docsSidebar, 'Documentation sidebar exists');
assert.match(
  docsHtml,
  /IRGEZTNE_LANDING_DOCUMENTATION_CANON_V096A/,
  'Documentation V096A layout is packaged'
);
assert.match(
  docsHtml,
  /IRGEZTNE_DOCUMENTATION_DARK_INTERACTION_V096B/,
  'Documentation V096B dark interaction correction is packaged'
);
assert.match(
  docsHtml,
  /body\.template-documentation\[data-theme="dark"\]\{--docs-readable-accent:color-mix\(in srgb,var\(--button-accent\) 38%,#f8fafc\);--docs-readable-on-accent:#07111f\}/,
  'Documentation dark theme derives a readable local accent'
);
assert.match(
  docsHtml,
  /main\.page\{[^}]*overflow:visible!important/,
  'Documentation sticky header has a visible overflow owner'
);
assert.match(
  docsHeader[0],
  /data-docs-search-v096a="1"/,
  'Documentation header contains search'
);
assert.match(
  docsHeader[0],
  /class="docs-search-icon-v096a"[^>]*><svg viewBox="0 0 24 24"[^>]*><circle[^>]*><\/circle><path[^>]*><\/path><\/svg><\/span>/,
  'Documentation search uses a stable SVG magnifier'
);
assert.doesNotMatch(
  docsHeader[0],
  />⌕<\/span>/,
  'Documentation no longer uses the needle-thin Unicode search glyph'
);
assert.match(
  docsHtml,
  /\.docs-sidebar-v068d a:hover,\.docs-sidebar-v068d a\.is-active\{[^}]*color:var\(--docs-readable-accent\)/,
  'Documentation sidebar hover and active states use the readable accent'
);
assert.match(
  docsHtml,
  /\.docs-eyebrow-v085a\{[^}]*color:var\(--docs-readable-accent\)/,
  'Documentation eyebrow labels remain readable in both themes'
);
assert.match(
  docsHtml,
  /body\.template-documentation \.kicker\{color:var\(--docs-readable-accent\)\}/,
  'Documentation page kicker remains readable in both themes'
);
assert.doesNotMatch(
  docsHeader[0],
  /class="nav-link/,
  'Documentation header has no duplicated page menu'
);
assert.doesNotMatch(
  docsSidebar[0],
  /docs-search-v068d/,
  'Documentation sidebar has no fake search label'
);
assert.doesNotMatch(
  docsHtml,
  /<div class="kicker">Документация<\/div><h1>Документация<\/h1>/,
  'Documentation home does not repeat the same label above its H1'
);
assert.doesNotMatch(
  docsHtml,
  /class="lang-toggle"|data-lang-toggle/,
  'Documentation keeps one generated language'
);
assert.match(docsJs, /function initDocsSearchV096A\(\)/, 'Search behavior is packaged');
assert.match(docsJs, /ArrowDown/, 'Search supports keyboard navigation');

const docsEnHtml = String(
  enHooks.templatePreviewPayload('documentation-wide').package['index.html']
);
assert.match(docsEnHtml, /<html lang="en"/, 'Documentation inherits English from Web Studio');
assert.match(
  docsEnHtml,
  /placeholder="Search pages and topics…"/,
  'Documentation English search is localized'
);

const customState = hooks.templatePreviewState('documentation-wide');
const home = customState.pages.find((item) => item.slug === 'index');
const parent = page('custom-parent', 'custom-parent', 'Пользовательский раздел', {
  inMenu: true,
  order: 50
});
const child = page('custom-child', 'custom-child', 'Дочерняя статья', {
  inMenu: true,
  parentId: parent.id,
  order: 51
});
const footerOnly = page('footer-only', 'footer-only', 'Только в подвале', {
  inFooter: true,
  order: 52
});
const hidden = page('hidden-public', 'hidden-public', 'Скрытая публичная статья', {
  order: 53
});
customState.pages.push(parent, child, footerOnly, hidden);

const normalized = hooks.normalizeState(customState);
const output = String(
  hooks.createPublicSitePayload(normalized, home).package['index.html']
);
const sidebar = output.match(/<aside class="docs-sidebar-v068d">[\s\S]*?<\/aside>/);
const searchIndex = output.match(
  /<script type="application\/json" data-docs-search-index-v096a="1">([\s\S]*?)<\/script>/
);

assert.ok(sidebar, 'Custom Documentation sidebar exists');
assert.match(sidebar[0], /Пользовательский раздел/, 'Menu-enabled page appears in the sidebar');
assert.match(sidebar[0], /class="docs-nav-child-v096a"[^>]*>Дочерняя статья/, 'Child page keeps hierarchy');
assert.doesNotMatch(sidebar[0], /Только в подвале/, 'Footer-only page stays out of the sidebar');
assert.doesNotMatch(sidebar[0], /Скрытая публичная статья/, 'Menu-hidden page stays out of the sidebar');
assert.ok(searchIndex, 'Documentation embeds its local search index');
assert.match(searchIndex[1], /Только в подвале/, 'Footer-only public page remains searchable');
assert.match(searchIndex[1], /Скрытая публичная статья/, 'Menu-hidden public page remains searchable');

function writePackage(payload, targetDir) {
  for (const [rawName, value] of Object.entries(payload.package)) {
    const name = String(rawName).replace(/\\/g, '/');
    assert.ok(
      name && !name.startsWith('/') && !name.split('/').includes('..'),
      'Unsafe package path: ' + name
    );
    const target = path.join(targetDir, name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    if (typeof value === 'string') {
      fs.writeFileSync(target, value);
    } else if (value && value.contentBase64) {
      fs.writeFileSync(target, Buffer.from(value.contentBase64, 'base64'));
    } else if (value && value.sourcePath) {
      fs.copyFileSync(value.sourcePath, target);
    } else {
      throw new Error('Unsupported package entry: ' + name);
    }
  }
}

const qaRoot = String(process.env.WEBSTUDIO_V096B_QA_OUT || '').trim();
if (qaRoot) {
  for (const lang of ['ru', 'en']) {
    const langHooks = hooksForLanguage(lang);
    for (const templateId of ['project-landing', 'documentation-wide']) {
      writePackage(
        langHooks.templatePreviewPayload(templateId),
        path.resolve(qaRoot, lang, templateId)
      );
    }
  }
}

console.log('PASS: Documentation V096B dark interaction correction verified');
