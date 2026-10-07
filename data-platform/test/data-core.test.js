import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { economyWidgetSlice, selectSeries } from '../src/slices.js';
import { preserveFailedSources } from '../src/store.js';
import { handle } from '../src/server.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const snapshot = JSON.parse(await fs.readFile(path.resolve(here, '../data/latest.json'), 'utf8'));

assert.equal(snapshot.engine, 'IRGEZTNE Data Platform');
assert.equal(snapshot.version, '0.2.0');
assert.ok(snapshot.series.length >= 35, 'Expected official historical series from all configured adapters.');
assert.deepEqual(Object.keys(snapshot.source_status).sort(), ['bis', 'ecb', 'worldbank']);
assert.equal(snapshot.countries.length, 16, 'Economy World coverage must expose 16 verified country/region contexts.');
Object.values(snapshot.source_status).forEach((status) => {
  assert.equal(status.ok, true, `${status.source_name} was not refreshed successfully`);
  assert.ok(status.count > 0, `${status.source_name} returned no observations`);
  assert.match(status.checked_at, /^\d{4}-\d{2}-\d{2}T/);
});

for (const series of snapshot.series) {
  assert.ok(series.id && series.entity_id && series.metric_id);
  assert.ok(series.points.length >= 2, `${series.id} has no usable history`);
  let previousDate = '';
  const dates = new Set();
  for (const point of series.points) {
    assert.equal(point.series_id, series.id);
    assert.ok(Number.isFinite(point.value), `${series.id} contains a non-numeric observation`);
    assert.ok(point.source && point.source_series && point.fetched_at && point.observed_at);
    assert.ok(point.frequency && point.status && point.usage_note);
    assert.ok(point.observed_at >= previousDate, `${series.id} is not chronological`);
    assert.ok(!dates.has(point.observed_at), `${series.id} contains duplicate observations`);
    dates.add(point.observed_at);
    previousDate = point.observed_at;
  }
}

const azInflation = selectSeries(snapshot, 'country.AZ', 'economy.inflation_cpi');
assert.ok(azInflation && azInflation.points.length >= 10, 'Azerbaijan inflation history is missing.');
assert.equal(azInflation.source, 'World Bank');
assert.equal(azInflation.source_series, 'FP.CPI.TOTL.ZG');

const ecbReference = selectSeries(snapshot, 'fx.EUR_USD', 'market.reference_rate');
assert.ok(ecbReference && ecbReference.points.length >= 100, 'ECB EUR/USD reference history is missing.');
assert.equal(ecbReference.source, 'European Central Bank');
assert.ok(new Set(ecbReference.points.map((point) => point.value)).size > 20, 'ECB history looks synthetic or constant.');

const widget = economyWidgetSlice(snapshot, 'AZ', 'compact');
assert.equal(widget.country.id, 'AZ');
assert.equal(widget.tabs.world.chart.source, 'World Bank');
assert.equal(widget.tabs.markets.chart.source, 'European Central Bank');
assert.equal(widget.tabs.markets.disclaimer, 'official_reference_rate_not_live_market');
assert.ok(widget.metrics.every((metric) => metric.status !== 'current' || metric.observed_at), 'Freshness without an observation is forbidden.');
assert.equal(widget.metrics.find((metric) => metric.id === 'policy_rate').value, null, 'Missing Azerbaijan policy rate must not become zero.');
assert.equal(widget.metrics.find((metric) => metric.id === 'eur_fx').value, null, 'Missing Azerbaijan FX must not become zero.');
assert.ok(widget.metrics.filter((metric) => metric.available).every((metric) => metric.series.points.length >= 2), 'Selectable World metrics need real history.');
assert.equal(widget.market_instruments.length, 10, 'Markets must be built from the real ECB instrument coverage.');
assert.ok(widget.market_instruments.every((instrument) => instrument.label.startsWith('EUR/') && instrument.series.points.length >= 100));

for (const countryId of ['DE', 'FR', 'KR', 'MX']) {
  const expanded = economyWidgetSlice(snapshot, countryId, 'compact');
  assert.equal(expanded.country.id, countryId);
  assert.equal(expanded.tabs.world.default_metric_id, 'gdp', `${countryId} must default to GDP.`);
  for (const metricId of ['gdp', 'inflation']) {
    const item = expanded.metrics.find((metric) => metric.id === metricId);
    assert.equal(item.available, true, `${countryId} ${metricId} is unavailable.`);
    assert.equal(item.source, 'World Bank');
    assert.equal(item.series.points.length, 15, `${countryId} ${metricId} history is incomplete.`);
    assert.ok(item.series.points.every((point) => point.value != null && Number.isFinite(point.value)), `${countryId} ${metricId} contains an invalid value.`);
  }
  assert.equal(expanded.metrics.find((metric) => metric.id === 'policy_rate').value, null, `${countryId} missing policy rate became zero.`);
}

const failedSource = snapshot.series[0].source;
const previous = { series: snapshot.series.filter((series) => series.source === failedSource).slice(0, 1) };
const preserved = preserveFailedSources(previous, [], {
  source: { ok: false, source_name: failedSource, status: 'source_unavailable' }
});
assert.equal(preserved.length, 1);
assert.ok(preserved[0].points.every((point) => point.status === 'cached'), 'Failed source must preserve confirmed values as cached.');
assert.ok(preserved[0].points.every((point) => Number.isFinite(point.value)), 'Failure handling must not inject zero/null observations.');

async function request(url) {
  let body = '';
  const headers = {};
  const response = {
    statusCode: 0,
    setHeader(name, value) { headers[name] = value; },
    end(value) { body = value; }
  };
  await handle({ url, method: 'GET', headers: { host: '127.0.0.1:8788' } }, response);
  return { status: response.statusCode, headers, body: JSON.parse(body) };
}

const health = await request('/v1/health');
assert.equal(health.status, 200);
assert.equal(health.body.ok, true);
const summary = await request('/v1/entity/country.AZ/summary');
assert.equal(summary.status, 200);
assert.equal(summary.body.country.id, 'AZ');
const seriesResponse = await request('/v1/series/country.AZ/economy.inflation_cpi?start=2020-01-01');
assert.equal(seriesResponse.status, 200);
assert.ok(seriesResponse.body.points.length >= 5);
const widgetResponse = await request('/v1/widget/economy?country=AZ&mode=compact');
assert.equal(widgetResponse.status, 200);
assert.equal(widgetResponse.body.country.id, 'AZ');
assert.equal(widgetResponse.headers['access-control-allow-origin'], 'null');
const defaultWidgetResponse = await request('/v1/widget/economy');
assert.equal(defaultWidgetResponse.status, 200);
assert.equal(defaultWidgetResponse.body.country.id, 'US', 'Canonical API fallback must be United States.');
assert.equal(defaultWidgetResponse.body.tabs.world.default_metric_id, 'gdp', 'Canonical API World default must be GDP.');
const deniedRefresh = await request('/v1/refresh');
assert.equal(deniedRefresh.status, 403, 'Network-triggered refresh must require an explicit local capability.');

console.log('PASS: canonical official history, provenance, local API slices and cached-source fallback verified.');
