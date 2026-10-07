import { COUNTRIES, SOURCE_REGISTRY, WORLD_BANK_METRICS } from '../config.js';
import { fetchWithTimeout } from '../net.js';

export async function collectWorldBank({ startYear = new Date().getUTCFullYear() - 15, endYear = new Date().getUTCFullYear() } = {}) {
  const source = SOURCE_REGISTRY.worldbank;
  const fetchedAt = new Date().toISOString();
  const codes = COUNTRIES.map((country) => country.wb).join(';');
  const points = [];

  for (const metric of WORLD_BANK_METRICS) {
    const url = `https://api.worldbank.org/v2/country/${codes}/indicator/${metric.sourceSeries}?format=json&per_page=5000&date=${startYear}:${endYear}`;
    const response = await fetchWithTimeout(url);
    const body = await response.json();
    const rows = Array.isArray(body) ? (body[1] || []) : [];
    const countryByWb = new Map(COUNTRIES.map((country) => [country.wb, country]));

    for (const row of rows) {
      const country = countryByWb.get(row?.countryiso3code);
      if (!country || row?.value == null || !/^\d{4}$/.test(String(row.date || ''))) continue;
      points.push({
        entity_id: country.entityId,
        metric_id: metric.metricId,
        observed_at: `${row.date}-12-31`,
        value: row.value,
        unit: metric.unit,
        frequency: metric.frequency,
        status: 'latest_official',
        source: source.name,
        source_series: metric.sourceSeries,
        source_url: source.url,
        fetched_at: fetchedAt,
        usage_note: source.usageNote
      });
    }
  }
  return points;
}
