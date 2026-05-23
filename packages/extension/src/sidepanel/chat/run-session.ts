import type {
  BuiltinTool,
  ChatMessage,
  Json,
  LlmSettings,
  Step,
  TextPart,
  ToolResultPart,
  ToolUsePart
} from "@webpilot/shared/types";
import type { LlmClient, LlmTool } from "@/sidepanel/llm/types";
import type { ToolRunner } from "./tool-runner";
import { Approver, type Decision } from "./approval";
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

export type CrossTabRpc = {
  listTabs: (
    windowId?: number
  ) => Promise<{ tabs: Array<{ tabId: number; windowId: number; url: string; title: string }> }>;
  openTab: (url: string, active?: boolean) => Promise<{ tabId: number; url: string; title: string }>;
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
  | { type: "assistant_turn_end"; toolUses: ToolUsePart[] }
  | { type: "tool_running"; id: string }
  | { type: "tool_done"; id: string; output: Json; ms: number }
  | { type: "tool_error"; id: string; error: string; ms: number }
  | { type: "tool_skipped"; id: string }
  | { type: "usage"; input_tokens: number; output_tokens: number }
  | { type: "continuation_nudge"; round: number; attempt: number }
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
  attachedTabIds?: number[];
  tabsRpc?: CrossTabRpc;
  onCrossTabResult?: (result: {
    kind: "attached" | "detached" | "opened";
    tabId: number;
    url?: string;
    title?: string;
    windowId?: number;
  }) => void;
};

export type RunSessionResult = {
  status: "done" | "aborted" | "max_rounds" | "error";
  runRecordId: string;
  messages: ChatMessage[];
  executedSteps: Step[];
  lastOutput: Json;
};

const MAX_PARSE_RETRIES = 3;

const DEFAULT_MAX_CONTINUATION_NUDGES = 1;

/**
 * Sent as a user turn when the model stops calling tools but the task may not
 * actually be finished. It asks the model to verify completeness (especially
 * for collection tasks) and either resume tool calls or give the final result.
 */
export const CONTINUATION_NUDGE_PROMPT = [
  "系统检查：你这一轮没有调用任何工具就停下了。请先确认任务是否真的已经全部完成——",
  "尤其是数据采集类任务：所有评论 / 分页 / 懒加载内容是否都已拉全？是否已按用户要求把数据完整返回、没有省略？",
  "如果还有没做完的部分，请继续调用工具把任务做完；如果确认已全部完成，再用一段文本给出最终完整结果即可。"
].join("\n");

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
  const maxNudges = args.settings.maxContinuationNudges ?? DEFAULT_MAX_CONTINUATION_NUDGES;
  let nudgesSinceProgress = 0;

  for (let round = 0; round < args.settings.maxRounds; round++) {
    args.onEvent?.({ type: "round_start", round });

    const stream = args.client.stream({
      apiKey: args.settings.apiKey,
      model: args.settings.model,
      system: args.systemPrompt,
      messages,
      tools: args.tools,
      endpoint: args.settings.endpoint,
      maxTokens: args.settings.maxTokens,
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
    args.onEvent?.({ type: "assistant_turn_end", toolUses: completedToolUses });

    if (completedToolUses.length === 0) {
      if (textBuf) lastOutput = textBuf;
      if (nudgesSinceProgress < maxNudges) {
        nudgesSinceProgress++;
        args.onEvent?.({ type: "continuation_nudge", round, attempt: nudgesSinceProgress });
        messages.push({ role: "user", content: CONTINUATION_NUDGE_PROMPT });
        continue;
      }
      await args.rpc.finalizeSession(runRecordId, "ok", lastOutput);
      args.onEvent?.({ type: "session_end", status: "done", lastOutput });
      return { status: "done", runRecordId, messages, executedSteps, lastOutput };
    }

    // The model made progress (executed ≥1 tool), so refresh the nudge budget.
    nudgesSinceProgress = 0;

    const results: ToolResultPart[] = [];
    for (const tu of completedToolUses) {
      const sev = classifyTool(tu.name, tu.input);
      let decision: Decision;
      if (autoApproves(sev, tu.name, args.approveAllSafe, args.settings.autoApproveDangerous)) {
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

      if (
        tu.name === "listTabs" ||
        tu.name === "openTab" ||
        tu.name === "attachTab" ||
        tu.name === "detachTab"
      ) {
        const start = Date.now();
        try {
          let out: Json;
          switch (tu.name) {
            case "listTabs": {
              if (!args.tabsRpc) throw new Error("listTabs: tabsRpc not provided");
              const r = await args.tabsRpc.listTabs(
                (tu.input as { windowId?: number }).windowId
              );
              out = r as unknown as Json;
              break;
            }
            case "openTab": {
              if (!args.tabsRpc) throw new Error("openTab: tabsRpc not provided");
              const r = await args.tabsRpc.openTab(
                (tu.input as { url: string }).url,
                (tu.input as { active?: boolean }).active
              );
              out = r as unknown as Json;
              args.onCrossTabResult?.({
                kind: "opened",
                tabId: r.tabId,
                url: r.url,
                title: r.title
              });
              break;
            }
            case "attachTab": {
              const tabId = (tu.input as { tabId: number }).tabId;
              out = { ok: true, tabId } as unknown as Json;
              args.onCrossTabResult?.({ kind: "attached", tabId });
              break;
            }
            case "detachTab": {
              const tabId = (tu.input as { tabId: number }).tabId;
              out = { ok: true, tabId } as unknown as Json;
              args.onCrossTabResult?.({ kind: "detached", tabId });
              break;
            }
          }
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
        continue;
      }

      const step: Step =
        tu.name === "runJS"
          ? { kind: "js", source: (tu.input as { source: string }).source }
          : { kind: "tool", tool: tu.name as BuiltinTool, args: tu.input };

      const start = Date.now();
      try {
        const out = await args.runner.runStep(step, args.input.tabId, args.attachedTabIds ?? [], {});
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
