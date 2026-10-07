(function () {
  'use strict';

  const CACHE_KEY = 'irgeztne.economy.widget.cache.v1';
  const ENGINE_URL = 'http://127.0.0.1:8788/v1/widget/economy';
  const REFRESH_URL = 'http://127.0.0.1:8788/v1/refresh';

  function bootstrap() {
    return window.IRGEZTNE_ECONOMY_BOOTSTRAP_V1 || { version: '0.2.0', generated_at: null, countries: [], widgets: {} };
  }

  function hydrate(payload, container) {
    if (!payload) return null;
    const shared = container?.shared || bootstrap().shared || {};
    const instruments = payload.market_instruments?.length ? payload.market_instruments : (shared.market_instruments || []);
    const markets = Object.assign({}, shared.markets_tab || {}, payload.tabs?.markets || {}, { instruments });
    if (!markets.chart && markets.default_instrument_id) {
      markets.chart = instruments.find(function (entry) { return entry.id === markets.default_instrument_id; })?.series || instruments[0]?.series || null;
    }
    return Object.assign({}, payload, {
      market_instruments: instruments,
      tabs: Object.assign({}, payload.tabs || {}, { markets })
    });
  }

  function dehydrate(payload) {
    return Object.assign({}, payload, {
      market_instruments: [],
      tabs: Object.assign({}, payload.tabs || {}, {
        markets: {
          default_instrument_id: payload.tabs?.markets?.default_instrument_id || null,
          status: payload.tabs?.markets?.status || 'source_unavailable',
          disclaimer: payload.tabs?.markets?.disclaimer || 'official_reference_rate_not_live_market'
        }
      })
    });
  }

  function readCache() {
    try {
      const value = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      return value && value.widgets ? value : null;
    } catch (error) {
      return null;
    }
  }

  function writeCache(payload) {
    try {
      const cached = readCache() || { version: payload.version, generated_at: payload.generated_at, countries: bootstrap().countries, widgets: {} };
      cached.version = payload.version;
      cached.generated_at = payload.generated_at;
      cached.countries = payload.countries || cached.countries || bootstrap().countries;
      cached.shared = {
        market_instruments: payload.market_instruments || [],
        markets_tab: payload.tabs?.markets || {}
      };
      cached.widgets[payload.country.id] = dehydrate(payload);
      localStorage.setItem(CACHE_KEY, JSON.stringify(cached));
    } catch (error) {}
  }

  function bundled(countryId) {
    const data = bootstrap();
    return hydrate(data.widgets[countryId] || data.widgets.US || data.widgets[Object.keys(data.widgets || {})[0]] || null, data);
  }

  function cached(countryId) {
    const data = readCache();
    return hydrate(data?.widgets?.[countryId] || null, data);
  }

  async function requestJson(url, options, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(function () { controller.abort(); }, timeoutMs);
    try {
      const response = await fetch(url, Object.assign({ cache: 'no-store', signal: controller.signal }, options || {}));
      if (!response.ok) throw new Error(`Local Data Platform returned ${response.status}`);
      return await response.json();
    } finally {
      clearTimeout(timer);
    }
  }

  async function refreshLocalSources() {
    return requestJson(REFRESH_URL, {
      method: 'POST',
      headers: { 'x-irgeztne-local': '1' }
    }, 30000);
  }

  async function fromLocalEngine(countryId, mode) {
    const payload = await requestJson(`${ENGINE_URL}?country=${encodeURIComponent(countryId)}&mode=${encodeURIComponent(mode || 'compact')}`, null, 3500);
    writeCache(payload);
    return payload;
  }

  async function getWidgetResult(countryId, options) {
    const id = String(countryId || 'US').toUpperCase();
    const settings = options || {};
    const initial = cached(id) || bundled(id);

    if (settings.local === false) {
      return { payload: initial, state: initial ? 'cached' : 'error', error: null };
    }

    try {
      if (settings.refreshSources === true) await refreshLocalSources();
      const payload = await fromLocalEngine(id, settings.mode || 'compact');
      return { payload, state: settings.refreshSources ? 'success' : 'official', error: null };
    } catch (error) {
      return {
        payload: initial,
        state: initial ? (settings.refreshSources ? 'stale' : 'cached') : 'error',
        error: String(error?.message || error)
      };
    }
  }

  async function getWidget(countryId, options) {
    const result = await getWidgetResult(countryId, options);
    return result.payload;
  }

  function countries() {
    return bootstrap().countries || [];
  }

  window.IRGEZTNEEconomyDataCoreV1 = {
    countries,
    getWidget,
    getWidgetResult,
    bundled,
    fromLocalEngine,
    refreshLocalSources
  };
})();
