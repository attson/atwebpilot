import { describe, expect, it, vi, beforeEach } from "vitest";

const storage: Record<string, any> = { "caiji.llm": { widgetEnabled: true } };
(globalThis as any).chrome = {
  storage: {
    local: {
      get: vi.fn(async (keys: string[]) => Object.fromEntries(keys.map(k => [k, storage[k]]))),
      set: vi.fn(async () => {})
    }
  },
  runtime: {
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn()
    }
  }
};

describe("mountWidget", () => {
  beforeEach(() => {
    document.documentElement.innerHTML = "<head></head><body></body>";
    for (const k of Object.keys(storage)) if (k !== "caiji.llm") delete storage[k];
    storage["caiji.llm"] = { widgetEnabled: true };
    vi.clearAllMocks();
  });

  it("creates <atwebpilot-widget> element on top window", async () => {
    const { mountWidget } = await import("@/content/widget/mount");
    await mountWidget();
    const el = document.querySelector("atwebpilot-widget");
    expect(el).toBeTruthy();
    expect(el?.shadowRoot).toBeTruthy();
  });

  it("does NOT mount when widgetEnabled=false", async () => {
    storage["caiji.llm"] = { widgetEnabled: false };
    const { mountWidget } = await import("@/content/widget/mount");
    await mountWidget();
    expect(document.querySelector("atwebpilot-widget")).toBeNull();
  });

  it("does NOT mount when host is in hiddenHosts", async () => {
    storage["caiji.widget.hiddenHosts"] = [location.host];
    const { mountWidget } = await import("@/content/widget/mount");
    await mountWidget();
    expect(document.querySelector("atwebpilot-widget")).toBeNull();
  });

  it("mounts only once when called twice", async () => {
    const { mountWidget } = await import("@/content/widget/mount");
    await mountWidget();
    await mountWidget();
    expect(document.querySelectorAll("atwebpilot-widget").length).toBe(1);
  });
});
