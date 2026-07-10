import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ensureSession, upsertCard, setCardStatus, useStore
} from "@/sidepanel/chat/session-store";

(globalThis as any).chrome = {
  runtime: { sendMessage: vi.fn() }
};

describe("setCardStatus stamps _runningStartAt on running", () => {
  beforeEach(() => {
    useStore.setState({ sessionsByTab: {}, currentTabId: null });
  });

  it("stamps _runningStartAt when status transitions to running", () => {
    ensureSession(1, "https://x/");
    upsertCard(1, {
      toolUseId: "u1", name: "snapshotDOM", input: {} as any,
      partialJson: "", inputReady: true, status: "awaiting"
    });
    const before = Date.now();
    setCardStatus(1, "u1", { status: "running" });
    const after = Date.now();
    const c = useStore.getState().sessionsByTab[1].cards.find((x) => x.toolUseId === "u1")!;
    expect(c._runningStartAt).toBeGreaterThanOrEqual(before);
    expect(c._runningStartAt).toBeLessThanOrEqual(after);
  });

  it("does not stamp on non-running transitions", () => {
    ensureSession(2, "https://y/");
    upsertCard(2, {
      toolUseId: "u2", name: "click", input: {} as any,
      partialJson: "", inputReady: true, status: "awaiting"
    });
    setCardStatus(2, "u2", { status: "ok" });
    const c = useStore.getState().sessionsByTab[2].cards.find((x) => x.toolUseId === "u2")!;
    expect(c._runningStartAt).toBeUndefined();
  });
});
