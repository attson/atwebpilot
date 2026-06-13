type Props = {
  stepCount: number;
  onSave: () => void;
};

/**
 * Inline end-of-conversation card prompting the user to save successful
 * steps as a reusable tool. Renders only when there are executed steps
 * and the session is idle (caller is responsible for that gating).
 */
export function SaveAsToolCard({ stepCount, onSave }: Props) {
  return (
    <div className="self-stretch flex items-center justify-between gap-3 rounded-xl border border-dashed border-emerald-900 bg-emerald-950/40 px-3 py-2.5">
      <div className="text-[11px] text-emerald-300">
        <div>✓ {stepCount} 步成功执行</div>
        <div className="text-[10px] text-zinc-500 mt-0.5">把这段对话固化成可重放工具</div>
      </div>
      <button
        type="button"
        className="px-3 py-1 rounded-md bg-emerald-900 text-emerald-100 text-[11px] border border-emerald-700 hover:bg-emerald-800"
        onClick={onSave}
      >
        保存为工具
      </button>
    </div>
  );
}
