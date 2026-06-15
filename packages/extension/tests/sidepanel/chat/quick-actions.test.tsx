import { describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { QuickActions } from "@/sidepanel/chat/quick-actions";

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
    },
  };
}

describe("QuickActions", () => {
  it("renders 3 chips with expected labels in order", () => {
    const { c, cleanup } = mount(<QuickActions onPick={() => {}} />);
    const buttons = c.querySelectorAll("button");
    expect(buttons.length).toBe(3);
    expect([...buttons].map((b) => b.textContent)).toEqual([
      "总结网页",
      "抽取重点",
      "抽评论",
    ]);
    cleanup();
  });

  it("calls onPick with the summarize prompt", () => {
    const onPick = vi.fn();
    const { c, cleanup } = mount(<QuickActions onPick={onPick} />);
    const btn = c.querySelectorAll("button")[0] as HTMLButtonElement;
    act(() => {
      btn.click();
    });
    expect(onPick).toHaveBeenCalledOnce();
    expect(onPick.mock.calls[0][0] as string).toContain("总结");
    cleanup();
  });

  it("calls onPick with the key-points prompt mentioning 5 items", () => {
    const onPick = vi.fn();
    const { c, cleanup } = mount(<QuickActions onPick={onPick} />);
    const btn = c.querySelectorAll("button")[1] as HTMLButtonElement;
    act(() => {
      btn.click();
    });
    const arg = onPick.mock.calls[0][0] as string;
    expect(arg).toContain("关键");
    expect(arg).toContain("5");
    cleanup();
  });

  it("calls onPick with the extract-comments prompt mentioning pagination", () => {
    const onPick = vi.fn();
    const { c, cleanup } = mount(<QuickActions onPick={onPick} />);
    const btn = c.querySelectorAll("button")[2] as HTMLButtonElement;
    act(() => {
      btn.click();
    });
    const arg = onPick.mock.calls[0][0] as string;
    expect(arg).toContain("评论");
    expect(arg).toMatch(/翻页|滚动/);
    cleanup();
  });
});
