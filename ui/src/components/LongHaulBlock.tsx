import type { LongHaulStats } from "../types";
import { clampPct } from "../lib/format";
import { ConfidenceBadge } from "./ConfidenceBadge";

export function LongHaulBlock({ longHaul }: { longHaul: LongHaulStats }) {
  const pct = clampPct(longHaul.longHaulSharePct);
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-sm font-medium text-slate-700">
          Long-haul share (&ge;{longHaul.distanceGroupCutoffMiles.toLocaleString()} mi)
        </span>
        <span className="flex items-center gap-2">
          <span className="text-sm font-semibold tabular-nums text-slate-900">
            {longHaul.longHaulSharePct.toFixed(1)}%
          </span>
          <ConfidenceBadge confidence={longHaul.confidence} />
        </span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-brand-400" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 text-xs text-slate-500">{longHaul.definition}</p>
    </div>
  );
}
