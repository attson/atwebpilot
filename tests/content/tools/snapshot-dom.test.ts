import { beforeEach, describe, expect, it } from "vitest";
import { snapshotDOM } from "@/content/tools/snapshot-dom";

describe("snapshotDOM", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="root">
        <h1 class="title">Hello</h1>
        <ul>
          <li>a</li>
          <li>b</li>
        </ul>
      </div>
    `;
  });

  it("returns a tree with tags, ids, classes and text", async () => {
    const result = (await snapshotDOM({ maxDepth: 4, root: "#root" })) as Record<string, unknown>;
    expect(result.tag).toBe("div");
    expect(result.id).toBe("root");
    const h1 = (result.children as Record<string, unknown>[])[0];
    expect(h1.tag).toBe("h1");
    expect(h1.classes).toEqual(["title"]);
    expect(h1.text).toBe("Hello");
  });

  it("respects maxDepth", async () => {
    const result = (await snapshotDOM({ maxDepth: 1, root: "#root" })) as Record<string, unknown>;
    const ul = (result.children as Record<string, unknown>[])[1];
    expect(ul.tag).toBe("ul");
    expect(ul.children).toBeUndefined();
  });

  it("falls back to document if root selector misses", async () => {
    const result = await snapshotDOM({ maxDepth: 1, root: "#missing" });
    expect((result as Record<string, unknown>).tag).toBe("html");
  });
});
