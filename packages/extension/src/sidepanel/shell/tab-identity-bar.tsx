import type { SessionStatus } from "../chat/session-store";

type Props = {
  tabId: number;
  url: string;
  status: SessionStatus;
  recoverable: boolean;
  onRecover?: () => void;
};

const DOT_TONE: Record<SessionStatus, string> = {
  idle:      "text-zinc-500",
  streaming: "text-emerald-400 animate-pulse",
  awaiting:  "text-amber-400",
  running:   "text-emerald-400 animate-pulse",
  done:      "text-zinc-500",
  error:     "text-red-400",
  aborted:   "text-zinc-500",
};

function truncate(s: string, max = 36): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "…";
}

/**
 * Second header row showing the current Chrome tab's URL + Tab #id and
 * optionally a "[恢复 →]" link when a saved session exists for this URL.
 */
export function TabIdentityBar({ tabId, url, status, recoverable, onRecover }: Props) {
  return (
    <div className="flex items-center gap-1.5 px-3 pb-2 text-[10px]">
      <span className={DOT_TONE[status]} aria-label={`status-${status}`}>●</span>
      <span className="text-zinc-300 truncate">{truncate(url)}</span>
      <span className="text-zinc-500">· Tab #{tabId}</span>
      {recoverable && onRecover && (
        <button
          type="button"
          className="ml-auto text-blue-400 hover:text-blue-300 shrink-0"
          onClick={onRecover}
        >
          [恢复 →]
        </button>
      )}
    </div>
  );
}
