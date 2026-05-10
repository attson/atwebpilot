import { useCurrentTabId, useSession } from "../chat/session-store";

export function TabInfoBar() {
  const tabId = useCurrentTabId();
  const session = useSession();
  if (tabId == null || !session.url) return null;
  let display = session.url;
  try {
    const u = new URL(session.url);
    display = u.host + (u.pathname.length > 1 ? u.pathname : "");
  } catch {
    // keep raw
  }
  return (
    <div className="px-2 py-0.5 text-[11px] text-zinc-500 border-b border-zinc-900 bg-zinc-950 flex items-center gap-2">
      <span className="text-zinc-600">[Tab #{tabId}]</span>
      <span className="truncate">{display}</span>
    </div>
  );
}
