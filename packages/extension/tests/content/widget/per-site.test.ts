import { describe, expect, it, vi, beforeEach } from "vitest";

const storage: Record<string, any> = {};
(globalThis as any).chrome = {
  storage: {
    local: {
      get: vi.fn(async (keys: string[]) => Object.fromEntries(keys.map(k => [k, storage[k]]))),
      set: vi.fn(async (obj: Record<string, any>) => { Object.assign(storage, obj); })
    }
  }
};

describe("widget/per-site", () => {
  beforeEach(() => { for (const k of Object.keys(storage)) delete storage[k]; vi.clearAllMocks(); });

  it("hideHost + isHostHidden roundtrip", async () => {
    const m = await import("@/content/widget/per-site");
    expect(await m.isHostHidden("a.com")).toBe(false);
    await m.hideHost("a.com");
    expect(await m.isHostHidden("a.com")).toBe(true);
  });

  it("hideHost is idempotent", async () => {
    const m = await import("@/content/widget/per-site");
    await m.hideHost("b.com");
    await m.hideHost("b.com");
    expect(await m.getHiddenHosts()).toEqual(["b.com"]);
  });

  it("fabPos per-host set/get", async () => {
    const m = await import("@/content/widget/per-site");
    await m.setFabPos("x.com", { x: 100, y: 200 });
    expect(await m.getFabPos("x.com")).toEqual({ x: 100, y: 200 });
    expect(await m.getFabPos("other.com")).toBeNull();
  });

  it("panelSize defaults to 320x480 when unset", async () => {
    const m = await import("@/content/widget/per-site");
    expect(await m.getPanelSize()).toEqual({ w: 320, h: 480 });
  });
});
