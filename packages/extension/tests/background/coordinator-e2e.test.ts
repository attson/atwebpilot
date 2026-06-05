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

  it("START_CHAT_SESSION → continuation guard nudges exactly once", async () => {
    // Pre-arm the allow flag in the fake chrome.storage.local
    const fakeStorage = new Map<string, unknown>();
    fakeStorage.set("webpilot.coordinator.allow_remote_chat", true);
    vi.stubGlobal("chrome", {
      ...((globalThis as { chrome?: unknown }).chrome as object),
      storage: {
        local: {
          async get(keys: string[] | string) {
            const arr = Array.isArray(keys) ? keys : [keys];
            const out: Record<string, unknown> = {};
            for (const k of arr) if (fakeStorage.has(k)) out[k] = fakeStorage.get(k);
            return out;
          },
          async set(obj: Record<string, unknown>) {
            for (const [k, v] of Object.entries(obj)) fakeStorage.set(k, v);
          }
        },
        onChanged: { addListener: vi.fn(), removeListener: vi.fn() }
      },
      tabs: {
        query: vi.fn(async () => [{ id: 42, url: "https://example.com" }]),
        get: vi.fn(async (id: number) => ({ id, url: "https://example.com" })),
        onCreated: { addListener: vi.fn() },
        onUpdated: { addListener: vi.fn() },
        onRemoved: { addListener: vi.fn() }
      }
    });

    const receivedChatEvents: unknown[] = [];
    const sessionEndPromise = new Promise<void>((resolve) => {
      wss!.on("connection", (socket) => {
        socket.on("message", (raw) => {
          const parsed = JSON.parse(raw.toString());
          if (parsed.type === "HELLO") {
            socket.send(JSON.stringify({
              type: "WELCOME", nonce: "wn", ts: Date.now(),
              protocol_version: PROTOCOL_VERSION,
              server_time: Date.now(), heartbeat_interval_ms: 20000
            }));
            socket.send(JSON.stringify({
              type: "START_CHAT_SESSION",
              nonce: "ns", ts: Date.now(), protocol_version: PROTOCOL_VERSION,
              session_id: "test-1",
              user_prompt: "采集所有评论",
              tab_id: "42",
              mock_llm: {
                rounds: [
                  [
                    { type: "text_delta", text: "采集完成 152 条" },
                    { type: "message_end", usage: { input_tokens: 1, output_tokens: 1 } }
                  ],
                  [
                    { type: "tool_use_start", id: "t1", name: "httpRequest" },
                    { type: "tool_use_input_delta", id: "t1", partial_json: "{\"url\":\"https://example.com\"}" },
                    { type: "tool_use_end", id: "t1", input: { url: "https://example.com" } },
                    { type: "message_end", usage: { input_tokens: 1, output_tokens: 1 } }
                  ],
                  [
                    { type: "text_delta", text: "确认已完成" },
                    { type: "message_end", usage: { input_tokens: 1, output_tokens: 1 } }
                  ]
                ]
              }
            }));
          } else if (parsed.type === "CHAT_EVENT") {
            receivedChatEvents.push(parsed.event);
            if (parsed.event.type === "session_end") resolve();
          }
        });
      });
    });

    const client = new CoordinatorClient({
      ws_url: baseUrl, token: "t", worker_id: "w",
      savedToolsProvider: async () => [],
      labelsProvider: async () => [],
      onChat: async (msg, send) => {
        // Use the real host with a fake runner — the continuation guard logic
        // we want to verify is in run-session.ts, not in the tool runner.
        const { CoordinatorChatHost } = await import("../../src/background/coordinator-chat");
        const host = new CoordinatorChatHost({
          pickActiveTab: async () => 42,
          urlFor: async () => "https://example.com",
          loadSystemPrompt: async () => "sys",
          runner: { async runStep() { return { ok: true }; } }
        });
        await host.handle(msg, send);
      }
    });
    await client.connect();
    await sessionEndPromise;
    await client.disconnect();

    const nudges = receivedChatEvents.filter(
      (e) => (e as { type?: string }).type === "continuation_nudge"
    );
    expect(nudges.length).toBe(1);
    const endEvents = receivedChatEvents.filter(
      (e) => (e as { type?: string }).type === "session_end"
    );
    expect(endEvents.length).toBe(1);
    expect((endEvents[0] as { status: string }).status).toBe("done");
  });
});
