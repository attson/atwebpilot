export type Decision = { kind: "run" } | { kind: "skip" } | { kind: "deny" };

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
