import type {
  BuiltinTool,
  ChatMessage,
  Json,
  LlmSettings,
  Step,
  TextPart,
  ToolResultPart,
  ToolUsePart
} from "@/shared/types";
import type { LlmClient, LlmTool } from "@/sidepanel/llm/types";
import type { ToolRunner } from "./tool-runner";
import { Approver } from "./approval";
import { autoApproves, classifyTool } from "./severity";

export type SessionRpc = {
  startSession: (input: { url: string }) => Promise<{ id: string }>;
  appendStepLog: (
    runId: string,
    entry: {
      stepIndex: number;
      input: Json;
      output: Json;
      ms: number;
      error?: string;
    }
  ) => Promise<unknown>;
  finalizeSession: (
    runId: string,
    status: "ok" | "error" | "aborted",
    output?: Json
  ) => Promise<unknown>;
};

export type RunSessionInput = {
  userPrompt: string;
  tabId: number;
  url: string;
};

export type SessionEvent =
  | { type: "round_start"; round: number }
  | { type: "text_delta"; text: string }
  | { type: "tool_use_start"; id: string; name: string }
  | { type: "tool_use_input_delta"; id: string; partial_json: string }
  | { type: "tool_use_end"; id: string; input: Json }
  | { type: "tool_running"; id: string }
  | { type: "tool_done"; id: string; output: Json; ms: number }
  | { type: "tool_error"; id: string; error: string; ms: number }
  | { type: "tool_skipped"; id: string }
  | { type: "usage"; input_tokens: number; output_tokens: number }
  | { type: "stream_error"; error: string }
  | { type: "exception"; error: string }
  | { type: "session_end"; status: "done" | "aborted" | "max_rounds" | "error"; lastOutput: Json; reason?: string };

export type RunSessionArgs = {
  client: LlmClient;
  runner: ToolRunner;
  approver: Approver;
  rpc: SessionRpc;
  input: RunSessionInput;
  settings: LlmSettings;
  systemPrompt: string;
  tools: LlmTool[];
  approveAllSafe: boolean;
  abortSignal?: AbortSignal;
  onEvent?: (e: SessionEvent) => void;
  initialMessages?: ChatMessage[];
};

export type RunSessionResult = {
  status: "done" | "aborted" | "max_rounds" | "error";
  runRecordId: string;
  messages: ChatMessage[];
  executedSteps: Step[];
  lastOutput: Json;
};

const MAX_PARSE_RETRIES = 3;

