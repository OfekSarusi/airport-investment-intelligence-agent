/**
 * In-memory session state. History lives in Gemini (previous_interaction_id);
 * this just tracks that pointer plus a transcript for the UI. Not persisted --
 * fine for a demo, not production.
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
