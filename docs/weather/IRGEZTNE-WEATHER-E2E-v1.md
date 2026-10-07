# IRGEZTNE Weather v1 — E2E runbook

Final result (2026-09-12): **36/36 automated PASS** and **Human Electron E2E
PASS**. Weather Provider Layer v1 is **FINAL / FROZEN / RELEASE CLEARED**. This
runbook remains the reproducible validation procedure; the authoritative final
record is [`IRGEZTNE-WEATHER-v1-FINAL-STATUS-20260912.md`](IRGEZTNE-WEATHER-v1-FINAL-STATUS-20260912.md).

Release completion requires the actual path:

```text
current IRGEZTNE Workspace
  -> https://api.irgeztne.com/weather/v1
  -> deployed IRGEZTNE Weather Gateway
  -> MET Norway Locationforecast 2.0
```

The fixture/contract suite is necessary but does not replace this deployed E2E.

## 1. Local regression and portable-runtime smoke

From the Workspace root:

```bash
node scripts/test-weather-provider-layer-v1.mjs
```

Then run the portable Node boundary from `weather-gateway`:

```bash
MET_NORWAY_USER_AGENT='IRGEZTNE-Weather-Gateway/1.0 (weather@irgeztne.com)' \
  node node/server.mjs
curl -i 'http://127.0.0.1:8789/weather/v1/health'
curl -i 'http://127.0.0.1:8789/weather/v1?lat=47.3769&lon=8.5417&altitude=408'
```

Expected: HTTP 200, `api_version=weather.v1`,
`forecast_type=model_forecast`, normalized current/hourly data, truthful
freshness and `Data source: MET Norway`.

For a local Workspace UI smoke, open its DevTools before rerendering the
Information panel and set:

```js
window.IRGEZTNE_WEATHER_API_V1_URL = 'http://127.0.0.1:8789/weather/v1';
window.IRGEZTNEWorkspaceCabinetV0.render();
```

This is a development override only. It is not persisted and sends no identity.

## 2. Deploy Cloudflare Worker

From `weather-gateway`:

```bash
cp wrangler.toml.example wrangler.toml
npx wrangler kv namespace create WEATHER_CACHE
# Replace REPLACE_WITH_WEATHER_CACHE_KV_NAMESPACE_ID in wrangler.toml.
npm install
npm run dev:cloudflare
npm run deploy:cloudflare
```

Use a current identifying value for `MET_NORWAY_USER_AGENT`. Validate the
`workers.dev` URL first, then bind the Worker to the custom route
`api.irgeztne.com/weather/v1*`. Do not proxy unrelated API paths to this Worker.

## 3. Gateway acceptance

Run twice before `Expires`:

```bash
curl -sS -D /tmp/weather-h1 \
  'https://api.irgeztne.com/weather/v1?lat=47.3769&lon=8.5417&altitude=408' \
  -o /tmp/weather-r1.json
curl -sS -D /tmp/weather-h2 \
  'https://api.irgeztne.com/weather/v1?lat=47.3769&lon=8.5417&altitude=408' \
  -o /tmp/weather-r2.json
```

Verify:

- both responses are valid `weather.v1`;
- first response is `fresh` or already `cached` from a prior confirmed run;
- second response is `cached` and did not create an unnecessary upstream call;
- no response/request payload contains Account ID, email or device identity;
- source attribution and forecast notice are present;
- after expiry, conditional revalidation produces `fresh/revalidated` when the
  upstream returns 304;
- simulated upstream failure preserves last-confirmed data as `stale`; a clean
  cache plus failure returns `unavailable`, never fabricated zeroes.

## 4. Actual current Workspace acceptance

Launch the updated current Workspace package normally, with no development
override. Check both RU and EN in the accepted Dark-theme Workspace baseline:

1. Open Information. Clock → Weather → Calendar order is unchanged.
2. Compact Weather shows the saved place without growing the card. On clean
   first use it may show an explicit exact time-zone suggestion; it must not
   silently default to Zurich.
3. Click the Weather card. A dedicated Full Weather window opens.
4. City and language context match the compact surface; Dark-theme integration
   matches the accepted Workspace visual baseline.
5. Temperature, condition, humidity, wind/direction, one-hour precipitation,
   pressure and selected-hour forecast details are readable.
6. Full view uses the readable two-level MET Norway / Locationforecast 2.0
   attribution and its Details view opens both allowlisted official links.
7. Refresh before `Expires` does not force a new provider request, but the UI
   still records and displays the new successful check time.
8. Close/reopen Information and restart Workspace; saved place and last-confirmed
   client cache remain available.
9. Temporarily make the gateway unavailable: saved data remains visible and the
   failed-refresh copy and last successful check time are explicit.
10. With no cache, unavailable data renders as `—/Unavailable`, not zero.
11. Economy, Account, Workshop/Web Studio and other modules still open normally.

The acceptance gate above was satisfied on 2026-09-12. Weather Provider Layer
v1 is release-cleared as recorded in the final status document. This runbook
does not authorize later runtime changes or removal of rollback code outside a
separately scoped, hash-gated task.
