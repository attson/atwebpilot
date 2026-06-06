import { TOOL_DEFS } from "@atwebpilot/shared/llm";
import type { JsonSchema } from "@atwebpilot/shared/types";

/** 与 capabilityForTool 的穷尽 switch 一一对应的 19 个 BuiltinTool。 */
export const EXEC_TOOL_NAMES = [
  "snapshotDOM", "querySelector", "querySelectorAll", "extractText", "extractImages",
  "getValue", "extractFormState", "hover", "focus", "scroll", "waitFor",
  "click", "fillInput", "setCheckbox", "selectOption", "httpRequest",
  "submitForm", "uploadFile", "readStorage"
] as const;

export type GeneratedTool = {
  name: string;
  builtinTool: string;
  description: string;
  inputSchema: { type: string; properties?: Record<string, JsonSchema>; required?: string[] };
};

function rebuildSchema(src: JsonSchema): GeneratedTool["inputSchema"] {
  const s = src as { type?: string; properties?: Record<string, JsonSchema>; required?: string[] };
  const properties: Record<string, JsonSchema> = { ...(s.properties ?? {}) };
  delete properties.tabId; // target tab 由 session 决定，不暴露内部 tabId
  properties.session_id = { type: "string", description: "open_session 返回的会话 id（决定目标 worker 与 tab）" } as JsonSchema;
  const required = [...new Set([...(s.required ?? []).filter((r) => r !== "tabId"), "session_id"])];
  return { type: "object", properties, required };
}

export function generateBrowserTools(): GeneratedTool[] {
  const allow = new Set<string>(EXEC_TOOL_NAMES as readonly string[]);
  return TOOL_DEFS.filter((t) => allow.has(t.name)).map((t) => ({
    name: `browser_${t.name}`,
    builtinTool: t.name,
    description: t.description,
    inputSchema: rebuildSchema(t.input_schema)
  }));
}
