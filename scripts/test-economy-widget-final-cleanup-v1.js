#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const index = read('index.html');
const i18n = read('src/i18n.js');
const panel = read('src/workspace-cabinet-panel-v0.js');
const bootstrap = read('src/modules/economy/economy-bootstrap-v1.js');
const dataCore = read('src/modules/economy/economy-data-core-v1.js');
const widget = read('src/modules/economy/economy-widget-core-v1.js');
const proof = read('proofs/economy-widget-standalone.html');

function makeRoot() {
  return {
    className: '',
    innerHTML: '',
    dataset: {},
    style: { setProperty() {} },
    querySelector() { return null; },
    querySelectorAll() { return []; }
  };
}

const sandbox = {
  window: null,
  document: { documentElement: { lang: 'ru' } },
  console,
  Intl,
  URL,
  URLSearchParams,
  AbortController,
  setTimeout,
  clearTimeout,
  fetch: async () => { throw new Error('offline test'); },
  localStorage: { getItem() { return null; }, setItem() {} }
};
sandbox.window = sandbox;
vm.runInNewContext(bootstrap, sandbox, { filename: 'economy-bootstrap-v1.js' });
vm.runInNewContext(dataCore, sandbox, { filename: 'economy-data-core-v1.js' });
vm.runInNewContext(widget, sandbox, { filename: 'economy-widget-core-v1.js' });

const compact = makeRoot();
sandbox.IRGEZTNEEconomyWidgetCoreV1.mount(compact, { mode: 'compact', locale: 'ru', initialCountry: 'AZ' });
assert(compact.innerHTML.includes('data-economy-open'), 'Compact Economy lost its Full view entry point.');
assert(compact.innerHTML.includes('Открыть полностью'), 'Compact RU Full view label is missing.');

const full = makeRoot();
sandbox.IRGEZTNEEconomyWidgetCoreV1.mount(full, { mode: 'standalone', locale: 'en', initialCountry: 'AZ' });
assert(!full.innerHTML.includes('data-economy-open'), 'Full Economy must not render a second Full view entry point.');
assert(!full.innerHTML.includes('Open full view'), 'Full Economy still exposes the repeated Full view label.');
assert(full.innerHTML.includes('Official historical data'), 'Full Economy lost its product-facing data caption.');

assert(proof.includes("? 'IRGEZTNE Economy' : 'Экономика'"), 'Full Economy RU/EN product title contract is missing.');
assert(proof.includes('Official economic data and historical indicators.'), 'Full Economy EN description is missing.');
assert(proof.includes('Официальные экономические данные и исторические показатели.'), 'Full Economy RU description is missing.');
for (const leaked of ['standalone proof', 'Standalone proof:', 'Автономная проверка:', 'shared renderer', 'единый Data Core']) {
  assert(!proof.includes(leaked), `Full Economy still contains development copy: ${leaked}`);
}

assert(index.includes('<span class="workspace-toggle-text">Информация</span>'), 'Initial RU Information panel toggle is missing.');
assert(index.includes('<span>Информация</span>'), 'Initial RU Information panel header is missing.');
assert(i18n.includes("information: 'Information'"), 'EN Information panel label is missing.');
assert(i18n.includes("information: 'Информация'"), 'RU Information panel label is missing.');
assert(i18n.includes("setText('#workspaceToggle .workspace-toggle-text', dict.information)"), 'Information toggle is not locale-owned.');
assert(i18n.includes("setText('.workspace-shell-title span:last-child', dict.information)"), 'Information shell header is not locale-owned.');
assert(panel.includes("workspaceText.includes('information')") && panel.includes("workspaceText.includes('информация')"), 'Information rename broke panel locale detection.');

for (const preserved of ['data-ir-wc-time', 'data-ir-wc-date', 'data-ir-wc-weather', 'data-ir-wc-calendar-toggle', 'data-ir-economy-widget', 'data-ir-wc-note']) {
  assert(panel.includes(preserved), `Information panel control was lost: ${preserved}`);
}

console.log('PASS: Economy product copy, Compact-to-Full contract, Information RU/EN rename and preserved panel controls verified.');
