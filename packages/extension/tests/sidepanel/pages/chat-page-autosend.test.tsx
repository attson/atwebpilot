import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ChatPage } from "@/sidepanel/pages/chat-page";
import { ensureSession, setCurrentTab, useStore } from "@/sidepanel/chat/session-store";
import { useSettings } from "@/sidepanel/chat/settings-store";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/sidepanel/rpc", () => ({
  currentTabInfo: vi.fn(async () => ({ tabId: 1, url: "https://example.com/" })),
  onTabRecommendations: vi.fn(() => () => undefined),
  onTabEvents: vi.fn(() => () => undefined),
  rpc: {
    matchingTools: vi.fn(async () => []),
    startSession: vi.fn(async () => ({ id: "run-1" })),
    finalizeSession: vi.fn(async () => undefined)
  }
}));

vi.mock("@/sidepanel/llm/client", () => ({
  pickClient: vi.fn(() => ({
    async *stream() {
      yield { type: "text_delta", text: "完成" };
      yield { type: "message_end", usage: { input_tokens: 1, output_tokens: 1 } };
    }
  }))
}));

describe("ChatPage autoSend", () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    useSettings.setState({
      loaded: true,
      provider: "openai",
      model: "gpt-test",
      apiKey: "sk-test",
      apiKeyMode: "session",
      endpoint: "",
      maxRounds: 5,
      maxTokens: 1000,
      autoApproveDangerous: []
    });
    useStore.setState({ sessionsByTab: {}, currentTabId: null });
    ensureSession(1, "https://example.com/");
    setCurrentTab(1);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("auto-sends the initial prompt once", async () => {
    await act(async () => {
      root.render(
        <ChatPage
          initialPrompt="请总结当前页"
          initialContext="# 保存的提示词工具\n名称：总结"
          autoSend
        />
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    const session = useStore.getState().sessionsByTab[1];
    expect(session.messages.some((m) => m.role === "user" && m.content === "请总结当前页")).toBe(true);
    expect(session.logs.some((l) => l.message.includes("autoSend"))).toBe(true);
  });
});
