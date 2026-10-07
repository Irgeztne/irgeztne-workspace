# IRGEZTNE Weather v1 stability and visual E2E checklist

> **Historical release-candidate checklist:** retained as the procedure used for
> human validation. Its unchecked Markdown boxes are not the current release
> status. The accepted **36/36 PASS** and **Human Electron E2E PASS** are recorded
> in [`IRGEZTNE-WEATHER-v1-FINAL-STATUS-20260912.md`](IRGEZTNE-WEATHER-v1-FINAL-STATUS-20260912.md).

Run this only after installing the narrow 2026-09-12 patch into the exact current
post-Weather-v1 Workspace. Do not restore or reinstall an older full package.

## 1. Full Weather lifecycle — mandatory

- [ ] First Compact → Full opens rendered Weather without an empty blue window.
- [ ] The native title is `IRGEZTNE Weather` from the visible first frame.
- [ ] Close Full, then reopen it at least five times; no manual reload is needed.
- [ ] Minimize Full, restore it, and repeat twice; content remains rendered.
- [ ] Hide behind Workspace and return via taskbar/window switcher; content remains rendered.
- [ ] Switch Workspace RU → EN, open Full, then EN → RU and open Full; the correct
      localized Weather document appears each time without blank content.
- [ ] Open Data Source details, launch each official external link, return to
      Weather, and confirm the Weather document remains rendered.

## 2. Dark visual acceptance

- [ ] Weather Full is visibly deeper navy than the 2026-09-12 pre-pass screenshots.
- [ ] Hero, metric cards and hourly cards no longer read as pale cyan/steel-blue.
- [ ] Weather retains its own teal identity and is not a clone of Economy.
- [ ] Borders and text remain clearly legible at normal Workspace scale.
- [ ] No Light-theme implementation or Light/Dark PASS is claimed.

## 3. Location dialog and policy

- [ ] Secondary explanation, field labels, select/options, input text and privacy
      helper are comfortably readable in RU and EN.
- [ ] Preset field reads `Быстрый выбор` in RU and `Quick locations` in EN.
- [ ] Reliable `Asia/Baku` first-run suggestion still works; saved location wins.
- [ ] Manual save, restart persistence and explicit `Use my location` still work.
- [ ] No IP lookup, Account identity, history or external geocoder is used.

## 4. Provenance and accepted UX

- [ ] Footer remains `Источник данных: MET Norway · Locationforecast 2.0 · Подробнее`.
- [ ] EN footer remains `Data source: MET Norway · Locationforecast 2.0 · Details`.
- [ ] Details shows source, product, licences, working official links and model notice.
- [ ] RU wording says use of MET Norway data does not mean official support or
      recommendation of IRGEZTNE by MET Norway.
- [ ] EN wording says use of the data does not imply endorsement by MET Norway.
- [ ] Refresh still shows Updating, checked-now and last-successful timestamps.
- [ ] Saved/offline data remains explicit and useful; unavailable values use `—`.
- [ ] Hour selection, Now, Today/Tomorrow, min/max and precip semantics still work.
- [ ] Day/night/polar-twilight icons remain truthful.

## 5. Live gateway and regressions

From the installed current Workspace, press Refresh and record:

- [ ] request path is `https://api.irgeztne.com/weather/v1`;
- [ ] refresh completes and updates the check timestamp;
- [ ] source remains MET Norway / Locationforecast 2.0;
- [ ] no Account ID, email or user identity is sent;
- [ ] offline retry keeps last confirmed data and reports the failed refresh.

Then run:

```bash
node scripts/test-weather-provider-layer-v1.mjs
```

- [ ] **35/35 PASS**.
- [ ] Economy owner hashes match the patch manifest.
- [ ] Compact Weather size/order and unrelated Workspace modules are unchanged.
- [ ] Capture one RU and one EN screenshot at normal Workspace scale.

Only after all items pass may Weather v1 be promoted from HOLD to FINAL.
