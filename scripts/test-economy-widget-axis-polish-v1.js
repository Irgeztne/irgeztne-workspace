#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const widgetSource = read('src/modules/economy/economy-widget-core-v1.js');
const styles = read('styles.css');

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
for (const relative of [
  'src/modules/economy/economy-bootstrap-v1.js',
  'src/modules/economy/economy-data-core-v1.js',
  'src/modules/economy/economy-widget-core-v1.js'
]) {
  vm.runInNewContext(read(relative), sandbox, { filename: relative });
}

function fakeRoot() {
  return {
    className: '',
    innerHTML: '',
    dataset: {},
    style: { setProperty() {} },
    querySelector() { return null; },
    querySelectorAll() { return []; }
  };
}

function render(settings) {
  const target = fakeRoot();
  sandbox.IRGEZTNEEconomyWidgetCoreV1.mount(target, settings);
  return target.innerHTML;
}

function axisLabels(html) {
  return Array.from(html.matchAll(/class="ir-economy-axis-text">([^<]+)<\/text>/g), (match) => match[1]).slice(0, 3);
}

const azGdpFull = render({ mode: 'standalone', locale: 'ru', initialCountry: 'AZ', initialMetric: 'gdp' });
const azGdpCompact = render({ mode: 'compact', locale: 'ru', initialCountry: 'AZ', initialMetric: 'gdp' });
assert(axisLabels(azGdpFull).some((label) => label.includes('млрд $')), 'Azerbaijan GDP Full axis is not formatted in billions.');
assert(axisLabels(azGdpCompact).some((label) => label.includes('млрд $')), 'Compact GDP does not share the Full axis formatter.');
assert(!axisLabels(azGdpFull).some((label) => /^\d{10,}/.test(label.replace(/\s/g, ''))), 'Raw GDP source integers leaked into the Full axis.');

const euroGdp = render({ mode: 'standalone', locale: 'en', initialCountry: 'XM', initialMetric: 'gdp' });
assert(axisLabels(euroGdp).some((label) => label.includes('tn USD')), 'Euro area GDP Full axis is not scaled to trillions.');

const inflation = render({ mode: 'standalone', locale: 'en', initialCountry: 'AZ', initialMetric: 'inflation' });
assert(axisLabels(inflation).every((label) => label.endsWith('%')), 'Inflation axis lost percentage formatting.');

const policyRate = render({ mode: 'standalone', locale: 'en', initialCountry: 'XM', initialMetric: 'policy_rate' });
assert(axisLabels(policyRate).every((label) => label.endsWith('%')), 'Policy-rate axis lost percentage formatting.');

const fx = render({ mode: 'standalone', locale: 'en', initialCountry: 'AZ', initialTab: 'markets' });
const fxAxis = axisLabels(fx);
assert(fxAxis.length >= 3 && fxAxis.every((label) => /\d[.,]\d/.test(label) && /[A-Z]{3}$/.test(label)), 'FX axis does not use readable decimal values and quote units.');

assert(widgetSource.includes('formatValue(value, state.locale, axisMetricId, series?.unit)'), 'Y-axis bypasses the shared visible-value formatter.');
assert(widgetSource.includes('longestAxisLabel * 6.8'), 'Y-axis no longer reserves label-aware left padding for the larger labels.');
assert(/\.workspace-toggle-text\s*\{[^}]*font-size:\s*16px[^}]*font-weight:\s*800[^}]*line-height:\s*1/s.test(styles), 'Information toggle title does not have the accepted stronger 16px/800 shell weight.');
assert(/\.workspace-shell-title\s*\{[^}]*font-size:\s*16px/s.test(styles), 'Information panel header size was not raised to 16px.');

console.log('PASS: shared Economy Y-axis formatter, GDP bn/tn scaling, percent/FX labels, safe left padding and Information title sizing verified.');
