import { beforeEach, describe, expect, it } from "vitest";
import { querySelector, querySelectorAll } from "@/content/tools/query";

describe("query", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <ul><li class="x">a</li><li class="x">b</li><li class="y">c</li></ul>
    `;
  });

  it("querySelector returns first matched node summary", async () => {
    const r = (await querySelector({ selector: ".x" })) as Record<string, unknown>;
    expect(r.tag).toBe("li");
    expect(r.text).toBe("a");
  });

  it("querySelector returns null if none", async () => {
    const r = await querySelector({ selector: ".missing" });
    expect(r).toBeNull();
  });

  it("querySelectorAll returns array of summaries", async () => {
    const r = (await querySelectorAll({ selector: ".x" })) as Record<string, unknown>[];
    expect(r).toHaveLength(2);
    expect(r.map((n) => n.text)).toEqual(["a", "b"]);
  });

  it("querySelectorAll respects limit", async () => {
    const r = (await querySelectorAll({ selector: "li", limit: 2 })) as unknown[];
    expect(r).toHaveLength(2);
  });
});
