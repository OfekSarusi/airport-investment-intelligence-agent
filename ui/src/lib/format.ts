export function formatInt(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

export function formatPct(n: number, digits = 1): string {
  return `${n.toFixed(digits)}%`;
}

export function formatSignedPct(n: number, digits = 1): string {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(digits)}%`;
}

/** Clamps a score/share to a valid 0-100 bar width. */
export function clampPct(n: number): number {
  return Math.max(0, Math.min(100, n));
}

/** The `"Name (IATA)"` title used by every airport-scoped KPI card. */
export function formatAirportTitle(name: string, iata: string): string {
  return `${name} (${iata})`;
}
