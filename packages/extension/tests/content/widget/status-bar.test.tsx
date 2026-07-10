import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { StatusBar } from "@/content/widget/status-bar";
import type { SessionData } from "@/sidepanel/chat/session-store";

function makeSession(patch: Partial<SessionData>): SessionData {
  return {
    tabId: 1, url: "", runRecordId: null,
    messages: [], streamingAssistantText: "", cards: [],
    status: "idle", errorMessage: null, roundCount: 0,
    tokenUsage: { input: 0, output: 0 },
    executedSteps: [], lastOutput: null, showSaveDialog: false,
    abortController: null, logs: [], logsOpen: false,
    inputDraft: "", attachedTabs: [], llmExchanges: [],
    permissionMode: "default", debugBadge: null,
    chatMode: "compact", _rev: 0,
    ...patch,
  } as SessionData;
}

describe("StatusBar", () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it("renders nothing on idle", async () => {
    await act(async () =>
      root.render(<StatusBar session={makeSession({ status: "idle" })} />)
    );
    expect(container.querySelector("[data-testid=widget-status-bar]")).toBeNull();
  });

  it("shows running tool name + elapsed when a card is running", async () => {
    const started = Date.now() - 2300;
    const sess = makeSession({
      status: "running",
      cards: [{
        toolUseId: "u1", name: "snapshotDOM", input: {} as any,
        partialJson: "", inputReady: true, status: "running",
        _runningStartAt: started,
      }],
    });
    await act(async () => root.render(<StatusBar session={sess} />));
    const bar = container.querySelector("[data-testid=widget-status-bar]")!;
    expect(bar.textContent).toContain("snapshotDOM");
    expect(bar.textContent).toMatch(/2\.\d+s/);
  });

  it("shows 思考中 on streaming without a running card", async () => {
    await act(async () =>
      root.render(<StatusBar session={makeSession({ status: "streaming" })} />)
    );
    const bar = container.querySelector("[data-testid=widget-status-bar]")!;
    expect(bar.textContent).toContain("AI 思考");
  });

  it("shows 等待确认 on awaiting", async () => {
    await act(async () =>
      root.render(<StatusBar session={makeSession({ status: "awaiting" })} />)
    );
    const bar = container.querySelector("[data-testid=widget-status-bar]")!;
    expect(bar.textContent).toContain("等待你确认");
  });
});
