import {
  PROTOCOL_VERSION,
  ClientToServerSchema,
  ServerToClientSchema,
  type AbortSession,
  type ClientToServer,
  type Exec,
  type Hello,
  type ReadSidepanelState,
  type Result,
  type ServerToClient,
  type StartChatSession
} from "@webpilot/shared/protocol";
import { buildHello } from "./coordinator-hello";

const HEARTBEAT_ALARM = "webpilot-coordinator-heartbeat";
const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;

export type ClientStatus = "disconnected" | "connecting" | "connected" | "error";

export interface CoordinatorClientOptions {
  ws_url: string;
  token: string;
  worker_id: string;
  savedToolsProvider: () => Promise<Hello["saved_tools"]>;
  labelsProvider: () => Promise<string[]>;
  onExec?: (exec: Exec) => Promise<Result>;
  onChat?: (
    msg: StartChatSession | AbortSession,
    send: (m: ClientToServer) => void
  ) => Promise<void>;
  onReadState?: (
    msg: ReadSidepanelState,
    send: (m: ClientToServer) => void
  ) => Promise<void>;
  onStatusChange?: (s: ClientStatus) => void;
}

function randomNonce(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export class CoordinatorClient {
  private ws: WebSocket | null = null;
  private _status: ClientStatus = "disconnected";
  private reconnectAttempts = 0;
  private alarmListener: ((alarm: { name: string }) => void) | null = null;
  private intentionallyClosed = false;

  constructor(private opts: CoordinatorClientOptions) {}

  get status(): ClientStatus {
    return this._status;
  }

  private setStatus(s: ClientStatus): void {
    this._status = s;
    this.opts.onStatusChange?.(s);
  }

  async connect(): Promise<void> {
    this.intentionallyClosed = false;
    this.setStatus("connecting");
    const protocols = [`bearer.${this.opts.token}`, `proto.${PROTOCOL_VERSION}`];
    this.ws = new WebSocket(this.opts.ws_url, protocols);
    this.ws.onopen = () => this.handleOpen();
    this.ws.onclose = () => this.handleClose();
    this.ws.onerror = () => this.setStatus("error");
    this.ws.onmessage = (ev) => this.handleMessage(ev.data);
    this.installAlarm();
  }

  async disconnect(): Promise<void> {
    this.intentionallyClosed = true;
    this.uninstallAlarm();
    this.ws?.close();
    this.ws = null;
    this.setStatus("disconnected");
  }

  private async handleOpen(): Promise<void> {
    try {
      const saved_tools = await this.opts.savedToolsProvider();
      const labels = await this.opts.labelsProvider();
      const hello = await buildHello({
        worker_id: this.opts.worker_id,
        saved_tools,
        labels
      });
      this.send(hello);
    } catch (err) {
      console.error("[coordinator-client] failed to send HELLO", err);
      this.setStatus("error");
      this.ws?.close();
    }
  }

  private async handleMessage(raw: unknown): Promise<void> {
    let parsed: unknown;
    try {
      parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch {
      console.warn("[coordinator-client] malformed message", raw);
      return;
    }

    const result = ServerToClientSchema.safeParse(parsed);
    if (!result.success) {
      console.warn("[coordinator-client] failed to validate server message", parsed);
      return;
    }
    const msg: ServerToClient = result.data;
    switch (msg.type) {
      case "WELCOME":
        if (msg.protocol_version !== PROTOCOL_VERSION) {
          console.error("[coordinator-client] protocol version mismatch",
            msg.protocol_version, "expected", PROTOCOL_VERSION);
          this.setStatus("error");
          this.ws?.close();
          return;
        }
        this.reconnectAttempts = 0;
        this.setStatus("connected");
        return;
      case "PONG":
        // Server acknowledged our PING — connection is alive. Nothing to do.
        return;
      case "OPEN_TAB":
        // Phase 2: ignore — tab management is a Phase 3 concern when daemon ships
        return;
      case "EXEC":
        if (!this.opts.onExec) {
          console.warn("[coordinator-client] received EXEC but no onExec configured");
          return;
        }
        try {
          const execResult = await this.opts.onExec(msg);
          this.send(execResult);
        } catch (err) {
          console.error("[coordinator-client] onExec threw", err);
        }
        return;
      case "CLOSE_SESSION":
        // Phase 2: ignore — sessions are coordinator-managed
        return;
      case "START_CHAT_SESSION":
      case "ABORT_SESSION":
        if (this.opts.onChat) {
          try {
            await this.opts.onChat(msg, (m) => this.send(m));
          } catch (err) {
            console.error("[coordinator-client] onChat threw", err);
          }
        }
        return;
      case "READ_SIDEPANEL_STATE":
        if (this.opts.onReadState) {
          try {
            await this.opts.onReadState(msg, (m) => this.send(m));
          } catch (err) {
            console.error("[coordinator-client] onReadState threw", err);
          }
        }
        return;
    }
  }

  private send(msg: unknown): void {
    if (this.ws?.readyState !== 1) return; // 1 = WebSocket.OPEN
    const r = ClientToServerSchema.safeParse(msg);
    if (!r.success) {
      console.error("[coordinator-client] outgoing message failed schema", r.error);
      return;
    }
    this.ws.send(JSON.stringify(msg));
  }

  private handleClose(): void {
    this.uninstallAlarm();
    if (this.intentionallyClosed) {
      this.setStatus("disconnected");
      return;
    }
    // Don't overwrite an already-set error status (e.g. protocol version mismatch
    // sets "error" then immediately closes the socket, which would fire handleClose).
    if (this._status !== "error") {
      this.setStatus("disconnected");
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    this.reconnectAttempts += 1;
    const backoff = Math.min(
      RECONNECT_BASE_MS * 2 ** (this.reconnectAttempts - 1),
      RECONNECT_MAX_MS
    );
    setTimeout(() => {
      if (this.intentionallyClosed) return;
      void this.connect();
    }, backoff);
  }

  private installAlarm(): void {
    if (!chrome.alarms || this.alarmListener) return;
    chrome.alarms.create(HEARTBEAT_ALARM, { periodInMinutes: 0.25 }); // 15s
    this.alarmListener = (alarm) => {
      if (alarm.name !== HEARTBEAT_ALARM) return;
      this.send({
        type: "PING",
        nonce: randomNonce(),
        ts: Date.now(),
        protocol_version: PROTOCOL_VERSION
      });
    };
    chrome.alarms.onAlarm.addListener(this.alarmListener);
  }

  private uninstallAlarm(): void {
    if (this.alarmListener) {
      chrome.alarms?.onAlarm.removeListener(this.alarmListener);
      this.alarmListener = null;
    }
    void chrome.alarms?.clear(HEARTBEAT_ALARM);
  }
}
