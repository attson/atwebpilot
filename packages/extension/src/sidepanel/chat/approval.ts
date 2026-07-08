export type Decision =
  | { kind: "run" }
  | { kind: "run-and-always-allow"; toolName: string }
  | { kind: "skip" }
  | { kind: "deny" };

/** Message shape for cross-process approval relay via chrome.runtime.sendMessage */
export interface ApprovalDecisionMsg {
  type: "approval.decision";
  tabId: number;
  toolUseId: string;
  decision: Decision;
  /** Set to true on the re-broadcast to prevent listener loops */
  _relayed?: boolean;
}

export class Approver {
  private pending = new Map<string, (d: Decision) => void>();

  request(toolUseId: string): Promise<Decision> {
    return new Promise((resolve) => {
      this.pending.set(toolUseId, resolve);
    });
  }

  resolve(toolUseId: string, decision: Decision): void {
    const r = this.pending.get(toolUseId);
    if (!r) return;
    this.pending.delete(toolUseId);
    r(decision);
  }

  resolveAllPending(decision: Decision): void {
    for (const [id, r] of this.pending) {
      r(decision);
      this.pending.delete(id);
    }
  }

  has(toolUseId: string): boolean {
    return this.pending.has(toolUseId);
  }
}

const approversByTab = new Map<number, Approver>();

export function getApproverForTab(tabId: number): Approver {
  let a = approversByTab.get(tabId);
  if (!a) {
    a = new Approver();
    approversByTab.set(tabId, a);
  }
  return a;
}

/**
 * Register an externally-created Approver subclass in the per-tab map so that
 * the broadcast relay and Panel.handleApprove can reach it via getApproverForTab.
 * A previous instance is disposed (all pending resolved as "deny") before replacement.
 */
export function registerApproverForTab(tabId: number, approver: Approver): void {
  const prev = approversByTab.get(tabId);
  if (prev && prev !== approver) {
    prev.resolveAllPending({ kind: "deny" });
  }
  approversByTab.set(tabId, approver);
}

export function disposeApproverForTab(tabId: number): void {
  const a = approversByTab.get(tabId);
  if (!a) return;
  a.resolveAllPending({ kind: "deny" });
  approversByTab.delete(tabId);
}

/**
 * @deprecated Plan 4 transitional: existing callsites that haven't migrated
 * still call getGlobalApprover(); routes to the tabId=-1 instance.
 */
export function getGlobalApprover(): Approver {
  return getApproverForTab(-1);
}

/**
 * Broadcast an approval decision to all extension contexts (sidepanel + widget
 * content-scripts) so that the host which does NOT hold the awaiting promise
 * can still forward the decision to the one that does.
 *
 * This is a fire-and-forget; errors are silently swallowed so a missing
 * receiver (e.g. sidepanel not open) never surfaces as a runtime exception.
 */
export function broadcastApprovalDecision(
  tabId: number,
  toolUseId: string,
  decision: Decision
): void {
  const msg: ApprovalDecisionMsg = {
    type: "approval.decision",
    tabId,
    toolUseId,
    decision,
  };
  // Ignore errors — the other context may simply not be open
  void chrome.runtime.sendMessage(msg).catch(() => {});
}

/**
 * Install a module-level chrome.runtime.onMessage listener that catches
 * approval decisions originating from the OTHER extension context and
 * forwards them into the local approversByTab map.
 *
 * Call once per context (widget react-root, sidepanel app-shell).
 * Returns an unsubscribe function.
 */
export function installApprovalListener(): () => void {
  function onMessage(msg: unknown): void {
    if (!msg || typeof msg !== "object") return;
    const m = msg as Partial<ApprovalDecisionMsg>;
    if (m.type !== "approval.decision" || m._relayed) return;
    const { tabId, toolUseId, decision } = m;
    if (tabId == null || toolUseId == null || decision == null) return;
    const approver = approversByTab.get(tabId);
    if (!approver) return;
    // Only forward if this context actually holds the pending promise
    if (!approver.has(toolUseId)) return;
    approver.resolve(toolUseId, decision);
  }
  chrome.runtime.onMessage.addListener(onMessage);
  return () => chrome.runtime.onMessage.removeListener(onMessage);
}
