import { useEffect, useRef, useState } from "react";
import { sendChatMessage } from "./api";
import { ChatInput } from "./components/ChatInput";
import { MessageBubble } from "./components/MessageBubble";
import { ThinkingIndicator } from "./components/ThinkingIndicator";
import type { ChatMessage } from "./types";

const WELCOME: ChatMessage = {
  id: "welcome",
  role: "assistant",
  text: "Ask me about a US airport's investment potential -- e.g. \"What's the unmet demand at SFO?\", \"Compare LAX and SNA\", or \"Which New England airports are strong investment candidates?\"",
};

export default function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending]);

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
    <div className="mx-auto flex h-screen max-w-3xl flex-col bg-white shadow-xl sm:my-0">
      <header className="border-b border-slate-200 bg-white px-5 py-4">
        <h1 className="text-base font-semibold text-slate-900">Airport Investment Intelligence Agent</h1>
        <p className="text-xs text-slate-500">Deterministic airport KPIs, narrated by an LLM analyst</p>
      </header>

      <div ref={scrollRef} className="scroll-thin flex-1 space-y-4 overflow-y-auto bg-slate-50 px-5 py-4">
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
        {pending ? <ThinkingIndicator /> : null}
        {error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">
            {error}
          </div>
        ) : null}
      </div>

      <ChatInput onSend={handleSend} disabled={pending} />
    </div>
  );
}
