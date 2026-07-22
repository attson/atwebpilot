import { beforeEach, describe, expect, it } from "vitest";
import { buildPageIndex } from "@/content/tools/page-index/build";
import { MAX_INDEX_BLOCKS } from "@/content/tools/page-index/types";

describe("buildPageIndex", () => {
  beforeEach(() => {
    document.title = "Product page";
    document.body.innerHTML = `
      <nav>Home Search Account Cart</nav>
      <script>window.big = "noise"</script>
      <style>.hidden { display: none; }</style>
      <div style="display:none"><p>Hidden Product Secret</p></div>
      <div class="hidden"><p>Hidden Class Text</p></div>
      <h1>Leather Bound Journal</h1>
      <p>Inline <strong>important</strong> paragraph content.</p>
      <section>
        <h2>Product information</h2>
        <table>
          <tr><th>Brand Name</th><td>Hotcinfin</td></tr>
          <tr><th>Best Sellers Rank</th><td>#17,540 in Office Products</td></tr>
        </table>
      </section>
      <dl><dt>Price</dt><dd>$20.99</dd></dl>
      <ul id="bullets"><li>240 pages</li><li>Genuine leather cover</li></ul>
      <form><label for="email">Email</label><input id="email" placeholder="name@example.com" /></form>
    `;
  });

  it("builds bounded blocks from visible page structure", () => {
    const index = buildPageIndex({ maxBlocks: 100 });

    expect(index.url).toBe(location.href);
    expect(index.title).toBe("Product page");
    expect(index.truncated).toBe(false);
    expect(index.blocks.every((block, i) => block.blockId === `b${i + 1}` && block.order === i)).toBe(true);
    expect(index.blocks.every((block) => Array.isArray(block.headingPath) && Array.isArray(block.keywords))).toBe(true);
    expect(index.blocks.some((block) => block.kind === "heading" && block.text === "Leather Bound Journal")).toBe(true);
    expect(
      index.blocks.some((block) => block.kind === "text" && block.text === "Inline important paragraph content.")
    ).toBe(true);
    expect(index.blocks.some((block) => block.kind === "list" && block.text === "240 pages")).toBe(true);
    expect(index.blocks).toContainEqual(
      expect.objectContaining({
        kind: "kv",
        label: "Brand Name",
        value: "Hotcinfin",
        text: "Brand Name Hotcinfin"
      })
    );
    expect(index.blocks.some((block) => block.text.includes("window.big"))).toBe(false);
    expect(index.blocks.some((block) => block.text.includes("Home Search Account"))).toBe(false);
    expect(index.blocks.some((block) => block.text.includes("Hidden Product Secret"))).toBe(false);
    expect(index.blocks.some((block) => block.text.includes("Hidden Class Text"))).toBe(false);
  });

  it("creates selector hints that resolve to the indexed element", () => {
    document.body.innerHTML = `
      <table>
        <tr><th>First</th><td>one</td></tr>
        <tr><th>Second</th><td>two</td></tr>
      </table>
    `;

    const index = buildPageIndex({ maxBlocks: 100 });
    const second = index.blocks.find((block) => block.label === "Second");

    expect(second?.selectorHint).toBeTruthy();
    expect(document.querySelector(second!.selectorHint!)?.textContent).toContain("Second");
  });

  it("marks index_budget when maxBlocks is reached", () => {
    const fullIndex = buildPageIndex({ maxBlocks: 100 });
    const expectedOriginalChars = fullIndex.blocks.reduce((sum, block) => sum + block.text.length, 0);
    const expectedReturnedChars = fullIndex.blocks.slice(0, 2).reduce((sum, block) => sum + block.text.length, 0);
    const index = buildPageIndex({ maxBlocks: 2 });

    expect(index.truncated).toBe(true);
    expect(index.truncation).toEqual({
      kind: "index_budget",
      originalChars: expectedOriginalChars,
      returnedChars: expectedReturnedChars,
      reason: "maxBlocks",
      ref: "index"
    });
    expect(index.truncation?.originalChars).toBeGreaterThan(index.truncation?.returnedChars ?? 0);
    expect(index.blocks).toHaveLength(2);
  });

  it("indexes generic div/span key-value rows", () => {
    document.body.innerHTML = `
      <section>
        <div class="detail-row"><span>Price</span><span>$20.99</span></div>
        <div class="product-overview-row"><span>Brand</span><span>Hotcinfin</span></div>
        <span class="inline-row"><span>Rank</span><span>#99</span></span>
      </section>
    `;

    const index = buildPageIndex({ maxBlocks: 100 });

    expect(index.blocks).toContainEqual(expect.objectContaining({ kind: "kv", label: "Price", value: "$20.99" }));
    expect(index.blocks).toContainEqual(expect.objectContaining({ kind: "kv", label: "Brand", value: "Hotcinfin" }));
    expect(index.blocks).toContainEqual(expect.objectContaining({ kind: "kv", label: "Rank", value: "#99" }));
  });

  it("indexes generic text in div and single-child span wrappers", () => {
    document.body.innerHTML = `
      <div class="article-body">This plain div contains enough article text to be indexed by the page index.</div>
      <div class="card"><span>This wrapped card body also contains enough visible text for indexing.</span></div>
    `;

    const index = buildPageIndex({ maxBlocks: 100 });

    expect(index.blocks).toContainEqual(
      expect.objectContaining({ kind: "text", text: "This plain div contains enough article text to be indexed by the page index." })
    );
    expect(index.blocks).toContainEqual(
      expect.objectContaining({ kind: "text", text: "This wrapped card body also contains enough visible text for indexing." })
    );
  });

  it("indexes live form values and selected options", () => {
    document.body.innerHTML = `
      <form>
        <label for="email">Email</label><input id="email" placeholder="name@example.com" />
        <label for="bio">Bio</label><textarea id="bio"></textarea>
        <label for="size">Size</label><select id="size"><option value="s">Small</option><option value="m">Medium</option></select>
        <label><input id="gift" type="checkbox" /> Gift wrap</label>
      </form>
    `;
    (document.querySelector("#email") as HTMLInputElement).value = "typed@example.com";
    (document.querySelector("#bio") as HTMLTextAreaElement).value = "typed bio";
    (document.querySelector("#size") as HTMLSelectElement).value = "m";
    (document.querySelector("#gift") as HTMLInputElement).checked = true;

    const index = buildPageIndex({ maxBlocks: 100 });

    expect(index.blocks).toContainEqual(expect.objectContaining({ kind: "form", label: "Email", value: "typed@example.com" }));
    expect(index.blocks).toContainEqual(expect.objectContaining({ kind: "form", label: "Bio", value: "typed bio" }));
    expect(index.blocks).toContainEqual(expect.objectContaining({ kind: "form", label: "Size", value: "Medium" }));
    expect(index.blocks).toContainEqual(expect.objectContaining({ kind: "form", label: "Gift wrap", value: "checked" }));
  });

  it("clamps maxBlocks to a hard upper bound", () => {
    document.body.innerHTML = Array.from({ length: MAX_INDEX_BLOCKS + 20 }, (_, i) => `<p>Paragraph with enough text ${i}</p>`).join("");

    const index = buildPageIndex({ maxBlocks: MAX_INDEX_BLOCKS + 20 });

    expect(index.maxBlocks).toBe(MAX_INDEX_BLOCKS);
    expect(index.blocks).toHaveLength(MAX_INDEX_BLOCKS);
    expect(index.truncation).toEqual(expect.objectContaining({ kind: "index_budget" }));
  });
});
