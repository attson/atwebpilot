import { beforeEach, describe, expect, it } from "vitest";
import {
  appendUserMessage,
  attachTab,
  closeTab,
  detachTab,
  ensureSession,
  getSessionFor,
  markAttachedUrlChanged,
  pruneClosed,
  removeAttachedTab,
  resetSession,
  restoreClosed,
  setAbortController,
  setCurrentTab,
  setInputDraft,
  setUrl,
  useStore,
  validateAttachedTabs
} from "@/sidepanel/chat/session-store";

function reset() {
  useStore.setState({ sessionsByTab: {}, closedSessions: [], currentTabId: null });
}

describe("session-store per-tab", () => {
  beforeEach(reset);

  it("makeEmptySession seeds an empty attachedTabs list", () => {
    ensureSession(7, "https://x.com");
    const s = getSessionFor(7);
    expect(s.attachedTabs).toEqual([]);
  });

  it("ensureSession creates empty SessionData and is idempotent", () => {
    ensureSession(7, "https://x.com");
    const s = getSessionFor(7);
    expect(s.tabId).toBe(7);
    expect(s.url).toBe("https://x.com");
    expect(s.messages).toEqual([]);

    appendUserMessage(7, "hi");
    ensureSession(7, "https://x.com");
    expect(getSessionFor(7).messages).toHaveLength(1);
  });

  it("appendUserMessage targets only the given tab", () => {
    ensureSession(1, "");
    ensureSession(2, "");
    appendUserMessage(1, "in tab 1");
    expect(getSessionFor(1).messages).toHaveLength(1);
    expect(getSessionFor(2).messages).toHaveLength(0);
  });

  it("setCurrentTab does not touch sessionsByTab", () => {
    ensureSession(5, "u");
    appendUserMessage(5, "x");
    setCurrentTab(5);
    expect(useStore.getState().currentTabId).toBe(5);
    expect(getSessionFor(5).messages).toHaveLength(1);
  });

  it("setUrl updates only the target tab url", () => {
    ensureSession(1, "a");
    ensureSession(2, "b");
    setUrl(1, "a2");
    expect(getSessionFor(1).url).toBe("a2");
    expect(getSessionFor(2).url).toBe("b");
  });

  it("closeTab moves non-empty session into closedSessions", () => {
    ensureSession(9, "https://x");
    appendUserMessage(9, "hello");
    closeTab(9);
    const s = useStore.getState();
    expect(s.sessionsByTab[9]).toBeUndefined();
    expect(s.closedSessions).toHaveLength(1);
    expect(s.closedSessions[0].tabId).toBe(9);
    expect(s.closedSessions[0].data.messages).toHaveLength(1);
  });

  it("closeTab drops empty session without enqueueing", () => {
    ensureSession(3, "u");
    closeTab(3);
    expect(useStore.getState().sessionsByTab[3]).toBeUndefined();
    expect(useStore.getState().closedSessions).toHaveLength(0);
  });

  it("closeTab aborts active controller", () => {
    ensureSession(1, "u");
    const ac = new AbortController();
    setAbortController(1, ac);
    appendUserMessage(1, "x");
    closeTab(1);
    expect(ac.signal.aborted).toBe(true);
  });

  it("restoreClosed copies data to target tab and clears volatile fields", () => {
    ensureSession(1, "u1");
    appendUserMessage(1, "old");
    closeTab(1);
    ensureSession(2, "u2");
    restoreClosed(0, 2);
    const s2 = getSessionFor(2);
    expect(
      s2.messages.find((m) => typeof m.content === "string" && m.content === "old")
    ).toBeTruthy();
    expect(
      s2.messages.at(-1)?.content
    ).toEqual(expect.stringContaining("[已恢复]"));
    expect(s2.abortController).toBeNull();
    expect(s2.status).toBe("idle");
    expect(useStore.getState().closedSessions).toHaveLength(0);
  });

  it("pruneClosed removes entries older than 5 minutes", () => {
    ensureSession(1, "u");
    appendUserMessage(1, "x");
    closeTab(1);
    useStore.setState((s) => ({
      ...s,
      closedSessions: s.closedSessions.map((c) => ({
        ...c,
        closedAt: c.closedAt - 6 * 60 * 1000
      }))
    }));
    pruneClosed(Date.now());
    expect(useStore.getState().closedSessions).toHaveLength(0);
  });

  it("setInputDraft scopes to tab", () => {
    ensureSession(1, "");
    ensureSession(2, "");
    setInputDraft(1, "draft1");
    expect(getSessionFor(1).inputDraft).toBe("draft1");
    expect(getSessionFor(2).inputDraft).toBe("");
  });

  it("resetSession keeps url but clears messages and counters", () => {
    ensureSession(1, "u");
    appendUserMessage(1, "x");
    resetSession(1);
    const s = getSessionFor(1);
    expect(s.messages).toHaveLength(0);
    expect(s.url).toBe("u");
    expect(s.status).toBe("idle");
  });
});

