import type { GetUnmetDemandAnalysisResult } from "../types";
import { formatAirportTitle } from "../lib/format";
import { CardShell } from "./CardShell";
import { UnmetDemandBlock } from "./UnmetDemandBlock";

export function UnmetDemandCard({ result }: { result: GetUnmetDemandAnalysisResult }) {
  return (
    <CardShell title={formatAirportTitle(result.name, result.iata)} subtitle="Unmet demand analysis">
      <UnmetDemandBlock unmet={result} />
    </CardShell>
  );
}
