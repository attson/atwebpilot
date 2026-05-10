import { useState } from "react";
import type { ToolUsePart } from "@/shared/types";
import type { StepCardState } from "../chat/session-store";
import { StepCard } from "./step-card";

type Props = {
  text: string;
  toolUses: ToolUsePart[];        // finalized 的（来自 messages）
  pendingCards?: StepCardState[]; // 流式中尚未 finalize 的 cards
  cardsById: Map<string, StepCardState>;
  onApprove: (id: string, decision: "run" | "skip" | "deny") => void;
  needsApproval: (card: StepCardState) => boolean;
  isLive: boolean;                 // 是否当前流式中（影响默认折叠）
};

export function AssistantBubble({
  text,
  toolUses,
  pendingCards = [],
  cardsById,
  onApprove,
  needsApproval,
  isLive
}: Props) {
  const allCards: StepCardState[] = [];
  for (const tu of toolUses) {
    const c = cardsById.get(tu.id);
    if (c) allCards.push(c);
  }
  for (const c of pendingCards) allCards.push(c);

  const hasAwaiting = allCards.some(
    (c) => (c.status === "awaiting" && needsApproval(c)) || c.status === "running"
  );
  const [open, setOpen] = useState<boolean>(isLive || hasAwaiting);

  const summary =
    allCards.length === 0
      ? null
      : (() => {
          const done = allCards.filter((c) => c.status === "ok").length;
          const errs = allCards.filter((c) => c.status === "error").length;
          const wait = allCards.filter(
            (c) => c.status === "awaiting" && needsApproval(c)
          ).length;
          const pieces = [`${allCards.length} 次工具调用`];
          if (done) pieces.push(`✓${done}`);
          if (errs) pieces.push(`✗${errs}`);
          if (wait) pieces.push(`待审 ${wait}`);
          return pieces.join(" · ");
        })();

  // 若有待审 / 出错 / 流式中，强制展开
  const effectiveOpen = open || hasAwaiting || isLive;

  return (
    <div className="bg-zinc-800/60 rounded p-2 text-xs flex flex-col gap-2">
      {allCards.length > 0 && (
        <div className="flex flex-col gap-1">
          <button
            onClick={() => setOpen(!open)}
            className="self-start text-[11px] text-zinc-400 hover:text-zinc-200 flex items-center gap-1"
          >
            <span>{effectiveOpen ? "▾" : "▸"}</span>
            <span>{summary}</span>
          </button>
          {effectiveOpen && (
            <div className="flex flex-col gap-1 pl-3 border-l-2 border-zinc-700">
              {allCards.map((card) => (
                <StepCard
                  key={card.toolUseId}
                  card={card}
                  onApprove={onApprove}
                  needsManualApproval={needsApproval(card)}
                />
              ))}
            </div>
          )}
        </div>
      )}
      {text && <div className="whitespace-pre-wrap">{text}</div>}
    </div>
  );
}
