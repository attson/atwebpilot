import type { ChatSessionState } from "../chat/session-store";

type Props = {
  status: ChatSessionState["status"];
  roundCount: number;
  maxRounds: number;
  tokenUsage: ChatSessionState["tokenUsage"];
  onAbort: () => void;
};

export function StatusBar({ status, roundCount, maxRounds, tokenUsage, onAbort }: Props) {
  if (status === "idle" || status === "done") return null;
  const dot =
    status === "error" || status === "aborted" ? "bg-red-500" : "bg-emerald-500 animate-pulse";
  return (
    <div className="border-b border-zinc-800 bg-zinc-900 p-2 text-xs flex items-center gap-2">
      <span className={`w-2 h-2 rounded-full ${dot}`} />
      <span>
        {status === "streaming"
          ? "AI 工作中"
          : status === "awaiting"
          ? "等待审阅"
          : status === "running"
          ? "执行 step"
          : status === "aborted"
          ? "已终止"
          : "出错"}
        {" · "}
        round {roundCount}/{maxRounds}
        {" · "}
        {tokenUsage.input + tokenUsage.output} tokens
      </span>
      <button onClick={onAbort} className="ml-auto px-2 py-0.5 bg-red-800 rounded">
        ⏸ 终止
      </button>
    </div>
  );
}
