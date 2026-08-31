import type { ToolErrorResult } from "../types";

export function ErrorCard({ error }: { error: ToolErrorResult }) {
  const codes = error.availableCodes ?? error.missing;
  return (
    <div className="w-full rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
      <p className="font-medium">{error.error}</p>
      {codes && codes.length > 0 ? (
        <p className="mt-1 text-xs text-rose-600">
          Available: {codes.slice(0, 20).join(", ")}
          {codes.length > 20 ? "…" : ""}
        </p>
      ) : null}
    </div>
  );
}
