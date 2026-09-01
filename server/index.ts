import "dotenv/config";
import path from "node:path";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { randomUUID } from "node:crypto";
import { runTurn } from "../agent/geminiAgent";
import { resetSession } from "../agent/sessionStore";

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

// Built UI assets (from ui/, copied in by Docker); absent in local dev.
const UI_DIST_DIR = path.join(__dirname, "../ui/dist");

// No CORS -- UI and API always share one origin (Docker container, or Vite's dev proxy).
app.use(helmet());
app.use(express.json());
app.use(express.static(UI_DIST_DIR));

// Only /api/chat spends Gemini quota, so only it is rate-limited (20/min per IP).
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
    // Log the full error server-side; never leak internals to the client.
    // eslint-disable-next-line no-console
    console.error("[/api/chat] error:", err);
    res.status(500).json({ error: "Something went wrong processing your message. Please try again." });
  }
});

app.post("/api/session/:sessionId/reset", (req, res) => {
  resetSession(req.params.sessionId);
  res.json({ ok: true });
});

// SPA fallback so a hard refresh doesn't 404 (Express 5 needs a named wildcard here, not `*`).
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
