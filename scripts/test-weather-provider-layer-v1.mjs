import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import {
  createMemoryWeatherCache,
  createWeatherGateway,
  normalizeCoordinates,
  weatherCacheKey
} from '../weather-gateway/core/weather-core.mjs';
import {
  buildMetNorwayUrl,
  createMetNorwayLocationforecastAdapter,
  normalizeMetNorwayLocationforecast
} from '../weather-gateway/providers/met-norway-locationforecast-v2.mjs';
import { createHttpWeatherHandler } from '../weather-gateway/runtime/http-weather-handler.mjs';

const require = createRequire(import.meta.url);
const {
  WEATHER_WINDOW_TITLE,
  createWeatherWindowController
} = require('../src/modules/weather/weather-window-main.cjs');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const results = [];

async function test(name, fn) {
  try {
    await fn();
    results.push({ name, status: 'PASS' });
    process.stdout.write(`PASS ${name}\n`);
  } catch (error) {
    results.push({ name, status: 'FAIL', error: error.message });
    process.stderr.write(`FAIL ${name}: ${error.stack || error}\n`);
  }
}

async function read(relative) {
  return fs.readFile(path.join(root, relative), 'utf8');
}

function sha(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

async function loadWeatherViewModel() {
  const window = {};
  const context = vm.createContext({ window, Intl, Date, Number, String, Array, Object, Math });
  vm.runInContext(await read('src/modules/weather/weather-view-model-v1.js'), context, { filename: 'weather-view-model-v1.js' });
  return window.IRGEZTNEWeatherViewModelV1;
}

async function loadWeatherClient(window, intlImpl = Intl) {
  const context = vm.createContext({ window, URL, Response, structuredClone, console, Date, Intl: intlImpl, Number, String, JSON, Object, Array, Boolean, Math, TypeError, Error, RegExp, Set, Map });
  vm.runInContext(await read('src/modules/weather/weather-client-v1.js'), context, { filename: 'weather-client-v1.js' });
  return window.IRGEZTNEWeatherClientV1;
}

const fixture = JSON.parse(await read('weather-gateway/test/fixtures/met-locationforecast-compact.json'));
const normalized = normalizeMetNorwayLocationforecast(fixture);

await test('coordinates are validated and limited to four decimals', () => {
  assert.deepEqual(normalizeCoordinates({ lat: '47.376945', lon: '8.541744', altitude: '408.4' }), {
    latitude: 47.3769, longitude: 8.5417, altitude: 408
  });
  assert.throws(() => normalizeCoordinates({ lat: 91, lon: 8 }), /latitude/);
  assert.match(weatherCacheKey({ lat: 47.3769, lon: 8.5417 }), /^weather\.v1:/);
});

await test('MET Norway URL contains only normalized forecast coordinates', () => {
  const url = new URL(buildMetNorwayUrl({ lat: 47.376945, lon: 8.541744, altitude: 408 }));
  assert.equal(url.origin + url.pathname, 'https://api.met.no/weatherapi/locationforecast/2.0/compact');
  assert.equal(url.searchParams.get('lat'), '47.3769');
  assert.equal(url.searchParams.get('lon'), '8.5417');
  assert.equal(url.searchParams.get('altitude'), '408');
  assert.deepEqual([...url.searchParams.keys()], ['lat', 'lon', 'altitude']);
});

await test('provider adapter sends identifying User-Agent and conditional validator', async () => {
  let request;
  const adapter = createMetNorwayLocationforecastAdapter({
    userAgent: 'IRGEZTNE-Weather-Test/1.0 (weather@irgeztne.com)',
    fetchImpl: async (url, options) => {
      request = { url, options };
      return new Response(JSON.stringify(fixture), {
        status: 200,
        headers: { Expires: 'Fri, 11 Sep 2026 13:00:00 GMT', 'Last-Modified': 'Fri, 11 Sep 2026 09:00:00 GMT' }
      });
    }
  });
  await adapter.fetchForecast({ lat: 47.3769, lon: 8.5417 }, {
    nowMs: Date.parse('2026-09-11T12:00:00Z'),
    ifModifiedSince: 'Fri, 11 Sep 2026 08:00:00 GMT'
  });
  const headers = new Headers(request.options.headers);
  assert.match(headers.get('User-Agent'), /IRGEZTNE/);
  assert.match(headers.get('User-Agent'), /@/);
  assert.equal(headers.get('If-Modified-Since'), 'Fri, 11 Sep 2026 08:00:00 GMT');
});

await test('provider-specific MET fields normalize into weather.v1 fields', () => {
  assert.equal(normalized.current.temperature_c, 14.2);
  assert.equal(normalized.current.relative_humidity_pct, 68);
  assert.equal(normalized.current.wind_speed_mps, 3.5);
  assert.equal(normalized.current.wind_direction_deg, 248);
  assert.equal(normalized.current.precipitation_1h_mm, 0.1);
  assert.equal(normalized.current.air_pressure_hpa, 1017.4);
  assert.equal(normalized.current.condition.code, 'partly_cloudy');
  assert.equal(normalized.current.condition.phase, 'day');
  assert.equal(normalized.hourly.length, 3);
  assert.equal(normalized.source.organization, 'MET Norway');
});

await test('missing 1-hour precipitation remains null rather than zero', () => {
  assert.equal(normalized.hourly[2].precipitation_1h_mm, null);
});

await test('invalid provider User-Agent is rejected before request', () => {
  assert.throws(() => createMetNorwayLocationforecastAdapter({ userAgent: 'anonymous' }), /identifying/);
});

await test('fresh upstream response is normalized, cached and attributed', async () => {
  const now = Date.parse('2026-09-11T12:00:00Z');
  const gateway = createWeatherGateway({
    now: () => now,
    cache: createMemoryWeatherCache(),
    provider: { async fetchForecast() {
      return {
        status: 'ok', forecast: normalized,
        expiresAt: '2026-09-11T13:00:00.000Z',
        lastModified: 'Fri, 11 Sep 2026 09:00:00 GMT'
      };
    } }
  });
  const result = await gateway.getForecast({ lat: 47.3769, lon: 8.5417 });
  assert.equal(result.statusCode, 200);
  assert.equal(result.payload.api_version, 'weather.v1');
  assert.equal(result.payload.forecast_type, 'model_forecast');
  assert.equal(result.payload.freshness.state, 'fresh');
  assert.equal(result.payload.source.attribution, 'Data source: MET Norway');
});

await test('valid shared cache is reused and UI refresh cannot bypass Expires', async () => {
  let calls = 0;
  const gateway = createWeatherGateway({
    now: () => Date.parse('2026-09-11T12:00:00Z'),
    cache: createMemoryWeatherCache(),
    provider: { async fetchForecast() {
      calls += 1;
      return { status: 'ok', forecast: normalized, expiresAt: '2026-09-11T13:00:00.000Z' };
    } }
  });
  await gateway.getForecast({ lat: 47.3769, lon: 8.5417 });
  const cached = await gateway.getForecast({ lat: 47.3769, lon: 8.5417, force: true });
  assert.equal(calls, 1);
  assert.equal(cached.payload.freshness.state, 'cached');
  assert.equal(cached.payload.freshness.cache, 'hit');
});

await test('expired entry revalidates with If-Modified-Since semantics', async () => {
  let now = Date.parse('2026-09-11T12:00:00Z');
  let calls = 0;
  let validator = null;
  const gateway = createWeatherGateway({
    now: () => now,
    cache: createMemoryWeatherCache(),
    provider: { async fetchForecast(_coordinates, request) {
      calls += 1;
      validator = request.ifModifiedSince;
      if (calls === 1) return {
        status: 'ok', forecast: normalized, expiresAt: '2026-09-11T12:30:00.000Z', lastModified: 'Fri, 11 Sep 2026 09:00:00 GMT'
      };
      return { status: 'not_modified', expiresAt: '2026-09-11T13:30:00.000Z', lastModified: request.ifModifiedSince };
    } }
  });
  await gateway.getForecast({ lat: 47.3769, lon: 8.5417 });
  now = Date.parse('2026-09-11T12:31:00Z');
  const result = await gateway.getForecast({ lat: 47.3769, lon: 8.5417 });
  assert.equal(validator, 'Fri, 11 Sep 2026 09:00:00 GMT');
  assert.equal(result.payload.freshness.state, 'fresh');
  assert.equal(result.payload.freshness.cache, 'revalidated');
});

await test('last confirmed forecast is served stale on provider failure', async () => {
  let now = Date.parse('2026-09-11T12:00:00Z');
  let fail = false;
  const gateway = createWeatherGateway({
    now: () => now,
    cache: createMemoryWeatherCache(),
    provider: { async fetchForecast() {
      if (fail) throw new Error('upstream offline');
      return { status: 'ok', forecast: normalized, expiresAt: '2026-09-11T12:10:00.000Z' };
    } }
  });
  await gateway.getForecast({ lat: 47.3769, lon: 8.5417 });
  fail = true;
  now = Date.parse('2026-09-11T12:11:00Z');
  const result = await gateway.getForecast({ lat: 47.3769, lon: 8.5417 });
  assert.equal(result.statusCode, 200);
  assert.equal(result.payload.freshness.state, 'stale');
  assert.equal(result.payload.current.temperature_c, 14.2);
});

await test('no confirmed forecast becomes unavailable, never a zero-value forecast', async () => {
  const gateway = createWeatherGateway({
    cache: createMemoryWeatherCache(),
    provider: { async fetchForecast() { throw new Error('offline'); } }
  });
  const result = await gateway.getForecast({ lat: 47.3769, lon: 8.5417 });
  assert.equal(result.statusCode, 503);
  assert.equal(result.payload.freshness.state, 'unavailable');
  assert.equal(result.payload.current, null);
});

await test('HTTP boundary exposes only GET weather.v1 and health contracts', async () => {
  const handle = createHttpWeatherHandler({
    cache: createMemoryWeatherCache(),
    provider: { async fetchForecast() { return { status: 'ok', forecast: normalized, expiresAt: '2099-01-01T00:00:00Z' }; } }
  });
  const response = await handle(new Request('https://api.irgeztne.com/weather/v1?lat=47.3769&lon=8.5417&accountId=secret'));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.api_version, 'weather.v1');
  assert.equal(Object.prototype.hasOwnProperty.call(body, 'accountId'), false);
  assert.equal((await handle(new Request('https://api.irgeztne.com/weather/v1', { method: 'POST' }))).status, 405);
  assert.equal((await handle(new Request('https://api.irgeztne.com/weather/v1/health'))).status, 200);
});

