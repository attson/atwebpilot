import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MessageBubble } from "@/sidepanel/components/message-bubble";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function mount(node: React.ReactNode) {
  const c = document.createElement("div");
  document.body.appendChild(c);
  const r = createRoot(c);
  act(() => r.render(node));
  return {
    c,
    cleanup: () => {
      act(() => r.unmount());
      c.remove();
    }
  };
}

function stubClipboard() {
  const writeText = vi.fn(async () => undefined);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText }
  });
  return writeText;
}

describe("MessageBubble", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("copies a plain user message", () => {
    const writeText = stubClipboard();
    const { c, cleanup } = mount(
      <MessageBubble message={{ role: "user", content: "hello\nworld" }} />
    );

    const copy = c.querySelector('button[aria-label="复制消息"]') as HTMLButtonElement | null;
    expect(copy).toBeTruthy();
    act(() => copy?.click());

    expect(writeText).toHaveBeenCalledWith("hello\nworld");
    cleanup();
  });
});
