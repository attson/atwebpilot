import { describe, it, expect, beforeEach } from "vitest";
import { handleSidepanelStatePing } from "@/sidepanel/coordinator-state-bridge";
import {
  attachTab, ensureSession, setStatus, useStore
} from "@/sidepanel/chat/session-store";

beforeEach(() => { useStore.setState({ sessionsByTab: {}, currentTabId: null }); });

describe("handleSidepanelStatePing", () => {
  it("returns found:true with snapshot for a known tab", () => {
    ensureSession(100, "https://example.com");
    setStatus(100, "running");
    attachTab(100, {
      tabId: 200, windowId: 1, source: "mention",
      lastSeenUrl: "https://attached", lastSeenTitle: "A"
    });
    useStore.setState((s) => ({
      ...s,
      sessionsByTab: {
        ...s.sessionsByTab,
        100: { ...s.sessionsByTab[100], messages: [
          { role: "user", content: "hi" },
          { role: "user", content: "🆕 AI 在 #200 打开了 https://attached" }
        ] }
      }
    }));
    const pong = handleSidepanelStatePing({
      type: "ping.sidepanelState", req_id: "r1", tab_id: "100"
    });
    expect(pong).toEqual({
      type: "pong.sidepanelState", req_id: "r1", found: true,
      snapshot: {
        status: "running",
        messagesCount: 2,
        attachedTabs: [{ tabId: 200, source: "mention", lastSeenUrl: "https://attached" }],
        lastSystemNote: "🆕 AI 在 #200 打开了 https://attached"
      }
    });
  });

  it("returns found:false when no session for that tab", () => {
    const pong = handleSidepanelStatePing({
      type: "ping.sidepanelState", req_id: "r2", tab_id: "999"
    });
    expect(pong).toEqual({ type: "pong.sidepanelState", req_id: "r2", found: false });
  });

  it("returns null for non-ping payloads", () => {
    expect(handleSidepanelStatePing({ type: "other" })).toBeNull();
    expect(handleSidepanelStatePing(null)).toBeNull();
    expect(handleSidepanelStatePing("string")).toBeNull();
  });
});
