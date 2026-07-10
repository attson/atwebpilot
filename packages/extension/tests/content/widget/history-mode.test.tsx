import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { HistoryMode } from "@/content/widget/history-mode";

const mockList = vi.fn();
const mockRestore = vi.fn().mockResolvedValue(undefined);

vi.mock("@/sidepanel/chat/persistence/sessions-storage", () => ({
  listArchivedByUrl: (url: string) => mockList(url),
  restoreArchived: (id: string, tabId: number) => mockRestore(id, tabId),
}));

async function flush() {
  await act(async () => { await Promise.resolve(); });
  await act(async () => { await Promise.resolve(); });
}

describe("HistoryMode", () => {
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

  it("shows empty state when no archived sessions", async () => {
    mockList.mockResolvedValue([]);
    await act(async () =>
      root.render(<HistoryMode url="https://x/" tabId={1} onBack={() => {}} />)
    );
    await flush();
    expect(container.textContent).toContain("此 URL 无历史会话");
  });

  it("renders sessions with title from first user message", async () => {
    mockList.mockResolvedValue([
      {
        id: "s1",
        url: "https://x/",
        createdAt: Date.now() - 60_000,
        updatedAt: Date.now() - 60_000,
        data: {
          messages: [{ role: "user", content: "总结此页" }],
          executedSteps: [{}, {}, {}],
          status: "done",
        },
      },
    ]);
    await act(async () =>
      root.render(<HistoryMode url="https://x/" tabId={1} onBack={() => {}} />)
    );
    await flush();
    const rows = container.querySelectorAll("[data-testid=widget-history-row]");
    expect(rows.length).toBe(1);
    expect(rows[0].textContent).toContain("总结此页");
    expect(rows[0].textContent).toContain("3 步");
  });

  it("calls restoreArchived and onBack when a row is clicked", async () => {
    mockList.mockResolvedValue([
      {
        id: "s2", url: "https://x/",
        createdAt: 0, updatedAt: 0,
        data: { messages: [{ role: "user", content: "hi" }] },
      },
    ]);
    const onBack = vi.fn();
    await act(async () =>
      root.render(<HistoryMode url="https://x/" tabId={42} onBack={onBack} />)
    );
    await flush();
    const row = container.querySelector("[data-testid=widget-history-row]") as HTMLButtonElement;
    await act(async () => { row.click(); });
    await flush();
    expect(mockRestore).toHaveBeenCalledWith("s2", 42);
    expect(onBack).toHaveBeenCalled();
  });
});
