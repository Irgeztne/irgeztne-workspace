# IRGEZTNE Weather API v1

Stable Workspace boundary:

```text
GET https://api.irgeztne.com/weather/v1?lat={latitude}&lon={longitude}&altitude={metres}
```

Required parameters are `lat` and `lon`; `altitude` is optional. Values are
validated and coordinates are limited to four decimal places. Unknown query
parameters are ignored and never forwarded to the provider.

The API accepts no Account ID, email, device ID, IP-derived identity or location
history. The response is provider-neutral; Locationforecast-specific field names
do not cross this boundary.

## Response shape

```json
{
  "api_version": "weather.v1",
  "forecast_type": "model_forecast",
  "location": {
    "latitude": 47.3769,
    "longitude": 8.5417,
    "altitude_m": 408
  },
  "current": {
    "forecast_time": "2026-09-11T12:00:00.000Z",
    "temperature_c": 14.2,
    "relative_humidity_pct": 68,
    "wind_speed_mps": 3.5,
    "wind_direction_deg": 248,
    "precipitation_1h_mm": 0.1,
    "air_pressure_hpa": 1017.4,
    "condition": { "code": "partly_cloudy", "phase": "day" }
  },
  "hourly": [],
  "freshness": {
    "state": "fresh",
    "cache": "miss",
    "served_at": "2026-09-11T12:00:00.000Z",
    "fetched_at": "2026-09-11T12:00:00.000Z",
    "expires_at": "2026-09-11T12:30:00.000Z",
    "last_confirmed_at": "2026-09-11T12:00:00.000Z",
    "provider_updated_at": "2026-09-11T09:00:00.000Z",
    "stale_reason": null,
    "revalidated": false
  },
  "source": {
    "organization": "MET Norway",
    "product": "Locationforecast 2.0",
    "attribution": "Data source: MET Norway",
    "license": "CC BY 4.0 / NLOD 2.0",
    "license_url": "https://api.met.no/doc/License",
    "documentation_url": "https://api.met.no/weatherapi/locationforecast/2.0/documentation"
  }
}
```

`hourly` contains the same normalized point shape as `current`, up to 72 hours.
`condition.phase` is the provider-neutral enum `day`, `night`,
`polartwilight`, or `unknown`; MET symbol field names do not cross the API
boundary.

## Null and freshness semantics

- Missing provider values are JSON `null`, never fabricated `0`.
- `precipitation_1h_mm` is populated only when the provider supplies a
  `next_1_hours` precipitation amount; longer-period precipitation is not
  converted or interpolated.
- `fresh` means an upstream response was newly accepted or conditionally
  revalidated.
- `cached` means a confirmed response was served before its expiry.
- `stale` means last-confirmed data was preserved after a temporary upstream
  failure.
- `unavailable` means no usable confirmed forecast exists.

HTTP `503` is returned with an `unavailable` payload when no last-confirmed data
can be served. Invalid coordinates return HTTP `400`.

## Portable implementation boundary

`weather-gateway/core` and `weather-gateway/providers` use Web-standard
`fetch`, `Request`, `Response`, `URL` and `Headers` APIs only. Cloudflare
bindings are isolated in `cloudflare-worker`; Node file cache and HTTP server are
isolated in `runtime`/`node`. Moving to Docker/VPS does not change this API.
