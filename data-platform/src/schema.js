const VALID_STATUS = new Set(['current', 'latest_official', 'cached', 'source_unavailable', 'stale', 'delayed']);

export function seriesId(entityId, metricId) {
  return `${entityId}/${metricId}`;
}

export function normalizePoint(input) {
  const value = Number(input.value);
  if (!input.entity_id || !input.metric_id || !input.observed_at || !Number.isFinite(value)) {
    throw new Error('Invalid canonical data point');
  }
  const status = VALID_STATUS.has(input.status) ? input.status : 'latest_official';
  return {
    entity_id: String(input.entity_id),
    metric_id: String(input.metric_id),
    series_id: seriesId(input.entity_id, input.metric_id),
    observed_at: String(input.observed_at),
    value,
    unit: String(input.unit || ''),
    frequency: String(input.frequency || 'unknown'),
    status,
    source: String(input.source || ''),
    source_series: String(input.source_series || ''),
    source_url: String(input.source_url || ''),
    fetched_at: String(input.fetched_at || new Date().toISOString()),
    usage_note: String(input.usage_note || '')
  };
}

export function toSeries(points) {
  const groups = new Map();
  for (const point of points) {
    const normalized = normalizePoint(point);
    if (!groups.has(normalized.series_id)) groups.set(normalized.series_id, []);
    groups.get(normalized.series_id).push(normalized);
  }
  return Array.from(groups.entries()).map(([id, items]) => {
    const ordered = items.sort((a, b) => a.observed_at.localeCompare(b.observed_at));
    const first = ordered[0];
    return {
      id,
      entity_id: first.entity_id,
      metric_id: first.metric_id,
      unit: first.unit,
      frequency: first.frequency,
      source: first.source,
      source_series: first.source_series,
      source_url: first.source_url,
      usage_note: first.usage_note,
      points: ordered
    };
  }).sort((a, b) => a.id.localeCompare(b.id));
}

export function latestRecords(series) {
  return series.map((entry) => entry.points[entry.points.length - 1]).filter(Boolean);
}
