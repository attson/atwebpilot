import { useEffect, useState } from "react";
import type { RunRecord, Tool } from "@/shared/types";
import { ResultView } from "../components/result-view";
import { StepList } from "../components/step-list";
import { currentTabId, rpc } from "../rpc";

type Props = {
  id: string;
  onBack: () => void;
  onFixWithAi?: (opts: { initialPrompt: string; initialContext: string }) => void;
};

export function ToolDetailPage(props: Props) {
  const [tool, setTool] = useState<Tool | null>(null);
  const [run, setRun] = useState<RunRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    rpc.getTool(props.id).then(setTool).catch((e) => setErr(String(e)));
  }, [props.id]);

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
    if (!run || !tool || !props.onFixWithAi) return;
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

  const failed = run && run.status === "error";

  return (
    <div className="p-3 flex flex-col gap-3 text-xs">
      <button onClick={props.onBack} className="self-start text-zinc-400">
        ← 返回
      </button>
      <h2 className="text-base font-medium">{tool.name}</h2>
      <div className="text-zinc-400">{tool.urlPatterns.join(", ")}</div>
      <div>
        <button
          onClick={go}
          disabled={busy}
          className="px-3 py-1 bg-emerald-700 rounded disabled:opacity-50"
        >
          {busy ? "执行中…" : "在当前 tab 运行"}
        </button>
      </div>
      <h3 className="text-zinc-300 mt-2">步骤（v{tool.versions.at(-1)?.version}）</h3>
      <StepList steps={tool.steps} />
      {run && <ResultView run={run} />}
      {failed && props.onFixWithAi && (
        <button
          onClick={onFix}
          className="self-start px-3 py-1 bg-amber-700 rounded"
        >
          让 AI 修复
        </button>
      )}
    </div>
  );
}
