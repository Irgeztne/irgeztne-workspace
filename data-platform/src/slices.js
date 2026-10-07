import { COUNTRIES } from './config.js';

function latest(series) {
  return series?.points?.[series.points.length - 1] || null;
}

function findSeries(snapshot, entityId, metricId) {
  return (snapshot.series || []).find((entry) => entry.entity_id === entityId && entry.metric_id === metricId) || null;
}

function publicSeries(series, limit = Number.MAX_SAFE_INTEGER) {
  if (!series) return null;
  return {
    id: series.id,
    entity_id: series.entity_id,
    metric_id: series.metric_id,
    unit: series.unit,
    frequency: series.frequency,
    source: series.source,
    source_series: series.source_series,
    source_url: series.source_url,
    usage_note: series.usage_note,
    points: series.points.slice(-limit).map((point) => ({
      observed_at: point.observed_at,
      value: point.value,
      status: point.status,
      fetched_at: point.fetched_at
    }))
  };
}

function metric(id, series) {
  const point = latest(series);
  const previous = series?.points?.length > 1 ? series.points[series.points.length - 2] : null;
  return point ? {
    id,
    available: true,
    value: point.value,
    unit: point.unit,
    observed_at: point.observed_at,
    status: point.status,
    source: point.source,
    source_series: point.source_series,
    previous_value: previous?.value ?? null,
    previous_observed_at: previous?.observed_at ?? null,
    change: previous && Number.isFinite(Number(previous.value))
      ? Number(point.value) - Number(previous.value)
      : null,
    series: publicSeries(series)
  } : {
    id,
    available: false,
    value: null,
    unit: '',
    observed_at: null,
    status: 'source_unavailable',
    source: null,
    source_series: null,
    previous_value: null,
    previous_observed_at: null,
    change: null,
    series: null
  };
}

function marketInstrument(series) {
  const point = latest(series);
  const previous = series?.points?.length > 1 ? series.points[series.points.length - 2] : null;
  const pair = String(series?.entity_id || '').replace(/^fx\./, '').replace('_', '/');
  return {
    id: series.id,
    entity_id: series.entity_id,
    label: pair,
    available: Boolean(point),
    value: point?.value ?? null,
    unit: point?.unit || series.unit || '',
    observed_at: point?.observed_at || null,
    status: point?.status || 'source_unavailable',
    previous_value: previous?.value ?? null,
    previous_observed_at: previous?.observed_at ?? null,
    change: point && previous ? Number(point.value) - Number(previous.value) : null,
    series: publicSeries(series)
  };
}

export function countrySummary(snapshot, countryId) {
  const country = COUNTRIES.find((entry) => entry.id === countryId) || COUNTRIES.find((entry) => entry.id === 'US') || COUNTRIES[0];
  const gdp = findSeries(snapshot, country.entityId, 'economy.gdp_current_usd');
  const inflation = findSeries(snapshot, country.entityId, 'economy.inflation_cpi');
  const policy = findSeries(snapshot, country.entityId, 'economy.policy_rate');
  const fx = country.currency === 'EUR' ? null : findSeries(snapshot, `fx.EUR_${country.currency}`, 'market.reference_rate');
  return {
    country,
    metrics: [metric('gdp', gdp), metric('inflation', inflation), metric('policy_rate', policy), metric('eur_fx', fx)]
  };
}

export function economyWidgetSlice(snapshot, countryId = 'US', mode = 'compact') {
  const summary = countrySummary(snapshot, countryId);
  const marketInstruments = (snapshot.series || [])
    .filter((series) => series.metric_id === 'market.reference_rate' && series.entity_id.startsWith('fx.EUR_'))
    .map(marketInstrument)
    .filter((instrument) => instrument.available)
    .sort((left, right) => left.label.localeCompare(right.label));
  const preferredMarket = marketInstruments.find((instrument) => instrument.entity_id === 'fx.EUR_USD') || marketInstruments[0] || null;
  const preferredWorld = summary.metrics.find((entry) => entry.id === 'gdp' && entry.available)
    || summary.metrics.find((entry) => entry.available)
    || null;
  const sourceStatus = snapshot.source_status || {};
  return {
    version: snapshot.version,
    generated_at: snapshot.generated_at,
    mode,
    country: summary.country,
    countries: COUNTRIES,
    metrics: summary.metrics,
    market_instruments: marketInstruments,
    tabs: {
      world: {
        default_metric_id: preferredWorld?.id || null,
        chart: preferredWorld?.series || null,
        status: preferredWorld?.status || 'source_unavailable'
      },
      markets: {
        default_instrument_id: preferredMarket?.id || null,
        chart: preferredMarket?.series || null,
        instruments: marketInstruments,
        status: preferredMarket?.status || 'source_unavailable',
        disclaimer: 'official_reference_rate_not_live_market'
      }
    },
    source_status: sourceStatus
  };
}

export function selectSeries(snapshot, entityId, metricId, start, end) {
  const series = findSeries(snapshot, entityId, metricId);
  if (!series) return null;
  return {
    ...publicSeries(series, Number.MAX_SAFE_INTEGER),
    points: series.points.filter((point) => (!start || point.observed_at >= start) && (!end || point.observed_at <= end))
      .map((point) => ({ observed_at: point.observed_at, value: point.value, status: point.status, fetched_at: point.fetched_at }))
  };
}
