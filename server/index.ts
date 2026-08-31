import "dotenv/config";
import express from "express";
import cors from "cors";
import { randomUUID } from "node:crypto";
import { runTurn } from "../agent/geminiAgent";
import { resetSession } from "../agent/sessionStore";

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

app.use(cors());
app.use(express.json());

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
