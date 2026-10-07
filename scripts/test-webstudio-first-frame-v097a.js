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
const studioCss = fs.readFileSync(
  path.join(
    root,
    'src/modules/editor-site-studio-safe/editor-site-studio-safe-v5.css'
  ),
  'utf8'
);
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

function firstInlineScript(html) {
  const match = String(html).match(/<script>([\s\S]*?)<\/script>/);
  assert.ok(match, 'Generated page contains an inline pre-paint script');
  return match[1];
}

function executeBoot(script, { savedTheme, urlTheme } = {}) {
  const attributes = new Map([['data-theme', 'light']]);
  const documentElement = {
    style: {},
    setAttribute(name, value) {
      attributes.set(name, String(value));
    },
    getAttribute(name) {
      return attributes.get(name) || '';
    }
  };
  const localStorage = {
    getItem(key) {
      return key === 'irgeztne.site.theme' ? savedTheme || null : null;
    }
  };
  const window = {
    location: {
      href: `file:///preview/index.html${urlTheme ? `?theme=${urlTheme}` : ''}`
    }
  };
  const context = {
    window,
    document: { documentElement },
    localStorage,
    URL
  };
  window.window = window;
  window.document = context.document;
  window.localStorage = localStorage;
  vm.runInNewContext(script, context);
  return {
    theme: documentElement.getAttribute('data-theme'),
    colorScheme: documentElement.style.colorScheme,
    backgroundColor: documentElement.style.backgroundColor,
    cachedTheme: window.__IRGEZTNE_INITIAL_THEME__,
    backgrounds: window.__IRGEZTNE_THEME_BACKGROUNDS__
  };
}

const hooks = hooksForLanguage('ru');
assert.ok(hooks, 'Web Studio test hooks are available');

const templates = [
  ['project-landing', '#f4efe8', '#0b1013'],
  ['business-product', '#ffffff', '#07111f'],
  ['blog-news', '#ffffff', '#07111f'],
  ['documentation-wide', '#ffffff', '#07111f'],
  ['studio-portfolio', '#ffffff', '#07111f'],
  ['agency-studio', '#ffffff', '#07111f']
];
let checkedHtmlPages = 0;

function comparableCore(payload) {
  const files = payload.package || {};
  return Object.fromEntries(
    Object.entries(files)
      .filter(([name, value]) =>
        (/\.html?$/i.test(name) ||
          name === 'styles.css' ||
          name === 'assets/css/style.css' ||
          name === 'assets/js/site.js') &&
        (typeof value === 'string' || Buffer.isBuffer(value))
      )
      .sort(([left], [right]) => left.localeCompare(right))
  );
}

