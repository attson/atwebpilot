import { useEffect, useState } from "react";
import type { ExportBundle, Tool } from "@webpilot/shared/types";
import { rpc } from "../rpc";

function downloadJson(value: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function safeFilename(s: string): string {
  return s.replace(/[\s\\/:*?"<>|]+/g, "_").replace(/^_+|_+$/g, "") || "tool";
}

function exportOne(t: Tool) {
  const bundle: ExportBundle = {
    schema: "caiji.tools/v2",
    exportedAt: Date.now(),
    tools: [t]
  };
  downloadJson(bundle, `caiji-${safeFilename(t.name)}-${new Date().toISOString().slice(0, 10)}.json`);
}

export function ToolsPage(props: { onOpen: (id: string) => void }) {
  const [tools, setTools] = useState<Tool[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function reload() {
    try {
      setTools(await rpc.listTools());
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => {
    reload();
  }, []);

  async function doImport(file: File) {
    setMsg(null);
    setErr(null);
    try {
      const text = await file.text();
      const bundle = JSON.parse(text);
      const r = await rpc.importBundle(bundle);
      setMsg(`已导入 ${r.imported} 个，跳过 ${r.skipped} 个`);
      await reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  if (err && !tools) return <div className="p-3 text-red-400 text-xs">{err}</div>;
  if (!tools) return <div className="p-3 text-zinc-400 text-xs">加载中…</div>;

  return (
    <div className="p-3 flex flex-col gap-2 text-xs">
      <div className="flex items-center gap-2">
        <span className="text-zinc-400">{tools.length} 个工具</span>
        <label className="ml-auto px-2 py-0.5 bg-zinc-700 rounded cursor-pointer">
          导入 JSON
          <input
            type="file"
            accept="application/json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) doImport(f);
              e.target.value = "";
            }}
          />
        </label>
      </div>
      {msg && <div className="text-emerald-400">{msg}</div>}
      {err && <div className="text-red-400">{err}</div>}

      {tools.length === 0 && (
        <div className="text-zinc-400">还没有工具——在「对话」页让 AI 帮你做一次任务后保存，或从一份 JSON 导入。</div>
      )}

      <ul className="space-y-2">
        {tools.map((t) => (
          <li key={t.id} className="bg-zinc-900 rounded p-2 flex items-start gap-2">
            <div className="flex-1">
              <div className="font-medium flex items-center gap-1">
                <span>{t.name}</span>
                <span className="text-[10px] px-1 py-0.5 rounded bg-zinc-800 text-zinc-400">
                  {t.kind === "prompt" ? "提示词" : "纯函数"}
                </span>
              </div>
              <div className="text-zinc-400">{t.urlPatterns.join("  ·  ")}</div>
              <div className="text-zinc-500">
                v{t.versions.at(-1)?.version} ·{" "}
                {t.kind === "prompt" ? "prompt" : `${t.steps.length} steps`} · runs {t.stats.runs}
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <button onClick={() => props.onOpen(t.id)} className="px-2 py-0.5 bg-zinc-700 rounded">
                详情
              </button>
              <button
                onClick={() => exportOne(t)}
                className="px-2 py-0.5 bg-zinc-700 rounded"
              >
                导出
              </button>
              <button
                onClick={async () => {
                  if (!confirm(`删除「${t.name}」？`)) return;
                  await rpc.deleteTool(t.id);
                  reload();
                }}
                className="px-2 py-0.5 bg-red-800 rounded"
              >
                删除
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
