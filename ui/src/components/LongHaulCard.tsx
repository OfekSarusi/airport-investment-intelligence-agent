import type { CalculateLongHaulStatsResult } from "../types";
import { formatAirportTitle } from "../lib/format";
import { CardShell } from "./CardShell";
import { LongHaulBlock } from "./LongHaulBlock";

export function LongHaulCard({ result }: { result: CalculateLongHaulStatsResult }) {
  return (
    <CardShell title={formatAirportTitle(result.name, result.iata)} subtitle="Long-haul route mix">
      <LongHaulBlock longHaul={result} />
    </CardShell>
  );
}
