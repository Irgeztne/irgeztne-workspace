# IRGEZTNE Data Core & Economy — Development Roadmap

**Document status:** Architecture / Product Roadmap  
**Version:** 1.0  
**Date:** 2026-08-21  
**Scope:** IRGEZTNE Workspace Economy, shared Data Core, future IRGEZTNE Atlas integrations  
**Current product checkpoint:** Economy Widget v1 — FINAL / DONE / FROZEN

---

## 1. Purpose

This document preserves the long-term architecture and development direction for the IRGEZTNE economic and market-data system.

The goal is **not** to turn IRGEZTNE Economy into a Bloomberg-style trading terminal. The goal is to build a reliable, extensible economic and market-data platform that can serve:

- the compact Economy widget inside IRGEZTNE Workspace;
- the Full Economy surface;
- future IRGEZTNE Atlas country, company, mineral, commodity and market pages;
- future analytics and comparison surfaces;
- future additional IRGEZTNE products without duplicating data logic.

The compact widget should remain visually simple. Most future complexity belongs inside the **Data Core**, provider/connectors, registries and product adapters — not inside the visible compact interface.

---

# 2. Current accepted baseline — Economy Widget v1

Economy v1 is considered a stable first release and should not be reopened without a real product reason or confirmed bug.

## 2.1 Current UI structure

The widget currently has two primary areas:

- **World**
- **Markets**

This top-level structure should remain the default architecture unless future evidence shows that it is insufficient.

### World

World represents country / macroeconomic context.

Current and future examples:

- GDP
- inflation
- policy rate
- FX/reference rates
- population
- employment
- public debt
- trade
- energy
- productivity
- other official macroeconomic indicators

### Markets

Markets represents tradeable or market-observed instruments.

Current v1 is primarily FX-oriented.

Future market classes can include:

- FX
- Commodities
- Indices
- Equities
- Rates / Bonds
- potentially other well-defined market instrument classes later

The compact widget should not gain many new top-level tabs. Market classes should normally live **inside Markets** as a selector/filter.

---

## 2.2 Current architectural strengths

Economy v1 already established several important contracts:

- one Economy/Data Core rather than separate compact/full engines;
- real historical observations;
- no fabricated interpolation;
- source provenance;
- distinction between observation time and fetch/update time;
- cache/freshness states;
- preservation of the last confirmed data on source failure;
- frequency-aware chart ranges;
- responsive interactive charts;
- compact and Full views using the same core;
- persistence of the user-selected World country and Markets instrument;
- locale-derived first-use context;
- RU/EN affects labels, not geographic selection;
- app-owned persistence;
- official source identity remains visible;
- no direct UI dependency on external data providers.

These contracts form the foundation for later development.

---

# 3. Core architectural principle

External APIs may be used, but **product UI must not depend directly on provider APIs**.

Preferred flow:

```text
External source / API / feed
        ↓
Source Connector
        ↓
IRGEZTNE Data Core
        ↓
Normalization + Registry + Storage + Provenance
        ↓
Internal Query/Data Service
        ↓
Product Adapter
        ↓
Workspace Economy / Atlas / other IRGEZTNE surfaces
```

Avoid:

```text
Atlas page → external API
Economy renderer → external API
Company card → external API
```

The purpose is provider independence, consistent data semantics, stable caching, provenance, licensing control and reuse across products.

---

# 4. Target platform layers

A mature IRGEZTNE economic/market platform should contain the following layers.

## 4.1 Source Connector Layer

Connectors isolate every external source.

Possible source categories:

- World Bank
- BIS
- ECB
- national statistical agencies
- central banks
- exchanges
- market-data providers
- commodity benchmark providers
- corporate filing sources
- company fundamentals providers
- public datasets
- carefully licensed commercial providers where appropriate

Each connector should handle authentication if required, provider-specific symbols/IDs, pagination, rate limits, response formats, provider errors, provider timestamps, retries and raw-source metadata.

The rest of IRGEZTNE should not need to know provider-specific request formats.

---

## 4.2 Entity & Instrument Registry

This is one of the most important future additions.

IRGEZTNE needs a canonical registry describing what each data series actually belongs to.

### Entity examples

- country
- region
- company
- commodity
- mineral/material
- currency
- exchange
- security
- index
- benchmark

### Instrument examples

- FX pair
- equity/share class
- commodity spot quote
- commodity futures benchmark
- stock index
- bond/rate instrument

Every entity/instrument should have a stable, language-neutral internal ID.

Examples:

