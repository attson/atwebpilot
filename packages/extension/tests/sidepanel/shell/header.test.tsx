import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { Header } from "@/sidepanel/shell/header";
import { useUi } from "@/sidepanel/chat/ui-store";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  useUi.getState().close();
});

function mount(node: React.ReactNode) {
  const c = document.createElement("div");
  document.body.appendChild(c);
  const r = createRoot(c);
  act(() => r.render(node));
  return { c, cleanup: () => { act(() => r.unmount()); c.remove(); } };
}

function click(c: HTMLElement, label: string) {
  const btn = c.querySelector(`button[aria-label="${label}"]`) as HTMLButtonElement | null;
  if (!btn) throw new Error(`no button labelled ${label}`);
  act(() => btn.click());
}

const defaultProps = {
  chatMode: "compact" as const,
  onToggleChatMode: () => {},
};

describe("Header", () => {
  it("renders 5 icon buttons", () => {
    const { c, cleanup } = mount(<Header debugBadge={null} onNewChat={() => {}} {...defaultProps} />);
    for (const label of ["新会话", "历史", "工具库", "设置", "调试"]) {
      expect(c.querySelector(`button[aria-label="${label}"]`)).toBeTruthy();
    }
    cleanup();
  });

  it("clicking each drawer button opens the matching drawer", () => {
    const { c, cleanup } = mount(<Header debugBadge={null} onNewChat={() => {}} {...defaultProps} />);
    click(c, "历史");
    expect(useUi.getState().openedDrawer).toBe("history");
    click(c, "工具库");
    expect(useUi.getState().openedDrawer).toBe("tools");
    click(c, "设置");
    expect(useUi.getState().openedDrawer).toBe("settings");
    click(c, "调试");
    expect(useUi.getState().openedDrawer).toBe("debug");
    cleanup();
  });

  it("New chat button invokes onNewChat", () => {
    const onNewChat = vi.fn();
    const { c, cleanup } = mount(<Header debugBadge={null} onNewChat={onNewChat} {...defaultProps} />);
    click(c, "新会话");
    expect(onNewChat).toHaveBeenCalled();
    cleanup();
  });

  it("error badge → red dot", () => {
    const { c, cleanup } = mount(
      <Header debugBadge={{ kind: "error", count: 1 }} onNewChat={() => {}} {...defaultProps} />
    );
    const dot = c.querySelector('[data-testid="badge-调试"]') as HTMLElement;
    expect(dot.className).toContain("bg-red-500");
    cleanup();
  });

  it("exchange badge → amber dot", () => {
    const { c, cleanup } = mount(
      <Header debugBadge={{ kind: "exchange", count: 2 }} onNewChat={() => {}} {...defaultProps} />
    );
    const dot = c.querySelector('[data-testid="badge-调试"]') as HTMLElement;
    expect(dot.className).toContain("bg-amber-500");
    cleanup();
  });

  it("log badge → blue dot", () => {
    const { c, cleanup } = mount(
      <Header debugBadge={{ kind: "log", count: 3 }} onNewChat={() => {}} {...defaultProps} />
    );
    const dot = c.querySelector('[data-testid="badge-调试"]') as HTMLElement;
    expect(dot.className).toContain("bg-blue-500");
    cleanup();
  });

  it("no badge dot when debugBadge is null", () => {
    const { c, cleanup } = mount(<Header debugBadge={null} onNewChat={() => {}} {...defaultProps} />);
    expect(c.querySelector('[data-testid="badge-调试"]')).toBeNull();
    cleanup();
  });
});
