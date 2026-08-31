import type { ToolCall } from "../types";

/** Renders "tool_name(key, args)" so the chip's own label carries the call's identity. */
function describeArgs(call: ToolCall): string {
  const args = (call.args ?? {}) as Record<string, unknown>;
  switch (call.name) {
    case "get_airport_details":
    case "calculate_long_haul_stats":
    case "get_unmet_demand_analysis":
      return String(args.iata_code ?? "?");
    case "compare_airports": {
      const codes = Array.isArray(args.iata_codes) ? (args.iata_codes as unknown[]) : [];
      return codes.join(", ") || "?";
    }
    case "screen_investment_candidates": {
      const parts: string[] = [];
      if (args.region) parts.push(String(args.region));
      if (args.min_score != null) parts.push(`min score ${args.min_score}`);
      return parts.length > 0 ? parts.join(", ") : "all airports";
    }
    default:
      return JSON.stringify(args);
  }
}

export function ToolCallChip({ call }: { call: ToolCall }) {
  return (
    <span
      title={JSON.stringify(call.args)}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-xs ${
        call.isError
          ? "border-rose-300 bg-rose-50 text-rose-700"
          : "border-brand-200 bg-brand-50 text-brand-800"
      }`}
    >
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3 shrink-0 opacity-70">
        <path d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z" />
      </svg>
      <span className="font-semibold">{call.name}</span>
      <span className="opacity-70">({describeArgs(call)})</span>
      {call.isError ? <span className="font-semibold">error</span> : null}
    </span>
  );
}
