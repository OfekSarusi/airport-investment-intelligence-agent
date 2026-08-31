import Markdown from "react-markdown";
import type { ChatMessage } from "../types";
import { ToolCallChip } from "./ToolCallChip";
import { ToolResultCard } from "./ToolResultCard";

export function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[75%] rounded-2xl rounded-br-sm bg-brand-600 px-4 py-2.5 text-sm text-white shadow-sm">
          {message.text}
        </div>
      </div>
    );
  }

  const toolCalls = message.toolCalls ?? [];

  return (
    <div className="flex justify-start">
      <div className="w-full max-w-[85%] space-y-2">
        <div className="markdown-content rounded-2xl rounded-bl-sm border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 shadow-sm">
          <Markdown>{message.text}</Markdown>
        </div>

        {toolCalls.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 pl-1">
            {toolCalls.map((call, i) => (
              <ToolCallChip key={i} call={call} />
            ))}
          </div>
        ) : null}

        {toolCalls.length > 0 ? (
          <div className="space-y-3 pl-1">
            {toolCalls.map((call, i) => (
              <ToolResultCard key={i} call={call} />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
