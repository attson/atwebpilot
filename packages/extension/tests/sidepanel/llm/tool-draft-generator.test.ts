import { describe, expect, it } from "vitest";
import type { LlmClient, LlmStreamEvent } from "@/sidepanel/llm/types";
import {
  generatePromptToolDraft,
  generateStepsToolDraft,
  parseGeneratedJson
} from "@/sidepanel/llm/tool-draft-generator";

function clientWithText(text: string): LlmClient {
  return {
    async *stream(): AsyncIterable<LlmStreamEvent> {
      yield { type: "text_delta", text };
      yield { type: "message_end", usage: { input_tokens: 1, output_tokens: 1 } };
    }
  };
}

const base = {
  apiKey: "sk-test",
  model: "test-model",
  currentUrl: "https://example.com/item/1",
  messages: [{ role: "user" as const, content: "采集标题和评论" }],
  executedSteps: [{ kind: "tool" as const, tool: "snapshotDOM" as const, args: {} }],
  lastOutput: { title: "A" }
};

describe("tool draft generator", () => {
  it("parses fenced JSON", () => {
    expect(parseGeneratedJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it("generates prompt tool drafts", async () => {
    const draft = await generatePromptToolDraft({
      ...base,
      client: clientWithText(
        JSON.stringify({
          name: "商品采集",
          description: "采集商品页字段",
          prompt: "请读取当前页面，返回 { title, reviews } JSON。"
        })
      )
    });

    expect(draft).toEqual({
      name: "商品采集",
      description: "采集商品页字段",
      prompt: "请读取当前页面，返回 { title, reviews } JSON。"
    });
  });

  it("rejects prompt drafts with secrets", async () => {
    await expect(
      generatePromptToolDraft({
        ...base,
        client: clientWithText(
          JSON.stringify({ name: "X", description: "Y", prompt: "Authorization: Bearer abc.def" })
        )
      })
    ).rejects.toThrow("sensitive");
  });

  it("generates steps tool drafts", async () => {
    const draft = await generateStepsToolDraft({
      ...base,
      client: clientWithText(
        JSON.stringify({
          name: "固定采集",
          description: "固定返回标题",
          steps: [{ kind: "js", source: "return { title: document.title };" }]
        })
      )
    });

    expect(draft.steps).toEqual([{ kind: "js", source: "return { title: document.title };" }]);
  });

  it("rejects invalid steps", async () => {
    await expect(
      generateStepsToolDraft({
        ...base,
        client: clientWithText(JSON.stringify({ name: "Bad", description: "Bad", steps: [] }))
      })
    ).rejects.toThrow("steps");
  });
});
