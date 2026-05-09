import { useEffect, useRef } from "react";
import { useSession } from "../chat/session-store";
import { MessageBubble } from "./message-bubble";
import { StepCard } from "./step-card";
import type { ChatMessage, ToolUsePart } from "@/shared/types";
import { autoApproves, classifyTool } from "../chat/severity";

type Props = {
  onApprove: (id: string, decision: "run" | "skip" | "deny") => void;
};

export function ChatView({ onApprove }: Props) {
  const session = useSession();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight });
  }, [session.messages.length, session.streamingAssistantText, session.cards.length]);

  const items: Array<{ kind: "message"; msg: ChatMessage } | { kind: "card"; cardId: string }> =
    [];
  for (const m of session.messages) {
    items.push({ kind: "message", msg: m });
    if (m.role === "assistant") {
      const toolUses = m.content.filter((c): c is ToolUsePart => c.type === "tool_use");
      for (const tu of toolUses) items.push({ kind: "card", cardId: tu.id });
    }
  }
  if (session.streamingAssistantText) {
    items.push({
      kind: "message",
      msg: {
        role: "assistant",
        content: [{ type: "text", text: session.streamingAssistantText }]
      }
    });
  }
  const finalizedIds = new Set(
    session.messages
      .filter((m): m is Extract<ChatMessage, { role: "assistant" }> => m.role === "assistant")
      .flatMap((m) => m.content.filter((c): c is ToolUsePart => c.type === "tool_use"))
      .map((c) => c.id)
  );
  for (const card of session.cards) {
    if (
      !finalizedIds.has(card.toolUseId) &&
      !items.some((i) => i.kind === "card" && i.cardId === card.toolUseId)
    ) {
      items.push({ kind: "card", cardId: card.toolUseId });
    }
  }

  return (
    <div ref={ref} className="flex-1 overflow-auto flex flex-col gap-2 p-3">
      {items.map((it, i) => {
        if (it.kind === "message") return <MessageBubble key={i} message={it.msg} />;
        const card = session.cards.find((c) => c.toolUseId === it.cardId);
        if (!card) return null;
        const sev = card.inputReady ? classifyTool(card.name, card.input) : "safe";
        const needs = !autoApproves(sev, session.approveAllSafe);
        return <StepCard key={card.toolUseId} card={card} onApprove={onApprove} needsManualApproval={needs} />;
      })}
    </div>
  );
}
