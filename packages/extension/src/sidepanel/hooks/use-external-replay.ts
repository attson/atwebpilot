import { useEffect, useState } from "react";
import {
  PENDING_REPLAY_KEY,
  PENDING_REPLAY_TTL_MS,
  type PendingReplay,
} from "@/sidepanel/lib/external-replay";

/**
 * Checks chrome.storage.local for a pending replay payload on mount + whenever
 * storage changes (so a freshly written one mid-session also triggers the modal).
 * TTL-expired payloads are silently dropped.
 */
export function useExternalReplay(): {
  replay: PendingReplay | null;
  clear: () => void;
} {
  const [replay, setReplay] = useState<PendingReplay | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      try {
        const cur = (await chrome.storage.local.get(PENDING_REPLAY_KEY))[PENDING_REPLAY_KEY] as
          | PendingReplay
          | undefined;
        if (cancelled) return;
        if (!cur) {
          setReplay(null);
          return;
        }
        if (Date.now() - cur.ts > PENDING_REPLAY_TTL_MS) {
          await chrome.storage.local.remove(PENDING_REPLAY_KEY);
          setReplay(null);
          return;
        }
        setReplay(cur);
      } catch {
        setReplay(null);
      }
    }
    void refresh();
    function onChanged(changes: { [k: string]: chrome.storage.StorageChange }, area: string) {
      if (area === "local" && changes[PENDING_REPLAY_KEY]) void refresh();
    }
    chrome.storage.onChanged.addListener(onChanged);
    return () => {
      cancelled = true;
      chrome.storage.onChanged.removeListener(onChanged);
    };
  }, []);

  function clear() {
    setReplay(null);
    void chrome.storage.local.remove(PENDING_REPLAY_KEY).catch(() => undefined);
  }

  return { replay, clear };
}
