import { createHash } from "node:crypto";
import type {
  EventSignals,
  ParsedSession,
  SessionClient,
  ToolEvent
} from "./types";

type JsonObject = Record<string, unknown>;

type ParseInput = {
  client: SessionClient;
  lines: AsyncIterable<string | Buffer>;
  fallbackSessionKey: string;
  sinceMs: number;
};

function isObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function asObject(value: unknown): JsonObject {
  return isObject(value) ? value : {};
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (isObject(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function normalizeToolName(name: string): string | null {
  const prefixes = [/^mcp__atwebpilot__/, /^atwebpilot__/, /^atwebpilot\./];
  for (const prefix of prefixes) {
    if (prefix.test(name)) return name.replace(prefix, "");
  }
  return null;
}

function parseArguments(value: unknown): JsonObject {
  if (isObject(value)) return value;
  if (typeof value !== "string") return {};
  try {
    return asObject(JSON.parse(value));
  } catch {
    return {};
  }
}

function signalsFor(tool: string, args: JsonObject): EventSignals {
  if (tool === "browser_waitFor") {
    return {
      fixedWait:
        typeof args.ms === "number" &&
        args.selector == null &&
        args.text == null &&
        args.textGone == null
    };
  }
  if (tool === "browser_runJS") {
    const source = typeof args.source === "string" ? args.source : "";
    return {
      viewportProbe: /\b(?:innerWidth|innerHeight|outerWidth|outerHeight|devicePixelRatio|visualViewport)\b|\bscreen\s*\./.test(source)
    };
  }
  if (tool === "browser_discoverTools") {
    const enable = Array.isArray(args.enable) ? args.enable : [];
    const enableGroups = Array.isArray(args.enableGroups) ? args.enableGroups : [];
    return {
      emptyDiscovery: enable.length === 0 && enableGroups.length === 0,
      enablesDiscovery: enable.length > 0 || enableGroups.length > 0
    };
  }
  return {};
}

function timestampOf(record: JsonObject): number | undefined {
  const raw = record.timestamp;
  if (typeof raw !== "string" && typeof raw !== "number") return undefined;
  const value = typeof raw === "number" ? raw : Date.parse(raw);
  return Number.isFinite(value) ? value : undefined;
}

function numeric(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function claudeUsage(message: JsonObject): { input: number; output: number } {
  const usage = asObject(message.usage);
  return {
    input:
      numeric(usage.input_tokens) +
      numeric(usage.cache_creation_input_tokens) +
      numeric(usage.cache_read_input_tokens),
    output: numeric(usage.output_tokens)
  };
}

function contentBlocks(value: unknown): JsonObject[] {
  if (Array.isArray(value)) return value.filter(isObject);
  return isObject(value) ? [value] : [];
}

function safeSessionKey(client: SessionClient, raw: unknown, fallback: string): string {
  const source = typeof raw === "string" && raw ? raw : fallback;
  return hash(`${client}:${source}`).slice(0, 24);
}

function safeRoundKey(sessionKey: string, raw: unknown, sequence: number): string {
  const source = typeof raw === "string" && raw ? raw : `sequence:${sequence}`;
  return hash(`${sessionKey}:${source}`).slice(0, 24);
}

function makeExactEvent(input: {
  client: SessionClient;
  sessionKey: string;
  roundKey: string;
  sequence: number;
  timestampMs?: number;
  callId: string;
  rawTool: string;
  args: JsonObject;
  inputTokens?: number;
  outputTokens?: number;
}): ToolEvent | null {
  const tool = normalizeToolName(input.rawTool);
  if (!tool) return null;
  return {
    id: hash(`${input.sessionKey}:${input.callId}`).slice(0, 24),
    client: input.client,
    sessionKey: input.sessionKey,
    roundKey: input.roundKey,
    sequence: input.sequence,
    ...(input.timestampMs == null ? {} : { timestampMs: input.timestampMs }),
    tool,
    argFields: Object.keys(input.args).sort(),
    argHash: hash(stableStringify(input.args)),
    confidence: "exact",
    signals: signalsFor(tool, input.args),
    ...(input.inputTokens == null ? {} : { roundInputTokens: input.inputTokens }),
    ...(input.outputTokens == null ? {} : { roundOutputTokens: input.outputTokens })
  };
}

function attachResult(
  callId: unknown,
  callById: Map<string, ToolEvent>,
  line: string,
  isError: boolean
): void {
  if (typeof callId !== "string") return;
  const event = callById.get(callId);
  if (!event) return;
  event.resultBytes = Buffer.byteLength(line, "utf8");
  event.isError = isError;
}

function nestedCodexEvents(input: {
  record: JsonObject;
  payload: JsonObject;
  sessionKey: string;
  startSequence: number;
}): ToolEvent[] {
  if (input.payload.name !== "exec" && input.payload.name !== "functions.exec") return [];
  if (typeof input.payload.input !== "string") return [];
  const events: ToolEvent[] = [];
  for (const rawTool of executableNestedToolNames(input.payload.input)) {
    const tool = normalizeToolName(rawTool);
    if (!tool) continue;
    const sequence = input.startSequence + events.length;
    const callId = `${String(input.payload.call_id ?? input.payload.id ?? "exec")}:${events.length}`;
    events.push({
      id: hash(`${input.sessionKey}:${callId}`).slice(0, 24),
      client: "codex",
      sessionKey: input.sessionKey,
      roundKey: safeRoundKey(input.sessionKey, input.payload.id ?? input.payload.call_id, sequence),
      sequence,
      ...(timestampOf(input.record) == null ? {} : { timestampMs: timestampOf(input.record) }),
      tool,
      argFields: [],
      confidence: "derived",
      signals: {}
    });
  }
  return events;
}

/**
 * Finds nested MCP calls in executable JavaScript while ignoring quoted patch
 * bodies, examples and comments. This is intentionally a small lexer rather
 * than a JavaScript parser; generated orchestration calls use the simple
 * `tools.<name>(...)` form.
 */
function executableNestedToolNames(source: string): string[] {
  const names: string[] = [];
  const prefix = "tools.mcp__atwebpilot__";
  let quote: "'" | '"' | "`" | null = null;
  let lineComment = false;
  let blockComment = false;
  let escaped = false;

  for (let index = 0; index < source.length; index++) {
    const char = source[index];
    const next = source[index + 1];
    if (lineComment) {
      if (char === "\n") lineComment = false;
      continue;
    }
    if (blockComment) {
      if (char === "*" && next === "/") {
        blockComment = false;
        index++;
      }
      continue;
    }
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }
    if (char === "/" && next === "/") {
      lineComment = true;
      index++;
      continue;
    }
    if (char === "/" && next === "*") {
      blockComment = true;
      index++;
      continue;
    }
    if (char === "'" || char === '"' || char === "`") {
      quote = char;
      continue;
    }
    if (!source.startsWith(prefix, index)) continue;

    let end = index + "tools.".length;
    while (end < source.length && /[A-Za-z0-9_]/.test(source[end])) end++;
    let cursor = end;
    while (cursor < source.length && /\s/.test(source[cursor])) cursor++;
    if (source[cursor] === "(") names.push(source.slice(index + "tools.".length, end));
    index = end - 1;
  }
  return names;
}

function candidateLine(client: SessionClient, line: string): boolean {
  return client === "claude"
    ? line.includes('"tool_use"') || line.includes('"tool_result"')
    : line.includes("function_call") || line.includes("custom_tool_call");
}

export async function parseSessionLines(input: ParseInput): Promise<ParsedSession> {
  const events: ToolEvent[] = [];
  const callById = new Map<string, ToolEvent>();
  let malformedLines = 0;
  let sequence = 0;

  for await (const chunk of input.lines) {
    const line = chunk.toString().trim();
    if (!line) continue;
    if (!candidateLine(input.client, line)) continue;
    let record: JsonObject;
    try {
      record = asObject(JSON.parse(line));
    } catch {
      malformedLines++;
      continue;
    }

    const timestampMs = timestampOf(record);
    if (timestampMs != null && timestampMs < input.sinceMs) continue;

    if (input.client === "claude") {
      const message = asObject(record.message);
      if (record.type === "assistant") {
        const usage = claudeUsage(message);
        const sessionKey = safeSessionKey("claude", record.sessionId ?? record.session_id, input.fallbackSessionKey);
        const roundKey = safeRoundKey(sessionKey, message.id ?? record.uuid, sequence);
        for (const block of contentBlocks(message.content)) {
          if (block.type !== "tool_use" || typeof block.name !== "string") continue;
          const callId = typeof block.id === "string" ? block.id : `line:${sequence}`;
          const event = makeExactEvent({
            client: "claude",
            sessionKey,
            roundKey,
            sequence,
            timestampMs,
            callId,
            rawTool: block.name,
            args: asObject(block.input),
            inputTokens: usage.input,
            outputTokens: usage.output
          });
          if (!event) continue;
          sequence++;
          events.push(event);
          callById.set(callId, event);
        }
      } else if (record.type === "user") {
        for (const block of contentBlocks(message.content)) {
          if (block.type !== "tool_result") continue;
          attachResult(block.tool_use_id, callById, line, block.is_error === true);
        }
      }
      continue;
    }

    if (record.type !== "response_item") continue;
    const payload = asObject(record.payload);
    if (payload.type === "function_call_output" || payload.type === "custom_tool_call_output") {
      attachResult(payload.call_id, callById, line, false);
      continue;
    }
    if (payload.type !== "function_call" && payload.type !== "custom_tool_call") continue;

    const sessionKey = safeSessionKey("codex", record.session_id ?? record.sessionId, input.fallbackSessionKey);
    const derived = nestedCodexEvents({ record, payload, sessionKey, startSequence: sequence });
    if (derived.length > 0) {
      events.push(...derived);
      sequence += derived.length;
      continue;
    }
    if (typeof payload.name !== "string") continue;
    const callId = typeof payload.call_id === "string" ? payload.call_id : `line:${sequence}`;
    const event = makeExactEvent({
      client: "codex",
      sessionKey,
      roundKey: safeRoundKey(sessionKey, payload.id ?? payload.call_id, sequence),
      sequence,
      timestampMs,
      callId,
      rawTool: payload.name,
      args: parseArguments(payload.arguments ?? payload.input)
    });
    if (!event) continue;
    sequence++;
    events.push(event);
    callById.set(callId, event);
  }

  return { events, malformedLines };
}
