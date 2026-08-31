import type { ChatMessage } from "../types";

/** Persists the visible chat to localStorage so a page refresh doesn't wipe it. */

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
    return { messages: [] }; // disabled/corrupted storage -- start fresh
  }
}

export function savePersistedChat(chat: PersistedChat): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(chat));
  } catch {
    // storage full/unavailable -- chat still works, just won't survive a refresh
  }
}

export function clearPersistedChat(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to do if storage is unavailable.
  }
}
