import { Sparkles, Loader2 } from "lucide-react";

type Props = {
  status: "idle" | "loading" | "error";
  disabled: boolean;
  onClick: () => void;
};

export function PromptOptimizeButton({ status, disabled, onClick }: Props) {
  const iconCls =
    status === "error"
      ? "text-red-400 hover:text-red-300"
      : disabled
        ? "text-zinc-700"
        : "text-zinc-500 hover:text-zinc-200";
  return (
    <button
      type="button"
      aria-label="优化提示词"
      title={status === "error" ? "点击重试" : "让 AI 帮你把草稿写清楚"}
      disabled={disabled || status === "loading"}
      onClick={onClick}
      className={`absolute bottom-1.5 right-1.5 p-1 ${iconCls}`}
    >
      {status === "loading" ? (
        <Loader2 size={14} className="animate-spin" />
      ) : (
        <Sparkles size={14} />
      )}
    </button>
  );
}
