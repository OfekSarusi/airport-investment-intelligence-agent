import type { ReactNode } from "react";
import type { Confidence } from "../types";

/** A label paired with its confidence badge -- e.g. "Capacity [sourced]". */
export function LabeledConfidence({
  label,
  confidence,
  className = "flex items-center gap-1",
}: {
  label: ReactNode;
  confidence: Confidence;
  className?: string;
}) {
  return (
    <span className={className}>
      {label} <ConfidenceBadge confidence={confidence} />
    </span>
  );
}

/** Always-visible confidence indicator -- never hidden behind a tooltip. */
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
