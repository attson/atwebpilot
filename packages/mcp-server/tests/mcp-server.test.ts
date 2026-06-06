import { describe, it, expect } from "vitest";
import { Coordinator, FakeClock, FakeIdGen, type Worker } from "@atwebpilot/coordinator";
import type { Result } from "@atwebpilot/shared/protocol";
import { buildToolList, dispatchCall } from "../src/mcp-server";

function fakeWorker(): Worker {
  return {
    id: "w1", fingerprint: { ext_hash: "x", os: "mac", chrome: "120" },
    capabilities: new Set(["read:dom"]), attended: true, labels: new Set(),
    available_tabs: [{ tab_id: "42", url: "https://example.org" }],
    saved_tools: [], protocol_version: 1, connected_at: 0, last_heartbeat_at: 0
  };
}
const okResult: Result = { type: "RESULT", nonce: "n", ts: 1, protocol_version: 1, req_id: "req_1", ok: true, return: { ok: 1 } };
function deps() {
  const coordinator = new Coordinator({ hub: {} as any, clock: new FakeClock(0), idGen: new FakeIdGen() });
  coordinator.registerWorker(fakeWorker());
  return { coordinator, hub: { exec: async () => okResult } as any };
}

describe("buildToolList", () => {
  it("lists 4 control + 19 browser tools, each with inputSchema", () => {
    const tools = buildToolList();
    expect(tools.length).toBe(23);
    const names = tools.map((t) => t.name);
    expect(names).toContain("list_tabs");
    expect(names).toContain("open_session");
    expect(names).toContain("browser_click");
    for (const t of tools) expect(t.inputSchema).toBeTruthy();
  });
});

describe("dispatchCall", () => {
  it("routes list_tabs and returns content", async () => {
    const r = await dispatchCall(deps(), "list_tabs", {});
    expect(r.isError).toBeFalsy();
    expect(r.content[0].text).toContain("42");
  });
  it("returns isError for unknown tool", async () => {
    const r = await dispatchCall(deps(), "no_such_tool", {});
    expect(r.isError).toBe(true);
  });
  it("routes a generated browser_* tool", async () => {
    const d = deps();
    const open = await dispatchCall(d, "open_session", { tab_id: "42" });
    const session_id = JSON.parse(open.content[0].text).session_id;
    const r = await dispatchCall(d, "browser_snapshotDOM", { session_id });
    expect(r.isError).toBeFalsy();
  });
});
