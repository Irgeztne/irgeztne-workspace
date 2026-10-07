# IRGEZTNE Weather v1 stability and visual acceptance pass

> **Historical release-candidate report:** the `35/35` result and HOLD below
> accurately describe the state before the final live-synchronization correction
> and human pass. Current status is **FINAL / FROZEN / RELEASE CLEARED**, with
> **36/36 PASS** and **Human Electron E2E PASS**; see
> [`IRGEZTNE-WEATHER-v1-FINAL-STATUS-20260912.md`](IRGEZTNE-WEATHER-v1-FINAL-STATUS-20260912.md).

Date: 2026-09-12  
Baseline: current installed Weather v1 polish plus explicit-time-zone correction.  
Scope: Weather Full lifecycle and narrow Dark-theme visual polish only.

## Outcome

The intermittent blank Full Weather window has been removed from the active
Workspace path. Compact Weather now asks the trusted main process to open a
managed Weather window. That window starts hidden, uses the Weather preload and
security policy, retries one failed local navigation, verifies the Weather
document, assigns the `IRGEZTNE Weather` title, and only then becomes visible.

Repeated open, minimize/restore, hide/show, RU/EN navigation, renderer recovery,
close and reopen are covered by an isolated BrowserWindow lifecycle contract.
The browser-only HTML proof fallback remains available outside Electron; it is
not the packaged Workspace path. Economy keeps its existing open mechanism.

Weather Full now uses a deeper navy base and surfaces with retained teal Weather
accents and condition/phase visual cues. Only the Change location dialog's
secondary copy, labels, controls and helper text were enlarged. Compact Weather
dimensions and Information-panel placement were not changed.

The small offline preset list is labelled `Быстрый выбор / Quick locations`.
The provenance view uses exact non-endorsement wording and does not imply
partnership, approval or sponsorship by MET Norway.

## Automated result

Command:

```bash
node scripts/test-weather-provider-layer-v1.mjs
```

Result: **35/35 PASS, 0 FAIL**.

New lifecycle/visual contracts prove:

- no managed Weather child is shown before its local document loads;
- one first-navigation failure is retried while the child remains hidden;
- repeat open reuses a confirmed Weather document;
- minimized and hidden windows restore without a blank surface;
- renderer-process recovery reloads the same trusted Weather document;
- close/reopen creates a new managed Weather window;
- RU/EN uses the same managed path and preserves query context;
- renderer → preload → trusted IPC → Weather-window controller is the active path;
- Economy retains its existing standalone open path;
- Dark-only palette values are deeper and contain no Light-theme contract;
- location dialog text/control sizes meet the targeted legibility contract;
- RU/EN Quick locations and non-endorsement copy are present;
- accepted Economy runtime hashes remain unchanged.

The preceding 32 provider, gateway, cache, privacy, location, freshness,
precipitation, hourly, phase, source and Economy contracts continue to pass.

## Runtime files changed

- `main.js` — registers the trusted Weather-open IPC and owns controller cleanup.
- `preload.js` — exposes one narrow `weatherOpenFull(payload)` capability.
- `src/workspace-cabinet-panel-v0.js` — uses the managed Electron path; keeps a
  browser-only proof fallback.
- `src/modules/weather/weather-window-main.cjs` — managed Weather BrowserWindow
  lifecycle, validation, retry, security and recovery owner.
- `src/modules/weather/weather-view-v1.js` — Quick locations and exact RU/EN
  non-endorsement wording.
- `src/modules/weather/weather-view-v1.css` — Weather-only deeper Dark palette
  and targeted location-dialog typography.

## Explicitly unchanged

- Weather Gateway, Cloudflare Worker/KV and MET Norway provider adapter;
- Weather Core, normalized data fields, caches and API v1 contract;
- compact Weather markup, size and ordering;
- refresh, hourly, precipitation, phase and location persistence behavior;
- Economy module code and data;
- Information layout, Account, Workshop/Web Studio and unrelated modules;
- global theme architecture; Weather remains Dark-only.

## Remaining release gates

This source environment has no installed Electron binary, so it cannot record
the required real packaged-window visual evidence. Weather v1 must remain
**release candidate / HOLD**, not FINAL, until the accompanying checklist passes
on the user's current installed Workspace. A real refresh through
`api.irgeztne.com/weather/v1` must also be recorded there.
