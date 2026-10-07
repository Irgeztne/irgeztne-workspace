#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const bootstrap = read('src/modules/economy/economy-bootstrap-v1.js');
const dataCore = read('src/modules/economy/economy-data-core-v1.js');
const widget = read('src/modules/economy/economy-widget-core-v1.js');
const css = read('src/modules/economy/economy-widget-v1.css');
const panel = read('src/workspace-cabinet-panel-v0.js');
const proof = read('proofs/economy-widget-standalone.html');
const main = read('main.js');

function makeSandbox(fetchImpl) {
  const values = new Map();
  const sandbox = {
    window: null,
    console,
    Intl,
    URL,
    URLSearchParams,
    AbortController,
    setTimeout,
    clearTimeout,
    fetch: fetchImpl,
    localStorage: {
      getItem(key) { return values.has(key) ? values.get(key) : null; },
      setItem(key, value) { values.set(key, value); }
    }
  };
  sandbox.window = sandbox;
  vm.runInNewContext(bootstrap, sandbox, { filename: 'economy-bootstrap-v1.js' });
  vm.runInNewContext(dataCore, sandbox, { filename: 'economy-data-core-v1.js' });
  vm.runInNewContext(widget, sandbox, { filename: 'economy-widget-core-v1.js' });
  return sandbox;
}

function fakeRoot() {
  return {
    className: '',
    innerHTML: '',
    dataset: {},
    style: { setProperty() {} },
    setAttribute() {},
    removeAttribute() {},
    querySelector() { return null; },
    querySelectorAll() { return []; }
  };
}

(async function () {
  const offline = makeSandbox(async () => { throw new Error('source offline'); });
  const helpers = offline.IRGEZTNEEconomyWidgetCoreV1.__test;
  const az = offline.IRGEZTNEEconomyDataCoreV1.bundled('AZ');
  const inflation = az.metrics.find((metric) => metric.id === 'inflation').series;
  const eurUsd = az.market_instruments.find((instrument) => instrument.label === 'EUR/USD').series;

  assert.deepEqual(Array.from(helpers.rangeOptions('annual'), (entry) => entry.id), ['5Y', '10Y', 'MAX']);
  assert.deepEqual(Array.from(helpers.rangeOptions('monthly_or_event'), (entry) => entry.id), ['1Y', '3Y', '5Y', 'MAX']);
  assert.deepEqual(Array.from(helpers.rangeOptions('business_daily'), (entry) => entry.id), ['1M', '3M', '1Y', '5Y', 'MAX']);
  assert.equal(helpers.filterPointsByRange(inflation.points, 'MAX', inflation.frequency).length, inflation.points.length);
  assert.ok(helpers.filterPointsByRange(inflation.points, '5Y', inflation.frequency).length >= 5);
  assert.ok(helpers.filterPointsByRange(eurUsd.points, '3M', eurUsd.frequency).length > 40);
  assert.ok(helpers.filterPointsByRange(eurUsd.points, '3M', eurUsd.frequency).length < eurUsd.points.length);

  const gapped = [
    { observed_at: '2019-12-31', value: 1 },
    { observed_at: '2020-12-31', value: 2 },
    { observed_at: '2024-12-31', value: 3 },
    { observed_at: '2025-12-31', value: 4 }
  ];
  assert.equal(helpers.segmentPoints(gapped, 'annual').length, 2, 'Missing years must split the SVG line instead of being interpolated.');
  assert.equal(helpers.nearestPointIndex([{ x: 10 }, { x: 50 }, { x: 90 }], 61), 1);
  assert.equal(helpers.formatValue({ value: null, id: 'policy_rate', unit: '%' }, 'en'), '—', 'Missing data must never format as zero.');
  assert.match(helpers.formatValue({ value: 0, id: 'policy_rate', unit: '%' }, 'en'), /^0/, 'A confirmed real zero remains a valid observation.');

  const stale = await offline.IRGEZTNEEconomyDataCoreV1.getWidgetResult('AZ', { mode: 'compact', refreshSources: true });
  assert.equal(stale.state, 'stale');
  assert.ok(stale.payload.tabs.world.chart.points.length >= 10, 'A source failure must preserve the last confirmed graph.');

  const calls = [];
  const online = makeSandbox(async (url, options = {}) => {
    calls.push({ url, options });
    if (url.endsWith('/v1/refresh')) return { ok: true, status: 200, async json() { return { ok: true }; } };
    return { ok: true, status: 200, async json() { return offline.IRGEZTNEEconomyDataCoreV1.bundled('US'); } };
  });
  const refreshed = await online.IRGEZTNEEconomyDataCoreV1.getWidgetResult('US', { mode: 'compact', refreshSources: true });
  assert.equal(refreshed.state, 'success');
  assert.equal(calls.length, 2);
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[0].options.headers['x-irgeztne-local'], '1');
  assert.match(calls[1].url, /\/v1\/widget\/economy\?country=US/);

  offline.document = { documentElement: { lang: 'ru' } };
  const ruWorld = fakeRoot();
  offline.IRGEZTNEEconomyWidgetCoreV1.mount(ruWorld, { mode: 'compact', locale: 'ru', initialCountry: 'AZ' });
  assert(ruWorld.innerHTML.includes('Экономика') && ruWorld.innerHTML.includes('Инфляция'));
  assert.equal((ruWorld.innerHTML.match(/data-economy-metric=/g) || []).length, 2, 'Unavailable Azerbaijan metrics must not occupy primary KPI slots.');
  assert(!ruWorld.innerHTML.includes('>0<'), 'Unavailable data leaked into the rendered UI as zero.');
  const enMarkets = fakeRoot();
  offline.IRGEZTNEEconomyWidgetCoreV1.mount(enMarkets, { mode: 'standalone', locale: 'en', initialCountry: 'US', initialTab: 'markets' });
  assert(enMarkets.innerHTML.includes('Instrument') && enMarkets.innerHTML.includes('EUR/USD'));
  assert(css.includes('body.theme-light .ir-economy-widget') && css.includes('--eco-chart-bg: #f7faff'), 'Light theme data contrast contract is missing.');

  for (const contract of ['pointermove', 'pointerdown', 'data-economy-crosshair', 'data-economy-active-point', 'data-economy-tooltip', 'data-economy-range', 'data-economy-metric', 'data-economy-instrument']) {
    assert(widget.includes(contract), `Missing living-widget interaction contract: ${contract}`);
  }
  assert(!/Chart\.js|Highcharts|echarts|d3\./i.test(widget + css), 'A new chart dependency was introduced.');
  assert((widget + css).includes('#e4ad52') && (widget + css).includes('#dc7a8b') && (widget + css).includes('#a58af5') && (widget + css).includes('#40bea9'), 'Metric-aware data palette is incomplete.');
  assert(panel.includes('data-ir-wc-note') && panel.includes('data-ir-wc-calendar-toggle'), 'Quick Note or Calendar was lost from Information.');
  assert(proof.includes('initialInstrument') && proof.includes('initialRange') && proof.includes('proofTheme'), 'Standalone view does not inherit compact state.');
  assert(main.includes('parsed.pathname === economyProof.pathname'), 'Packaged Electron does not allow the exact local standalone proof.');

  console.log('PASS: real ranges, gaps, missing-value semantics, hover/touch contracts, refresh fallback, shared Full view and data palette verified.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
