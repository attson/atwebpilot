import { describe, expect, it } from "vitest";
import type { ChatMessage, ImagePart } from "@atwebpilot/shared/types";
import {
  buildCurrentUserContent,
  buildInitialMessagesForNextTurn,
} from "@/sidepanel/chat/context-manager";

const image: ImagePart = {
  type: "image",
  media_type: "image/png",
  data: "BASE64_IMAGE_PAYLOAD_SHOULD_NOT_APPEAR",
};

describe("context-manager", () => {
  it("keeps recent prior turns as initial messages for the next model run", () => {
    const history: ChatMessage[] = [
      { role: "user", content: "先采集商品标题" },
      { role: "assistant", content: [{ type: "text", text: "已采集标题: A" }] },
    ];

    const result = buildInitialMessagesForNextTurn(history, {
      recentMessageLimit: 8,
      softCharBudget: 10_000,
    });

    expect(result.compressed).toBe(false);
    expect(result.initialMessages).toEqual(history);
  });

  it("compresses older history when over budget while preserving recent turns", () => {
    const history: ChatMessage[] = [
      { role: "user", content: "用户目标: 采集所有评论并生成 xlsx" },
      { role: "assistant", content: [{ type: "text", text: "我会先建立页面索引。" }] },
      {
        role: "user",
        content: [
          image,
          {
            type: "tool_result",
            tool_use_id: "idx",
            content: JSON.stringify({
              indexId: "page-index-1",
              blocks: [{ blockId: "block-review-7", text: "review text".repeat(200) }],
            }),
          },
        ],
      },
      { role: "assistant", content: [{ type: "text", text: "已找到 block-review-7。" }] },
      { role: "user", content: "继续处理后面的分页" },
      { role: "assistant", content: [{ type: "text", text: "准备翻页。" }] },
    ];

    const result = buildInitialMessagesForNextTurn(history, {
      recentMessageLimit: 2,
      softCharBudget: 300,
      memoryCharLimit: 800,
    });

    expect(result.compressed).toBe(true);
    expect(result.compressedMessageCount).toBe(4);
    expect(result.initialMessages).toHaveLength(3);
    expect(result.initialMessages[0].role).toBe("user");
    expect(result.initialMessages[0].content).toContain("[上下文记忆]");
    expect(result.initialMessages[0].content).toContain("采集所有评论并生成 xlsx");
    expect(result.initialMessages[0].content).toContain("page-index-1");
    expect(result.initialMessages[0].content).toContain("block-review-7");
    expect(JSON.stringify(result.initialMessages)).not.toContain(image.data);
    expect(result.initialMessages.slice(1)).toEqual(history.slice(-2));
  });

  it("builds the current user content with images without forcing old images into history", () => {
    expect(buildCurrentUserContent("看这张图", [])).toBe("看这张图");

    const content = buildCurrentUserContent("看这张图", [image]);
    expect(content).toEqual([image, { type: "text", text: "看这张图" }]);
  });
});
