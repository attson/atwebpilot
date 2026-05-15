import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { WebSocketServer } from "ws";
import type { AddressInfo } from "node:net";
import { CoordinatorClient } from "../../src/background/coordinator-client";
import {
  PROTOCOL_VERSION,
  ClientToServerSchema,
  type Hello
} from "@webpilot/shared/protocol";

function fakeChrome() {
  return {
    tabs: { query: vi.fn(async () => []) },
    runtime: { id: "ext-id", getManifest: () => ({ version: "0.0.8" }) },
    alarms: {
      create: vi.fn(),
      clear: vi.fn(async () => true),
      onAlarm: { addListener: vi.fn(), removeListener: vi.fn() }
    }
  };
}

let wss: WebSocketServer | null = null;
let baseUrl = "";

beforeEach(async () => {
  vi.stubGlobal("chrome", fakeChrome());
  // happy-dom and node both should expose WebSocket. If not, polyfill from `ws`.
  if (typeof (globalThis as { WebSocket?: unknown }).WebSocket === "undefined") {
    const ws = await import("ws");
    (globalThis as { WebSocket: unknown }).WebSocket = ws.WebSocket;
  }
  wss = new WebSocketServer({ port: 0 });
  await new Promise<void>((resolve) => wss!.on("listening", () => resolve()));
  const addr = wss.address() as AddressInfo;
  baseUrl = `ws://127.0.0.1:${addr.port}/worker`;
});

afterEach(async () => {
  if (wss) await new Promise<void>((r) => wss!.close(() => r()));
  wss = null;
});

describe("coordinator-client end-to-end with ws server", () => {
  it("completes HELLO → WELCOME → EXEC → RESULT round trip", async () => {
    let helloReceived: Hello | null = null;
    let resultReceived: unknown = null;

    const serverDone = new Promise<void>((resolve) => {
      wss!.on("connection", (socket) => {
        socket.on("message", (raw) => {
          const parsed = JSON.parse(raw.toString());
          const r = ClientToServerSchema.safeParse(parsed);
          if (!r.success) {
            socket.close();
            return;
          }
          if (r.data.type === "HELLO") {
            helloReceived = r.data;
            socket.send(JSON.stringify({
              type: "WELCOME",
              nonce: "server-n",
              ts: Date.now(),
              protocol_version: PROTOCOL_VERSION,
              server_time: Date.now(),
              heartbeat_interval_ms: 20000
            }));
            socket.send(JSON.stringify({
              type: "EXEC",
              nonce: "exec-n",
              ts: Date.now(),
              protocol_version: PROTOCOL_VERSION,
              req_id: "req-1",
              session_id: "sess-1",
              tab_id: "1",
              step: { tool: "snapshotDOM", args: {} }
            }));
          } else if (r.data.type === "RESULT") {
            resultReceived = r.data;
            resolve();
          }
        });
      });
    });

    const client = new CoordinatorClient({
      ws_url: baseUrl,
      token: "wpk_test",
      worker_id: "worker_e2e",
      savedToolsProvider: async () => [],
      labelsProvider: async () => [],
      onExec: async (exec) => ({
        type: "RESULT",
        nonce: "client-n",
        ts: Date.now(),
        protocol_version: PROTOCOL_VERSION,
        req_id: exec.req_id,
        ok: true,
        return: { handled_by: "test stub", req_id: exec.req_id }
      })
    });

    await client.connect();
    await serverDone;
    await client.disconnect();

    expect(helloReceived).not.toBeNull();
    expect(helloReceived!.type).toBe("HELLO");
    expect(helloReceived!.worker_id).toBe("worker_e2e");
    expect(resultReceived).not.toBeNull();
    const r = resultReceived as { type: string; req_id: string; ok: boolean };
    expect(r.type).toBe("RESULT");
    expect(r.req_id).toBe("req-1");
    expect(r.ok).toBe(true);
  });
});
