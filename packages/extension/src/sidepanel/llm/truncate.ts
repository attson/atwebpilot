import type { ChatMessage, TextPart, ToolResultPart, ToolUsePart } from "@atwebpilot/shared/types";

export function truncateContent(s: string, cap: number): string {
  if (s.length <= cap) return s;
  const half = Math.floor(cap / 2);
  const head = s.slice(0, half);
  const tail = s.slice(s.length - half);
  return `${head}\n…[截断 ${s.length - cap} 字]…\n${tail}`;
}

export function truncateMessages(messages: ChatMessage[], cap: number): ChatMessage[] {
  return messages.map((m): ChatMessage => {
    if (m.role === "user") {
      if (typeof m.content === "string") {
        return { role: "user", content: truncateContent(m.content, cap) };
      }
      const content = m.content.map((part): TextPart | ToolResultPart => {
        if (part.type === "text") return { ...part, text: truncateContent(part.text, cap) };
        return typeof part.content === "string"
          ? { ...part, content: truncateContent(part.content, cap) }
          : part;
      });
      return { role: "user", content };
    }
    const content = m.content.map((part): TextPart | ToolUsePart =>
      part.type === "text" ? { ...part, text: truncateContent(part.text, cap) } : part
    );
    return { role: "assistant", content };
  });
}
