import type { ToolCall } from "../types";

// get_airport_details returns everything these two also return, for the
// same airport, so a card for either one is a pure visual duplicate of a
// get_airport_details card already shown for that airport.
const SUBSUMED_BY_AIRPORT_DETAILS = new Set(["get_unmet_demand_analysis", "calculate_long_haul_stats"]);

function primaryIata(call: ToolCall): string | undefined {
  const args = call.args as Record<string, unknown> | null | undefined;
  const code = args?.iata_code;
  return typeof code === "string" ? code.toUpperCase() : undefined;
}

/**
 * Decides whether to render a KPI card for this tool call. Never affects
 * what Gemini saw or answered with -- that already happened on the backend
 * with the full, real tool result. This only prevents showing the same
 * numbers twice when two calls in one turn cover the same airport with
 * overlapping data (e.g. get_airport_details(SFO) followed by
 * get_unmet_demand_analysis(SFO), which the model can still call if it
 * wants to -- we just don't duplicate the card for it).
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
