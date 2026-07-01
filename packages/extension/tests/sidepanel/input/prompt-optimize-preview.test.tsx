import { describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { PromptOptimizePreview } from "@/sidepanel/input/prompt-optimize-preview";

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

const NOOP = () => {};

describe("PromptOptimizePreview", () => {
  it("renders optimized text and 3 action buttons in success state", () => {
    const { c, cleanup } = mount(
      <PromptOptimizePreview
        original="原文"
        optimized="优化后"
        loading={false}
        onAccept={NOOP}
        onRegenerate={NOOP}
        onDiscard={NOOP}
      />
    );
    expect(c.textContent).toContain("优化后");
    const btns = [...c.querySelectorAll("button")].map((b) => b.textContent ?? "");
    expect(btns.some((t) => t.includes("接受"))).toBe(true);
    expect(btns.some((t) => t.includes("重新生成"))).toBe(true);
    expect(btns.some((t) => t.includes("弃用"))).toBe(true);
    cleanup();
  });

  it("clicking 接受 fires onAccept", () => {
    const onAccept = vi.fn();
    const { c, cleanup } = mount(
      <PromptOptimizePreview
        original="a"
        optimized="b"
        loading={false}
        onAccept={onAccept}
        onRegenerate={NOOP}
        onDiscard={NOOP}
      />
    );
    const btn = [...c.querySelectorAll("button")].find((b) =>
      (b.textContent ?? "").includes("接受")
    ) as HTMLButtonElement;
    act(() => btn.click());
    expect(onAccept).toHaveBeenCalledTimes(1);
    cleanup();
  });

  it("Enter key fires onAccept when optimized present", () => {
    const onAccept = vi.fn();
    const { c, cleanup } = mount(
      <PromptOptimizePreview
        original="a"
        optimized="b"
        loading={false}
        onAccept={onAccept}
        onRegenerate={NOOP}
        onDiscard={NOOP}
      />
    );
    const panel = c.firstElementChild as HTMLElement;
    act(() => {
      panel.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
      );
    });
    expect(onAccept).toHaveBeenCalledTimes(1);
    cleanup();
  });

  it("Escape key fires onDiscard", () => {
    const onDiscard = vi.fn();
    const { c, cleanup } = mount(
      <PromptOptimizePreview
        original="a"
        optimized="b"
        loading={false}
        onAccept={NOOP}
        onRegenerate={NOOP}
        onDiscard={onDiscard}
      />
    );
    const panel = c.firstElementChild as HTMLElement;
    act(() => {
      panel.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
      );
    });
    expect(onDiscard).toHaveBeenCalledTimes(1);
    cleanup();
  });

  it("Enter is a no-op when loading (optimized still absent)", () => {
    const onAccept = vi.fn();
    const { c, cleanup } = mount(
      <PromptOptimizePreview
        original="a"
        loading={true}
        onAccept={onAccept}
        onRegenerate={NOOP}
        onDiscard={NOOP}
      />
    );
    const panel = c.firstElementChild as HTMLElement;
    act(() => {
      panel.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
      );
    });
    expect(onAccept).not.toHaveBeenCalled();
    cleanup();
  });

  it("error state shows retry button only + error text; Enter/接受 absent", () => {
    const onRegen = vi.fn();
    const { c, cleanup } = mount(
      <PromptOptimizePreview
        original="a"
        error="429 rate limit"
        loading={false}
        onAccept={NOOP}
        onRegenerate={onRegen}
        onDiscard={NOOP}
      />
    );
    expect(c.textContent).toContain("429 rate limit");
    const btns = [...c.querySelectorAll("button")].map((b) => b.textContent ?? "");
    expect(btns.some((t) => t.includes("接受"))).toBe(false);
    const retry = [...c.querySelectorAll("button")].find((b) =>
      (b.textContent ?? "").includes("重试")
    ) as HTMLButtonElement;
    expect(retry).toBeTruthy();
    act(() => retry.click());
    expect(onRegen).toHaveBeenCalledTimes(1);
    cleanup();
  });
});
