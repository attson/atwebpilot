import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { _resetDBForTests } from "@/background/storage/db";
import * as ss from "@/sidepanel/chat/persistence/sessions-storage";
import { UrlRecoveryBanner } from "@/sidepanel/components/url-recovery-banner";
import { useStore } from "@/sidepanel/chat/session-store";
import type { PersistedSession } from "@webpilot/shared/types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const URL = "https://example.com";

const baseCandidate: PersistedSession = {
  id: "cand-1",
  url: URL,
  lastTabId: 999,
  status: "archived",
  data: {
    messages: [{ role: "user", content: "hello there" }],
    cards: [],
    executedSteps: [],
    tokenUsage: { input: 0, output: 0 },
    roundCount: 0,
    attachedTabs: [],
    url: URL,
    runRecordId: null,
    errorMessage: null
  },
  createdAt: Date.now() - 60_000,
  updatedAt: Date.now() - 60_000
};

describe("UrlRecoveryBanner", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory();
    _resetDBForTests();
    useStore.setState({ sessionsByTab: {}, currentTabId: 7 });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("renders nothing when no candidates", () => {
    act(() => {
      root.render(
        <UrlRecoveryBanner candidates={[]} onOpenDrawer={() => {}} onDismiss={() => {}} />
      );
    });
    expect(container.firstChild).toBeNull();
  });

  it("shows preview of first user message", () => {
    act(() => {
      root.render(
        <UrlRecoveryBanner candidates={[baseCandidate]} onOpenDrawer={() => {}} onDismiss={() => {}} />
      );
    });
    expect(container.textContent).toContain("hello there");
  });

  it("restore button calls restoreArchived + rehydrates", async () => {
    await ss.putSession(baseCandidate);
    act(() => {
      root.render(
        <UrlRecoveryBanner candidates={[baseCandidate]} onOpenDrawer={() => {}} onDismiss={() => {}} />
      );
    });
    const btn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "恢复"
    );
    await act(async () => {
      btn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      // allow async handlers to settle
      await new Promise((r) => setTimeout(r, 50));
    });
    const got = await ss.getById("cand-1");
    expect(got?.status).toBe("active");
    expect(got?.lastTabId).toBe(7);
    expect(useStore.getState().sessionsByTab[7].messages.length).toBe(1);
  });

  it("discard button deletes the row and calls onDismiss", async () => {
    await ss.putSession(baseCandidate);
    const onDismiss = vi.fn();
    act(() => {
      root.render(
        <UrlRecoveryBanner candidates={[baseCandidate]} onOpenDrawer={() => {}} onDismiss={onDismiss} />
      );
    });
    const btn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "丢弃"
    );
    await act(async () => {
      btn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(await ss.getById("cand-1")).toBeUndefined();
    expect(onDismiss).toHaveBeenCalled();
  });

  it("'更多' opens drawer when > 1 candidates", () => {
    const onOpenDrawer = vi.fn();
    act(() => {
      root.render(
        <UrlRecoveryBanner
          candidates={[baseCandidate, { ...baseCandidate, id: "cand-2" }]}
          onOpenDrawer={onOpenDrawer}
          onDismiss={() => {}}
        />
      );
    });
    const btn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "更多"
    );
    act(() => {
      btn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onOpenDrawer).toHaveBeenCalled();
  });

  it("'更多' is hidden when only 1 candidate", () => {
    act(() => {
      root.render(
        <UrlRecoveryBanner candidates={[baseCandidate]} onOpenDrawer={() => {}} onDismiss={() => {}} />
      );
    });
    const btn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "更多"
    );
    expect(btn).toBeUndefined();
  });
});
