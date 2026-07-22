import { beforeEach, describe, expect, it } from "vitest";
import { buildPageIndex } from "@/content/tools/page-index/build";
import { clearPageIndexForTests, getPageIndex } from "@/content/tools/page-index/store";
import { extractFields, searchIndex } from "@/content/tools/page-index/search";

describe("page-index search", () => {
  beforeEach(() => {
    clearPageIndexForTests();
    history.replaceState(null, "", "/product-a");
    document.title = "Product page";
    document.body.innerHTML = `
      <h1>Leather Bound Journal</h1>
      <table>
        <tr><th>品牌</th><td>Hotcinfin</td></tr>
        <tr><th>Best Sellers Rank</th><td>#17,540 in Office Products</td></tr>
        <tr><th>ASIN</th><td>B09877P9CF</td></tr>
      </table>
      <dl>
        <dt>价格</dt><dd>$20.99</dd>
      </dl>
      <section>
        <h2>Recent demand</h2>
        <p>30天销量 300+ bought in past month from repeat business buyers.</p>
      </section>
      <ul><li>240 pages</li><li>Soft genuine leather cover</li></ul>
    `;
  });

  it("searches index with bounded snippets and block ids", () => {
    const index = buildPageIndex();
    const result = searchIndex(index, { query: "Best Sellers Rank", limit: 5 });

    expect(result.indexId).toBe(index.indexId);
    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        blockId: expect.stringMatching(/^b/),
        label: "Best Sellers Rank"
      })
    );
    expect(result.matches[0]?.text.length).toBeLessThanOrEqual(800);
  });

  it("extracts generic field candidates with evidence", () => {
    const index = buildPageIndex();
    const result = extractFields(index, {
      fields: ["Asin", "品牌", "价格", "排名", "30天销量", "缺失字段"],
      maxCandidatesPerField: 3
    });

    const byField = Object.fromEntries(result.fields.map((field) => [field.field, field]));
    expect(byField.Asin?.candidates[0]).toEqual(
      expect.objectContaining({
        value: "B09877P9CF",
        blockId: expect.stringMatching(/^b/)
      })
    );
    expect(byField["品牌"]?.candidates[0]).toEqual(
      expect.objectContaining({
        value: "Hotcinfin",
        blockId: expect.stringMatching(/^b/)
      })
    );
    expect(byField["价格"]?.candidates[0]?.value).toBe("$20.99");
    expect(byField["排名"]?.candidates[0]?.evidence).toContain("#17,540");
    expect(byField["30天销量"]?.candidates[0]?.evidence).toContain("300+ bought");
    expect(result.missing).toEqual(["缺失字段"]);
  });

  it("extracts thousands-formatted prices without truncating digits", () => {
    document.body.innerHTML = `<p>Current Price $1,299.00 with free shipping.</p>`;
    const index = buildPageIndex();
    const result = extractFields(index, { fields: ["价格"], maxCandidatesPerField: 1 });

    expect(result.fields[0]?.candidates[0]?.value).toBe("$1,299.00");
  });

  it("uses evidence previews with evidence_budget truncation when shortened", () => {
    document.body.innerHTML = `
      <p>${"商品描述 ".repeat(120)} 价格 $20.99 ${"长证据 ".repeat(120)}</p>
    `;
    const index = buildPageIndex();
    const result = extractFields(index, { fields: ["价格"], maxCandidatesPerField: 1 });
    const candidate = result.fields[0]?.candidates[0];

    expect(candidate?.blockId).toMatch(/^b/);
    expect(candidate?.evidence.length).toBeLessThanOrEqual(600);
    expect(candidate?.complete).toBe(false);
    expect(candidate?.truncation).toEqual(
      expect.objectContaining({
        kind: "evidence_budget",
        ref: candidate?.blockId
      })
    );
  });

  it("centers search snippets around late matches instead of returning the block prefix", () => {
    document.body.innerHTML = `
      <p>${"prefix noise ".repeat(120)} Best Sellers Rank #99 in Office Products ${"tail noise ".repeat(120)}</p>
    `;
    const index = buildPageIndex();
    const result = searchIndex(index, { query: "Best Sellers Rank", limit: 1 });

    expect(result.matches[0]?.text).toContain("Best Sellers Rank #99");
    expect(result.matches[0]?.truncation).toEqual(
      expect.objectContaining({
        kind: "evidence_budget",
        originalChars: expect.any(Number),
        ref: result.matches[0]?.blockId
      })
    );
  });

  it("centers field evidence around late matches", () => {
    document.body.innerHTML = `
      <p>${"prefix noise ".repeat(90)} Price $20.99 ${"tail noise ".repeat(90)}</p>
    `;
    const index = buildPageIndex();
    const result = extractFields(index, { fields: ["价格"], maxCandidatesPerField: 1 });

    expect(result.fields[0]?.candidates[0]?.evidence).toContain("Price $20.99");
    expect(result.fields[0]?.candidates[0]?.truncation).toEqual(
      expect.objectContaining({
        kind: "evidence_budget",
        ref: result.fields[0]?.candidates[0]?.blockId
      })
    );
  });

  it("caches the current page index by location href and refresh flag", () => {
    const first = getPageIndex();
    expect(getPageIndex()).toBe(first);

    const refreshed = getPageIndex({ refresh: true });
    expect(refreshed).not.toBe(first);
    expect(getPageIndex()).toBe(refreshed);

    history.replaceState(null, "", "/product-b");
    const afterUrlChange = getPageIndex();
    expect(afterUrlChange).not.toBe(refreshed);
    expect(afterUrlChange.url).toBe(location.href);
  });

  it("rebuilds cached index when requested maxBlocks changes", () => {
    document.body.innerHTML = Array.from({ length: 8 }, (_, i) => `<p>Searchable paragraph ${i}</p>`).join("");

    const first = getPageIndex({ maxBlocks: 2 });
    expect(first.blocks).toHaveLength(2);

    const expanded = getPageIndex({ maxBlocks: 8 });
    expect(expanded).not.toBe(first);
    expect(expanded.blocks.length).toBeGreaterThan(2);

    const sameExpanded = getPageIndex({ maxBlocks: 8 });
    expect(sameExpanded).toBe(expanded);
  });

  it("propagates index truncation through search and field extraction results", () => {
    document.body.innerHTML = `
      <p>First indexed paragraph with enough text.</p>
      <p>Second skipped paragraph with TargetField hidden by maxBlocks.</p>
    `;
    const index = buildPageIndex({ maxBlocks: 1 });

    expect(searchIndex(index, { query: "TargetField" })).toEqual(
      expect.objectContaining({
        truncated: true,
        truncation: expect.objectContaining({ kind: "index_budget" })
      })
    );
    expect(extractFields(index, { fields: ["TargetField"] })).toEqual(
      expect.objectContaining({
        truncated: true,
        truncation: expect.objectContaining({ kind: "index_budget" })
      })
    );
  });
});
