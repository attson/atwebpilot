import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CoordinatorClient } from "../../src/background/coordinator-client";
import { PROTOCOL_VERSION } from "@atwebpilot/shared/protocol";

class FakeWS {
  static instances: FakeWS[] = [];
  readyState = 0; // CONNECTING
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  onopen: ((e: Event) => void) | null = null;
  onclose: ((e: CloseEvent) => void) | null = null;
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  sent: string[] = [];

  constructor(public url: string, public protocols?: string | string[]) {
    FakeWS.instances.push(this);
  }
  send(data: string) {
    this.sent.push(data);
  }
  close() {
    this.readyState = FakeWS.CLOSED;
    this.onclose?.({ code: 1000, reason: "client close" } as CloseEvent);
  }
  fakeOpen() {
    this.readyState = FakeWS.OPEN;
    this.onopen?.(new Event("open"));
  }
  fakeMessage(obj: unknown) {
    this.onmessage?.({ data: JSON.stringify(obj) } as MessageEvent);
  }
}

function fakeChrome() {
  const listeners: ((alarm: { name: string }) => void)[] = [];
  return {
    tabs: { query: vi.fn(async () => []) },
    runtime: { id: "ext-abc", getManifest: () => ({ version: "0.0.8" }) },
    storage: { local: { get: vi.fn(async () => ({})), set: vi.fn(async () => undefined), remove: vi.fn(async () => undefined) } },
    alarms: {
      create: vi.fn(),
      clear: vi.fn(async () => true),
      onAlarm: {
        addListener: vi.fn((cb: (alarm: { name: string }) => void) => listeners.push(cb)),
        removeListener: vi.fn()
      },
      _fire(name: string) {
        for (const cb of listeners) cb({ name });
      }
    }
  };
}

beforeEach(() => {
  FakeWS.instances = [];
  vi.stubGlobal("WebSocket", FakeWS);
  vi.stubGlobal("chrome", fakeChrome());
});

afterEach(() => {
  vi.useRealTimers();
});

