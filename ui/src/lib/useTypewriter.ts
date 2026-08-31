import { useEffect, useState } from "react";

const CHARS_PER_TICK = 4;
const TICK_MS = 10;

/**
 * Fake client-side "typing" reveal for assistant replies. The backend
 * returns the full reply in one shot -- no real token streaming is wired up
 * from the Interactions API -- so this animates text that has already fully
 * arrived, rather than a true stream. `onTick` fires on every reveal step
 * so the caller can keep the view scrolled to the growing text.
 */
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
    // onTick deliberately excluded -- it's a per-render callback from the
    // parent; including it would restart the animation on every re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullText, enabled]);

  return { revealed, isDone };
}
