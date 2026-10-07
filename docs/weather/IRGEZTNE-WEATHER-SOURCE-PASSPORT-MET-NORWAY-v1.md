# IRGEZTNE Weather source passport — MET Norway

Status: reviewed for Weather Provider Layer v1  
Terms review date: **2026-09-11**

## Source identity

| Field | Value |
|---|---|
| Source organization | Norwegian Meteorological Institute (MET Norway) |
| Product | Locationforecast 2.0 |
| Production endpoint | `https://api.met.no/weatherapi/locationforecast/2.0/compact` |
| Data character | Automatic numerical weather-model forecast; not a physical weather-station observation |
| API documentation | https://api.met.no/weatherapi/locationforecast/2.0/documentation |
| Terms | https://api.met.no/doc/TermsOfService |
| Licence information | https://api.met.no/doc/License |

## Licence and attribution

MET Norway states that, unless otherwise specified, its generated data is
available under the Norwegian Licence for Open Government Data (NLOD) 2.0 and
Creative Commons Attribution 4.0 (CC BY 4.0). Commercial use is permitted under
the applicable licence conditions, including attribution. This passport is an
engineering record, not legal advice; the release owner must re-check the terms
if the provider or dataset changes.

Required product attribution used in Workspace:

> Data source: MET Norway

Visible two-level attribution in Weather v1:

- RU: `Источник данных: MET Norway · Locationforecast 2.0 · Подробнее`
- EN: `Data source: MET Norway · Locationforecast 2.0 · Details`

The Details view links to the official [licence information](https://api.met.no/doc/License)
and [Locationforecast 2.0 documentation](https://api.met.no/weatherapi/locationforecast/2.0/documentation),
identifies `CC BY 4.0 / NLOD 2.0`, repeats the model-forecast notice and
states that IRGEZTNE normalizes and presents the data. It makes no claim of
partnership, approval or endorsement by MET Norway. The user-facing wording is:

- RU: `Использование данных MET Norway не означает официальной поддержки или рекомендации IRGEZTNE со стороны MET Norway.`
- EN: `Use of MET Norway data does not imply endorsement of IRGEZTNE by MET Norway.`

The full view also names Locationforecast 2.0 and describes the values as a
model forecast. IRGEZTNE uses only its own interface branding and icons; no MET
Norway or Yr logos are bundled.

## Production request contract

- The gateway sends an identifying `User-Agent` with current IRGEZTNE contact
  information. Anonymous or generic User-Agents are rejected by the adapter.
- Coordinates are validated and limited to four decimals. Altitude is included
  where known and technically appropriate.
- Cached data is reused until upstream `Expires`; a UI refresh does not bypass
  this rule.
- After expiry, the gateway sends `If-Modified-Since` using the previously
  confirmed `Last-Modified` value and accepts `304 Not Modified`.
- Successful payloads become the last confirmed cache entry. A temporary
  upstream failure serves that entry truthfully as `stale`; without confirmed
  data the state is `unavailable`.
- Repeated requests for the same normalized forecast coordinates and altitude
  reuse the shared gateway cache.

## Privacy boundary

Workspace calls `api.irgeztne.com/weather/v1`; it does not call MET Norway.
The gateway is the upstream HTTP client, so the end-user IP is not sent directly
to MET Norway. Requests contain only latitude, longitude and optional altitude.
No Account ID, email, device identity, user identifier or location-history event
belongs to the API contract. Cache keys contain only normalized forecast
coordinates and optional altitude.

Workspace keeps one current local location selection in its app-owned module
state; it does not build a location history. A system time-zone suggestion is
used only when it maps exactly to a supported local preset. Device geolocation
is requested only after the user presses `Use my location`; no IP geolocation
or external geocoding service is used.

## Normalized condition phase

The provider adapter preserves the semantic phase carried by Locationforecast
symbols as the provider-neutral enum `day | night | polartwilight | unknown`.
The UI never reads MET field names. This phase is used only for truthful icon
and subtle hero presentation; it does not relabel forecast values as station
observations.

## Completed provider qualification supplied for this pass

The following live qualification was completed before implementation and was
accepted as input to this pass. It was not repeated unnecessarily.

- Global city coverage: **5/5 PASS** — Zurich, Baku, New York, Tokyo, Sydney.
- Geography stress coverage: **12/12 PASS** — Nairobi, Dubai, Central Sahara,
  Manaus/Amazon, La Paz/Andes, Reykjavik, Mediterranean Sea, North Atlantic
  Ocean, Equatorial Pacific Ocean, Indian Ocean, Southern Ocean, Arctic Ocean.
- Field/behavior checks: temperature, relative humidity, wind speed/direction,
  one-hour precipitation, weather symbol, hourly forecast, open-ocean
  coordinates, desert/tropical/high-altitude/polar coverage — **PASS**.

The implementation suite uses a schema fixture and separately verifies the
adapter, cache and API contract. The final suite reached **36/36 PASS**, and
deployed E2E through the actual IRGEZTNE domain received **Human Electron E2E
PASS** on 2026-09-12. Weather Provider Layer v1 is therefore **FINAL / FROZEN /
RELEASE CLEARED**. See
[`IRGEZTNE-WEATHER-v1-FINAL-STATUS-20260912.md`](IRGEZTNE-WEATHER-v1-FINAL-STATUS-20260912.md).
