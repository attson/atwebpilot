import { Catalog, type CatalogEntry } from "./catalog";
import { Dispatcher, type DispatchInput, type DispatchValidation } from "./dispatcher";
import {
  SessionManager,
  type OpenSessionInput
} from "./session-manager";
import { WorkerRegistry } from "./worker-registry";
import type { Clock, IdGen } from "./clock";
import type { WSHub } from "./ws-hub";
import type { Session, Worker, Quota } from "./types";

export interface CoordinatorDeps {
  hub: WSHub;
  clock: Clock;
  idGen: IdGen;
}

/**
 * Façade over the 4 internal state machines. Public methods are the verbs
 * the MCP server (Phase 3) and REST server (Phase 4) will both call.
 *
 * Coordinator is hub-aware: it sends OPEN_TAB / EXEC / CLOSE_SESSION messages
 * via this.hub.send(...). Reading messages back from workers is the consumer's
 * responsibility: they wire hub.onMessage(...) and call back into the
 * coordinator's handle* methods.
 */
export class Coordinator {
  readonly sessions: SessionManager;
  readonly workers: WorkerRegistry;
  readonly catalog: Catalog;
  readonly dispatcher: Dispatcher;
  readonly hub: WSHub;

  constructor(deps: CoordinatorDeps) {
    this.hub = deps.hub;
    this.sessions = new SessionManager(deps.clock, deps.idGen);
    this.workers = new WorkerRegistry(deps.clock);
    this.catalog = new Catalog(this.workers);
    this.dispatcher = new Dispatcher(this.sessions);
  }

  // === Worker lifecycle ===
  registerWorker(w: Worker): void {
    this.workers.register(w);
    this.sessions.resumeByWorker(w.id, new Set(/* will be filled from STATE_SNAPSHOT later */));
  }

  unregisterWorker(id: string): void {
    this.workers.unregister(id);
    this.sessions.pauseByWorker(id);
  }

  heartbeatWorker(id: string): void {
    this.workers.heartbeat(id);
  }

  // === Session lifecycle ===
  openSession(input: OpenSessionInput): Session {
    return this.sessions.open(input);
  }

  closeSession(id: string): void {
    this.sessions.close(id);
  }

  // === Tool calls ===
  validateCall(input: DispatchInput): DispatchValidation {
    return this.dispatcher.validate(input);
  }

  /** Apply quota side-effects after a successful validation. Call before sending EXEC. */
  recordCall(session_id: string, dangerous: boolean): void {
    this.sessions.touch(session_id, { dangerous });
  }

  // === Catalog & quota ===
  listToolsForSession(session_id: string): CatalogEntry[] | undefined {
    const s = this.sessions.get(session_id);
    if (!s) return undefined;
    const worker = this.workers.get(s.worker_id);
    if (!worker) return [];
    const tabUrl = worker.available_tabs.find((t) => t.tab_id === s.tab_id)?.url ?? "";
    return this.catalog.listFor(tabUrl);
  }

  quotaFor(session_id: string): Quota | undefined {
    return this.sessions.quota(session_id);
  }

  // === Periodic housekeeping ===
  tick(): { expired_sessions: string[] } {
    const expired_sessions = this.sessions.tick();
    return { expired_sessions };
  }
}