```text
country.us
region.euro_area
currency.eur
currency.usd
fx.eur.usd
fx.eur.jpy
commodity.gold
commodity.gold.spot.usd_oz
commodity.brent.ice
company.apple
security.aapl.xnas
index.sp500
```

Exact naming can evolve, but the principle is mandatory:

**labels are translatable; canonical IDs are not.**

---

## 4.3 Normalization Layer

Different providers represent the same concepts differently. The normalization layer converts provider responses into one IRGEZTNE model.

Minimum normalized fields should include where applicable:

```text
series_id
entity_id
instrument_id
value
unit
currency
frequency
observed_at
fetched_at
source_id
source_series_id
status
quality_flags
```

Possible status values:

```text
official
cached
stale
delayed
unavailable
partial
estimated
```

Do not use `0` to mean “missing.”

Missing data must remain semantically missing.

---

## 4.4 Time-Series Store

A shared historical store should support macroeconomic and market series.

Examples:

- GDP
- inflation
- policy rates
- FX
- commodity prices
- indices
- equity prices
- yields
- future fundamentals history

Requirements:

- preserve actual observations;
- preserve source timestamps;
- preserve revisions where useful;
- avoid fake interpolation;
- store frequency explicitly;
- support annual, quarterly, monthly, daily and later intraday data;
- support range queries efficiently;
- preserve last confirmed good observations when providers fail.

---

## 4.5 Quote Layer

Macro series and market quotes are not identical.

A future Quote Layer should manage:

- latest quote;
- previous close/reference value;
- absolute change;
- percentage change;
- market timestamp;
- trading status;
- delayed/realtime indicator;
- currency;
- bid/ask where legally and technically available;
- source/provenance.

This layer is the natural home for future near-real-time or real-time data.

The current historical Data Core should not be replaced by the Quote Layer. They should coexist.

---

## 4.6 Fundamentals Layer

Required mainly for companies.

Potential fields:

- shares outstanding;
- free float where appropriate;
- revenue;
- net income;
- assets;
- liabilities;
- equity;
- EPS;
- dividends;
- reporting currency;
- reporting period;
- filing/source;
- revision/restatement metadata.

This layer allows company metrics to be computed from understood data rather than scraped display values.

---

## 4.7 Corporate & Market Events Layer

Required before serious equity history.

Examples:

- stock splits;
- reverse splits;
- dividends;
- ticker changes;
- exchange changes;
- mergers;
- spin-offs;
- delistings;
- listing dates;
- trading holidays;
- market sessions.

Without this layer, long equity histories and derived metrics can become misleading.

---

## 4.8 Derived Metrics Engine

Derived values should be calculated by a controlled internal layer.

### Public-company market capitalization

Conceptually:

```text
market_cap = share_price × shares_outstanding
```

But implementation must account for multiple share classes, multiple listings, primary vs secondary securities, currencies, timestamp consistency and corporate actions.

IRGEZTNE must not fabricate public market capitalization for a private company.

Other derived metrics can later include:

- percent changes;
- FX conversions;
- index-relative performance;
- spreads;
- yields;
- growth rates;
- normalized comparisons;
- rolling statistics.

Every derived metric should retain provenance to its source inputs.

---

## 4.9 Provenance & Licensing Layer

This should become a first-class subsystem, especially because Atlas will reuse market data publicly.

For every source/series/instrument, store where relevant:

```text
source_id
source_name
source_url_or_reference
source_series_id
license
attribution
redistribution_rights
display_rights
cache_rights
history_rights
realtime_or_delayed
required_delay
terms_checked_at
```

The UI must be able to distinguish official data, delayed market data, cached data, stale data and unavailable data.

Do not use one status color to mean both “price moved down” and “data is stale.”

---

## 4.10 Freshness, Cache & Scheduler Layer

The current v1 approach should be extended rather than replaced.

Different series require different schedules:

- annual GDP: infrequent;
- monthly inflation: monthly;
- central-bank rates: event/periodic;
- daily FX reference rates: daily;
- equities: market-session cadence;
- intraday quotes: much faster if supported.

Do not poll every series every ten minutes.

The scheduler should understand:

```text
series cadence
provider limits
market calendar
last successful fetch
last confirmed observation
backoff state
priority
```

Critical contract:

**fetch failure must never replace good cached data with empty data or zero.**

---

## 4.11 Internal Query / Data Service

Workspace and Atlas should query a stable internal interface.

Conceptually:

```text
getLatest(series_id)
getHistory(series_id, range)
getEntityMetrics(entity_id)
getInstrumentQuote(instrument_id)
getMarketInstruments(class, region)
getProvenance(series_id)
getFreshness(series_id)
```

