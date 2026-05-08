import { ContentRequest } from "@/shared/messages";
import type { Json } from "@/shared/types";
import { injectMain } from "./inject-main";
import { callTool } from "./tools";

console.info("[caiji2] content script loaded on", location.href);

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  const parsed = ContentRequest.safeParse(msg);
  if (!parsed.success) return false;
  handle(parsed.data)
    .then((data) => sendResponse({ ok: true, data }))
    .catch((e) => sendResponse({ ok: false, error: e instanceof Error ? e.message : String(e) }));
  return true;
});

async function handle(req: import("@/shared/messages").ContentRequest): Promise<Json> {
  if (req.type === "content.runStep") {
    const { step, bindings } = req;
    if (step.kind === "tool") {
      return callTool(step.tool, resolve(step.args, bindings));
    }
    return injectMain(step.source, bindings as unknown as Json);
  }
  throw new Error(`unhandled content request: ${(req as { type: string }).type}`);
}

function resolve(value: unknown, bindings: Record<string, unknown>): Json {
  if (typeof value === "string") {
    const exact = value.match(/^\$\{([^}]+)\}$/);
    if (exact) {
      const key = exact[1];
      return (key in bindings ? bindings[key] : value) as Json;
    }
    return value.replace(/\$\{([^}]+)\}/g, (_, key) => {
      const v = bindings[key];
      if (v == null) return "";
      return typeof v === "string" ? v : JSON.stringify(v);
    });
  }
  if (Array.isArray(value)) return value.map((v) => resolve(v, bindings));
  if (value && typeof value === "object") {
    const out: Record<string, Json> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = resolve(v, bindings);
    }
    return out;
  }
  return value as Json;
}
