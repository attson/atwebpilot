import type { Tool } from "@/shared/types";

export function RecommendationsBanner(props: {
  tools: Tool[];
  onOpenTool: (toolId: string, autoRun: boolean) => void;
}) {
  if (props.tools.length === 0) return null;
  return (
    <div className="bg-emerald-900/30 border-b border-emerald-800 p-2 text-xs flex flex-col gap-1">
      <div className="text-emerald-300">▶ 此页面可用 {props.tools.length} 个工具:</div>
      <ul className="space-y-1">
        {props.tools.map((t) => (
          <li key={t.id} className="flex items-center gap-2">
            <span className="flex-1">
              {t.name} <span className="text-zinc-500">v{t.versions.at(-1)?.version}</span>
            </span>
            <button
              onClick={() => props.onOpenTool(t.id, false)}
              className="px-2 py-0.5 bg-zinc-700 rounded"
              title="打开工具详情"
            >
              详情
            </button>
            <button
              onClick={() => props.onOpenTool(t.id, true)}
              className="px-2 py-0.5 bg-emerald-700 rounded"
              title="跳到工具详情页并自动运行"
            >
              运行
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
