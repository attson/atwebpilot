import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { _resetDBForTests } from "@/background/storage/db";
import * as ss from "@/sidepanel/chat/persistence/sessions-storage";
import { SessionHistoryDrawer } from "@/sidepanel/components/session-history-drawer";
import { useStore } from "@/sidepanel/chat/session-store";
import type { PersistedSession } from "@webpilot/shared/types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const URL = "https://example.com";

const EMPTY_DATA = {
  messages: [] as Array<{ role: "user" | "assistant"; content: string }>,
  cards: [],
  executedSteps: [],
  tokenUsage: { input: 0, output: 0 },
  roundCount: 0,
  attachedTabs: [],
  url: URL,
  runRecordId: null as string | null,
  errorMessage: null as string | null
};

function mkRow(over: {
  id: string;
  messages?: string[];
  updatedAt?: number;
  runRecordId?: string | null;
  status?: "active" | "archived";
  lastTabId?: number;
  url?: string;
}): PersistedSession {
  return {
    id: over.id,
    url: over.url ?? URL,
    lastTabId: over.lastTabId ?? 999,
    status: over.status ?? "archived",
    data: {
      ...EMPTY_DATA,
      messages: (over.messages ?? []).map((c) => ({ role: "user" as const, content: c })),
      runRecordId: over.runRecordId ?? null
    },
    createdAt: 0,
    updatedAt: over.updatedAt ?? Date.now()
  };
}

describe("SessionHistoryDrawer", () => {
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

  it("lists archived sessions for URL, desc by updatedAt", async () => {
    const older = mkRow({ id: "s1", messages: ["first message"], updatedAt: 1000 });
    const newer = mkRow({ id: "s2", messages: ["second message"], updatedAt: 2000 });
    await ss.putSession(older);
    await ss.putSession(newer);

    act(() => {
      root.render(
        <SessionHistoryDrawer url={URL} open onClose={vi.fn()} />
      );
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });

    const items = container.querySelectorAll('[data-testid="history-item"]');
    expect(items.length).toBe(2);
    // Newer should appear first (desc by updatedAt)
    expect(items[0].textContent).toContain("second message");
    expect(items[1].textContent).toContain("first message");
  });

  it("renders nothing when open=false", () => {
    act(() => {
      root.render(
        <SessionHistoryDrawer url={URL} open={false} onClose={vi.fn()} />
      );
    });
    expect(container.firstChild).toBeNull();
  });

  it("restore button: archives current active (if any) + restores target", async () => {
    const active = mkRow({ id: "active-1", messages: ["active msg"], status: "active", lastTabId: 7 });
    const target = mkRow({ id: "target-1", messages: ["target msg"], status: "archived" });
    await ss.putSession(active);
    await ss.putSession(target);

    act(() => {
      root.render(
        <SessionHistoryDrawer url={URL} open onClose={vi.fn()} />
      );
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });

    const restoreBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "恢复"
    );
    await act(async () => {
      restoreBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 100));
    });

    // active-1 should now be archived
    const formerActive = await ss.getById("active-1");
    expect(formerActive?.status).toBe("archived");

    // target-1 should now be active with tabId=7
    const restoredTarget = await ss.getById("target-1");
    expect(restoredTarget?.status).toBe("active");
    expect(restoredTarget?.lastTabId).toBe(7);

    // Store should be rehydrated
    expect(useStore.getState().sessionsByTab[7].messages.length).toBe(1);
  });

  it("delete button: removes one row", async () => {
    const row = mkRow({ id: "del-1", messages: ["delete me"] });
    await ss.putSession(row);

    act(() => {
      root.render(
        <SessionHistoryDrawer url={URL} open onClose={vi.fn()} />
      );
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });

    const deleteBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "删除"
    );
    await act(async () => {
      deleteBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 100));
    });

    expect(await ss.getById("del-1")).toBeUndefined();
    const items = container.querySelectorAll('[data-testid="history-item"]');
    expect(items.length).toBe(0);
  });

  it("clear-all: confirm dialog true → all rows for URL deleted", async () => {
    const row1 = mkRow({ id: "c1", messages: ["msg1"] });
    const row2 = mkRow({ id: "c2", messages: ["msg2"] });
    await ss.putSession(row1);
    await ss.putSession(row2);

    vi.spyOn(window, "confirm").mockReturnValueOnce(true);

    act(() => {
      root.render(
        <SessionHistoryDrawer url={URL} open onClose={vi.fn()} />
      );
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });

    const clearBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("清空")
    );
    await act(async () => {
      clearBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 100));
    });

    expect(await ss.getById("c1")).toBeUndefined();
    expect(await ss.getById("c2")).toBeUndefined();
  });

  it("click outside (overlay) calls onClose", async () => {
    const row = mkRow({ id: "o1", messages: ["msg"] });
    await ss.putSession(row);
    const onClose = vi.fn();

    act(() => {
      root.render(
        <SessionHistoryDrawer url={URL} open onClose={onClose} />
      );
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });

    // Click the outer overlay div (the fixed inset-0 wrapper)
    const overlay = container.firstChild as HTMLElement;
    act(() => {
      overlay?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onClose).toHaveBeenCalled();
  });
});
