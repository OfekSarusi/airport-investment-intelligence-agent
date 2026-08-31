import type { ReactNode } from "react";

export function CardShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="w-full rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        {subtitle ? <span className="text-xs text-slate-400">{subtitle}</span> : null}
      </div>
      {children}
    </div>
  );
}

/** Grid of StatTiles -- `compact` (used inside compare_airports, where each
 *  side already has half the width) forces a single column instead of the
 *  normal 4-wide layout. */
export function StatTileGrid({ compact = false, children }: { compact?: boolean; children: ReactNode }) {
  return <div className={`grid grid-cols-2 gap-2 ${compact ? "" : "sm:grid-cols-4"}`}>{children}</div>;
}

export function StatTile({
  label,
  value,
  accent,
}: {
  label: ReactNode;
  value: ReactNode;
  accent?: "rose" | "emerald" | "slate";
}) {
  const valueColor =
    accent === "rose" ? "text-rose-600" : accent === "emerald" ? "text-emerald-600" : "text-slate-900";
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`text-sm font-semibold tabular-nums ${valueColor}`}>{value}</p>
    </div>
  );
}
