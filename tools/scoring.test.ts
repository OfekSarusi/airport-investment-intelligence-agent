import { describe, expect, it } from "vitest";
import { congestionIndex, investmentOpportunityScore, rankAirports, unmetDemandAnalysis } from "./scoring";
import { makeAirport } from "./testFixtures";

describe("congestionIndex", () => {
  it("blends utilization and delay using the documented 60/40 weights", () => {
    const airport = makeAirport({
      enplanements: { ...makeAirport().enplanements, cy2024: 10_000_000 },
      capacity: { ...makeAirport().capacity, annualPassengerCapacity: 10_000_000 }, // 100% -> score 100
      delay: { ...makeAirport().delay, pctFlightsDelayed15: 20 }, // 20/40 saturation -> score 50
    });
    const result = congestionIndex(airport);
    expect(result.score).toBeCloseTo(100 * 0.6 + 50 * 0.4, 5); // 80
  });
});

describe("investmentOpportunityScore", () => {
  it("has effective weights of 56/14/30 for utilization/delay/growth, not the headline 35/35/30", () => {
    // Isolate each input to see its real weight in the blended score.
    const utilizationOnly = makeAirport({
      enplanements: { ...makeAirport().enplanements, cy2024: 10_000_000, cagr5yr: -0.05 },
      capacity: { ...makeAirport().capacity, annualPassengerCapacity: 10_000_000 },
      delay: { ...makeAirport().delay, pctFlightsDelayed15: 0 },
    });
    expect(investmentOpportunityScore(utilizationOnly).score).toBeCloseTo(56, 5);

    const delayOnly = makeAirport({
      enplanements: { ...makeAirport().enplanements, cy2024: 0, cagr5yr: -0.05 },
      capacity: { ...makeAirport().capacity, annualPassengerCapacity: 10_000_000 },
      delay: { ...makeAirport().delay, pctFlightsDelayed15: 40 },
    });
    expect(investmentOpportunityScore(delayOnly).score).toBeCloseTo(14, 5);

    const growthOnly = makeAirport({
      enplanements: { ...makeAirport().enplanements, cy2024: 0, cagr5yr: 0.05 },
      capacity: { ...makeAirport().capacity, annualPassengerCapacity: 10_000_000 },
      delay: { ...makeAirport().delay, pctFlightsDelayed15: 0 },
    });
    expect(investmentOpportunityScore(growthOnly).score).toBeCloseTo(30, 5);
  });
});

describe("unmetDemandAnalysis", () => {
  it("flags isVolumeConstrained when projected demand exceeds capacity", () => {
    const airport = makeAirport({
      enplanements: { ...makeAirport().enplanements, cy2024: 9_800_000, cagr5yr: 0.05 },
      capacity: { ...makeAirport().capacity, annualPassengerCapacity: 10_000_000 },
    });
    expect(unmetDemandAnalysis(airport).isVolumeConstrained).toBe(true);
  });

  it("flags isOperationallyStrained from elevated utilization + delay alone, even with declining volume", () => {
    const airport = makeAirport({
      enplanements: { ...makeAirport().enplanements, cy2024: 6_000_000, cagr5yr: -0.02 },
      capacity: { ...makeAirport().capacity, annualPassengerCapacity: 10_000_000 }, // 60% utilization
      delay: { ...makeAirport().delay, pctFlightsDelayed15: 35 }, // above baseline + margin
    });
    const result = unmetDemandAnalysis(airport);
    expect(result.isVolumeConstrained).toBe(false);
    expect(result.isOperationallyStrained).toBe(true);
    expect(result.isConstrained).toBe(true);
  });
});

describe("rankAirports", () => {
  it("filters by region (New England = ME/NH/VT/MA/RI/CT)", () => {
    const airports = [
      makeAirport({ iata: "AAA", state: "MA" }),
      makeAirport({ iata: "BBB", state: "CA" }),
      makeAirport({ iata: "CCC", state: "ME" }),
    ];
    const ranked = rankAirports(airports, { region: "New England" });
    expect(ranked.map((r) => r.airport.iata).sort()).toEqual(["AAA", "CCC"]);
  });
});
