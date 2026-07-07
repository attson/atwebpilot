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
  return { c, cleanup: () => { act(() => r.unmount()); c.remove(); } };
}

describe("QuickActions URL-conditional prompt preset", () => {
  it("shows wikipedia prompt when url matches", () => {
    const { c, cleanup } = mount(
      <QuickActions currentUrl="https://en.wikipedia.org/wiki/Rust" onPick={vi.fn()} />
    );
    const labels = [...c.querySelectorAll("button")].map((b) => b.textContent);
    expect(labels.some((l) => l?.includes("维基百科总结"))).toBe(true);
    cleanup();
  });

  it("falls back to defaults (or generic preset) when url does not match specific preset", () => {
    const { c, cleanup } = mount(
      <QuickActions currentUrl="https://unknown.site" onPick={vi.fn()} />
    );
    // article-translate-zh (https://**) matches all https — expect its label or a DEFAULTS label
    const labels = [...c.querySelectorAll("button")].map((b) => b.textContent ?? "");
    expect(labels.some((l) => /翻译|总结|重点|评论/.test(l))).toBe(true);
    cleanup();
  });
});