describe("attachedTabs actions", () => {
  beforeEach(reset);

  it("attachTab adds a tab with given source and metadata", () => {
    ensureSession(7, "https://main");
    attachTab(7, {
      tabId: 167,
      windowId: 1,
      source: "mention",
      lastSeenUrl: "https://taobao",
      lastSeenTitle: "TB"
    });
    const a = getSessionFor(7).attachedTabs;
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({
      tabId: 167,
      source: "mention",
      lastSeenUrl: "https://taobao",
      lastSeenTitle: "TB"
    });
    expect(typeof a[0].addedAt).toBe("number");
  });

  it("attachTab on same tabId keeps first source", () => {
    ensureSession(7, "https://main");
    attachTab(7, { tabId: 167, windowId: 1, source: "mention", lastSeenUrl: "u1", lastSeenTitle: "t1" });
    attachTab(7, { tabId: 167, windowId: 1, source: "ai-open", lastSeenUrl: "u2", lastSeenTitle: "t2" });
    const a = getSessionFor(7).attachedTabs;
    expect(a).toHaveLength(1);
    expect(a[0].source).toBe("mention");
    expect(a[0].lastSeenUrl).toBe("u1");
  });

  it("detachTab removes by tabId", () => {
    ensureSession(7, "https://main");
    attachTab(7, { tabId: 167, windowId: 1, source: "mention", lastSeenUrl: "u", lastSeenTitle: "t" });
    detachTab(7, 167);
    expect(getSessionFor(7).attachedTabs).toEqual([]);
  });

  it("markAttachedUrlChanged sets urlChanged and updates lastSeenUrl/Title", () => {
    ensureSession(7, "https://main");
    attachTab(7, { tabId: 167, windowId: 1, source: "mention", lastSeenUrl: "u1", lastSeenTitle: "t1" });
    markAttachedUrlChanged(7, 167, "u2", "t2");
    const a = getSessionFor(7).attachedTabs[0];
    expect(a.urlChanged).toBe(true);
    expect(a.lastSeenUrl).toBe("u2");
    expect(a.lastSeenTitle).toBe("t2");
  });

  it("removeAttachedTab affects every session that holds it", () => {
    ensureSession(7, "https://a");
    ensureSession(8, "https://b");
    attachTab(7, { tabId: 167, windowId: 1, source: "mention", lastSeenUrl: "u", lastSeenTitle: "t" });
    attachTab(8, { tabId: 167, windowId: 1, source: "approval", lastSeenUrl: "u", lastSeenTitle: "t" });
    removeAttachedTab(167);
    expect(getSessionFor(7).attachedTabs).toEqual([]);
    expect(getSessionFor(8).attachedTabs).toEqual([]);
  });
});

describe("validateAttachedTabs", () => {
  beforeEach(reset);
  it("removes attached tabs not in known set", () => {
    ensureSession(7, "https://x");
    attachTab(7, { tabId: 100, windowId: 1, source: "mention", lastSeenUrl: "u", lastSeenTitle: "t" });
    attachTab(7, { tabId: 200, windowId: 1, source: "mention", lastSeenUrl: "u", lastSeenTitle: "t" });
    validateAttachedTabs(new Set([100]));
    expect(getSessionFor(7).attachedTabs.map((a) => a.tabId)).toEqual([100]);
  });

  it("is a no-op when nothing changes", () => {
    ensureSession(7, "https://x");
    attachTab(7, { tabId: 100, windowId: 1, source: "mention", lastSeenUrl: "u", lastSeenTitle: "t" });
    const before = getSessionFor(7);
    validateAttachedTabs(new Set([100]));
    const after = getSessionFor(7);
    expect(after).toBe(before);
  });
});
