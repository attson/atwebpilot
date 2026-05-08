import type { Json, RunRecord, RunStepLogEntry, RunStatus } from "@/shared/types";
import { getDB } from "./db";

export async function createRun(input: {
  toolId: string | null;
  toolVersion: number | null;
  url: string;
}): Promise<RunRecord> {
  const db = await getDB();
  const run: RunRecord = {
    id: crypto.randomUUID(),
    toolId: input.toolId,
    toolVersion: input.toolVersion,
    url: input.url,
    startedAt: Date.now(),
    status: "running",
    stepLog: []
  };
  await db.put("runs", run);
  return run;
}

export async function appendStepLog(id: string, entry: RunStepLogEntry): Promise<void> {
  const db = await getDB();
  const run = await db.get("runs", id);
  if (!run) throw new Error(`run ${id} not found`);
  run.stepLog.push(entry);
  await db.put("runs", run);
}

export async function finalizeRun(
  id: string,
  patch: { status: RunStatus; output?: Json }
): Promise<RunRecord> {
  const db = await getDB();
  const run = await db.get("runs", id);
  if (!run) throw new Error(`run ${id} not found`);
  run.status = patch.status;
  run.output = patch.output;
  run.finishedAt = Date.now();
  await db.put("runs", run);
  return run;
}

export async function getRun(id: string): Promise<RunRecord | undefined> {
  const db = await getDB();
  return db.get("runs", id);
}

export async function listRuns(filter?: { toolId?: string }): Promise<RunRecord[]> {
  const db = await getDB();
  const all = await db.getAll("runs");
  const filtered = filter?.toolId ? all.filter((r) => r.toolId === filter.toolId) : all;
  return filtered.sort((a, b) => b.startedAt - a.startedAt);
}
