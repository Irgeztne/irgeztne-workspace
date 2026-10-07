import {
  MET_NORWAY_SOURCE,
  finiteNumber,
  normalizeCoordinates,
  resolveExpiresAt
} from '../core/weather-core.mjs';

const ENDPOINT = MET_NORWAY_SOURCE.endpoint;
const DEFAULT_USER_AGENT = 'IRGEZTNE-Weather-Gateway/1.0 (+https://irgeztne.com/contact)';

function conditionCode(symbolCode) {
  const value = String(symbolCode || '').toLowerCase().replace(/_(day|night|polartwilight)$/, '');
  if (!value) return 'unknown';
  if (value === 'clearsky') return 'clear';
  if (value === 'fair') return 'mostly_clear';
  if (value === 'partlycloudy') return 'partly_cloudy';
  if (value === 'cloudy') return 'cloudy';
  if (value === 'fog') return 'fog';
  if (value.includes('thunder')) return 'thunder';
  if (value.includes('snow')) return value.includes('showers') ? 'snow_showers' : 'snow';
  if (value.includes('sleet')) return 'sleet';
  if (value.includes('rain')) return value.includes('showers') ? 'rain_showers' : 'rain';
  return 'unknown';
}

function conditionPhase(symbolCode) {
  const value = String(symbolCode || '').toLowerCase();
  const match = value.match(/_(day|night|polartwilight)$/);
  return match ? match[1] : 'unknown';
}

function detailsForPeriod(data) {
  const oneHour = data?.next_1_hours || null;
  const summary = oneHour?.summary || data?.next_6_hours?.summary || data?.next_12_hours?.summary || {};
  return {
    precipitation_1h_mm: finiteNumber(oneHour?.details?.precipitation_amount),
    condition: {
      code: conditionCode(summary.symbol_code),
      phase: conditionPhase(summary.symbol_code)
    }
  };
}

function normalizePoint(item) {
  const instant = item?.data?.instant?.details || {};
  const period = detailsForPeriod(item?.data || {});
  const forecastTime = Date.parse(String(item?.time || ''));
  if (!Number.isFinite(forecastTime)) return null;
  return {
    forecast_time: new Date(forecastTime).toISOString(),
    temperature_c: finiteNumber(instant.air_temperature),
    relative_humidity_pct: finiteNumber(instant.relative_humidity),
    wind_speed_mps: finiteNumber(instant.wind_speed),
    wind_direction_deg: finiteNumber(instant.wind_from_direction),
    precipitation_1h_mm: period.precipitation_1h_mm,
    air_pressure_hpa: finiteNumber(instant.air_pressure_at_sea_level),
    condition: period.condition
  };
}

export function normalizeMetNorwayLocationforecast(payload) {
  const timeseries = Array.isArray(payload?.properties?.timeseries) ? payload.properties.timeseries : [];
  const hourly = timeseries.map(normalizePoint).filter(Boolean).slice(0, 72);
  if (!hourly.length || hourly[0].temperature_c === null) {
    throw new Error('MET Norway payload has no usable forecast points');
  }
  const updatedAt = payload?.properties?.meta?.updated_at || null;
  return {
    current: { ...hourly[0] },
    hourly,
    provider_updated_at: updatedAt,
    source: { ...MET_NORWAY_SOURCE }
  };
}

export function buildMetNorwayUrl(input) {
  const coordinates = normalizeCoordinates(input);
  const url = new URL(ENDPOINT);
  url.searchParams.set('lat', coordinates.latitude.toFixed(4));
  url.searchParams.set('lon', coordinates.longitude.toFixed(4));
  if (coordinates.altitude !== null) url.searchParams.set('altitude', String(coordinates.altitude));
  return url.toString();
}

export function createMetNorwayLocationforecastAdapter(options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const userAgent = String(options.userAgent || DEFAULT_USER_AGENT).trim();
  if (typeof fetchImpl !== 'function') throw new TypeError('fetch implementation is required');
  if (!userAgent || !/irgeztne/i.test(userAgent) || !/(https?:\/\/|@)/i.test(userAgent)) {
    throw new TypeError('identifying MET Norway User-Agent with contact information is required');
  }

  async function fetchForecast(coordinates, request = {}) {
    const headers = new Headers({
      'User-Agent': userAgent,
      'Accept-Encoding': 'gzip, deflate'
    });
    if (request.ifModifiedSince) headers.set('If-Modified-Since', String(request.ifModifiedSince));
    const response = await fetchImpl(buildMetNorwayUrl(coordinates), {
      method: 'GET',
      headers,
      redirect: 'follow'
    });
    const nowMs = Number(request.nowMs) || Date.now();
    const expiresAt = resolveExpiresAt(response.headers, nowMs, request.fallbackTtlMs);
    const lastModified = response.headers.get('last-modified') || request.ifModifiedSince || null;

    if (response.status === 304) {
      return { status: 'not_modified', expiresAt, lastModified };
    }
    if (response.status !== 200 && response.status !== 203) {
      throw new Error(`MET Norway returned HTTP ${response.status}`);
    }
    const payload = await response.json();
    return {
      status: 'ok',
      forecast: normalizeMetNorwayLocationforecast(payload),
      expiresAt,
      lastModified,
      deprecated: response.status === 203
    };
  }

  return Object.freeze({ fetchForecast });
}
