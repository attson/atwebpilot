import type { ChatMessage } from "@atwebpilot/shared/types";

export function MessageBubble(props: { message: ChatMessage }) {
  const m = props.message;
  if (m.role === "user") {
    if (typeof m.content === "string") {
      return (
        <div className="bg-blue-900/40 rounded p-2 text-xs whitespace-pre-wrap">{m.content}</div>
      );
    }
    // Array content: render images + text together (skip tool_result, that's chat history plumbing)
    const images = m.content.filter((c): c is Extract<typeof c, { type: "image" }> => c.type === "image");
    const texts = m.content.filter((c): c is Extract<typeof c, { type: "text" }> => c.type === "text");
    if (images.length === 0 && texts.length === 0) return null;
    return (
      <div className="bg-blue-900/40 rounded p-2 text-xs space-y-1.5">
        {images.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {images.map((img, i) => (
              <img
                key={i}
                src={`data:${img.media_type};base64,${img.data}`}
                alt={`image ${i + 1}`}
                className="max-h-32 rounded border border-blue-800"
              />
            ))}
          </div>
        )}
        {texts.length > 0 && (
          <div className="whitespace-pre-wrap">{texts.map((t) => t.text).join("")}</div>
        )}
      </div>
    );
  }
  const text = m.content
    .filter((c): c is { type: "text"; text: string } => c.type === "text")
    .map((c) => c.text)
    .join("");
  if (!text) return null;
  return (
    <div className="bg-zinc-800/60 rounded p-2 text-xs whitespace-pre-wrap">{text}</div>
  );
}
