import { ECB_CURRENCIES, SOURCE_REGISTRY } from '../config.js';
import { parseCsv } from '../csv.js';
import { fetchWithTimeout } from '../net.js';

export async function collectEcb({ startDate } = {}) {
  const source = SOURCE_REGISTRY.ecb;
  const from = startDate || new Date(Date.now() - 370 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const key = `D.${ECB_CURRENCIES.join('+')}.EUR.SP00.A`;
  const url = `https://data-api.ecb.europa.eu/service/data/EXR/${key}?startPeriod=${from}&format=csvdata&detail=dataonly`;
  const response = await fetchWithTimeout(url, { headers: { accept: 'text/csv' } }, 40000);
  const rows = parseCsv(await response.text());
  const fetchedAt = new Date().toISOString();

  return rows.flatMap((row) => {
    const currency = String(row.CURRENCY || '');
    if (!currency || !row.TIME_PERIOD || row.OBS_VALUE === '') return [];
    return [{
      entity_id: `fx.EUR_${currency}`,
      metric_id: 'market.reference_rate',
      observed_at: row.TIME_PERIOD,
      value: row.OBS_VALUE,
      unit: currency,
      frequency: 'business_daily',
      status: row.OBS_STATUS === 'P' ? 'delayed' : 'current',
      source: source.name,
      source_series: `EXR/D.${currency}.EUR.SP00.A`,
      source_url: source.url,
      fetched_at: fetchedAt,
      usage_note: source.usageNote
    }];
  });
}
