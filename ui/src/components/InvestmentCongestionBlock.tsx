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
    // `compact` forces one column -- sm:grid-cols-2 reacts to viewport width, not this card's actual width.
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
