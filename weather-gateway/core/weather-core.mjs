export const WEATHER_API_VERSION = 'weather.v1';
export const WEATHER_FORECAST_TYPE = 'model_forecast';
export const DEFAULT_FALLBACK_TTL_MS = 30 * 60 * 1000;
export const DEFAULT_STALE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export const MET_NORWAY_SOURCE = Object.freeze({
  organization: 'MET Norway',
  product: 'Locationforecast 2.0',
  endpoint: 'https://api.met.no/weatherapi/locationforecast/2.0/compact',
  documentation_url: 'https://api.met.no/weatherapi/locationforecast/2.0/documentation',
  license: 'CC BY 4.0 / NLOD 2.0',
  license_url: 'https://api.met.no/doc/License',
  terms_url: 'https://api.met.no/doc/TermsOfService',
  attribution: 'Data source: MET Norway',
  commercial_use: 'Permitted under the applicable open-data licences with attribution.',
  forecast_notice: 'Automatic numerical weather-model forecast; not a physical weather-station observation.'
});

export class WeatherInputError extends Error {
  constructor(message) {
    super(message);
    this.name = 'WeatherInputError';
  }
}

export function finiteNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function normalizeCoordinates(input = {}) {
  const latitude = finiteNumber(input.latitude ?? input.lat);
  const longitude = finiteNumber(input.longitude ?? input.lon);
  const altitude = finiteNumber(input.altitude);
  if (latitude === null || latitude < -90 || latitude > 90) {
    throw new WeatherInputError('latitude must be between -90 and 90');
  }
  if (longitude === null || longitude < -180 || longitude > 180) {
    throw new WeatherInputError('longitude must be between -180 and 180');
  }
  if (altitude !== null && (altitude < -500 || altitude > 9000)) {
    throw new WeatherInputError('altitude must be between -500 and 9000 metres');
  }
  return Object.freeze({
    latitude: Number(latitude.toFixed(4)),
    longitude: Number(longitude.toFixed(4)),
    altitude: altitude === null ? null : Math.round(altitude)
  });
}

export function weatherCacheKey(coordinates) {
  const location = normalizeCoordinates(coordinates);
  return [
    WEATHER_API_VERSION,
    location.latitude.toFixed(4),
    location.longitude.toFixed(4),
    location.altitude === null ? 'auto' : String(location.altitude)
  ].join(':');
}

