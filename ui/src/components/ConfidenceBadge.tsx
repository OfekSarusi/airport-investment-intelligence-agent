import type { Confidence } from "../types";

/**
 * Small, always-visible confidence indicator -- deliberately not a tooltip
 * (see ticket #9's spec: "don't hide this in a tooltip nobody will find").
 * "sourced" reads as a quiet, affirmative dot; "estimated" is a distinct
 * amber pill so it draws the eye exactly where a number is a heuristic
 * rather than an official statistic.
 */
export function ConfidenceBadge({ confidence }: { confidence: Confidence }) {
  if (confidence === "sourced") {
    return (
      <span
        title="Backed by a cited primary source"
        className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        sourced
      </span>
    );
  }

  return (
    <span
      title="Derived via a stated methodology/heuristic, not an official statistic"
      className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 ring-1 ring-amber-300"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
      estimated
    </span>
  );
}
