#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const codehubPath = path.join(root, 'src/v88-codehub-v1.js');
let code = fs.readFileSync(codehubPath, 'utf8');

function has(haystack, needle, message) {
  if (!haystack.includes(needle)) throw new Error(message);
}
function lacks(haystack, needle, message) {
  if (haystack.includes(needle)) throw new Error(message);
}
function between(source, start, end) {
  const a = source.indexOf(start);
  const b = source.indexOf(end, a + start.length);
  if (a < 0 || b < 0) throw new Error('Could not isolate code segment: ' + start);
  return source.slice(a, b);
}

has(code, 'IRGEZTNE_WORKSHOP_INSTALLED_UX_CLARITY_R1W8E', 'Missing R1W8E owner marker');

const headCode = between(code, '  function renderSurfaceHead(surface) {', '  function isMyPackagesView() {');
lacks(headCode, 'data-codehub-action="new-item"', 'New Package still lives in the global Workshop header');
lacks(headCode, 'data-codehub-nav="rules"', 'How it works still lives in the global Workshop header');
has(headCode, 'renderTopNav()', 'Workshop primary navigation is missing from the header');

const creatorActionsCode = between(code, '  function renderMyPackagesActions() {', '  function renderSurfaceBody(surface, context) {');
has(creatorActionsCode, 'data-codehub-action="new-item"', 'New Package is missing from My Packages actions');
has(creatorActionsCode, 'data-codehub-nav="rules"', 'How it works is missing from My Packages actions');

const installedCode = between(code, '  function renderInstalledView() {', '  function renderHomeView(surface, context) {');
has(installedCode, "t('Перетащите ZIP-файл сюда', 'Drop a ZIP file here')", 'Installed drop zone is not explicit');
has(installedCode, "t('Выбрать ZIP', 'Choose ZIP')", 'ZIP file picker is not labeled as a selection action');
lacks(installedCode, "t('Установить ZIP', 'Install ZIP')", 'Installed view still labels the file picker as an immediate install action');
has(installedCode, 'uiState.installFeedback', 'Installed view does not render persistent ZIP feedback');
has(installedCode, "t('Статус ZIP', 'ZIP status')", 'ZIP feedback lacks a clear status label');
has(installedCode, 'После успешной проверки установленный пакет появится здесь.', 'Empty Installed state does not explain where a successful package appears');
has(installedCode, 'Удалить установленный', 'Installed package remove action was lost');

has(code, "setInstallFeedback('working'", 'ZIP validation does not expose an in-panel working state');
has(code, "setInstallFeedback('success'", 'ZIP install/uninstall does not expose success feedback');
has(code, "setInstallFeedback('error'", 'ZIP rejection does not expose failure feedback');
has(code, 'ZIP успешно проверен и установлен. Пакет появился в разделе «Установленные».', 'Successful installation does not explain where the package went');

// Expose a small render-only surface for a focused behavioral check.
code = code.replace(
  '  const api = {',
  '  window.__R1W8E_TEST = { renderSurfaceHead, renderInstalledView, renderHomeView, setInstallFeedback };\n\n  const api = {'
);

const localStorageData = new Map();
const windowStub = {
  NSCodeHubStore: {
    subscribe() { return function () {}; },
    getCounts() { return { all: 0, draft: 0, validated: 0, ready: 0, submitted: 0 }; },
    getActiveItem() { return null; },
    getAll() { return []; }
  },
  localStorage: {
    getItem(key) { return localStorageData.has(key) ? localStorageData.get(key) : null; },
    setItem(key, value) { localStorageData.set(key, String(value)); }
  },
  addEventListener() {},
  removeEventListener() {}
};
const documentStub = {
  readyState: 'loading',
  documentElement: { lang: 'ru' },
  querySelectorAll() { return []; },
  addEventListener() {},
  dispatchEvent() {},
  getElementById() { return null; },
  createElement() { return { id: '', textContent: '', appendChild() {} }; },
  head: { appendChild() {} }
};
const context = {
  window: windowStub,
  document: documentStub,
  console,
  CustomEvent: function CustomEvent() {},
  FileReader: function FileReader() {},
  TextEncoder,
  TextDecoder,
  Uint8Array,
  ArrayBuffer,
  DataView,
  Blob,
  URL
};
vm.runInNewContext(code, context, { filename: 'v88-codehub-v1.js' });
const api = windowStub.__R1W8E_TEST;
if (!api) throw new Error('R1W8E private test hooks were not injected');

const head = api.renderSurfaceHead('cabinet');
has(head, 'Каталог', 'Catalog navigation is missing');
has(head, 'Установленные', 'Installed navigation is missing');
has(head, 'Мои пакеты', 'My Packages navigation is missing');
lacks(head, 'Новый пакет', 'New Package leaked back into the global header');
lacks(head, 'Как это работает', 'How it works leaked back into the global header');

const home = api.renderHomeView('cabinet', {
  counts: { all: 0, draft: 0, validated: 0, ready: 0, submitted: 0 },
  allItems: []
});
has(home, 'Новый пакет', 'New Package is not available inside My Packages');
has(home, 'Как это работает', 'How it works is not available inside My Packages');

let installed = api.renderInstalledView();
has(installed, 'Перетащите ZIP-файл сюда', 'Installed view drop instruction is missing');
has(installed, 'Выбрать ZIP', 'Installed view ZIP picker is missing');
has(installed, 'Установленных пакетов пока нет', 'Installed empty state is missing');

api.setInstallFeedback('error', 'ZIP не установлен: тестовая причина');
installed = api.renderInstalledView();
has(installed, 'Статус ZIP', 'Persistent ZIP status block is missing');
has(installed, 'ZIP не установлен: тестовая причина', 'Persistent ZIP error detail is missing');

console.log('PASS: R1W8E keeps only the three primary Workshop modes in the header, moves creator actions into My Packages, and makes ZIP selection/result location explicit');
