import type { RpcRequest } from "@/shared/messages";
import type { ExportBundle, Json, RunRecord, Step, Tool } from "@/shared/types";

function isReceiverMissing(msg: string): boolean {
  return (
    msg.includes("Could not establish connection") ||
    msg.includes("Receiving end does not exist")
  );
}

async function call<T>(req: RpcRequest, retries = 4): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = (await chrome.runtime.sendMessage(req)) as
        | { ok: true; data: T }
        | { ok: false; error: string };
      if (!res.ok) throw new Error(res.error);
      return res.data;
    } catch (e) {
      lastErr = e;
      const msg = e instanceof Error ? e.message : String(e);
      // 仅对 SW 休眠/唤醒导致的 receiver-missing 重试；其他错立即抛
      if (!isReceiverMissing(msg) || attempt === retries) {
        throw e;
      }
      // 指数级 backoff：150 / 300 / 600 / 1200 ms
      await new Promise((r) => setTimeout(r, 150 * Math.pow(2, attempt)));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

export const rpc = {
  // tools
  listTools: () => call<Tool[]>({ type: "tools.list" }),
  getTool: (id: string) => call<Tool | null>({ type: "tools.get", id }),
  saveTool: (draft: Extract<RpcRequest, { type: "tools.save" }>["draft"]) =>
    call<Tool>({ type: "tools.save", draft }),
  deleteTool: (id: string) => call<null>({ type: "tools.delete", id }),
  matchingTools: (url: string) => call<Tool[]>({ type: "tools.matching", url }),
  exportAll: () => call<ExportBundle>({ type: "tools.export" }),
  importBundle: (bundle: unknown) =>
    call<{ imported: number; skipped: number }>({ type: "tools.import", bundle }),

  // runs
  runDraft: (
    draft: Extract<RpcRequest, { type: "tools.save" }>["draft"],
    tabId: number
  ) => call<RunRecord>({ type: "runs.start", target: { kind: "draft", draft }, tabId }),
  runTool: (id: string, tabId: number) =>
    call<RunRecord>({ type: "runs.start", target: { kind: "tool", id }, tabId }),
  runOneStep: (input: { step: Step; tabId: number; bindings?: Record<string, Json> }) =>
    call<Json>({
      type: "runs.runOneStep",
      step: input.step,
      tabId: input.tabId,
      attachedTabIds: [],
      bindings: input.bindings ?? {}
    }),
  listRuns: (toolId?: string) => call<RunRecord[]>({ type: "runs.list", toolId }),
  getRun: (id: string) => call<RunRecord | null>({ type: "runs.get", id }),

  // chat session
  startSession: (input: { url: string }) =>
    call<RunRecord>({ type: "chat.session.start", url: input.url }),
  appendStepLog: (
    runId: string,
    entry: { stepIndex: number; input: Json; output: Json; ms: number; error?: string }
  ) => call<null>({ type: "chat.session.appendLog", runId, entry }),
  finalizeSession: (
    runId: string,
    status: "ok" | "error" | "aborted",
    output?: Json
  ) => call<RunRecord>({ type: "chat.session.end", runId, status, output })
};

export async function currentTabId(): Promise<number> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error("no active tab");
  return tab.id;
}

export async function currentTabInfo(): Promise<{ tabId: number; url: string }> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error("no active tab");
  return { tabId: tab.id, url: tab.url ?? "" };
}

export function onTabRecommendations(
  cb: (msg: { tabId: number; url: string; tools: Tool[] }) => void
): () => void {
  const listener = (msg: unknown) => {
    if (
      typeof msg === "object" &&
      msg !== null &&
      (msg as { type?: string }).type === "tabs.recommendations"
    ) {
      cb(msg as { type: "tabs.recommendations"; tabId: number; url: string; tools: Tool[] });
    }
  };
  chrome.runtime.onMessage.addListener(listener);
  return () => chrome.runtime.onMessage.removeListener(listener);
}
