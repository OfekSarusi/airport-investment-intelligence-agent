import type { CongestionIndexResult, InvestmentScoreResult } from "../types";
import { ComponentBar, ScoreGauge } from "./ScoreGauge";

export function InvestmentCongestionBlock({
  investmentScore,
  congestionIndex,
  compact = false,
}: {
  investmentScore: InvestmentScoreResult;
  congestionIndex: CongestionIndexResult;
  compact?: boolean;
}) {
  return (
    // Viewport-based sm:grid-cols-2 doesn't know how narrow THIS card is when
    // several are shown side by side (compare_airports) -- it triggered on
    // a wide screen even when each card only had ~320px, cutting off the
    // Congestion Index column. `compact` forces a single column instead.
    <div className={`grid grid-cols-1 gap-4 ${compact ? "" : "sm:grid-cols-2"}`}>
      <div className="space-y-2">
        <ScoreGauge label="Investment Opportunity Score" score={investmentScore.score} />
        <div className="space-y-1.5 pl-1">
          <ComponentBar label="Utilization" value={investmentScore.utilizationComponent} />
          <ComponentBar label="Congestion" value={investmentScore.congestionComponent} />
          <ComponentBar label="Growth" value={investmentScore.growthComponent} />
        </div>
      </div>
      <div className="space-y-2">
        <ScoreGauge
          label="Congestion Index"
          score={congestionIndex.score}
          sublabel={`${congestionIndex.utilizationPct.toFixed(1)}% utilization, ${congestionIndex.delayPct}% flights delayed 15+min`}
        />
        <div className="space-y-1.5 pl-1">
          <ComponentBar label="Utilization component" value={congestionIndex.utilizationComponent} />
          <ComponentBar label="Delay component" value={congestionIndex.delayComponent} />
        </div>
      </div>
    </div>
  );
}
