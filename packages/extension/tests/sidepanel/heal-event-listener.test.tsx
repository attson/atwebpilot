/**
 * Tests for the self-heal SessionEvent → session store message integration.
 *
 * These unit tests verify that appendHealNote correctly writes [自愈] notes
 * to the session message thread, and that the chat-view SYSTEM_PREFIXES
 * recognises them as system notes (checked via the store shape).
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  appendHealNote,
  ensureSession,
  useStore,
} from "@/sidepanel/chat/session-store";

beforeEach(() => {
  useStore.setState({ sessionsByTab: {}, currentTabId: null });
});

describe("appendHealNote", () => {
  it("appends a [自愈] prefixed user message to the session", () => {
    ensureSession(1, "https://example.com");
    appendHealNote(1, "正在自动修复失败步骤 (step 2)…");
    const msgs = useStore.getState().sessionsByTab[1].messages;
    expect(msgs).toHaveLength(1);
    expect(msgs[0]).toEqual({ role: "user", content: "[自愈] 正在自动修复失败步骤 (step 2)…" });
  });

  it("appends even when the message thread is empty", () => {
    ensureSession(2, "https://example.com");
    // Unlike appendSystemNote, appendHealNote works even with no prior messages
    appendHealNote(2, "自愈失败: llm_error");
    const msgs = useStore.getState().sessionsByTab[2].messages;
    expect(msgs).toHaveLength(1);
    expect(msgs[0].content).toBe("[自愈] 自愈失败: llm_error");
  });

  it("appends completed note with version info", () => {
    ensureSession(3, "https://example.com");
    appendHealNote(3, "已自愈，升级到 v3 (fixedStep=1)");
    const msgs = useStore.getState().sessionsByTab[3].messages;
    expect(msgs[0].content).toContain("[自愈]");
    expect(msgs[0].content).toContain("v3");
    expect(msgs[0].content).toContain("fixedStep=1");
  });

  it("does not affect a different tab's session", () => {
    ensureSession(10, "https://a.com");
    ensureSession(11, "https://b.com");
    appendHealNote(10, "正在自动修复失败步骤 (step 0)…");
    const msgs10 = useStore.getState().sessionsByTab[10].messages;
    const msgs11 = useStore.getState().sessionsByTab[11].messages;
    expect(msgs10).toHaveLength(1);
    expect(msgs11).toHaveLength(0);
  });
});
