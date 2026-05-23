import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LlmExchangePanel } from "@/sidepanel/components/llm-exchange-panel";
import type { LlmExchange } from "@webpilot/shared/types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function ex(round: number, text: string): LlmExchange {
  return {
    id: `e${round}`,
    round,
    kind: "main",
    startedAt: 0,
    durationMs: 12,
    request: {
      provider: "anthropic",
      model: "claude-x",
      maxTokens: 4096,
      system: "SYS",
      messages: [{ role: "user", content: "hello" }],
      toolNames: ["snapshotDOM"]
    },
    response: { text, toolUses: [], usage: { input_tokens: 100, output_tokens: 5 }, stopReason: "end_turn" }
  };
}

function btn(container: HTMLElement, text: string): HTMLButtonElement | undefined {
  return Array.from(container.querySelectorAll("button")).find((b) =>
    (b.textContent ?? "").includes(text)
  );
}

function mount(node: React.ReactElement) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(node));
  return {
    container,
    cleanup: () => {
      act(() => root.unmount());
      container.remove();
    }
  };
}

let writeText: ReturnType<typeof vi.fn>;
beforeEach(() => {
  writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
});

describe("LlmExchangePanel", () => {
  it("renders nothing when closed", () => {
    const { container, cleanup } = mount(
      <LlmExchangePanel open={false} exchanges={[ex(0, "hi")]} onClose={() => {}} />
    );
    expect(container.firstChild).toBeNull();
    cleanup();
  });

  it("lists exchanges with model and usage", () => {
    const { container, cleanup } = mount(
      <LlmExchangePanel open exchanges={[ex(0, "hi"), ex(1, "yo")]} onClose={() => {}} />
    );
    const models = Array.from(container.querySelectorAll("*")).filter(
      (e) => e.childNodes.length === 1 && e.textContent === "claude-x"
    );
    expect(models.length).toBe(2);
    expect(container.textContent).toContain("in 100");
    cleanup();
  });

  it("shows request/response detail when an exchange is expanded", () => {
    const { container, cleanup } = mount(
      <LlmExchangePanel open exchanges={[ex(0, "the-answer-text")]} onClose={() => {}} />
    );
    act(() => btn(container, "#0")?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(container.textContent).toContain("the-answer-text");
    expect(container.textContent).toContain("SYS");
    cleanup();
  });

  it("copy writes JSON to clipboard", () => {
    const { container, cleanup } = mount(
      <LlmExchangePanel open exchanges={[ex(0, "hi")]} onClose={() => {}} />
    );
    act(() => btn(container, "#0")?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    act(() => btn(container, "复制本条")?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(writeText).toHaveBeenCalled();
    cleanup();
  });

  it("close button fires onClose", () => {
    const onClose = vi.fn();
    const { container, cleanup } = mount(
      <LlmExchangePanel open exchanges={[]} onClose={onClose} />
    );
    act(() => btn(container, "关闭")?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(onClose).toHaveBeenCalled();
    cleanup();
  });
});
