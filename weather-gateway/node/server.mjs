import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMetNorwayLocationforecastAdapter } from '../providers/met-norway-locationforecast-v2.mjs';
import { createFileWeatherCache } from '../runtime/file-weather-cache.mjs';
import { createHttpWeatherHandler } from '../runtime/http-weather-handler.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 8789);
const host = process.env.HOST || '127.0.0.1';
const provider = createMetNorwayLocationforecastAdapter({
  userAgent: process.env.MET_NORWAY_USER_AGENT || 'IRGEZTNE-Weather-Gateway/1.0 (+https://irgeztne.com/contact)'
});
const handle = createHttpWeatherHandler({
  provider,
  cache: createFileWeatherCache(process.env.WEATHER_CACHE_DIR || path.join(here, '.data', 'weather-cache'))
});

const server = http.createServer(async (incoming, outgoing) => {
  try {
    const origin = `http://${incoming.headers.host || `${host}:${port}`}`;
    const request = new Request(new URL(incoming.url || '/', origin), {
      method: incoming.method || 'GET',
      headers: incoming.headers
    });
    const response = await handle(request);
    outgoing.writeHead(response.status, Object.fromEntries(response.headers.entries()));
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    outgoing.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    outgoing.end(JSON.stringify({ error: 'weather_gateway_error' }));
  }
});

server.listen(port, host, () => {
  process.stdout.write(`IRGEZTNE Weather Gateway listening on http://${host}:${port}/weather/v1\n`);
});