Exact API shape can evolve.

The important principle is that product surfaces request **IRGEZTNE concepts**, not provider-specific URLs.

---

## 4.12 Product Adapter Layer

Each IRGEZTNE product receives an appropriate representation of the same underlying data.

Examples:

- Workspace Compact Economy
- Workspace Full Economy
- Atlas Country
- Atlas Company
- Atlas Mineral / Commodity
- Atlas Analytics

A product adapter may change presentation, but should not duplicate provider/data-core logic.

---

# 5. Future Markets structure

Keep:

```text
World | Markets
```

Inside **Markets**, add a market-class selector.

Possible structure:

```text
Markets
  ├─ FX
  ├─ Commodities
  ├─ Indices
  ├─ Equities
  └─ Rates
```

Compact UI example:

```text
Market: Commodities
Instrument: Gold
```

or:

```text
Market: Equities
Instrument: Apple — NASDAQ
```

The existing renderer can remain conceptually similar:

```text
current value
change
range controls
interactive chart
source
observation time
update time
freshness/status
```

---

# 6. Commodity and resource data

Potential commodity classes include metals, energy and later agricultural benchmarks.

Useful first candidates:

- Gold
- Silver
- Copper
- Platinum
- Palladium
- Aluminum
- Nickel
- Zinc
- Brent crude
- WTI crude
- Natural gas

## 6.1 Commodity model

A commodity entity is not necessarily the same thing as a quoted instrument.

Example:

```text
Atlas entity:
Gold

Market linkage:
Gold spot / benchmark

Quote:
USD per troy ounce

History:
daily/monthly observations

Source:
provider / benchmark source
```

Store explicitly:

```text
commodity_id
instrument_id
benchmark
market_or_venue
unit
quote_currency
contract_type
delivery_month_if_futures
observed_at
source
```

Do not mix spot prices, futures contracts, physical retail prices and producer contract prices.

---

# 7. Atlas mineral integration

Atlas may contain thousands of minerals, but only a subset has meaningful standardized market quotations.

Therefore:

```text
Atlas mineral/material
        ↓ optional link
Market commodity/instrument
```

A rare mineral without a reliable standardized quotation should simply have no market block.

Do not invent:

- “market capitalization” for minerals;
- fake commodity prices;
- synthetic quotes for unquoted materials.

For valid commodities, Atlas can display:

```text
Market quotation
Price
Unit
Market / benchmark
History
Observed at
Source
Freshness/status
```

---

# 8. Company / equity architecture

For serious company data, distinguish:

```text
Company
   ↓
Security
   ↓
Share class
   ↓
Listing
   ↓
Exchange
   ↓
Quote
```

A company can have multiple share classes, multiple listings, different currencies and primary/secondary venues.

Therefore “company = ticker” must not become the internal model.

## 8.1 Atlas company page

Future public-company fields can include:

```text
Share price
Exchange
Ticker
Currency
Market capitalization
Shares outstanding
Daily change
52-week range
Historical chart
Observation time
Source
Delayed/realtime status
```

Market capitalization belongs **inside the company passport/page**, not as a separate Atlas page.

Private companies should not receive fabricated public market-cap data.

---

# 9. Indices

A future Index class can support broad-market, country, regional, sector and thematic indices where licensing permits.

Model fields may include:

```text
index_id
name
provider
currency
market_scope
methodology_reference
latest_value
history
source
license
```

Index licensing must be checked carefully.

---

# 10. Rates and bonds

Possible later scope:

- sovereign yields;
- yield curves;
- benchmark rates;
- central-bank rates;
- selected bond instruments.

Do not mix central-bank policy rates, government bond yields, interbank/reference rates and corporate bond yields.

---

# 11. Real-time and intraday development

Real-time is a later layer, not a requirement for calling Economy useful or complete.

If added:

```text
provider stream / rapid snapshots
        ↓
Quote Layer
        ↓
current market state
        ↓
intraday aggregation
        ↓
1m / 5m / 1h / daily history
```

Possible transport:

- WebSocket;
- streaming HTTP;
- frequent quote snapshots;
- provider-specific event feeds.

Important nontechnical requirements:

- display licensing;
- redistribution rights;
- required delay;
- rate limits;
- cost;
- market-session behavior.

The UI should explicitly label:

```text
Real-time
Delayed 15 min
Reference rate
Daily official rate
Last close
```

Never imply “live” when the source is delayed or reference-only.

---

# 12. Historical ranges

Range controls should remain frequency-aware.

### Annual
```text
5Y | 10Y | MAX
```

