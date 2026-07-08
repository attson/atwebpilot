/**
 * Tests for the cross-process approval decision relay.
 *
 * Simulates two independent JS contexts (widget + sidepanel) each holding
 * their own approversByTab module-level map. In tests we use a single module
 * import but exercise the broadcast path by directly invoking the listener
 * callback that installApprovalListener registers.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

// ── chrome stub ──────────────────────────────────────────────────────────────
const listeners: Array<(msg: unknown) => void> = [];
(globalThis as unknown as Record<string, unknown>).chrome = {
  runtime: {
    sendMessage: vi.fn().mockResolvedValue(undefined),
    onMessage: {
      addListener: vi.fn((cb: (msg: unknown) => void) => listeners.push(cb)),
      removeListener: vi.fn((cb: (msg: unknown) => void) => {
        const i = listeners.indexOf(cb);
        if (i >= 0) listeners.splice(i, 1);
      }),
    },
  },
};

/** Deliver a raw message to all registered onMessage listeners */
function deliver(msg: unknown): void {
  for (const l of listeners) l(msg);
}

describe("approval-broadcast", () => {
  beforeEach(() => {
    listeners.length = 0;
    vi.clearAllMocks();
  });

  it("broadcastApprovalDecision fires chrome.runtime.sendMessage with correct shape", async () => {
    const { broadcastApprovalDecision } = await import("@/sidepanel/chat/approval");
    broadcastApprovalDecision(42, "tool-001", { kind: "run" });
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      type: "approval.decision",
      tabId: 42,
      toolUseId: "tool-001",
      decision: { kind: "run" },
    });
  });

  it("installApprovalListener resolves a local pending promise when a relayed message arrives", async () => {
    const { Approver, installApprovalListener, registerApproverForTab } = await import(
      "@/sidepanel/chat/approval"
    );

    // Simulate widget context: Approver instance registered under tabId 42
    const widgetApprover = new Approver();
    registerApproverForTab(42, widgetApprover);

    // Widget is awaiting a decision
    const pending = widgetApprover.request("tool-abc");

    // Install the listener (mimics what react-root.tsx does on mount)
    const unsubscribe = installApprovalListener();

    // Sidepanel "sends" its decision via chrome.runtime.sendMessage — in tests
    // we simulate the delivery directly via deliver()
    deliver({
      type: "approval.decision",
      tabId: 42,
      toolUseId: "tool-abc",
      decision: { kind: "skip" },
    });

    const decision = await pending;
    expect(decision).toEqual({ kind: "skip" });

    unsubscribe();
    // Listener should be removed
    expect(listeners).toHaveLength(0);
  });

  it("installApprovalListener ignores messages for unknown tabIds silently", async () => {
    const { installApprovalListener } = await import("@/sidepanel/chat/approval");
    const unsubscribe = installApprovalListener();

    // No approver registered for tabId 999 — should be a no-op (no throw)
    expect(() =>
      deliver({
        type: "approval.decision",
        tabId: 999,
        toolUseId: "tool-xyz",
        decision: { kind: "deny" },
      })
    ).not.toThrow();

    unsubscribe();
  });

  it("installApprovalListener ignores messages with _relayed=true to prevent loops", async () => {
    const { Approver, registerApproverForTab, installApprovalListener } = await import(
      "@/sidepanel/chat/approval"
    );

    const approver = new Approver();
    registerApproverForTab(77, approver);
    const pending = approver.request("tool-loop");

    const unsubscribe = installApprovalListener();

    // Message with _relayed=true must be ignored
    deliver({
      type: "approval.decision",
      tabId: 77,
      toolUseId: "tool-loop",
      decision: { kind: "run" },
      _relayed: true,
    });

    // The promise should still be pending — we race with a short timeout
    let resolved = false;
    void pending.then(() => {
      resolved = true;
    });
    // Give microtasks a chance to settle
    await new Promise((r) => setTimeout(r, 10));
    expect(resolved).toBe(false);

    // Manually resolve to clean up
    approver.resolve("tool-loop", { kind: "deny" });
    await pending;

    unsubscribe();
  });

  it("installApprovalListener only forwards if local approver has(toolUseId)", async () => {
    const { Approver, registerApproverForTab, installApprovalListener } = await import(
      "@/sidepanel/chat/approval"
    );

    const approver = new Approver();
    registerApproverForTab(55, approver);
    // NOT requesting tool-orphan — approver.has() will return false

    const unsubscribe = installApprovalListener();
    // Should be a no-op, no throw
    expect(() =>
      deliver({
        type: "approval.decision",
        tabId: 55,
        toolUseId: "tool-orphan",
        decision: { kind: "run" },
      })
    ).not.toThrow();

    unsubscribe();
  });

  it("getApproverForTab returns same instance after registerApproverForTab", async () => {
    const { Approver, registerApproverForTab, getApproverForTab } = await import(
      "@/sidepanel/chat/approval"
    );
    const myApprover = new Approver();
    registerApproverForTab(88, myApprover);
    expect(getApproverForTab(88)).toBe(myApprover);
  });
});
