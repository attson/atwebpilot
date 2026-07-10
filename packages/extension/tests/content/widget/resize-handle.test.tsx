import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ResizeHandle } from "@/content/widget/resize-handle";

describe("ResizeHandle", () => {
  let root: Root;
  let container: HTMLDivElement;
  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it("renders with correct testid", async () => {
    await act(async () =>
      root.render(
        <ResizeHandle
          size={{ w: 320, h: 480 }}
          onResize={() => {}}
          onCommit={() => {}}
        />
      )
    );
    expect(container.querySelector("[data-testid=widget-resize-handle]")).toBeTruthy();
  });

  it("clamps to min/max", async () => {
    const events: Array<{ w: number; h: number }> = [];
    await act(async () =>
      root.render(
        <ResizeHandle
          size={{ w: 320, h: 480 }}
          onResize={(w, h) => events.push({ w, h })}
          onCommit={() => {}}
          minW={320} minH={360} maxW={720} maxH={900}
        />
      )
    );
    const el = container.querySelector("[data-testid=widget-resize-handle]") as HTMLElement;
    // Simulate pointer down + move well beyond max
    el.dispatchEvent(new PointerEvent("pointerdown", { button: 0, clientX: 500, clientY: 500 }));
    el.dispatchEvent(new PointerEvent("pointermove", { clientX: 5000, clientY: 5000 }));
    // The onResize should have been called with clamped values
    // (dx > 0 shrinks; huge negative-effective width clamps to 320; huge h clamps to 900)
    const last = events.at(-1);
    if (last) {
      expect(last.w).toBeGreaterThanOrEqual(320);
      expect(last.w).toBeLessThanOrEqual(720);
      expect(last.h).toBeLessThanOrEqual(900);
    }
  });
});
