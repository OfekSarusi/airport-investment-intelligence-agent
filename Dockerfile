# Single container -- Express serves both the API and the built React assets.

# --- Stage 1: build the React chat UI ---
FROM node:20-alpine AS ui-build
WORKDIR /app/ui
COPY ui/package.json ui/package-lock.json ./
RUN npm ci
COPY ui/ ./
RUN npm run build

# --- Stage 2: runtime ---
# Runs the backend via ts-node (no separate compile step) -- simpler for a
# 1-day project, at the cost of a slower cold start vs. precompiled JS.
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
