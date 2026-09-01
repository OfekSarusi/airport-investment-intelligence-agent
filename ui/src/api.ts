import type { ChatResponse } from "./types";

/** Calls /api/chat via a relative path -- proxied in dev, same-origin in production (see vite.config.ts). */
export async function sendChatMessage(message: string, sessionId?: string): Promise<ChatResponse> {
  let res: Response;
  try {
    res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, sessionId }),
    });
  } catch {
    // fetch() throws on network failure (offline, DNS, server down).
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
    throw new Error("The server returned an unreadable response. Please try again.");
  }
}

/** Tells the backend to forget this session. Best-effort -- the UI has already cleared its own state either way. */
export async function resetChatSession(sessionId: string): Promise<void> {
  try {
    await fetch(`/api/session/${encodeURIComponent(sessionId)}/reset`, { method: "POST" });
  } catch {
    // best-effort, nothing to do
  }
}
