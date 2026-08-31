# Airport Investment Intelligence Agent

## Overview

Airport Investment Intelligence Agent is a chat-based analytics tool for identifying US airports where terminal expansion or renovation is likely to be most profitable. It combines a deterministic scoring engine (capacity utilization, congestion, growth, unmet demand) with a Gemini-powered chat assistant that explains the results in plain language — the AI never computes or invents a number, it only narrates what the scoring engine already calculated.

The system includes:

**React Frontend**
A chat interface for querying airport investment data — message stream, tool-call badges showing which deterministic calculation ran, and visual KPI/score breakdown cards. Served together with the API.

**Express Backend**
A REST API that runs the Gemini agent loop: receives chat messages, calls Gemini with function-calling tools, executes those tools against the scoring engine, and returns the model's narrated answer.

**Deterministic Scoring Engine**
Pure TypeScript functions (no LLM, no I/O) that compute Congestion Index, Investment Opportunity Score, unmet-demand analysis, and long-haul route share from the airport dataset.

**Airport Dataset**
38 US airports with passenger volume, runway/capacity data, growth trends, and delay estimates — each field labeled `sourced` or `estimated` depending on data availability. See [DESIGN.md](./DESIGN.md).

**Gemini Agent**
A function-calling agent (`gemini-3.5-flash-lite`) exposing 5 tools that query the scoring engine.

## Key Features

- **Deterministic investment scoring** — Congestion Index and Investment Opportunity Score computed by pure functions, independent of the LLM
- **Unmet-demand analysis** — flags capacity strain from either raw passenger-volume growth or elevated delays, with a plain-language "why"
- **AI chat assistant** — natural-language questions and follow-ups, powered by Gemini function-calling
- **Confidence-labeled data** — every KPI is visibly marked `sourced` or `estimated` in the UI, never hidden
- **Fully Dockerized** — a single `docker compose up --build` brings up the entire app

## Getting Started

### Prerequisites

- Docker and Docker Compose

### Step 1 — Create the environment file

All configuration lives in a single `.env` file at the project root. Copy the example and fill in your key:

For Mac:
```bash
cp .env.example .env
```

For Windows:
```bash
copy .env.example .env
```

```
GEMINI_API_KEY=your_gemini_api_key_here   # required — get one free at Google AI Studio
PORT=3000
```

### Step 2 — Build and run

Make sure Docker Desktop is running, then:

```bash
docker compose up --build
```

`--build` rebuilds the image from source (needed on first run or after code changes). The first build takes a few minutes; after that, the app is ready:

| Service | URL |
|---|---|
| Chat UI + API | http://localhost:3000 |

### Stopping the app

```bash
docker compose down
```

## Notes

Docker is the only officially supported way to run the full app — one container serves both the API and the chat UI.

## Verifying the scoring engine

The deterministic scoring engine can be checked directly against the real dataset, without a Gemini key or the chat UI:

```bash
npm install
npm run score:smoke
```

This runs `tools/scoring.ts` against `data/airports.json` and prints results for all 4 assignment test cases. It's a lightweight verification script, not a full automated test suite — adding proper tests is a planned follow-up.

## Project Structure

```
airport-investment-intelligence-agent/
├── data/
│   ├── airports.json          # The dataset the app actually reads (38 airports)
│   └── full-tier.json         # Hand-curated source for the 16 "full" airports
├── tools/
│   ├── scoring.ts             # Deterministic scoring engine (pure functions)
│   ├── types.ts               # Airport record types
│   └── scoring.smoke.ts       # Verification script (npm run score:smoke)
├── agent/
│   ├── tools.ts                # Gemini tool schemas (no logic)
│   ├── toolExecutors.ts        # Tool implementations, call into tools/scoring.ts
│   ├── geminiAgent.ts           # Orchestration loop + system prompt
│   └── sessionStore.ts          # In-memory conversation state
├── server/
│   └── index.ts                # Express API (serves /api/* and the built UI)
├── ui/
│   ├── src/components/          # Chat bubbles, KPI cards, confidence badges
│   ├── src/lib/                 # Client-side helpers (persistence, typing effect)
│   └── package.json             # Separate frontend package (Vite + React)
├── scripts/
│   └── build-screening-tier.ts  # Regenerates the script-built part of the dataset
├── research/
│   └── aviation-data-sources.md # Notes on public data sources and their limits
├── Dockerfile
├── docker-compose.yml
└── DESIGN.md                    # Scoring methodology, tradeoffs, AI usage boundaries
```

## Author

Ofek Sarusi
