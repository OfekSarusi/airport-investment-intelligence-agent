import type { GetUnmetDemandAnalysisResult } from "../types";
import { CardShell } from "./CardShell";
import { UnmetDemandBlock } from "./UnmetDemandBlock";

export function UnmetDemandCard({ result }: { result: GetUnmetDemandAnalysisResult }) {
  return (
    <CardShell title={`${result.name} (${result.iata})`} subtitle="Unmet demand analysis">
      <UnmetDemandBlock unmet={result} />
    </CardShell>
  );
}
