#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const bootstrapSource = read('src/modules/economy/economy-bootstrap-v1.js');
const dataCoreSource = read('src/modules/economy/economy-data-core-v1.js');
const widgetSource = read('src/modules/economy/economy-widget-core-v1.js');
const widgetCss = read('src/modules/economy/economy-widget-v1.css');
const panelSource = read('src/workspace-cabinet-panel-v0.js');
const proofSource = read('proofs/economy-widget-standalone.html');
const snapshot = JSON.parse(read('data-platform/data/latest.json'));

function createEnvironment(systemLocale, persistent) {
  const moduleState = persistent || new Map();
  const sandbox = {
    window: null,
    document: { documentElement: { lang: 'ru' } },
    navigator: { language: systemLocale, languages: [systemLocale] },
    console,
    Intl,
    URL,
    URLSearchParams,
    AbortController,
    setTimeout,
    clearTimeout,
    fetch: async () => { throw new Error('offline completion-pass test'); },
    localStorage: { getItem() { return null; }, setItem() {} },
    nsAPI: {
      storageGetModuleStateSync(key, fallback) {
        return moduleState.has(key) ? JSON.parse(JSON.stringify(moduleState.get(key))) : fallback;
      },
      storageSetModuleStateSync(key, value) {
        moduleState.set(key, JSON.parse(JSON.stringify(value)));
        return { ok: true };
      }
    }
  };
  sandbox.window = sandbox;
  vm.runInNewContext(bootstrapSource, sandbox, { filename: 'economy-bootstrap-v1.js' });
  vm.runInNewContext(dataCoreSource, sandbox, { filename: 'economy-data-core-v1.js' });
  vm.runInNewContext(widgetSource, sandbox, { filename: 'economy-widget-core-v1.js' });
  return { sandbox, moduleState };
}

function fakeRoot() {
  const handlers = {};
  return {
    className: '', innerHTML: '', dataset: {},
    style: { setProperty() {} },
    querySelector(selector) {
      if (selector === '[data-economy-open]') {
        return { addEventListener(type, fn) { handlers.open = fn; } };
      }
      return null;
    },
    querySelectorAll() { return []; },
    openFull() { assert.equal(typeof handlers.open, 'function'); handlers.open(); }
  };
}

function activeMetric(html, id) {
  const escaped = String(id).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`class="ir-economy-metric is-active" data-economy-metric="${escaped}"`).test(html);
}

const configuredCountries = snapshot.countries.map((country) => country.id);
assert.equal(configuredCountries.length, 16, 'World coverage must contain 16 real country/region contexts.');
for (const id of ['US', 'XM', 'GB', 'JP', 'CN', 'IN', 'CA', 'BR', 'AU', 'CH', 'TR', 'AZ', 'DE', 'FR', 'KR', 'MX']) {
  assert(configuredCountries.includes(id), `World coverage is missing ${id}.`);
}

const expectedNames = {
  DE: ['Германия', 'Germany'], FR: ['Франция', 'France'],
  KR: ['Южная Корея', 'South Korea'], MX: ['Мексика', 'Mexico']
};
for (const [id, names] of Object.entries(expectedNames)) {
  const country = snapshot.countries.find((entry) => entry.id === id);
  assert.deepEqual([country.name.ru, country.name.en], names, `${id} RU/EN name contract failed.`);
  for (const metricId of ['economy.gdp_current_usd', 'economy.inflation_cpi']) {
    const series = snapshot.series.find((entry) => entry.entity_id === country.entityId && entry.metric_id === metricId);
    assert(series && series.points.length === 15, `${id} ${metricId} must contain 15 real annual observations.`);
    assert.equal(series.source, 'World Bank');
    assert(['NY.GDP.MKTP.CD', 'FP.CPI.TOTL.ZG'].includes(series.source_series));
    assert(series.points.every((point) => point.value != null && Number.isFinite(point.value)), `${id} contains missing/fabricated zero placeholders.`);
    assert(series.points.every((point) => point.observed_at !== point.fetched_at), `${id} confuses observed and fetched time.`);
  }
}

const cleanState = new Map();
const first = createEnvironment('en-US', cleanState);
const firstRoot = fakeRoot();
const firstApi = first.sandbox.IRGEZTNEEconomyWidgetCoreV1.mount(firstRoot, { mode: 'compact', locale: 'ru', systemLocale: 'en-US' });
assert(activeMetric(firstRoot.innerHTML, 'gdp'), 'GDP is not the clean first-use World default.');
assert.equal(firstApi.setCountry('DE'), true);
assert.equal(firstApi.setMetric('inflation'), true);
assert(activeMetric(firstRoot.innerHTML, 'inflation'), 'Manual World indicator selection did not render.');
firstApi.destroy();

