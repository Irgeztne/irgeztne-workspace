# IRGEZTNE Weather v1 polish — visual and deployed E2E checklist

> **Historical pre-final checklist:** retained as the procedure used during the
> polish stage. Final accepted results are recorded in
> [`IRGEZTNE-WEATHER-v1-FINAL-STATUS-20260912.md`](IRGEZTNE-WEATHER-v1-FINAL-STATUS-20260912.md).

Run this checklist against the actual current `irgeztne-workspace-main` after
installing the hash-gated polish patch. Do not reinstall an older Workspace ZIP.

## A. Existing gateway rollout

This patch does not create or replace Cloudflare infrastructure. If the deployed
response does not yet contain normalized `condition.phase`, deploy the included
provider/Core code to the **existing** Worker, using its current KV namespace,
route and secrets. Do not create a second Worker or KV namespace.

```bash
curl -fsS 'https://api.irgeztne.com/weather/v1/health'
curl -fsS 'https://api.irgeztne.com/weather/v1?lat=47.3769&lon=8.5417&altitude=408&refresh=1'
```

Record UTC time, deployed Worker version, HTTP status, `api_version=weather.v1`,
`forecast_type=model_forecast`, source metadata, and confirm that current/hourly
`condition.phase` is one of `day`, `night`, `polartwilight`, `unknown`. Confirm
that no Account ID, email or device identity appears in request or response.

## B. Dark Workspace — RU

- [ ] Weather remains between Clock and Calendar; compact dimensions are unchanged.
- [ ] Saved location returns after Information close/reopen and Workspace restart.
- [ ] Clean first use shows an exact system-time-zone suggestion when supported;
      unsupported zones show Choose location, never automatic Zurich.
- [ ] Manual coordinates can be saved and restored.
- [ ] `Использовать моё место` asks OS permission only after the click.
- [ ] Compact → Full keeps the current place and RU.
- [ ] Refresh shows `Обновление…`, then `Проверено только что` plus the exact
      successful timestamp even when forecast values do not change.
- [ ] Offline after one successful load keeps values and says
      `Обновить не удалось. Показаны сохранённые данные.`
- [ ] Clean offline state is unavailable and uses em dashes, not zeroes.
- [ ] Footer reads `Источник данных: MET Norway · Locationforecast 2.0 · Подробнее`
      at normal Workspace scale.

## C. Dark Workspace — EN

- [ ] Compact → Full keeps the same place and EN.
- [ ] Refresh shows `Updating…`, then `Checked just now` plus the exact successful timestamp.
- [ ] Offline saved-data copy is explicit and readable.
- [ ] No visible `Cache` or `Cached` label remains.
- [ ] Footer reads `Data source: MET Norway · Locationforecast 2.0 · Details`.
- [ ] Details shows source, product, `CC BY 4.0 / NLOD 2.0`, model notice,
      IRGEZTNE normalization/no-endorsement note and two working official links.

## D. Hourly and condition truthfulness

- [ ] First hourly tile is labelled Now and visibly selected.
- [ ] Today/Tomorrow separation and both scroll buttons are clear.
- [ ] Selecting an hour updates humidity, wind, precipitation and pressure details.
- [ ] Provider `0` precipitation displays `0.0 mm`; missing/null displays `—`.
- [ ] Next-24h min/max is labelled as next 24h, not a calendar-day statistic.
- [ ] Day clear icons are not moons; night clear icons are not suns; midnight
      never invents a sun; polar twilight remains distinct.
- [ ] Hero motion is subtle and stops/reduces with OS reduced-motion.

## E. Regression and evidence

```bash
node scripts/test-weather-provider-layer-v1.mjs
```

- [ ] 32/32 PASS.
- [ ] Economy owner hashes match the report/manifest.
- [ ] Account, Workshop/Web Studio and Information layout remain unchanged.
- [ ] Capture one RU screenshot and one EN screenshot at normal Workspace scale.
- [ ] Record installed patch SHA-256 and checkpoint path.

Only after A–E pass may Weather v1 be promoted to FINAL.
