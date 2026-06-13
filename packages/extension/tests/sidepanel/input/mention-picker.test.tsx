import { describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MentionPicker, type MentionTabOption } from "@/sidepanel/input/mention-picker";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function mount(node: React.ReactNode) {
  const c = document.createElement("div");
  document.body.appendChild(c);
  const r = createRoot(c);
  act(() => r.render(node));
  return { c, cleanup: () => { act(() => r.unmount()); c.remove(); } };
}

const t = (id: number, extras: Partial<MentionTabOption> = {}): MentionTabOption => ({
  tabId: id,
  title: `T${id}`,
  url: `https://t${id}`,
  ...extras,
});

describe("MentionPicker", () => {
  it("renders a row per option", () => {
    const { c, cleanup } = mount(
      <MentionPicker tabs={[t(1), t(2)]} onPick={() => {}} onClose={() => {}} />
    );
    expect(c.querySelector('[data-testid="mention-opt-1"]')).toBeTruthy();
    expect(c.querySelector('[data-testid="mention-opt-2"]')).toBeTruthy();
    cleanup();
  });

  it("clicking an option invokes onPick", () => {
    const onPick = vi.fn();
    const { c, cleanup } = mount(
      <MentionPicker tabs={[t(5)]} onPick={onPick} onClose={() => {}} />
    );
    const btn = c.querySelector('[data-testid="mention-opt-5"]') as HTMLButtonElement;
    act(() => btn.click());
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ tabId: 5 }));
    cleanup();
  });

  it("ArrowDown + Enter picks the next option", () => {
    const onPick = vi.fn();
    const { cleanup } = mount(
      <MentionPicker tabs={[t(1), t(2)]} onPick={onPick} onClose={() => {}} />
    );
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
    });
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    });
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ tabId: 2 }));
    cleanup();
  });

  it("Escape invokes onClose", () => {
    const onClose = vi.fn();
    const { cleanup } = mount(
      <MentionPicker tabs={[t(1)]} onPick={() => {}} onClose={onClose} />
    );
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(onClose).toHaveBeenCalled();
    cleanup();
  });

  it("empty state shows '没有可挂载的 tab'", () => {
    const { c, cleanup } = mount(
      <MentionPicker tabs={[]} onPick={() => {}} onClose={() => {}} />
    );
    expect(c.textContent).toContain("没有可挂载的 tab");
    cleanup();
  });
});
