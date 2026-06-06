import { describe, it, expect, afterEach } from "vitest";
import { WebSocket } from "ws";
import { PROTOCOL_VERSION, type Hello, type ClientToServer } from "@webpilot/shared/protocol";
import { DefaultClock, DefaultIdGen } from "@webpilot/coordinator";
import { LoopbackWSHub } from "../src/loopback-ws-hub";

let hub: LoopbackWSHub | null = null;
afterEach(async () => { if (hub) await hub.close(); hub = null; });

function helloMsg(): Hello {
  return {
    type: "HELLO", nonce: "h1", ts: 1, protocol_version: PROTOCOL_VERSION,
    worker_id: "w1", fingerprint: { ext_hash: "x", os: "mac", chrome: "120" },
    capabilities: ["read:dom", "interact:form"], attended: true,
    available_tabs: [{ tab_id: "42", url: "https://example.org", title: "Ex" }],
    saved_tools: [], labels: []
  };
}

async function connectWorker(port: number): Promise<WebSocket> {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/worker`, [`bearer.t`, `proto.${PROTOCOL_VERSION}`]);
  await new Promise<void>((res, rej) => { ws.on("open", () => res()); ws.on("error", rej); });
  return ws;
}

// M4: deterministic wait — polls until hub registers the worker or times out.
async function waitForWorker(h: LoopbackWSHub, id: string, timeoutMs = 1000): Promise<void> {
  const start = Date.now();
  while (!h.connectedWorkers().includes(id)) {
    if (Date.now() - start > timeoutMs) throw new Error(`worker ${id} not registered in time`);
    await new Promise((r) => setTimeout(r, 5));
  }
}

describe("LoopbackWSHub", () => {
  it("replies WELCOME on HELLO and registers the worker via onMessage", async () => {
    hub = new LoopbackWSHub({ port: 0, clock: new DefaultClock(), idGen: new DefaultIdGen() });
    const port = await hub.ready();
    const seen: ClientToServer[] = [];
    hub.onMessage((_id, m) => seen.push(m));
    const ws = await connectWorker(port);
    const welcomeP = new Promise<any>((res) => ws.on("message", (r) => res(JSON.parse(r.toString()))));
    ws.send(JSON.stringify(helloMsg()));
    const welcome = await welcomeP;
    expect(welcome.type).toBe("WELCOME");
    expect(welcome.protocol_version).toBe(PROTOCOL_VERSION);
    await new Promise((r) => setTimeout(r, 30));
    expect(seen.some((m) => m.type === "HELLO")).toBe(true);
    expect(hub.connectedWorkers()).toContain("w1");
  });

  it("exec() resolves when the worker replies RESULT with matching req_id", async () => {
    hub = new LoopbackWSHub({ port: 0, clock: new DefaultClock(), idGen: new DefaultIdGen() });
    const port = await hub.ready();
    const ws = await connectWorker(port);
    ws.on("message", (raw) => {
      const m = JSON.parse(raw.toString());
      if (m.type === "EXEC") {
        ws.send(JSON.stringify({
          type: "RESULT", nonce: "rn", ts: 2, protocol_version: PROTOCOL_VERSION,
          req_id: m.req_id, ok: true, return: { clicked: true }
        }));
      }
    });
    ws.send(JSON.stringify(helloMsg()));
    await waitForWorker(hub, "w1");
    const result = await hub.exec("w1", { session_id: "s1", tab_id: "42", step: { tool: "click", args: { selector: ".b" } } });
    expect(result.ok).toBe(true);
    expect(result.return).toEqual({ clicked: true });
  });

  it("exec() rejects on timeout when no RESULT arrives", async () => {
    hub = new LoopbackWSHub({ port: 0, clock: new DefaultClock(), idGen: new DefaultIdGen(), execTimeoutMs: 80 });
    const port = await hub.ready();
    const ws = await connectWorker(port);
    ws.on("message", () => { /* never replies RESULT */ });
    ws.send(JSON.stringify(helloMsg()));
    await waitForWorker(hub, "w1");
    await expect(hub.exec("w1", { session_id: "s1", tab_id: "42", step: { tool: "click", args: {} } }))
      .rejects.toThrow(/timeout/i);
  });

  it("rejects pending execs when the worker disconnects", async () => {
    hub = new LoopbackWSHub({ port: 0, clock: new DefaultClock(), idGen: new DefaultIdGen(), execTimeoutMs: 5000 });
    const port = await hub.ready();
    const ws = await connectWorker(port);
    ws.on("message", (raw) => { const m = JSON.parse(raw.toString()); if (m.type === "EXEC") ws.close(); });
    ws.send(JSON.stringify(helloMsg()));
    await waitForWorker(hub, "w1");
    await expect(hub.exec("w1", { session_id: "s1", tab_id: "42", step: { tool: "click", args: {} } }))
      .rejects.toThrow(/disconnect/i);
  });

  it("I1: reconnect rejects in-flight execs immediately (not after timeout)", async () => {
    hub = new LoopbackWSHub({ port: 0, clock: new DefaultClock(), idGen: new DefaultIdGen(), execTimeoutMs: 5000 });
    const port = await hub.ready();

    // First worker connects and sends HELLO but never replies to EXEC
    const ws1 = await connectWorker(port);
    ws1.on("message", () => { /* never replies RESULT */ });
    ws1.send(JSON.stringify(helloMsg()));
    await waitForWorker(hub, "w1");

    // Start an exec that will never complete (ws1 ignores EXEC messages)
    const execP = hub.exec("w1", { session_id: "s1", tab_id: "42", step: { tool: "click", args: {} } });

    // Wait a tick to ensure the EXEC message has been sent
    await new Promise((r) => setTimeout(r, 20));

    // Second connection with the same worker_id (reconnect)
    const ws2 = await connectWorker(port);
    ws2.send(JSON.stringify(helloMsg()));

    // The in-flight exec should reject quickly (well before the 5s timeout) with a "reconnect" message
    await expect(execP).rejects.toThrow(/reconnect|cancelled/i);
  });

  it("reconnect with same worker_id does NOT fire disconnect handler", async () => {
    hub = new LoopbackWSHub({ port: 0, clock: new DefaultClock(), idGen: new DefaultIdGen() });
    const port = await hub.ready();

    const disconnectedWorkers: string[] = [];
    hub.onDisconnect((wid) => disconnectedWorkers.push(wid));

    // First connection
    const ws1 = await connectWorker(port);
    ws1.send(JSON.stringify(helloMsg()));
    await waitForWorker(hub, "w1");

    // Second connection with same worker_id (reconnect)
    const ws2 = await connectWorker(port);
    ws2.send(JSON.stringify(helloMsg()));
    // Wait for hub to register ws2 as the current socket for "w1"
    // We know re-registration happened when ws1 has been terminated — poll until ws2 is the live socket.
    // A simple way: wait for ws1 to be in CLOSING/CLOSED state (hub called terminate on it).
    const startMs = Date.now();
    while (ws1.readyState === WebSocket.OPEN) {
      if (Date.now() - startMs > 1000) throw new Error("old socket was not terminated in time");
      await new Promise((r) => setTimeout(r, 5));
    }

    // Give any pending close-event microtasks a chance to run
    await new Promise((r) => setTimeout(r, 30));

    // "w1" must still be connected (via ws2)
    expect(hub!.connectedWorkers()).toContain("w1");
    // connectedWorkers should list "w1" exactly once
    expect(hub!.connectedWorkers().filter((id) => id === "w1").length).toBe(1);
    // No spurious disconnect callback for "w1"
    expect(disconnectedWorkers).not.toContain("w1");
  });
});
