import type { ChatMessage } from "../types";

/**
 * Persists the visible chat (messages + sessionId) to localStorage so a
 * page refresh doesn't wipe the conversation -- previously it lived only in
 * React state. Client-side only; doesn't touch the backend's in-memory
 * session store (still correctly scoped as demo-appropriate, not
 * production persistence -- see ticket #1's decision). Restoring the same
 * sessionId after a refresh also means the backend's server-side
 * conversation chain (previous_interaction_id) picks up right where it
 * left off, as long as the backend process itself hasn't restarted.
 */

const STORAGE_KEY = "airport-agent-chat-v1";

interface PersistedChat {
  sessionId?: string;
  messages: ChatMessage[];
}

export function loadPersistedChat(): PersistedChat {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { messages: [] };
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.messages)) return { messages: [] };
    return { sessionId: parsed.sessionId, messages: parsed.messages };
  } catch {
    // Private browsing, disabled storage, corrupted JSON -- fall back to a
    // fresh chat rather than breaking the app.
    return { messages: [] };
  }
}

export function savePersistedChat(chat: PersistedChat): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(chat));
  } catch {
    // Storage full/unavailable -- the chat still works for this tab, it
    // just won't survive a refresh. Not worth surfacing to the user.
  }
}

export function clearPersistedChat(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to do if storage is unavailable.
  }
}
