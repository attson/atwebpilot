import { Save } from "lucide-react";
import { rpc } from "@/sidepanel/rpc";
import type { SessionData } from "@/sidepanel/chat/session-store";

type Props = { session: SessionData; tabId: number };

/**
 * Chat body 尾部小条:执行完 N 步、状态 done 时露"保存为工具"入口。
 * 点击调 widget.openSidepanelWithSave RPC — BG 打开 sidepanel + 存 pendingSave,
 * sidepanel focus effect 读到就调 showSave(tabId)。
 */
export function SaveEntry({ session, tabId }: Props) {
  const canSave =
    session.executedSteps.length > 0 && session.status === "done";
  if (!canSave) return null;
  async function onClick() {
    await rpc.widgetOpenSidepanelWithSave({ tabId }).catch(() => {});
  }
  return (
    <div
      data-testid="widget-save-entry"
      className="mt-2 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded flex items-center gap-2 text-[11px]"
    >
      <span className="text-emerald-400">✓</span>
      <span className="flex-1 text-zinc-300">
        已执行 {session.executedSteps.length} 步
      </span>
      <button
        onClick={onClick}
        className="px-2 py-0.5 bg-emerald-800 hover:bg-emerald-700 rounded text-emerald-100 flex items-center gap-1"
      >
        <Save size={11} /> 保存为工具
      </button>
    </div>
  );
}
