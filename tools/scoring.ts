/** Turns raw airport data into the app's investment KPIs (congestion, investment score, unmet demand, long-haul share). */

import { AirportRecord, Confidence, regionOf } from "./types";

export const CONGESTION_WEIGHTS = { utilization: 0.6, delay: 0.4 } as const;
export const INVESTMENT_WEIGHTS = { utilization: 0.35, congestion: 0.35, growth: 0.3 } as const;

const UTILIZATION_SCORE_CAP_PCT = 100;
const DELAY_SCORE_SATURATION_PCT = 40; // no airport gets near 100% delayed, so cap the score lower
const GROWTH_SCORE_MIN_CAGR = -0.05;
const GROWTH_SCORE_MAX_CAGR = 0.05;

export const NATIONAL_BASELINE_DELAY_PCT = 20.3; // BTS CY2024 Air Travel Consumer Report

// Second way to flag unmet demand -- catches strain below the volume ceiling.
const OPERATIONAL_STRAIN_UTILIZATION_THRESHOLD_PCT = 50;
const OPERATIONAL_STRAIN_DELAY_MARGIN_PCT = 5;

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, n));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Raw % of estimated capacity currently used (can exceed 100%; not clamped). */
export function capacityUtilizationPct(airport: AirportRecord): number {
  return (airport.enplanements.cy2024 / airport.capacity.annualPassengerCapacity) * 100;
}

/** Utilization as a 0-100 score (clamped). */
export function utilizationScore(airport: AirportRecord): number {
  return clamp((capacityUtilizationPct(airport) / UTILIZATION_SCORE_CAP_PCT) * 100);
}

/** Delay rate normalized to a 0-100 score (saturates at DELAY_SCORE_SATURATION_PCT). */
export function delayScore(airport: AirportRecord): number {
  return clamp((airport.delay.pctFlightsDelayed15 / DELAY_SCORE_SATURATION_PCT) * 100);
}

/** 5-year passenger CAGR normalized to a 0-100 score (0% CAGR = 50, the midpoint). */
export function growthScore(airport: AirportRecord): number {
  const { cagr5yr } = airport.enplanements;
  const range = GROWTH_SCORE_MAX_CAGR - GROWTH_SCORE_MIN_CAGR;
  return clamp(((cagr5yr - GROWTH_SCORE_MIN_CAGR) / range) * 100);
}

export interface CongestionIndexResult {
  score: number;
  utilizationComponent: number;
  delayComponent: number;
  utilizationPct: number;
  delayPct: number;
  weights: typeof CONGESTION_WEIGHTS;
}

/** How congested is this airport? Blends utilization (60%) and delay (40%) into one 0-100 score. */
export function congestionIndex(
  airport: AirportRecord,
  precomputedUtilizationScore?: number,
): CongestionIndexResult {
  const uScore = precomputedUtilizationScore ?? utilizationScore(airport);
  const dScore = delayScore(airport);
  const score = uScore * CONGESTION_WEIGHTS.utilization + dScore * CONGESTION_WEIGHTS.delay;

  return {
    score: round1(score),
    utilizationComponent: round1(uScore),
    delayComponent: round1(dScore),
    utilizationPct: round1(capacityUtilizationPct(airport)),
    delayPct: airport.delay.pctFlightsDelayed15,
    weights: CONGESTION_WEIGHTS,
  };
}

export interface InvestmentScoreResult {
  score: number;
  utilizationComponent: number;
  congestionComponent: number;
  growthComponent: number;
  weights: typeof INVESTMENT_WEIGHTS;
  congestion: CongestionIndexResult;
}

/** How promising is this airport to invest in? Blends utilization, congestion, and growth into one 0-100 score. */
export function investmentOpportunityScore(airport: AirportRecord): InvestmentScoreResult {
  const uScore = utilizationScore(airport);
  const congestion = congestionIndex(airport, uScore);
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

export interface LongHaulStats {
  longHaulSharePct: number;
  distanceGroupCutoffMiles: number;
  definition: string;
  confidence: AirportRecord["routeMix"]["confidence"];
}

/** Long-haul stats are already stored in the data; this just reshapes them. */
export function longHaulStats(airport: AirportRecord): LongHaulStats {
  const { longHaulSharePct, distanceGroupCutoffMiles, definition, confidence } = airport.routeMix;
  return { longHaulSharePct, distanceGroupCutoffMiles, definition, confidence };
}

export interface UnmetDemandResult {
  currentPax: number;
  capacity: number;
  utilizationPct: number;
  cagr5yr: number;
  projectedNextYearPax: number;
  unmetPax: number;
  /** True via a raw volume projection OR operational strain -- see below. */
  isConstrained: boolean;
  isVolumeConstrained: boolean;
  isOperationallyStrained: boolean;
  capacityConfidence: Confidence;
  delayConfidence: Confidence;
  /** Plain facts for the LLM to narrate -- it explains these, not its own numbers. */
  narrativeFacts: string[];
}

/** Is demand outgrowing capacity, and why? Flags constrained airports and explains the numbers in plain language. */
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
    capacityConfidence: airport.capacity.confidence,
    delayConfidence: airport.delay.confidence,
    narrativeFacts: facts,
  };
}

export interface RankedAirport {
  airport: AirportRecord;
  investment: InvestmentScoreResult;
}

export interface ScreenOptions {
  region?: string;
  minScore?: number;
}

/** Scores every airport (optionally filtered by region/min score) and sorts by Investment Opportunity Score, highest first. */
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
