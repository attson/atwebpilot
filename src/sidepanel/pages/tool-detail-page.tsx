import { useEffect, useState } from "react";
import type { RunRecord, Tool } from "@webpilot/shared/types";
import { ResultView } from "../components/result-view";
import { StepList } from "../components/step-list";
import { currentTabId, rpc } from "../rpc";

type Props = {
  id: string;
  onBack: () => void;
  onFixWithAi?: (opts: { initialPrompt: string; initialContext: string }) => void;
  onRunPromptTool?: (tool: Extract<Tool, { kind: "prompt" }>) => void;
  /** 进入页面后自动跑一次（用于 banner "运行" 按钮直接联动） */
  autoRun?: boolean;
};

export function ToolDetailPage(props: Props) {
  const [tool, setTool] = useState<Tool | null>(null);
  const [run, setRun] = useState<RunRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    rpc.getTool(props.id).then(setTool).catch((e) => setErr(String(e)));
  }, [props.id]);

  useEffect(() => {
    if (!props.autoRun || !tool || run || busy) return;
    void go();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.autoRun, tool]);

  async function go() {
    setBusy(true);
    setErr(null);
    setRun(null);
    try {
      const tabId = await currentTabId();
      setRun(await rpc.runTool(props.id, tabId));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function onFix() {
    if (!run || !tool || tool.kind !== "steps" || !props.onFixWithAi) return;
    const failedEntry = run.stepLog.find((e) => e.error);
    const initialPrompt = `工具「${tool.name} v${tool.versions.at(-1)?.version}」第 ${
      failedEntry?.stepIndex ?? "?"
    } 步失败：\n- step: ${JSON.stringify(failedEntry?.input)}\n- 错误: ${
      failedEntry?.error ?? "(未知)"
    }\n\n请基于当前页面 DOM 重新设计这一步（或整个工具）。`;
    const initialContext = `# 工具「${tool.name}」原 steps:\n\`\`\`json\n${JSON.stringify(
      tool.steps,
      null,
      2
    )}\n\`\`\`\n# 当前 URL: ${run.url}`;
    props.onFixWithAi({ initialPrompt, initialContext });
  }

  if (err) return <div className="p-3 text-red-400 text-xs">{err}</div>;
  if (!tool) return <div className="p-3 text-zinc-400 text-xs">加载中…</div>;

  if (tool.kind === "prompt") {
    return (
      <div className="h-full overflow-auto p-3 flex flex-col gap-3 text-xs">
        <button onClick={props.onBack} className="self-start text-zinc-400">
          ← 返回
        </button>
        <div className="flex items-center gap-2">
          <h2 className="text-base font-medium">{tool.name}</h2>
          <span className="px-1.5 py-0.5 bg-emerald-900/50 text-emerald-200 rounded">
            提示词工具
          </span>
        </div>
        <div className="text-zinc-400">{tool.urlPatterns.join(", ")}</div>
        <p className="text-zinc-300 whitespace-pre-wrap">{tool.description}</p>
        <button
          onClick={() => props.onRunPromptTool?.(tool)}
          className="self-start px-3 py-1 bg-emerald-700 rounded disabled:opacity-50"
          disabled={!props.onRunPromptTool}
        >
          在聊天中运行
        </button>
        <details className="bg-zinc-900/40 rounded" open>
          <summary className="cursor-pointer p-2 text-zinc-300">
            提示词（v{tool.versions.at(-1)?.version}）
          </summary>
          <pre className="p-2 pt-0 text-[11px] text-zinc-300 whitespace-pre-wrap">
            {tool.prompt}
          </pre>
        </details>
      </div>
    );
  }

  const failed = run && run.status === "error";

  return (
    <div className="h-full overflow-auto p-3 flex flex-col gap-3 text-xs">
      <button onClick={props.onBack} className="self-start text-zinc-400">
        ← 返回
      </button>
      <h2 className="text-base font-medium">{tool.name}</h2>
      <span className="self-start px-1.5 py-0.5 bg-sky-900/50 text-sky-200 rounded">
        纯函数工具
      </span>
      <div className="text-zinc-400">{tool.urlPatterns.join(", ")}</div>
      <div className="flex items-center gap-2">
        <button
          onClick={go}
          disabled={busy}
          className="px-3 py-1 bg-emerald-700 rounded disabled:opacity-50"
        >
          {busy ? "执行中…" : "在当前 tab 运行"}
        </button>
        {busy && <span className="text-zinc-400">step 在 BG 顺序执行，结束后会显示结果…</span>}
      </div>
      {run && (
        <section className="bg-zinc-900 rounded p-2 border border-emerald-900/40">
          <h3 className="text-emerald-300 mb-1">运行结果</h3>
          <ResultView run={run} />
        </section>
      )}
      {failed && props.onFixWithAi && (
        <button
          onClick={onFix}
          className="self-start px-3 py-1 bg-amber-700 rounded"
        >
          让 AI 修复
        </button>
      )}
      <details className="bg-zinc-900/40 rounded">
        <summary className="cursor-pointer p-2 text-zinc-300">
          步骤定义（v{tool.versions.at(-1)?.version}） · {tool.steps.length} 条
        </summary>
        <div className="p-2 pt-0">
          <StepList steps={tool.steps} />
        </div>
      </details>
    </div>
  );
}
