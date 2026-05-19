import { useState } from "react";
import type { PersistedSession } from "@webpilot/shared/types";
import * as ss from "@/sidepanel/chat/persistence/sessions-storage";
import { setPersistIdFor } from "@/sidepanel/chat/persistence/auto-persist";
import { rehydrateFromPersisted, useStore } from "@/sidepanel/chat/session-store";

function firstUserText(s: PersistedSession): string {
  const m = s.data.messages.find((msg) => msg.role === "user" && typeof msg.content === "string");
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

export function UrlRecoveryBanner(props: {
  candidates: PersistedSession[];
  onOpenDrawer: () => void;
  onDismiss: () => void;
}): JSX.Element | null {
  const [hidden, setHidden] = useState(false);
  if (hidden || props.candidates.length === 0) return null;
  const top = props.candidates[0];

  async function onRestore() {
    const tabId = useStore.getState().currentTabId;
    if (tabId == null) return;
    await ss.restoreArchived(top.id, tabId);
    rehydrateFromPersisted(tabId, top.data);
    setPersistIdFor(tabId, top.id);
    setHidden(true);
  }

  async function onDiscard() {
    await ss.deleteOne(top.id);
    setHidden(true);
    props.onDismiss();
  }

  return (
    <div className="bg-zinc-900/60 border-b border-zinc-800 p-2 text-xs">
      <div className="flex items-center gap-2">
        <span className="text-zinc-300">📁 上次会话</span>
        <span className="flex-1 truncate text-zinc-200">{firstUserText(top)}</span>
        <span className="text-zinc-500 shrink-0">
          {top.data.messages.length} 条 · {ago(top.updatedAt)}
        </span>
        <button
          onClick={() => void onRestore()}
          className="px-2 py-0.5 bg-emerald-700 rounded shrink-0"
        >
          恢复
        </button>
        <button
          onClick={() => void onDiscard()}
          className="px-2 py-0.5 bg-zinc-700 rounded shrink-0"
        >
          丢弃
        </button>
        {props.candidates.length > 1 && (
          <button
            onClick={props.onOpenDrawer}
            className="px-2 py-0.5 underline text-zinc-300 shrink-0"
          >
            更多
          </button>
        )}
      </div>
    </div>
  );
}
