import { describe, expect, it, vi } from "vitest";
import { scroll } from "@/content/tools/scroll";

describe("scroll", () => {
  it("scrolls to a numeric y", async () => {
    let last = 0;
    vi.spyOn(window, "scrollTo").mockImplementation(((opts: ScrollToOptions) => {
      last = opts.top ?? 0;
    }) as typeof window.scrollTo);
    const r = await scroll({ to: 200 });
    expect(last).toBe(200);
    expect((r as Record<string, unknown>).iterations).toBe(1);
  });

  it("scrolls to bottom up to max iterations", async () => {
    let y = 0;
    Object.defineProperty(document.documentElement, "scrollHeight", {
      configurable: true,
      get: () => y + 1000
    });
    vi.spyOn(window, "scrollTo").mockImplementation(((opts: ScrollToOptions) => {
      y = opts.top ?? 0;
    }) as typeof window.scrollTo);
    const r = (await scroll({ to: "bottom", max: 3, intervalMs: 1 })) as Record<string, unknown>;
    expect(r.iterations).toBe(3);
  });

  it("stops when untilSelector appears", async () => {
    vi.spyOn(window, "scrollTo").mockImplementation((() => {}) as typeof window.scrollTo);
    let appeared = false;
    vi.spyOn(document, "querySelector").mockImplementation(() =>
      appeared ? document.createElement("div") : null
    );
    setTimeout(() => {
      appeared = true;
    }, 5);
    const r = (await scroll({
      to: "bottom",
      max: 100,
      intervalMs: 1,
      untilSelector: ".loaded"
    })) as Record<string, unknown>;
    expect(r.iterations).toBeLessThan(100);
    expect(r.foundUntil).toBe(true);
  });
});
