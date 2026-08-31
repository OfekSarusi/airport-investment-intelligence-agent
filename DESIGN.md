# Design Document — Airport Investment Intelligence Agent

Deterministic code computes every number; the LLM only explains numbers it's handed — it never calculates or invents one. For setup/usage, see [README.md](./README.md).

```
data/airports.json → tools/scoring.ts (pure functions) → agent/toolExecutors.ts
                                                                 ↓
ui/ (chat + KPI cards)  ←  server/index.ts  ←  agent/geminiAgent.ts  ↔  Gemini API
```

`agent/tools.ts` (schemas only, no logic) is the *only* thing sent to Gemini. Full derivations and edge cases for every formula below are documented as comments in `tools/scoring.ts` — this doc gives the summary, not a duplicate.

## Scoring methodology

- **Capacity utilization** = CY2024 enplanements ÷ estimated capacity. Capacity itself isn't publicly published, so it's estimated uniformly as `runwayCount × 10M/yr` (derived from an FAA runway-throughput benchmark; documented as `confidence: "estimated"`, and it visibly breaks down for a few airports — e.g. ATL exceeds 100%, since one constant can't capture every runway/aircraft mix).
- **5-year growth (CAGR)** compares CY2019 → CY2024 only, deliberately skipping 2020–2023 so the COVID collapse/recovery never enters the number.
- **Long-haul %** — real BTS route data (T-100) isn't bulk-downloadable without a login (see `research/aviation-data-sources.md`), so this uses a destination-count proxy instead (share of nonstop destinations ≥2,000mi). Labeled `estimated`; can differ from an official BTS figure.
- **Delay rate** — anchored to the real CY2024 national baseline (20.3%), with a few airports (SFO, ATL, DFW) carrying a directly-cited figure instead.
- **Congestion Index** (0–100) = 60% utilization + 40% delay. Also a standalone KPI (`compare_airports` returns it directly for test case 2).
- **Investment Opportunity Score** (0–100) = 35% utilization + 35% Congestion Index + 30% growth. **Note**: since Congestion Index already contains utilization at 60%, the *effective* weights are 56% utilization / 14% delay / 30% growth, not the headline 35/35/30 — intentional, since utilization is the most direct capacity/demand-mismatch signal, but worth stating plainly rather than letting the headline numbers mislead.
- **Unmet demand** flags an airport via *either* a raw volume projection exceeding capacity, *or* an `isOperationallyStrained` check (elevated utilization + delay meaningfully above baseline) — added after a volume-only check said SFO was "not constrained" despite its well-documented congestion, since SFO's growth is currently flat. Checked against the full dataset: only SFO/JFK/EWR trigger it, so it isn't tuned to one test case.

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
- The system prompt explicitly forbids computing/estimating any number, and requires disclosing when a returned figure is `"estimated"` rather than `"sourced"` — enforced structurally (every KPI carries that field) and enforced by instruction (the model must say so).
- Multi-turn context uses Gemini's Interactions API (`previous_interaction_id`, server-side history) — verified live with a same-session follow-up that correctly resolved "that" to the previous airport without re-naming it.
- The `sourced`/`estimated` confidence system surfaces in the UI as a visible badge next to the number it applies to (never a hidden tooltip) — the practical, product-level version of "communicate uncertainty," not just a claim in this document.

## Known limitations

Real BTS-sourced long-haul/delay data (tracked in [#13](https://github.com/OfekSarusi/airport-investment-intelligence-agent/issues/13)), a live status overlay for an ongoing (not point-in-time) tool, and multi-instance session persistence are all natural next steps, deliberately out of scope here.
