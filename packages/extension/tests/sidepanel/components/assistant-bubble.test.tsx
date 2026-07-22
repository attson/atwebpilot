import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { AssistantBubble } from "@/sidepanel/components/assistant-bubble";
import { makeEmptySession, useStore } from "@/sidepanel/chat/session-store";

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

describe("AssistantBubble", () => {
  beforeEach(() => {
    useStore.setState({
      currentTabId: 1,
      sessionsByTab: { 1: makeEmptySession(1, "https://example.test") }
    });
  });

  afterEach(() => {
    useStore.setState({ currentTabId: null, sessionsByTab: {} });
    vi.restoreAllMocks();
  });

  it("shows a visible copy button for finalized assistant text", () => {
    const writeText = stubClipboard();
    const { c, cleanup } = mount(
      <AssistantBubble
        text="answer"
        toolUses={[]}
        cardsById={new Map()}
        onApprove={() => {}}
        needsApproval={() => false}
        isLive={false}
      />
    );

    const actions = c.querySelector('[data-testid="message-actions"]');
    expect(actions?.className).not.toContain("opacity-0");
    const copy = c.querySelector('button[aria-label="复制消息"]') as HTMLButtonElement | null;
    expect(copy).toBeTruthy();

    act(() => copy?.click());
    expect(writeText).toHaveBeenCalledWith("answer");
    cleanup();
  });

  it("renders markdown task lists instead of raw checkbox syntax", () => {
    const { c, cleanup } = mount(
      <AssistantBubble
        text={"### TODO\n- [x] 已读取页面\n- [ ] 输出结构化结果\n\n`selector`"}
        toolUses={[]}
        cardsById={new Map()}
        onApprove={() => {}}
        needsApproval={() => false}
        isLive={false}
      />
    );

    expect(c.querySelector("h3")?.textContent).toBe("TODO");
    const boxes = c.querySelectorAll('input[type="checkbox"]');
    expect(boxes).toHaveLength(2);
    expect((boxes[0] as HTMLInputElement).checked).toBe(true);
    expect((boxes[1] as HTMLInputElement).checked).toBe(false);
    expect(c.textContent).not.toContain("- [x]");
    expect(c.querySelector("code")?.textContent).toBe("selector");
    cleanup();
  });
});