for (const [templateId, lightBackground, darkBackground] of templates) {
  const state = hooks.templatePreviewState(templateId);
  const home = state.pages.find((page) => page.slug === 'index') || state.pages[0];
  const galleryPayload = hooks.templatePreviewPayload(templateId);
  const publicPayload = hooks.createPublicSitePayload(state, home);
  const zipPayload = hooks.createZipPayload(state, home);
  const editorPayload = hooks.createEditorPreviewPayload(state, home);

  assert.deepEqual(
    comparableCore(galleryPayload),
    comparableCore(publicPayload),
    `${templateId}: gallery/Premium and public browser use the same generated package`
  );
  assert.deepEqual(
    comparableCore(publicPayload),
    comparableCore(zipPayload),
    `${templateId}: browser and ZIP use the same generated package`
  );
  assert.deepEqual(
    comparableCore(publicPayload),
    comparableCore(editorPayload),
    `${templateId}: editor Preview and public package share the same generated files`
  );

  const htmlPages = Object.entries(publicPayload.package)
    .filter(([name, value]) => /\.html?$/i.test(name) && typeof value === 'string');
  assert.ok(htmlPages.length >= 1, `${templateId}: generated HTML is present`);
  checkedHtmlPages += htmlPages.length;

  for (const [fileName, html] of htmlPages) {
    assert.match(
      html,
      /<meta name="viewport"[^>]*><script>\(function\(\)\{var key="irgeztne\.site\.theme";var backgrounds=/,
      `${templateId}/${fileName}: theme and canvas resolve synchronously in the head`
    );
    assert.match(
      html,
      /<body[^>]*><script>\(function\(\)\{var theme=document\.documentElement\.getAttribute\("data-theme"\)/,
      `${templateId}/${fileName}: resolved theme reaches body before content`
    );

    const dark = executeBoot(firstInlineScript(html), { savedTheme: 'dark' });
    assert.equal(dark.theme, 'dark', `${templateId}/${fileName}: saved dark theme wins`);
    assert.equal(dark.colorScheme, 'dark', `${templateId}/${fileName}: dark color scheme is pre-painted`);
    assert.equal(dark.backgroundColor, darkBackground, `${templateId}/${fileName}: dark canvas is pre-painted`);
    assert.equal(dark.backgrounds.light, lightBackground, `${templateId}/${fileName}: light canvas belongs to the template`);
    assert.equal(dark.backgrounds.dark, darkBackground, `${templateId}/${fileName}: dark canvas belongs to the template`);

    const light = executeBoot(firstInlineScript(html), { savedTheme: 'light' });
    assert.equal(light.backgroundColor, lightBackground, `${templateId}/${fileName}: light canvas is pre-painted`);
  }

  const indexHtml = String(publicPayload.package['index.html']);
  const urlDark = executeBoot(firstInlineScript(indexHtml), {
    savedTheme: 'light',
    urlTheme: 'dark'
  });
  assert.equal(urlDark.theme, 'dark', `${templateId}: URL theme wins during page navigation`);
  assert.equal(urlDark.backgroundColor, darkBackground, `${templateId}: URL theme paints the correct canvas`);

  const siteJs = String(publicPayload.package['assets/js/site.js']);
  assert.match(
    siteJs,
    /document\.documentElement\.style\.backgroundColor=backgrounds\[theme\]/,
    `${templateId}: manual theme changes keep the root canvas synchronized`
  );
  assert.match(
    siteJs,
    /url\.searchParams\.set\("theme",theme\)/,
    `${templateId}: page links carry the current theme`
  );
}

assert.ok(
  checkedHtmlPages >= 20,
  `The six packages expose their full page set (${checkedHtmlPages} HTML files checked)`
);

assert.doesNotMatch(
  fullSource,
  /data-v5-preview-frame="1" src="about:blank"/,
  'Editor Preview no longer exposes a literal about:blank first frame'
);
assert.match(
  fullSource,
  /data-v5-preview-frame="1" data-v5-preview-loading="1"/,
  'Editor Preview starts behind the browser shell loading canvas'
);
assert.match(
  fullSource,
  /data-v5-template-preview-frame-v095a="1" data-v5-template-preview-loading="1"/,
  'Large template Preview starts behind its shell loading canvas'
);
assert.match(
  studioCss,
  /\.ir-site-studio-v5-preview-frame\s*\{[^}]*background:\s*transparent/,
  'Editor iframe does not force a white backing color'
);
assert.match(
  studioCss,
  /data-v5-preview-loading="1"[^}]*visibility:\s*hidden/,
  'Empty Editor iframe stays hidden until the generated document loads'
);
assert.match(
  studioCss,
  /data-v5-template-preview-loading="1"[^}]*visibility:\s*hidden/,
  'Empty large-template iframe stays hidden until the generated document loads'
);
assert.match(
  fullSource,
  /applyTheme\(initialTheme,false\)/,
  'Landing initial theme resolution does not rewrite persistence'
);
assert.doesNotMatch(
  fullSource,
  /applyTheme\(initialTheme,true\)/,
  'Only a manual toggle persists a new Landing theme'
);

console.log(
  `PASS: all six Web Studio templates share the V097A first-frame contract (${checkedHtmlPages} HTML pages)`
);
