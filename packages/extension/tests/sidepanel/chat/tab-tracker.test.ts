import { beforeEach, describe, expect, it, vi } from "vitest";
import { installTabTracker } from "@/sidepanel/chat/tab-tracker";
import {
  appendUserMessage,
  ensureSession,
  getSessionFor,
  useStore
} from "@/sidepanel/chat/session-store";

type Listener<T> = (arg: T) => void;
type UpdatedListener = (id: number, c: chrome.tabs.TabChangeInfo) => void;

function setupChromeMock() {
  const onActivatedListeners: Listener<{ tabId: number }>[] = [];
  const onUpdatedListeners: UpdatedListener[] = [];
  const onRemovedListeners: Listener<number>[] = [];
  const tabsGet = vi.fn();
  (globalThis as unknown as { chrome: typeof chrome }).chrome = {
    tabs: {
      onActivated: {
        addListener: (l: Listener<{ tabId: number }>) => onActivatedListeners.push(l),
        removeListener: (l: Listener<{ tabId: number }>) => {
          const i = onActivatedListeners.indexOf(l);
          if (i !== -1) onActivatedListeners.splice(i, 1);
        }
      },
      onUpdated: {
        addListener: (l: UpdatedListener) => onUpdatedListeners.push(l),
        removeListener: (l: UpdatedListener) => {
          const i = onUpdatedListeners.indexOf(l);
          if (i !== -1) onUpdatedListeners.splice(i, 1);
        }
      },
      onRemoved: {
        addListener: (l: Listener<number>) => onRemovedListeners.push(l),
        removeListener: (l: Listener<number>) => {
          const i = onRemovedListeners.indexOf(l);
          if (i !== -1) onRemovedListeners.splice(i, 1);
        }
      },
      get: tabsGet
    }
  } as unknown as typeof chrome;
  return {
    fire: {
      activated: (id: number) => onActivatedListeners.forEach((l) => l({ tabId: id })),
      updated: (id: number, change: chrome.tabs.TabChangeInfo) =>
        onUpdatedListeners.forEach((l) => l(id, change)),
      removed: (id: number) => onRemovedListeners.forEach((l) => l(id))
    },
    tabsGet
  };
}

describe("tab-tracker", () => {
  beforeEach(() => {
    useStore.setState({ sessionsByTab: {}, closedSessions: [], currentTabId: null });
  });

  it("onActivated sets currentTabId and ensures session", async () => {
    const m = setupChromeMock();
    m.tabsGet.mockResolvedValue({ url: "https://x.com" });
    installTabTracker();
    m.fire.activated(7);
    await Promise.resolve();
    await Promise.resolve();
    expect(useStore.getState().currentTabId).toBe(7);
    expect(getSessionFor(7).url).toBe("https://x.com");
  });

  it("onUpdated url change appends system note when messages non-empty", () => {
    const m = setupChromeMock();
    m.tabsGet.mockResolvedValue({ url: "u1" });
    installTabTracker();
    ensureSession(1, "u1");
    appendUserMessage(1, "hi");
    m.fire.updated(1, { url: "u2" });
    expect(getSessionFor(1).url).toBe("u2");
    const last = getSessionFor(1).messages.at(-1);
    expect(last && typeof last.content === "string" && last.content.includes("u2")).toBe(true);
  });

  it("onUpdated url change skips system note when messages empty", () => {
    const m = setupChromeMock();
    m.tabsGet.mockResolvedValue({ url: "u1" });
    installTabTracker();
    ensureSession(1, "u1");
    m.fire.updated(1, { url: "u2" });
    expect(getSessionFor(1).messages).toHaveLength(0);
  });

  it("onRemoved closes the tab session", () => {
    const m = setupChromeMock();
    installTabTracker();
    ensureSession(2, "u");
    appendUserMessage(2, "x");
    m.fire.removed(2);
    expect(useStore.getState().sessionsByTab[2]).toBeUndefined();
    expect(useStore.getState().closedSessions).toHaveLength(1);
  });

  it("uninstall stops dispatching", () => {
    const m = setupChromeMock();
    m.tabsGet.mockResolvedValue({ url: "u" });
    const off = installTabTracker();
    off();
    m.fire.activated(99);
    expect(useStore.getState().currentTabId).toBeNull();
  });
});
