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
