import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock chrome.runtime
(globalThis as any).chrome = {
  runtime: {
    sendMessage: vi.fn(),
  },
};

// Mock settings store — apiKey empty triggers early return.
// `loaded: true` bypasses runFromInput's defensive re-load path (see impl).
const mockLoad = vi.fn(() => Promise.resolve());
vi.mock("@/sidepanel/chat/settings-store", () => ({
  useSettings: {
    getState: () => ({
      apiKey: "",
      provider: "anthropic",
      model: "claude-sonnet-4-6",
      maxRounds: 20,
      maxContinuationNudges: 1,
      defaultPermissionMode: "default",
      trustedDangerTools: [],
      selfHealEnabled: false,
      loaded: true,
      load: mockLoad,
    }),
  },
}));

// Mock session-store
const mockSetError = vi.fn();
const mockUseStore = {
  getState: () => ({
    sessionsByTab: {
      1: { url: "https://example.com", permissionMode: "default", cards: [] },
    },
  }),
};

vi.mock("@/sidepanel/chat/session-store", () => ({
  useStore: mockUseStore,
  addLlmExchange: vi.fn(),
  appendAssistantText: vi.fn(),
  beginAssistantTurn: vi.fn(),
  finalizeAssistantTurn: vi.fn(),
  incrementRound: vi.fn(),
  upsertCard: vi.fn(),
  setCardStatus: vi.fn(),
  setStatus: vi.fn(),
  setError: mockSetError,
  pushExecutedStep: vi.fn(),
  setLastOutput: vi.fn(),
}));

// Mock runChatSession — should NOT be called when apiKey is empty
const mockRunChatSession = vi.fn();
vi.mock("@/sidepanel/chat/run-session", () => ({
  runChatSession: mockRunChatSession,
}));

// Mock other deps that would fail in test env
vi.mock("@/sidepanel/llm/client", () => ({
  pickClient: vi.fn(() => ({})),
}));
vi.mock("@/sidepanel/llm/recording-client", () => ({
  createRecordingClient: vi.fn(() => ({})),
}));
vi.mock("@/sidepanel/chat/approval", () => {
  // Minimal Approver class stub for WidgetApprover to subclass
  class Approver {
    request(_id: string) {
      return Promise.resolve({ kind: "run" as const });
    }
    resolve(_id: string, _d: unknown) {}
    resolveAllPending(_d: unknown) {}
    has(_id: string) { return false; }
  }
  return { Approver };
});
vi.mock("@/sidepanel/llm/tool-schema", () => ({
  TOOL_DEFS: [],
}));
vi.mock("@/sidepanel/llm/system-prompt", () => ({
  buildSystemPrompt: vi.fn(() => ""),
}));
vi.mock("@/sidepanel/rpc", () => ({
  rpc: {
    startSession: vi.fn(),
    appendStepLog: vi.fn(),
    finalizeSession: vi.fn(),
    listTabs: vi.fn(),
    openTab: vi.fn(),
  },
}));
vi.mock("@/sidepanel/chat/tool-runner", () => ({
  RpcToolRunner: vi.fn(() => ({})),
}));

describe("runFromInput", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("early-returns and sets error when apiKey is empty", async () => {
    const { runFromInput } = await import("@/content/widget/run-widget-session");
    await runFromInput(1, "hello");

    expect(mockSetError).toHaveBeenCalledWith(1, expect.stringContaining("API Key"));
    expect(mockRunChatSession).not.toHaveBeenCalled();
  });
});
