import { BIS_AREAS, COUNTRIES, SOURCE_REGISTRY } from '../config.js';
import { parseCsv } from '../csv.js';
import { fetchWithTimeout } from '../net.js';

export async function collectBis({ startPeriod = `${new Date().getUTCFullYear() - 6}-01` } = {}) {
  const source = SOURCE_REGISTRY.bis;
  const url = `https://stats.bis.org/api/v2/data/dataflow/BIS/WS_CBPOL/1.0/M.${BIS_AREAS.join('+')}?startPeriod=${startPeriod}&format=csv`;
  const response = await fetchWithTimeout(url, { headers: { accept: 'text/csv' } }, 45000);
  const rows = parseCsv(await response.text());
  const fetchedAt = new Date().toISOString();
  const countryByBis = new Map(COUNTRIES.filter((country) => country.bis).map((country) => [country.bis, country]));

  return rows.flatMap((row) => {
    const country = countryByBis.get(row.REF_AREA);
    if (!country || !row.TIME_PERIOD || row.OBS_VALUE === '') return [];
    return [{
      entity_id: country.entityId,
      metric_id: 'economy.policy_rate',
      observed_at: row.TIME_PERIOD.length === 7 ? `${row.TIME_PERIOD}-01` : row.TIME_PERIOD,
      value: row.OBS_VALUE,
      unit: '%',
      frequency: 'monthly_or_event',
      status: 'latest_official',
      source: source.name,
      source_series: 'WS_CBPOL',
      source_url: source.url,
      fetched_at: fetchedAt,
      usage_note: source.usageNote
    }];
  });
}
