// packages/shared/tests/protocol/wire-extensions.test.ts
import { describe, it, expect } from "vitest";
import {
  StartChatSessionSchema,
  AbortSessionSchema,
  ReadSidepanelStateSchema,
  ChatEventSchema,
  SidepanelStateReplySchema,
  ServerToClientSchema,
  ClientToServerSchema
} from "../../src/protocol/messages";

const env = { nonce: "n", ts: 1, protocol_version: 1 };

describe("StartChatSessionSchema", () => {
  it("parses minimal", () => {
    const r = StartChatSessionSchema.safeParse({
      ...env, type: "START_CHAT_SESSION",
      session_id: "s1", user_prompt: "hi"
    });
    expect(r.success).toBe(true);
  });
  it("parses with mock_llm and overrides", () => {
    const r = StartChatSessionSchema.safeParse({
      ...env, type: "START_CHAT_SESSION",
      session_id: "s1", user_prompt: "hi", tab_id: "42",
      mock_llm: { rounds: [[{ type: "message_end", usage: { input_tokens: 0, output_tokens: 0 } }]] },
      settings_override: { maxRounds: 3, maxContinuationNudges: 1 }
    });
    expect(r.success).toBe(true);
  });
  it("rejects empty session_id", () => {
    const r = StartChatSessionSchema.safeParse({
      ...env, type: "START_CHAT_SESSION", session_id: "", user_prompt: "x"
    });
    expect(r.success).toBe(false);
  });
});

describe("AbortSessionSchema", () => {
  it("parses", () => {
    const r = AbortSessionSchema.safeParse({ ...env, type: "ABORT_SESSION", session_id: "s1" });
    expect(r.success).toBe(true);
  });
});

describe("ReadSidepanelStateSchema", () => {
  it("parses", () => {
    const r = ReadSidepanelStateSchema.safeParse({
      ...env, type: "READ_SIDEPANEL_STATE", req_id: "r1", tab_id: "42"
    });
    expect(r.success).toBe(true);
  });
});

describe("ChatEventSchema", () => {
  it("wraps a text_delta event", () => {
    const r = ChatEventSchema.safeParse({
      ...env, type: "CHAT_EVENT", session_id: "s1",
      event: { type: "text_delta", text: "hi" }
    });
    expect(r.success).toBe(true);
  });
  it("rejects malformed inner event", () => {
    const r = ChatEventSchema.safeParse({
      ...env, type: "CHAT_EVENT", session_id: "s1",
      event: { type: "imaginary" }
    });
    expect(r.success).toBe(false);
  });
});

describe("SidepanelStateReplySchema", () => {
  it("parses found:false without snapshot", () => {
    const r = SidepanelStateReplySchema.safeParse({
      ...env, type: "SIDEPANEL_STATE_REPLY", req_id: "r1", found: false
    });
    expect(r.success).toBe(true);
  });
  it("parses found:true with snapshot", () => {
    const r = SidepanelStateReplySchema.safeParse({
      ...env, type: "SIDEPANEL_STATE_REPLY", req_id: "r1", found: true,
      snapshot: {
        status: "idle", messagesCount: 0, attachedTabs: [],
        lastSystemNote: undefined
      }
    });
    expect(r.success).toBe(true);
  });
});

describe("union extension", () => {
  it("ServerToClientSchema accepts START_CHAT_SESSION", () => {
    const r = ServerToClientSchema.safeParse({
      ...env, type: "START_CHAT_SESSION", session_id: "s1", user_prompt: "hi"
    });
    expect(r.success).toBe(true);
  });
  it("ClientToServerSchema accepts CHAT_EVENT", () => {
    const r = ClientToServerSchema.safeParse({
      ...env, type: "CHAT_EVENT", session_id: "s1",
      event: { type: "text_delta", text: "x" }
    });
    expect(r.success).toBe(true);
  });
});
