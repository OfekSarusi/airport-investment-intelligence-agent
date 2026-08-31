import type { CompareAirportsResult } from "../types";
import { AirportDetailsCard } from "./AirportDetailsCard";

export function CompareAirportsCard({ result }: { result: CompareAirportsResult }) {
  return (
    <div className="w-full">
      {/* Wraps to a new row instead of overflowing -- minmax() sizes each card up to fill available space. */}
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
