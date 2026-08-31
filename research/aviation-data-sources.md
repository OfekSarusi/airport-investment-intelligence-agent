# Aviation Data Sources — Research Notes

Research date: 2026-08-31. Method: primary-source fetches (WebFetch against official
docs/dataset pages, and a live call attempt against the FAA status endpoint) plus
targeted web search to locate the primary pages. Every claim below is cited with the
URL it came from; where a fetch failed, that is stated explicitly rather than guessed
around.

---

## 1. FAA Airport Status API

### 1a. Is `https://services.faa.gov/airport/status/{IATA}?format=application/json` real and live today?

**Could not confirm it is currently reachable.** I attempted a live call and could not
get a DNS resolution at all, for either the historical hostname or the hostname the
official current API spec declares:

- `https://services.faa.gov/airport/status/ATL?format=application/json` → `getaddrinfo ENOTFOUND services.faa.gov` (tried again on a second attempt, and over plain HTTP — same failure).
- `https://soa.smext.faa.gov/asws/api/airport/status/ATL?format=application/json` → `getaddrinfo ENOTFOUND soa.smext.faa.gov` (this is the host named as current in the official OpenAPI spec, see below).

By contrast, other faa.gov subdomains resolved fine from the same environment in the
same session (`www.faa.gov` → HTTP 403 from a bot-blocking rule, not a DNS failure;
`nasstatus.faa.gov` → resolved and returned live data, see 1c). That contrast — clean
DNS failure on the two ASWS hostnames vs. normal responses elsewhere on faa.gov — is
consistent with the service being decommissioned/off the air rather than merely
bot-blocked, and matches community reports below. **Treat "is this endpoint live"
as unresolved/likely-dead as of this research; verify with a fresh live call before
depending on it.**

