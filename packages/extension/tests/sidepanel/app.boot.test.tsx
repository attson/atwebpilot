import { act } from "react";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { _resetDBForTests } from "@/background/storage/db";
import * as ss from "@/sidepanel/chat/persistence/sessions-storage";
import { ensureSession, useStore } from "@/sidepanel/chat/session-store";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const TEST_URL = "https://example.com";

// Stub chrome APIs needed by App's sub-effects (tab-tracker, validateAttachedTabs, etc.)
function makeChromeMock() {
  const emptyGet = vi.fn().mockResolvedValue({});
  return {
    tabs: {
      query: vi.fn().mockResolvedValue([{ id: 7, url: TEST_URL }]),
      get: vi.fn().mockResolvedValue({ id: 7, url: TEST_URL }),
      onRemoved: { addListener: vi.fn(), removeListener: vi.fn() },
      onUpdated: { addListener: vi.fn(), removeListener: vi.fn() },
      onActivated: { addListener: vi.fn(), removeListener: vi.fn() }
    },
    runtime: {
      onMessage: { addListener: vi.fn(), removeListener: vi.fn() }
    },
    storage: {
      local: { get: emptyGet, set: vi.fn().mockResolvedValue(undefined) },
      session: { get: emptyGet, set: vi.fn().mockResolvedValue(undefined) }
    }
  };
}

// Stub rpc module to avoid import errors in ChatPage sub-tree
vi.mock("@/sidepanel/rpc", () => ({
  currentTabInfo: vi.fn(async () => ({ tabId: 7, url: TEST_URL })),
  onTabRecommendations: vi.fn(() => () => undefined),
  onTabEvents: vi.fn(() => () => undefined),
  rpc: {
    matchingTools: vi.fn(async () => []),
    startSession: vi.fn(async () => ({ id: "run-1" })),
    finalizeSession: vi.fn(async () => undefined),
    listTabs: vi.fn(async () => []),
    openTab: vi.fn(async () => undefined)
  }
}));

describe("App boot persistence", () => {
  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory();
    _resetDBForTests();
    useStore.setState({ sessionsByTab: {}, currentTabId: null });
    vi.stubGlobal("chrome", makeChromeMock());
  });

  it("when tabId has active session for url, rehydrates messages into store", async () => {
    // Pre-seed IDB with an active session for tab 7
    await ss.putSession({
      id: "boot-test-session",
      url: TEST_URL,
      lastTabId: 7,
      status: "active",
      data: {
        messages: [{ role: "user", content: "rehydrated message" }],
        cards: [],
        executedSteps: [],
        tokenUsage: { input: 0, output: 0 },
        roundCount: 0,
        attachedTabs: [],
        url: TEST_URL,
        runRecordId: null,
        errorMessage: null
      },
      createdAt: 0,
      updatedAt: 0
    });

    // Seed store as if tab-tracker set currentTabId = 7
    ensureSession(7, TEST_URL);
    useStore.setState((s) => ({ ...s, currentTabId: 7 }));

    // Dynamically import App to get fresh module
    const { App } = await import("@/sidepanel/app");
    const { createRoot } = await import("react-dom/client");
    const { createElement } = await import("react");

    const container = document.createElement("div");
    document.body.appendChild(container);
    let root: ReturnType<typeof createRoot> | null = null;

    try {
      await act(async () => {
        root = createRoot(container);
        root.render(createElement(App));
        // Allow hydrateOnBoot async effect to complete
        await new Promise((r) => setTimeout(r, 100));
      });

      expect(useStore.getState().sessionsByTab[7]?.messages.length).toBe(1);
      expect(useStore.getState().sessionsByTab[7]?.messages[0]?.content).toBe(
        "rehydrated message"
      );
    } finally {
      await act(async () => {
        root?.unmount();
      });
      container.remove();
    }
  });
});
