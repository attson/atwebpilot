import { useEffect, useState } from "react";
import type { Tool } from "@/shared/types";
import { rpc } from "../rpc";

export function ToolsPage(props: { onOpen: (id: string) => void }) {
  const [tools, setTools] = useState<Tool[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

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

  if (err) return <div className="p-3 text-red-400 text-xs">{err}</div>;
  if (!tools) return <div className="p-3 text-zinc-400 text-xs">加载中…</div>;
  if (tools.length === 0)
    return <div className="p-3 text-zinc-400 text-xs">还没有工具，去"运行"页粘 JSON 跑一次后保存。</div>;

  return (
    <ul className="p-3 space-y-2 text-xs">
      {tools.map((t) => (
        <li key={t.id} className="bg-zinc-900 rounded p-2 flex items-start gap-2">
          <div className="flex-1">
            <div className="font-medium">{t.name}</div>
            <div className="text-zinc-400">{t.urlPatterns.join("  ·  ")}</div>
            <div className="text-zinc-500">
              v{t.versions.at(-1)?.version} · {t.steps.length} steps · runs {t.stats.runs}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <button onClick={() => props.onOpen(t.id)} className="px-2 py-0.5 bg-zinc-700 rounded">
              详情
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
  );
}