export function parseHttpDate(value) {
  const timestamp = Date.parse(String(value || ''));
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function resolveExpiresAt(headers, nowMs, fallbackTtlMs = DEFAULT_FALLBACK_TTL_MS) {
  const expires = parseHttpDate(headers?.get?.('expires'));
  return new Date(expires !== null && expires > nowMs ? expires : nowMs + fallbackTtlMs).toISOString();
}

function safeIso(value, fallback = null) {
  const timestamp = Date.parse(String(value || ''));
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : fallback;
}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function publicLocation(coordinates) {
  return {
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
    altitude_m: coordinates.altitude
  };
}

function buildPayload(entry, coordinates, freshness, nowMs) {
  const forecast = entry?.forecast || null;
  return {
    api_version: WEATHER_API_VERSION,
    forecast_type: WEATHER_FORECAST_TYPE,
    location: publicLocation(coordinates),
    current: clone(forecast?.current || null),
    hourly: clone(Array.isArray(forecast?.hourly) ? forecast.hourly : []),
    freshness: {
      state: freshness.state,
      cache: freshness.cache,
      served_at: new Date(nowMs).toISOString(),
      fetched_at: safeIso(entry?.fetchedAt),
      expires_at: safeIso(entry?.expiresAt),
      last_confirmed_at: safeIso(entry?.lastConfirmedAt || entry?.fetchedAt),
      provider_updated_at: safeIso(forecast?.provider_updated_at),
      stale_reason: freshness.staleReason || null,
      revalidated: freshness.cache === 'revalidated'
    },
    source: clone(forecast?.source || MET_NORWAY_SOURCE)
  };
}

function unavailablePayload(coordinates, nowMs, reason) {
  return buildPayload(null, coordinates, {
    state: 'unavailable',
    cache: 'none',
    staleReason: reason || 'provider_unavailable'
  }, nowMs);
}

function isUsableEntry(entry) {
  return Boolean(entry && entry.forecast && entry.forecast.current && Array.isArray(entry.forecast.hourly));
}

export function createMemoryWeatherCache() {
  const entries = new Map();
  return {
    async get(key) {
      return clone(entries.get(String(key)) || null);
    },
    async put(key, value) {
      entries.set(String(key), clone(value));
    }
  };
}

export function createWeatherGateway(options = {}) {
  const provider = options.provider;
  const cache = options.cache || createMemoryWeatherCache();
  const now = typeof options.now === 'function' ? options.now : Date.now;
  const staleMaxAgeMs = Number(options.staleMaxAgeMs) || DEFAULT_STALE_MAX_AGE_MS;
  const fallbackTtlMs = Number(options.fallbackTtlMs) || DEFAULT_FALLBACK_TTL_MS;
  if (!provider || typeof provider.fetchForecast !== 'function') {
    throw new TypeError('weather provider adapter is required');
  }
  if (!cache || typeof cache.get !== 'function' || typeof cache.put !== 'function') {
    throw new TypeError('weather cache adapter is invalid');
  }

  async function getForecast(input = {}) {
    let coordinates;
    try {
      coordinates = normalizeCoordinates(input);
    } catch (error) {
      if (error instanceof WeatherInputError) {
        return {
          statusCode: 400,
          payload: {
            api_version: WEATHER_API_VERSION,
            error: 'invalid_request',
            message: error.message
          }
        };
      }
      throw error;
    }

    const nowMs = Number(now());
    const key = weatherCacheKey(coordinates);
    let entry = await cache.get(key);
    if (!isUsableEntry(entry)) entry = null;
    const expiresMs = parseHttpDate(entry?.expiresAt);

    // MET Norway asks clients not to re-request before Expires. A UI refresh may
    // re-read this shared entry, but cannot bypass the provider cache contract.
    if (entry && expiresMs !== null && expiresMs > nowMs) {
      return {
        statusCode: 200,
        payload: buildPayload(entry, coordinates, { state: 'cached', cache: 'hit' }, nowMs)
      };
    }

    try {
      const result = await provider.fetchForecast(coordinates, {
        ifModifiedSince: entry?.lastModified || null,
        fallbackTtlMs,
        nowMs
      });

      if (result?.status === 'not_modified' && entry) {
        entry = {
          ...entry,
          fetchedAt: new Date(nowMs).toISOString(),
          lastConfirmedAt: new Date(nowMs).toISOString(),
          expiresAt: safeIso(result.expiresAt, new Date(nowMs + fallbackTtlMs).toISOString()),
          lastModified: result.lastModified || entry.lastModified || null
        };
        await cache.put(key, entry, { ttlSeconds: Math.ceil(staleMaxAgeMs / 1000) });
        return {
          statusCode: 200,
          payload: buildPayload(entry, coordinates, { state: 'fresh', cache: 'revalidated' }, nowMs)
        };
      }

      if (!result || result.status !== 'ok' || !result.forecast?.current) {
        throw new Error('provider returned no normalized forecast');
      }

      entry = {
        schemaVersion: 1,
        forecast: clone(result.forecast),
        fetchedAt: new Date(nowMs).toISOString(),
        lastConfirmedAt: new Date(nowMs).toISOString(),
        expiresAt: safeIso(result.expiresAt, new Date(nowMs + fallbackTtlMs).toISOString()),
        lastModified: result.lastModified || null
      };
      await cache.put(key, entry, { ttlSeconds: Math.ceil(staleMaxAgeMs / 1000) });
      return {
        statusCode: 200,
        payload: buildPayload(entry, coordinates, { state: 'fresh', cache: entry.lastModified && input.force ? 'refresh' : 'miss' }, nowMs)
      };
    } catch (error) {
      const fetchedMs = parseHttpDate(entry?.lastConfirmedAt || entry?.fetchedAt);
      if (entry && fetchedMs !== null && nowMs - fetchedMs <= staleMaxAgeMs) {
        return {
          statusCode: 200,
          payload: buildPayload(entry, coordinates, {
            state: 'stale',
            cache: 'stale_fallback',
            staleReason: 'upstream_unavailable'
          }, nowMs)
        };
      }
      return {
        statusCode: 503,
        payload: unavailablePayload(coordinates, nowMs, 'upstream_unavailable')
      };
    }
  }

  return Object.freeze({ getForecast });
}
