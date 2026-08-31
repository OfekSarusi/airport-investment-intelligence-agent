import { useEffect, useRef, useState } from "react";
import { sendChatMessage } from "./api";
import { ChatInput } from "./components/ChatInput";
import { EmptyState } from "./components/EmptyState";
import { MessageBubble } from "./components/MessageBubble";
import { ThinkingIndicator } from "./components/ThinkingIndicator";
import { clearPersistedChat, loadPersistedChat, savePersistedChat } from "./lib/persistedChat";
import type { ChatMessage } from "./types";

export default function App() {
  const initial = loadPersistedChat();
  const [messages, setMessages] = useState<ChatMessage[]>(initial.messages);
  const [sessionId, setSessionId] = useState<string | undefined>(initial.sessionId);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending]);

  useEffect(() => {
    savePersistedChat({ sessionId, messages });
  }, [sessionId, messages]);

  function handleClear() {
    setMessages([]);
    setSessionId(undefined);
    setError(null);
    clearPersistedChat();
  }

  async function handleSend(text: string) {
    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: "user", text };
    setMessages((prev) => [...prev, userMessage]);
    setPending(true);
    setError(null);

    try {
      const res = await sendChatMessage(text, sessionId);
      setSessionId(res.sessionId);
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "assistant", text: res.reply, toolCalls: res.toolCalls },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong talking to the backend.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-0 sm:p-6">
      <div className="flex h-screen w-full max-w-3xl flex-col overflow-hidden bg-white/90 shadow-2xl shadow-sky-900/10 ring-1 ring-black/5 backdrop-blur sm:h-[calc(100vh-3rem)] sm:rounded-3xl">
        <header className="flex items-center gap-3 border-b border-sky-900/5 bg-gradient-to-r from-brand-50 to-white px-5 py-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-base shadow-sm">
            ✈️
          </span>
          <div className="flex-1">
            <h1 className="text-base font-semibold text-slate-900">Airport Investment Intelligence Agent</h1>
            <p className="text-xs text-slate-500">Deterministic airport KPIs, narrated by an LLM analyst</p>
          </div>
          {messages.length > 0 ? (
            <button
              type="button"
              onClick={handleClear}
              className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-black/5 hover:text-slate-700 active:scale-95"
            >
              Clear chat
            </button>
          ) : null}
        </header>

        <div ref={scrollRef} className="scroll-thin flex-1 space-y-4 overflow-y-auto bg-sky-panel px-5 py-4">
          {messages.length === 0 ? (
            <EmptyState onSuggestion={handleSend} />
          ) : (
            messages.map((m) => <MessageBubble key={m.id} message={m} />)
          )}
          {pending ? <ThinkingIndicator /> : null}
          {error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">
              {error}
            </div>
          ) : null}
        </div>

        <ChatInput onSend={handleSend} disabled={pending} />
      </div>
    </div>
  );
}
