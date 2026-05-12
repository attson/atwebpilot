import { useCallback, useEffect, useState } from "react";
import { getGlobalApprover } from "../chat/approval";
import { runChatSession, type SessionEvent } from "../chat/run-session";
import {
  ensureSession,
  setCurrentTab,
  useCurrentTabId,
  useSession,
  useStore
} from "../chat/session-store";
import { useSettings } from "../chat/settings-store";
import { RpcToolRunner } from "../chat/tool-runner";
import { TOOL_DEFS } from "../llm/tool-schema";
import { pickClient } from "../llm/client";
import { buildSystemPrompt } from "../llm/system-prompt";
import { ChatView } from "../components/chat-view";
import { DangerApprovalPopover } from "../components/danger-approval-popover";
import { LogsDrawer } from "../components/logs-drawer";
import { RecommendationsBanner } from "../components/recommendations-banner";
import { SaveAsToolDialog } from "../components/save-as-tool-dialog";
import { StatusBar } from "../components/status-bar";
import { currentTabInfo, onTabRecommendations, rpc } from "../rpc";
import type { BuiltinTool, Json, Step, Tool } from "@/shared/types";

type ChatPageProps = {
  initialPrompt?: string;
  initialContext?: string;
  onOpenTool?: (id: string, autoRun: boolean) => void;
};

