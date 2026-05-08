import {
  ContentRequest as ContentRequestSchema,
  RpcRequest as RpcRequestSchema,
  type RpcRequest
} from "@/shared/messages";
import type { Json, RunRecord, Tool } from "@/shared/types";
import { httpRequest } from "./http-proxy";
import { exportAll, importBundle } from "./storage/export-import";
import { appendStepLog, createRun, finalizeRun, getRun, listRuns } from "./storage/runs";
import {
  deleteTool as deleteToolDb,
  getTool,
  listTools,
  matchingTools,
  recordRunStat,
  saveDraft
} from "./storage/tools";

export async function handleRpc(raw: unknown): Promise<{ ok: true; data: Json } | { ok: false; error: string }> {
  const parsed = RpcRequestSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid request: " + parsed.error.message };
  try {
    const data = await dispatch(parsed.data);
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

async function dispatch(req: RpcRequest): Promise<Json> {
  switch (req.type) {
    case "tools.list":
      return (await listTools()) as unknown as Json;
    case "tools.get":
      return ((await getTool(req.id)) ?? null) as unknown as Json;
    case "tools.save":
      return (await saveDraft({
        name: req.draft.name,
        urlPatterns: req.draft.urlPatterns,
        description: req.draft.description ?? "",
        steps: req.draft.steps as Tool["steps"],
        outputSchema: (req.draft.outputSchema ?? {}) as Json
      })) as unknown as Json;
    case "tools.delete":
      await deleteToolDb(req.id);
      return null;
    case "tools.matching":
      return (await matchingTools(req.url)) as unknown as Json;
    case "tools.export":
      return (await exportAll()) as unknown as Json;
    case "tools.import": {
      const result = await importBundle(req.bundle as Parameters<typeof importBundle>[0], {
        onConflict: "skip"
      });
      return result as unknown as Json;
    }
    case "runs.start":
      return (await runTool(req)) as unknown as Json;
    case "runs.list":
      return (await listRuns({ toolId: req.toolId })) as unknown as Json;
    case "runs.get":
      return ((await getRun(req.id)) ?? null) as unknown as Json;
    case "http.request":
      return (await httpRequest({
        url: req.url,
        method: req.method,
        headers: req.headers,
        body: req.body,
        withCredentials: req.withCredentials
      })) as unknown as Json;
    case "scripting.injectMain": {
      if (req.tabId == null) throw new Error("scripting.injectMain: tabId missing");
      return (await injectMainWorld(req.tabId, req.source, req.args as Json)) as unknown as Json;
    }
  }
}

async function runTool(req: Extract<RpcRequest, { type: "runs.start" }>): Promise<RunRecord> {
  let steps: Tool["steps"];
  let toolId: string | null = null;
  let toolVersion: number | null = null;
  if (req.target.kind === "draft") {
    steps = req.target.draft.steps as Tool["steps"];
  } else {
    const tool = await getTool(req.target.id);
    if (!tool) throw new Error("tool not found");
    steps = tool.steps;
    toolId = tool.id;
    toolVersion = tool.versions.at(-1)?.version ?? 1;
  }

  const tab = await chrome.tabs.get(req.tabId);
  const url = tab.url ?? "";
  const run = await createRun({ toolId, toolVersion, url });

  const bindings: Record<string, Json> = {};
  let lastOutput: Json = null;

  try {
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const start = Date.now();
      const stepReq = ContentRequestSchema.parse({
        type: "content.runStep",
        step,
        bindings
      });
      const res = (await chrome.tabs.sendMessage(req.tabId, stepReq)) as
        | { ok: true; data: Json }
        | { ok: false; error: string };
      if (!res.ok) {
        await appendStepLog(run.id, {
          stepIndex: i,
          input: step.kind === "tool" ? (step.args as Json) : step.source,
          output: null,
          ms: Date.now() - start,
          error: res.error
        });
        await finalizeRun(run.id, { status: "error" });
        if (toolId) await recordRunStat(toolId, false);
        return (await getRun(run.id)) as RunRecord;
      }
      await appendStepLog(run.id, {
        stepIndex: i,
        input: step.kind === "tool" ? (step.args as Json) : step.source,
        output: res.data,
        ms: Date.now() - start
      });
      if (step.bindResultTo) bindings[step.bindResultTo] = res.data;
      lastOutput = res.data;
    }
    await finalizeRun(run.id, { status: "ok", output: lastOutput });
    if (toolId) await recordRunStat(toolId, true);
    return (await getRun(run.id)) as RunRecord;
  } catch (e) {
    await finalizeRun(run.id, { status: "error" });
    if (toolId) await recordRunStat(toolId, false);
    throw e;
  }
}

async function injectMainWorld(tabId: number, source: string, args: Json): Promise<Json> {
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    args: [source, args],
    func: (src: string, a: unknown) => {
      // eslint-disable-next-line no-new-func
      const fn = new Function(
        "ctx",
        `"use strict"; return (async (ctx) => { ${src} })(ctx);`
      ) as (ctx: unknown) => Promise<unknown>;
      return fn(a);
    }
  });
  return (result ?? null) as Json;
}
