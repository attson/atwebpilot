import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleExec } from "../../src/background/coordinator-exec";
import { PROTOCOL_VERSION } from "@webpilot/shared/protocol";
import type { Exec } from "@webpilot/shared/protocol";

vi.mock("../../src/background/rpc-handlers", () => ({
  runOneStep: vi.fn()
}));

import { runOneStep } from "../../src/background/rpc-handlers";

beforeEach(() => {
  vi.clearAllMocks();
});

const baseExec: Exec = {
  type: "EXEC",
  nonce: "n1",
  ts: 1,
  protocol_version: PROTOCOL_VERSION,
  req_id: "r1",
  session_id: "s1",
  tab_id: "42",
  step: { tool: "snapshotDOM", args: {} }
};

describe("handleExec", () => {
  it("calls runOneStep with parsed step + numeric tab id", async () => {
    (runOneStep as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      data: { html: "<div/>" }
    });
    await handleExec(baseExec);
    const args = (runOneStep as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(args[0]).toEqual({ tool: "snapshotDOM", args: {} });
    expect(args[1]).toBe(42);
  });

  it("returns RESULT with ok=true on success", async () => {
    (runOneStep as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      data: { html: "<div/>" }
    });
    const r = await handleExec(baseExec);
    expect(r.type).toBe("RESULT");
    expect(r.req_id).toBe("r1");
    expect(r.ok).toBe(true);
    expect(r.return).toEqual({ html: "<div/>" });
  });

  it("returns RESULT with ok=false + ErrorBody on runOneStep failure", async () => {
    (runOneStep as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      error: "tab closed"
    });
    const r = await handleExec(baseExec);
    expect(r.ok).toBe(false);
    expect(r.error?.code).toBe("PageScriptError");
    expect(r.error?.message).toContain("tab closed");
    expect(r.error?.retryable).toBe(false);
  });

  it("returns RESULT with ok=false on runOneStep throwing", async () => {
    (runOneStep as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("boom")
    );
    const r = await handleExec(baseExec);
    expect(r.ok).toBe(false);
    expect(r.error?.code).toBe("InternalError");
    expect(r.error?.message).toContain("boom");
  });

  it("returns InvalidArgs when tab_id is not a number", async () => {
    const bad: Exec = { ...baseExec, tab_id: "not-a-number" };
    const r = await handleExec(bad);
    expect(r.ok).toBe(false);
    expect(r.error?.code).toBe("InvalidArgs");
  });
});
