import type { ToolCall } from "../types";

// get_airport_details already returns everything these two return, so their
// cards would just duplicate a get_airport_details card for the same airport.
const SUBSUMED_BY_AIRPORT_DETAILS = new Set(["get_unmet_demand_analysis", "calculate_long_haul_stats"]);

function primaryIata(call: ToolCall): string | undefined {
  const args = call.args as Record<string, unknown> | null | undefined;
  const code = args?.iata_code;
  return typeof code === "string" ? code.toUpperCase() : undefined;
}

/**
 * Decides whether to render a KPI card for this tool call. Display-only --
 * doesn't affect what Gemini saw or answered with. Just avoids showing the
 * same airport's numbers twice in one turn.
 */
export function shouldRenderCard(call: ToolCall, allCalls: ToolCall[], index: number): boolean {
  const iata = primaryIata(call);
  if (!iata) return true;

  // Same tool, same airport, called more than once in this turn -- keep only the first.
  const firstSameCall = allCalls.findIndex((c) => c.name === call.name && primaryIata(c) === iata);
  if (firstSameCall !== index) return false;

  if (SUBSUMED_BY_AIRPORT_DETAILS.has(call.name)) {
    const alreadyCoveredByFullDetails = allCalls.some(
      (c) => c.name === "get_airport_details" && primaryIata(c) === iata,
    );
    if (alreadyCoveredByFullDetails) return false;
  }

  return true;
}
