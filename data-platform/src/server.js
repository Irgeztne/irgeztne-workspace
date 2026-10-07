import http from 'node:http';
import { PORT, REFRESH_MS, VERSION } from './config.js';
import { refreshSnapshot } from './refresh.js';
import { readSnapshot } from './store.js';
import { countrySummary, economyWidgetSlice, selectSeries } from './slices.js';

function json(response, status, body) {
  response.statusCode = status;
  response.setHeader('content-type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(body));
}

export async function handle(request, response) {
  const url = new URL(request.url, `http://${request.headers.host || '127.0.0.1'}`);
  response.setHeader('cache-control', 'no-store');
  response.setHeader('access-control-allow-origin', 'null');
  response.setHeader('vary', 'origin');

  if (url.pathname === '/api/health' || url.pathname === '/v1/health') {
    return json(response, 200, { ok: true, engine: 'IRGEZTNE Data Platform', version: VERSION });
  }
  if (url.pathname === '/api/data' || url.pathname === '/v1/data') return json(response, 200, await readSnapshot());
  if (url.pathname === '/api/refresh' || url.pathname === '/v1/refresh') {
    if (request.method !== 'POST' || request.headers['x-irgeztne-local'] !== '1') {
      return json(response, 403, { error: 'local_refresh_authorization_required' });
    }
    return json(response, 200, await refreshSnapshot());
  }

  const widgetMatch = url.pathname === '/v1/widget/economy';
  if (widgetMatch) {
    const snapshot = await readSnapshot();
    return json(response, 200, economyWidgetSlice(snapshot, url.searchParams.get('country') || 'US', url.searchParams.get('mode') || 'compact'));
  }

  const summaryMatch = url.pathname.match(/^\/v1\/entity\/(country|region)\.([A-Z]{2})\/summary$/);
  if (summaryMatch) return json(response, 200, countrySummary(await readSnapshot(), summaryMatch[2]));

  const seriesMatch = url.pathname.match(/^\/v1\/series\/((?:country|region)\.[A-Z]{2}|fx\.[A-Z_]+)\/(.+)$/);
  if (seriesMatch) {
    const result = selectSeries(await readSnapshot(), seriesMatch[1], decodeURIComponent(seriesMatch[2]), url.searchParams.get('start'), url.searchParams.get('end'));
    return result ? json(response, 200, result) : json(response, 404, { error: 'series_not_found' });
  }
  return json(response, 404, { error: 'not_found' });
}

export async function startServer() {
  const server = http.createServer((request, response) => handle(request, response).catch((error) => json(response, 500, { error: String(error?.message || error) })));
  await new Promise((resolve, reject) => {
    const onError = (error) => reject(error);
    server.once('error', onError);
    server.listen(PORT, '127.0.0.1', () => {
      server.off('error', onError);
      resolve();
    });
  });
  console.log(`IRGEZTNE Data Platform v${VERSION}: http://127.0.0.1:${PORT}`);
  refreshSnapshot().catch((error) => console.error('[IRGEZTNE Data Platform]', error));
  setInterval(() => refreshSnapshot().catch((error) => console.error('[IRGEZTNE Data Platform]', error)), REFRESH_MS).unref();
  return server;
}
