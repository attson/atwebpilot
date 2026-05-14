import { beforeEach, describe, expect, it } from "vitest";
import { extractText } from "@/content/tools/extract-text";

describe("extractText", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <h1>标题</h1>
      <ul><li>a</li><li>b</li></ul>
    `;
  });

  it("returns single text when single=true", async () => {
    const r = await extractText({ selector: "h1", single: true });
    expect(r).toBe("标题");
  });

  it("returns array of texts by default", async () => {
    const r = await extractText({ selector: "li" });
    expect(r).toEqual(["a", "b"]);
  });

  it("returns null/[] when no match", async () => {
    expect(await extractText({ selector: ".x", single: true })).toBeNull();
    expect(await extractText({ selector: ".x" })).toEqual([]);
  });
});
