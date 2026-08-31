import type {
  AirportDetails,
  CalculateLongHaulStatsResult,
  CompareAirportsResult,
  GetUnmetDemandAnalysisResult,
  ScreenInvestmentCandidatesResult,
  ToolCall,
  ToolErrorResult,
} from "../types";
import { AirportDetailsCard } from "./AirportDetailsCard";
import { CompareAirportsCard } from "./CompareAirportsCard";
import { ErrorCard } from "./ErrorCard";
import { LongHaulCard } from "./LongHaulCard";
import { ScreenCandidatesTable } from "./ScreenCandidatesTable";
import { UnmetDemandCard } from "./UnmetDemandCard";

/** Maps a tool call's result to the KPI card that visualizes it. */
export function ToolResultCard({ call }: { call: ToolCall }) {
  if (call.isError) {
    return <ErrorCard error={call.result as ToolErrorResult} />;
  }

  switch (call.name) {
    case "get_airport_details":
      return <AirportDetailsCard airport={call.result as AirportDetails} />;
    case "compare_airports":
      return <CompareAirportsCard result={call.result as CompareAirportsResult} />;
    case "screen_investment_candidates":
      return <ScreenCandidatesTable result={call.result as ScreenInvestmentCandidatesResult} />;
    case "calculate_long_haul_stats":
      return <LongHaulCard result={call.result as CalculateLongHaulStatsResult} />;
    case "get_unmet_demand_analysis":
      return <UnmetDemandCard result={call.result as GetUnmetDemandAnalysisResult} />;
    default:
      return (
        <pre className="w-full overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
          {JSON.stringify(call.result, null, 2)}
        </pre>
      );
  }
}
