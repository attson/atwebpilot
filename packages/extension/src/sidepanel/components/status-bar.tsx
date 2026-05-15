import type { ChatSessionState } from "../chat/session-store";

type Props = {
  status: ChatSessionState["status"];
  roundCount: number;
  maxRounds: number;
  tokenUsage: ChatSessionState["tokenUsage"];
  onAbort: () => void;
};

export function StatusBar({ status, roundCount, maxRounds, tokenUsage, onAbort }: Props) {
  // 只有 idle 且没消耗过 token 时不显示；其余状态都显示，方便随时查看 token / round
  const totalTokens = tokenUsage.input + tokenUsage.output;
  if (status === "idle" && totalTokens === 0 && roundCount === 0) return null;

  const isLive = status === "streaming" || status === "awaiting" || status === "running";
  const dot =
    status === "error" || status === "aborted"
      ? "bg-red-500"
      : status === "done"
      ? "bg-emerald-500"
      : isLive
      ? "bg-emerald-500 animate-pulse"
      : "bg-zinc-500";

  const label =
    status === "streaming"
      ? "AI 工作中"
      : status === "awaiting"
      ? "等待审阅"
      : status === "running"
      ? "执行 step"
      : status === "aborted"
      ? "已终止"
      : status === "error"
      ? "出错"
      : status === "done"
      ? "✓ 已完成"
      : "空闲";

  const bg =
    status === "done"
      ? "bg-emerald-900/30 border-emerald-800"
      : status === "error" || status === "aborted"
      ? "bg-red-900/30 border-red-800"
      : "bg-zinc-900 border-zinc-800";

  return (
    <div className={`border-b ${bg} p-2 text-xs flex items-center gap-2`}>
      <span className={`w-2 h-2 rounded-full ${dot}`} />
      <span>
        {label}
        {" · "}
        round {roundCount}/{maxRounds}
        {" · "}
        in {tokenUsage.input} / out {tokenUsage.output} (= {totalTokens})
      </span>
      {isLive && (
        <button onClick={onAbort} className="ml-auto px-2 py-0.5 bg-red-800 rounded">
          ⏸ 终止
        </button>
      )}
    </div>
  );
}
