import { describe, expect, it, vi, beforeEach } from "vitest";

const listeners: any[] = [];
(globalThis as any).chrome = {
  runtime: {
    sendMessage: vi.fn(),
    onMessage: {
      addListener: vi.fn((cb: any) => listeners.push(cb)),
      removeListener: vi.fn((cb: any) => {
        const i = listeners.indexOf(cb);
        if (i >= 0) listeners.splice(i, 1);
      })
    }
  }
};

describe("widget/store", () => {
  beforeEach(() => { listeners.length = 0; vi.clearAllMocks(); });

  it("startWidgetStoreSync installs subscriber and returns disposer", async () => {
    const m = await import("@/content/widget/store");
    const dispose = m.startWidgetStoreSync();
    expect(listeners.length).toBe(1);
    dispose();
    expect(listeners.length).toBe(0);
  });
});
