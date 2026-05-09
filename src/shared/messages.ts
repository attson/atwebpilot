import { z } from "zod";

export const StepSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("tool"),
    tool: z.enum([
      "snapshotDOM",
      "querySelector",
      "querySelectorAll",
      "extractImages",
      "extractText",
      "scroll",
      "waitFor",
      "click",
      "httpRequest",
      "readStorage"
    ]),
    args: z.unknown(),
    bindResultTo: z.string().optional(),
    timeoutMs: z.number().int().positive().optional()
  }),
  z.object({
    kind: z.literal("js"),
    source: z.string(),
    bindResultTo: z.string().optional(),
    timeoutMs: z.number().int().positive().optional()
  })
]);

export const ToolDraftSchema = z.object({
  name: z.string().min(1),
  urlPatterns: z.array(z.string().min(1)).min(1),
  description: z.string().default(""),
  steps: z.array(StepSchema).min(1),
  outputSchema: z.unknown().default({})
});

export const RpcRequest = z.discriminatedUnion("type", [
  z.object({ type: z.literal("tools.list") }),
  z.object({ type: z.literal("tools.get"), id: z.string() }),
  z.object({ type: z.literal("tools.save"), draft: ToolDraftSchema }),
  z.object({ type: z.literal("tools.delete"), id: z.string() }),
  z.object({ type: z.literal("tools.matching"), url: z.string() }),
  z.object({ type: z.literal("tools.export") }),
  z.object({ type: z.literal("tools.import"), bundle: z.unknown() }),
  z.object({
    type: z.literal("runs.start"),
    target: z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("draft"), draft: ToolDraftSchema }),
      z.object({ kind: z.literal("tool"), id: z.string() })
    ]),
    tabId: z.number()
  }),
  z.object({ type: z.literal("runs.list"), toolId: z.string().optional() }),
  z.object({ type: z.literal("runs.get"), id: z.string() }),
  z.object({
    type: z.literal("http.request"),
    url: z.string().url(),
    method: z.enum(["GET", "POST", "PUT", "DELETE", "PATCH"]).default("GET"),
    headers: z.record(z.string()).optional(),
    body: z.string().optional(),
    withCredentials: z.boolean().default(false)
  }),
  z.object({
    type: z.literal("scripting.injectMain"),
    tabId: z.number().optional(),
    source: z.string(),
    args: z.unknown()
  }),

  // chat session
  z.object({ type: z.literal("chat.session.start"), url: z.string() }),
  z.object({
    type: z.literal("chat.session.appendLog"),
    runId: z.string(),
    entry: z.object({
      stepIndex: z.number().int().min(0),
      input: z.unknown(),
      output: z.unknown(),
      ms: z.number().int().min(0),
      error: z.string().optional()
    })
  }),
  z.object({
    type: z.literal("chat.session.end"),
    runId: z.string(),
    status: z.enum(["ok", "error", "aborted"]),
    output: z.unknown().optional()
  }),

  // single step (for sidepanel-driven session loop)
  z.object({
    type: z.literal("runs.runOneStep"),
    step: StepSchema,
    tabId: z.number(),
    bindings: z.record(z.unknown()).default({})
  })
]);

export type RpcRequest = z.infer<typeof RpcRequest>;

export type RpcOk<T> = { ok: true; data: T };
export type RpcErr = { ok: false; error: string };
export type RpcResult<T> = RpcOk<T> | RpcErr;

export const ContentRequest = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("content.runStep"),
    step: StepSchema,
    bindings: z.record(z.unknown())
  })
]);
export type ContentRequest = z.infer<typeof ContentRequest>;
