import type { CompareAirportsResult } from "../types";
import { AirportDetailsCard } from "./AirportDetailsCard";

export function CompareAirportsCard({ result }: { result: CompareAirportsResult }) {
  return (
    <div className="w-full">
      {/* Wraps to new rows instead of a fixed per-card width + horizontal
          scroll -- the previous layout cut cards off at the message
          container's edge with no visible scroll affordance (reported by
          the user on a 2-airport compare). minmax() lets each card size up
          to fill the row when there's room, without ever overflowing it. */}
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(20rem,100%),1fr))]">
        {result.compared.map((airport) => (
          <AirportDetailsCard key={airport.iata} airport={airport} compact />
        ))}
      </div>
      {result.missing.length > 0 ? (
        <p className="mt-2 text-xs text-rose-600">No data for: {result.missing.join(", ")}</p>
      ) : null}
    </div>
  );
}
