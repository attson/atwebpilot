export type Json =
  | null
  | boolean
  | number
  | string
  | Json[]
  | { [k: string]: Json };

export type JsonSchema = Json;

export type BuiltinTool =
  | "snapshotDOM"
  | "querySelector"
  | "querySelectorAll"
  | "extractImages"
  | "extractText"
  | "scroll"
  | "waitFor"
  | "click"
  | "httpRequest"
  | "readStorage"
  // Plan 3 additions
  | "fillInput"
  | "setCheckbox"
  | "selectOption"
  | "submitForm"
  | "hover"
  | "focus"
  | "uploadFile"
  | "getValue"
  | "extractFormState";

export type Step =
  | { kind: "tool"; tool: BuiltinTool; args: Json; bindResultTo?: string; timeoutMs?: number }
  | { kind: "js"; source: string; bindResultTo?: string; timeoutMs?: number };

export type ToolVersion = {
  version: number;
  steps: Step[];
  outputSchema: JsonSchema;
  createdAt: number;
  note?: string;
};

export type Tool = {
  id: string;
  name: string;
  urlPatterns: string[];
  description: string;
  steps: Step[];
  outputSchema: JsonSchema;
  createdAt: number;
  updatedAt: number;
  versions: ToolVersion[];
  stats: { runs: number; lastRunAt?: number; lastRunOk?: boolean };
};

export type RunStepLogEntry = {
  stepIndex: number;
  input: Json;
  output: Json;
  ms: number;
  error?: string;
};

export type RunStatus = "pending-approval" | "running" | "ok" | "error" | "aborted";

export type RunRecord = {
  id: string;
  toolId: string | null;
  toolVersion: number | null;
  url: string;
  startedAt: number;
  finishedAt?: number;
  status: RunStatus;
  stepLog: RunStepLogEntry[];
  output?: Json;
};

export type ExportBundle = {
  schema: "caiji.tools/v1";
  exportedAt: number;
  tools: Tool[];
};

// === Plan 2 additions ===

export type TextPart = { type: "text"; text: string };
export type ToolUsePart = { type: "tool_use"; id: string; name: string; input: Json };
export type ToolResultPart = {
  type: "tool_result";
  tool_use_id: string;
  content: string;
  is_error?: boolean;
};

export type ChatMessage =
  | { role: "user"; content: string | Array<TextPart | ToolResultPart> }
  | { role: "assistant"; content: Array<TextPart | ToolUsePart> };

export type Severity = "info" | "caution" | "dangerous";

export type ScanFinding = {
  rule: string;
  severity: Severity;
  message: string;
  matches: { line: number; col: number; text: string }[];
};

export type LlmProvider = "anthropic" | "openai";

export type LlmSettings = {
  provider: LlmProvider;
  model: string;
  apiKey: string;
  apiKeyMode: "persistent" | "session";
  maxRounds: number;
  /** 自定义 base URL，留空 = 用 provider 默认值。例如 "https://api.openai.com/v1" */
  endpoint?: string;
  /** dangerous 工具白名单。空数组 = 全部人工 */
  autoApproveDangerous: string[];
};
