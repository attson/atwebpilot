import { describe, expect, it } from "vitest";
import { makePreview, normalizeText, tokenizeQuery } from "@/content/tools/page-index/text";

describe("page-index text helpers", () => {
  it("normalizes whitespace and punctuation without losing CJK text", () => {
    expect(normalizeText("  Price：   $20.99\n品牌\tHotcinfin  ")).toBe(
      "price $20.99 品牌 hotcinfin"
    );
  });

  it("tokenizes mixed Chinese and English queries", () => {
    expect(tokenizeQuery("Best Sellers Rank 价格 30天销量")).toEqual([
      "best",
      "sellers",
      "rank",
      "价格",
      "30天销量"
    ]);
  });

  it("returns structured truncation metadata instead of broken prose", () => {
    const result = makePreview("a".repeat(1200), 100, "b1", "block_budget");
    expect(result.text).toHaveLength(100);
    expect(result.complete).toBe(false);
    expect(result.availableChars).toBe(1200);
    expect(result.truncation).toEqual({
      kind: "preview",
      originalChars: 1200,
      returnedChars: 100,
      reason: "block_budget",
      ref: "b1"
    });
  });
});
