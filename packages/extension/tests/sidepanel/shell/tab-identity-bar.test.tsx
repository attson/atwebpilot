import { describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { TabIdentityBar } from "@/sidepanel/shell/tab-identity-bar";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function mount(node: React.ReactNode) {
  const c = document.createElement("div");
  document.body.appendChild(c);
  const r = createRoot(c);
  act(() => r.render(node));
  return { c, cleanup: () => { act(() => r.unmount()); c.remove(); } };
}

describe("TabIdentityBar", () => {
  it("shows truncated URL and Tab id", () => {
    const longUrl = "https://very.long.example.com/some/path/to/a/resource/that/exceeds";
    const { c, cleanup } = mount(
      <TabIdentityBar tabId={142} url={longUrl} status="idle" recoverable={false} />
    );
    expect(c.textContent).toContain("Tab #142");
    expect(c.textContent?.includes("…")).toBe(true);
    cleanup();
  });

  it("status dot reflects the session status", () => {
    const { c, cleanup } = mount(
      <TabIdentityBar tabId={1} url="https://x" status="streaming" recoverable={false} />
    );
    const dot = c.querySelector('[aria-label="status-streaming"]');
    expect(dot).toBeTruthy();
    cleanup();
  });

  it("renders [恢复 →] only when recoverable + onRecover provided", () => {
    const onRecover = vi.fn();
    const { c, cleanup } = mount(
      <TabIdentityBar tabId={1} url="https://x" status="idle" recoverable onRecover={onRecover} />
    );
    const btn = Array.from(c.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("恢复")
    ) as HTMLButtonElement | undefined;
    expect(btn).toBeTruthy();
    act(() => btn?.click());
    expect(onRecover).toHaveBeenCalled();
    cleanup();
  });

  it("does NOT render recover link when recoverable=false", () => {
    const { c, cleanup } = mount(
      <TabIdentityBar tabId={1} url="https://x" status="idle" recoverable={false} />
    );
    expect(c.textContent).not.toContain("恢复");
    cleanup();
  });
});
