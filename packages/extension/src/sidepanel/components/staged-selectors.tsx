import { Crosshair } from "lucide-react";

type Props = {
  selectors: string[];
  onRemove: (idx: number) => void;
};

export function StagedSelectors({ selectors, onRemove }: Props) {
  if (selectors.length === 0) return null;
  return (
    <div
      data-testid="staged-selectors"
      className="flex gap-1.5 overflow-x-auto px-3 py-1.5 border-t border-zinc-800 bg-zinc-900"
    >
      {selectors.map((selector, i) => (
        <div
          key={`${selector}-${i}`}
          className="min-w-0 max-w-full shrink-0 inline-flex items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-[11px] text-zinc-300"
          title={selector}
        >
          <Crosshair size={12} className="text-blue-300" aria-hidden="true" />
          <span className="text-zinc-400">已选元素</span>
          <code className="max-w-48 truncate font-mono text-zinc-200">{selector}</code>
          <button
            type="button"
            aria-label={`移除已选元素 ${i + 1}`}
            onClick={() => onRemove(i)}
            className="ml-0.5 rounded px-1 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-100"
          >
            x
          </button>
        </div>
      ))}
    </div>
  );
}
