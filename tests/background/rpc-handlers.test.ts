import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleRpc } from "@/background/rpc-handlers";
import { _resetDBForTests } from "@/background/storage/db";
import { saveDraft } from "@/background/storage/tools";

vi.stubGlobal("chrome", {
  tabs: {
    get: vi.fn(async () => ({ id: 1, url: "https://example.com/" })),
    sendMessage: vi.fn()
  }
});

describe("rpc handlers tool kinds", () => {
  beforeEach(() => {
    _resetDBForTests();
    indexedDB = new IDBFactory();
    vi.clearAllMocks();
  });

  it("saves prompt drafts", async () => {
    const res = await handleRpc({
      type: "tools.save",
      draft: {
        kind: "prompt",
        name: "Prompt",
        urlPatterns: ["https://example.com/**"],
        description: "",
        prompt: "请总结当前页"
      }
    });

    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data).toMatchObject({ kind: "prompt", prompt: "请总结当前页" });
  });

  it("rejects running prompt tools in background runner", async () => {
    const tool = await saveDraft({
      kind: "prompt",
      name: "Prompt",
      urlPatterns: ["https://example.com/**"],
      description: "",
      prompt: "请总结当前页"
    });

    const res = await handleRpc({ type: "runs.start", target: { kind: "tool", id: tool.id }, tabId: 1 });

    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain("prompt tools run in chat");
  });
});

describe("tabs.list", () => {
  it("returns tabs across windows, excluding chrome:// and incognito", async () => {
    vi.stubGlobal("chrome", {
      tabs: {
        get: vi.fn(),
        sendMessage: vi.fn(),
        query: vi.fn(async () => [
          { id: 1, windowId: 10, url: "https://a.com/x", title: "A", incognito: false },
          { id: 2, windowId: 10, url: "chrome://flags", title: "F", incognito: false },
          { id: 3, windowId: 11, url: "https://b.com",  title: "B", incognito: true },
          { id: 4, windowId: 11, url: "about:blank",    title: "",  incognito: false },
          { id: 5, windowId: 11, url: "https://c.com",  title: "C", incognito: false }
        ])
      }
    });
    const res = await handleRpc({ type: "tabs.list" });
    expect(res.ok).toBe(true);
    if (res.ok) {
      const ids = (res.data as { tabs: Array<{ tabId: number }> }).tabs.map((t) => t.tabId);
      expect(ids.sort()).toEqual([1, 5]);
    }
  });

  it("filters by windowId when provided", async () => {
    vi.stubGlobal("chrome", {
      tabs: {
        get: vi.fn(),
        sendMessage: vi.fn(),
        query: vi.fn(async (q: chrome.tabs.QueryInfo) => {
          const all = [
            { id: 1, windowId: 10, url: "https://a.com", title: "A", incognito: false },
            { id: 2, windowId: 11, url: "https://b.com", title: "B", incognito: false }
          ];
          return q.windowId == null ? all : all.filter((t) => t.windowId === q.windowId);
        })
      }
    });
    const res = await handleRpc({ type: "tabs.list", windowId: 11 });
    if (res.ok) {
      expect((res.data as { tabs: Array<{ tabId: number }> }).tabs.map((t) => t.tabId)).toEqual([2]);
    }
  });
});
