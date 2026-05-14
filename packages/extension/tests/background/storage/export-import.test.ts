import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { _resetDBForTests } from "@/background/storage/db";
import { exportAll, importBundle } from "@/background/storage/export-import";
import { listTools, saveDraft } from "@/background/storage/tools";

function stepsDraft(name: string) {
  return {
    kind: "steps" as const,
    name,
    urlPatterns: ["https://example.com/*"],
    description: "",
    steps: [{ kind: "tool" as const, tool: "snapshotDOM" as const, args: {} }],
    outputSchema: {}
  };
}

describe("export-import", () => {
  beforeEach(() => {
    _resetDBForTests();
    indexedDB = new IDBFactory();
  });
  afterEach(() => _resetDBForTests());

  it("exportAll produces a valid v2 bundle", async () => {
    const t = await saveDraft(stepsDraft("A"));
    const bundle = await exportAll();
    expect(bundle.schema).toBe("caiji.tools/v2");
    expect(bundle.tools).toHaveLength(1);
    expect(bundle.tools[0].id).toBe(t.id);
  });

  it("exports prompt tools in v2 bundles", async () => {
    const t = await saveDraft({
      kind: "prompt",
      name: "Prompt",
      urlPatterns: ["https://example.com/*"],
      description: "",
      prompt: "请总结当前页面"
    });
    const bundle = await exportAll();
    expect(bundle.schema).toBe("caiji.tools/v2");
    expect(bundle.tools[0]).toMatchObject({ id: t.id, kind: "prompt", prompt: "请总结当前页面" });
  });

  it("importBundle merges tools by id (default skip)", async () => {
    const t = await saveDraft(stepsDraft("A"));
    const bundle = {
      schema: "caiji.tools/v2" as const,
      exportedAt: Date.now(),
      tools: [{ ...t, name: "A-modified" }]
    };
    const result = await importBundle(bundle, { onConflict: "skip" });
    expect(result.imported).toBe(0);
    expect(result.skipped).toBe(1);
    const list = await listTools();
    expect(list[0].name).toBe("A");
  });

  it("importBundle overwrite replaces existing", async () => {
    const t = await saveDraft(stepsDraft("A"));
    const bundle = {
      schema: "caiji.tools/v2" as const,
      exportedAt: Date.now(),
      tools: [{ ...t, name: "A-modified" }]
    };
    const result = await importBundle(bundle, { onConflict: "overwrite" });
    expect(result.imported).toBe(1);
    const list = await listTools();
    expect(list[0].name).toBe("A-modified");
  });

  it("importBundle copy creates a new id", async () => {
    const t = await saveDraft(stepsDraft("A"));
    const bundle = {
      schema: "caiji.tools/v2" as const,
      exportedAt: Date.now(),
      tools: [{ ...t, name: "A-modified" }]
    };
    const result = await importBundle(bundle, { onConflict: "copy" });
    expect(result.imported).toBe(1);
    const list = await listTools();
    expect(list).toHaveLength(2);
    expect(list.find((x) => x.name === "A-modified")?.id).not.toBe(t.id);
  });

  it("importBundle rejects invalid schema", async () => {
    await expect(
      importBundle(
        { schema: "caiji.tools/v1", exportedAt: Date.now(), tools: [] } as never,
        { onConflict: "skip" }
      )
    ).rejects.toThrow("schema mismatch");
  });
});
