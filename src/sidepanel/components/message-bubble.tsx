import type { ChatMessage } from "@/shared/types";

export function MessageBubble(props: { message: ChatMessage }) {
  const m = props.message;
  if (m.role === "user") {
    if (typeof m.content === "string") {
      return (
        <div className="bg-blue-900/40 rounded p-2 text-xs whitespace-pre-wrap">
          {m.content}
        </div>
      );
    }
    return null;
  }
  const text = m.content
    .filter((c): c is { type: "text"; text: string } => c.type === "text")
    .map((c) => c.text)
    .join("");
  if (!text) return null;
  return (
    <div className="bg-zinc-800/60 rounded p-2 text-xs whitespace-pre-wrap">
      {text}
    </div>
  );
}
