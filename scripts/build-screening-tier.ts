/**
 * Build the "screening" tier of data/airports.json.
 *
 * Ticket #6 ("Build the static airport dataset") asks for ~20-25 additional
 * airports pulled *programmatically* (not hand-typed) so `screen_investment_candidates`
 * (a future Gemini tool, ticket #8) has a non-trivial ranking pool beyond the
 * ~15 hand-curated "full" tier airports in data/full-tier.json.
 *
 * What this script actually fetches live, for real, every run:
 *   - OurAirports airports.csv + runways.csv (public domain, no auth, plain HTTP GET)
 *     -> ICAO ident, coordinates, elevation, municipality/region, runway count.
 *   - FAA CY2019 and CY2024 "Passenger Boarding (Enplanement)" .xlsx files
 *     (also plain HTTP GET, no auth) -> real CY2019/CY2024 enplanements + FAA
 *     hub classification (L/M/S/N), from which a real 5-year CAGR is computed
 *     using the exact same COVID-safe methodology as the full tier (ticket #3).
 *
 * What this script does NOT fetch live, and why (documented per ticket #6's
 * explicit allowance for this pragmatic 1-day-scope simplification):
 *   - BTS T-100 segment data (route/distance-group mix, used elsewhere for
 *     long-haul %) has no documented direct-download URL. Its web UI
 *     (transtats.bts.gov/DL_SelectFields.asp) requires an interactive
 *     multi-field form submission with no scriptable GET equivalent.
 *   - BTS On-Time Performance / Air Travel Consumer Report data is exposed
 *     via a Socrata API at datahub.transportation.gov, but every relevant
 *     resource (e.g. r52d-vs5d, ewwa-r892) returns
 *     `{"error":true,"message":"You must be logged in to access this resource"}`
 *     for unauthenticated requests -- verified during this ticket's research.
 *     The bts.gov/transportation.gov hosted summary PDF/XLSX rankings also
 *     return HTTP 403 to automated fetches from this environment.
 *   -> For these two fields only, this script uses a small hardcoded lookup
 *      table (LONG_HAUL_AND_DELAY_ESTIMATES below), built the same way the
 *      full-tier's "estimated" fields were: a destination-count-based
 *      long-haul proxy (>=2000mi nonstop destinations / total nonstop
 *      destinations, from published route maps) and a delay-rate estimate
 *      anchored to the real CY2024 national BTS baseline (20.3% of flights
 *      delayed >15min) and adjusted per airport for well-documented,
 *      citable congestion/network characteristics (hub role, airspace
 *      complexity, runway layout). Every such value is marked
 *      `confidence: "estimated"`, exactly like the equivalent full-tier
 *      fields, so downstream consumers can distinguish it from the
 *      `confidence: "sourced"` OurAirports/FAA-derived fields.
 *
 * Output: merges data/full-tier.json (hand-curated, tier "full") with the
 * freshly-computed screening-tier records (tier "screening") and writes the
 * combined array to data/airports.json. That committed JSON -- not this
 * script -- is what the rest of the app (scoring engine, Gemini tools) reads
 * at request time; this script is re-run only to refresh the dataset.
 */

import * as fs from "fs";
import * as path from "path";
import ExcelJS from "exceljs";

const OURAIRPORTS_AIRPORTS_URL =
  "https://davidmegginson.github.io/ourairports-data/airports.csv";
const OURAIRPORTS_RUNWAYS_URL =
  "https://davidmegginson.github.io/ourairports-data/runways.csv";
const FAA_CY2019_XLSX_URL =
  "https://www.faa.gov/sites/faa.gov/files/airports/planning_capacity/passenger_allcargo_stats/passenger/cy19-commercial-service-enplanements.xlsx";
const FAA_CY2024_XLSX_URL =
  "https://www.faa.gov/airports/planning_capacity/passenger_allcargo_stats/passenger/arp-cy2024-commercial-service-enplanements.xlsx";

// A uniform HTTP User-Agent is required: faa.gov returns HTTP 403 to some
// default fetch/curl user agents.
const FETCH_HEADERS = { "User-Agent": "Mozilla/5.0 (compatible; airport-data-pipeline/1.0)" };

