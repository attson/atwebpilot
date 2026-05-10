import { describe, expect, it } from "vitest";
import {
  buildUserPrompt,
  extractSource
} from "@/sidepanel/llm/summary-step";
import type { ChatMessage, Json, Step } from "@/shared/types";

describe("extractSource", () => {
  it("returns trimmed source as-is when no fence", () => {
    const raw = "  const x = 1;\nreturn x;  ";
    expect(extractSource(raw)).toBe("const x = 1;\nreturn x;");
  });

  it("strips ```js fence", () => {
    const raw = "```js\nreturn { a: 1 };\n```";
    expect(extractSource(raw)).toBe("return { a: 1 };");
  });

  it("strips ```javascript fence", () => {
    const raw = "```javascript\nconst x = 1;\nreturn x;\n```";
    expect(extractSource(raw)).toBe("const x = 1;\nreturn x;");
  });

  it("extracts code block from explanation + fence", () => {
    const raw =
      "Here is the summary code:\n\n```js\nconst init = window.rawData;\nreturn init;\n```\n\nThis returns the data.";
    expect(extractSource(raw)).toBe("const init = window.rawData;\nreturn init;");
  });

  it("throws when source has no return", () => {
    expect(() => extractSource("```js\nconst x = 1;\nconsole.log(x);\n```")).toThrow(
      /no `return` statement/i
    );
  });

  it("throws when source is empty", () => {
    expect(() => extractSource("   ")).toThrow(/empty source/i);
    expect(() => extractSource("```js\n\n```")).toThrow(/empty source/i);
  });

  it("throws when source > 32KB", () => {
    const huge = "```js\n" + "a".repeat(33000) + "\nreturn 1;\n```";
    expect(() => extractSource(huge)).toThrow(/too large/i);
  });
});

describe("buildUserPrompt", () => {
  const baseInput = {
    messages: [] as ChatMessage[],
    executedSteps: [] as Step[],
    lastOutput: null as Json
  };

  it("includes step list with tool args truncated", () => {
    const steps: Step[] = [
      { kind: "tool", tool: "snapshotDOM", args: { maxDepth: 3 } },
      { kind: "js", source: "return location.href;" }
    ];
    const prompt = buildUserPrompt({ ...baseInput, executedSteps: steps });
    expect(prompt).toContain("[step 0] tool: snapshotDOM");
    expect(prompt).toContain('"maxDepth":3');
    expect(prompt).toContain("[step 1] js: return location.href;");
  });

  it("truncates long js source with ellipsis marker", () => {
    const longSrc = "x;".repeat(200);
    const steps: Step[] = [{ kind: "js", source: longSrc }];
    const prompt = buildUserPrompt({ ...baseInput, executedSteps: steps });
    expect(prompt).toContain("…");
  });

  it("includes lastOutput truncated to 1500 chars", () => {
    const big = { items: Array(200).fill({ a: 1, b: "very long text here" }) };
    const prompt = buildUserPrompt({ ...baseInput, lastOutput: big });
    const lastOutputSection = prompt.split("# 最末步 output")[1] ?? "";
    expect(lastOutputSection.length).toBeLessThan(2200);
  });

  it("includes last assistant text when present", () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "总结此页" },
      {
        role: "assistant",
        content: [{ type: "text", text: "## 商品标题\n加粗长椅...\n## 评论分析\n..." }]
      }
    ];
    const prompt = buildUserPrompt({ ...baseInput, messages });
    expect(prompt).toContain("# 对话最后一段 assistant 总结报告");
    expect(prompt).toContain("商品标题");
  });

  it("omits assistant section when last assistant has no text", () => {
    const messages: ChatMessage[] = [
      {
        role: "assistant",
        content: [{ type: "tool_use", id: "t1", name: "snapshotDOM", input: {} }]
      }
    ];
    const prompt = buildUserPrompt({ ...baseInput, messages });
    expect(prompt).not.toContain("# 对话最后一段 assistant 总结报告");
  });
});
