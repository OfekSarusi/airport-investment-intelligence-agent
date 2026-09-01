import { useState } from "react";

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard can be unavailable -- fail silently, it's easy to retry
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      title="Copy reply"
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-slate-400 transition hover:bg-black/5 hover:text-slate-600 active:scale-95"
    >
      {copied ? "Copied ✓" : "Copy"}
    </button>
  );
}
