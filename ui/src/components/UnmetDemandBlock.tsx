import type { UnmetDemandResult } from "../types";
import { formatInt, formatPct } from "../lib/format";
import { StatTile, StatTileGrid } from "./CardShell";
import { LabeledConfidence } from "./ConfidenceBadge";

function ConstrainedPill({ constrained }: { constrained: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold ${
        constrained ? "bg-rose-100 text-rose-700 ring-1 ring-rose-300" : "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-300"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${constrained ? "bg-rose-500" : "bg-emerald-500"}`} />
      {constrained ? "Constrained" : "Not constrained"}
    </span>
  );
}

export function UnmetDemandBlock({ unmet, compact = false }: { unmet: UnmetDemandResult; compact?: boolean }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-slate-700">Unmet demand</span>
        <ConstrainedPill constrained={unmet.isConstrained} />
      </div>
      <StatTileGrid compact={compact}>
        <StatTile label="Utilization" value={formatPct(unmet.utilizationPct)} />
        <StatTile label="Current pax" value={formatInt(unmet.currentPax)} />
        <StatTile label="Projected next yr" value={formatInt(unmet.projectedNextYearPax)} />
        <StatTile
          label="Unmet pax"
          value={formatInt(unmet.unmetPax)}
          accent={unmet.unmetPax > 0 ? "rose" : "emerald"}
        />
      </StatTileGrid>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
        <span>
          Volume-constrained: <strong className="text-slate-700">{unmet.isVolumeConstrained ? "yes" : "no"}</strong>
        </span>
        <span>
          Operationally strained: <strong className="text-slate-700">{unmet.isOperationallyStrained ? "yes" : "no"}</strong>
        </span>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
        <LabeledConfidence
          label="Capacity figure:"
          confidence={unmet.capacityConfidence}
          className="inline-flex items-center gap-1.5"
        />
        <LabeledConfidence
          label="Delay figure:"
          confidence={unmet.delayConfidence}
          className="inline-flex items-center gap-1.5"
        />
      </div>
    </div>
  );
}
