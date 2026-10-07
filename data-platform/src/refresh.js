import { COUNTRIES, SOURCE_REGISTRY, VERSION } from './config.js';
import { collectWorldBank } from './adapters/world-bank.js';
import { collectEcb } from './adapters/ecb.js';
import { collectBis } from './adapters/bis.js';
import { latestRecords, toSeries } from './schema.js';
import { preserveFailedSources, readSnapshot, writeSnapshot } from './store.js';

const ADAPTERS = [
  ['worldbank', collectWorldBank],
  ['ecb', collectEcb],
  ['bis', collectBis]
];

export async function refreshSnapshot() {
  const previous = await readSnapshot();
  const collectedSeries = [];
  const sourceStatus = {};

  for (const [id, adapter] of ADAPTERS) {
    const startedAt = Date.now();
    const source = SOURCE_REGISTRY[id];
    try {
      const points = await adapter();
      if (!points.length) throw new Error('Source returned no observations');
      collectedSeries.push(...toSeries(points));
      sourceStatus[id] = {
        ok: true,
        source_name: source.name,
        count: points.length,
        checked_at: new Date().toISOString(),
        last_successful_fetch: new Date().toISOString(),
        elapsed_ms: Date.now() - startedAt
      };
    } catch (error) {
      sourceStatus[id] = {
        ok: false,
        source_name: source.name,
        status: 'source_unavailable',
        error: String(error?.message || error),
        checked_at: new Date().toISOString(),
        last_successful_fetch: previous.source_status?.[id]?.last_successful_fetch || null,
        elapsed_ms: Date.now() - startedAt
      };
    }
  }

  const series = preserveFailedSources(previous, collectedSeries, sourceStatus)
    .sort((a, b) => a.id.localeCompare(b.id));
  const snapshot = {
    engine: 'IRGEZTNE Data Platform',
    version: VERSION,
    generated_at: new Date().toISOString(),
    source_status: sourceStatus,
    countries: COUNTRIES,
    series,
    records: latestRecords(series)
  };
  return writeSnapshot(snapshot);
}