/** Same constant, and same derivation, as documented in data/full-tier.json's
 * capacity.methodology field for every full-tier airport: FAA AC 150/5060-5
 * hourly single-runway capacity benchmark (~50-60 ops/hr) x an assumed
 * ~250,000 practical annual operations for a well-utilized independent
 * runway x a blended ~85 enplaned passengers per departure (roughly half of
 * all operations), rounded to a clean constant. */
const ANNUAL_PASSENGERS_PER_RUNWAY = 10_000_000;

const NATIONAL_DELAY_BASELINE_2024_PCT = 20.3; // BTS CY2024: 20.3% of scheduled domestic flights delayed >15min.

/** The ~22 additional major US commercial airports pulled programmatically
 * for the screening tier. Chosen to round out geographic/hub-size diversity
 * beyond the 15 hand-curated full-tier airports (data/full-tier.json). */
const SCREENING_TIER_IATA_CODES = [
  "MIA", "SEA", "LAS", "PHX", "MCO", "EWR", "CLT", "MSP", "DTW", "PHL",
  "LGA", "BWI", "SAN", "TPA", "IAH", "HNL", "IAD", "DCA", "SLC", "PDX",
  "AUS", "MSY",
];

/**
 * Pragmatic 1-day-scope lookup table for the two fields that cannot be
 * fetched programmatically in this environment (see module doc comment).
 * longHaulSharePct: % of unique nonstop destinations at >=2000 statute miles
 *   (same distance-group cutoff and destination-count-proxy methodology used
 *   for the full tier), from published route maps (FlightConnections /
 *   Wikipedia / airline route lists, accessed Aug 2026).
 * delayPct15: estimated % of flights delayed >15min, anchored to the real
 *   CY2024 national BTS baseline (20.3%) and adjusted for each airport's
 *   documented hub role / airspace complexity / runway layout.
 * note: the specific, citable fact (if any) behind the adjustment.
 */
const LONG_HAUL_AND_DELAY_ESTIMATES: Record<
  string,
  { longHaulSharePct: number; delayPct15: number; note: string }
> = {
  MIA: { longHaulSharePct: 18, delayPct15: 22, note: "Major Latin America gateway; most Caribbean/Central America routes fall under 2,000mi, but ~25-30 of ~150 destinations (South America, Europe) clear it." },
  SEA: { longHaulSharePct: 12, delayPct15: 19, note: "Growing transpacific/transatlantic hub (Alaska/Delta) with ~10-12 long-haul destinations of ~90." },
  LAS: { longHaulSharePct: 4, delayPct15: 18, note: "Overwhelmingly domestic leisure hub; a handful of UK/long Mexico routes clear 2,000mi." },
  PHX: { longHaulSharePct: 2, delayPct15: 17, note: "Almost entirely domestic/short-international (Mexico, Canada) plus one London route." },
  MCO: { longHaulSharePct: 4, delayPct15: 20, note: "Huge domestic leisure hub; limited long-haul beyond a few Latin America/Europe charter routes." },
  EWR: { longHaulSharePct: 16, delayPct15: 26, note: "United transatlantic hub with dense NYC-area airspace congestion (EWR/JFK/LGA share the same terminal airspace)." },
  CLT: { longHaulSharePct: 7, delayPct15: 22, note: "American Airlines domestic hub with a modest transatlantic network; frequent weather-driven ground delay programs." },
  MSP: { longHaulSharePct: 7, delayPct15: 18, note: "Delta domestic hub with a modest long-haul network (Amsterdam, Paris, London, Tokyo, Seoul)." },
  DTW: { longHaulSharePct: 8, delayPct15: 17, note: "Delta domestic hub, similar profile to MSP." },
  PHL: { longHaulSharePct: 12, delayPct15: 21, note: "American Airlines transatlantic hub with a sizeable European network." },
  LGA: { longHaulSharePct: 0, delayPct15: 25, note: "Subject to the LaGuardia perimeter rule (nonstop flights generally limited to <=1,500mi with narrow exceptions); dense NYC-area airspace drives high delay rates." },
  BWI: { longHaulSharePct: 3, delayPct15: 18, note: "Mostly Southwest domestic low-cost network; minor seasonal international (Iceland, Caribbean)." },
  SAN: { longHaulSharePct: 2, delayPct15: 15, note: "Mostly domestic; one long-haul international route (Tokyo, Japan Airlines) plus Mexico/Canada." },
  TPA: { longHaulSharePct: 3, delayPct15: 16, note: "Mostly domestic leisure network; limited seasonal UK/Caribbean international." },
  IAH: { longHaulSharePct: 11, delayPct15: 19, note: "United's Latin America gateway with a growing Asia/Europe long-haul network." },
  HNL: { longHaulSharePct: 65, delayPct15: 13, note: "Hawaii's primary gateway: nearly all mainland-US and international scheduled destinations exceed 2,000mi by definition; only short interisland hops fall under the cutoff." },
  IAD: { longHaulSharePct: 21, delayPct15: 19, note: "United's Washington DC international gateway with a substantial European/African/Middle East/Asian long-haul network." },
  DCA: { longHaulSharePct: 2, delayPct15: 20, note: "Subject to the DCA perimeter rule (nonstop flights generally limited to <=1,250mi, with a small number of federally exempted longer routes); slot-constrained." },
  SLC: { longHaulSharePct: 6, delayPct15: 15, note: "Delta domestic hub with a modest long-haul network (Amsterdam, Paris, London) and generally favorable operating weather." },
  PDX: { longHaulSharePct: 6, delayPct15: 15, note: "Growing but still modest international network (Tokyo, Amsterdam)." },
  AUS: { longHaulSharePct: 3, delayPct15: 17, note: "Mostly domestic with a small and recently-growing transatlantic network." },
  MSY: { longHaulSharePct: 3, delayPct15: 16, note: "Mostly domestic leisure/business network with limited seasonal UK/Mexico international service." },
};

