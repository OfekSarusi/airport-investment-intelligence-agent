/** A 0-100 score as a labeled horizontal bar. */

import { clampPct } from "../lib/format";

function barColor(score: number): string {
  if (score >= 70) return "bg-rose-500";
  if (score >= 40) return "bg-amber-500";
  return "bg-brand-500";
}

export function ScoreGauge({
  label,
  score,
  sublabel,
}: {
  label?: string;
  score: number;
  sublabel?: string;
}) {
  const pct = clampPct(score);
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        {label ? <span className="text-sm font-medium text-slate-700">{label}</span> : <span />}
        <span className="text-sm font-semibold tabular-nums text-slate-900">{score.toFixed(1)}</span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full ${barColor(pct)} transition-[width]`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {sublabel ? <p className="mt-1 text-xs text-slate-500">{sublabel}</p> : null}
    </div>
  );
}

/** A thinner sub-bar for component breakdowns nested under a ScoreGauge. */
export function ComponentBar({ label, value }: { label: string; value: number }) {
  const pct = clampPct(value);
  return (
    <div>
      <div className="mb-0.5 flex items-baseline justify-between">
        <span className="text-xs text-slate-500">{label}</span>
        <span className="text-xs font-medium tabular-nums text-slate-600">{value.toFixed(1)}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-brand-300" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
