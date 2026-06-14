import { useEffect } from "react";
import { consumePendingPrompt, type PendingPrompt } from "@/background/context-menu";

/**
 * On sidepanel mount, consume a pending prompt written by the BG context-menu
 * handler. If `autoSend` is true and the prompt is non-empty, call `onAutoSend`;
 * otherwise just fill the input draft via `onFill`.
 *
 * The TTL check happens inside `consumePendingPrompt` (5s).
 */
export function usePendingPrompt(opts: {
  onFill: (text: string) => void;
  onAutoSend: (text: string) => void;
}): void {
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const p: PendingPrompt | null = await consumePendingPrompt(Date.now());
      if (cancelled || !p) return;
      if (p.autoSend && p.text.trim()) opts.onAutoSend(p.text);
      else opts.onFill(p.text);
    })();
    return () => {
      cancelled = true;
    };
    // intentionally run only on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
