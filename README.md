# Airport Investment Intelligence Agent

An AI-powered chat agent that helps investment analysts identify US airports where renovation or terminal expansion is likely to be most profitable — based on **deterministic KPIs** (capacity utilization, congestion, growth trends, unmet demand), narrated in plain language by an LLM that never invents a number.

For the full architecture, scoring formulas, and the reasoning behind every major decision, see **[DESIGN.md](./DESIGN.md)**.

## What it can answer

- *"Which airports in New England are strong candidates for terminal expansion?"*
- *"Compare LAX and Santa Ana airport congestion levels."*
- *"What is the percentage of long-haul flights out of Anchorage airport?"*
- *"What is the unmet flight demand at SFO and why?"*
- ...plus natural follow-up questions in the same conversation.

## Quickstart (Docker — recommended)

Requires [Docker Desktop](https://www.docker.com/products/docker-desktop/) running, and a free Gemini API key.

1. Get a free key at **[aistudio.google.com/apikey](https://aistudio.google.com/apikey)**.
2. Copy the example env file and add your key:
   ```bash
   cp .env.example .env
   # then edit .env and set GEMINI_API_KEY=...
   ```
3. Build and run:
   ```bash
   docker compose up --build
   ```
4. Open **[http://localhost:3000](http://localhost:3000)**.

That's it — one container serves both the chat UI and the API.

## Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `GEMINI_API_KEY` | Yes | — | Free key from [Google AI Studio](https://aistudio.google.com/apikey). Without it, `/api/chat` returns an error. |
| `PORT` | No | `3000` | Port the backend (and, in Docker, the whole app) listens on. |

## Running locally without Docker (development)

Two processes, in two terminals, from the repo root:

```bash
# Terminal 1 — backend (Express + the Gemini agent), port 3000
npm install
npm run server:dev

# Terminal 2 — frontend (React + Vite dev server, with hot reload), port 5173
cd ui
npm install
npm run dev
```

Then open **[http://localhost:5173](http://localhost:5173)** (it proxies API calls to port 3000).

Useful scripts:

| Command | What it does |
|---|---|
| `npm run server:dev` | Runs the backend (`ts-node server/index.ts`) |
| `npm run score:smoke` | Runs the scoring engine directly against real data, prints results for all 4 test cases — no Gemini call needed |
| `npm run build-screening-tier` | Regenerates the script-built portion of `data/airports.json` |
| `cd ui && npm run dev` | Frontend dev server with hot reload |
| `cd ui && npm run build` | Production build of the UI (this is what Docker runs automatically) |

## Project structure

```
data/           Static airport dataset (data/airports.json) + the source files behind it
tools/          Deterministic scoring engine — pure functions, no LLM, no I/O
agent/          Gemini tool declarations, tool execution, and the conversation loop
server/         Express API (serves both /api/* and the built UI in production)
ui/             React + Vite + Tailwind chat interface (its own package.json)
scripts/        One-off data-build scripts
research/       Notes on the public data sources used and their access limits
```

## A note on the data

Every non-trivial number in this app is labeled `sourced` (backed by a cited public dataset) or `estimated` (a documented, reasoned approximation, used where the ideal data source wasn't accessible). The chat UI shows this as a visible badge next to the relevant figure. See [DESIGN.md §2 and §6](./DESIGN.md) for exactly which fields are which, and why.

## Deliverables checklist

- ✅ Source code (this repo)
- ✅ Deterministic scoring/ranking logic, independent of the LLM (`tools/scoring.ts`)
- ✅ Chat interface (`ui/`)
- ✅ Design document with scoring methodology, tradeoffs, and AI usage boundaries (`DESIGN.md`)
- ⏳ Voice input — optional bonus, best-effort only if time remains
