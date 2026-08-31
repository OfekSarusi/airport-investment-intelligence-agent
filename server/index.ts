import "dotenv/config";
import path from "node:path";
import express from "express";
import rateLimit from "express-rate-limit";
import { randomUUID } from "node:crypto";
import { runTurn } from "../agent/geminiAgent";
import { resetSession } from "../agent/sessionStore";

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

// Built UI assets (produced by `npm run build` in ui/, copied here by Docker).
// Doesn't exist in local dev -- the UI runs its own Vite server instead.
const UI_DIST_DIR = path.join(__dirname, "../ui/dist");

// No CORS middleware: the UI and API always share one origin (same container
// in Docker; Vite's dev proxy makes it same-origin from the browser's view
// in local dev too), so there's no legitimate cross-origin caller -- default
// same-origin browser behavior is the correct, safer posture here.
app.use(express.json());
app.use(express.static(UI_DIST_DIR));

// Only /api/chat is rate-limited -- it's the one endpoint that spends real
// Gemini quota per call. 20/min per IP is generous for an actual
// conversation but stops a flood from exhausting the (free-tier) quota.
const chatRateLimiter = rateLimit({
  windowMs: 60_000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many messages sent -- please wait a moment and try again." },
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, geminiKeyConfigured: Boolean(process.env.GEMINI_API_KEY) });
});

app.post("/api/chat", chatRateLimiter, async (req, res) => {
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
    // Full error (may include upstream SDK/API internals) is logged
    // server-side only -- the client gets a generic message so we never leak
    // implementation details in an HTTP response.
    // eslint-disable-next-line no-console
    console.error("[/api/chat] error:", err);
    res.status(500).json({ error: "Something went wrong processing your message. Please try again." });
  }
});

app.post("/api/session/:sessionId/reset", (req, res) => {
  resetSession(req.params.sessionId);
  res.json({ ok: true });
});

// SPA fallback so a hard refresh doesn't 404 (Express 5 needs a named wildcard, not bare `*`).
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
