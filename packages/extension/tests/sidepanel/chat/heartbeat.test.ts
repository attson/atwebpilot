import { beforeEach, describe, expect, it } from "vitest";
import { __test } from "@/sidepanel/chat/heartbeat";
import {
  attachTab,
  ensureSession,
  setStatus,
  useStore,
} from "@/sidepanel/chat/session-store";

function reset() {
  useStore.setState({ sessionsByTab: {}, currentTabId: null });
}

describe("heartbeat.computeActiveTabIds", () => {
  beforeEach(reset);

  it("returns empty when nothing is non-idle", () => {
    ensureSession(1, "https://x");
    expect(__test.computeActiveTabIds()).toEqual([]);
  });

  it("includes session tab when streaming", () => {
    ensureSession(7, "https://x");
    setStatus(7, "streaming");
    expect(__test.computeActiveTabIds()).toEqual([7]);
  });

  it("includes attached tabs too", () => {
    ensureSession(7, "https://x");
    attachTab(7, {
      tabId: 9,
      windowId: 1,
      source: "mention",
      lastSeenUrl: "u",
      lastSeenTitle: "T",
    });
    setStatus(7, "running");
    const out = __test.computeActiveTabIds().sort();
    expect(out).toEqual([7, 9]);
  });

  it("excludes idle sessions even if other sessions are active", () => {
    ensureSession(1, "https://x");
    ensureSession(2, "https://y");
    setStatus(2, "awaiting");
    expect(__test.computeActiveTabIds()).toEqual([2]);
  });
});
