'use strict';

const WEATHER_WINDOW_TITLE = 'IRGEZTNE Weather';

function finiteNumber(value) {
  if (value === null || value === '' || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function boundedText(value, maxLength) {
  const text = String(value == null ? '' : value).trim();
  if (text.length > maxLength) throw new TypeError('Invalid Weather window context');
  return text;
}

function normalizeWeatherWindowContext(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('Invalid Weather window context');
  }

  const context = { lang: value.lang === 'en' ? 'en' : 'ru' };
  const latitude = finiteNumber(value.latitude);
  const longitude = finiteNumber(value.longitude);
  const hasCoordinateInput = value.latitude !== null && value.latitude !== '' && value.latitude !== undefined ||
    value.longitude !== null && value.longitude !== '' && value.longitude !== undefined;

  if (!hasCoordinateInput) return context;
  if (latitude === null || latitude < -90 || latitude > 90 ||
      longitude === null || longitude < -180 || longitude > 180) {
    throw new TypeError('Invalid Weather window coordinates');
  }

  context.latitude = latitude;
  context.longitude = longitude;
  const altitude = finiteNumber(value.altitude);
  if (altitude !== null) context.altitude = altitude;
  context.cityRu = boundedText(value.cityRu, 80);
  context.cityEn = boundedText(value.cityEn, 80);
  context.timeZone = boundedText(value.timeZone, 80);
  context.locationSource = boundedText(value.locationSource, 48);
  return context;
}

function buildWeatherWindowUrl(baseUrl, value) {
  const context = normalizeWeatherWindowContext(value);
  const url = new URL(baseUrl);
  url.search = '';
  url.searchParams.set('lang', context.lang);
  if (context.latitude !== undefined) {
    url.searchParams.set('lat', String(context.latitude));
    url.searchParams.set('lon', String(context.longitude));
    url.searchParams.set('altitude', context.altitude === undefined ? '' : String(context.altitude));
    url.searchParams.set('cityRu', context.cityRu || '');
    url.searchParams.set('cityEn', context.cityEn || '');
    url.searchParams.set('timeZone', context.timeZone || '');
    url.searchParams.set('locationSource', context.locationSource || 'workspace');
  }
  return url.toString();
}

function createWeatherWindowController(options = {}) {
  const BrowserWindow = options.BrowserWindow;
  const baseUrl = String(options.weatherUrl || '');
  const preloadPath = String(options.preloadPath || '');
  const schedule = typeof options.schedule === 'function' ? options.schedule : (fn) => setTimeout(fn, 0);
  if (typeof BrowserWindow !== 'function' || !baseUrl || !preloadPath) {
    throw new TypeError('Weather window controller dependencies are required');
  }

  let active = null;

  function alive(state) {
    return Boolean(state && state.window && !state.window.isDestroyed());
  }

  function isWeatherUrl(value) {
    try {
      const actual = new URL(String(value || ''));
      const expected = new URL(baseUrl);
      return actual.protocol === 'file:' && actual.pathname === expected.pathname;
    } catch (_) {
      return false;
    }
  }

  function reveal(state) {
    if (!alive(state) || !state.ready || !isWeatherUrl(state.window.webContents.getURL())) return;
    if (state.window.isMinimized()) state.window.restore();
    state.window.setTitle(WEATHER_WINDOW_TITLE);
    state.window.show();
    state.window.focus();
  }

  async function ensureLoaded(state, requestedUrl) {
    if (!alive(state)) throw new Error('Weather window was closed');
    if (state.ready && state.loadedUrl === requestedUrl && state.window.webContents.getURL() === requestedUrl) return;

    if (state.loading) {
      await state.loading.catch(() => {});
      if (!alive(state)) throw new Error('Weather window was closed');
      if (state.ready && state.loadedUrl === requestedUrl && state.window.webContents.getURL() === requestedUrl) return;
    }

    state.ready = false;
    state.targetUrl = requestedUrl;
    state.window.hide();
    state.loading = (async () => {
      let lastError = null;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          await state.window.loadURL(requestedUrl);
          if (!alive(state)) throw new Error('Weather window was closed');
          if (!isWeatherUrl(state.window.webContents.getURL())) throw new Error('Unexpected Weather document');
          state.loadedUrl = requestedUrl;
          state.ready = true;
          state.window.setTitle(WEATHER_WINDOW_TITLE);
          return;
        } catch (error) {
          lastError = error;
        }
      }
      throw lastError || new Error('Weather document failed to load');
    })();

    try {
      await state.loading;
    } finally {
      state.loading = null;
    }
  }

  function recover(state) {
    if (!alive(state) || !state.targetUrl || state.recoveryScheduled) return;
    state.ready = false;
    state.recoveryScheduled = true;
    state.window.hide();
    schedule(() => {
      state.recoveryScheduled = false;
      if (!alive(state)) return;
      void ensureLoaded(state, state.targetUrl).then(() => reveal(state)).catch(() => {});
    });
  }

  function createState(targetUrl) {
    const window = new BrowserWindow({
      width: 1180,
      height: 820,
      minWidth: 760,
      minHeight: 620,
      show: false,
      title: WEATHER_WINDOW_TITLE,
      backgroundColor: '#030c18',
      autoHideMenuBar: true,
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webSecurity: true,
        allowRunningInsecureContent: false
      }
    });
    const state = {
      window,
      targetUrl,
      loadedUrl: '',
      ready: false,
      loading: null,
      recoveryScheduled: false
    };
    active = state;

    window.setMenuBarVisibility(false);
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    window.webContents.on('will-navigate', (event, url) => {
      if (!isWeatherUrl(url)) event.preventDefault();
    });
    window.webContents.on('render-process-gone', () => recover(state));
    window.on('restore', () => {
      if (!state.ready) recover(state);
    });
    window.on('closed', () => {
      if (active === state) active = null;
    });
    return state;
  }

  async function open(value) {
    const targetUrl = buildWeatherWindowUrl(baseUrl, value);
    let state = active;
    if (!alive(state)) state = createState(targetUrl);
    state.targetUrl = targetUrl;
    try {
      await ensureLoaded(state, targetUrl);
      reveal(state);
      return { ok: true };
    } catch (error) {
      if (alive(state)) state.window.hide();
      return { ok: false, error: 'weather-view-load-failed' };
    }
  }

  function close() {
    if (alive(active)) active.window.close();
    active = null;
  }

  return Object.freeze({ open, close });
}

module.exports = Object.freeze({
  WEATHER_WINDOW_TITLE,
  normalizeWeatherWindowContext,
  buildWeatherWindowUrl,
  createWeatherWindowController
});
