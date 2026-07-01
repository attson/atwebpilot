import { Check, X, Loader2, Circle } from "lucide-react";
import type { StepCardState } from "../chat/session-store";
import { labelFor } from "../lib/tool-labels";

type Props = {
  card: StepCardState;
  onExpand: () => void;
};

function StatusIcon({ status }: { status: StepCardState["status"] }) {
  if (status === "ok") return <Check size={12} className="text-emerald-500 shrink-0" />;
  if (status === "error") return <X size={12} className="text-red-500 shrink-0" />;
  if (status === "skipped" || status === "denied")
    return <Circle size={12} className="text-zinc-500 shrink-0" />;
  return <Loader2 size={12} className="text-zinc-400 animate-spin shrink-0" />;
}

export function StepRow({ card, onExpand }: Props) {
  const alias = labelFor(card.name);
  const isError = card.status === "error";
  const isDone = card.status === "ok";
  return (
    <button
      type="button"
      onClick={onExpand}
      className="w-full flex items-center gap-2 px-2 py-1 rounded text-[11px] hover:bg-zinc-800/60 text-left"
    >
      <StatusIcon status={card.status} />
      {alias ? (
        <span className="text-zinc-200 shrink-0">{alias}</span>
      ) : (
        <span className="font-mono text-zinc-400 shrink-0">{card.name}</span>
      )}
      {isError && (
        <span className="text-red-400 truncate min-w-0">
          {card.error ?? "执行失败"}
        </span>
      )}
      {isDone && typeof card.ms === "number" && (
        <span className="ml-auto text-zinc-500 shrink-0">{card.ms}ms</span>
      )}
    </button>
  );
}
