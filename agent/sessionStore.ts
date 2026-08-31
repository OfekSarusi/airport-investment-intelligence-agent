/**
 * In-memory conversation state. Gemini tracks history server-side via
 * previous_interaction_id, so this only needs the last interaction id per
 * session, plus a light transcript for the UI. No persistence -- fine for a
 * demo, not for production.
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
