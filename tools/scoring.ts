/**
 * Deterministic scoring engine for the Airport Investment Intelligence Agent.
 *
 * Every function here is a pure function over an AirportRecord (or a list of
 * them): no I/O, no LLM calls, no randomness. This module is what ticket #8's
 * Gemini tools call into -- the model is only ever handed the *results* of
 * these functions to narrate, never asked to compute a number itself.
 *
 * Formulas and weights implement the decisions recorded in ticket #3
 * ("Design deterministic scoring formulas"):
 *   - Congestion Index  = f(capacity utilization, delay severity)
 *   - Investment Score  = f(capacity utilization, Congestion Index, growth)
 *   - Unmet demand      = projected next-year demand vs. estimated capacity
 *
 * All weights/anchors below are explicit constants so they're easy to find,
 * cite in DESIGN.md, and tune later -- nothing is a magic number inline.
 */

import { AirportRecord, regionOf } from "./types";

// ---------------------------------------------------------------------------
// Tunable constants (documented here; cite these in DESIGN.md verbatim)
// ---------------------------------------------------------------------------

/** Congestion Index = utilization component * W + delay component * (1-W). */
export const CONGESTION_WEIGHTS = {
  utilization: 0.6,
  delay: 0.4,
} as const;

/** Investment Opportunity Score weights across its three inputs (sum to 1). */
export const INVESTMENT_WEIGHTS = {
  utilization: 0.35,
  congestion: 0.35,
  growth: 0.3,
} as const;

/**
 * Utilization % at or above which the *utilization score component* saturates
 * at 100. Raw utilization can exceed 100% (e.g. ATL) -- that raw number is
 * preserved and surfaced as-is; only the normalized 0-100 score is capped, so
 * an airport at 105% and one at 140% don't further distort the blended score.
 */
const UTILIZATION_SCORE_CAP_PCT = 100;

/**
 * % of flights delayed >15min at which the delay score component saturates
 * at 100. CY2024 national baseline is ~20.3% (BTS); SFO's ~29.5% is the
 * highest sourced figure in this dataset. 40% gives headroom above the worst
 * observed value rather than clipping real data at the top of its own range.
 */
const DELAY_SCORE_SATURATION_PCT = 40;

/**
 * 5-year CAGR range mapped onto the 0-100 growth score: -5%/yr -> 0,
 * 0%/yr -> 50, +5%/yr -> 100. Chosen because the dataset's observed CAGR
 * range (~-6% to +4%/yr) fits comfortably inside it without every airport
 * bunching at one end.
 */
const GROWTH_SCORE_MIN_CAGR = -0.05;
const GROWTH_SCORE_MAX_CAGR = 0.05;

/** CY2024 national on-time-performance baseline (BTS Air Travel Consumer Report). */
export const NATIONAL_BASELINE_DELAY_PCT = 20.3;

/**
 * "Operational strain" thresholds for unmetDemandAnalysis(): utilization at
 * or above this AND delay meaningfully above the national baseline is
 * treated as unmet demand even when raw passenger volume hasn't crossed the
 * capacity ceiling. Rationale: elevated delay at moderate-to-high utilization
 * is itself evidence that *effective* capacity (weather/operational limits,
 * e.g. SFO's fog-restricted parallel runways) is tighter than the
 * passenger-volume heuristic alone suggests -- a naive volume-vs-ceiling
 * check misses this entirely (verified against SFO during ticket #7's
 * smoke test: -2%/yr CAGR meant a volume-only check said "not constrained",
 * which contradicts SFO's well-documented chronic delay problem).
 */
const OPERATIONAL_STRAIN_UTILIZATION_THRESHOLD_PCT = 50;
const OPERATIONAL_STRAIN_DELAY_MARGIN_PCT = 5;

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, n));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// ---------------------------------------------------------------------------
// Capacity utilization
// ---------------------------------------------------------------------------

/**
 * Passengers (CY2024 enplanements) / estimated annual passenger capacity, as
 * a percentage. Recomputed from raw fields rather than trusting
 * AirportRecord.capacityUtilizationPct (a value the data pipeline precomputed
 * for its own review), so this formula has exactly one implementation.
 */
export function capacityUtilizationPct(airport: AirportRecord): number {
  return (airport.enplanements.cy2024 / airport.capacity.annualPassengerCapacity) * 100;
}

export function utilizationScore(airport: AirportRecord): number {
  const pct = capacityUtilizationPct(airport);
  return clamp((pct / UTILIZATION_SCORE_CAP_PCT) * 100);
}

export function delayScore(airport: AirportRecord): number {
  return clamp((airport.delay.pctFlightsDelayed15 / DELAY_SCORE_SATURATION_PCT) * 100);
}

