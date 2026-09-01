import type { ChatResponse } from "./types";

/**
 * Talks to the backend's /api/chat via a relative path (see vite.config.ts's
 * dev-server proxy). Works unmodified in dev (proxied to localhost:3000) and
 * in the eventual single-container production build (ticket #10), where the
 * same server serves both the API and this UI's static build.
 */
export async function sendChatMessage(message: string, sessionId?: string): Promise<ChatResponse> {
  let res: Response;
  try {
    res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, sessionId }),
    });
  } catch {
    // fetch() itself throws (offline, DNS failure, server down) rather than
    // resolving with a non-ok response -- give a message a user can act on
    // instead of a raw "Failed to fetch" / "NetworkError".
    throw new Error("Could not reach the server. Check your connection and try again.");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const detail = body && typeof body === "object" && "error" in body ? String(body.error) : res.statusText;
    throw new Error(detail || `Request failed with status ${res.status}`);
  }

  try {
    return (await res.json()) as ChatResponse;
  } catch {
    // A 200 with a body that isn't valid JSON shouldn't happen, but would
    // otherwise surface as a cryptic "Unexpected token" parse error.
    throw new Error("The server returned an unreadable response. Please try again.");
  }
}

/**
 * Tells the backend to forget this session's in-memory state. Best-effort:
 * failures are swallowed since this only matters for server-side memory
 * hygiene -- the UI has already cleared its own state either way, and there's
 * nothing useful to show the user if this particular call fails.
 */
export async function resetChatSession(sessionId: string): Promise<void> {
  try {
    await fetch(`/api/session/${encodeURIComponent(sessionId)}/reset`, { method: "POST" });
  } catch {
    // Best-effort -- see doc comment above.
  }
}