interface OurAirportsRow {
  [key: string]: string;
}

function parseCsv(text: string): OurAirportsRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  const header = parseCsvLine(lines[0]);
  const rows: OurAirportsRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const fields = parseCsvLine(lines[i]);
    if (fields.length !== header.length) continue;
    const row: OurAirportsRow = {};
    header.forEach((h, idx) => (row[h] = fields[idx]));
    rows.push(row);
  }
  return rows;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      result.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  result.push(cur);
  return result;
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: FETCH_HEADERS });
  if (!res.ok) throw new Error(`GET ${url} -> HTTP ${res.status}`);
  return res.text();
}

async function fetchBuffer(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url, { headers: FETCH_HEADERS });
  if (!res.ok) throw new Error(`GET ${url} -> HTTP ${res.status}`);
  return res.arrayBuffer();
}

interface FaaRow {
  locid: string;
  city: string;
  airportName: string;
  hub: string; // L/M/S/N
  enplanements: number;
}

async function parseFaaXlsx(buffer: ArrayBuffer): Promise<Map<string, FaaRow>> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);
  const sheet = workbook.worksheets[0];
  const byLocid = new Map<string, FaaRow>();
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // header
    const values = row.values as any[]; // 1-indexed
    // Columns per FAA layout: Rank, RO, ST, Locid, City, Airport Name, S/L, Hub, CY enplanements, prior-CY enplanements, % change
    const locid = String(values[4] ?? "").trim();
    const city = String(values[5] ?? "").trim();
    const airportName = String(values[6] ?? "").trim();
    const hub = String(values[8] ?? "").trim();
    const enplanements = Number(values[9]);
    if (locid && Number.isFinite(enplanements)) {
      byLocid.set(locid, { locid, city, airportName, hub, enplanements });
    }
  });
  return byLocid;
}

