import {
  ContentRequest as ContentRequestSchema,
  RpcRequest as RpcRequestSchema,
  type RpcRequest
} from "@/shared/messages";
import type { Json, RunRecord, Step, ToolDraft } from "@/shared/types";
import { fetchAsBase64, httpRequest } from "./http-proxy";
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
      return (await saveDraft(req.draft as ToolDraft)) as unknown as Json;
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
    case "chat.session.start": {
      const run = await createRun({ toolId: null, toolVersion: null, url: req.url });
      return run as unknown as Json;
    }
    case "chat.session.appendLog": {
      await appendStepLog(req.runId, {
        stepIndex: req.entry.stepIndex,
        input: req.entry.input as Json,
        output: req.entry.output as Json,
        ms: req.entry.ms,
        error: req.entry.error
      });
      return null;
    }
    case "chat.session.end": {
      const r = await finalizeRun(req.runId, {
        status: req.status,
        output: req.output as Json | undefined
      });
      return r as unknown as Json;
    }
    case "runs.runOneStep": {
      return (await runOneStep(
        req.step as Step,
        req.tabId,
        req.attachedTabIds,
        req.bindings as Record<string, Json>
      )) as unknown as Json;
    }
    case "tabs.list":
      return (await listTabsRpc(req.windowId)) as unknown as Json;
    case "tabs.open":
      return (await openTabRpc(req.url, req.active ?? false)) as unknown as Json;
    case "http.fetchBinary": {
      return (await fetchAsBase64(req.url)) as unknown as Json;
    }
  }
}

async function runOneStep(
  step: Step,
  rpcTabId: number,
  attachedTabIds: number[],
  bindings: Record<string, Json>
): Promise<Json> {
  let targetTabId = rpcTabId;
  if (step.kind === "tool") {
    const argsObj = (step.args ?? {}) as Record<string, Json>;
    const declared = argsObj.tabId;
    if (typeof declared === "number") targetTabId = declared;
  }
  if (targetTabId !== rpcTabId && !attachedTabIds.includes(targetTabId)) {
    throw new Error(`tab ${targetTabId} not attached; call attachTab first or omit tabId`);
  }

  const stepReq = ContentRequestSchema.parse({
    type: "content.runStep",
    step,
    bindings
  });
  let res: { ok: true; data: Json } | { ok: false; error: string };
  try {
    res = (await chrome.tabs.sendMessage(targetTabId, stepReq)) as typeof res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!isReceiverMissing(msg)) throw e;
    // content script 还没在该 tab 上加载——尝试动态注入
    const injected = await injectContentScript(targetTabId);
    if (!injected) {
      throw new Error(
        "Content script 无法注入到此页面（可能是 chrome:// 或受限页面）。请在普通网页上重试。"
      );
    }
    // 注入完成后 listener 注册可能还需要几百 ms（@crxjs ESM loader 异步）
    res = await retryUntilReady(targetTabId, stepReq);
  }
  if (!res.ok) throw new Error(res.error);
  return res.data;
}

function isReceiverMissing(msg: string): boolean {
  return (
    msg.includes("Could not establish connection") ||
    msg.includes("Receiving end does not exist")
  );
}

async function injectContentScript(tabId: number): Promise<boolean> {
  const manifest = chrome.runtime.getManifest();
  const cs = manifest.content_scripts?.[0];
  const files = cs?.js;
  if (!files?.length) return false;
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files });
    return true;
  } catch (e) {
    console.warn("[webpilot] content script inject failed", e);
    return false;
  }
}

async function retryUntilReady(
  tabId: number,
  stepReq: unknown,
  deadlineMs = 2000,
  intervalMs = 100
): Promise<{ ok: true; data: Json } | { ok: false; error: string }> {
  const start = Date.now();
  let lastErr: unknown;
  while (Date.now() - start < deadlineMs) {
    try {
      return (await chrome.tabs.sendMessage(tabId, stepReq)) as
        | { ok: true; data: Json }
        | { ok: false; error: string };
    } catch (e) {
      lastErr = e;
      const msg = e instanceof Error ? e.message : String(e);
      if (!isReceiverMissing(msg)) throw e;
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }
  const tail = lastErr instanceof Error ? lastErr.message : String(lastErr);
  throw new Error(
    `Content script 注入后 ${deadlineMs}ms 内仍无响应。请刷新页面（Cmd/Ctrl+R）再试。底层错误: ${tail}`
  );
}

async function runTool(req: Extract<RpcRequest, { type: "runs.start" }>): Promise<RunRecord> {
  let steps: Step[];
  let toolId: string | null = null;
  let toolVersion: number | null = null;
  if (req.target.kind === "draft") {
    if (req.target.draft.kind !== "steps") throw new Error("draft runs require steps tools");
    steps = req.target.draft.steps as Step[];
  } else {
    const tool = await getTool(req.target.id);
    if (!tool) throw new Error("tool not found");
    if (tool.kind !== "steps") throw new Error("prompt tools run in chat, not background runner");
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
  const [res] = await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    args: [source, args],
    func: (src: string, a: unknown) => {
      try {
        // eslint-disable-next-line no-new-func
        const fn = new Function(
          "ctx",
          `"use strict"; return (async (ctx) => { ${src} })(ctx);`
        ) as (ctx: unknown) => Promise<unknown>;
        return Promise.resolve(fn(a)).then(
          (v) => ({ __ok: true as const, value: v }),
          (e: unknown) => ({
            __ok: false as const,
            error:
              e instanceof Error
                ? `${e.name}: ${e.message}\n${e.stack ?? ""}`.trim()
                : String(e)
          })
        );
      } catch (e) {
        return {
          __ok: false as const,
          error: e instanceof Error ? `${e.name}: ${e.message}` : String(e)
        };
      }
    }
  });
  const result = res?.result;
  if (
    result &&
    typeof result === "object" &&
    "__ok" in (result as Record<string, unknown>)
  ) {
    const wrapped = result as { __ok: boolean; value?: unknown; error?: string };
    if (wrapped.__ok) return ((wrapped.value ?? null) as Json);
    throw new Error(`runJS error: ${wrapped.error ?? "(unknown)"}`);
  }
  return (result ?? null) as Json;
}

async function listTabsRpc(windowId?: number): Promise<{
  tabs: Array<{ tabId: number; windowId: number; url: string; title: string }>;
}> {
  const query: chrome.tabs.QueryInfo = windowId == null ? {} : { windowId };
  const all = await chrome.tabs.query(query);
  const tabs = all
    .filter((t) => t.id != null && !t.incognito && isAccessibleUrl(t.url ?? ""))
    .map((t) => ({
      tabId: t.id as number,
      windowId: t.windowId,
      url: t.url ?? "",
      title: t.title ?? ""
    }));
  return { tabs };
}

async function openTabRpc(url: string, active: boolean): Promise<{
  tabId: number; url: string; title: string;
}> {
  if (!isAccessibleUrl(url)) throw new Error("openTab: URL scheme not allowed");
  const tab = await chrome.tabs.create({ url, active });
  if (tab.id == null) throw new Error("openTab: chrome did not return a tab id");
  return { tabId: tab.id, url: tab.url ?? url, title: tab.title ?? "" };
}

function isAccessibleUrl(url: string): boolean {
  if (!url) return false;
  return /^https?:|^file:|^ftp:/.test(url);
}
