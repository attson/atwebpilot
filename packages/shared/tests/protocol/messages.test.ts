import { describe, it, expect } from "vitest";
import {
  HelloSchema,
  ExecSchema,
  ResultSchema,
  ClientToServerSchema,
  ServerToClientSchema
} from "../../src/protocol/messages";

const envelope = { nonce: "n1", ts: 1, protocol_version: 1 };

describe("HelloSchema", () => {
  it("parses a complete HELLO", () => {
    const r = HelloSchema.safeParse({
      ...envelope,
      type: "HELLO",
      worker_id: "w1",
      fingerprint: { ext_hash: "h", os: "darwin", chrome: "120" },
      capabilities: ["read:dom"],
      attended: true,
      available_tabs: [{ tab_id: "t1", url: "https://example.com" }],
      saved_tools: [],
      labels: ["chrome:macos"]
    });
    expect(r.success).toBe(true);
  });

  it("rejects missing worker_id", () => {
    const r = HelloSchema.safeParse({
      ...envelope,
      type: "HELLO",
      fingerprint: { ext_hash: "", os: "", chrome: "" },
      capabilities: [],
      attended: false,
      available_tabs: [],
      saved_tools: [],
      labels: []
    });
    expect(r.success).toBe(false);
  });
});

describe("ExecSchema", () => {
  it("parses an EXEC", () => {
    const r = ExecSchema.safeParse({
      ...envelope,
      type: "EXEC",
      req_id: "r1",
      session_id: "s1",
      tab_id: "t1",
      step: { tool: "snapshotDOM", args: {} }
    });
    expect(r.success).toBe(true);
  });
});

describe("ResultSchema", () => {
  it("parses ok=true result", () => {
    const r = ResultSchema.safeParse({
      ...envelope,
      type: "RESULT",
      req_id: "r1",
      ok: true,
      return: { html: "<div/>" }
    });
    expect(r.success).toBe(true);
  });

  it("parses ok=false result with error", () => {
    const r = ResultSchema.safeParse({
      ...envelope,
      type: "RESULT",
      req_id: "r1",
      ok: false,
      error: {
        code: "TabClosed",
        message: "tab gone",
        retryable: true
      }
    });
    expect(r.success).toBe(true);
  });
});

describe("ClientToServerSchema discriminated union", () => {
  it("routes HELLO to HelloSchema", () => {
    const r = ClientToServerSchema.safeParse({
      ...envelope,
      type: "HELLO",
      worker_id: "w",
      fingerprint: { ext_hash: "", os: "", chrome: "" },
      capabilities: [],
      attended: false,
      available_tabs: [],
      saved_tools: [],
      labels: []
    });
    expect(r.success).toBe(true);
  });

  it("rejects unknown type", () => {
    const r = ClientToServerSchema.safeParse({ ...envelope, type: "UNKNOWN" });
    expect(r.success).toBe(false);
  });
});

describe("ServerToClientSchema discriminated union", () => {
  it("routes OPEN_TAB", () => {
    const r = ServerToClientSchema.safeParse({
      ...envelope,
      type: "OPEN_TAB",
      session_id: "s1",
      url: "https://example.com"
    });
    expect(r.success).toBe(true);
  });
});
