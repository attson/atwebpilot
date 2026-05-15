import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ChatPage } from "@/sidepanel/pages/chat-page";
import { ensureSession, setCurrentTab, setError, setStatus, useStore } from "@/sidepanel/chat/session-store";
import { useSettings } from "@/sidepanel/chat/settings-store";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/sidepanel/rpc", () => ({
  currentTabInfo: vi.fn(async () => ({ tabId: 1, url: "https://example.com/" })),
  onTabRecommendations: vi.fn(() => () => undefined),
  onTabEvents: vi.fn(() => () => undefined),
  rpc: {
    matchingTools: vi.fn(async () => [])
  }
}));

describe("ChatPage error actions", () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    useSettings.setState({ loaded: true });
    useStore.setState({ sessionsByTab: {}, closedSessions: [], currentTabId: null });
    ensureSession(1, "https://example.com/");
    setCurrentTab(1);
    const s = useStore.getState().sessionsByTab[1];
    useStore.setState({
      sessionsByTab: {
        1: {
          ...s,
          messages: [{ role: "user", content: "采集前 50 条评论" }],
          logs: [{ ts: Date.now(), level: "warn", message: "session_end: max_rounds" }]
        }
      }
    });
    setStatus(1, "error");
    setError(1, "达到最大轮数");

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("keeps clear-chat available when the session is in an error state", async () => {
    await act(async () => {
      root.render(<ChatPage />);
    });

    expect(container.textContent).toContain("达到最大轮数");
    expect(container.textContent).toContain("查看日志");
    expect(container.textContent).toContain("清空对话");
  });

  it("keeps oversized server errors bounded and dismissible", async () => {
    const hugeHtml = `OpenAI 520: ${"<!DOCTYPE html><html>".repeat(200)}`;
    setError(1, hugeHtml);

    await act(async () => {
      root.render(<ChatPage />);
    });

    const body = container.querySelector('[data-testid="chat-error-body"]');
    expect(body?.className).toContain("max-h-");
    expect(body?.className).toContain("overflow-auto");

    const close = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "关闭"
    );
    expect(close).toBeTruthy();

    await act(async () => {
      close?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).not.toContain("OpenAI 520");
    expect(useStore.getState().sessionsByTab[1].messages).toHaveLength(1);
  });
});
