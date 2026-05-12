import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ToolDetailPage } from "@/sidepanel/pages/tool-detail-page";
import { rpc } from "@/sidepanel/rpc";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  getTool: vi.fn(),
  runTool: vi.fn(),
  currentTabId: vi.fn(async () => 1)
}));

vi.mock("@/sidepanel/rpc", () => ({
  currentTabId: mocks.currentTabId,
  rpc: {
    getTool: mocks.getTool,
    runTool: mocks.runTool
  }
}));

const stepsTool = {
  kind: "steps" as const,
  id: "tool-1",
  name: "pdd 商品采集",
  urlPatterns: ["https://*.pinduoduo.com/**"],
  description: "",
  steps: [{ kind: "tool" as const, tool: "snapshotDOM" as const, args: { maxDepth: 3 } }],
  outputSchema: {},
  createdAt: 1,
  updatedAt: 1,
  versions: [
    {
      version: 1,
      kind: "steps" as const,
      steps: [{ kind: "tool" as const, tool: "snapshotDOM" as const, args: { maxDepth: 3 } }],
      outputSchema: {},
      createdAt: 1
    }
  ],
  stats: { runs: 0 }
};

describe("ToolDetailPage", () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    mocks.getTool.mockResolvedValue(stepsTool);
    mocks.runTool.mockReset();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("uses the page body as a height-bounded scroll container", async () => {
    await act(async () => {
      root.render(<ToolDetailPage id="tool-1" onBack={() => undefined} />);
    });
    await act(async () => {
      await Promise.resolve();
    });

    const page = container.firstElementChild;
    expect(page?.textContent).toContain("pdd 商品采集");
    expect(page?.className).toContain("h-full");
    expect(page?.className).toContain("overflow-auto");
  });

  it("renders prompt tools with chat run action", async () => {
    vi.mocked(rpc.getTool).mockResolvedValueOnce({
      kind: "prompt",
      id: "prompt-1",
      name: "智能总结",
      urlPatterns: ["https://example.com/**"],
      description: "总结当前页",
      prompt: "请总结当前页",
      createdAt: 1,
      updatedAt: 1,
      versions: [{ version: 1, kind: "prompt", prompt: "请总结当前页", createdAt: 1 }],
      stats: { runs: 0 }
    });
    const runPromptTool = vi.fn();

    await act(async () => {
      root.render(<ToolDetailPage id="prompt-1" onBack={() => undefined} onRunPromptTool={runPromptTool} />);
    });
    await act(async () => Promise.resolve());

    expect(container.textContent).toContain("提示词工具");
    expect(container.textContent).toContain("请总结当前页");
    const btn = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "在聊天中运行");
    await act(async () => btn?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(runPromptTool).toHaveBeenCalledWith(expect.objectContaining({ id: "prompt-1", prompt: "请总结当前页" }));
  });
});