### Monthly
```text
1Y | 3Y | 5Y | MAX
```

### Daily
```text
1M | 3M | 1Y | 5Y | MAX
```

### Intraday — future
```text
1D | 5D | 1M | 6M | 1Y
```

Do not show a range for which real stored observations do not exist.

---

# 13. Charting and interaction

Keep the current interactive baseline:

- hover/touch inspection;
- crosshair;
- nearest real observation;
- date/value tooltip;
- source indication;
- active/latest markers;
- keyboard accessibility;
- responsive renderer;
- series-specific colors.

Possible later improvements:

- compare two compatible series;
- rebasing to 100;
- linear/log scale where appropriate;
- annotations;
- volume where meaningful;
- candlesticks for suitable instruments;
- export of visible series.

Do not turn the compact widget into a dense trading terminal.

---

# 14. Data quality and revisions

Official macroeconomic data is often revised.

A mature system should be capable of distinguishing observation, revision, publication and fetch.

Potential fields:

```text
observed_at
published_at
revised_at
fetched_at
revision_id
previous_value
```

Not every source will expose all fields.

Do not fabricate unavailable metadata.

---

# 15. Currency and unit normalization

A shared unit system is required.

Examples:

```text
USD
EUR
JPY
USD/oz
USD/barrel
%
basis points
index points
bn USD
tn USD
```

The Data Core should store canonical machine-readable units separately from formatted UI labels.

Display formatting must never alter the underlying value.

---

# 16. Locale and persistence

Current v1 behavior should remain a contract.

Priority on opening World:

```text
1. last valid user selection
2. first-use OS/system locale region
3. canonical supported fallback
```

Markets follows the same principle where a supported real instrument exists.

Do not use GPS, IP geolocation or external geolocation services for Economy first-use selection.

RU/EN is a UI language setting and must not change the selected economic context.

---

# 17. Offline and failure behavior

Required behavior:

```text
provider available → show fresh confirmed data
provider failed → preserve last confirmed data
old data → mark cached/stale
no confirmed data → unavailable
```

Never:

```text
network error → 0
network error → empty graph replacing valid history
network error → fabricated latest value
```

---

# 18. Security

Future provider credentials must not be exposed in renderer code.

Depending on provider terms, use backend/provider proxy, protected app service, secure credential storage or server-side token exchange.

---

# 19. Licensing is part of architecture

Before integrating any market source, answer:

1. May IRGEZTNE display the data?
2. May it cache the data?
3. May historical observations be stored?
4. May Atlas publicly redistribute it?
5. Is attribution required?
6. Is the quote real-time, delayed or reference-only?
7. Is commercial use allowed?
8. Are screenshots/export allowed?
9. Are derived metrics allowed?
10. Must data be deleted after a time limit?

A technically accessible endpoint is not automatically a legally usable data source.

---

# 20. Suggested development phases

## Phase A — v1 foundation

**Status: DONE / FROZEN**

Includes World macro, FX markets, history, provenance, caching/freshness, Full view, persistence, locale-first-use context and Information-panel integration.

## Phase B — Registry & market-class foundation

Add:

- formal Entity Registry;
- Instrument Registry / Security Master;
- market-class metadata;
- canonical unit model;
- provider-symbol mapping.

This should happen before broad equities/commodities expansion.

## Phase C — Commodities

Start with a deliberately small, well-sourced set:

```text
Gold
Silver
Copper
Brent
WTI
Natural Gas
```

## Phase D — Indices

Add selected useful indices with verified source/licensing.

## Phase E — Company / Equity foundation

Add:

- company ↔ security ↔ listing model;
- equity quotes;
- exchange registry;
- company fundamentals;
- shares outstanding;
- corporate events.

Then add market capitalization.

## Phase F — Atlas integration

Connect the Data Core to:

- Atlas country pages;
- Atlas public-company pages;
- Atlas mineral/commodity pages;
- later Analytics surfaces.

Atlas uses product adapters and internal Data Core queries.

## Phase G — Derived analytics

Possible additions:

- market cap;
- growth rates;
- normalized comparisons;
- currency conversion;
- spreads;
- rankings;
- relative performance.

## Phase H — Optional real-time / intraday

Only when there is a justified source, license and cost model.

---

# 21. Compact Economy target

Even after the Data Core becomes large, compact Economy should stay simple.

Possible final compact structure:

```text
Economy

[ World | Markets ]

World:
Country: Japan
Metric: GDP
Value
Chart
KPI cards
Source / date / freshness

Markets:
Market class: Commodities
Instrument: Gold
Value / change
Chart
Source / date / freshness

[ Open full view ]
```