export function growthScore(airport: AirportRecord): number {
  const { cagr5yr } = airport.enplanements;
  const range = GROWTH_SCORE_MAX_CAGR - GROWTH_SCORE_MIN_CAGR;
  return clamp(((cagr5yr - GROWTH_SCORE_MIN_CAGR) / range) * 100);
}

// ---------------------------------------------------------------------------
// Congestion Index -- also a standalone, user-facing KPI (test case 2)
// ---------------------------------------------------------------------------

export interface CongestionIndexResult {
  /** 0-100 blended score. */
  score: number;
  utilizationComponent: number;
  delayComponent: number;
  /** Raw, un-normalized inputs, for display/explanation. */
  utilizationPct: number;
  delayPct: number;
  weights: typeof CONGESTION_WEIGHTS;
}

export function congestionIndex(airport: AirportRecord): CongestionIndexResult {
  const uScore = utilizationScore(airport);
  const dScore = delayScore(airport);
  const score =
    uScore * CONGESTION_WEIGHTS.utilization + dScore * CONGESTION_WEIGHTS.delay;

  return {
    score: round1(score),
    utilizationComponent: round1(uScore),
    delayComponent: round1(dScore),
    utilizationPct: round1(capacityUtilizationPct(airport)),
    delayPct: airport.delay.pctFlightsDelayed15,
    weights: CONGESTION_WEIGHTS,
  };
}

// ---------------------------------------------------------------------------
// Investment Opportunity Score
// ---------------------------------------------------------------------------

export interface InvestmentScoreResult {
  /** 0-100 blended score. Higher = stronger renovation/expansion candidate. */
  score: number;
  utilizationComponent: number;
  congestionComponent: number;
  growthComponent: number;
  weights: typeof INVESTMENT_WEIGHTS;
  /** Full breakdown of the congestion sub-score, since it's itself composite. */
  congestion: CongestionIndexResult;
}

/**
 * Note on the deliberate overlap: capacity utilization is weighted directly
 * (35%) AND indirectly through the Congestion Index (60% of that 35%, i.e.
 * another ~21%). This isn't double-counting by accident -- utilization is
 * the single clearest quantifiable signal of a capacity/demand mismatch
 * (the assignment's actual stated goal), so it's intentionally the dominant
 * input across both layers.
 */
export function investmentOpportunityScore(airport: AirportRecord): InvestmentScoreResult {
  const uScore = utilizationScore(airport);
  const congestion = congestionIndex(airport);
  const gScore = growthScore(airport);

  const score =
    uScore * INVESTMENT_WEIGHTS.utilization +
    congestion.score * INVESTMENT_WEIGHTS.congestion +
    gScore * INVESTMENT_WEIGHTS.growth;

  return {
    score: round1(score),
    utilizationComponent: round1(uScore),
    congestionComponent: congestion.score,
    growthComponent: round1(gScore),
    weights: INVESTMENT_WEIGHTS,
    congestion,
  };
}

// ---------------------------------------------------------------------------
// Long-haul stats -- thin passthrough, kept here so every KPI has one home
// ---------------------------------------------------------------------------

export interface LongHaulStats {
  longHaulSharePct: number;
  distanceGroupCutoffMiles: number;
  definition: string;
  confidence: AirportRecord["routeMix"]["confidence"];
}

export function longHaulStats(airport: AirportRecord): LongHaulStats {
  const { longHaulSharePct, distanceGroupCutoffMiles, definition, confidence } = airport.routeMix;
  return { longHaulSharePct, distanceGroupCutoffMiles, definition, confidence };
}

// ---------------------------------------------------------------------------
// Unmet demand analysis (core of test case 4: "unmet demand at SFO and why")
// ---------------------------------------------------------------------------

export interface UnmetDemandResult {
  currentPax: number;
  capacity: number;
  utilizationPct: number;
  cagr5yr: number;
  /** Naive 1-year-ahead projection at the current CAGR. */
  projectedNextYearPax: number;
  /** max(0, projected - capacity) -- passengers demand would strand next year. */
  unmetPax: number;
  /**
   * true if EITHER: (a) already over capacity or projected to exceed it
   * within a year (volume-based), OR (b) utilization is elevated and delay
   * is meaningfully above the national baseline (operationally-strained --
   * see OPERATIONAL_STRAIN_* constants). An airport can be constrained by
   * (b) alone even with flat/declining passenger volume, e.g. SFO.
   */
  isConstrained: boolean;
  isVolumeConstrained: boolean;
  isOperationallyStrained: boolean;
  /**
   * Plain-fact strings (numbers + context only, no persuasion/spin) for the
   * LLM to narrate. This is the hallucination boundary in practice: the tool
   * layer (ticket #8) hands these facts to Gemini instead of raw numbers
   * alone, so the model explains *these specific facts* rather than
   * inventing its own framing.
   */
  narrativeFacts: string[];
}

