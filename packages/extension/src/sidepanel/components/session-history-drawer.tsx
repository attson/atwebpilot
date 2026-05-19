import { useEffect, useState } from "react";
import type { PersistedSession } from "@webpilot/shared/types";
import * as ss from "@/sidepanel/chat/persistence/sessions-storage";
import { rehydrateFromPersisted, useStore } from "@/sidepanel/chat/session-store";

function firstUserText(s: PersistedSession): string {
  const m = s.data.messages.find((m) => m.role === "user" && typeof m.content === "string");
  if (!m || typeof m.content !== "string") return "(无文本)";
  return m.content.slice(0, 30) + (m.content.length > 30 ? "…" : "");
}

function ago(ts: number): string {
  const sec = Math.floor((Date.now() - ts) / 1000);
  if (sec < 60) return `${sec}s 前`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m 前`;
  if (sec < 86_400) return `${Math.floor(sec / 3600)}h 前`;
  return `${Math.floor(sec / 86_400)}d 前`;
}

export function SessionHistoryDrawer(props: {
  url: string;
  open: boolean;
  onClose: () => void;
}): JSX.Element | null {
  const [rows, setRows] = useState<PersistedSession[]>([]);

  useEffect(() => {
    if (!props.open) return;
    let cancelled = false;
    void (async () => {
      const list = await ss.listArchivedByUrl(props.url);
      if (!cancelled) setRows(list);
    })();
    return () => {
      cancelled = true;
    };
  }, [props.open, props.url]);

  if (!props.open) return null;

  async function refresh() {
    const list = await ss.listArchivedByUrl(props.url);
    setRows(list);
  }

  async function onRestore(target: PersistedSession) {
    const tabId = useStore.getState().currentTabId;
    if (tabId == null) return;
    const curActive = await ss.getActiveByTabId(tabId);
    if (curActive && curActive.id !== target.id) {
      await ss.archiveActive(curActive.id);
    }
    await ss.restoreArchived(target.id, tabId);
    rehydrateFromPersisted(tabId, target.data);
    await refresh();
    props.onClose();
  }

  async function onDelete(target: PersistedSession) {
    const runId = await ss.deleteOne(target.id);
    if (runId) await ss.cascadeDeleteRuns([runId]);
    await refresh();
  }

  async function onClearAll() {
    if (!confirm(`清空此 URL 的全部历史？（${rows.length} 条）`)) return;
    const runIds = await ss.clearAllForUrl(props.url);
    await ss.cascadeDeleteRuns(runIds);
    await refresh();
  }

  return (
    <div className="fixed inset-0 z-40 flex" onClick={props.onClose}>
      <div
        className="ml-auto h-full w-80 bg-zinc-900 border-l border-zinc-800 p-3 text-xs overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-zinc-200">历史会话（{rows.length}）</span>
          <button onClick={props.onClose} className="text-zinc-400">
            ✕
          </button>
        </div>
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.id} data-testid="history-item" className="border border-zinc-800 rounded p-2">
              <div className="text-zinc-200 truncate">{firstUserText(r)}</div>
              <div className="text-zinc-500 flex justify-between mt-1">
                <span>
                  {r.data.messages.length} 条 · {ago(r.updatedAt)}
                </span>
                <div className="flex gap-2">
                  <button onClick={() => void onRestore(r)} className="text-emerald-400">
                    恢复
                  </button>
                  <button onClick={() => void onDelete(r)} className="text-red-400">
                    删除
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
        {rows.length > 0 && (
          <button
            onClick={() => void onClearAll()}
            className="mt-3 w-full px-2 py-1 bg-red-800 rounded text-zinc-100"
          >
            清空此 URL 历史
          </button>
        )}
      </div>
    </div>
  );
}