Avoid adding every advanced control to the compact surface.

---

# 22. Full Economy target

Full Economy can gradually become the deeper analysis surface.

Possible future capabilities:

- richer market-class navigation;
- larger charts;
- series comparison;
- longer history;
- detailed provenance;
- instrument metadata;
- related macro indicators;
- related Atlas entity link;
- export;
- saved watch items;
- optional alerts later.

Still avoid becoming an order-entry/trading terminal.

---

# 23. Relationship with Atlas

```text
                 IRGEZTNE Data Core
                /                         Workspace Economy          Atlas
          /       \            /    |           Compact    Full      Countries Companies Minerals
```

The same underlying data can be rendered differently for each product.

This reduces duplicated provider integration, conflicting values, duplicated caches, inconsistent provenance and maintenance burden.

---

# 24. What “complete” should mean

IRGEZTNE Economy should not be judged complete by the number of tickers.

A mature version should be considered complete when it has:

### Data architecture
- stable canonical entity/instrument IDs;
- modular connectors;
- normalization;
- history;
- quote state;
- provenance/licensing;
- cache/freshness;
- robust failure behavior.

### Macro coverage
- useful World indicators;
- major regions/countries;
- correct frequencies;
- revisions where available.

### Market coverage
- FX;
- major commodities;
- useful indices;
- selected equities;
- rates where justified.

### Company support
- securities/listings;
- fundamentals;
- shares outstanding;
- market cap;
- corporate actions.

### Product integration
- compact Economy;
- Full Economy;
- Atlas country/company/mineral adapters.

### Quality
- no fabricated values;
- no missing-as-zero;
- explicit delayed/reference/realtime semantics;
- understandable source metadata;
- persistent user context;
- accessible responsive charts.

This definition does not require Bloomberg-scale breadth.

---

# 25. Non-goals

Unless product direction changes, do not make Economy into:

- a brokerage;
- an order-entry terminal;
- a portfolio trading platform;
- a high-frequency terminal;
- a giant wall of tickers;
- a duplicate of Bloomberg, Reuters, Investing.com or another product;
- an ad-heavy financial portal.

IRGEZTNE should keep its own visual language and information architecture.

---

# 26. Rules that should remain frozen

1. **One shared Data Core.**
2. **UI does not directly depend on external providers.**
3. **Canonical IDs are language-neutral.**
4. **RU/EN translates labels, not user data/context.**
5. **Missing data is not zero.**
6. **Source failure does not erase last good data.**
7. **Observed time and fetched time remain distinct.**
8. **No fake historical interpolation.**
9. **Provenance remains visible.**
10. **Realtime/delayed/reference status must be truthful.**
11. **Only market-linked minerals receive quotations.**
12. **Private companies do not receive fabricated public market caps.**
13. **Atlas reuses Data Core instead of creating a second finance engine.**
14. **Compact Economy stays compact.**
15. **Advanced depth belongs primarily in Full Economy and Atlas.**

---

# 27. Recommended next architecture milestone

When development of Economy resumes, the recommended first structural milestone is:

## **Data Core v0.3 — Entity & Instrument Registry Foundation**

Primary objectives:

- define canonical entity IDs;
- define canonical instrument IDs;
- formalize market classes;
- map provider symbols to canonical instruments;
- formalize unit/currency metadata;
- preserve current v1 behavior unchanged;
- prepare for Commodities and Indices without adding them prematurely.

After this milestone, the safest first market-content expansion is likely:

## **Commodities v1**

with a deliberately small, well-sourced set such as:

```text
Gold
Silver
Copper
Brent
WTI
Natural Gas
```

Then:

```text
Indices → Equities → Company Fundamentals → Market Cap → optional realtime
```

---

# 28. Final product principle

IRGEZTNE Economy should grow **downward into a stronger data platform**, not merely outward into more visible buttons.

The compact widget can remain almost as simple as it is today while the underlying platform becomes capable of supporting:

- macroeconomics;
- currencies;
- commodities;
- indices;
- companies;
- market capitalization;
- rates;
- long historical series;
- delayed or real-time quotes;
- Atlas entity enrichment;
- future analytics.

That is the preferred long-term direction.

---

## Checkpoint statement

**Economy Widget v1 is a completed first product surface.**  
Future work should extend the shared IRGEZTNE Data Core and its registries/connectors rather than rebuild the widget from scratch.

**Next future milestone when intentionally resumed:**  
`IRGEZTNE Data Core v0.3 — Entity & Instrument Registry Foundation`
