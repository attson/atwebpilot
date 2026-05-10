import { useEffect, useRef } from "react";
import { useSession, type StepCardState } from "../chat/session-store";
import { useSettings } from "../chat/settings-store";
import { MessageBubble } from "./message-bubble";
import type { ChatMessage, TextPart, ToolUsePart } from "@/shared/types";
import { autoApproves, classifyTool } from "../chat/severity";
import { AssistantBubble } from "./assistant-bubble";

type Props = {
  onApprove: (id: string, decision: "run" | "skip" | "deny") => void;
};

export function ChatView({ onApprove }: Props) {
  const session = useSession();
  const settings = useSettings();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight });
  }, [
    session.messages.length,
    session.streamingAssistantText,
    session.cards.length,
    session.cards.map((c) => c.status).join(",")
  ]);

  const cardsById = new Map<string, StepCardState>();
  for (const c of session.cards) cardsById.set(c.toolUseId, c);

  function needsApproval(card: StepCardState): boolean {
    if (!card.inputReady) return false;
    return !autoApproves(
      classifyTool(card.name, card.input),
      card.name,
      session.approveAllSafe,
      settings.autoApproveDangerous ?? []
    );
  }

  // finalized 的 assistant turn 已收录的 toolUseIds
  const finalizedIds = new Set<string>();
  for (const m of session.messages) {
    if (m.role !== "assistant") continue;
    for (const c of m.content) if (c.type === "tool_use") finalizedIds.add(c.id);
  }

  // 流式中：尚未 finalize 的 cards（按出现顺序）
  const pendingCards = session.cards.filter((c) => !finalizedIds.has(c.toolUseId));
  const isStreaming =
    session.status === "streaming" ||
    session.status === "awaiting" ||
    session.status === "running";

  return (
    <div ref={ref} className="flex-1 overflow-auto flex flex-col gap-2 p-3">
      {session.messages.map((m, i) => renderMessage(m, i))}
      {isStreaming && (session.streamingAssistantText || pendingCards.length > 0) && (
        <AssistantBubble
          key="live-bubble"
          text={session.streamingAssistantText}
          toolUses={[]}
          pendingCards={pendingCards}
          cardsById={cardsById}
          onApprove={onApprove}
          needsApproval={needsApproval}
          isLive
        />
      )}
      {session.messages.length === 0 && !isStreaming && (
        <div className="text-zinc-500 text-xs text-center mt-8">
          描述要采集什么开始对话…
        </div>
      )}
    </div>
  );

  function renderMessage(m: ChatMessage, i: number) {
    if (m.role === "user") {
      // 跳过 tool_result 注入（只在 chat history 内部有意义，UI 不展示）
      if (typeof m.content !== "string") return null;
      return <MessageBubble key={i} message={m} />;
    }
    const text = m.content
      .filter((c): c is TextPart => c.type === "text")
      .map((c) => c.text)
      .join("");
    const toolUses = m.content.filter((c): c is ToolUsePart => c.type === "tool_use");
    if (!text && toolUses.length === 0) return null;
    return (
      <AssistantBubble
        key={i}
        text={text}
        toolUses={toolUses}
        cardsById={cardsById}
        onApprove={onApprove}
        needsApproval={needsApproval}
        isLive={false}
      />
    );
  }
}
