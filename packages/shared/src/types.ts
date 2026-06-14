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
  | "extractFormState"
  | "askUser";

/** BuiltinTool minus the sidepanel-only `askUser` (which can't be replayed). */
export type ReplayableTool = Exclude<BuiltinTool, "askUser">;

export type Step =
  | { kind: "tool"; tool: ReplayableTool; args: Json; bindResultTo?: string; timeoutMs?: number }
  | { kind: "js"; source: string; bindResultTo?: string; timeoutMs?: number };

export type StepsToolVersion = {
  version: number;
  kind: "steps";
  steps: Step[];
  outputSchema: JsonSchema;
  createdAt: number;
  note?: string;
};

export type PromptToolVersion = {
  version: number;
  kind: "prompt";
  prompt: string;
  createdAt: number;
  note?: string;
};

export type ToolVersion = StepsToolVersion | PromptToolVersion;

export type ToolStats = { runs: number; lastRunAt?: number; lastRunOk?: boolean };

export type StepsTool = {
  kind: "steps";
  id: string;
  name: string;
  urlPatterns: string[];
  description: string;
  steps: Step[];
  outputSchema: JsonSchema;
  createdAt: number;
  updatedAt: number;
  versions: StepsToolVersion[];
  stats: ToolStats;
};

export type PromptTool = {
  kind: "prompt";
  id: string;
  name: string;
  urlPatterns: string[];
  description: string;
  prompt: string;
  createdAt: number;
  updatedAt: number;
  versions: PromptToolVersion[];
  stats: ToolStats;
};

export type Tool = StepsTool | PromptTool;

export type StepsToolDraft = {
  kind: "steps";
  name: string;
  urlPatterns: string[];
  description: string;
  steps: Step[];
  outputSchema: JsonSchema;
};

export type PromptToolDraft = {
  kind: "prompt";
  name: string;
  urlPatterns: string[];
  description: string;
  prompt: string;
};

export type ToolDraft = StepsToolDraft | PromptToolDraft;

export type RunStepLogEntry = {
  stepIndex: number;
  input: Json;
  output: Json;
  ms: number;
  error?: string;
};

export type RunStatus = "pending-approval" | "running" | "ok" | "error" | "aborted";

export type RunSource = "user" | "coordinator";

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
  source: RunSource;
};

export type ExportBundle = {
  schema: "caiji.tools/v2";
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
  /** dangerous 工具白名单，在 permissionMode === "trust" 时被消费。 */
  trustedDangerTools: string[];
  /** 新会话启动时使用的默认权限模式。 */
  defaultPermissionMode: "read" | "default" | "trust" | "yolo";
  /** 单次 LLM 响应的 max_tokens；留空 = 用 provider 默认（4096） */
  maxTokens?: number;
  /**
   * 当模型某轮不调用任何工具（疑似提前收尾）时，最多连续追问几次让它确认/继续。
   * 模型只要再执行一次工具（取得进展），该计数就清零。留空 = 默认 1。0 = 关闭（旧行为：纯文本即结束）。
   */
  maxContinuationNudges?: number;
};

// === 原始 LLM 交互日志（see specs/2026-05-23-raw-llm-exchange-log-design.md）===

export type LlmExchangeRequest = {
  provider: LlmProvider;
  model: string;
  endpoint?: string;
  maxTokens?: number;
  system: string;
  messages: ChatMessage[]; // 完整上下文，单块内容按上限截断
  toolNames: string[];
};

export type LlmExchangeResponse = {
  text: string;
  toolUses: { id: string; name: string; input: Json }[];
  usage?: { input_tokens: number; output_tokens: number };
  stopReason?: string;
  error?: string;
  aborted?: boolean;
};

export type LlmExchange = {
  id: string;
  round: number;
  kind: "main" | "tool-draft";
  startedAt: number;
  durationMs: number;
  request: LlmExchangeRequest;
  response: LlmExchangeResponse;
};

export type AttachedTabSource = "mention" | "ai-open" | "approval";

export type AttachedTab = {
  tabId: number;
  windowId: number;
  source: AttachedTabSource;
  addedAt: number;
  lastSeenUrl: string;
  lastSeenTitle: string;
  urlChanged?: boolean;
};

// === Persistence (see specs/2026-05-19-sidepanel-session-persistence-design.md) ===

export type PersistedCard = {
  toolUseId: string;
  name: string;
  input: Json;
  partialJson: string;
  inputReady: boolean;
  status: "draft" | "awaiting" | "running" | "ok" | "error" | "skipped" | "denied";
  output?: Json;
  error?: string;
  ms?: number;
};

export type PersistedSessionData = {
  messages: ChatMessage[];
  cards: PersistedCard[];
  executedSteps: Step[];
  tokenUsage: { input: number; output: number };
  roundCount: number;
  attachedTabs: AttachedTab[];
  url: string;
  runRecordId: string | null;
  errorMessage: string | null;
  /** 自 2026-05-23 起新增；旧持久化记录可能没有，读时默认 []。 */
  llmExchanges?: LlmExchange[];
};

export type PersistedSession = {
  id: string;
  url: string;
  lastTabId: number;
  status: "active" | "archived";
  data: PersistedSessionData;
  createdAt: number;
  updatedAt: number;
};