await test('Workspace Weather Client sends coordinates only and preserves cached data on failure', async () => {
  const storage = new Map();
  let requestedUrl = '';
  let requestedOptions = null;
  let shouldFail = false;
  const window = {
    localStorage: { getItem: () => null, setItem() {} },
    nsAPI: {
      storageGetModuleStateSync: (key, fallback) => storage.has(key) ? structuredClone(storage.get(key)) : fallback,
      storageSetModuleStateSync: (key, value) => { storage.set(key, structuredClone(value)); return { ok: true }; }
    },
    fetch: async (url, options) => {
      requestedUrl = url;
      requestedOptions = options;
      if (shouldFail) throw new Error('gateway offline');
      return new Response(JSON.stringify({
        api_version: 'weather.v1', forecast_type: 'model_forecast', location: {},
        current: normalized.current, hourly: normalized.hourly,
        freshness: { state: 'fresh', cache: 'miss', fetched_at: '2026-09-11T12:00:00Z' },
        source: normalized.source
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
  };
  const context = vm.createContext({ window, URL, Response, structuredClone, console, Date, Number, String, JSON, Object, Array, Boolean, Math, TypeError, Error, RegExp, Set, Map });
  vm.runInContext(await read('src/modules/weather/weather-client-v1.js'), context, { filename: 'weather-client-v1.js' });
  const client = window.IRGEZTNEWeatherClientV1;
  const place = client.setPlace({ cityEn: 'Zurich', cityRu: 'Цюрих', latitude: 47.3769, longitude: 8.5417, altitude: 408 });
  const fresh = await client.fetchForecast({ place });
  assert.equal(fresh.freshness.state, 'fresh');
  const query = new URL(requestedUrl);
  assert.deepEqual([...query.searchParams.keys()], ['lat', 'lon', 'altitude']);
  assert.equal(requestedUrl.startsWith('https://api.irgeztne.com/weather/v1?'), true);
  assert.equal(requestedOptions.credentials, 'omit');
  assert.equal(requestedOptions.referrerPolicy, 'no-referrer');
  assert.equal(JSON.stringify([...storage.values()]).toLowerCase().includes('account'), false);
  shouldFail = true;
  const stale = await client.fetchForecast({ place });
  assert.equal(stale.freshness.state, 'stale');
  assert.equal(stale.current.temperature_c, 14.2);
  assert.equal(client.getPlace().cityEn, 'Zurich');
});

await test('Open-Meteo is absent from release owner and guarded as development fallback only', async () => {
  const panel = await read('src/workspace-cabinet-panel-v0.js');
  const client = await read('src/modules/weather/weather-client-v1.js');
  const view = await read('src/modules/weather/weather-view-v1.js');
  assert.doesNotMatch(panel, /api\.open-meteo\.com|api\.met\.no/);
  assert.doesNotMatch(client + view, /air_temperature|symbol_code|next_1_hours|locationforecast\/2\.0\/compact/);
  assert.match(client, /IRGEZTNE_WEATHER_DEV_OPEN_METEO_FALLBACK !== true/);
  assert.doesNotMatch(client, /fetch\([^\n]+open-meteo/);
});

await test('compact Weather remains between Clock and Calendar and opens Full Weather', async () => {
  const panel = await read('src/workspace-cabinet-panel-v0.js');
  const clock = panel.indexOf('class="ir-wc-timebox"');
  const weather = panel.indexOf('class="ir-wc-weatherbox"');
  const calendar = panel.indexOf('class="ir-wc-calendar-toggle-v040d"');
  assert.ok(clock > 0 && clock < weather && weather < calendar);
  assert.match(panel, /weather-widget-standalone\.html/);
  assert.match(panel, /weatherOpenFull\(payload\)/);
  assert.match(panel, /payload\.latitude = place\.latitude/);
  assert.match(panel, /payload\.cityRu = place\.cityRu/);
  assert.match(panel, /const payload = \{ lang: getLang\(\) \}/);
  assert.ok(panel.indexOf('weatherOpenFull(payload)') < panel.indexOf("window.open('./proofs/weather-widget-standalone.html?"));
});

await test('Full Weather preserves RU/EN, Dark UI, hourly fields, freshness and provenance', async () => {
  const html = await read('proofs/weather-widget-standalone.html');
  const view = await read('src/modules/weather/weather-view-v1.js');
  const css = await read('src/modules/weather/weather-view-v1.css');
  assert.match(html, /weather-client-v1\.js/);
  assert.match(html, /weather-view-v1\.js/);
  assert.match(view, /relative_humidity_pct/);
  assert.match(view, /precipitation_1h_mm/);
  assert.match(view, /air_pressure_hpa/);
  assert.match(view, /Data source: MET Norway/);
  assert.match(view, /model forecast|model\-forecast/);
  assert.match(view, /params\.get\('lang'\)/);
  assert.doesNotMatch(css, /theme-light|color-scheme:\s*light/);
  assert.match(css, /color-scheme:\s*dark/);
  assert.match(css, /@media \(max-width:\s*560px\)/);
});

await test('standalone Weather is allowlisted without weakening navigation security', async () => {
  const main = await read('main.js');
  assert.match(main, /WEATHER_PROOF_URL/);
  assert.match(main, /parsed\.pathname === weatherProof\.pathname/);
  assert.match(main, /nodeIntegration: false/);
  assert.match(main, /sandbox: true/);
  assert.match(main, /return \{ action: 'deny' \}/);
});

await test('managed Full Weather window never reveals a partial document and survives repeat, minimize, hide and renderer recovery cycles', async () => {
  class FakeWebContents extends EventEmitter {
    constructor() { super(); this.url = ''; this.openHandler = null; }
    getURL() { return this.url; }
    setWindowOpenHandler(handler) { this.openHandler = handler; }
  }
  class FakeBrowserWindow extends EventEmitter {
    static instances = [];
    static failures = 1;
    constructor(options) {
      super();
      this.options = options;
      this.webContents = new FakeWebContents();
      this.destroyed = false;
      this.minimized = false;
      this.visible = false;
      this.loadUrls = [];
      this.showCount = 0;
      this.hideCount = 0;
      this.focusCount = 0;
      this.restoreCount = 0;
      this.title = options.title;
      FakeBrowserWindow.instances.push(this);
    }
    isDestroyed() { return this.destroyed; }
    isMinimized() { return this.minimized; }
    setMenuBarVisibility() {}
    setTitle(value) { this.title = value; }
    show() { this.visible = true; this.showCount += 1; }
    hide() { this.visible = false; this.hideCount += 1; }
    focus() { this.focusCount += 1; }
    restore() { this.minimized = false; this.restoreCount += 1; this.emit('restore'); }
    close() { this.destroyed = true; this.emit('closed'); }
    async loadURL(url) {
      this.loadUrls.push(url);
      assert.equal(this.visible, false, 'Weather child became visible before document load');
      if (FakeBrowserWindow.failures > 0) {
        FakeBrowserWindow.failures -= 1;
        throw new Error('simulated first navigation race');
      }
      this.webContents.url = url;
    }
  }

  const scheduled = [];
  const controller = createWeatherWindowController({
    BrowserWindow: FakeBrowserWindow,
    weatherUrl: 'file:///workspace/proofs/weather-widget-standalone.html',
    preloadPath: '/workspace/src/modules/weather/weather-data-view-preload.cjs',
    schedule: (fn) => scheduled.push(fn)
  });
  const context = { lang: 'ru', latitude: 40.4093, longitude: 49.8671, cityRu: 'Баку', cityEn: 'Baku', timeZone: 'Asia/Baku' };
  assert.deepEqual(await controller.open(context), { ok: true });
  const first = FakeBrowserWindow.instances[0];
  assert.equal(first.options.show, false);
  assert.equal(first.options.webPreferences.preload.endsWith('weather-data-view-preload.cjs'), true);
  assert.equal(first.options.webPreferences.contextIsolation, true);
  assert.equal(first.options.webPreferences.nodeIntegration, false);
  assert.equal(first.options.webPreferences.sandbox, true);
  assert.equal(first.loadUrls.length, 2, 'first navigation must retry once before reveal');
  assert.equal(first.visible, true);
  assert.equal(first.title, WEATHER_WINDOW_TITLE);
  assert.match(first.webContents.getURL(), /weather-widget-standalone\.html\?lang=ru/);

  first.minimized = true;
  assert.deepEqual(await controller.open(context), { ok: true });
  assert.equal(first.restoreCount, 1);
  assert.equal(first.loadUrls.length, 2, 'repeat open must reuse the confirmed document');
  first.hide();
  assert.deepEqual(await controller.open(context), { ok: true });
  assert.equal(first.visible, true);

  first.webContents.emit('render-process-gone');
  assert.equal(first.visible, false);
  assert.equal(scheduled.length, 1);
  scheduled.shift()();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(first.visible, true);
  assert.equal(first.loadUrls.length, 3);

  assert.deepEqual(await controller.open({ ...context, lang: 'en' }), { ok: true });
  assert.match(first.webContents.getURL(), /weather-widget-standalone\.html\?lang=en/);
  first.close();
  assert.deepEqual(await controller.open(context), { ok: true });
  assert.equal(FakeBrowserWindow.instances.length, 2);
  controller.close();
});

await test('Workspace uses the narrow trusted Weather open bridge while Economy keeps its existing open path', async () => {
  const main = await read('main.js');
  const preload = await read('preload.js');
  const panel = await read('src/workspace-cabinet-panel-v0.js');
  assert.match(main, /createWeatherWindowController/);
  assert.match(main, /ipcMain\.handle\('irgeztne:weather:openFull'/);
  assert.match(main, /assertTrustedSender\(event\)/);
  assert.match(preload, /weatherOpenFull: \(payload\) => ipcRenderer\.invoke\('irgeztne:weather:openFull', payload\)/);
  assert.match(panel, /window\.nsAPI && typeof window\.nsAPI\.weatherOpenFull === 'function'/);
  assert.match(panel, /Browser-only proof fallback/);
  assert.match(panel, /window\.open\('\.\/proofs\/economy-widget-standalone\.html\?/);
});

await test('build package includes Weather client and standalone surface', async () => {
  const index = await read('index.html');
  const packageJson = JSON.parse(await read('package.json'));
  assert.ok(index.indexOf('weather-view-model-v1.js') < index.indexOf('weather-client-v1.js'));
  assert.ok(index.indexOf('weather-client-v1.js') < index.indexOf('workspace-cabinet-panel-v0.js'));
  assert.ok(packageJson.build.files.includes('proofs/weather-widget-standalone.html'));
  assert.ok(packageJson.build.files.includes('src/**/*'));
});

await test('normalized condition preserves day, night and polar-twilight phase without provider field leakage', () => {
  const nightFixture = structuredClone(fixture);
  nightFixture.properties.timeseries[0].data.next_1_hours.summary.symbol_code = 'clearsky_night';
  const night = normalizeMetNorwayLocationforecast(nightFixture);
  assert.deepEqual(night.current.condition, { code: 'clear', phase: 'night' });
  const polarFixture = structuredClone(fixture);
  polarFixture.properties.timeseries[0].data.next_1_hours.summary.symbol_code = 'fair_polartwilight';
  const polar = normalizeMetNorwayLocationforecast(polarFixture);
  assert.deepEqual(polar.current.condition, { code: 'mostly_clear', phase: 'polartwilight' });
  assert.equal(Object.prototype.hasOwnProperty.call(night.current.condition, 'symbol_code'), false);
});

await test('condition icons remain phase-correct for daylight, midnight and polar twilight', async () => {
  const model = await loadWeatherViewModel();
  assert.equal(model.conditionIcon({ code: 'clear', phase: 'day' }), '☀');
  assert.equal(model.conditionIcon({ code: 'clear', phase: 'night' }), '☾');
  assert.equal(model.conditionIcon({ code: 'clear', phase: 'polartwilight' }), '◒');
  assert.notEqual(model.conditionIcon({ code: 'clear', phase: 'unknown' }), '☀');
});

await test('semantic UI state separates refresh and availability from condition color', async () => {
  const model = await loadWeatherViewModel();
  const payload = { current: { temperature_c: 14 }, freshness: { state: 'cached' }, check: { status: 'success' } };
  assert.equal(model.semanticState(payload, true, true), 'updating');
  assert.equal(model.semanticState(payload, false, true), 'up_to_date');
  assert.equal(model.semanticState({ ...payload, check: { status: 'failed' } }, false, true), 'stale');
  assert.equal(model.semanticState(null, false, false), 'unavailable');
});

await test('precipitation derivation distinguishes provider zero, positive values and missing values', async () => {
  const model = await loadWeatherViewModel();
  const base = Date.parse('2026-09-11T12:00:00Z');
  const dry = Array.from({ length: 6 }, (_, index) => ({ forecast_time: new Date(base + index * 3600000).toISOString(), precipitation_1h_mm: 0 }));
  assert.equal(JSON.stringify(model.precipitationSummary(dry)), JSON.stringify({ kind: 'none', total_mm: 0, known_count: 6 }));
  const wet = dry.map((point) => ({ ...point }));
  wet[2].precipitation_1h_mm = 0.4;
  assert.equal(model.precipitationSummary(wet).kind, 'upcoming');
  const unknown = dry.map((point) => ({ ...point, precipitation_1h_mm: null }));
  assert.equal(model.precipitationSummary(unknown), null);
});

await test('first-run location has no Zurich release default and uses only reliable time-zone suggestions', async () => {
  const window = { localStorage: { getItem: () => null, setItem() {} } };
  function BakuSystemDateTimeFormat(locale, options) {
    if (options && options.timeZone) return new Intl.DateTimeFormat(locale, options);
    return {
      format: (value) => new Intl.DateTimeFormat(locale).format(value),
      resolvedOptions: () => ({ timeZone: 'Asia/Baku' })
    };
  }
  const client = await loadWeatherClient(window, { DateTimeFormat: BakuSystemDateTimeFormat });
  assert.equal(client.getLocationContext({ timeZone: 'Etc/UTC' }).place, null);
  assert.equal(client.getSystemLocationSuggestion({ timeZone: 'Asia/Tokyo' }).cityEn, 'Tokyo');
  assert.equal(client.getSystemLocationSuggestion({ timeZone: 'Europe/London' }).cityEn, 'London');
  assert.equal(client.getSystemLocationSuggestion({ timeZone: 'Unknown/Zone' }), null);
  assert.equal(client.getSystemLocationSuggestion().cityEn, 'Baku');
  assert.equal(client.developmentFallbackPlace.cityEn, 'Zurich');
  assert.doesNotMatch(await read('src/workspace-cabinet-panel-v0.js'), /DEFAULT_WEATHER_PLACE|WEATHER_ZURICH/);
});

await test('manual location persists through the app-owned Weather host and survives client reload', async () => {
  const state = new Map();
  const host = {
    getStateSync: (slot, fallback) => state.has(slot) ? structuredClone(state.get(slot)) : fallback,
    setStateSync: (slot, value) => { state.set(slot, structuredClone(value)); return { ok: true }; }
  };
  const makeWindow = () => ({ IRGEZTNEWeatherHost: host, localStorage: { getItem: () => null, setItem() {} } });
  const first = await loadWeatherClient(makeWindow());
  first.setPlace({ cityRu: 'Токио', cityEn: 'Tokyo', latitude: 35.6762, longitude: 139.6503, timeZone: 'Asia/Tokyo' }, { source: 'manual' });
  const second = await loadWeatherClient(makeWindow());
  const restored = second.getLocationContext({ timeZone: 'Etc/UTC' });
  assert.equal(restored.saved, true);
  assert.equal(restored.source, 'manual');
  assert.equal(restored.place.cityEn, 'Tokyo');
  assert.equal([...state.keys()].includes('location'), true);
});

await test('successful refresh records a new check time even when forecast values are unchanged', async () => {
  const state = new Map();
  const window = {
    IRGEZTNEWeatherHost: { getStateSync: (slot, fallback) => state.has(slot) ? structuredClone(state.get(slot)) : fallback, setStateSync: (slot, value) => { state.set(slot, structuredClone(value)); return { ok: true }; } },
    localStorage: { getItem: () => null, setItem() {} },
    fetch: async () => new Response(JSON.stringify({ api_version: 'weather.v1', forecast_type: 'model_forecast', current: normalized.current, hourly: normalized.hourly, freshness: { state: 'cached', fetched_at: '2026-09-11T12:00:00Z' }, source: normalized.source }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  };
  const client = await loadWeatherClient(window);
  const place = client.setPlace({ cityRu: 'Токио', cityEn: 'Tokyo', latitude: 35.6762, longitude: 139.6503 }, { source: 'preset' });
  const first = await client.fetchForecast({ place, force: true });
  const second = await client.fetchForecast({ place, force: true });
  assert.equal(second.current.temperature_c, first.current.temperature_c);
  assert.equal(second.check.status, 'success');
  assert.ok(Number.isFinite(Date.parse(second.check.last_successful_check_at)));
  assert.ok(Number.isFinite(Date.parse(second.check.last_attempt_at)));
});

await test('failed refresh retains readable data and its last successful check', async () => {
  const state = new Map(); let fail = false;
  const window = {
    IRGEZTNEWeatherHost: { getStateSync: (slot, fallback) => state.has(slot) ? structuredClone(state.get(slot)) : fallback, setStateSync: (slot, value) => { state.set(slot, structuredClone(value)); return { ok: true }; } },
    localStorage: { getItem: () => null, setItem() {} },
    fetch: async () => { if (fail) throw new Error('offline'); return new Response(JSON.stringify({ api_version: 'weather.v1', forecast_type: 'model_forecast', current: normalized.current, hourly: normalized.hourly, freshness: { state: 'fresh' }, source: normalized.source }), { status: 200, headers: { 'Content-Type': 'application/json' } }); }
  };
  const client = await loadWeatherClient(window);
  const place = client.setPlace({ cityRu: 'Баку', cityEn: 'Baku', latitude: 40.4093, longitude: 49.8671 }, { source: 'preset' });
  const fresh = await client.fetchForecast({ place }); fail = true;
  const stale = await client.fetchForecast({ place, force: true });
  assert.equal(stale.freshness.state, 'stale');
  assert.equal(stale.check.status, 'failed');
  assert.equal(stale.check.last_successful_check_at, fresh.check.last_successful_check_at);
  assert.equal(stale.current.temperature_c, fresh.current.temperature_c);
});

await test('location UX is explicit opt-in and contains no IP, Account or geocoding provider path', async () => {
  const view = await read('src/modules/weather/weather-view-v1.js');
  const client = await read('src/modules/weather/weather-client-v1.js');
  assert.match(view, /data-ir-weather-geolocate/);
  assert.match(view, /navigator\.geolocation\.getCurrentPosition/);
  assert.match(view, /data-ir-weather-manual-form/);
  assert.match(client, /selectionSource/);
  assert.doesNotMatch(view + client, /ipapi|ipinfo|geocode|nominatim|accountId|email/i);
});

await test('RU and EN refresh, stale and two-level provenance copy is complete and non-technical', async () => {
  const view = await read('src/modules/weather/weather-view-v1.js');
  assert.match(view, /Проверено только что/);
  assert.match(view, /Checked just now/);
  assert.match(view, /Обновить не удалось\. Показаны сохранённые данные\./);
  assert.match(view, /Refresh failed\. Showing saved data\./);
  assert.match(view, /Источник данных: MET Norway · Locationforecast 2\.0 ·/);
  assert.match(view, /Data source: MET Norway · Locationforecast 2\.0 ·/);
  assert.match(view, /CC BY 4\.0 \/ NLOD 2\.0/);
  assert.match(view, /Использование данных MET Norway не означает официальной поддержки или рекомендации IRGEZTNE со стороны MET Norway\./);
  assert.match(view, /Use of MET Norway data does not imply endorsement of IRGEZTNE by MET Norway\./);
  assert.doesNotMatch(view, /['"](?:Cache|Cached)['"]/);
});

await test('location dialog uses honest quick-location copy and readable secondary typography in both languages', async () => {
  const view = await read('src/modules/weather/weather-view-v1.js');
  const css = await read('src/modules/weather/weather-view-v1.css');
  assert.match(view, /preset: 'Быстрый выбор'/);
  assert.match(view, /preset: 'Quick locations'/);
  assert.match(css, /\.ir-weather-dialog-card>p\{[^}]*font-size:15px/);
  assert.match(css, /\.ir-weather-dialog label\{[^}]*font-size:14px/);
  assert.match(css, /\.ir-weather-dialog input,\.ir-weather-dialog select\{[^}]*font-size:15px/);
  assert.match(css, /\.ir-weather-privacy-note\{[^}]*font-size:13px/);
});

await test('hourly UX exposes selected state, Now, Today/Tomorrow, controls and all selected-hour fields', async () => {
  const view = await read('src/modules/weather/weather-view-v1.js');
  assert.match(view, /is-selected/);
  assert.match(view, /aria-pressed/);
  assert.match(view, /data-ir-weather-scroll="left"/);
  assert.match(view, /data-ir-weather-scroll="right"/);
  assert.match(view, /next24TemperatureRange/);
  assert.match(view, /relative_humidity_pct/);
  assert.match(view, /wind_speed_mps/);
  assert.match(view, /precipitation_1h_mm/);
  assert.match(view, /air_pressure_hpa/);
  assert.match(view, /now: 'Сейчас'/);
  assert.match(view, /tomorrow: 'Tomorrow'/);
});

await test('Weather child keeps a narrow state/link bridge, exact source allowlist and opt-in location permission', async () => {
  const main = await read('main.js');
  const preload = await read('src/modules/weather/weather-data-view-preload.cjs');
  assert.match(preload, /IRGEZTNEWeatherHost/);
  assert.doesNotMatch(preload, /nsAPI|ipcRenderer:\s*ipcRenderer|require:\s*require/);
  assert.match(main, /WEATHER_STATE_KEYS/);
  assert.match(main, /assertWeatherDataViewSender/);
  assert.match(main, /WEATHER_OFFICIAL_LINKS/);
  assert.match(main, /permission === 'geolocation' && isWeatherDataViewUrl/);
  assert.match(main, /https:\/\/api\.met\.no\/doc\/License/);
  assert.match(main, /locationforecast\/2\.0\/documentation/);
});

await test('Full Weather save notifies the trusted main renderer and Compact reloads the canonical saved location', async () => {
  const main = await read('main.js');
  const mainPreload = await read('preload.js');
  const childPreload = await read('src/modules/weather/weather-data-view-preload.cjs');
  const view = await read('src/modules/weather/weather-view-v1.js');
  const panel = await read('src/workspace-cabinet-panel-v0.js');

  const childSent = [];
  let weatherHost;
  vm.runInNewContext(childPreload, {
    require: (id) => {
      assert.equal(id, 'electron');
      return {
        contextBridge: { exposeInMainWorld: (name, api) => { if (name === 'IRGEZTNEWeatherHost') weatherHost = api; } },
        ipcRenderer: { send: (channel) => childSent.push(channel), sendSync: () => ({ ok: true }), invoke: async () => ({ ok: true }) }
      };
    }
  });
  weatherHost.notifyLocationChanged();
  assert.deepEqual(childSent, ['irgeztne:weather:locationChanged']);

  const mainListeners = new Map();
  let nsAPI;
  vm.runInNewContext(mainPreload, {
    console,
    require: (id) => {
      assert.equal(id, 'electron');
      return {
        contextBridge: { exposeInMainWorld: (name, api) => { if (name === 'nsAPI') nsAPI = api; } },
        ipcRenderer: {
          invoke: async () => ({ ok: true }),
          sendSync: () => null,
          on: (channel, listener) => mainListeners.set(channel, listener),
          removeListener: (channel, listener) => { if (mainListeners.get(channel) === listener) mainListeners.delete(channel); }
        },
        clipboard: { readText: () => '', writeText: () => {} }
      };
    }
  });
  let compactNotificationCount = 0;
  const unsubscribe = nsAPI.onWeatherLocationChanged(() => { compactNotificationCount += 1; });
  mainListeners.get('irgeztne:weather:locationChanged')();
  assert.equal(compactNotificationCount, 1);
  unsubscribe();
  assert.equal(mainListeners.has('irgeztne:weather:locationChanged'), false);

  assert.match(main, /ipcMain\.on\('irgeztne:weather:locationChanged',[\s\S]*?assertWeatherDataViewSender\(event\)[\s\S]*?webContents\.getURL\(\) === INDEX_URL[\s\S]*?webContents\.send\('irgeztne:weather:locationChanged'\)/);
  assert.ok(view.indexOf('client.setPlace(place') < view.indexOf('host.notifyLocationChanged()'));
  assert.match(panel, /onWeatherLocationChanged\(function \(\) \{[\s\S]*?updateWeather\(panel, true\)/);
  assert.match(panel, /const requestSequence = \+\+weatherRequestSequence/);
  assert.match(panel, /requestSequence === weatherRequestSequence/);
  assert.doesNotMatch(main + mainPreload + childPreload + panel, /setInterval\([^)]*Weather|weather[^\n]*poll/i);
});

await test('Weather polish remains Dark-only, responsive and reduced-motion aware', async () => {
  const css = await read('src/modules/weather/weather-view-v1.css');
  assert.match(css, /color-scheme:dark/);
  assert.doesNotMatch(css, /theme-light|color-scheme:light/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(css, /@media \(max-width:560px\)/);
  assert.match(css, /\.ir-weather-source p\{[^}]*font-size:15px/);
  assert.match(css, /--wx-bg:#030c18/);
  assert.match(css, /--wx-surface:#0b2038/);
  assert.match(css, /background:rgba\(3,17,33,\.62\)/);
});

await test('accepted Economy runtime owners remain byte-identical', async () => {
  assert.equal(sha(await read('src/modules/economy/economy-widget-core-v1.js')), 'c6e15661d4ed386d132b5e66538b89a80439e6881348a1c3c808ef60d4e6e330');
  assert.equal(sha(await read('scripts/test-economy-widget-completion-pass-v1.js')), '188c612f1c519f31b3e24c5387ed6b174bba460651604b611fa1bef179dc3ecc');
});

const failed = results.filter((entry) => entry.status === 'FAIL');
process.stdout.write(`\nWeather Provider Layer v1: ${results.length - failed.length}/${results.length} PASS\n`);
if (failed.length) process.exitCode = 1;
