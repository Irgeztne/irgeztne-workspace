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
    cachedTheme: window.__IRGEZTNE_INITIAL_THEME__
  };
}

const hooks = hooksForLanguage('ru');
assert.ok(hooks, 'Web Studio test hooks are available');

const landingPayload = hooks.templatePreviewPayload('project-landing');
const docsPayload = hooks.templatePreviewPayload('documentation-wide');
const landingHtml = String(landingPayload.package['index.html']);
const docsHtml = String(docsPayload.package['index.html']);
const docsJs = String(docsPayload.package['assets/js/site.js']);
const docsCss = String(docsPayload.package['assets/css/style.css']);

for (const [label, html] of [
  ['Landing', landingHtml],
  ['Documentation', docsHtml]
]) {
  assert.match(
    html,
    /<meta name="viewport"[^>]*><script>\(function\(\)\{var key="irgeztne\.site\.theme";/,
    `${label} resolves the theme synchronously in the head`
  );
  assert.match(
    html,
    /<body[^>]*><script>\(function\(\)\{var theme=document\.documentElement\.getAttribute\("data-theme"\)/,
    `${label} copies the resolved theme to the body before page content`
  );
}

const savedDark = executeBoot(firstInlineScript(docsHtml), {
  savedTheme: 'dark'
});
assert.deepEqual(
  savedDark,
  { theme: 'dark', colorScheme: 'dark', cachedTheme: 'dark' },
  'Saved dark theme is active before the first paint'
);

const urlDark = executeBoot(firstInlineScript(landingHtml), {
  savedTheme: 'light',
  urlTheme: 'dark'
});
assert.deepEqual(
  urlDark,
  { theme: 'dark', colorScheme: 'dark', cachedTheme: 'dark' },
  'Theme URL propagation wins during local multi-page navigation'
);

assert.doesNotMatch(
  docsCss,
  /body\{[^}]*transition:background/,
  'Theme change no longer animates through the light page background'
);
assert.match(
  docsJs,
  /document\.documentElement\.setAttribute\("data-theme",theme\)/,
  'Deferred runtime keeps the root theme synchronized'
);
assert.match(
  docsJs,
  /url\.searchParams\.set\("theme",theme\)/,
  'Documentation carries the current theme to its HTML pages'
);
assert.doesNotMatch(
  docsJs,
  /var saved="light"/,
  'Deferred runtime does not reset the page to light before reading state'
);

console.log('PASS: Landing and Documentation V096C pre-paint theme verified');
