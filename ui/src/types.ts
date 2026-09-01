/**
 * Types mirroring the backend's API contract (server/index.ts, agent/,
 * tools/scoring.ts). Hand-written, not imported -- ui/ and the backend are
 * independently-buildable.
 */

export type Confidence = "sourced" | "estimated";

// ---------------------------------------------------------------------------
// /api/chat request/response envelope
// ---------------------------------------------------------------------------

export interface ChatRequest {
  sessionId?: string;
  message: string;
}

export interface ToolCall {
  name: ToolName;
  args: unknown;
  result: unknown;
  isError: boolean;
}

export interface ChatResponse {
  sessionId: string;
  reply: string;
  toolCalls: ToolCall[];
}

export interface HealthResponse {
  ok: boolean;
  geminiKeyConfigured: boolean;
}

export type ToolName =
  | "get_airport_details"
  | "compare_airports"
  | "screen_investment_candidates"
  | "calculate_long_haul_stats"
  | "get_unmet_demand_analysis";

// ---------------------------------------------------------------------------
// Shared scoring sub-shapes (tools/scoring.ts)
// ---------------------------------------------------------------------------

export interface CongestionIndexResult {
  score: number;
  utilizationComponent: number;
  delayComponent: number;
  utilizationPct: number;
  delayPct: number;
  weights: { utilization: number; delay: number };
}

export interface InvestmentScoreResult {
  score: number;
  utilizationComponent: number;
  congestionComponent: number;
  growthComponent: number;
  weights: { utilization: number; congestion: number; growth: number };
  congestion: CongestionIndexResult;
}

export interface LongHaulStats {
  longHaulSharePct: number;
  distanceGroupCutoffMiles: number;
  definition: string;
  confidence: Confidence;
}

export interface UnmetDemandResult {
  currentPax: number;
  capacity: number;
  utilizationPct: number;
  cagr5yr: number;
  projectedNextYearPax: number;
  unmetPax: number;
  isConstrained: boolean;
  isVolumeConstrained: boolean;
  isOperationallyStrained: boolean;
  capacityConfidence: Confidence;
  delayConfidence: Confidence;
  narrativeFacts: string[];
}

// ---------------------------------------------------------------------------
// Tool result shapes (agent/toolExecutors.ts)
// ---------------------------------------------------------------------------

export interface AirportDetails {
  iata: string;
  name: string;
  city: string;
  state: string;
  region: string;
  tier: "full" | "screening";
  runwayCount: number;
  enplanements: { cy2019: number; cy2024: number; cagr5yr: number; confidence: Confidence };
  capacity: { annualPassengerCapacity: number; perRunwayAnnualPassengers: number; confidence: Confidence };
  congestionIndex: CongestionIndexResult;
  investmentScore: InvestmentScoreResult;
  longHaul: LongHaulStats;
  unmetDemand: UnmetDemandResult;
  notes: string[];
}

export interface CompareAirportsResult {
  compared: AirportDetails[];
  missing: string[];
}

export interface ScreenCandidate {
  iata: string;
  name: string;
  state: string;
  region: string;
  investmentScore: number;
  components: { utilization: number; congestion: number; growth: number };
}

export interface ScreenInvestmentCandidatesResult {
  region: string;
  minScore: number | null;
  count: number;
  candidates: ScreenCandidate[];
  note?: string;
}

export interface CalculateLongHaulStatsResult extends LongHaulStats {
  iata: string;
  name: string;
}

export interface GetUnmetDemandAnalysisResult extends UnmetDemandResult {
  iata: string;
  name: string;
}

export interface ToolErrorResult {
  error: string;
  availableCodes?: string[];
  missing?: string[];
}

// ---------------------------------------------------------------------------
// Chat UI's own message model
// ---------------------------------------------------------------------------

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  toolCalls?: ToolCall[];
}
