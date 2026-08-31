const SUGGESTIONS = [
  "What's the unmet demand at SFO?",
  "Compare LAX and SNA congestion",
  "Which New England airports are strong investment candidates?",
  "What percentage of flights out of ANC are long-haul?",
];

/**
 * Shown in place of a pre-filled assistant "greeting" bubble -- the user
 * starts the conversation, not the app (per explicit user feedback: the
 * app shouldn't put words in the assistant's mouth before anyone's asked
 * anything). Suggestion chips are optional starting points, not required
 * reading -- clicking one just sends it like typing it would.
 */
export function EmptyState({ onSuggestion }: { onSuggestion: (text: string) => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-5 px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/70 text-2xl shadow-sm ring-1 ring-sky-900/5">
        ✈️
      </div>
      <h2 className="text-lg font-semibold text-slate-800">Ask about a US airport's investment potential</h2>
      <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onSuggestion(s)}
            className="rounded-full border border-sky-900/10 bg-white/80 px-3.5 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition hover:border-brand-300 hover:bg-white hover:text-brand-700 active:scale-95"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
