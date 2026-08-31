/**
 * In-memory conversational state, per ticket #1's decision.
 *
 * The Gemini Interactions API tracks conversation content server-side (you
 * chain turns via `previous_interaction_id` rather than resending a full
 * message history) -- so the only thing this store needs for the MODEL's
 * context is the last interaction id per session. It also keeps a light
 * transcript purely for the chat UI to render (ticket #9), which the
 * Interactions API has no reason to know about.
 *
 * No persistence, no DB, lost on server restart -- correct for a demo, not
 * for production (see the architecture discussion on ticket #8/map Notes).
 */

export interface ToolCallRecord {
  name: string;
  args: unknown;
  result: unknown;
  isError: boolean;
}

export interface TranscriptEntry {
  role: "user" | "assistant";
  text: string;
  toolCalls?: ToolCallRecord[];
}

export interface SessionState {
  lastInteractionId: string | null;
  transcript: TranscriptEntry[];
}

const sessions = new Map<string, SessionState>();

export function getOrCreateSession(sessionId: string): SessionState {
  let session = sessions.get(sessionId);
  if (!session) {
    session = { lastInteractionId: null, transcript: [] };
    sessions.set(sessionId, session);
  }
  return session;
}

export function resetSession(sessionId: string): void {
  sessions.delete(sessionId);
}
