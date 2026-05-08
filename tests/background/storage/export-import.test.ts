import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { _resetDBForTests } from "@/background/storage/db";
import { exportAll, importBundle } from "@/background/storage/export-import";
import { listTools, saveDraft } from "@/background/storage/tools";

describe("export-import", () => {
  beforeEach(() => {
    _resetDBForTests();
    indexedDB = new IDBFactory();
  });
  afterEach(() => _resetDBForTests());

  it("exportAll produces a valid bundle", async () => {
    const t = await saveDraft({
      name: "A",
      urlPatterns: ["https://example.com/*"],
      description: "",
      steps: [{ kind: "tool", tool: "snapshotDOM", args: {} }],
      outputSchema: {}
    });
    const bundle = await exportAll();
    expect(bundle.schema).toBe("caiji.tools/v1");
    expect(bundle.tools).toHaveLength(1);
    expect(bundle.tools[0].id).toBe(t.id);
  });

  it("importBundle merges tools by id (default skip)", async () => {
    const t = await saveDraft({
      name: "A",
      urlPatterns: ["https://example.com/*"],
      description: "",
      steps: [{ kind: "tool", tool: "snapshotDOM", args: {} }],
      outputSchema: {}
    });
    const bundle = {
      schema: "caiji.tools/v1" as const,
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
    const t = await saveDraft({
      name: "A",
      urlPatterns: ["https://example.com/*"],
      description: "",
      steps: [{ kind: "tool", tool: "snapshotDOM", args: {} }],
      outputSchema: {}
    });
    const bundle = {
      schema: "caiji.tools/v1" as const,
      exportedAt: Date.now(),
      tools: [{ ...t, name: "A-modified" }]
    };
    const result = await importBundle(bundle, { onConflict: "overwrite" });
    expect(result.imported).toBe(1);
    const list = await listTools();
    expect(list[0].name).toBe("A-modified");
  });

  it("importBundle copy creates a new id", async () => {
    const t = await saveDraft({
      name: "A",
      urlPatterns: ["https://example.com/*"],
      description: "",
      steps: [{ kind: "tool", tool: "snapshotDOM", args: {} }],
      outputSchema: {}
    });
    const bundle = {
      schema: "caiji.tools/v1" as const,
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
        { schema: "wrong", tools: [] } as unknown as Parameters<typeof importBundle>[0],
        { onConflict: "skip" }
      )
    ).rejects.toThrow();
  });
});
