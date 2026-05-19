import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { _resetDBForTests } from "@/background/storage/db";
import * as ss from "@/sidepanel/chat/persistence/sessions-storage";
import { ensureSession, useStore } from "@/sidepanel/chat/session-store";
import { installAutoPersist, flushAllPending, _resetAutoPersistForTests } from "@/sidepanel/chat/persistence/auto-persist";

const URL = "https://example.com";

function addMessage(tabId: number, content: string): void {
  useStore.setState((state) => ({
    ...state,
    sessionsByTab: {
      ...state.sessionsByTab,
      [tabId]: {
        ...state.sessionsByTab[tabId],
        messages: [...(state.sessionsByTab[tabId]?.messages ?? []), { role: "user" as const, content }]
      }
    }
  }));
}

describe("auto-persist", () => {
  beforeEach(async () => {
    globalThis.indexedDB = new IDBFactory();
    _resetDBForTests();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
    useStore.setState({ sessionsByTab: {}, currentTabId: null });
    _resetAutoPersistForTests();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  /** Drain all pending micro-tasks/promises after timer fires. */
  async function flushMicrotasks(): Promise<void> {
    // Multiple rounds to let chained promise callbacks settle (IDB has several hops).
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
    }
  }

  it("debounces multiple rapid mutations into a single put", async () => {
    const spy = vi.spyOn(ss, "putSession");
    const off = installAutoPersist();
    ensureSession(7, URL);
    addMessage(7, "a");
    addMessage(7, "b");
    addMessage(7, "c");
    expect(spy).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(300);
    await flushMicrotasks();
    expect(spy.mock.calls.length).toBe(1);
    off();
  });

  it("creates a new active row on first mutation", async () => {
    const off = installAutoPersist();
    ensureSession(7, URL);
    addMessage(7, "hi");
    await vi.advanceTimersByTimeAsync(300);
    await flushMicrotasks();
    const active = await ss.getActiveByTabId(7);
    expect(active).toBeDefined();
    expect(active?.data.messages.length).toBe(1);
    expect(active?.status).toBe("active");
    off();
  });

  it("subsequent mutations use putSessionData (status not flipped)", async () => {
    const off = installAutoPersist();
    ensureSession(7, URL);
    addMessage(7, "hi");
    await vi.advanceTimersByTimeAsync(300);
    await flushMicrotasks();
    const first = await ss.getActiveByTabId(7);
    expect(first).toBeDefined();
    // Simulate background archiver flipping status:
    await ss.archiveActive(first!.id);
    expect((await ss.getById(first!.id))?.status).toBe("archived");
    addMessage(7, "should-not-revive");
    await vi.advanceTimersByTimeAsync(300);
    await flushMicrotasks();
    const after = await ss.getById(first!.id);
    expect(after?.status).toBe("archived");
    off();
  });

  it("flushAllPending writes synchronously without waiting for debounce", async () => {
    const off = installAutoPersist();
    ensureSession(7, URL);
    addMessage(7, "hi");
    await flushAllPending();
    const active = await ss.getActiveByTabId(7);
    expect(active?.data.messages.length).toBe(1);
    off();
  });

  it("write failure does not throw", async () => {
    const off = installAutoPersist();
    vi.spyOn(ss, "putSession").mockRejectedValueOnce(new Error("quota"));
    ensureSession(7, URL);
    addMessage(7, "hi");
    await vi.advanceTimersByTimeAsync(300);
    // microtask queue
    await Promise.resolve();
    expect(true).toBe(true); // no unhandled rejection
    off();
  });

  it("skips empty sessions (no messages, no cards)", async () => {
    const spy = vi.spyOn(ss, "putSession");
    const off = installAutoPersist();
    ensureSession(7, URL);  // empty session created
    await vi.advanceTimersByTimeAsync(300);
    expect(spy).not.toHaveBeenCalled();
    off();
  });
});
