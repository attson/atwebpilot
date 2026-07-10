import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ErrorBanner } from "@/content/widget/error-banner";
import type { SessionData } from "@/sidepanel/chat/session-store";

const mockSetError = vi.fn();
vi.mock("@/sidepanel/chat/session-store", async (orig) => {
  const actual = await orig<typeof import("@/sidepanel/chat/session-store")>();
  return { ...actual, setError: (tabId: number, msg: string | null) => mockSetError(tabId, msg) };
});

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

describe("ErrorBanner", () => {
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

  it("renders nothing when errorMessage is null", async () => {
    await act(async () =>
      root.render(<ErrorBanner session={makeSession({ errorMessage: null })} tabId={1} />)
    );
    expect(container.querySelector("[data-testid=widget-error-banner]")).toBeNull();
  });

  it("shows message and calls setError(tabId, null) on close", async () => {
    await act(async () =>
      root.render(
        <ErrorBanner session={makeSession({ errorMessage: "未配置 API Key" })} tabId={42} />
      )
    );
    const bar = container.querySelector("[data-testid=widget-error-banner]")!;
    expect(bar.textContent).toContain("未配置 API Key");
    const closeBtn = bar.querySelector("button[aria-label='关闭错误提示']") as HTMLButtonElement;
    await act(async () => closeBtn.click());
    expect(mockSetError).toHaveBeenCalledWith(42, null);
  });
});
