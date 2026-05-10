import {
  restoreClosed,
  useClosedSessions,
  useCurrentTabId,
  useStore,
  type ClosedSession
} from "../chat/session-store";

function firstUserText(s: ClosedSession): string {
  const m = s.data.messages.find((m) => m.role === "user" && typeof m.content === "string");
  if (!m || typeof m.content !== "string") return "(无文本)";
  return m.content.slice(0, 30) + (m.content.length > 30 ? "…" : "");
}

function shortHost(url: string): string {
  try {
    const u = new URL(url);
    return u.host + (u.pathname.length > 1 ? u.pathname.slice(0, 16) : "");
  } catch {
    return url.slice(0, 30);
  }
}

function ago(ts: number): string {
  const sec = Math.floor((Date.now() - ts) / 1000);
  if (sec < 60) return `${sec}s 前`;
  return `${Math.floor(sec / 60)}m 前`;
}

export function ClosedSessionsBanner() {
  const closed = useClosedSessions();
  const currentTabId = useCurrentTabId();
  if (closed.length === 0 || currentTabId == null) return null;

  function onRestore(idx: number) {
    if (currentTabId == null) return;
    const cur = useStore.getState().sessionsByTab[currentTabId];
    if (cur && cur.messages.length > 0) {
      if (!confirm("将覆盖当前 tab 会话？")) return;
    }
    restoreClosed(idx, currentTabId);
  }

  return (
    <div className="bg-zinc-900/60 border-b border-zinc-800 p-2 text-xs">
      <div className="text-zinc-300 mb-1">📁 近期会话（5 分钟内可恢复）</div>
      <ul className="space-y-1">
        {closed.map((c, i) => (
          <li key={`${c.tabId}-${c.closedAt}`} className="flex items-center gap-2">
            <span className="flex-1 truncate text-zinc-200">{firstUserText(c)}</span>
            <span className="text-zinc-500 truncate">{shortHost(c.url)}</span>
            <span className="text-zinc-500 shrink-0">{ago(c.closedAt)}</span>
            <button
              onClick={() => onRestore(i)}
              className="px-2 py-0.5 bg-emerald-700 rounded shrink-0"
            >
              恢复
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
