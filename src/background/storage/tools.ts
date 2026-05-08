import { matchesAny } from "@/shared/url-pattern";
import type { JsonSchema, Step, Tool } from "@/shared/types";
import { getDB } from "./db";

export type ToolDraft = {
  name: string;
  urlPatterns: string[];
  description: string;
  steps: Step[];
  outputSchema: JsonSchema;
};

function uuid(): string {
  return crypto.randomUUID();
}

export async function saveDraft(draft: ToolDraft): Promise<Tool> {
  const db = await getDB();
  const now = Date.now();
  const tool: Tool = {
    id: uuid(),
    name: draft.name,
    urlPatterns: draft.urlPatterns,
    description: draft.description,
    steps: draft.steps,
    outputSchema: draft.outputSchema,
    createdAt: now,
    updatedAt: now,
    versions: [
      { version: 1, steps: draft.steps, outputSchema: draft.outputSchema, createdAt: now }
    ],
    stats: { runs: 0 }
  };
  await db.put("tools", tool);
  return tool;
}

export async function appendVersion(
  id: string,
  patch: { steps: Step[]; outputSchema: JsonSchema; note?: string }
): Promise<Tool> {
  const db = await getDB();
  const tool = await db.get("tools", id);
  if (!tool) throw new Error(`tool ${id} not found`);
  const next = (tool.versions.at(-1)?.version ?? 0) + 1;
  const now = Date.now();
  const updated: Tool = {
    ...tool,
    steps: patch.steps,
    outputSchema: patch.outputSchema,
    updatedAt: now,
    versions: [
      ...tool.versions,
      {
        version: next,
        steps: patch.steps,
        outputSchema: patch.outputSchema,
        createdAt: now,
        note: patch.note
      }
    ]
  };
  await db.put("tools", updated);
  return updated;
}

export async function listTools(): Promise<Tool[]> {
  const db = await getDB();
  return db.getAll("tools");
}

export async function getTool(id: string): Promise<Tool | undefined> {
  const db = await getDB();
  return db.get("tools", id);
}

export async function deleteTool(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("tools", id);
}

export async function matchingTools(url: string): Promise<Tool[]> {
  const all = await listTools();
  return all.filter((t) => matchesAny(url, t.urlPatterns));
}

export async function recordRunStat(id: string, ok: boolean): Promise<void> {
  const db = await getDB();
  const tool = await db.get("tools", id);
  if (!tool) return;
  tool.stats.runs += 1;
  tool.stats.lastRunAt = Date.now();
  tool.stats.lastRunOk = ok;
  await db.put("tools", tool);
}
