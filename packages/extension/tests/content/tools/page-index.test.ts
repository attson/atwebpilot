import { beforeEach, describe, expect, it } from "vitest";
import { callTool } from "@/content/tools";
import { clearPageIndexForTests } from "@/content/tools/page-index/store";
import { MAX_SUMMARY_LIMIT } from "@/content/tools/page-index/types";

describe("page-index content tools", () => {
  beforeEach(() => {
    clearPageIndexForTests();
    history.replaceState(null, "", "/tool-page");
    document.title = "Tool page";
    document.body.innerHTML = `
      <h1>Leather Bound Journal</h1>
      <table>
        <tr><th>ASIN</th><td>B09877P9CF</td></tr>
        <tr><th>Brand Name</th><td>Hotcinfin</td></tr>
      </table>
      <p>${"Long evidence ".repeat(1000)}</p>
    `;
  });

  it("creates, searches, reads, and extracts through the registry", async () => {
    const created = (await callTool("createPageIndex", { maxBlocks: 100, summaryLimit: 3 })) as Record<string, unknown>;
    expect(created.ok).toBe(true);
    expect(created.blockCount).toBeGreaterThan(0);
    expect(created.truncation).toEqual(expect.objectContaining({ kind: "none", ref: "index" }));

    const searched = (await callTool("searchPageIndex", { query: "ASIN", limit: 5 })) as {
      matches: Array<{ blockId: string; text: string }>;
    };
    expect(searched.matches[0]?.text).toContain("B09877P9CF");

    const longMatch = (await callTool("searchPageIndex", { query: "Long evidence", limit: 1 })) as {
      matches: Array<{ blockId: string; text: string }>;
    };
    const read = (await callTool("readPageBlock", {
      blockId: longMatch.matches[0]?.blockId,
      maxChars: 20
    })) as Record<string, unknown>;
    expect(read.blockId).toBe(longMatch.matches[0]?.blockId);
    expect(read.hasMore).toBe(true);
    expect(read.truncation).toEqual(
      expect.objectContaining({
        kind: "page",
        originalChars: expect.any(Number),
        returnedChars: 20,
        ref: longMatch.matches[0]?.blockId
      })
    );
    expect(read.recommendedNext).toEqual([
      {
        tool: "readPageBlock",
        args: { indexId: expect.any(String), blockId: longMatch.matches[0]?.blockId, offset: 20, maxChars: 20 }
      }
    ]);

    const fields = (await callTool("extractPageFields", { fields: ["Asin", "品牌"] })) as {
      fields: Array<{ field: string; candidates: Array<{ value: string; blockId: string }> }>;
    };
    expect(fields.fields.find((field) => field.field === "Asin")?.candidates[0]?.value).toBe("B09877P9CF");
    expect(fields.fields.find((field) => field.field === "品牌")?.candidates[0]?.value).toBe("Hotcinfin");
  });

  it("reports block lookup failures without throwing", async () => {
    const result = (await callTool("readPageBlock", { blockId: "missing" })) as Record<string, unknown>;
    expect(result).toEqual(expect.objectContaining({ error: "block_not_found", blockId: "missing" }));
  });

  it("reports unknown indexId instead of falling back to current index", async () => {
    await callTool("createPageIndex", { maxBlocks: 100 });

    const result = (await callTool("readPageBlock", { indexId: "missing-index", blockId: "b1" })) as Record<string, unknown>;

    expect(result).toEqual({ error: "index_not_found", indexId: "missing-index", blockId: "b1" });
  });

  it("keeps readPageBlock anchored to the requested indexId after refresh", async () => {
    const firstSearch = (await callTool("searchPageIndex", { query: "ASIN", limit: 1 })) as {
      indexId: string;
      matches: Array<{ blockId: string }>;
    };

    document.body.innerHTML = `<p>Replacement content after refresh</p>`;
    await callTool("createPageIndex", { refresh: true, maxBlocks: 100 });

    const readOld = (await callTool("readPageBlock", {
      indexId: firstSearch.indexId,
      blockId: firstSearch.matches[0]?.blockId
    })) as Record<string, unknown>;
    expect(readOld.text).toContain("B09877P9CF");
    expect(readOld.selectorHint).toBeTruthy();
  });

  it("includes current indexId when blockId is missing", async () => {
    const result = (await callTool("readPageBlock", {})) as Record<string, unknown>;
    expect(result).toEqual(expect.objectContaining({ error: "missing_blockId", indexId: expect.any(String) }));
  });

  it("keeps create/search/extract outputs bounded and exposes index truncation", async () => {
    document.body.innerHTML = Array.from({ length: 120 }, (_, i) => `<p>Search paragraph ${i} with enough content.</p>`).join("");

    const created = (await callTool("createPageIndex", { maxBlocks: 2, summaryLimit: 10_000 })) as {
      summary: unknown[];
      truncated: boolean;
      truncation: { kind: string };
      recommendedNext?: unknown[];
    };
    expect(created.summary).toHaveLength(2);
    expect(created.summary.length).toBeLessThanOrEqual(MAX_SUMMARY_LIMIT);
    expect(created.truncated).toBe(true);
    expect(created.truncation.kind).toBe("index_budget");
    expect(JSON.stringify(created.recommendedNext)).not.toContain("\"query\":\"\"");

    const searched = (await callTool("searchPageIndex", { query: "not-present", maxBlocks: 2 })) as Record<string, unknown>;
    expect(searched).toEqual(expect.objectContaining({ truncated: true, truncation: expect.objectContaining({ kind: "index_budget" }) }));

    const fields = (await callTool("extractPageFields", { fields: ["missing"], maxBlocks: 2 })) as Record<string, unknown>;
    expect(fields).toEqual(expect.objectContaining({ truncated: true, truncation: expect.objectContaining({ kind: "index_budget" }) }));
  });
});
