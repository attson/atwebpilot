import { act } from "react";
import { createRoot } from "react-dom/client";
import { RecommendationsBanner } from "@/sidepanel/components/recommendations-banner";
import type { Tool } from "@/shared/types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const promptTool: Tool = {
  kind: "prompt",
  id: "p1",
  name: "智能总结",
  urlPatterns: ["https://example.com/**"],
  description: "",
  prompt: "请总结",
  createdAt: 1,
  updatedAt: 1,
  versions: [{ version: 1, kind: "prompt", prompt: "请总结", createdAt: 1 }],
  stats: { runs: 0 }
};

describe("RecommendationsBanner", () => {
  it("runs prompt tools through prompt callback", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const onOpenTool = vi.fn();
    const onRunPromptTool = vi.fn();

    act(() => {
      root.render(<RecommendationsBanner tools={[promptTool]} onOpenTool={onOpenTool} onRunPromptTool={onRunPromptTool} />);
    });

    const run = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "运行");
    act(() => run?.dispatchEvent(new MouseEvent("click", { bubbles: true })));

    expect(onRunPromptTool).toHaveBeenCalledWith(promptTool);
    expect(onOpenTool).not.toHaveBeenCalledWith("p1", true);

    act(() => root.unmount());
    container.remove();
  });
});
