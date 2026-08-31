import type { ScreenInvestmentCandidatesResult } from "../types";
import { CardShell } from "./CardShell";
import { ScoreGauge } from "./ScoreGauge";

export function ScreenCandidatesTable({ result }: { result: ScreenInvestmentCandidatesResult }) {
  return (
    <CardShell
      title="Investment Candidate Screen"
      subtitle={`${result.region}${result.minScore != null ? `, min score ${result.minScore}` : ""} - ${result.count} match${result.count === 1 ? "" : "es"}`}
    >
      {result.candidates.length === 0 ? (
        <p className="text-sm text-slate-500">{result.note ?? "No candidates matched this screen."}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[32rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="py-1.5 pr-3 font-medium">#</th>
                <th className="py-1.5 pr-3 font-medium">Airport</th>
                <th className="py-1.5 pr-3 font-medium">State</th>
                <th className="py-1.5 pr-3 font-medium">Region</th>
                <th className="py-1.5 pr-3 font-medium">Investment score</th>
              </tr>
            </thead>
            <tbody>
              {result.candidates.map((c, i) => (
                <tr key={c.iata} className="border-b border-slate-100 last:border-0">
                  <td className="py-2 pr-3 tabular-nums text-slate-400">{i + 1}</td>
                  <td className="py-2 pr-3">
                    <span className="font-medium text-slate-800">{c.name}</span>{" "}
                    <span className="text-xs text-slate-400">({c.iata})</span>
                  </td>
                  <td className="py-2 pr-3 text-slate-600">{c.state}</td>
                  <td className="py-2 pr-3 text-slate-600">{c.region}</td>
                  <td className="py-2 pr-3 min-w-[10rem]">
                    <ScoreGauge label="" score={c.investmentScore} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </CardShell>
  );
}
