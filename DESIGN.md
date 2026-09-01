# Design Document — Airport Investment Intelligence Agent

Deterministic code computes every number; the LLM only explains numbers it's handed — it never calculates or invents one.

*(Setup/usage: [README.md](./README.md))*

```
data/airports.json → tools/scoring.ts (pure functions) → agent/toolExecutors.ts
                                                                 ↓
ui/ (chat + KPI cards)  ←  server/index.ts  ←  agent/geminiAgent.ts  ↔  Gemini API
```

## Scoring methodology

*(Full derivations and edge cases for every formula below: comments in `tools/scoring.ts`.)*

- **Capacity utilization** = CY2024 enplanements ÷ estimated capacity, where capacity = `runwayCount × 10M/yr` (an FAA runway-throughput benchmark, marked `confidence: "estimated"`). Real capacity isn't publicly published, so this is a uniform proxy — it visibly breaks down for a few airports (e.g. ATL exceeds 100%, since one constant can't capture every runway/aircraft mix).
- **5-year growth (CAGR)** compares CY2019 → CY2024 only, deliberately skipping 2020–2023 so the COVID collapse/recovery never enters the number.
- **Long-haul %** = share of nonstop destinations ≥2,000mi (a destination-count proxy, labeled `estimated`). Real BTS route data (T-100) isn't bulk-downloadable without a login (see `research/aviation-data-sources.md`), so this can differ from an official BTS figure.
- **Delay rate** — anchored to the real CY2024 national baseline (20.3%), with a few airports (SFO, ATL, DFW) carrying a directly-cited figure instead.
- **Congestion Index** (0–100) = 60% utilization + 40% delay. Also a standalone KPI (`compare_airports` returns it directly for test case 2).
- **Investment Opportunity Score** (0–100) = 35% utilization + 35% Congestion Index + 30% growth. Since Congestion Index already contains utilization at 60%, the *effective* weights are 56% utilization / 14% delay / 30% growth — not the headline 35/35/30. That's intentional: utilization is the most direct capacity/demand-mismatch signal, but worth stating plainly rather than letting the headline numbers mislead.
- **Unmet demand** flags an airport via *either* a raw volume projection exceeding capacity, *or* an `isOperationallyStrained` check (elevated utilization + delay meaningfully above baseline). Added after a volume-only check said SFO was "not constrained" despite its well-documented congestion, since SFO's growth is currently flat. Checked against the full dataset — only SFO/JFK/EWR trigger it.

## Key tradeoffs

| Decision | Choice | Why |
|---|---|---|
| LLM / model | Gemini, `gemini-3.5-flash-lite` | Free-tier requirement; the newer `gemini-3.7-flash` hit a rate limit after one call in live testing |
| Live vs. static data | Fully static/historical | Suggested live FAA endpoint doesn't resolve; all 4 test cases answer correctly without it |
| MCP | Not implemented | One consumer (this app's own UI) — no cross-app tool-sharing need. Tools are already schema-shaped so a future MCP wrapper would be a thin adapter, not a rewrite |
| Docker | One container (backend + built UI) | Simplest for a unified Node/TS stack |
| Backend runtime | `ts-node`, even in Docker | Skips a compile step / dist-path juggling; costs cold-start speed, not correctness |
| Session state | In-memory (server) + localStorage (browser) | Fine for a demo; would need real persistence for multi-instance production |
| Data scope | 16 hand-curated + 22 script-built airports | Covers every test case + a real ranking pool, without a full national dataset in one day |
| Voice input | Deferred, best-effort only | Explicitly a bonus in the assignment |

## Where/how AI is used

- Gemini only sees tool **schemas** (`agent/tools.ts`); the actual logic (`agent/toolExecutors.ts`) runs on this server and Gemini never touches it.
- The system prompt explicitly forbids computing/estimating any number.
- Every KPI carries a `sourced`/`estimated` confidence field — enforced two ways: structurally (the UI renders it as a visible badge next to the number, never a hidden tooltip) and by instruction (the system prompt requires the model to disclose it in text too).
- Multi-turn context uses Gemini's Interactions API (`previous_interaction_id`, server-side history) — verified live with a same-session follow-up that correctly resolved "that" to the previous airport without re-naming it.

## Known limitations

- Real BTS-sourced long-haul/delay data — tracked in [#13](https://github.com/OfekSarusi/airport-investment-intelligence-agent/issues/13).
- A live status overlay for an ongoing (not point-in-time) tool.
