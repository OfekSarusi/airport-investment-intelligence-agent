/**
 * Gemini tool (function) declarations for the 5 assignment-required tools.
 *
 * Verified against the installed @google/genai SDK's type definitions
 * (node_modules/@google/genai/dist/genai.d.ts, v2.19.0) rather than guessed
 * from memory: the Interactions API's `tools` array takes `FunctionT`
 * objects shaped exactly like this (`type: "function"`, `name`,
 * `description`, `parameters` as a JSON Schema object) -- confirmed via
 * ai.google.dev/gemini-api/docs/function-calling and cross-checked directly
 * against the SDK's shipped .d.ts.
 *
 * These declarations carry no logic -- see toolExecutors.ts for what
 * actually runs. Keeping schema and implementation in separate files lets
 * either change without touching the other.
 */

export interface FunctionToolDeclaration {
  type: "function";
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export const toolDeclarations: FunctionToolDeclaration[] = [
  {
    type: "function",
    name: "get_airport_details",
    description:
      "Get full details for one US airport: passenger volume, runway count, estimated capacity, capacity utilization, Congestion Index, Investment Opportunity Score, long-haul route mix, delay rate, and unmet-demand analysis. Use this whenever the user asks about a single named airport.",
    parameters: {
      type: "object",
      properties: {
        iata_code: {
          type: "string",
          description: "3-letter IATA airport code, e.g. 'SFO', 'LAX', 'ANC'.",
        },
      },
      required: ["iata_code"],
    },
  },
  {
    type: "function",
    name: "compare_airports",
    description:
      "Compare 2 or more US airports side by side on capacity utilization, Congestion Index, Investment Opportunity Score, and delay rate. Use this for any question comparing two or more named airports (e.g. congestion, investment potential).",
    parameters: {
      type: "object",
      properties: {
        iata_codes: {
          type: "array",
          items: { type: "string" },
          description: "3-letter IATA codes of the airports to compare, e.g. ['LAX', 'SNA'].",
        },
      },
      required: ["iata_codes"],
    },
  },
  {
    type: "function",
    name: "screen_investment_candidates",
    description:
      "Rank airports by Investment Opportunity Score, optionally filtered by region and/or a minimum score. Use this for questions asking 'which airports' are strong candidates, optionally within a region (e.g. 'New England').",
    parameters: {
      type: "object",
      properties: {
        region: {
          type: "string",
          description:
            "Optional region filter. Currently supported: 'New England' (ME, NH, VT, MA, RI, CT). Omit to screen the whole dataset.",
        },
        min_score: {
          type: "number",
          description: "Optional minimum Investment Opportunity Score (0-100) to include.",
        },
      },
      required: [],
    },
  },
  {
    type: "function",
    name: "calculate_long_haul_stats",
    description:
      "Get the long-haul route-share statistics for one airport (percentage of nonstop destinations >=2000 miles, and the exact distance cutoff/definition used). Use this for questions about long-haul flight percentage or route mix.",
    parameters: {
      type: "object",
      properties: {
        iata_code: {
          type: "string",
          description: "3-letter IATA airport code, e.g. 'ANC'.",
        },
      },
      required: ["iata_code"],
    },
  },
  {
    type: "function",
    name: "get_unmet_demand_analysis",
    description:
      "Get a structured unmet-demand analysis for one airport: current vs. projected passenger volume against estimated capacity, plus an operational-strain signal (elevated utilization + above-baseline delay) that can flag unmet demand even when raw volume hasn't crossed the capacity ceiling. Use this for 'unmet demand' or 'why is X congested' questions.",
    parameters: {
      type: "object",
      properties: {
        iata_code: {
          type: "string",
          description: "3-letter IATA airport code, e.g. 'SFO'.",
        },
      },
      required: ["iata_code"],
    },
  },
];
