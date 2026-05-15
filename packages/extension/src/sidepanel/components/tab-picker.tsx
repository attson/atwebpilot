import { useEffect, useState } from "react";

type TabRow = { tabId: number; windowId: number; url: string; title: string };

type Props = {
  listTabs: (windowId?: number) => Promise<{ tabs: TabRow[] }>;
  attachedIds: number[];
  currentTabId: number | null;
  onSelect: (t: TabRow) => void;
  onClose: () => void;
};

export function TabPicker({ listTabs, attachedIds, currentTabId, onSelect, onClose }: Props): JSX.Element {
  const [rows, setRows] = useState<TabRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const r = await listTabs();
        if (!active) return;
        setRows(r.tabs);
      } catch (e) {
        if (active) setErr(e instanceof Error ? e.message : String(e));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [listTabs]);

  const groups = rows.reduce<Record<number, TabRow[]>>((acc, r) => {
    (acc[r.windowId] ||= []).push(r);
    return acc;
  }, {});

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={onClose}>
      <div
        className="w-[420px] max-h-[70vh] overflow-auto bg-zinc-900 border border-zinc-700 rounded text-zinc-100 text-[12px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-3 py-2 border-b border-zinc-700 flex items-center justify-between">
          <span>选择要附加的 tab</span>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-100">×</button>
        </div>
        {loading && <div className="p-3 text-zinc-400">加载中…</div>}
        {err && <div className="p-3 text-red-400">{err}</div>}
        {!loading && !err && Object.entries(groups).map(([wid, list]) => (
          <div key={wid}>
            <div className="px-3 py-1 text-zinc-500 text-[11px] sticky top-0 bg-zinc-900">窗口 {wid}</div>
            {list.map((r) => {
              const disabled = attachedIds.includes(r.tabId) || r.tabId === currentTabId;
              return (
                <button
                  key={r.tabId}
                  data-testid={`picker-row-${r.tabId}`}
                  data-disabled={disabled ? "true" : "false"}
                  disabled={disabled}
                  className={`w-full text-left px-3 py-2 border-b border-zinc-800 ${
                    disabled ? "opacity-40 cursor-not-allowed" : "hover:bg-zinc-800"
                  }`}
                  onClick={() => onSelect(r)}
                >
                  <div className="truncate">{r.title || "(无标题)"}</div>
                  <div className="text-zinc-500 text-[10px] truncate">{r.url}</div>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