interface ScreeningAirportRecord {
  iata: string;
  icao: string;
  name: string;
  city: string;
  state: string;
  lat: number;
  lon: number;
  elevationFt: number;
  tier: "screening";
  ourAirportsType: string;
  runwayCount: number;
  runwayCountTotal: number;
  runwayCountSource: string;
  runwayCountConfidence: "sourced";
  faaHub: { code: string; label: string };
  enplanements: {
    cy2019: number;
    cy2024: number;
    cagr5yr: number;
    methodology: string;
    source: string;
    confidence: "sourced";
  };
  capacity: {
    annualPassengerCapacity: number;
    perRunwayAnnualPassengers: number;
    methodology: string;
    source: string;
    confidence: "estimated";
  };
  capacityUtilizationPct: number;
  routeMix: {
    longHaulSharePct: number;
    definition: string;
    distanceGroupCutoffMiles: number;
    methodology: string;
    source: string;
    confidence: "estimated";
  };
  delay: {
    pctFlightsDelayed15: number;
    year: number;
    metric: string;
    methodology: string;
    source: string;
    confidence: "estimated";
  };
  notes: string[];
}

const HUB_LABELS: Record<string, string> = {
  L: "Large hub",
  M: "Medium hub",
  S: "Small hub",
  N: "Nonhub (primary)",
};

function computeCagr(cy2019: number, cy2024: number): number {
  return Math.pow(cy2024 / cy2019, 1 / 5) - 1;
}

