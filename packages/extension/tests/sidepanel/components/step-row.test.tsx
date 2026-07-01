import { describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { StepRow } from "@/sidepanel/components/step-row";
import type { StepCardState } from "@/sidepanel/chat/session-store";

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

function makeCard(overrides: Partial<StepCardState>): StepCardState {
  return {
    toolUseId: "t1",
    name: "takeSnapshot",
    input: {},
    partialJson: "",
    inputReady: true,
    status: "ok",
    ms: 42,
    ...overrides,
  };
}

describe("StepRow", () => {
  it("ok + known alias: shows Chinese alias + ms; no English tool name visible", () => {
    const { c, cleanup } = mount(<StepRow card={makeCard({ name: "takeSnapshot" })} onExpand={() => {}} />);
    expect(c.textContent).toContain("抓页面快照");
    expect(c.textContent).toContain("42ms");
    expect(c.textContent).not.toContain("takeSnapshot");
    cleanup();
  });

  it("ok + unknown alias: falls back to English tool name (font-mono)", () => {
    const { c, cleanup } = mount(
      <StepRow card={makeCard({ name: "someUnknownTool", ms: 7 })} onExpand={() => {}} />
    );
    expect(c.textContent).toContain("someUnknownTool");
    expect(c.textContent).toContain("7ms");
    cleanup();
  });

  it("error: shows alias + error text, no ms", () => {
    const { c, cleanup } = mount(
      <StepRow
        card={makeCard({
          name: "clickByUid",
          status: "error",
          error: "uid el_102 not found",
          ms: 150,
        })}
        onExpand={() => {}}
      />
    );
    expect(c.textContent).toContain("点击元素");
    expect(c.textContent).toContain("uid el_102 not found");
    expect(c.textContent).not.toContain("150ms");
    cleanup();
  });

  it("running: shows spinner icon, no ms", () => {
    const { c, cleanup } = mount(
      <StepRow card={makeCard({ status: "running", ms: undefined })} onExpand={() => {}} />
    );
    // Loader2 icon renders as an SVG; assert its presence via lucide's data-attribute-agnostic class.
    expect(c.querySelector("svg.animate-spin")).toBeTruthy();
    expect(c.textContent ?? "").not.toMatch(/\dms/);
    cleanup();
  });

  it("clicking the row fires onExpand", () => {
    const onExpand = vi.fn();
    const { c, cleanup } = mount(<StepRow card={makeCard({})} onExpand={onExpand} />);
    const btn = c.querySelector("button") as HTMLButtonElement;
    act(() => btn.click());
    expect(onExpand).toHaveBeenCalledTimes(1);
    cleanup();
  });
});