const reopened = createEnvironment('en-US', cleanState);
const reopenedRoot = fakeRoot();
const reopenedApi = reopened.sandbox.IRGEZTNEEconomyWidgetCoreV1.mount(reopenedRoot, { mode: 'compact', locale: 'ru', systemLocale: 'en-US' });
assert(/<option value="DE" selected>Германия<\/option>/.test(reopenedRoot.innerHTML), 'Country was not restored after panel reopen/restart.');
assert(activeMetric(reopenedRoot.innerHTML, 'inflation'), 'World indicator was not restored after panel reopen/restart.');
reopenedApi.setLocale('en');
assert(/<option value="DE" selected>Germany<\/option>/.test(reopenedRoot.innerHTML), 'RU/EN changed or lost the selected country.');
assert(activeMetric(reopenedRoot.innerHTML, 'inflation'), 'RU/EN changed the selected indicator.');

assert.equal(reopenedApi.setMetric('gdp'), true);
let fullContext = null;
const transitionRoot = fakeRoot();
const transition = createEnvironment('en-US', cleanState);
transition.sandbox.IRGEZTNEEconomyWidgetCoreV1.mount(transitionRoot, {
  mode: 'compact', locale: 'en', systemLocale: 'en-US',
  onOpenFull(countryId, detail) { fullContext = { countryId, detail }; }
});
transitionRoot.openFull();
assert.equal(fullContext.countryId, 'DE');
assert.equal(fullContext.detail.metric, 'gdp');
assert(panelSource.includes("metric: detail?.metric || ''"), 'Compact does not carry the World indicator to Full.');
assert(proofSource.includes("initialMetric: params.get('metric') || null"), 'Full does not consume the Compact World indicator.');

const dePayload = reopened.sandbox.IRGEZTNEEconomyDataCoreV1.bundled('DE');
assert.equal(dePayload.tabs.world.default_metric_id, 'gdp', 'Data Core still defaults World to Inflation.');
assert.equal(dePayload.metrics.find((metric) => metric.id === 'policy_rate').value, null, 'Missing policy rate became zero.');
assert.equal(dePayload.metrics.find((metric) => metric.id === 'policy_rate').available, false, 'Missing policy rate is not unavailable.');

const helpers = reopened.sandbox.IRGEZTNEEconomyWidgetCoreV1.__test;
const inflation = dePayload.metrics.find((metric) => metric.id === 'inflation');
assert.equal(helpers.itemAccent({ tab: 'world' }, inflation), '#dc7a8b', 'Inflation lost its own series color.');
assert.equal(helpers.effectiveStatus({ requestState: 'cached', payload: dePayload }, inflation.series), 'cached', 'Cached state is not independent from the series color.');
assert.equal(helpers.effectiveStatus({ requestState: 'stale', payload: dePayload }, inflation.series), 'stale', 'Stale state is not explicit.');
assert.equal(helpers.effectiveStatus({ requestState: 'error', payload: dePayload }, inflation.series), 'error', 'Error state is not explicit.');
assert.equal(helpers.effectiveStatus({ requestState: 'official', payload: dePayload }, null), 'unavailable', 'Unavailable data is not explicit.');
const marketState = { tab: 'markets', payload: dePayload };
const marketInstruments = dePayload.market_instruments;
assert(marketInstruments.length >= 2, 'Existing Markets series disappeared.');
assert.notEqual(helpers.itemAccent(marketState, marketInstruments[0]), helpers.itemAccent(marketState, marketInstruments[1]), 'Markets instruments lost their own series colors.');
assert(!/data-data-state[^\n{]*\.ir-economy-line/.test(widgetCss), 'Chart line color is coupled to freshness state.');
assert(/\.ir-economy-state\.is-unavailable/.test(widgetCss), 'Unavailable status has no dedicated visual state.');

assert(/\.ir-economy-axis-text\s*\{[^}]*font:\s*650 12px/s.test(widgetCss), 'Compact chart labels are still micro-sized.');
assert(/\.ir-economy-widget--standalone \.ir-economy-axis-text\s*\{[^}]*font-size:\s*13px/s.test(widgetCss), 'Full chart labels are still micro-sized.');
assert(widgetSource.includes('longestAxisLabel * 6.8'), 'Larger Y-axis labels do not receive enough left padding.');

assert(!/economyWidgetSlice\(snapshot, countryId = 'AZ'/.test(read('data-platform/src/slices.js')), 'Data Core still hardcodes Azerbaijan.');
assert(!/entry\.id === 'AZ'/.test(read('data-platform/src/slices.js')), 'Data Core fallback still hardcodes Azerbaijan.');
assert(!/id === 'inflation' && entry\.available/.test(read('data-platform/src/slices.js')), 'Data Core still prefers Inflation.');

console.log('PASS: Economy completion coverage, persistence, GDP default, status/series separation, readable labels and Compact-to-Full context verified.');
