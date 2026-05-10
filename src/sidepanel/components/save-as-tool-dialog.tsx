import { useState } from "react";
import { inferJsonSchema } from "@/shared/infer-json-schema";
import { highestSeverity, runStaticScan } from "@/shared/static-scan";
import type {
  ChatMessage,
  Json,
  LlmSettings,
  ScanFinding,
  Step
} from "@/shared/types";
import { pickClient } from "../llm/client";
import { generateSummaryStep } from "../llm/summary-step";
import { rpc } from "../rpc";

type Props = {
  initialName: string;
  initialDescription: string;
  initialUrl: string;
  steps: Step[];
  lastOutput: Json;
  messages: ChatMessage[];
  llmSettings: LlmSettings;
  onClose: () => void;
  onSaved: (toolId: string) => void;
};

type SummaryState =
  | { phase: "idle" }
  | { phase: "generating"; abort: AbortController }
  | {
      phase: "ready";
      source: string;
      findings: ScanFinding[];
      severity: "info" | "caution" | "dangerous";
    }
  | { phase: "error"; error: string };

function defaultPattern(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname;
    const baseHost = host.split(".").slice(-2).join(".");
    return `https://*.${baseHost}/**`;
  } catch {
    return "https://example.com/**";
  }
}

export function SaveAsToolDialog(props: Props) {
  const [name, setName] = useState(props.initialName || "新工具");
  const [description, setDescription] = useState(props.initialDescription || "");
  const [patternsText, setPatternsText] = useState(defaultPattern(props.initialUrl));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [localSteps, setLocalSteps] = useState<Step[]>(props.steps);
  const [summary, setSummary] = useState<SummaryState>({ phase: "idle" });

  async function generateSummary() {
    if (!props.llmSettings.apiKey) {
      setSummary({ phase: "error", error: "请先在设置页填入 API Key" });
      return;
    }
    if (localSteps.length === 0) {
      setSummary({ phase: "error", error: "需要先有成功的 step" });
      return;
    }
    const ac = new AbortController();
    setSummary({ phase: "generating", abort: ac });
    try {
      const client = pickClient(props.llmSettings.provider);
      const result = await generateSummaryStep({
        client,
        apiKey: props.llmSettings.apiKey,
        model: props.llmSettings.model,
        endpoint: props.llmSettings.endpoint,
        maxTokens: props.llmSettings.maxTokens,
        messages: props.messages,
        executedSteps: localSteps,
        lastOutput: props.lastOutput,
        abortSignal: ac.signal
      });
      const findings = runStaticScan(result.source);
      const sev = highestSeverity(findings);
      setSummary({
        phase: "ready",
        source: result.source,
        findings,
        severity: sev
      });
    } catch (e) {
      if ((e as { name?: string })?.name === "AbortError") {
        setSummary({ phase: "idle" });
        return;
      }
      setSummary({
        phase: "error",
        error: e instanceof Error ? e.message : String(e)
      });
    }
  }

  function acceptSummary() {
    if (summary.phase !== "ready") return;
    const summaryStep: Step = { kind: "js", source: summary.source };
    setLocalSteps((prev) => [...prev, summaryStep]);
    setSummary({ phase: "idle" });
  }

  function cancelGeneration() {
    if (summary.phase === "generating") {
      summary.abort.abort();
      setSummary({ phase: "idle" });
    }
  }

  async function save() {
    setErr(null);
    setBusy(true);
    try {
      const urlPatterns = patternsText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      if (urlPatterns.length === 0) throw new Error("至少填一个 URL 模式");
      if (localSteps.length === 0) throw new Error("没有可保存的成功 step");
      const tool = await rpc.saveTool({
        name,
        urlPatterns,
        description,
        steps: localSteps,
        outputSchema: inferJsonSchema(props.lastOutput)
      });
      props.onSaved(tool.id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-10">
      <div className="bg-zinc-900 rounded p-4 w-[90%] max-w-md text-xs flex flex-col gap-2 max-h-[90vh] overflow-auto">
        <h3 className="text-base font-medium">保存为工具</h3>
        <label className="flex flex-col gap-1">
          <span className="text-zinc-400">名称</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="bg-zinc-800 px-2 py-1 rounded"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-zinc-400">URL 模式（每行一条）</span>
          <textarea
            value={patternsText}
            onChange={(e) => setPatternsText(e.target.value)}
            rows={3}
            className="bg-zinc-800 px-2 py-1 rounded font-mono"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-zinc-400">描述</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="bg-zinc-800 px-2 py-1 rounded"
          />
        </label>
        <SummaryStepPanel
          state={summary}
          onGenerate={generateSummary}
          onCancel={cancelGeneration}
          onAccept={acceptSummary}
          onReset={() => setSummary({ phase: "idle" })}
          hasApiKey={!!props.llmSettings.apiKey}
          stepsCount={localSteps.length}
        />
        <p className="text-zinc-500">将保存 {localSteps.length} 个成功执行的 step。</p>
        {err && <p className="text-red-400">{err}</p>}
        <div className="flex gap-2 justify-end">
          <button
            onClick={props.onClose}
            className="px-3 py-1 bg-zinc-700 rounded"
            disabled={busy}
          >
            取消
          </button>
          <button
            onClick={save}
            className="px-3 py-1 bg-emerald-700 rounded disabled:opacity-50"
            disabled={busy}
          >
            {busy ? "保存中…" : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SummaryStepPanel(props: {
  state: SummaryState;
  onGenerate: () => void;
  onCancel: () => void;
  onAccept: () => void;
  onReset: () => void;
  hasApiKey: boolean;
  stepsCount: number;
}) {
  const { state } = props;
  return (
    <section className="bg-zinc-950 border border-zinc-800 rounded p-2 flex flex-col gap-1">
      <div className="text-zinc-300">汇总 step</div>
      <div className="text-zinc-500 text-[11px]">
        ⚠ 重放时输出 = 最后一步 step 的 return 值。AI 写过的 markdown 报告
        不是 step，重放无法复现。让 AI 生成一段 runJS 整合数据为稳定 JSON。
      </div>

      {state.phase === "idle" && (
        <button
          onClick={props.onGenerate}
          disabled={!props.hasApiKey || props.stepsCount === 0}
          className="self-start px-2 py-0.5 bg-emerald-700 rounded disabled:opacity-50"
          title={
            !props.hasApiKey
              ? "请先在设置页填入 API Key"
              : props.stepsCount === 0
              ? "需要先有成功的 step"
              : ""
          }
        >
          让 AI 生成汇总步骤
        </button>
      )}

      {state.phase === "generating" && (
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-zinc-300">AI 生成中…</span>
          <button
            onClick={props.onCancel}
            className="ml-auto px-2 py-0.5 bg-zinc-700 rounded"
          >
            取消生成
          </button>
        </div>
      )}

      {state.phase === "ready" && (
        <>
          <div className="text-zinc-300 flex items-center gap-2 flex-wrap">
            <span>✓ AI 已生成</span>
            {state.findings.length > 0 && (
              <span
                className={
                  "text-[10px] px-1 py-0.5 rounded " +
                  (state.severity === "dangerous"
                    ? "bg-red-700 text-red-100"
                    : state.severity === "caution"
                    ? "bg-amber-700 text-amber-100"
                    : "bg-zinc-700")
                }
              >
                {state.severity}: {state.findings.map((f) => f.rule).join(", ")}
              </span>
            )}
          </div>
          <details className="bg-zinc-900 rounded p-1">
            <summary className="cursor-pointer text-zinc-300 text-[11px]">源码</summary>
            <pre className="text-[10px] text-zinc-300 mt-1 overflow-auto max-h-48 whitespace-pre-wrap">
              {state.source}
            </pre>
          </details>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={props.onAccept}
              className={
                "px-2 py-0.5 rounded text-zinc-100 " +
                (state.severity === "dangerous" ? "bg-red-700" : "bg-emerald-700")
              }
            >
              {state.severity === "dangerous"
                ? "⚠ 接受（含 dangerous）"
                : "接受 → 添加为最后一步"}
            </button>
            <button onClick={props.onGenerate} className="px-2 py-0.5 bg-zinc-700 rounded">
              重新生成
            </button>
            <button onClick={props.onReset} className="px-2 py-0.5 bg-zinc-700 rounded">
              取消
            </button>
          </div>
        </>
      )}

      {state.phase === "error" && (
        <>
          <div className="text-red-400 text-[11px] whitespace-pre-wrap break-words">
            {state.error}
          </div>
          <div className="flex gap-2">
            <button onClick={props.onGenerate} className="px-2 py-0.5 bg-emerald-700 rounded">
              重试
            </button>
            <button onClick={props.onReset} className="px-2 py-0.5 bg-zinc-700 rounded">
              取消
            </button>
          </div>
        </>
      )}
    </section>
  );
}
