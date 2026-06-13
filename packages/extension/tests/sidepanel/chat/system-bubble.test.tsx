import { describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { SystemBubble } from "@/sidepanel/chat/system-bubble";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function mount(node: React.ReactNode) {
  const c = document.createElement("div");
  document.body.appendChild(c);
  const r = createRoot(c);
  act(() => r.render(node));
  return { c, cleanup: () => { act(() => r.unmount()); c.remove(); } };
}

describe("SystemBubble", () => {
  it("renders the children with kind-specific data-attribute", () => {
    const { c, cleanup } = mount(<SystemBubble kind="error">boom</SystemBubble>);
    const el = c.querySelector('[data-kind="error"]') as HTMLElement;
    expect(el).toBeTruthy();
    expect(el.textContent).toContain("boom");
    cleanup();
  });

  it("warning + navigation get their own data-kind", () => {
    let { c, cleanup } = mount(<SystemBubble kind="warning">w</SystemBubble>);
    expect(c.querySelector('[data-kind="warning"]')).toBeTruthy();
    cleanup();
    ({ c, cleanup } = mount(<SystemBubble kind="navigation">n</SystemBubble>));
    expect(c.querySelector('[data-kind="navigation"]')).toBeTruthy();
    cleanup();
  });

  it("becomes a button when onClick is provided", () => {
    const onClick = vi.fn();
    const { c, cleanup } = mount(<SystemBubble kind="error" onClick={onClick}>x</SystemBubble>);
    const btn = c.querySelector('button[data-kind="error"]') as HTMLButtonElement;
    expect(btn).toBeTruthy();
    act(() => btn.click());
    expect(onClick).toHaveBeenCalled();
    cleanup();
  });
});
