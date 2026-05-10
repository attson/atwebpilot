import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ToolDetailPage } from "@/sidepanel/pages/tool-detail-page";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/sidepanel/rpc", () => ({
  currentTabId: vi.fn(async () => 1),
  rpc: {
    getTool: vi.fn(async () => ({
      id: "tool-1",
      name: "pdd 商品采集",
      urlPatterns: ["https://*.pinduoduo.com/**"],
      description: "",
      steps: [{ kind: "tool", tool: "snapshotDOM", args: { maxDepth: 3 } }],
      outputSchema: {},
      createdAt: 1,
      updatedAt: 1,
      versions: [
        {
          version: 1,
          steps: [{ kind: "tool", tool: "snapshotDOM", args: { maxDepth: 3 } }],
          outputSchema: {},
          createdAt: 1
        }
      ],
      stats: { runs: 0 }
    })),
    runTool: vi.fn()
  }
}));

describe("ToolDetailPage", () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
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
});
