import type { ChatResponse } from "./types";

/**
 * Talks to the backend's /api/chat via a relative path (see vite.config.ts's
 * dev-server proxy). Works unmodified in dev (proxied to localhost:3000) and
 * in the eventual single-container production build (ticket #10), where the
 * same server serves both the API and this UI's static build.
 */
export async function sendChatMessage(message: string, sessionId?: string): Promise<ChatResponse> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, sessionId }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const detail = body && typeof body === "object" && "error" in body ? String(body.error) : res.statusText;
    throw new Error(detail || `Request failed with status ${res.status}`);
  }

  return (await res.json()) as ChatResponse;
}
