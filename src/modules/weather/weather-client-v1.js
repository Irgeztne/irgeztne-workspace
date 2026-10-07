(function (global) {
  'use strict';

  const API_VERSION = 'weather.v1';
  const STATE_KEY = 'irgeztne.weather.client.v1';
  const CACHE_KEY = 'irgeztne.weather.cache.v1';
  const PROOF_STORAGE_PREFIX = 'irgeztne.weather.proof.';
  const LEGACY_SETTINGS_KEY = 'irgeztne.workspace.weather.v041';
  const LEGACY_CACHE_KEY = 'irgeztne.workspace.weather.cache.v041';
  const DEFAULT_API_URL = 'https://api.irgeztne.com/weather/v1';
  const DEVELOPMENT_FALLBACK_PLACE = Object.freeze({
    cityRu: 'Цюрих',
    cityEn: 'Zurich',
    latitude: 47.3769,
    longitude: 8.5417,
    altitude: 408,
    timeZone: 'Europe/Zurich'
  });
  const LOCATION_PRESETS = Object.freeze([
    { id: 'baku', cityRu: 'Баку', cityEn: 'Baku', latitude: 40.4093, longitude: 49.8671, altitude: -28, timeZone: 'Asia/Baku' },
    { id: 'zurich', cityRu: 'Цюрих', cityEn: 'Zurich', latitude: 47.3769, longitude: 8.5417, altitude: 408, timeZone: 'Europe/Zurich' },
    { id: 'london', cityRu: 'Лондон', cityEn: 'London', latitude: 51.5074, longitude: -0.1278, altitude: 11, timeZone: 'Europe/London' },
    { id: 'new-york', cityRu: 'Нью-Йорк', cityEn: 'New York', latitude: 40.7128, longitude: -74.0060, altitude: 10, timeZone: 'America/New_York' },
    { id: 'tokyo', cityRu: 'Токио', cityEn: 'Tokyo', latitude: 35.6762, longitude: 139.6503, altitude: 40, timeZone: 'Asia/Tokyo' },
    { id: 'sydney', cityRu: 'Сидней', cityEn: 'Sydney', latitude: -33.8688, longitude: 151.2093, altitude: 58, timeZone: 'Australia/Sydney' },
    { id: 'toronto', cityRu: 'Торонто', cityEn: 'Toronto', latitude: 43.6532, longitude: -79.3832, altitude: 76, timeZone: 'America/Toronto' },
    { id: 'sao-paulo', cityRu: 'Сан-Паулу', cityEn: 'São Paulo', latitude: -23.5505, longitude: -46.6333, altitude: 760, timeZone: 'America/Sao_Paulo' },
    { id: 'istanbul', cityRu: 'Стамбул', cityEn: 'Istanbul', latitude: 41.0082, longitude: 28.9784, altitude: 39, timeZone: 'Europe/Istanbul' },
    { id: 'dubai', cityRu: 'Дубай', cityEn: 'Dubai', latitude: 25.2048, longitude: 55.2708, altitude: 16, timeZone: 'Asia/Dubai' },
    { id: 'nairobi', cityRu: 'Найроби', cityEn: 'Nairobi', latitude: -1.2921, longitude: 36.8219, altitude: 1795, timeZone: 'Africa/Nairobi' },
    { id: 'reykjavik', cityRu: 'Рейкьявик', cityEn: 'Reykjavik', latitude: 64.1466, longitude: -21.9426, altitude: 61, timeZone: 'Atlantic/Reykjavik' }
  ]);
  const PRESET_BY_TIME_ZONE = Object.freeze(LOCATION_PRESETS.reduce(function (result, place) {
    result[place.timeZone] = place;
    return result;
  }, {}));

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function finite(value) {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function normalizeTimeZone(value) {
    const timeZone = String(value || '').trim();
    if (!timeZone || timeZone.length > 80) return null;
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: timeZone }).format(new Date());
      return timeZone;
    } catch (error) {
      return null;
    }
  }

  function normalizePlace(value) {
    const latitude = finite(value && value.latitude);
    const longitude = finite(value && value.longitude);
    const altitude = finite(value && value.altitude);
    if (latitude === null || latitude < -90 || latitude > 90) return null;
    if (longitude === null || longitude < -180 || longitude > 180) return null;
    return {
      cityRu: String(value.cityRu || value.city || value.cityEn || 'Моё местоположение').trim().slice(0, 80),
      cityEn: String(value.cityEn || value.city || value.cityRu || 'My location').trim().slice(0, 80),
      latitude: Number(latitude.toFixed(4)),
      longitude: Number(longitude.toFixed(4)),
      altitude: altitude === null ? null : Math.round(altitude),
      timeZone: normalizeTimeZone(value.timeZone)
    };
  }

  function readLocal(key, fallback) {
    try {
      const parsed = JSON.parse(global.localStorage.getItem(PROOF_STORAGE_PREFIX + key) || 'null');
      return parsed == null ? fallback : parsed;
    } catch (error) {
      return fallback;
    }
  }

  function writeLocal(key, value) {
    try {
      global.localStorage.setItem(PROOF_STORAGE_PREFIX + key, JSON.stringify(value));
      return true;
    } catch (error) {
      return false;
    }
  }

  function readState(key, fallback) {
    try {
      const weatherHost = global.IRGEZTNEWeatherHost;
      if (weatherHost && typeof weatherHost.getStateSync === 'function') {
        const slot = key === STATE_KEY ? 'location' : (key === CACHE_KEY ? 'cache' : '');
        if (slot) {
          const value = weatherHost.getStateSync(slot, fallback);
          return value == null ? fallback : value;
        }
      }
      const api = global.nsAPI;
      if (api && typeof api.storageGetModuleStateSync === 'function') {
        const value = api.storageGetModuleStateSync(key, fallback);
        return value == null ? fallback : value;
      }
    } catch (error) {}
    return readLocal(key, fallback);
  }

  function writeState(key, value) {
    try {
      const weatherHost = global.IRGEZTNEWeatherHost;
      if (weatherHost && typeof weatherHost.setStateSync === 'function') {
        const slot = key === STATE_KEY ? 'location' : (key === CACHE_KEY ? 'cache' : '');
        if (slot) {
          const result = weatherHost.setStateSync(slot, value);
          return !result || result.ok !== false;
        }
      }
      const api = global.nsAPI;
      if (api && typeof api.storageSetModuleStateSync === 'function') {
        const result = api.storageSetModuleStateSync(key, value);
        return !result || result.ok !== false;
      }
    } catch (error) {}
    return writeLocal(key, value);
  }

  function legacyPlace() {
    try {
      const candidate = normalizePlace(JSON.parse(global.localStorage.getItem(LEGACY_SETTINGS_KEY) || 'null'));
      if (!candidate) return null;
      const name = String(candidate.cityRu || candidate.cityEn || '').trim().toLowerCase();
      const legacyBaku = Math.abs(candidate.latitude - 40.4093) < 0.0002 && Math.abs(candidate.longitude - 49.8671) < 0.0002 && (!name || name === 'баку' || name === 'baku');
      const legacyZurich = Math.abs(candidate.latitude - 47.3769) < 0.0002 && Math.abs(candidate.longitude - 8.5417) < 0.0002 && (!name || name === 'цюрих' || name === 'zurich');
      return legacyBaku || legacyZurich ? null : candidate;
    } catch (error) {
      return null;
    }
  }

  function systemLocationSuggestion(options) {
    const hasExplicitTimeZone = Boolean(options && Object.prototype.hasOwnProperty.call(options, 'timeZone'));
    options = options || {};
    let timeZone = normalizeTimeZone(options.timeZone);
    if (hasExplicitTimeZone && !timeZone) return null;
    if (!hasExplicitTimeZone) {
      try { timeZone = normalizeTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone); } catch (error) {}
    }
    const preset = timeZone && PRESET_BY_TIME_ZONE[timeZone];
    return preset ? normalizePlace(preset) : null;
  }

  function isLegacyZurichDefault(state, place) {
    return Boolean(place && Number(state && state.schemaVersion || 0) < 2 &&
      Math.abs(place.latitude - 47.3769) < 0.0002 && Math.abs(place.longitude - 8.5417) < 0.0002);
  }

  function getLocationContext(options) {
    const state = readState(STATE_KEY, {});
    const saved = normalizePlace(state && state.place);
    if (saved && !isLegacyZurichDefault(state, saved)) {
      return { place: saved, source: String(state.selectionSource || 'saved'), saved: true };
    }
    const migrated = legacyPlace();
    if (migrated) {
      writeState(STATE_KEY, { schemaVersion: 2, place: migrated, selectionSource: 'legacy_saved', updatedAt: new Date().toISOString() });
      return { place: migrated, source: 'legacy_saved', saved: true };
    }
    const suggestion = systemLocationSuggestion(options);
    if (suggestion) return { place: suggestion, source: 'system_suggestion', saved: false };
    if (global.IRGEZTNE_WEATHER_DEV_LOCATION_FALLBACK === true) {
      return { place: clone(DEVELOPMENT_FALLBACK_PLACE), source: 'development_fallback', saved: false };
    }
    return { place: null, source: 'location_required', saved: false };
  }

  function getPlace() {
    return getLocationContext().place;
  }

  function setPlace(value, options) {
    const place = normalizePlace(value);
    if (!place) throw new TypeError('Weather place has invalid coordinates');
    writeState(STATE_KEY, {
      schemaVersion: 2,
      place: place,
      selectionSource: String(options && options.source || 'manual').slice(0, 32),
      updatedAt: new Date().toISOString()
    });
    return clone(place);
  }

  function clearPlace() {
    writeState(STATE_KEY, { schemaVersion: 2, place: null, selectionSource: null, updatedAt: new Date().toISOString() });
  }

  function placeKey(place) {
    const normalized = normalizePlace(place);
    return normalized ? [normalized.latitude.toFixed(4), normalized.longitude.toFixed(4), normalized.altitude == null ? 'auto' : normalized.altitude].join(':') : '';
  }

  function normalizeCondition(value) {
    const code = String(value && value.code || 'unknown').trim().toLowerCase();
    const phase = String(value && value.phase || 'unknown').trim().toLowerCase();
    return {
      code: /^[a-z0-9_]+$/.test(code) ? code : 'unknown',
      phase: ['day', 'night', 'polartwilight'].includes(phase) ? phase : 'unknown'
    };
  }

  function normalizeCheck(value) {
    const status = String(value && value.status || 'unknown');
    return {
      status: ['success', 'failed', 'unknown'].includes(status) ? status : 'unknown',
      last_attempt_at: value && value.last_attempt_at || null,
      last_successful_check_at: value && value.last_successful_check_at || null
    };
  }

  function normalizePoint(value) {
    if (!value || !Number.isFinite(Date.parse(String(value.forecast_time || '')))) return null;
    return {
      forecast_time: new Date(value.forecast_time).toISOString(),
      temperature_c: finite(value.temperature_c),
      relative_humidity_pct: finite(value.relative_humidity_pct),
      wind_speed_mps: finite(value.wind_speed_mps),
      wind_direction_deg: finite(value.wind_direction_deg),
      precipitation_1h_mm: finite(value.precipitation_1h_mm),
      air_pressure_hpa: finite(value.air_pressure_hpa),
      condition: normalizeCondition(value.condition)
    };
  }

  function normalizePayload(payload) {
    if (!payload || payload.api_version !== API_VERSION) throw new Error('Unsupported IRGEZTNE Weather API response');
    const current = normalizePoint(payload.current);
    const hourly = Array.isArray(payload.hourly) ? payload.hourly.map(normalizePoint).filter(Boolean).slice(0, 72) : [];
    if (!current) throw new Error('IRGEZTNE Weather API response has no current forecast');
    const freshnessState = String(payload.freshness && payload.freshness.state || 'unavailable');
    const allowedFreshness = ['fresh', 'cached', 'stale', 'unavailable'];
    return {
      api_version: API_VERSION,
      forecast_type: payload.forecast_type === 'model_forecast' ? 'model_forecast' : 'model_forecast',
      location: clone(payload.location || null),
      current,
      hourly,
      freshness: {
        state: allowedFreshness.includes(freshnessState) ? freshnessState : 'unavailable',
        cache: String(payload.freshness && payload.freshness.cache || 'none'),
        served_at: payload.freshness && payload.freshness.served_at || null,
        fetched_at: payload.freshness && payload.freshness.fetched_at || null,
        expires_at: payload.freshness && payload.freshness.expires_at || null,
        last_confirmed_at: payload.freshness && payload.freshness.last_confirmed_at || null,
        provider_updated_at: payload.freshness && payload.freshness.provider_updated_at || null,
        stale_reason: payload.freshness && payload.freshness.stale_reason || null,
        revalidated: Boolean(payload.freshness && payload.freshness.revalidated)
      },
      source: {
        organization: String(payload.source && payload.source.organization || 'MET Norway'),
        product: String(payload.source && payload.source.product || 'Locationforecast 2.0'),
        attribution: String(payload.source && payload.source.attribution || 'Data source: MET Norway'),
        forecast_notice: String(payload.source && payload.source.forecast_notice || 'Automatic numerical weather-model forecast; not a physical weather-station observation.'),
        license: String(payload.source && payload.source.license || ''),
        license_url: String(payload.source && payload.source.license_url || ''),
        terms_url: String(payload.source && payload.source.terms_url || ''),
        documentation_url: String(payload.source && payload.source.documentation_url || 'https://api.met.no/weatherapi/locationforecast/2.0/documentation')
      },
      check: normalizeCheck(payload.check)
    };
  }

  function readCached(place) {
    const cached = readState(CACHE_KEY, null);
    if (!cached || cached.placeKey !== placeKey(place) || !cached.payload) return null;
    try { return normalizePayload(cached.payload); } catch (error) { return null; }
  }

  function saveCached(place, payload) {
    writeState(CACHE_KEY, {
      schemaVersion: 1,
      placeKey: placeKey(place),
      payload: normalizePayload(payload),
      savedAt: new Date().toISOString()
    });
  }

  function staleCopy(payload, reason) {
    const copy = clone(payload);
    const attemptedAt = new Date().toISOString();
    copy.freshness = Object.assign({}, copy.freshness, {
      state: 'stale',
      cache: 'client_stale_fallback',
      stale_reason: reason || 'gateway_unavailable'
    });
    copy.check = {
      status: 'failed',
      last_attempt_at: attemptedAt,
      last_successful_check_at: copy.check && copy.check.last_successful_check_at || copy.freshness.last_confirmed_at || null
    };
    return copy;
  }

  function unavailable(place, reason) {
    return {
      api_version: API_VERSION,
      forecast_type: 'model_forecast',
      location: normalizePlace(place),
      current: null,
      hourly: [],
      freshness: { state: 'unavailable', cache: 'none', stale_reason: reason || 'gateway_unavailable' },
      source: {
        organization: 'MET Norway', product: 'Locationforecast 2.0', attribution: 'Data source: MET Norway',
        license: 'CC BY 4.0 / NLOD 2.0', license_url: 'https://api.met.no/doc/License',
        documentation_url: 'https://api.met.no/weatherapi/locationforecast/2.0/documentation'
      },
      check: { status: 'failed', last_attempt_at: new Date().toISOString(), last_successful_check_at: null }
    };
  }

  function legacyDevelopmentCache(place) {
    if (global.IRGEZTNE_WEATHER_DEV_OPEN_METEO_FALLBACK !== true) return null;
    try {
      const legacy = JSON.parse(global.localStorage.getItem(LEGACY_CACHE_KEY) || 'null');
      const savedAt = Number(legacy && legacy.savedAt);
      if (!legacy || !Number.isFinite(savedAt)) return null;
      const code = Number(legacy.code);
      const condition = code === 0 ? 'clear' : ([1, 2, 3].includes(code) ? 'cloudy' : (code >= 71 && code <= 77 ? 'snow' : (code >= 95 ? 'thunder' : 'rain')));
      return {
        api_version: API_VERSION,
        forecast_type: 'model_forecast',
        location: normalizePlace(place),
        current: {
          forecast_time: new Date(savedAt).toISOString(),
          temperature_c: finite(legacy.temperature),
          relative_humidity_pct: null,
          wind_speed_mps: finite(legacy.wind) === null ? null : finite(legacy.wind) / 3.6,
          wind_direction_deg: null,
          precipitation_1h_mm: null,
          air_pressure_hpa: null,
          condition: { code: condition, phase: 'unknown' }
        },
        hourly: [],
        freshness: { state: 'stale', cache: 'development_legacy_cache', stale_reason: 'gateway_unavailable' },
        check: { status: 'failed', last_attempt_at: new Date().toISOString(), last_successful_check_at: new Date(savedAt).toISOString() },
        source: {
          organization: 'Open-Meteo',
          product: 'Development rollback cache',
          attribution: 'Development fallback: Open-Meteo',
          forecast_notice: 'Development-only fallback; not part of the release data path.'
        }
      };
    } catch (error) {
      return null;
    }
  }

  async function fetchForecast(options) {
    options = options || {};
    const place = normalizePlace(options.place) || getPlace();
    if (!place) return unavailable(null, 'location_required');
    const cachedBeforeRequest = readCached(place);
    const attemptedAt = new Date().toISOString();
    const gatewayUrl = String(options.apiUrl || global.IRGEZTNE_WEATHER_API_V1_URL || DEFAULT_API_URL);
    const url = new URL(gatewayUrl);
    url.searchParams.set('lat', place.latitude.toFixed(4));
    url.searchParams.set('lon', place.longitude.toFixed(4));
    if (place.altitude !== null) url.searchParams.set('altitude', String(place.altitude));
    if (options.force === true) url.searchParams.set('refresh', '1');
    try {
      const response = await (options.fetchImpl || global.fetch)(url.toString(), {
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
        credentials: 'omit',
        referrerPolicy: 'no-referrer'
      });
      const body = await response.json();
      if (!response.ok) throw new Error(String(body && body.error || 'Weather gateway request failed'));
      const payload = normalizePayload(body);
      const refreshFailed = payload.freshness.state === 'stale';
      payload.check = {
        status: refreshFailed ? 'failed' : 'success',
        last_attempt_at: attemptedAt,
        last_successful_check_at: refreshFailed
          ? (cachedBeforeRequest && cachedBeforeRequest.check && cachedBeforeRequest.check.last_successful_check_at || payload.freshness.last_confirmed_at || null)
          : attemptedAt
      };
      saveCached(place, payload);
      return payload;
    } catch (error) {
      const cached = cachedBeforeRequest || readCached(place);
      if (cached) return staleCopy(cached, 'gateway_unavailable');
      const development = legacyDevelopmentCache(place);
      return development || unavailable(place, 'gateway_unavailable');
    }
  }

  global.IRGEZTNEWeatherClientV1 = Object.freeze({
    apiVersion: API_VERSION,
    defaultApiUrl: DEFAULT_API_URL,
    developmentFallbackPlace: clone(DEVELOPMENT_FALLBACK_PLACE),
    locationPresets: clone(LOCATION_PRESETS),
    getLocationContext,
    getSystemLocationSuggestion: systemLocationSuggestion,
    getPlace,
    setPlace,
    clearPlace,
    getCachedForecast: readCached,
    fetchForecast,
    normalizePayload
  });
})(window);
