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
  | "readStorage";

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
