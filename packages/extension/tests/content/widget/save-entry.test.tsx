import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { SaveEntry } from "@/content/widget/save-entry";
import type { SessionData } from "@/sidepanel/chat/session-store";

const mockOpenSidepanelWithSave = vi.fn().mockResolvedValue(null);
vi.mock("@/sidepanel/rpc", () => ({
  rpc: { widgetOpenSidepanelWithSave: (input: any) => mockOpenSidepanelWithSave(input) },
}));

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

describe("SaveEntry", () => {
  let root: Root;
  let container: HTMLDivElement;
  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    vi.clearAllMocks();
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it("renders nothing when no executedSteps", async () => {
    await act(async () =>
      root.render(<SaveEntry session={makeSession({ status: "done", executedSteps: [] })} tabId={1} />)
    );
    expect(container.querySelector("[data-testid=widget-save-entry]")).toBeNull();
  });

  it("renders nothing when status not done", async () => {
    await act(async () =>
      root.render(
        <SaveEntry
          session={makeSession({ status: "streaming", executedSteps: [{} as any, {} as any] })}
          tabId={1}
        />
      )
    );
    expect(container.querySelector("[data-testid=widget-save-entry]")).toBeNull();
  });

  it("shows entry when done + steps > 0 and calls RPC on click", async () => {
    await act(async () =>
      root.render(
        <SaveEntry
          session={makeSession({ status: "done", executedSteps: [{} as any, {} as any, {} as any] })}
          tabId={99}
        />
      )
    );
    const el = container.querySelector("[data-testid=widget-save-entry]")!;
    expect(el.textContent).toContain("已执行 3 步");
    const btn = el.querySelector("button")! as HTMLButtonElement;
    await act(async () => btn.click());
    expect(mockOpenSidepanelWithSave).toHaveBeenCalledWith({ tabId: 99 });
  });
});
