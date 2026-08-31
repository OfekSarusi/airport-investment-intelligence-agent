import { useCallback, useEffect, useRef, useState } from "react";
import { sendChatMessage } from "./api";
import { ChatInput } from "./components/ChatInput";
import { EmptyState } from "./components/EmptyState";
import { MessageBubble } from "./components/MessageBubble";
import { ThinkingIndicator } from "./components/ThinkingIndicator";
import { clearPersistedChat, loadPersistedChat, savePersistedChat } from "./lib/persistedChat";
import type { ChatMessage } from "./types";
import wonderfulLogo from "./assets/wonderful-logo.jpg";

/** Within this many px of the bottom still counts as "at the bottom" --
 *  avoids the scroll-to-bottom button flickering in on tiny sub-pixel
 *  scroll deltas. */
const AT_BOTTOM_THRESHOLD_PX = 48;

export default function App() {
  const initial = loadPersistedChat();
  const [messages, setMessages] = useState<ChatMessage[]>(initial.messages);
  const [sessionId, setSessionId] = useState<string | undefined>(initial.sessionId);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The one message currently playing its typing animation -- never set for
  // messages restored from localStorage, only for a reply that just arrived
  // this session, so history doesn't "replay" on every page load.
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);

  const scrollToBottom = useCallback((smooth: boolean) => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: smooth ? "smooth" : "auto" });
    isAtBottomRef.current = true;
    setIsAtBottom(true);
  }, []);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < AT_BOTTOM_THRESHOLD_PX;
    isAtBottomRef.current = atBottom;
    setIsAtBottom(atBottom);
  }

  // Follows new content (a fresh message, tool cards appearing, the
  // thinking indicator) only while the user hasn't deliberately scrolled up
  // to reread something earlier -- otherwise this would yank them back down
  // mid-read every time a reply streams in.
  useEffect(() => {
    if (isAtBottomRef.current) {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [messages, pending]);

  useEffect(() => {
    savePersistedChat({ sessionId, messages });
  }, [sessionId, messages]);

  function handleClear() {
    setMessages([]);
    setSessionId(undefined);
    setError(null);
    setStreamingId(null);
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
      const replyId = crypto.randomUUID();
      setStreamingId(replyId);
      setMessages((prev) => [...prev, { id: replyId, role: "assistant", text: res.reply, toolCalls: res.toolCalls }]);
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
          <img src={wonderfulLogo} alt="Wonderful" className="h-9 w-9 rounded-xl object-cover shadow-sm" />
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

        <div className="relative min-h-0 flex-1">
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="scroll-thin h-full space-y-4 overflow-y-auto bg-sky-panel px-5 py-4"
          >
            {messages.length === 0 ? (
              <EmptyState onSuggestion={handleSend} />
            ) : (
              messages.map((m) => (
                <MessageBubble
                  key={m.id}
                  message={m}
                  animate={m.id === streamingId}
                  onGrow={() => {
                    if (isAtBottomRef.current) scrollToBottom(false);
                  }}
                  onDone={() => setStreamingId((current) => (current === m.id ? null : current))}
                />
              ))
            )}
            {pending ? <ThinkingIndicator /> : null}
            {error ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">
                {error}
              </div>
            ) : null}
          </div>

          {!isAtBottom && messages.length > 0 ? (
            <button
              type="button"
              onClick={() => scrollToBottom(true)}
              className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-600 shadow-md transition hover:bg-slate-50 active:scale-95"
            >
              ↓ Scroll to bottom
            </button>
          ) : null}
        </div>

        <ChatInput onSend={handleSend} disabled={pending} />
      </div>
    </div>
  );
}
