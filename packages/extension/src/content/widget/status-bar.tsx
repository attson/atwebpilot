import { useEffect, useState } from "react";
import { Wrench, Brain, PauseCircle } from "lucide-react";
import type { SessionData } from "@/sidepanel/chat/session-store";

type Props = { session: SessionData };

/**
 * Sticky 24px 状态条,session.status !== idle/done/aborted 时渲染。
 * - running: 🔧 {tool} · {elapsed}s ⟳(每 250ms 刷新)
 * - streaming: 💭 AI 思考中...
 * - awaiting: ⏸ 等待你确认下一步
 */
export function StatusBar({ session }: Props) {
  const [, forceTick] = useState(0);

  const runningCard = session.cards.find((c) => c.status === "running");
  const shouldTick = runningCard != null;

  useEffect(() => {
    if (!shouldTick) return;
    const id = setInterval(() => forceTick((n) => n + 1), 250);
    return () => clearInterval(id);
  }, [shouldTick]);

  const st = session.status;
  if (st === "idle" || st === "done" || st === "aborted" || st === "error") return null;

  if (runningCard) {
    const startedAt = runningCard._runningStartAt;
    const secs = startedAt ? ((Date.now() - startedAt) / 1000).toFixed(1) : "?";
    return (
      <div
        data-testid="widget-status-bar"
        className="px-3 py-1 border-b border-zinc-800 text-[11px] text-zinc-400 flex items-center gap-2 shrink-0"
      >
        <Wrench size={12} className="text-emerald-400" />
        <span className="font-mono">{runningCard.name}</span>
        <span className="text-zinc-500">· {secs}s</span>
        <span className="ml-auto animate-spin">⟳</span>
      </div>
    );
  }
  if (st === "awaiting") {
    return (
      <div
        data-testid="widget-status-bar"
        className="px-3 py-1 border-b border-zinc-800 text-[11px] text-amber-300 flex items-center gap-2 shrink-0"
      >
        <PauseCircle size={12} />
        <span>等待你确认下一步</span>
      </div>
    );
  }
  return (
    <div
      data-testid="widget-status-bar"
      className="px-3 py-1 border-b border-zinc-800 text-[11px] text-zinc-400 flex items-center gap-2 shrink-0"
    >
      <Brain size={12} />
      <span>AI 思考中…</span>
    </div>
  );
}
