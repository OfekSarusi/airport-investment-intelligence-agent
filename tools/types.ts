/** Shape of a record in data/airports.json. */

export type Confidence = "sourced" | "estimated";

export interface HubClassification {
  code: string; // FAA hub code, e.g. "L", "M"
  label: string; // e.g. "Large hub"
}

export interface EnplanementData {
  cy2019: number;
  cy2024: number;
  /** 5-year CAGR = (cy2024/cy2019)^(1/5) - 1, skips 2020-2023 (COVID) by construction. */
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
  /** For human review only -- tools/scoring.ts recomputes this itself. */
  capacityUtilizationPct: number;
  routeMix: RouteMixData;
  delay: DelayData;
  notes: string[];
}

/** No "region" field in the data (only `state`) -- regions are a code-side lookup. */
export const NEW_ENGLAND_STATES = ["ME", "NH", "VT", "MA", "RI", "CT"] as const;
const NEW_ENGLAND_REGION_NAME = "New England";

/** Every region name `regionOf` can return besides the "Other" fallback --
 *  the single place to look when adding a region, instead of hunting through
 *  tool descriptions and error strings for hardcoded region names. */
export const SUPPORTED_REGIONS = [NEW_ENGLAND_REGION_NAME] as const;

export function regionOf(airport: Pick<AirportRecord, "state">): string {
  if ((NEW_ENGLAND_STATES as readonly string[]).includes(airport.state)) {
    return NEW_ENGLAND_REGION_NAME;
  }
  return "Other";
}
