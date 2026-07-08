import { describe, expect, it, vi, beforeEach } from "vitest";

const listeners: any[] = [];
(globalThis as any).chrome = {
  runtime: {
    sendMessage: vi.fn().mockResolvedValue(undefined),
    onMessage: {
      addListener: vi.fn((cb: any) => listeners.push(cb)),
      removeListener: vi.fn((cb: any) => {
        const i = listeners.indexOf(cb);
        if (i >= 0) listeners.splice(i, 1);
      })
    }
  }
};

describe("session-store broadcast", () => {
  beforeEach(() => {
    listeners.length = 0;
    vi.clearAllMocks();
  });

  it("mutation increments _rev and broadcasts", async () => {
    const store = await import("@/sidepanel/chat/session-store");
    store.ensureSession(1, "https://x/");
    (chrome.runtime.sendMessage as any).mockClear();
    store.appendUserMessage(1, "hello");
    const state = store.useStore.getState().sessionsByTab[1];
    expect(state._rev).toBeGreaterThan(0);
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "session.state.changed",
        tabId: 1,
        snapshot: expect.objectContaining({ _rev: state._rev })
      })
    );
  });

  it("installBroadcastSubscriber applies remote snapshot with higher _rev", async () => {
    const store = await import("@/sidepanel/chat/session-store");
    store.ensureSession(2, "https://y/");
    const dispose = store.installBroadcastSubscriber();
    const higher = { ...store.useStore.getState().sessionsByTab[2], _rev: 999, messages: [{ role: "user", content: "remote" } as any] };
    listeners[0]({ type: "session.state.changed", tabId: 2, snapshot: higher, senderId: "OTHER" }, {}, () => {});
    expect(store.useStore.getState().sessionsByTab[2]._rev).toBe(999);
    dispose();
  });

  it("installBroadcastSubscriber ignores own broadcasts", async () => {
    const store = await import("@/sidepanel/chat/session-store");
    store.ensureSession(3, "https://z/");
    const dispose = store.installBroadcastSubscriber();
    const self = store.SELF_INSTANCE_ID;
    const stale = { ...store.useStore.getState().sessionsByTab[3], _rev: 999 };
    listeners[0]({ type: "session.state.changed", tabId: 3, snapshot: stale, senderId: self }, {}, () => {});
    // ignored — _rev unchanged locally
    expect(store.useStore.getState().sessionsByTab[3]._rev).not.toBe(999);
    dispose();
  });

  it("installBroadcastSubscriber ignores older _rev", async () => {
    const store = await import("@/sidepanel/chat/session-store");
    store.ensureSession(4, "https://w/");
    // bump local rev by mutating
    store.appendUserMessage(4, "one");
    store.appendUserMessage(4, "two");
    const localRev = store.useStore.getState().sessionsByTab[4]._rev;
    const dispose = store.installBroadcastSubscriber();
    const older = { ...store.useStore.getState().sessionsByTab[4], _rev: localRev - 1, messages: [] };
    listeners[0]({ type: "session.state.changed", tabId: 4, snapshot: older, senderId: "OTHER" }, {}, () => {});
    // stayed local
    expect(store.useStore.getState().sessionsByTab[4]._rev).toBe(localRev);
    dispose();
  });
});
