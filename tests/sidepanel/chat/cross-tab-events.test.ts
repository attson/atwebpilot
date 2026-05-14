import { beforeEach, describe, expect, it } from "vitest";
import {
  attachTab,
  ensureSession,
  getSessionFor,
  setCurrentTab,
  useStore
} from "@/sidepanel/chat/session-store";
import { handleTabEvent } from "@/sidepanel/chat/cross-tab-events";

function reset() {
  useStore.setState({ sessionsByTab: {}, closedSessions: [], currentTabId: null });
}

describe("handleTabEvent", () => {
  beforeEach(reset);

  it("tabs.spawned auto-attaches to session whose main tab is opener", () => {
    ensureSession(100, "https://main");
    setCurrentTab(100);
    // seed a message so appendSystemNote isn't a no-op (it ignores empty conversations)
    useStore.setState((state) => ({
      ...state,
      sessionsByTab: {
        ...state.sessionsByTab,
        100: {
          ...state.sessionsByTab[100],
          messages: [{ role: "user", content: "hi" }]
        }
      }
    }));
    handleTabEvent({
      type: "tabs.spawned",
      tabId: 200,
      openerTabId: 100,
      windowId: 1,
      url: "https://child",
      title: "Child"
    });
    const a = getSessionFor(100).attachedTabs;
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ tabId: 200, source: "ai-open", lastSeenUrl: "https://child" });
    // system message appended
    const last = getSessionFor(100).messages.at(-1);
    expect(JSON.stringify(last)).toMatch(/AI 在 #200/);
  });

  it("tabs.spawned with non-matching opener is ignored", () => {
    ensureSession(100, "https://main");
    handleTabEvent({
      type: "tabs.spawned",
      tabId: 200,
      openerTabId: 999,
      windowId: 1,
      url: "https://child",
      title: "Child"
    });
    expect(getSessionFor(100).attachedTabs).toEqual([]);
  });

  it("tabs.spawned auto-attaches to session whose attached tab is opener", () => {
    ensureSession(100, "https://main");
    attachTab(100, {
      tabId: 150, windowId: 1, source: "mention", lastSeenUrl: "u", lastSeenTitle: "t"
    });
    handleTabEvent({
      type: "tabs.spawned",
      tabId: 200,
      openerTabId: 150,
      windowId: 1,
      url: "https://child",
      title: "Child"
    });
    const a = getSessionFor(100).attachedTabs;
    expect(a.find((x) => x.tabId === 200)).toMatchObject({ source: "ai-open" });
  });

  it("tabs.urlChanged on an attached tab sets urlChanged", () => {
    ensureSession(100, "https://main");
    attachTab(100, {
      tabId: 200,
      windowId: 1,
      source: "mention",
      lastSeenUrl: "https://old",
      lastSeenTitle: "Old"
    });
    handleTabEvent({ type: "tabs.urlChanged", tabId: 200, newUrl: "https://new", newTitle: "New" });
    const a = getSessionFor(100).attachedTabs[0];
    expect(a.urlChanged).toBe(true);
    expect(a.lastSeenUrl).toBe("https://new");
  });

  it("tabs.removed detaches and emits system row", () => {
    ensureSession(100, "https://main");
    // seed a message so appendSystemNote isn't a no-op (it ignores empty conversations)
    useStore.setState((state) => ({
      ...state,
      sessionsByTab: {
        ...state.sessionsByTab,
        100: {
          ...state.sessionsByTab[100],
          messages: [{ role: "user", content: "hi" }]
        }
      }
    }));
    attachTab(100, {
      tabId: 200, windowId: 1, source: "mention", lastSeenUrl: "u", lastSeenTitle: "t"
    });
    handleTabEvent({ type: "tabs.removed", tabId: 200 });
    expect(getSessionFor(100).attachedTabs).toEqual([]);
    expect(JSON.stringify(getSessionFor(100).messages.at(-1))).toMatch(/Tab #200 已关闭/);
  });
});
