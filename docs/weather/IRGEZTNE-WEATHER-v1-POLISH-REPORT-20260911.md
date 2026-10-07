# IRGEZTNE Weather v1 polish — implementation and test report

> **Historical polish-stage report:** the `32/32` result and HOLD below record
> this pass at the time. Current status is **FINAL / FROZEN / RELEASE CLEARED**,
> with **36/36 PASS** and **Human Electron E2E PASS**; see
> [`IRGEZTNE-WEATHER-v1-FINAL-STATUS-20260912.md`](IRGEZTNE-WEATHER-v1-FINAL-STATUS-20260912.md).

Date: 2026-09-11  
Baseline: current post-Weather-Provider-Layer-v1 Workspace.  
Scope: Weather only; accepted Economy owners remain byte-identical.

## Outcome

The narrow polish implementation is complete in the working copy. Automated
Weather contracts pass **32/32**. Weather remains integrated with the accepted
Dark-only Workspace baseline; no Light-theme work or claim is included.

Release promotion remains **HOLD**. This environment has no usable
Electron/Chromium binary and could not reach `api.irgeztne.com` (network timeout),
so the required human RU/EN visual pass and a real refresh from the installed
Workspace through the deployed gateway must still be recorded. Weather v1 is
therefore not labelled FINAL by this report.

## Runtime changes

- Explicit refresh lifecycle: Updating, successful-check time, and clear saved
  data/offline copy.
- Provider cache terms are mapped to Up to date, Saved data, Stale or
  Unavailable; the duplicate footer status is removed.
- Release-default Zurich is removed. Priority is saved location, exact system
  time-zone suggestion, explicit device-location opt-in or manual selection.
- One location is persisted in app-owned Weather state shared by Compact and
  Full; no IP lookup, Account identity, geocoder or location history is used.
- Condition phase is normalized as `day | night | polartwilight | unknown`.
- Hourly selection, Now, Today/Tomorrow groups, scroll controls and selected-hour
  temperature/humidity/wind/precipitation/pressure are active.
- Missing precipitation remains an em dash; provider zero renders `0.0 mm`.
- Next-24-hour min/max and precipitation insight are derived only from existing
  normalized hourly points.
- The readable footer opens a compact provenance view with exact allowlisted
  official licence and API-documentation links.
- Hero visuals respond subtly to condition/phase and obey reduced-motion.

## Exact automated contracts

1. coordinates are validated and limited to four decimals
2. MET Norway URL contains only normalized forecast coordinates
3. provider adapter sends identifying User-Agent and conditional validator
4. provider-specific MET fields normalize into weather.v1 fields
5. missing 1-hour precipitation remains null rather than zero
6. invalid provider User-Agent is rejected before request
7. fresh upstream response is normalized, cached and attributed
8. valid shared cache is reused and UI refresh cannot bypass Expires
9. expired entry revalidates with If-Modified-Since semantics
10. last confirmed forecast is served stale on provider failure
11. no confirmed forecast becomes unavailable, never a zero-value forecast
12. HTTP boundary exposes only GET weather.v1 and health contracts
13. Workspace Weather Client sends coordinates only and preserves cached data on failure
14. Open-Meteo is absent from release owner and guarded as development fallback only
15. compact Weather remains between Clock and Calendar and opens Full Weather
16. Full Weather preserves RU/EN, Dark UI, hourly fields, freshness and provenance
17. standalone Weather is allowlisted without weakening navigation security
18. build package includes Weather client and standalone surface
19. normalized condition preserves day, night and polar-twilight phase without provider field leakage
20. condition icons remain phase-correct for daylight, midnight and polar twilight
21. semantic UI state separates refresh and availability from condition color
22. precipitation derivation distinguishes provider zero, positive values and missing values
23. first-run location has no Zurich release default and uses only reliable time-zone suggestions
24. manual location persists through the app-owned Weather host and survives client reload
25. successful refresh records a new check time even when forecast values are unchanged
26. failed refresh retains readable data and its last successful check
27. location UX is explicit opt-in and contains no IP, Account or geocoding provider path
28. RU and EN refresh, stale and two-level provenance copy is complete and non-technical
29. hourly UX exposes selected state, Now, Today/Tomorrow, controls and all selected-hour fields
30. Weather child keeps a narrow state/link bridge, exact source allowlist and opt-in location permission
31. Weather polish remains Dark-only, responsive and reduced-motion aware
32. accepted Economy runtime owners remain byte-identical

Command: `node scripts/test-weather-provider-layer-v1.mjs`  
Result: **32/32 PASS, 0 FAIL**.

## Unverified gates

- Packaged Electron rendering at normal Workspace scale.
- RU and EN screenshots after installation.
- OS permission prompt and real device coordinates after explicit opt-in.
- Real installed Workspace refresh through `api.irgeztne.com/weather/v1`.
- Deployed API phase field after the narrow provider-adapter rollout.

Use the accompanying visual/E2E checklist. No release-final claim is permitted
until those gates are recorded as PASS.
