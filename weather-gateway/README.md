# IRGEZTNE Weather Gateway v1

Portable gateway for the stable `GET /weather/v1` contract used by IRGEZTNE
Workspace. The portable Core and MET Norway adapter contain no Cloudflare APIs.

## Runtime layout

- `core/` — cache/freshness policy and normalized `weather.v1` response.
- `providers/` — isolated Locationforecast 2.0 request and normalization.
- `runtime/` — generic HTTP and persistent file-cache adapters.
- `cloudflare-worker/` — thin Worker/KV bindings only.
- `node/` — dependency-free Node HTTP server and Docker entry.

## Local Node run

From this `weather-gateway` directory:

```bash
MET_NORWAY_USER_AGENT='IRGEZTNE-Weather-Gateway/1.0 (weather@irgeztne.com)' \
  node node/server.mjs
curl 'http://127.0.0.1:8789/weather/v1?lat=47.3769&lon=8.5417&altitude=408'
```

The identifying User-Agent must contain current IRGEZTNE contact information.
The default host is loopback; Docker overrides it to `0.0.0.0`.

## Cloudflare Worker

```bash
cp wrangler.toml.example wrangler.toml
npx wrangler kv namespace create WEATHER_CACHE
# Put the returned id into wrangler.toml.
npm install
npm run dev:cloudflare
npm run deploy:cloudflare
```

Bind the validated Worker to `api.irgeztne.com/weather/v1*`. KV is used for
shared last-confirmed cache; Worker Cache API is deliberately not a Core
dependency.

## Docker / VPS

Build from this directory so all portable folders are inside the build context:

```bash
docker build -f node/Dockerfile -t irgeztne-weather-gateway:v1 .
docker run --rm -p 8789:8789 \
  -e MET_NORWAY_USER_AGENT='IRGEZTNE-Weather-Gateway/1.0 (weather@irgeztne.com)' \
  -v irgeztne-weather-cache:/app/node/.data \
  irgeztne-weather-gateway:v1
```

The deployed route passed final human Electron E2E on 2026-09-12. See
`docs/weather/IRGEZTNE-WEATHER-v1-FINAL-STATUS-20260912.md` for release status and
`docs/weather/IRGEZTNE-WEATHER-E2E-v1.md` for the reproducible validation procedure.
