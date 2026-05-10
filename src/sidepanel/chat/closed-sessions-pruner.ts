import { useEffect } from "react";
import { pruneClosed } from "./session-store";

export function useClosedSessionsPruner(intervalMs = 30_000): void {
  useEffect(() => {
    const t = setInterval(() => pruneClosed(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
}
