import { describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { AttachedTab } from "@webpilot/shared/types";
import { TabChipsBar } from "@/sidepanel/components/tab-chips-bar";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const tab = (id: number, extras: Partial<AttachedTab> = {}): AttachedTab => ({
  tabId: id,
  windowId: 1,
  source: "mention",
  lastSeenUrl: `https://t${id}`,
  lastSeenTitle: `T${id}`,
  addedAt: 0,
  ...extras
});

function mount(node: React.ReactNode): { container: HTMLDivElement; cleanup: () => void } {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(node));
  return {
    container,
    cleanup: () => {
      act(() => root.unmount());
      container.remove();
    }
  };
}

describe("TabChipsBar", () => {
  it("hides itself when empty", () => {
    const { container, cleanup } = mount(
      <TabChipsBar attachedTabs={[]} onDetach={() => {}} onPick={() => {}} />
    );
    expect(container.firstChild).toBeNull();
    cleanup();
  });

  it("renders a chip per attached tab and shows urlChanged warning", () => {
    const { container, cleanup } = mount(
      <TabChipsBar
        attachedTabs={[tab(1), tab(2, { urlChanged: true })]}
        onDetach={() => {}}
        onPick={() => {}}
      />
    );
    expect(container.textContent).toContain("T1");
    expect(container.textContent).toContain("T2");
    expect(container.querySelector('[data-testid="chip-2"]')?.getAttribute("data-url-changed")).toBe("true");
    cleanup();
  });

  it("calls onDetach when × is clicked", () => {
    const onDetach = vi.fn();
    const { container, cleanup } = mount(
      <TabChipsBar attachedTabs={[tab(7)]} onDetach={onDetach} onPick={() => {}} />
    );
    const btn = container.querySelector('button[aria-label="detach 7"]') as HTMLButtonElement;
    act(() => btn.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(onDetach).toHaveBeenCalledWith(7);
    cleanup();
  });

  it("collapses past 8 with +N indicator", () => {
    const many = Array.from({ length: 11 }, (_, i) => tab(100 + i));
    const { container, cleanup } = mount(
      <TabChipsBar attachedTabs={many} onDetach={() => {}} onPick={() => {}} />
    );
    expect(container.textContent).toContain("+3");
    cleanup();
  });

  it("calls onPick when + is clicked", () => {
    const onPick = vi.fn();
    const { container, cleanup } = mount(
      <TabChipsBar attachedTabs={[tab(1)]} onDetach={() => {}} onPick={onPick} />
    );
    const btn = container.querySelector('button[aria-label="add attached tab"]') as HTMLButtonElement;
    act(() => btn.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(onPick).toHaveBeenCalled();
    cleanup();
  });
});
