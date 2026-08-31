/**
 * Lightweight verification harness for the scoring engine -- NOT a formal
 * test suite (no framework installed; see ticket #7's resolution for why).
 * Runs the pure functions in scoring.ts directly against the real
 * data/airports.json and prints results for exactly the scenarios the 4
 * assignment test cases exercise, so formula sanity can be eyeballed before
 * wiring any of this into the Gemini agent (ticket #8).
 *
 * Run with: npm run score:smoke
 */

import airportsData from "../data/airports.json";
import {
  AirportRecord,
  congestionIndex,
  investmentOpportunityScore,
  longHaulStats,
  rankAirports,
  regionOf,
  unmetDemandAnalysis,
} from "./scoring";

const airports = airportsData as unknown as AirportRecord[];

function byIata(iata: string): AirportRecord {
  const a = airports.find((x) => x.iata === iata);
  if (!a) throw new Error(`No airport record for ${iata} -- check data/airports.json`);
  return a;
}

function section(title: string) {
  console.log(`\n=== ${title} ===`);
}

// --- Test case 1: New England terminal-expansion candidates -----------------
section("Test case 1: New England candidates (ranked by Investment Score)");
const newEngland = rankAirports(airports, { region: "New England" });
console.log(`Found ${newEngland.length} New England airports in the dataset.`);
for (const { airport, investment } of newEngland) {
  console.log(
    `  ${airport.iata.padEnd(4)} ${airport.name.padEnd(45)} score=${investment.score.toString().padStart(5)}  util=${investment.utilizationComponent}  congestion=${investment.congestionComponent}  growth=${investment.growthComponent}`,
  );
}

// --- Test case 2: LAX vs SNA congestion --------------------------------------
section("Test case 2: LAX vs SNA congestion");
for (const iata of ["LAX", "SNA"]) {
  const a = byIata(iata);
  const c = congestionIndex(a);
  console.log(
    `  ${iata}: Congestion Index=${c.score} (utilization=${c.utilizationPct}% -> ${c.utilizationComponent}, delay=${c.delayPct}% -> ${c.delayComponent})`,
  );
}

// --- Test case 3: % long-haul out of ANC -------------------------------------
section("Test case 3: % long-haul flights out of ANC");
const anc = byIata("ANC");
console.log(`  ANC:`, longHaulStats(anc));

// --- Test case 4: unmet demand at SFO and why --------------------------------
section("Test case 4: unmet demand at SFO and why");
const sfo = byIata("SFO");
const unmet = unmetDemandAnalysis(sfo);
console.log(`  isConstrained=${unmet.isConstrained}, unmetPax=${unmet.unmetPax.toLocaleString()}`);
for (const fact of unmet.narrativeFacts) {
  console.log(`    - ${fact}`);
}

// --- Sanity: full ranking across the whole dataset ---------------------------
section("Sanity: top 5 investment candidates, full dataset");
const top5 = rankAirports(airports).slice(0, 5);
for (const { airport, investment } of top5) {
  console.log(`  ${airport.iata.padEnd(4)} score=${investment.score}`);
}

section("Sanity: region tagging spot-check");
for (const iata of ["BOS", "BTV", "LAX", "JFK"]) {
  console.log(`  ${iata} -> ${regionOf(byIata(iata))}`);
}

console.log("\nSmoke test complete.");