Corroborating evidence that this specific service (branded **ASWS**, the "Airport
Status Web Service") has a documented but troubled history:

- The official OpenAPI 3.0.1 spec for it is published on SwaggerHub: **https://app.swaggerhub.com/apis/FAA/ASWS/1.1.0**. Fetching it directly (`https://app.swaggerhub.com/apis/FAA/ASWS/1.1.0`) returned HTTP 404 in this session, but the machine-readable definition is retrievable from SwaggerHub's API mirror at `https://api.swaggerhub.com/apis/FAA/ASWS/1.1.0`, which **did** return the spec (see schema below). That spec declares the server as `soa.smext.faa.gov`, base path `/asws`, path `/api/airport/status/{airportCode}` — i.e. exactly the endpoint shape in the task prompt, just on a different host than `services.faa.gov`.
- A GitHub issue on a maintained wrapper library documents the same migration and flags it as troubled: **https://github.com/jakekara/faa-airport-status.py/issues/1** — the reporter says the old endpoint is deprecated and the new one is `https://soa.smext.faa.gov/asws/api/airport/status/`, while also noting the set of airports the service actually returns data for has "been significantly reduced."
- A Home Assistant Core issue (**https://github.com/home-assistant/core/issues/90674**, the `faadelays` integration, which itself calls `https://soa.smext.faa.gov/asws/api/airport/status/{code}`) logged 999+ repeated failures — SSL cert errors, connection resets, timeouts — against `soa.smext.faa.gov`, i.e. real-world evidence of an unreliable host even before it apparently went fully unreachable.
- No official current landing/docs page for ASWS could be located on faa.gov itself; `https://www.faa.gov/data` (the FAA's general data-catalog landing page) returned HTTP 403 to automated fetch in this session, so its current content could not be directly verified either.

**Bottom line on 1a: do not treat this endpoint as a safe live dependency without a fresh manual check immediately before build day.** If it is still alive for some clients, it needs no API key (both the historical docs and the SwaggerHub spec describe it as open/unauthenticated, CC0-licensed), but I was not able to personally confirm liveness.

### 1b. Documented response schema (from the official OpenAPI 3.0.1 spec, fetched via `https://api.swaggerhub.com/apis/FAA/ASWS/1.1.0`)

`GET /api/airport/status/{airportCode}` → `AirportStatus` object:

| Field | Type | Notes |
|---|---|---|
| `name`, `city`, `state` | string | Airport identity |
| `icao`, `iata` | string | Codes |
| `supportedAirport` | boolean | Whether this airport is one of the ~77 major airports ASWS covers |
| `delay` | boolean | Whether any delay condition is active |
| `delayCount` | integer | Number of active delay/advisory entries |
| `status` | array of `Status` objects | `type`, `reason`, `avgDelay`, `minDelay`, `maxDelay`, `trend`, `closureBegin`, `closureEnd`, `endTime` |
| `weather` | object | Weather conditions at the airport (temperature, visibility, wind, textual condition, and metadata: credit/updated-time/source URL) |

A second-source teaching example (fetched from **http://berry-cs.github.io/sinbad/gallery/faa-airport-python.html**, which used the older `services.faa.gov` host and XML/JSON both) shows the same shape in practice: `City`, `IATA`, `ICAO`, `Name`, `State`, `Delay` (bool), `Status{Reason, AvgDelay, MaxDelay, MinDelay, Trend, Type}`, `Weather{Temp, Visibility, Weather, Wind, Meta{Credit, Updated, Url}}` — confirming these field names are real and were observed in a live response at some point, not just spec fiction.

### 1c. A confirmed-live alternative: the FAA National Airspace System (NAS) Status feed

Unlike ASWS, this one I fetched successfully and it returned real-time data during
this research session (fetched **2026-08-31**, matching "today"):

- **`https://nasstatus.faa.gov/api/airport-status-information`** — resolved and returned live current data: active ground stop at ORD (thunderstorms), ground delay programs at ORD (avg 42 min) and SFO (avg 1h07m, due to low ceilings), arrival/departure delay listings for ORD and SAN, and a list of temporary airport closures (SNA, LMT, HTS, LFT) with reopen dates. This is a national roll-up (only airports currently under some kind of advisory appear — it is not a per-IATA-code single-airport lookup), and its native format is XML (the "api" path is descriptive, not a REST-JSON contract) with a top-level `AIRPORT_STATUS_INFORMATION` element containing `Update_Time` and a `Delay_type` array whose entries carry `Ground_Stop_List`, `Ground_Delay_List`, `Arrival_Departure_Delay_List`, and `Airport_Closure_List`, each listing per-airport records keyed by `ARPT` with `Reason`, timing fields (`End_Time`/`Start`/`Reopen`), and delay magnitudes (`Avg`, `Max`, `Min`/`Max`/`Trend` for arrival/departure delays).
- There is a published human-readable guide to this system: **NAS Status User Guide (PDF)**, `https://nasstatus.faa.gov/static/media/NASStatusUserGuide.cccc6d48.pdf` (dated 2022-09-06) — this documents the dashboard/map UI (`https://nasstatus.faa.gov/map`) rather than the JSON/XML field-by-field contract, and it renders as scanned images in this environment so its text could not be extracted.
- No API key, CC0-style openness matches the rest of FAA's open data; no formal rate-limit documentation was found — treat it as a courtesy-use public government feed, not an SLA-backed service.

**On CORS / calling live from Node**: neither the ASWS docs nor the NAS status pages document CORS headers, and I could not observe response headers directly (the fetch tool returns rendered content, not raw headers). This is a non-issue either way for a Node.js backend: CORS is a browser same-origin restriction enforced by browsers reading response headers, not something a server-to-server `fetch`/`axios` call from Node is subject to. The real risk documented above is reachability/reliability, not CORS.

---

## 2. Other free/public sources by category

### 2a. Annual passenger volume / enplanements per US airport — **FAA CY Passenger Boarding data**

- Landing page: **https://www.faa.gov/airports/planning_capacity/passenger_allcargo_stats/passenger** (direct fetch returned HTTP 403 to the automated tool in this session — faa.gov appears to block non-browser fetches on several of its `www.faa.gov` pages; content below is from indexed search snippets of the same official pages, which is how I located the exact filenames).
- Per-year pages exist with a stable naming pattern, confirmed via search-index snippets of the live FAA site:
  - `https://www.faa.gov/airports/planning_capacity/passenger_allcargo_stats/passenger/cy23_commercial_service_enplanements`
  - `https://www.faa.gov/airports/planning_capacity/passenger_allcargo_stats/passenger/cy23_all_enplanements`
  - `https://www.faa.gov/airports/planning_capacity/passenger_allcargo_stats/passenger/cy22_commercial_service_enplanements`, `cy22_all_enplanements`, `cy21_commercial_service_enplanements`, etc.
  - A direct file was indexed too: `https://www.faa.gov/airports/planning_capacity/passenger_allcargo_stats/passenger/arp-cy2025-all-enplanements-preliminary.xlsx` — confirms the download is a plain `.xlsx` file per calendar year, one file for "All Airports" and a separate one for "Commercial Service" airports only.
  - Archive index: `https://www.faa.gov/airports/planning_capacity/passenger_allcargo_stats/passenger/previous_years`.
- Source system: the FAA states this is extracted from **ACAIS** (Air Carrier Activity Information System), fed by carriers' DOT Form 41 Schedule T-100 filings (same underlying filing that feeds BTS T-100, below). This is per the FAA's own "Collection & Use of Data" page, `https://www.faa.gov/airports/planning_capacity/passenger_allcargo_stats/passenger/collection` (again, only accessible to me via its indexed content, not a direct fetch).
- Freshness/cadence (FAA's own stated schedule, from the indexed collection page): preliminary CY2025 data available June 2026, final CY2025 data late August 2026 — i.e. roughly a 6–8 month lag from calendar year end to final published numbers, on an annual cadence.
- Format: static downloadable **Excel (.xlsx)** files, one per calendar year, no API, no key needed — freely public.
- Historical depth: per-year pages go back many years (at minimum CY2021–CY2025 confirmed by name in this search); BTS separately confirms annual U.S. airline enplanement time series exist back to **1990** (see next bullet's source), though that BTS series is national/carrier-level, not the FAA's per-airport CY boarding file specifically.

### 2b. Flight volume and route-level data (long-haul vs short-haul) — **BTS T-100** and **OpenSky**

**BTS T-100 (Form 41 Traffic, segment-level)**
- Landing/database page: **https://www.transtats.bts.gov/DatabaseInfo.asp?QO_VQ=EEE** ("Air Carrier Statistics (Form 41 Traffic)- All Carriers"), from which the **T-100 Segment (All Carriers)** and **T-100 Market (All Carriers)** tables are selected.
- I directly fetched the field-selection page for one of these tables (`https://www.transtats.bts.gov/Fields.asp?gnoyr_VQ=FMF`, which resolved to the **T-100 Market** table rather than Segment — TranStats' internal query codes are obfuscated and not guessable without navigating the UI) and confirmed real, current fields: passengers enplaned, freight/mail enplaned, **distance between airports**, **distance group (500-mile buckets)** — this distance-group field is exactly the mechanism for a long-haul/short-haul classification — plus carrier IDs/names, origin/destination airport and city-market IDs, year/quarter/month. It reported **"Latest Available Data: May 2026."**
- Also indexed via **data.gov**: `https://catalog.data.gov/dataset/t-100-domestic-market-and-segment-data`, which I fetched directly and confirmed: publisher = Bureau of Transportation Statistics/DOT, license = **CC0/public domain**, download formats include **CSV, Excel, GeoJSON, Shapefile/File Geodatabase, KML, SQLite**, via a DOI-backed open-data catalog and an ArcGIS REST/WFS service (`https://doi.org/10.21949/1527989` and `https://doi.org/10.21949/1528019` as the resolvable DOI links given on that page).
- The **Segment** table specifically (as opposed to Market) is nonstop-flight-leg level — i.e. actual origin-destination airport pairs with departures performed, seats, and distance — which is the correct table for a route/long-haul classification, per BTS's own description ("BTS Data Bank 28DS", https://www.bts.gov/browse-statistical-products-and-data/bts-publications/data-bank-28ds-t-100-domestic-segment-data, found via search index).
- Cadence: monthly, released with roughly a 2-month lag for domestic segment data (per BTS's own FAQ content surfaced in search); T-100 has existed as a filing requirement for decades, and cross-referenced sources (BTS enplanement archive, `https://www.bts.gov/content/us-air-carrier-aircraft-departures-enplaned-revenue-passengers-and-enplaned-revenue-tons`) show BTS keeps annual carrier-level series back to **1990**. I did not verify how far back the *segment-level* monthly files themselves are downloadable in one file (TranStats' UI is per-month/per-year selection), but this is widely known to go back to the early 1990s.
- No API key needed — fully open, static CSV export from a web form (not a clean REST API; it's a "select fields, submit form, download file" flow).

**OpenSky Network API**
- Official docs, fetched directly: **https://openskynetwork.github.io/opensky-api/rest.html** (mirror of `https://github.com/openskynetwork/opensky-api/blob/master/docs/free/rest.rst`).
- Base URL: `https://opensky-network.org/api`.
- **`/states/all`** (current aircraft state vectors — position, altitude, velocity, callsign, ICAO24, etc., 17 fields) is available **anonymously, no registration**, but capped to only the most recent ~10-second snapshot (anonymous credit bucket: 400 credits/day). Registering a free account and using OAuth2 client-credentials raises this to 4,000 credits/day and 5-second resolution, plus access to up to 1 hour of history.
- **`/flights/arrival`** and **`/flights/departure`** — the endpoints that give **per-airport historical flight counts** (exactly what's needed for airport-level flight-volume) — **require an authenticated (registered) account**; they are not available anonymously at all per the docs table I fetched. Registration is free/self-service (no approval wait, per OpenSky's own FAQ, https://opensky-network.org/about/faq, surfaced via search), but it is not a zero-setup, no-signup source the way T-100/OurAirports are.
- Given a 1-day project, OpenSky is realistically usable only for a live "current aircraft in the air" novelty layer (anonymous `/states/all`), not for historical per-airport flight-volume aggregation, unless time is spent registering and testing the authenticated flight-count endpoints.

### 2c. Runway counts / airport facility data — **FAA Form 5010 / ADIP** and **OurAirports**

**FAA Form 5010 / Airport Data and Information Portal (ADIP)**
- Current official access point: **https://adip.faa.gov/** and its facility-search UI, **https://adip.faa.gov/agis/public/#/airportSearch/advanced**. Both are JavaScript single-page apps; direct automated fetch returned only page shells/headers, not usable data in this session ("Download Private Airport Report" link text was visible but its behavior could not be verified), and `https://www.faa.gov/data` (general FAA data catalog) returned HTTP 403 to fetch.
- Per FAA's own form pages (indexed, e.g. `https://www.faa.gov/forms/index.cfm/go/document.information/documentID/185474`), the individual 5010-1/5010-2/5010-5 *paper form templates* for various airport ownership types have been formally **cancelled**, with the data-collection function now handled through ADIP directly rather than a discrete downloadable form. **I could not confirm a bulk/programmatic CSV or API export of raw 5010 data straight from adip.faa.gov in this session** — it read as a per-airport search-and-view tool, which is a poor fit for scripted bulk collection in a 1-day project.
- There is also an FAA ArcGIS open-data presence at `https://adds-faa.opendata.arcgis.com/`, but the fetched page only rendered a bare header ("Federal Aviation Administration - AIS") with no dataset listing retrievable in this session — could not confirm what, if anything, is bulk-downloadable there.

**OurAirports (recommended alternative for this field)**
- Canonical data-dictionary page fetched directly: **https://ourairports.com/help/data-dictionary.html** — confirmed exact column sets:
  - `airports.csv`: `id, ident, type, name, latitude_deg, longitude_deg, elevation_ft, continent, iso_country, iso_region, municipality, scheduled_service, gps_code, icao_code, iata_code, local_code, home_link, wikipedia_link, keywords`.
  - `runways.csv`: `id, airport_ref, airport_ident, length_ft, width_ft, surface, lighted, closed, le_ident, le_latitude_deg, le_longitude_deg, le_elevation_ft, le_heading_degT, le_displaced_threshold_ft, he_ident, ...` (same set for the "he" high-numbered end) — i.e. one row per physical runway, keyed to `airport_ident`, so **runway count per airport = count of rows in `runways.csv` grouped by `airport_ident`** (a runway with two ends is one row, not two, but a runway usable in both directions is still one row — count rows, don't count `le_`/`he_` idents separately).
- Download location fetched directly (**https://ourairports.com/data/**): files are plain, license-free **CSV** (also KML/HXL/RSS offered), explicitly **public domain** ("released to the Public Domain, and comes with no guarantee of accuracy or fitness for use"), generated **daily**. As of the fetch, `airports.csv` was ~12.7 MB and `runways.csv` ~3.96 MB, both last-modified the day before this research (2026-08-30).
- Actual stable bulk-download location (per the README I fetched at **https://github.com/davidmegginson/ourairports-data/blob/main/README.md**): since Nov 3, 2021 the daily CSV dumps are mirrored to GitHub at `https://github.com/davidmegginson/ourairports-data` — i.e. `https://raw.githubusercontent.com/davidmegginson/ourairports-data/main/airports.csv` and `.../runways.csv` are directly `curl`-able with no key, no form, no rate limit concerns (standard GitHub raw-content serving).
- OurAirports itself does not document its data as literally being FAA 5010 data verbatim (the README/data-dictionary I fetched make no mention of "5010" at all), so I am **not** claiming that provenance as confirmed — it should be described as "a global open community-maintained airport/runway database that includes US airports with IATA/ICAO codes, coordinates, and runway dimensions," not as "the FAA 5010 dataset repackaged." For an authoritative runway count tied explicitly to FAA's own 5010 records, ADIP is the correct source in principle, but (per above) I could not confirm a clean bulk-download path for it in this session.

### 2d. Historical growth/demand trend data

Concretely, from what was actually confirmed above (not extrapolated):
- **FAA CY Passenger Boarding**: separate static file per calendar year, so a multi-year trend requires downloading each year's `.xlsx` and stitching them; per-year pages exist at least for CY2021 through CY2025 (confirmed page names above), with an explicit archive index (`previous_years`) suggesting more years are available there than I individually enumerated.
- **BTS T-100 segment/market data**: monthly time series, selectable/downloadable by year+month through the TranStats web form; BTS's own confirmed enplanement time series runs from **1990** to present (`https://www.bts.gov/content/us-air-carrier-aircraft-departures-enplaned-revenue-passengers-and-enplaned-revenue-tons`), and T-100 filings underpin that series, though I did not personally pull a 1990-era T-100 file to confirm the segment-level table itself is populated that far back.
- Neither OurAirports nor ADIP/5010 are time-series sources — they represent current physical/facility state, not historical trend.

---

## 3. Per-source summary (static vs. live, key/registration, freshness)

| Source | Static file or live API | Key/registration | Freshness observed/documented |
|---|---|---|---|
| FAA ASWS (`services.faa.gov` / `soa.smext.faa.gov` per-IATA status) | Live REST API (JSON/XML) | None documented | **Unverified/likely down** — DNS failed twice in this session on both known hostnames; community issues report prior instability |
| FAA NAS Status (`nasstatus.faa.gov/api/airport-status-information`) | Live API (XML, "api" in URL path only) | None | Confirmed live, real-time, fetched successfully during this session (2026-08-31) |
| FAA CY Passenger Boarding data | Static `.xlsx` per year | None | Annual; final-year data lags ~8 months (e.g. CY2025 final ≈ Aug 2026 per FAA's own stated schedule) |
| BTS T-100 (Segment/Market) | Static CSV/Excel/GeoJSON export from a web form; also DOI-backed open-data/ArcGIS REST access | None | Monthly; "Latest Available Data: May 2026" observed live on the field-selection page fetched during this session |
| OpenSky `/states/all` | Live REST API | None for anonymous (rate-limited); free account for higher limits | Real-time (≤10s anonymous / ≤5s authenticated) |
| OpenSky `/flights/arrival`, `/flights/departure` | Live REST API | **Requires registered account** (free, self-service, no approval wait per OpenSky's own FAQ) | N/A (historical, up to the account's credit allowance) |
| FAA ADIP / Form 5010 | Live search UI (SPA); bulk export path unconfirmed | Public view without login (per FAA's own description); bulk CSV export not confirmed in this session | Continuously maintained (airport managers update it directly), unverified cadence |
| OurAirports (`airports.csv`, `runways.csv`) | Static CSV, mirrored to GitHub raw | None | Regenerated **daily**; files observed dated the day before this research |

---

## 4. Recommendation for the 1-day project

**Static baseline `data/airports.json` (build once, curate for a few dozen major airports):**

1. **Passenger volume** → pull directly from the FAA CY enplanements `.xlsx` files (most recent final year, e.g. `cy23_all_enplanements` / `cy23_commercial_service_enplanements`, or whichever `previous_years` link is most current-final at build time — the *preliminary* CY2025 file is also already public if a newer year is wanted at the cost of "preliminary" status). This is the single authoritative per-airport number and needs no key.
2. **Runway count / facility footprint** → pull `runways.csv` from OurAirports' GitHub mirror (`https://raw.githubusercontent.com/davidmegginson/ourairports-data/main/runways.csv`, joined to `airports.csv` on `iata_code`), and count rows per `airport_ident`. This is a single `curl` + `pandas`/`csv` groupby — by far the lowest-friction option confirmed in this research, and avoids ADIP's unconfirmed-bulk-export, JS-SPA-only access path. Note in the write-up that this is a community-maintained open database, not verbatim FAA 5010 text, since that provenance could not be confirmed.
3. **Long-haul % / route mix per airport** → pull one recent month (or a full year) of **BTS T-100 Segment (All Carriers)** data via the TranStats web-form CSV export (`https://www.transtats.bts.gov/DatabaseInfo.asp?QO_VQ=EEE` → T-100 Segment table), and bucket each airport's outbound segments by the **distance-group** field (or raw `distance`) into short/medium/long-haul, weighted by `departures performed` or `passengers`. This is free, keyless, and CC0.
4. **Region tag** → trivial static lookup (state/FAA region), no external source needed beyond what's already pulled from OurAirports/FAA (state field is present in both).
5. **Unmet-demand signal** → derive it, don't source it externally: a simple composite of (passenger volume from #1) against (runway count / facility capacity from #2) and, if time allows, against T-100 departures-performed (#3) as a rough demand-vs-capacity ratio. No dataset directly hands you "unmet demand" — this has to be computed.

**Live congestion/delay overlay:**

- Primary attempt: the exact endpoint named in the brief, `services.faa.gov`/`soa.smext.faa.gov` ASWS per-airport status — it needs no key and matches the desired per-IATA-code UX, **but do a live smoke-test call the morning of build day before committing to it**, since this research could not get a DNS resolution for it at all and found direct community evidence (a Home Assistant issue with 999+ repeated connection failures, and a GitHub issue calling it "deprecated" with a shrunk airport list) that it has a real history of instability.
- **Fallback / supplement**: `https://nasstatus.faa.gov/api/airport-status-information`, which this research confirmed live and returning real current ground-stop/ground-delay/closure data during this session. It's a national roll-up rather than a clean per-IATA lookup (you'd filter its `ARPT` fields client-side for the airports in your curated list), and its native format is XML rather than JSON, but it is the more concretely-verified-live of the two FAA options today. Given the uncertainty around ASWS, building the overlay to hit NAS Status first (or in parallel, taking whichever responds) is the pragmatic choice for a 1-day timeline where debugging a dead endpoint burns very limited hours.
- CORS is not a concern either way for a Node.js backend making the calls server-side; reliability/uptime, not CORS, is the real risk to design around (e.g., short timeout + fallback to "status unknown" per airport rather than blocking the whole overlay on one slow/dead call).
- OpenSky's anonymous `/states/all` could add a "live aircraft near this airport" visual flourish with zero signup, but it's not a congestion/delay signal per se — skip it unless there's spare time, since the actually-relevant OpenSky endpoints (`/flights/arrival`, `/flights/departure`) require registration.

**Explicitly not recommended for a 1-day build:** FAA ADIP/5010 as a bulk source (SPA-gated, no confirmed CSV export) and OpenSky's flight-count endpoints (registration overhead for a use case OurAirports+T-100 already cover better for a static baseline).

---

## 5. FAA CY Passenger Boarding availability check (2026-08-31) and a COVID-robust growth-trend method

Method note: `www.faa.gov` continued to return HTTP 403 to direct `WebFetch` in this
follow-up session (same behavior documented in §2a), so availability below is
established via search-index snippets of the live FAA pages/files — the same
technique §2a already relied on to enumerate per-year filenames. Nothing here is a
confirmed live fetch of faa.gov; treat filenames/dates as search-index-observed, and
re-verify with a direct download immediately before build day.

### 5a. Which CY files are actually confirmed available for download right now

Confirmed present in the FAA site's index as of this session (all under
`https://www.faa.gov/airports/planning_capacity/passenger_allcargo_stats/passenger/`
unless noted), in both **"All Airports"** (primary + non-primary commercial service +
GA) and **"Commercial Service"**-only variants:

| Calendar Year | Status confirmed available | Example filename(s) found |
|---|---|---|
| CY2019 (last pre-COVID year) | Final | `.../cy19-all-enplanements.pdf` — note this one lives under the older `faa.gov/sites/faa.gov/files/airports/...` archive path rather than the current flat path, published 2020-09-25 per the indexed snippet |
| CY2020 (COVID trough) | Final | `cy20-all-enplanements.pdf`, `cy20-commercial-service-enplanements.pdf` (commercial-service copy indexed as published 10/8, i.e. ~10 months after year-end) |
| CY2021 | Final | `cy21_all_enplanements`, `cy21_commercial_service_enplanements` (landing pages) |
| CY2022 | Final | `cy22_all_enplanements`, `cy22_commercial_service_enplanements` |
| CY2023 | Final | `cy23_all_enplanements`, `cy23_commercial_service_enplanements` |
| CY2024 | **Final** | `ARP-cy2024-all-enplanements.pdf` / `.xlsx`, `arp-cy2024-commercial-service-enplanements.pdf` — also mirrored at `transportation.gov/sites/dot.gov/files/2026-03/ARP-cy2024-all-enplanements.pdf`, i.e. a DOT copy dated March 2026 |
| CY2025 | **Preliminary only, confirmed posted** | `arp-cy2025-all-enplanements-preliminary.pdf` / `.xlsx`, `arp-cy2025-commercial-service-enplanements-preliminary.pdf` — one indexed snippet shows this specific file as "published July 8, 2026," consistent with FAA's own stated preliminary-release target of "June 2026" |
| CY2025 final | **Not confirmed posted yet** | No indexed final (non-"preliminary") CY2025 filename was found in this session. Per FAA's own stated schedule on its Collection & Use of Data page (`.../passenger/collection`), final CY2025 data is due "late August 2026" — i.e. essentially *now*, at the time of this research (2026-08-31). It may already be live or may land within days; it just isn't independently confirmed in the search index checked here. |

**Bottom line for "most recent year available, given the ~8-month lag":** as of
2026-08-31, the newest year with confirmed **final** data is **CY2024**. The newest
year with any data at all is **CY2025**, but only as a **preliminary** release
(subject to later revision). This matches the pattern FAA documents for itself: a
year's *preliminary* file appears roughly 6 months after year-end (June for a
Dec-ending CY), and the *final* file appears roughly 8 months after year-end (late
August). Anything built today should either (a) use CY2024 as "latest final," or (b)
explicitly label CY2025 numbers as preliminary/subject-to-revision if fresher data is
preferred over label-cleanliness — and should re-check for the CY2025 final file
periodically, since per FAA's own schedule it may post at almost any point around
this date.

Archive index for enumerating further back: `https://www.faa.gov/airports/planning_capacity/passenger_allcargo_stats/passenger/previous_years`.

### 5b. Evaluating the three candidate growth-trend methods against the COVID distortion

The problem: CY2020 collapsed (traffic down ~62% nationally per BTS, already cited in
§2d's source), CY2021 partially recovered, CY2022–2023 kept recovering/normalizing.
Any method that fits a trend line across 2019→2025 (or averages year-over-year
changes across that span) will have its slope dominated by the 2020 crash and the
2021→2022 snap-back rather than by the airport's actual underlying demand trajectory
— a straight linear/least-squares regression over that window is not defensible for
this purpose.

| Method | Robust to the 2020–2022 distortion? | Simplicity | Verdict |
|---|---|---|---|
| **(A) Latest year vs. last pre-COVID year (CY2019)**, as a raw ratio or % change | Yes — the distorted years are skipped entirely, not averaged over | 2 snapshots, one subtraction/division | Directionally sound, but a raw multi-year % change isn't annualized, so it silently penalizes/rewards airports based on how many elapsed years happen to separate 2019 from "latest" (e.g. a 15% "growth" number means something different if latest = CY2024 (5 yrs) vs CY2023 (4 yrs)) — comparable across airports only if every airport uses the *same* latest year, which will be true here since it's one global dataset, but the number itself still isn't an annualized rate a reader can sanity-check against, say, "airport X grows ~3%/yr" |
| **(B) Latest year vs. prior year only (plain YoY)**, treating 2020–2021 as a documented excluded anomaly | Yes, trivially — it doesn't touch the COVID years at all once they're outside the 2-year window | 2 snapshots, one subtraction/division; simplest of the three | Weakest signal for a "growth trend": one YoY delta is noisy (a single bad weather year, a single airline capacity cut/add, a runway closure) and captures a blip, not a trend — using the word "trend" for a single YoY point is not defensible even though it's COVID-safe |
| **(C) CAGR from CY2019 to latest available** | Yes, same mechanism as (A) — intermediate distorted years are simply not inputs | 2 snapshots, one `(latest/base)^(1/years) - 1` formula | Same COVID-robustness as (A), **plus** it's annualized, so the resulting rate is directly comparable across airports and across time (re-run next year with a different "latest," and the numbers stay on the same annualized scale), and it's a standard, well-understood, easily-explained statistic (CAGR) rather than a bespoke ratio — this is the more defensible of the two 2-snapshot options for a scoring formula that has to make sense to someone reading it as "X% per year" |

**(B) is rejected outright** — it isn't a trend measure at all, just a one-year
delta; it happens to dodge COVID but at the cost of the underlying premise (a
"passenger-growth trend" score meant to reflect multi-year trajectory, not last
year's noise).

**(A) vs (C):** both compare the same two data points; the only difference is
whether the multi-year change is left as a raw ratio or annualized into a CAGR.
Annualizing costs nothing extra in data or complexity (same two lookups, one extra
arithmetic step: raise to the power of `1/years_elapsed`), and it produces a number
that stays meaningful even as "latest available year" keeps shifting forward in
future runs of the same formula. **(C) is the recommended method.**

### 5c. Concrete years to pull, and the exact formula

**Pull exactly two files per airport for the primary trend score:**

1. **CY2019** — `arp-cy2019-all-enplanements.pdf` (or the commercial-service variant, matching whichever "All Airports" vs "Commercial Service" file the rest of the tool already uses) — the last full calendar year unaffected by COVID-19, and the standard base year the industry itself uses for "recovered to X% of pre-pandemic levels" framing (BTS uses the same CY2019 baseline in its own 2020 comparison, per the BTS citation already in §2d/§5b above), so scores framed this way will match language readers already expect from other aviation reporting.
2. **CY2024** (final) — the most recent year with FAA-confirmed **final**, non-preliminary data as of this research (2026-08-31; see §5a). Prefer this over CY2025 preliminary as the "latest" input to the primary score specifically because preliminary figures are subject to revision — better to have a stable, defensible number than the freshest-but-shakiest one for a score other people will treat as authoritative.

**Formula (2-point CAGR):**

```
years_elapsed = latest_year - base_year         # 2024 - 2019 = 5
CAGR = (enplanements_latest / enplanements_2019) ^ (1 / years_elapsed) - 1
```

This needs only two numbers per airport, no regression library, no curve-fitting —
trivial to implement deterministically and to unit-test against hand-computed
examples.

**Optional third snapshot for a secondary "current momentum" signal:** pull
**CY2025 preliminary** as well, and compute a plain YoY delta, `CY2025_prelim /
CY2024_final - 1`, surfaced separately and clearly labeled "preliminary, subject to
revision" — this gives a near-term-direction check (e.g. flagging an airport that
recovered nicely by CY2024 but is now declining again) without letting an
unrevised/shaky number drive the primary long-run trend score. If/when the CY2025
final file posts (expected imminently per FAA's own schedule, see §5a), swap it in
for the preliminary figure and the whole 3-snapshot scheme becomes CY2019 (base) /
CY2024 (prior final, kept for context) / CY2025 (new latest final) — at that point
the primary CAGR's `latest_year` input should be bumped to 2025 (`years_elapsed = 6`)
so the score keeps tracking the true "most recent final year" rather than going
stale.

### 5d. One clear recommendation

**Use a 2-point CAGR from CY2019 to CY2024 (final)** as the deterministic
passenger-growth-trend input:

```
CAGR = (CY2024_enplanements / CY2019_enplanements) ^ (1/5) - 1
```

Pull `arp-cy2019-all-enplanements` and `ARP-cy2024-all-enplanements` (matching
All-Airports vs. Commercial-Service variant to whatever the rest of the tool uses).
This is COVID-safe by construction (the 2020–2023 distortion years are simply not
in the formula at all, so there's nothing to "correct" or smooth), needs only two
downloaded files and one line of arithmetic per airport, and produces a standard,
readily-interpretable annualized rate rather than a bespoke multi-year ratio.
Optionally layer in CY2025-preliminary as a separately-labeled, non-authoritative
"recent momentum" YoY figure, and re-baseline `latest_year` to CY2025 once its
final file is confirmed posted (check again shortly after this date, since FAA's own
schedule places that release right around now).
