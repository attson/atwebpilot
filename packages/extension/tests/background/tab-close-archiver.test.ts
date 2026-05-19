import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { _resetDBForTests } from "@/background/storage/db";
import * as ss from "@/sidepanel/chat/persistence/sessions-storage";
import { installTabCloseArchiver } from "@/background/tab-close-archiver";

const URL = "https://example.com";

function stubChromeTabs() {
  const listeners: Array<(tabId: number) => void> = [];
  vi.stubGlobal("chrome", {
    tabs: {
      onRemoved: {
        addListener: (cb: (tabId: number) => void) => listeners.push(cb),
        removeListener: (cb: (tabId: number) => void) => {
          const i = listeners.indexOf(cb);
          if (i >= 0) listeners.splice(i, 1);
        }
      }
    }
  });
  return { fire: (tabId: number) => listeners.forEach((cb) => cb(tabId)) };
}

const EMPTY_DATA = {
  messages: [],
  cards: [],
  executedSteps: [],
  tokenUsage: { input: 0, output: 0 },
  roundCount: 0,
  attachedTabs: [],
  url: URL,
  runRecordId: null,
  errorMessage: null
};

describe("tab-close-archiver", () => {
  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory();
    _resetDBForTests();
  });

  it("on tab close, archives active session with that lastTabId", async () => {
    const { fire } = stubChromeTabs();
    await ss.putSession({
      id: "a",
      url: URL,
      lastTabId: 7,
      status: "active",
      data: EMPTY_DATA,
      createdAt: 0,
      updatedAt: 0
    });
    installTabCloseArchiver();
    fire(7);
    // wait microtask
    await new Promise((r) => setTimeout(r, 10));
    const got = await ss.getById("a");
    expect(got?.status).toBe("archived");
  });

  it("on tab close, runs pruneOverLimit and cascades runs delete", async () => {
    const { fire } = stubChromeTabs();
    // 21 archived rows for the URL with various updatedAt
    for (let i = 0; i < 21; i++) {
      await ss.putSession({
        id: `arc-${i}`,
        url: URL,
        lastTabId: 999,
        status: "archived",
        data: { ...EMPTY_DATA, runRecordId: i === 0 ? "run-evict" : null },
        createdAt: 0,
        updatedAt: i
      });
    }
    // Active row for tabId 7, newest updatedAt
    await ss.putSession({
      id: "active-7",
      url: URL,
      lastTabId: 7,
      status: "active",
      data: EMPTY_DATA,
      createdAt: 0,
      updatedAt: 1000
    });

    installTabCloseArchiver();
    fire(7);
    await new Promise((r) => setTimeout(r, 10));

    const archived = await ss.listArchivedByUrl(URL);
    expect(archived.length).toBe(20);
    expect(archived.find((s) => s.id === "active-7")).toBeDefined(); // newly archived
    expect(archived.find((s) => s.id === "arc-0")).toBeUndefined();  // evicted (oldest)
  });

  it("on tab close with no active session, is a no-op", async () => {
    const { fire } = stubChromeTabs();
    installTabCloseArchiver();
    fire(7);
    await new Promise((r) => setTimeout(r, 10));
    // no throw; no rows created
    expect((await ss.listArchivedByUrl(URL)).length).toBe(0);
  });
});
