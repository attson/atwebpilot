import type { RpcRequest } from "@/shared/messages";
import type { ExportBundle, RunRecord, Tool } from "@/shared/types";

async function call<T>(req: RpcRequest): Promise<T> {
  const res = (await chrome.runtime.sendMessage(req)) as
    | { ok: true; data: T }
    | { ok: false; error: string };
  if (!res.ok) throw new Error(res.error);
  return res.data;
}

export const rpc = {
  listTools: () => call<Tool[]>({ type: "tools.list" }),
  getTool: (id: string) => call<Tool | null>({ type: "tools.get", id }),
  saveTool: (draft: Extract<RpcRequest, { type: "tools.save" }>["draft"]) =>
    call<Tool>({ type: "tools.save", draft }),
  deleteTool: (id: string) => call<null>({ type: "tools.delete", id }),
  matchingTools: (url: string) => call<Tool[]>({ type: "tools.matching", url }),
  exportAll: () => call<ExportBundle>({ type: "tools.export" }),
  importBundle: (bundle: unknown) =>
    call<{ imported: number; skipped: number }>({ type: "tools.import", bundle }),
  runDraft: (
    draft: Extract<RpcRequest, { type: "tools.save" }>["draft"],
    tabId: number
  ) => call<RunRecord>({ type: "runs.start", target: { kind: "draft", draft }, tabId }),
  runTool: (id: string, tabId: number) =>
    call<RunRecord>({ type: "runs.start", target: { kind: "tool", id }, tabId }),
  listRuns: (toolId?: string) => call<RunRecord[]>({ type: "runs.list", toolId }),
  getRun: (id: string) => call<RunRecord | null>({ type: "runs.get", id })
};

export async function currentTabId(): Promise<number> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error("no active tab");
  return tab.id;
}
