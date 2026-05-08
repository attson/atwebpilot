import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { _resetDBForTests } from "@/background/storage/db";
import {
  appendVersion,
  deleteTool,
  getTool,
  listTools,
  matchingTools,
  saveDraft
} from "@/background/storage/tools";
import type { Step } from "@/shared/types";

const sampleSteps: Step[] = [
  { kind: "tool", tool: "snapshotDOM", args: { maxDepth: 3 } }
];

describe("tools storage", () => {
  beforeEach(async () => {
    _resetDBForTests();
    indexedDB = new IDBFactory();
  });
  afterEach(async () => {
    _resetDBForTests();
  });

  it("saveDraft creates a tool with v1 + listTools returns it", async () => {
    const t = await saveDraft({
      name: "T1",
      urlPatterns: ["https://example.com/*"],
      description: "",
      steps: sampleSteps,
      outputSchema: {}
    });
    expect(t.id).toBeTruthy();
    expect(t.versions).toHaveLength(1);
    expect(t.versions[0].version).toBe(1);

    const list = await listTools();
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe("T1");
  });

  it("getTool returns the saved tool", async () => {
    const t = await saveDraft({
      name: "T2",
      urlPatterns: ["https://example.com/*"],
      description: "",
      steps: sampleSteps,
      outputSchema: {}
    });
    const got = await getTool(t.id);
    expect(got?.id).toBe(t.id);
  });

  it("appendVersion increments version and updates main steps", async () => {
    const t = await saveDraft({
      name: "T3",
      urlPatterns: ["https://example.com/*"],
      description: "",
      steps: sampleSteps,
      outputSchema: {}
    });
    const newSteps: Step[] = [
      { kind: "tool", tool: "extractText", args: { selector: "h1" } }
    ];
    const updated = await appendVersion(t.id, {
      steps: newSteps,
      outputSchema: {},
      note: "fix"
    });
    expect(updated.versions).toHaveLength(2);
    expect(updated.versions[1].version).toBe(2);
    expect(updated.steps).toEqual(newSteps);
  });

  it("matchingTools filters by URL pattern", async () => {
    await saveDraft({
      name: "PDD",
      urlPatterns: ["https://*.yangkeduo.com/**"],
      description: "",
      steps: sampleSteps,
      outputSchema: {}
    });
    await saveDraft({
      name: "TB",
      urlPatterns: ["https://*.taobao.com/**"],
      description: "",
      steps: sampleSteps,
      outputSchema: {}
    });
    const hits = await matchingTools("https://mobile.yangkeduo.com/goods.html");
    expect(hits.map((t) => t.name)).toEqual(["PDD"]);
  });

  it("deleteTool removes the tool", async () => {
    const t = await saveDraft({
      name: "X",
      urlPatterns: ["https://example.com/*"],
      description: "",
      steps: sampleSteps,
      outputSchema: {}
    });
    await deleteTool(t.id);
    expect(await getTool(t.id)).toBeUndefined();
  });
});
