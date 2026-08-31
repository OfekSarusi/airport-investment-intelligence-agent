import { useEffect, useState } from "react";

const CHARS_PER_TICK = 4;
const TICK_MS = 10;

/** Fake client-side "typing" reveal -- the backend returns the full reply in one shot. */
export function useTypewriter(fullText: string, enabled: boolean, onTick?: () => void) {
  const [revealed, setRevealed] = useState(enabled ? "" : fullText);
  const [isDone, setIsDone] = useState(!enabled);

  useEffect(() => {
    if (!enabled) {
      setRevealed(fullText);
      setIsDone(true);
      return;
    }
    setIsDone(false);
    setRevealed("");
    let i = 0;
    const id = setInterval(() => {
      i += CHARS_PER_TICK;
      setRevealed(fullText.slice(0, i));
      onTick?.();
      if (i >= fullText.length) {
        setIsDone(true);
        clearInterval(id);
      }
    }, TICK_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onTick excluded on purpose
  }, [fullText, enabled]);

  return { revealed, isDone };
}
