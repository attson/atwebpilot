import { useState } from "react";
import type { PendingReplay } from "@/sidepanel/lib/external-replay";

type Props = {
  replay: PendingReplay;
  onAccept: (r: PendingReplay) => void;
  onReject: () => void;
};

export function ExternalReplayModal({ replay, onAccept, onReject }: Props) {
  const [stepsOpen, setStepsOpen] = useState(false);
  const stepCount = replay.steps?.length ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-lg border border-amber-700 bg-zinc-900 shadow-xl text-zinc-100">
        <div className="bg-amber-900/40 border-b border-amber-800 px-3 py-2 text-[12px] text-amber-100 flex items-center gap-2">
          <span>⚠</span>
          <span>来自外站</span>
          <code className="text-amber-200/80 truncate ml-1">{replay.sourceUrl}</code>
        </div>
        <div className="p-3 space-y-3 text-[12px]">
          {replay.title && (
            <div className="text-sm font-medium text-zinc-100">{replay.title}</div>
          )}
          <div>
            <div className="text-zinc-500 text-[10px] mb-1">Prompt</div>
            <pre className="bg-zinc-950 rounded p-2 text-zinc-200 whitespace-pre-wrap max-h-32 overflow-auto">
              {replay.prompt}
            </pre>
          </div>
          {stepCount > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setStepsOpen((o) => !o)}
                className="text-zinc-300 hover:text-zinc-100 text-[11px]"
              >
                {stepsOpen ? "▾" : "▸"} 包含 {stepCount} 个 Tool steps 草案
              </button>
              {stepsOpen && (
                <pre className="mt-1 bg-zinc-950 rounded p-2 text-zinc-300 text-[10px] max-h-40 overflow-auto">
                  {JSON.stringify(replay.steps, null, 2)}
                </pre>
              )}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 p-3 border-t border-zinc-800">
          <button
            type="button"
            className="px-3 py-1 rounded bg-zinc-800 text-zinc-300 text-[12px]"
            onClick={onReject}
          >
            拒绝
          </button>
          <button
            type="button"
            data-testid="external-replay-accept"
            className="px-3 py-1 rounded bg-blue-700 text-white text-[12px]"
            onClick={() => onAccept(replay)}
          >
            接受
          </button>
        </div>
      </div>
    </div>
  );
}
