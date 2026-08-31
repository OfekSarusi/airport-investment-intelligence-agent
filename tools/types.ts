/**
 * Shape of a record in data/airports.json, as built by ticket #6.
 *
 * Kept intentionally close to the actual JSON structure (verified by reading
 * data/airports.json directly) rather than a hand-imagined schema, so the
 * scoring engine never silently reads undefined fields.
 */

export type Confidence = "sourced" | "estimated";

export interface HubClassification {
  code: string; // FAA hub code, e.g. "L", "M"
  label: string; // e.g. "Large hub"
}

export interface EnplanementData {
  cy2019: number;
  cy2024: number;
  /** 5-year CAGR = (cy2024/cy2019)^(1/5) - 1, per ticket #3's COVID-safe methodology. */
  cagr5yr: number;
  methodology: string;
  source: string;
  confidence: Confidence;
}

export interface CapacityData {
  annualPassengerCapacity: number;
  perRunwayAnnualPassengers: number;
  methodology: string;
  source: string;
  confidence: Confidence;
}

export interface RouteMixData {
  longHaulSharePct: number;
  definition: string;
  distanceGroupCutoffMiles: number;
  methodology: string;
  source: string;
  confidence: Confidence;
}

export interface DelayData {
  pctFlightsDelayed15: number;
  year: number;
  metric: string;
  methodology: string;
  source: string;
  confidence: Confidence;
}

export interface AirportRecord {
  iata: string;
  icao: string;
  name: string;
  city: string;
  state: string;
  lat: number;
  lon: number;
  elevationFt: number;
  tier: "full" | "screening";
  ourAirportsType: string;
  runwayCount: number;
  runwayCountTotal: number;
  runwayCountSource: string;
  runwayCountConfidence: Confidence;
  faaHub: HubClassification;
  enplanements: EnplanementData;
  capacity: CapacityData;
  /** Precomputed by the data pipeline for human review; the scoring engine
   *  recomputes this independently from enplanements/capacity rather than
   *  trusting this field, so the formula has exactly one source of truth. */
  capacityUtilizationPct: number;
  routeMix: RouteMixData;
  delay: DelayData;
  notes: string[];
}

/**
 * The dataset has no pre-baked "region" field (only `state`) -- ticket #2's
 * "region tags" is implemented here as a lookup instead of a data column,
 * since it's simpler to keep one region taxonomy in code than to keep a
 * denormalized field in sync across two tiers of hand/script-built data.
 */
export const NEW_ENGLAND_STATES = ["ME", "NH", "VT", "MA", "RI", "CT"] as const;

export function regionOf(airport: Pick<AirportRecord, "state">): string {
  if ((NEW_ENGLAND_STATES as readonly string[]).includes(airport.state)) {
    return "New England";
  }
  return "Other";
}
