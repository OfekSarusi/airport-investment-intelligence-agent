# Single-container build, per ticket #1's decision: one Dockerfile, one
# image -- Express serves both the API and the built React static assets,
# rather than running frontend/backend as two separate services. Minimal
# on purpose (see ticket #10's resolution for the tradeoff discussion).

# --- Stage 1: build the React chat UI (ticket #9) -----------------------
FROM node:20-alpine AS ui-build
WORKDIR /app/ui
COPY ui/package.json ui/package-lock.json ./
RUN npm ci
COPY ui/ ./
RUN npm run build

# --- Stage 2: runtime -----------------------------------------------------
# Runs the backend via ts-node rather than pre-compiling to JS. This is a
# deliberate simplicity-over-polish tradeoff for a 1-day project (avoids a
# separate tsc build step and the path juggling of copying data/airports.json
# alongside compiled output) -- a real production deployment would compile
# to plain JS for a smaller image and faster cold start.
FROM node:20-alpine AS runtime
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY tools ./tools
COPY agent ./agent
COPY server ./server
COPY data ./data
COPY scripts ./scripts

COPY --from=ui-build /app/ui/dist ./ui/dist

ENV NODE_ENV=production
EXPOSE 3000

CMD ["npm", "run", "server:dev"]
