import type { CompareAirportsResult } from "../types";
import { AirportDetailsCard } from "./AirportDetailsCard";

export function CompareAirportsCard({ result }: { result: CompareAirportsResult }) {
  return (
    <div className="w-full">
      <div className="flex gap-4 overflow-x-auto pb-1">
        {result.compared.map((airport) => (
          <div key={airport.iata} className="w-[22rem] shrink-0">
            <AirportDetailsCard airport={airport} compact />
          </div>
        ))}
      </div>
      {result.missing.length > 0 ? (
        <p className="mt-2 text-xs text-rose-600">No data for: {result.missing.join(", ")}</p>
      ) : null}
    </div>
  );
}