export function unmetDemandAnalysis(airport: AirportRecord): UnmetDemandResult {
  const currentPax = airport.enplanements.cy2024;
  const capacity = airport.capacity.annualPassengerCapacity;
  const utilizationPct = capacityUtilizationPct(airport);
  const { cagr5yr } = airport.enplanements;
  const projectedNextYearPax = currentPax * (1 + cagr5yr);
  const unmetPax = Math.max(0, projectedNextYearPax - capacity);
  const isVolumeConstrained = utilizationPct >= 100 || unmetPax > 0;
  const isOperationallyStrained =
    utilizationPct >= OPERATIONAL_STRAIN_UTILIZATION_THRESHOLD_PCT &&
    airport.delay.pctFlightsDelayed15 >= NATIONAL_BASELINE_DELAY_PCT + OPERATIONAL_STRAIN_DELAY_MARGIN_PCT;
  const isConstrained = isVolumeConstrained || isOperationallyStrained;

  const facts: string[] = [
    `Current (CY2024) enplanements: ${Math.round(currentPax).toLocaleString()}.`,
    `Estimated annual passenger capacity: ${Math.round(capacity).toLocaleString()} (${airport.capacity.confidence}; see capacity.methodology for derivation).`,
    `Capacity utilization: ${round1(utilizationPct)}%.`,
    `5-year passenger CAGR (CY2019->CY2024, COVID-collapse years excluded by construction): ${round1(cagr5yr * 100)}%/yr.`,
  ];

  if (isVolumeConstrained) {
    facts.push(
      `At the current growth trend, next year's projected demand (~${Math.round(
        projectedNextYearPax,
      ).toLocaleString()}) would exceed estimated capacity by ~${Math.round(
        unmetPax,
      ).toLocaleString()} passengers.`,
    );
  } else {
    facts.push(
      `At the current growth trend, next year's projected demand (~${Math.round(
        projectedNextYearPax,
      ).toLocaleString()}) remains within the raw passenger-volume capacity ceiling.`,
    );
  }

  if (isOperationallyStrained) {
    facts.push(
      `However, ${airport.iata} already shows operational strain even below its raw volume ceiling: utilization is elevated (${round1(
        utilizationPct,
      )}%) and its delay rate (${airport.delay.pctFlightsDelayed15}%, ${airport.delay.confidence}) sits ${round1(
        airport.delay.pctFlightsDelayed15 - NATIONAL_BASELINE_DELAY_PCT,
      )} points above the CY2024 national baseline (${NATIONAL_BASELINE_DELAY_PCT}%) -- evidence that effective capacity (weather/operational limits) is tighter than the passenger-volume heuristic alone suggests.`,
    );
  } else if (airport.delay.pctFlightsDelayed15 > NATIONAL_BASELINE_DELAY_PCT) {
    facts.push(
      `Delay rate (${airport.delay.pctFlightsDelayed15}%, ${airport.delay.confidence}) is above the CY2024 national baseline (${NATIONAL_BASELINE_DELAY_PCT}%), though not enough on its own (combined with utilization) to count as operational strain.`,
    );
  }

  for (const note of airport.notes) {
    facts.push(`Context: ${note}`);
  }

  return {
    currentPax,
    capacity,
    utilizationPct: round1(utilizationPct),
    cagr5yr,
    projectedNextYearPax: Math.round(projectedNextYearPax),
    unmetPax: Math.round(unmetPax),
    isConstrained,
    isVolumeConstrained,
    isOperationallyStrained,
    narrativeFacts: facts,
  };
}

// ---------------------------------------------------------------------------
// Ranking / screening
// ---------------------------------------------------------------------------

export interface RankedAirport {
  airport: AirportRecord;
  investment: InvestmentScoreResult;
}

export interface ScreenOptions {
  /** e.g. "New England". Matched via types.ts's regionOf() state lookup. */
  region?: string;
  minScore?: number;
}

/**
 * Ranks airports by Investment Opportunity Score, descending. Backs both
 * screen_investment_candidates (ticket #8) and the New England test case.
 */
export function rankAirports(airports: AirportRecord[], opts: ScreenOptions = {}): RankedAirport[] {
  let pool = airports;

  if (opts.region) {
    pool = pool.filter((a) => regionOf(a) === opts.region);
  }

  const scored: RankedAirport[] = pool.map((airport) => ({
    airport,
    investment: investmentOpportunityScore(airport),
  }));

  const filtered =
    opts.minScore != null ? scored.filter((s) => s.investment.score >= opts.minScore!) : scored;

  return filtered.sort((a, b) => b.investment.score - a.investment.score);
}

export { regionOf } from "./types";
export type { AirportRecord } from "./types";
