import "dotenv/config";
import path from "node:path";
import express from "express";
import cors from "cors";
import { randomUUID } from "node:crypto";
import { runTurn } from "../agent/geminiAgent";
import { resetSession } from "../agent/sessionStore";

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

// Built React static assets (ticket #9), produced by `npm run build` inside
// ui/ -- the Dockerfile's ui-build stage does this and copies the output
// here. In local dev this directory won't exist (the UI runs via its own
// Vite dev server instead, proxying /api to this server), so express.static
// silently serves nothing rather than erroring -- that's fine, expected.
const UI_DIST_DIR = path.join(__dirname, "../ui/dist");

app.use(cors());
app.use(express.json());
app.use(express.static(UI_DIST_DIR));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, geminiKeyConfigured: Boolean(process.env.GEMINI_API_KEY) });
});

app.post("/api/chat", async (req, res) => {
  const { message, sessionId: incomingSessionId } = req.body ?? {};

  if (typeof message !== "string" || message.trim().length === 0) {
    res.status(400).json({ error: "Request body must include a non-empty 'message' string." });
    return;
  }

  const sessionId = typeof incomingSessionId === "string" && incomingSessionId ? incomingSessionId : randomUUID();

  try {
    const { reply, toolCalls } = await runTurn(sessionId, message);
    res.json({ sessionId, reply, toolCalls });
  } catch (err) {
    const error = err as Error;
    // eslint-disable-next-line no-console
    console.error("[/api/chat] error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/session/:sessionId/reset", (req, res) => {
  resetSession(req.params.sessionId);
  res.json({ ok: true });
});

// SPA fallback: any non-API GET request gets index.html (there's no
// client-side routing in this app today, but this keeps a hard refresh or a
// deep link from 404ing). Express 5's wildcard syntax requires a named
// param (`*splat`), not a bare `*`. Placed last, after every real route.
app.get("/*splat", (req, res, next) => {
  if (req.path.startsWith("/api/")) {
    next();
    return;
  }
  res.sendFile(path.join(UI_DIST_DIR, "index.html"), (err) => {
    if (err) next(err);
  });
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Airport Investment Intelligence Agent backend listening on http://localhost:${PORT}`);
  if (!process.env.GEMINI_API_KEY) {
    // eslint-disable-next-line no-console
    console.warn(
      "WARNING: GEMINI_API_KEY is not set. /api/chat will fail until it's configured (see .env.example).",
    );
  }
});
