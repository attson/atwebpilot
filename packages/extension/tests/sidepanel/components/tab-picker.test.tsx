import { describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { TabPicker } from "@/sidepanel/components/tab-picker";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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

async function flush(): Promise<void> {
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
}

describe("TabPicker", () => {
  it("loads tabs via injected rpc and groups by windowId", async () => {
    const listTabs = vi.fn(async () => ({
      tabs: [
        { tabId: 1, windowId: 10, url: "https://a", title: "A" },
        { tabId: 2, windowId: 11, url: "https://b", title: "B" }
      ]
    }));
    const { container, cleanup } = mount(
      <TabPicker listTabs={listTabs} attachedIds={[]} currentTabId={null} onSelect={() => {}} onClose={() => {}} />
    );
    await flush();
    expect(container.textContent).toContain("A");
    expect(container.textContent).toMatch(/窗口 10/);
    expect(container.textContent).toMatch(/窗口 11/);
    cleanup();
  });

  it("marks already-attached and current tabs and disables them", async () => {
    const listTabs = vi.fn(async () => ({ tabs: [
      { tabId: 1, windowId: 10, url: "u", title: "Already" },
      { tabId: 2, windowId: 10, url: "u", title: "Current" }
    ] }));
    const { container, cleanup } = mount(
      <TabPicker listTabs={listTabs} attachedIds={[1]} currentTabId={2} onSelect={() => {}} onClose={() => {}} />
    );
    await flush();
    expect(container.querySelector('[data-testid="picker-row-1"]')?.getAttribute("data-disabled")).toBe("true");
    expect(container.querySelector('[data-testid="picker-row-2"]')?.getAttribute("data-disabled")).toBe("true");
    cleanup();
  });

  it("calls onSelect with tab on click", async () => {
    const onSelect = vi.fn();
    const listTabs = vi.fn(async () => ({ tabs: [{ tabId: 3, windowId: 10, url: "u3", title: "T3" }] }));
    const { container, cleanup } = mount(
      <TabPicker listTabs={listTabs} attachedIds={[]} currentTabId={null} onSelect={onSelect} onClose={() => {}} />
    );
    await flush();
    const row = container.querySelector('[data-testid="picker-row-3"]') as HTMLButtonElement;
    act(() => row.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(onSelect).toHaveBeenCalledWith({ tabId: 3, windowId: 10, url: "u3", title: "T3" });
    cleanup();
  });
});
