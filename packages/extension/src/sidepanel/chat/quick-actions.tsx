type Action = { id: string; label: string; prompt: string };

const ACTIONS: Action[] = [
  {
    id: "summarize",
    label: "总结网页",
    prompt: "总结一下当前网页的主要内容。",
  },
  {
    id: "key-points",
    label: "抽取重点",
    prompt: "把这个网页的关键信息抽出成 5 条。",
  },
  {
    id: "extract-comments",
    label: "抽评论",
    prompt:
      "把本页所有评论 / 回复抽下来，完整拉取不要省略。" +
      "如果存在分页或下拉懒加载，请翻页 / 滚动到底，直到拿全所有评论再返回。",
  },
];

type Props = { onPick: (prompt: string) => void };

export function QuickActions({ onPick }: Props) {
  return (
    <div className="flex flex-wrap gap-1.5 justify-center mb-3">
      {ACTIONS.map((a) => (
        <button
          key={a.id}
          type="button"
          onClick={() => onPick(a.prompt)}
          className="px-2.5 py-1 rounded-full border border-zinc-700 bg-zinc-900 text-zinc-300 text-[11px] hover:bg-zinc-800 hover:border-zinc-600"
        >
          {a.label}
        </button>
      ))}
    </div>
  );
}