async function main() {
  console.log("Fetching OurAirports airports.csv ...");
  const airportsCsv = await fetchText(OURAIRPORTS_AIRPORTS_URL);
  console.log("Fetching OurAirports runways.csv ...");
  const runwaysCsv = await fetchText(OURAIRPORTS_RUNWAYS_URL);
  console.log("Fetching FAA CY2019 enplanements .xlsx ...");
  const cy2019Buf = await fetchBuffer(FAA_CY2019_XLSX_URL);
  console.log("Fetching FAA CY2024 enplanements .xlsx ...");
  const cy2024Buf = await fetchBuffer(FAA_CY2024_XLSX_URL);

  const airports = parseCsv(airportsCsv);
  const runways = parseCsv(runwaysCsv);
  const byIata = new Map<string, OurAirportsRow>();
  for (const a of airports) {
    if (a.iata_code) byIata.set(a.iata_code, a);
  }

  const faa2019 = await parseFaaXlsx(cy2019Buf);
  const faa2024 = await parseFaaXlsx(cy2024Buf);

  const records: ScreeningAirportRecord[] = [];
  const skipped: string[] = [];

  for (const iata of SCREENING_TIER_IATA_CODES) {
    const airport = byIata.get(iata);
    const f19 = faa2019.get(iata);
    const f24 = faa2024.get(iata);
    const estimate = LONG_HAUL_AND_DELAY_ESTIMATES[iata];

    if (!airport || !f19 || !f24 || !estimate) {
      skipped.push(
        `${iata}: missing ${!airport ? "OurAirports row " : ""}${!f19 ? "FAA CY2019 row " : ""}${!f24 ? "FAA CY2024 row " : ""}${!estimate ? "lookup-table entry" : ""}`.trim()
      );
      continue;
    }

    const relevantRunways = runways.filter((r) => r.airport_ident === airport.ident);
    const openRunways = relevantRunways.filter((r) => r.closed !== "1");
    const runwayCount = Math.max(openRunways.length, 1); // guard against bad data: never divide capacity to 0

    const cagr = computeCagr(f19.enplanements, f24.enplanements);
    const annualPassengerCapacity = runwayCount * ANNUAL_PASSENGERS_PER_RUNWAY;
    const capacityUtilizationPct =
      Math.round((f24.enplanements / annualPassengerCapacity) * 1000) / 10;

    records.push({
      iata,
      icao: airport.icao_code || airport.gps_code || airport.ident,
      name: airport.name,
      city: airport.municipality,
      state: (airport.iso_region || "").replace("US-", ""),
      lat: Number(airport.latitude_deg),
      lon: Number(airport.longitude_deg),
      elevationFt: Number(airport.elevation_ft) || 0,
      tier: "screening",
      ourAirportsType: airport.type,
      runwayCount: openRunways.length,
      runwayCountTotal: relevantRunways.length,
      runwayCountSource:
        "OurAirports airports.csv/runways.csv (public domain), fetched live at build time from https://davidmegginson.github.io/ourairports-data/",
      runwayCountConfidence: "sourced",
      faaHub: { code: f24.hub, label: HUB_LABELS[f24.hub] ?? f24.hub },
      enplanements: {
        cy2019: f19.enplanements,
        cy2024: f24.enplanements,
        cagr5yr: Math.round(cagr * 10000) / 10000,
        methodology:
          "5-year CAGR = (CY2024 / CY2019)^(1/5) - 1, per ticket #3's COVID-safe methodology (skips the 2020-2022 pandemic collapse/recovery years by construction).",
        source:
          "FAA CY2019 and CY2024 Passenger Boarding (Enplanement) Data for U.S. Airports, fetched live at build time from faa.gov",
        confidence: "sourced",
      },
      capacity: {
        annualPassengerCapacity,
        perRunwayAnnualPassengers: ANNUAL_PASSENGERS_PER_RUNWAY,
        methodology:
          "runway-count-based heuristic: annualPassengerCapacity = openRunwayCount * 10,000,000. Same uniform constant and derivation as the full tier -- see data/full-tier.json's ANC record for the full FAA AC 150/5060-5-based derivation chain.",
        source: "Derived heuristic (see methodology field); not a published per-airport figure.",
        confidence: "estimated",
      },
      capacityUtilizationPct,
      routeMix: {
        longHaulSharePct: estimate.longHaulSharePct,
        definition:
          "Share of unique nonstop scheduled passenger destinations at >=2000 statute miles great-circle distance from the airport (a destination-count proxy for BTS T-100 passenger-weighted long-haul mix).",
        distanceGroupCutoffMiles: 2000,
        methodology: `Pragmatic 1-day-scope simplification, lower confidence than the full tier's already-estimated figures: BTS T-100 segment microdata is not fetchable by this script (TranStats requires an interactive form submission with no documented direct-download URL; see module doc comment). Value is a hardcoded estimate from published route maps. ${estimate.note}`,
        source:
          "Hardcoded lookup table in scripts/build-screening-tier.ts (LONG_HAUL_AND_DELAY_ESTIMATES), built from published route maps (FlightConnections/Wikipedia, accessed Aug 2026).",
        confidence: "estimated",
      },
      delay: {
        pctFlightsDelayed15: estimate.delayPct15,
        year: 2024,
        metric: "approx. % of scheduled flights delayed >15min",
        methodology: `Pragmatic 1-day-scope simplification, lower confidence than the full tier's already-estimated figures: BTS On-Time Performance microdata requires an authenticated Socrata API call (datahub.transportation.gov returns "You must be logged in") and the bts.gov/transportation.gov summary report downloads return HTTP 403 to automated fetches; see module doc comment. Value is anchored to the real CY2024 national baseline (${NATIONAL_DELAY_BASELINE_2024_PCT}% of flights delayed) and adjusted per airport. ${estimate.note}`,
        source:
          "Hardcoded lookup table in scripts/build-screening-tier.ts (LONG_HAUL_AND_DELAY_ESTIMATES); national baseline from BTS Air Travel Consumer Report CY2024.",
        confidence: "estimated",
      },
      notes: [
        "Screening tier: pulled programmatically by scripts/build-screening-tier.ts, not hand-curated. Runway/coordinate data and enplanements/CAGR are freshly fetched from OurAirports and FAA at build time (confidence: sourced); long-haul share and delay rate are a lower-confidence hardcoded estimate (confidence: estimated) -- see the methodology fields above.",
      ],
    });
  }

  if (skipped.length > 0) {
    console.warn("Skipped codes (missing data):", skipped.join("; "));
  }

  const fullTierPath = path.join(__dirname, "..", "data", "full-tier.json");
  const fullTier = JSON.parse(fs.readFileSync(fullTierPath, "utf8"));

  const combined = [...fullTier, ...records];

  const outPath = path.join(__dirname, "..", "data", "airports.json");
  fs.writeFileSync(outPath, JSON.stringify(combined, null, 2) + "\n", "utf8");

  console.log(
    `Wrote ${combined.length} airports (${fullTier.length} full + ${records.length} screening) to ${outPath}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
