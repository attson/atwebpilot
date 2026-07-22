import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { SectionContext } from "@/sidepanel/drawers/settings/section-context";
import { useSettings } from "@/sidepanel/chat/settings-store";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("SectionContext", () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    useSettings.setState({
      model: "gpt-4o",
      contextPolicy: "auto",
      contextSoftCharBudget: 160_000,
      contextRecentMessageLimit: 16,
      contextMemoryCharLimit: 8_000,
      save: vi.fn(async (patch) => useSettings.setState(patch)),
    } as Partial<ReturnType<typeof useSettings.getState>>);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.clearAllMocks();
  });

  it("saves context policy from the settings UI", async () => {
    const save = useSettings.getState().save as ReturnType<typeof vi.fn>;
    await act(async () => {
      root.render(<SectionContext />);
    });

    const select = container.querySelector('select[aria-label="上下文策略"]') as HTMLSelectElement;
    expect(select).toBeTruthy();

    await act(async () => {
      select.value = "large";
      select.dispatchEvent(new Event("change", { bubbles: true }));
      await Promise.resolve();
    });

    expect(save).toHaveBeenCalledWith({ contextPolicy: "large" });
  });

  it("shows custom numeric inputs only for custom policy", async () => {
    await act(async () => {
      root.render(<SectionContext />);
    });
    expect(container.querySelector('input[aria-label="上下文触发阈值"]')).toBeNull();

    const select = container.querySelector('select[aria-label="上下文策略"]') as HTMLSelectElement;
    await act(async () => {
      select.value = "custom";
      select.dispatchEvent(new Event("change", { bubbles: true }));
      await Promise.resolve();
    });

    expect(container.querySelector('input[aria-label="上下文触发阈值"]')).toBeTruthy();
    expect(container.querySelector('input[aria-label="保留最近消息数"]')).toBeTruthy();
    expect(container.querySelector('input[aria-label="记忆摘要上限"]')).toBeTruthy();
  });
});
