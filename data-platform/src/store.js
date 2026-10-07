import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { VERSION } from './config.js';
import { latestRecords } from './schema.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DATA_DIR = process.env.IRGEZTNE_DATA_DIR
  ? path.resolve(process.env.IRGEZTNE_DATA_DIR)
  : path.join(ROOT, 'data');
export const LATEST_PATH = path.join(DATA_DIR, 'latest.json');
const HISTORY_PATH = path.join(DATA_DIR, 'history.ndjson');

export async function readSnapshot() {
  try {
    return JSON.parse(await fs.readFile(LATEST_PATH, 'utf8'));
  } catch {
    return { engine: 'IRGEZTNE Data Platform', version: VERSION, generated_at: null, source_status: {}, countries: [], series: [], records: [] };
  }
}

function previousSeriesForSource(snapshot, sourceName) {
  return (snapshot.series || []).filter((entry) => entry.source === sourceName).map((entry) => ({
    ...entry,
    points: entry.points.map((point) => ({ ...point, status: 'cached' }))
  }));
}

export function preserveFailedSources(previous, collected, sourceStatus) {
  const merged = [...collected];
  for (const status of Object.values(sourceStatus)) {
    if (status.ok) continue;
    merged.push(...previousSeriesForSource(previous, status.source_name));
  }
  return merged;
}

export async function writeSnapshot(snapshot) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const before = await readSnapshot();
  const beforeLatest = new Map((before.records || []).map((record) => [record.series_id, record]));
  const changed = latestRecords(snapshot.series).flatMap((record) => {
    const previous = beforeLatest.get(record.series_id);
    if (previous && previous.value === record.value && previous.observed_at === record.observed_at) return [];
    return [{ changed_at: new Date().toISOString(), previous: previous || null, current: record }];
  });
  if (changed.length) await fs.appendFile(HISTORY_PATH, `${changed.map((entry) => JSON.stringify(entry)).join('\n')}\n`);

  const target = `${LATEST_PATH}.tmp`;
  await fs.writeFile(target, `${JSON.stringify(snapshot, null, 2)}\n`);
  await fs.rename(target, LATEST_PATH);
  return snapshot;
}