describe("CoordinatorClient.connect", () => {
  it("opens a WebSocket to the configured URL with Authorization protocol", async () => {
    const client = new CoordinatorClient({
      ws_url: "ws://localhost:7842/worker",
      token: "wpk_xyz",
      worker_id: "worker_abc",
      savedToolsProvider: async () => [],
      labelsProvider: async () => []
    });
    await client.connect();
    const ws = FakeWS.instances[0];
    expect(ws.url).toBe("ws://localhost:7842/worker");
    expect(ws.protocols).toEqual(["bearer.wpk_xyz", `proto.${PROTOCOL_VERSION}`]);
  });

  it("sends HELLO on open", async () => {
    const client = new CoordinatorClient({
      ws_url: "ws://localhost:7842",
      token: "t",
      worker_id: "w1",
      savedToolsProvider: async () => [],
      labelsProvider: async () => []
    });
    await client.connect();
    FakeWS.instances[0].fakeOpen();
    await new Promise((r) => setTimeout(r, 0));
    const first = JSON.parse(FakeWS.instances[0].sent[0]);
    expect(first.type).toBe("HELLO");
    expect(first.worker_id).toBe("w1");
  });

  it("after WELCOME, status is connected", async () => {
    const client = new CoordinatorClient({
      ws_url: "ws://localhost:7842",
      token: "t",
      worker_id: "w1",
      savedToolsProvider: async () => [],
      labelsProvider: async () => []
    });
    await client.connect();
    const ws = FakeWS.instances[0];
    ws.fakeOpen();
    await new Promise((r) => setTimeout(r, 0));
    ws.fakeMessage({
      type: "WELCOME",
      nonce: "n",
      ts: 1,
      protocol_version: PROTOCOL_VERSION,
      server_time: 1,
      heartbeat_interval_ms: 20000
    });
    expect(client.status).toBe("connected");
  });

  it("chrome.alarms fires a PING from client to server (keepalive)", async () => {
    const client = new CoordinatorClient({
      ws_url: "ws://localhost:7842",
      token: "t",
      worker_id: "w1",
      savedToolsProvider: async () => [],
      labelsProvider: async () => []
    });
    await client.connect();
    const ws = FakeWS.instances[0];
    ws.fakeOpen();
    await new Promise((r) => setTimeout(r, 0));
    ws.fakeMessage({
      type: "WELCOME",
      nonce: "n",
      ts: 1,
      protocol_version: PROTOCOL_VERSION,
      server_time: 1,
      heartbeat_interval_ms: 20000
    });
    await new Promise((r) => setTimeout(r, 0));
    ws.sent.length = 0; // clear HELLO
    // Trigger the heartbeat alarm
    const chromeMock = (globalThis as unknown as { chrome: { alarms: { _fire: (name: string) => void } } }).chrome;
    chromeMock.alarms._fire("atwebpilot-coordinator-heartbeat");
    await new Promise((r) => setTimeout(r, 0));
    expect(ws.sent.length).toBe(1);
    const ping = JSON.parse(ws.sent[0]);
    expect(ping.type).toBe("PING");
    expect(ping.protocol_version).toBe(PROTOCOL_VERSION);
  });

  it("ignores server PONG (no client reply)", async () => {
    const client = new CoordinatorClient({
      ws_url: "ws://localhost:7842",
      token: "t",
      worker_id: "w1",
      savedToolsProvider: async () => [],
      labelsProvider: async () => []
    });
    await client.connect();
    const ws = FakeWS.instances[0];
    ws.fakeOpen();
    await new Promise((r) => setTimeout(r, 0));
    ws.fakeMessage({
      type: "WELCOME",
      nonce: "n",
      ts: 1,
      protocol_version: PROTOCOL_VERSION,
      server_time: 1,
      heartbeat_interval_ms: 20000
    });
    ws.sent.length = 0;
    ws.fakeMessage({
      type: "PONG",
      nonce: "pong-nonce",
      ts: 2,
      protocol_version: PROTOCOL_VERSION,
      echo_nonce: "client-ping-nonce"
    });
    await new Promise((r) => setTimeout(r, 0));
    expect(ws.sent.length).toBe(0); // No reply
    expect(client.status).toBe("connected");
  });

  it("disconnect closes the socket and sets status=disconnected", async () => {
    const client = new CoordinatorClient({
      ws_url: "ws://localhost:7842",
      token: "t",
      worker_id: "w1",
      savedToolsProvider: async () => [],
      labelsProvider: async () => []
    });
    await client.connect();
    await client.disconnect();
    expect(client.status).toBe("disconnected");
    expect(FakeWS.instances[0].readyState).toBe(FakeWS.CLOSED);
  });

  it("rejects WELCOME with mismatched protocol_version and disconnects", async () => {
    const client = new CoordinatorClient({
      ws_url: "ws://localhost:7842",
      token: "t",
      worker_id: "w1",
      savedToolsProvider: async () => [],
      labelsProvider: async () => []
    });
    await client.connect();
    const ws = FakeWS.instances[0];
    ws.fakeOpen();
    await new Promise((r) => setTimeout(r, 0));
    ws.fakeMessage({
      type: "WELCOME",
      nonce: "n",
      ts: 1,
      protocol_version: PROTOCOL_VERSION + 99,
      server_time: 1,
      heartbeat_interval_ms: 20000
    });
    await new Promise((r) => setTimeout(r, 0));
    expect(client.status).toBe("error");
    expect(ws.readyState).toBe(FakeWS.CLOSED);
  });

  it("routes START_CHAT_SESSION to onChat handler", async () => {
    const onChat = vi.fn(async () => undefined);
    const client = new CoordinatorClient({
      ws_url: "ws://x",
      token: "t",
      worker_id: "w",
      savedToolsProvider: async () => [],
      labelsProvider: async () => [],
      onChat
    });
    await (client as unknown as { handleMessage: (raw: unknown) => Promise<void> }).handleMessage(
      JSON.stringify({
        nonce: "n",
        ts: 0,
        protocol_version: PROTOCOL_VERSION,
        type: "START_CHAT_SESSION",
        session_id: "s1",
        user_prompt: "hi"
      })
    );
    expect(onChat).toHaveBeenCalledTimes(1);
  });

  it("routes ABORT_SESSION to onChat handler", async () => {
    const onChat = vi.fn(async () => undefined);
    const client = new CoordinatorClient({
      ws_url: "ws://x",
      token: "t",
      worker_id: "w",
      savedToolsProvider: async () => [],
      labelsProvider: async () => [],
      onChat
    });
    await (client as unknown as { handleMessage: (raw: unknown) => Promise<void> }).handleMessage(
      JSON.stringify({
        nonce: "n",
        ts: 0,
        protocol_version: PROTOCOL_VERSION,
        type: "ABORT_SESSION",
        session_id: "s1"
      })
    );
    expect(onChat).toHaveBeenCalledTimes(1);
  });

  it("routes READ_SIDEPANEL_STATE to onReadState handler", async () => {
    const onReadState = vi.fn(async () => undefined);
    const client = new CoordinatorClient({
      ws_url: "ws://x",
      token: "t",
      worker_id: "w",
      savedToolsProvider: async () => [],
      labelsProvider: async () => [],
      onReadState
    });
    await (client as unknown as { handleMessage: (raw: unknown) => Promise<void> }).handleMessage(
      JSON.stringify({
        nonce: "n",
        ts: 0,
        protocol_version: PROTOCOL_VERSION,
        type: "READ_SIDEPANEL_STATE",
        req_id: "r1",
        tab_id: "42"
      })
    );
    expect(onReadState).toHaveBeenCalledTimes(1);
  });

  it("EXEC delivery is forwarded to the injected handler", async () => {
    const execHandler = vi.fn().mockResolvedValue({
      type: "RESULT",
      nonce: "rn",
      ts: 1,
      protocol_version: PROTOCOL_VERSION,
      req_id: "r1",
      ok: true,
      return: { x: 1 }
    });
    const client = new CoordinatorClient({
      ws_url: "ws://localhost:7842",
      token: "t",
      worker_id: "w1",
      savedToolsProvider: async () => [],
      labelsProvider: async () => [],
      onExec: execHandler
    });
    await client.connect();
    const ws = FakeWS.instances[0];
    ws.fakeOpen();
    await new Promise((r) => setTimeout(r, 0));
    ws.fakeMessage({
      type: "WELCOME",
      nonce: "n",
      ts: 1,
      protocol_version: PROTOCOL_VERSION,
      server_time: 1,
      heartbeat_interval_ms: 20000
    });
    ws.sent.length = 0;
    ws.fakeMessage({
      type: "EXEC",
      nonce: "e",
      ts: 2,
      protocol_version: PROTOCOL_VERSION,
      req_id: "r1",
      session_id: "s1",
      tab_id: "42",
      step: { kind: "tool", tool: "snapshotDOM", args: {} }
    });
    await new Promise((r) => setTimeout(r, 0));
    expect(execHandler).toHaveBeenCalledTimes(1);
    const sent = JSON.parse(ws.sent[0]);
    expect(sent.type).toBe("RESULT");
    expect(sent.req_id).toBe("r1");
  });
});
