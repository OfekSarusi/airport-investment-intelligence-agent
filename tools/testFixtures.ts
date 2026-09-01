import { AirportRecord } from "./types";

/** Builds a minimal, valid AirportRecord with sensible defaults, overridable per test. */
export function makeAirport(overrides: Partial<AirportRecord> = {}): AirportRecord {
  return {
    iata: "TST",
    icao: "KTST",
    name: "Test Airport",
    city: "Testville",
    state: "CA",
    lat: 0,
    lon: 0,
    elevationFt: 0,
    tier: "full",
    ourAirportsType: "large_airport",
    runwayCount: 2,
    runwayCountTotal: 2,
    runwayCountSource: "test",
    runwayCountConfidence: "sourced",
    faaHub: { code: "M", label: "Medium hub" },
    enplanements: {
      cy2019: 10_000_000,
      cy2024: 10_000_000,
      cagr5yr: 0,
      methodology: "test",
      source: "test",
      confidence: "sourced",
    },
    capacity: {
      annualPassengerCapacity: 20_000_000,
      perRunwayAnnualPassengers: 10_000_000,
      methodology: "test",
      source: "test",
      confidence: "estimated",
    },
    capacityUtilizationPct: 50,
    routeMix: {
      longHaulSharePct: 10,
      definition: "test",
      distanceGroupCutoffMiles: 2000,
      methodology: "test",
      source: "test",
      confidence: "estimated",
    },
    delay: {
      pctFlightsDelayed15: 20,
      year: 2024,
      metric: "test",
      methodology: "test",
      source: "test",
      confidence: "estimated",
    },
    notes: [],
    ...overrides,
  };
}