export function ChatPage({ initialPrompt, initialContext, onOpenTool }: ChatPageProps) {
  const session = useSession();
  const settings = useSettings();
  const currentTabId = useCurrentTabId();
  const [input, setInput] = useState(initialPrompt ?? session.inputDraft ?? "");
  const [recommendations, setRecommendations] = useState<Tool[]>([]);
  const approver = getGlobalApprover();

  // 切 tab 时把 input 同步到该 tab 的 inputDraft
  useEffect(() => {
    setInput(session.inputDraft);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTabId]);

  useEffect(() => {
    if (!settings.loaded) settings.load();
  }, [settings]);

  useEffect(() => {
    let active = true;
    (async () => {
      const { tabId, url } = await currentTabInfo();
      if (!active) return;
      const tools = await rpc.matchingTools(url);
      if (!active) return;
      setRecommendations(tools);
      // 仅刷新 tab 信息；保留消息流，避免 nav 切换丢失对话
      ensureSession(tabId, url);
      setCurrentTab(tabId);
    })();
    const off = onTabRecommendations((m) => {
      currentTabInfo()
        .then((info) => {
          if (info.tabId === m.tabId) setRecommendations(m.tools);
        })
        .catch(() => {});
    });
    return () => {
      active = false;
      off();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleApprove = useCallback(
    (id: string, decision: "run" | "skip" | "deny") => {
      approver.resolve(id, { kind: decision });
      session.setCardStatus(id, {
        status: decision === "run" ? "running" : decision === "skip" ? "skipped" : "denied"
      });
    },
    [session, approver]
  );

  const clearChat = useCallback(() => {
    session.abortController?.abort();
    approver.resolveAllPending({ kind: "deny" });
    session.reset();
  }, [session, approver]);

  const send = useCallback(
    async (prompt: string) => {
      if (!prompt.trim()) return;
      if (!settings.apiKey) {
        session.setError("请先在设置页填入 API Key");
        return;
      }
      const { tabId, url } = await currentTabInfo();
      session.setIdentity({ tabId, url, runRecordId: "" });
      session.setError(null);
      session.setStatus("streaming");
      session.appendUserMessage(prompt);
      session.appendLog(
        "info",
        `提交 prompt`,
        `provider=${settings.provider} model=${settings.model} endpoint=${settings.endpoint || "(默认)"} maxRounds=${settings.maxRounds}\n---\n${prompt}`
      );
      session.setInputDraft("");
      setInput("");
      const ac = new AbortController();
      session.setAbortController(ac);
      const client = pickClient(settings.provider);
      const runner = new RpcToolRunner((req) =>
        chrome.runtime.sendMessage(req) as Promise<{ ok: true; data: Json } | { ok: false; error: string }>
      );

      function stepFromCard(id: string): Step {
        // 用闭包里 send() 起始的 tabId，避免用户中途切 tab 时 currentTabId 变了找错位置
        const cards = useStore.getState().sessionsByTab[tabId]?.cards ?? [];
        const card = cards.find((c) => c.toolUseId === id);
        if (!card) throw new Error(`card not found: ${id}`);
        if (card.name === "runJS") {
          return { kind: "js", source: (card.input as { source: string }).source };
        }
        return { kind: "tool", tool: card.name as BuiltinTool, args: card.input };
      }

      const onEvent = (e: SessionEvent) => {
        const log: typeof session.appendLog = (level, message, details) =>
          session.appendLog(level, message, details);
        switch (e.type) {
          case "round_start":
            session.incrementRound();
            session.beginAssistantTurn();
            log("info", `round ${e.round + 1} 开始`);
            break;
          case "text_delta":
            session.appendAssistantText(e.text);
            break;
          case "tool_use_start":
            session.upsertCard({ toolUseId: e.id, name: e.name, status: "draft", inputReady: false });
            log("info", `tool_use_start: ${e.name} (${e.id})`);
            break;
          case "tool_use_input_delta": {
            // 用闭包 tabId，不要用 dynamic currentTabId（用户切 tab 时会指向错的 SessionData）
            const cards = useStore.getState().sessionsByTab[tabId]?.cards ?? [];
            const fresh = cards.find((c) => c.toolUseId === e.id);
            session.upsertCard({
              toolUseId: e.id,
              partialJson: (fresh?.partialJson ?? "") + e.partial_json
            });
            break;
          }
          case "tool_use_end":
            session.upsertCard({ toolUseId: e.id, input: e.input, inputReady: true, status: "awaiting" });
            session.setStatus("awaiting");
            log("info", `tool_use_end: ${e.id}`, JSON.stringify(e.input, null, 2));
            break;
          case "assistant_turn_end":
            session.finalizeAssistantTurn(e.toolUses);
            break;
          case "tool_running":
            session.setCardStatus(e.id, { status: "running" });
            session.setStatus("running");
            log("info", `step running: ${e.id}`);
            break;
          case "tool_done":
            session.setCardStatus(e.id, { status: "ok", output: e.output, ms: e.ms });
            session.pushExecutedStep(stepFromCard(e.id));
            session.setLastOutput(e.output);
            session.setStatus("streaming");
            log("info", `step ok: ${e.id} (${e.ms}ms)`);
            break;
          case "tool_error":
            session.setCardStatus(e.id, { status: "error", error: e.error, ms: e.ms });
            session.setStatus("streaming");
            log("error", `step error: ${e.id}`, e.error);
            break;
          case "tool_skipped":
            session.setCardStatus(e.id, { status: "skipped" });
            log("warn", `step skipped: ${e.id}`);
            break;
          case "usage":
            session.addUsage({ input_tokens: e.input_tokens, output_tokens: e.output_tokens });
            break;
          case "stream_error":
            log("error", "LLM stream error", e.error);
            session.setError(e.error);
            session.setLogsOpen(true);
            break;
          case "exception":
            log("error", "exception in run-session", e.error);
            session.setError(e.error);
            session.setLogsOpen(true);
            break;
          case "session_end":
            log(
              e.status === "done" ? "info" : "warn",
              `session_end: ${e.status}${e.reason ? " — " + e.reason : ""}`
            );
            if (e.status === "done") {
              session.setStatus("done");
            } else if (e.status === "max_rounds") {
              session.setStatus("error");
              session.setError("达到最大轮数");
              session.setLogsOpen(true);
            } else if (e.status === "aborted") {
              session.setStatus("aborted");
            } else {
              session.setStatus("error");
              if (e.reason) session.setError(e.reason);
              session.setLogsOpen(true);
            }
            break;
        }
      };

      try {
        await runChatSession({
          client,
          runner,
          approver: approver,
          rpc: {
            startSession: (i) => rpc.startSession(i).then((r) => ({ id: r.id })),
            appendStepLog: (runId, entry) => rpc.appendStepLog(runId, entry),
            finalizeSession: (runId, status, output) => rpc.finalizeSession(runId, status, output)
          },
          input: { userPrompt: prompt, tabId, url },
          settings: { ...settings, autoApproveDangerous: settings.autoApproveDangerous ?? [] },
          systemPrompt: buildSystemPrompt({
            url,
            savedTools: recommendations.map((t) => ({
              name: t.name,
              description: t.description ?? "",
              version: t.versions.at(-1)?.version ?? 1
            }))
          }),
          tools: TOOL_DEFS,
          approveAllSafe: session.approveAllSafe,
          abortSignal: ac.signal,
          onEvent,
          initialMessages: initialContext ? [{ role: "user", content: initialContext }] : undefined
        });
      } catch (e) {
        session.setError(e instanceof Error ? e.message : String(e));
        session.setStatus("error");
      } finally {
        approver.resolveAllPending({ kind: "deny" });
        session.setAbortController(null);
      }
    },
    [session, settings, initialContext]
  );

  return (
    <div className="h-full flex flex-col">
      <RecommendationsBanner
        tools={recommendations}
        onOpenTool={(id, autoRun) => {
          if (onOpenTool) onOpenTool(id, autoRun);
        }}
      />
      <StatusBar
        status={session.status}
        roundCount={session.roundCount}
        maxRounds={settings.maxRounds}
        tokenUsage={session.tokenUsage}
        onAbort={() => session.abortController?.abort()}
      />
      {session.errorMessage && (
        <div className="bg-red-900/40 border-b border-red-800 p-2 text-xs text-red-200 flex items-start gap-2">
          <div
            data-testid="chat-error-body"
            className="flex-1 min-w-0 max-h-24 overflow-auto whitespace-pre-wrap break-words pr-1"
          >
            {session.errorMessage}
          </div>
          {session.messages.length > 0 && (
            <button
              onClick={() => {
                if (confirm("清空当前对话？")) clearChat();
              }}
              className="px-2 py-0.5 bg-zinc-700 rounded text-zinc-100 shrink-0"
            >
              清空对话
            </button>
          )}
          <button
            onClick={() => session.setLogsOpen(!session.logsOpen)}
            className="px-2 py-0.5 bg-zinc-700 rounded text-zinc-100 shrink-0"
          >
            {session.logsOpen ? "隐藏日志" : "查看日志"}
          </button>
          <button
            onClick={() => session.setError(null)}
            className="px-2 py-0.5 bg-zinc-700 rounded text-zinc-100 shrink-0"
          >
            关闭
          </button>
        </div>
      )}
      {(session.messages.length > 0 || session.logs.length > 0) && !session.errorMessage && (
        <div className="px-2 py-1 border-b border-zinc-800 text-[11px] text-zinc-500 flex items-center gap-2">
          {session.logs.length > 0 && (
            <>
              <span>日志 {session.logs.length} 条</span>
              <button
                onClick={() => session.setLogsOpen(!session.logsOpen)}
                className="px-2 py-0.5 bg-zinc-800 rounded"
              >
                {session.logsOpen ? "隐藏" : "查看"}
              </button>
            </>
          )}
          {session.messages.length > 0 && (
            <button
              onClick={() => {
                if (confirm("清空当前对话？")) clearChat();
              }}
              className="px-2 py-0.5 bg-zinc-800 rounded"
            >
              清空对话
            </button>
          )}
          {session.executedSteps.length > 0 && (
            <>
              <span className="ml-auto">已执行 {session.executedSteps.length} 步</span>
              <button
                onClick={() => session.showSave()}
                className="px-2 py-0.5 bg-emerald-700 text-zinc-100 rounded"
              >
                保存为工具
              </button>
            </>
          )}
        </div>
      )}
      <ChatView onApprove={handleApprove} />
      <LogsDrawer />
      <div className="border-t border-zinc-800 p-2 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2 text-xs text-zinc-400">
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={session.approveAllSafe}
              onChange={(e) => session.setApproveAllSafe(e.target.checked)}
            />
            自动通过 caution
          </label>
          <DangerApprovalPopover />
        </div>
        <textarea
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            session.setInputDraft(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              const busy =
                session.status === "streaming" ||
                session.status === "awaiting" ||
                session.status === "running";
              if (!busy && input.trim()) send(input);
            }
          }}
          placeholder={'要让 AI 做什么？例如"总结此页"/"填写注册表单"/"采集前 50 条评论"（Ctrl/⌘ + Enter 发送）'}
          rows={3}
          className="bg-zinc-900 rounded p-2 text-xs resize-none"
        />
        <div className="flex justify-end">
          <button
            onClick={() => send(input)}
            disabled={
              session.status === "streaming" ||
              session.status === "awaiting" ||
              session.status === "running" ||
              !input.trim()
            }
            className="px-3 py-1 bg-emerald-700 rounded disabled:opacity-50"
          >
            发送
          </button>
        </div>
      </div>
      {session.showSaveDialog && (
        <SaveAsToolDialog
          initialName={
            recommendations[0]?.name ?? `WebPilot 任务 ${new Date().toISOString().slice(0, 10)}`
          }
          initialDescription={
            (session.messages.find(
              (m): m is Extract<typeof m, { role: "user" }> & { content: string } =>
                m.role === "user" && typeof m.content === "string"
            )?.content ?? "")
              .replace(/^\[已恢复\][^\n]*\n?/, "")
              .replace(/^\[页面跳转\][^\n]*\n?/, "")
              .slice(0, 80)
          }
          initialUrl={session.url}
          steps={session.executedSteps}
          lastOutput={session.lastOutput}
          messages={session.messages}
          llmSettings={settings}
          onClose={() => session.hideSave()}
          onSaved={() => {
            session.hideSave();
          }}
        />
      )}
    </div>
  );
}
