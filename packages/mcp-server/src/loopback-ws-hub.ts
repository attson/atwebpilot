import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage } from "node:http";
import type { AddressInfo } from "node:net";
import {
  ClientToServerSchema,
  ServerToClientSchema,
  PROTOCOL_VERSION,
  type ClientToServer,
  type ServerToClient,
  type Result,
} from "@atwebpilot/shared/protocol";
import type { Json } from "@atwebpilot/shared";
import type { WSHub, Clock, IdGen } from "@atwebpilot/coordinator";

const HEARTBEAT_INTERVAL_MS = 20000;

export interface LoopbackWSHubOpts {
  port: number;
  token?: string;
  clock: Clock;
  idGen: IdGen;
  execTimeoutMs?: number;
}

type Pending = {
  resolve: (r: Result) => void;
  reject: (e: Error) => void;
  timer: ReturnType<typeof setTimeout>;
  worker_id: string;
};

export class LoopbackWSHub implements WSHub {
  private wss: WebSocketServer;
  private byWorker = new Map<string, WebSocket>();
  private workerOf = new Map<WebSocket, string>();
  private pending = new Map<string, Pending>();
  private msgHandlers: Array<(worker_id: string, msg: ClientToServer) => void> = [];
  private disconnectHandlers: Array<(worker_id: string) => void> = [];
  private execTimeoutMs: number;

  constructor(private opts: LoopbackWSHubOpts) {
    this.execTimeoutMs = opts.execTimeoutMs ?? 30000;
    this.wss = new WebSocketServer({
      port: opts.port,
      path: "/worker",
      handleProtocols: (protocols: Set<string>) => [...protocols][0] ?? false,
    });
    this.wss.on("connection", (socket, req) => this.onConnection(socket, req));
  }

  ready(): Promise<number> {
    return new Promise((resolve) => {
      const addr = this.wss.address();
      if (addr) return resolve((addr as AddressInfo).port);
      this.wss.on("listening", () =>
        resolve((this.wss.address() as AddressInfo).port)
      );
    });
  }

  close(): Promise<void> {
    for (const p of this.pending.values()) {
      clearTimeout(p.timer);
      p.reject(new Error("hub closing"));
    }
    this.pending.clear();
    // Terminate all open client sockets so wss.close() resolves promptly.
    for (const socket of this.wss.clients) {
      socket.terminate();
    }
    return new Promise((resolve) => this.wss.close(() => resolve()));
  }

  private tokenOk(req: IncomingMessage): boolean {
    if (!this.opts.token) return true;
    const offered = String(req.headers["sec-websocket-protocol"] ?? "")
      .split(",")
      .map((s) => s.trim());
    return offered.includes(`bearer.${this.opts.token}`);
  }

  private onConnection(socket: WebSocket, req: IncomingMessage): void {
    if (!this.tokenOk(req)) {
      socket.close(4401, "bad token");
      return;
    }
    socket.on("message", (raw) => this.onMessageRaw(socket, raw.toString()));
    socket.on("close", () => this.onSocketClose(socket));
    socket.on("error", () => {
      /* close event handles cleanup */
    });
  }

