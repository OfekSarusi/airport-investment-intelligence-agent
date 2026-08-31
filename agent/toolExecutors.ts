/** Executes the 5 tools by calling into tools/scoring.ts -- Gemini never computes a number itself. */

import airportsData from "../data/airports.json";
import {
  AirportRecord,
  congestionIndex,
  investmentOpportunityScore,
  longHaulStats,
  rankAirports,
  regionOf,
  unmetDemandAnalysis,
} from "../tools/scoring";

const airports = airportsData as unknown as AirportRecord[];

export interface ToolExecutionResult {
  isError: boolean;
  result: unknown;
}

function findAirport(iataCode: string): AirportRecord | undefined {
  const code = iataCode?.trim().toUpperCase();
  return airports.find((a) => a.iata === code);
}

function notFound(iataCode: string): ToolExecutionResult {
  return {
    isError: true,
    result: {
      error: `No data for IATA code '${iataCode}'.`,
      availableCodes: airports.map((a) => a.iata).sort(),
    },
  };
}

/** Bundles every computed metric for one airport into a single flat payload. */
function fullAirportView(airport: AirportRecord) {
  return {
    iata: airport.iata,
    name: airport.name,
    city: airport.city,
    state: airport.state,
    region: regionOf(airport),
    tier: airport.tier,
    runwayCount: airport.runwayCount,
    enplanements: airport.enplanements,
    capacity: airport.capacity,
    congestionIndex: congestionIndex(airport),
    investmentScore: investmentOpportunityScore(airport),
    longHaul: longHaulStats(airport),
    unmetDemand: unmetDemandAnalysis(airport),
    notes: airport.notes,
  };
}

function getAirportDetails(args: { iata_code: string }): ToolExecutionResult {
  const airport = findAirport(args.iata_code);
  if (!airport) return notFound(args.iata_code);
  return { isError: false, result: fullAirportView(airport) };
}

function compareAirports(args: { iata_codes: string[] }): ToolExecutionResult {
  if (!Array.isArray(args.iata_codes) || args.iata_codes.length < 2) {
    return {
      isError: true,
      result: { error: "iata_codes must be an array of at least 2 IATA codes." },
    };
  }
  const results: unknown[] = [];
  const missing: string[] = [];
  for (const code of args.iata_codes) {
    const airport = findAirport(code);
    if (!airport) {
      missing.push(code);
      continue;
    }
    results.push(fullAirportView(airport));
  }
  if (results.length < 2) {
    return {
      isError: true,
      result: {
        error: "Fewer than 2 of the requested airports were found.",
        missing,
        availableCodes: airports.map((a) => a.iata).sort(),
      },
    };
  }
  return { isError: false, result: { compared: results, missing } };
}

function screenInvestmentCandidates(args: { region?: string; min_score?: number }): ToolExecutionResult {
  const ranked = rankAirports(airports, {
    region: args.region,
    minScore: args.min_score,
  });
  if (args.region && ranked.length === 0) {
    return {
      isError: false,
      result: {
        region: args.region,
        candidates: [],
        note: `No airports found for region '${args.region}'. Currently supported region: 'New England'.`,
      },
    };
  }
  return {
    isError: false,
    result: {
      region: args.region ?? "all",
      minScore: args.min_score ?? null,
      count: ranked.length,
      candidates: ranked.map(({ airport, investment }) => ({
        iata: airport.iata,
        name: airport.name,
        state: airport.state,
        region: regionOf(airport),
        investmentScore: investment.score,
        components: {
          utilization: investment.utilizationComponent,
          congestion: investment.congestionComponent,
          growth: investment.growthComponent,
        },
      })),
    },
  };
}

function calculateLongHaulStats(args: { iata_code: string }): ToolExecutionResult {
  const airport = findAirport(args.iata_code);
  if (!airport) return notFound(args.iata_code);
  return {
    isError: false,
    result: { iata: airport.iata, name: airport.name, ...longHaulStats(airport) },
  };
}

function getUnmetDemandAnalysis(args: { iata_code: string }): ToolExecutionResult {
  const airport = findAirport(args.iata_code);
  if (!airport) return notFound(args.iata_code);
  return {
    isError: false,
    result: { iata: airport.iata, name: airport.name, ...unmetDemandAnalysis(airport) },
  };
}

const executors: Record<string, (args: any) => ToolExecutionResult> = {
  get_airport_details: getAirportDetails,
  compare_airports: compareAirports,
  screen_investment_candidates: screenInvestmentCandidates,
  calculate_long_haul_stats: calculateLongHaulStats,
  get_unmet_demand_analysis: getUnmetDemandAnalysis,
};

export function executeTool(name: string, args: unknown): ToolExecutionResult {
  const executor = executors[name];
  if (!executor) {
    return { isError: true, result: { error: `Unknown tool '${name}'.` } };
  }
  try {
    return executor(args ?? {});
  } catch (err) {
    return {
      isError: true,
      result: { error: `Tool '${name}' threw an error: ${(err as Error).message}` },
    };
  }
}
