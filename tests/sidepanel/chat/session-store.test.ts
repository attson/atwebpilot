import { beforeEach, describe, expect, it } from "vitest";
import {
  appendUserMessage,
  closeTab,
  ensureSession,
  getSessionFor,
  pruneClosed,
  resetSession,
  restoreClosed,
  setAbortController,
  setCurrentTab,
  setInputDraft,
  setUrl,
  useStore
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