export async function runChatSession(args: RunSessionArgs): Promise<RunSessionResult> {
  const messages: ChatMessage[] = [
    ...(args.initialMessages ?? []),
    { role: "user", content: args.input.userPrompt }
  ];
  const executedSteps: Step[] = [];
  let lastOutput: Json = null;
  const { id: runRecordId } = await args.rpc.startSession({ url: args.input.url });

  let parseFailures = 0;
  let stepIndexGlobal = 0;

  for (let round = 0; round < args.settings.maxRounds; round++) {
    args.onEvent?.({ type: "round_start", round });

    const stream = args.client.stream({
      apiKey: args.settings.apiKey,
      model: args.settings.model,
      system: args.systemPrompt,
      messages,
      tools: args.tools,
      endpoint: args.settings.endpoint,
      abortSignal: args.abortSignal
    });

    const inputBufs = new Map<string, string>();
    const tuMeta = new Map<string, { name: string }>();
    const completedToolUses: ToolUsePart[] = [];
    let textBuf = "";
    let streamErr: string | null = null;

    try {
      for await (const ev of stream) {
        if (args.abortSignal?.aborted) {
          await args.rpc.finalizeSession(runRecordId, "aborted");
          args.onEvent?.({ type: "session_end", status: "aborted", lastOutput });
          return { status: "aborted", runRecordId, messages, executedSteps, lastOutput };
        }
        switch (ev.type) {
          case "text_delta":
            textBuf += ev.text;
            args.onEvent?.({ type: "text_delta", text: ev.text });
            break;
          case "tool_use_start":
            tuMeta.set(ev.id, { name: ev.name });
            inputBufs.set(ev.id, "");
            args.onEvent?.({ type: "tool_use_start", id: ev.id, name: ev.name });
            break;
          case "tool_use_input_delta":
            inputBufs.set(ev.id, (inputBufs.get(ev.id) ?? "") + ev.partial_json);
            args.onEvent?.({
              type: "tool_use_input_delta",
              id: ev.id,
              partial_json: ev.partial_json
            });
            break;
          case "tool_use_end": {
            const meta = tuMeta.get(ev.id);
            if (!meta) break;
            completedToolUses.push({ type: "tool_use", id: ev.id, name: meta.name, input: ev.input });
            args.onEvent?.({ type: "tool_use_end", id: ev.id, input: ev.input });
            break;
          }
          case "message_end":
            if (ev.usage) {
              args.onEvent?.({
                type: "usage",
                input_tokens: ev.usage.input_tokens,
                output_tokens: ev.usage.output_tokens
              });
            }
            break;
          case "error":
            streamErr = ev.error;
            args.onEvent?.({ type: "stream_error", error: ev.error });
            break;
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (args.abortSignal?.aborted) {
        await args.rpc.finalizeSession(runRecordId, "aborted");
        args.onEvent?.({ type: "session_end", status: "aborted", lastOutput });
        return { status: "aborted", runRecordId, messages, executedSteps, lastOutput };
      }
      args.onEvent?.({ type: "exception", error: msg });
      await args.rpc.finalizeSession(runRecordId, "error");
      args.onEvent?.({ type: "session_end", status: "error", lastOutput, reason: msg });
      throw new Error(msg);
    }

    if (streamErr) {
      parseFailures++;
      if (parseFailures >= MAX_PARSE_RETRIES) {
        await args.rpc.finalizeSession(runRecordId, "error");
        args.onEvent?.({
          type: "session_end",
          status: "error",
          lastOutput,
          reason: `LLM stream error (${parseFailures} times): ${streamErr}`
        });
        return { status: "error", runRecordId, messages, executedSteps, lastOutput };
      }
      messages.push({
        role: "user",
        content: `Previous response had a streaming error: ${streamErr}. Please try again.`
      });
      continue;
    }

    const assistantContent: Array<TextPart | ToolUsePart> = [];
    if (textBuf) assistantContent.push({ type: "text", text: textBuf });
    for (const tu of completedToolUses) assistantContent.push(tu);
    messages.push({ role: "assistant", content: assistantContent });

    if (completedToolUses.length === 0) {
      lastOutput = textBuf;
      await args.rpc.finalizeSession(runRecordId, "ok", lastOutput);
      args.onEvent?.({ type: "session_end", status: "done", lastOutput });
      return { status: "done", runRecordId, messages, executedSteps, lastOutput };
    }

    const results: ToolResultPart[] = [];
    for (const tu of completedToolUses) {
      const sev = classifyTool(tu.name, tu.input);
      let decision: { kind: "run" | "skip" | "deny" };
      if (autoApproves(sev, args.approveAllSafe)) {
        decision = { kind: "run" };
      } else {
        decision = await args.approver.request(tu.id);
      }

      if (decision.kind === "deny") {
        await args.rpc.finalizeSession(runRecordId, "aborted");
        args.onEvent?.({ type: "session_end", status: "aborted", lastOutput });
        return { status: "aborted", runRecordId, messages, executedSteps, lastOutput };
      }
      if (decision.kind === "skip") {
        results.push({
          type: "tool_result",
          tool_use_id: tu.id,
          content: JSON.stringify({ skipped: true })
        });
        args.onEvent?.({ type: "tool_skipped", id: tu.id });
        continue;
      }

      args.onEvent?.({ type: "tool_running", id: tu.id });
      const step: Step =
        tu.name === "runJS"
          ? { kind: "js", source: (tu.input as { source: string }).source }
          : { kind: "tool", tool: tu.name as BuiltinTool, args: tu.input };

      const start = Date.now();
      try {
        const out = await args.runner.runStep(step, args.input.tabId, {});
        const ms = Date.now() - start;
        await args.rpc.appendStepLog(runRecordId, {
          stepIndex: stepIndexGlobal++,
          input: tu.input,
          output: out,
          ms
        });
        results.push({
          type: "tool_result",
          tool_use_id: tu.id,
          content: JSON.stringify(out)
        });
        executedSteps.push(step);
        lastOutput = out;
        args.onEvent?.({ type: "tool_done", id: tu.id, output: out, ms });
      } catch (e) {
        const ms = Date.now() - start;
        const errStr = e instanceof Error ? e.message : String(e);
        await args.rpc.appendStepLog(runRecordId, {
          stepIndex: stepIndexGlobal++,
          input: tu.input,
          output: null,
          ms,
          error: errStr
        });
        results.push({
          type: "tool_result",
          tool_use_id: tu.id,
          content: JSON.stringify({ error: errStr }),
          is_error: true
        });
        args.onEvent?.({ type: "tool_error", id: tu.id, error: errStr, ms });
      }
    }

    messages.push({ role: "user", content: results });
  }

  await args.rpc.finalizeSession(runRecordId, "error");
  args.onEvent?.({ type: "session_end", status: "max_rounds", lastOutput });
  return { status: "max_rounds", runRecordId, messages, executedSteps, lastOutput };
}