  private onMessageRaw(socket: WebSocket, raw: string): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }
    const r = ClientToServerSchema.safeParse(parsed);
    if (!r.success) return;
    const msg = r.data;

    if (msg.type === "HELLO") {
      // I2: If an existing (different) socket is already registered for this worker_id,
      // detach it silently before registering the new one — this is a reconnect, not a
      // disconnect.  We remove the old socket from workerOf FIRST so that when its
      // close event fires later, onSocketClose sees no worker_id for it and no-ops,
      // preventing a spurious disconnect callback.
      const existingSocket = this.byWorker.get(msg.worker_id);
      if (existingSocket && existingSocket !== socket) {
        this.workerOf.delete(existingSocket);
        // Reject in-flight execs for this worker — the old socket is gone and the
        // new worker won't know those req_ids, so they would stall until timeout.
        for (const [req_id, p] of [...this.pending]) {
          if (p.worker_id === msg.worker_id) {
            clearTimeout(p.timer);
            this.pending.delete(req_id);
            p.reject(new Error(`worker ${msg.worker_id} reconnected, exec cancelled`));
          }
        }
        existingSocket.terminate();
      }
      this.byWorker.set(msg.worker_id, socket);
      this.workerOf.set(socket, msg.worker_id);
      this.rawSend(socket, {
        type: "WELCOME",
        nonce: this.opts.idGen.next("nonce"),
        ts: this.opts.clock.now(),
        protocol_version: PROTOCOL_VERSION,
        server_time: this.opts.clock.now(),
        heartbeat_interval_ms: HEARTBEAT_INTERVAL_MS,
      });
      for (const h of this.msgHandlers) h(msg.worker_id, msg);
      return;
    }

    if (msg.type === "RESULT") {
      const p = this.pending.get(msg.req_id);
      if (p) {
        clearTimeout(p.timer);
        this.pending.delete(msg.req_id);
        p.resolve(msg);
      }
      return;
    }

    const wid = this.workerOf.get(socket);
    if (wid) {
      for (const h of this.msgHandlers) h(wid, msg);
    }
  }

  private onSocketClose(socket: WebSocket): void {
    const wid = this.workerOf.get(socket);
    if (!wid) return;
    this.workerOf.delete(socket);
    this.byWorker.delete(wid);
    for (const [req_id, p] of [...this.pending]) {
      if (p.worker_id === wid) {
        clearTimeout(p.timer);
        this.pending.delete(req_id);
        p.reject(new Error(`worker ${wid} disconnected`));
      }
    }
    for (const h of this.disconnectHandlers) h(wid);
  }

  private rawSend(socket: WebSocket, msg: ServerToClient): void {
    const r = ServerToClientSchema.safeParse(msg);
    if (!r.success) {
      console.error("[hub] outgoing failed schema", r.error);
      return;
    }
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(msg));
    }
  }

  exec(
    worker_id: string,
    params: {
      session_id: string;
      tab_id: string;
      step: { tool: string; args: unknown };
    }
  ): Promise<Result> {
    const socket = this.byWorker.get(worker_id);
    if (!socket)
      return Promise.reject(new Error(`worker ${worker_id} not connected`));
    const req_id = this.opts.idGen.next("req");
    return new Promise<Result>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(req_id);
        reject(
          new Error(`EXEC ${req_id} timeout after ${this.execTimeoutMs}ms`)
        );
      }, this.execTimeoutMs);
      this.pending.set(req_id, { resolve, reject, timer, worker_id });
      this.rawSend(socket, {
        type: "EXEC",
        nonce: this.opts.idGen.next("nonce"),
        ts: this.opts.clock.now(),
        protocol_version: PROTOCOL_VERSION,
        req_id,
        session_id: params.session_id,
        tab_id: params.tab_id,
        step: { tool: params.step.tool, args: params.step.args as Json },
      });
      // I1: TOCTOU guard — the socket may have closed during rawSend (and onSocketClose
      // may have already run).  If the socket is no longer the current one for this
      // worker, the close event won't clean up this pending entry (onSocketClose already
      // ran or will run for a different socket).  Reject immediately so the promise
      // doesn't hang until timeout.
      if (this.byWorker.get(worker_id) !== socket) {
        clearTimeout(timer);
        this.pending.delete(req_id);
        reject(new Error(`worker ${worker_id} disconnected`));
      }
    });
  }

  async send(worker_id: string, msg: ServerToClient): Promise<void> {
    const socket = this.byWorker.get(worker_id);
    if (!socket) throw new Error(`worker ${worker_id} not connected`);
    this.rawSend(socket, msg);
  }

  onMessage(
    handler: (worker_id: string, msg: ClientToServer) => void
  ): void {
    this.msgHandlers.push(handler);
  }

  onDisconnect(handler: (worker_id: string) => void): void {
    this.disconnectHandlers.push(handler);
  }

  connectedWorkers(): string[] {
    return [...this.byWorker.keys()];
  }

  // Intentionally fire-and-forget: actual cleanup (byWorker/workerOf removal and
  // pending-exec rejection) happens asynchronously via the socket's close event.
  // v1 callers do not await this method.
  async disconnect(worker_id: string, _reason: string): Promise<void> {
    const socket = this.byWorker.get(worker_id);
    if (socket) socket.close();
  }
}
