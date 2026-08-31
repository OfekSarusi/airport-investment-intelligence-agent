import type { AirportDetails } from "../types";
import { formatInt, formatSignedPct } from "../lib/format";
import { CardShell, StatTile } from "./CardShell";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { InvestmentCongestionBlock } from "./InvestmentCongestionBlock";
import { LongHaulBlock } from "./LongHaulBlock";
import { UnmetDemandBlock } from "./UnmetDemandBlock";

/** Full KPI breakdown for one airport -- backs get_airport_details, and is
 * reused (with compact=true) for each side of compare_airports. */
export function AirportDetailsCard({ airport, compact = false }: { airport: AirportDetails; compact?: boolean }) {
  return (
    <CardShell
      title={`${airport.name} (${airport.iata})`}
      subtitle={`${airport.city}, ${airport.state} - ${airport.region} - ${airport.tier} tier`}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatTile label="CY2024 enplanements" value={formatInt(airport.enplanements.cy2024)} />
          <StatTile
            label={
              <span className="flex items-center gap-1">
                Capacity <ConfidenceBadge confidence={airport.capacity.confidence} />
              </span>
            }
            value={formatInt(airport.capacity.annualPassengerCapacity)}
          />
          <StatTile label="Runways" value={airport.runwayCount} />
          <StatTile
            label={
              <span className="flex items-center gap-1">
                5yr CAGR <ConfidenceBadge confidence={airport.enplanements.confidence} />
              </span>
            }
            value={formatSignedPct(airport.enplanements.cagr5yr * 100)}
          />
        </div>

        <InvestmentCongestionBlock investmentScore={airport.investmentScore} congestionIndex={airport.congestionIndex} />

        <LongHaulBlock longHaul={airport.longHaul} />

        <UnmetDemandBlock unmet={airport.unmetDemand} compact={compact} />

        {!compact && airport.notes.length > 0 ? (
          <ul className="space-y-1 border-t border-slate-100 pt-2 text-xs text-slate-500">
            {airport.notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </CardShell>
  );
}
