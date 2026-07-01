import { useEffect, useRef } from "react";
import { X, Loader2, Sparkles, AlertTriangle } from "lucide-react";

type Props = {
  original: string;
  optimized?: string;
  error?: string;
  loading: boolean;
  onAccept: () => void;
  onRegenerate: () => void;
  onDiscard: () => void;
};

export function PromptOptimizePreview({
  original,
  optimized,
  error,
  loading,
  onAccept,
  onRegenerate,
  onDiscard,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  const acceptable = !!optimized && !loading && !error;

  return (
    <div
      ref={ref}
      tabIndex={-1}
      onKeyDown={(e) => {
        if (e.key === "Enter" && acceptable) {
          e.preventDefault();
          onAccept();
        } else if (e.key === "Escape") {
          e.preventDefault();
          onDiscard();
        }
      }}
      className="absolute bottom-full left-3 right-3 mb-2 rounded-lg border border-zinc-700 bg-zinc-900 shadow-lg z-20 outline-none text-xs"
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800">
        <span className="text-zinc-300 inline-flex items-center gap-1">
          {error ? (
            <>
              <AlertTriangle size={12} className="text-amber-400" />
              <span>优化失败</span>
            </>
          ) : loading ? (
            <>
              <Sparkles size={12} />
              <span>优化中…</span>
            </>
          ) : (
            <>
              <Sparkles size={12} />
              <span>优化后</span>
            </>
          )}
        </span>
        <button
          type="button"
          aria-label="关闭"
          onClick={onDiscard}
          className="text-zinc-500 hover:text-zinc-200"
        >
          <X size={14} />
        </button>
      </div>

      {error ? (
        <div className="px-3 py-2 space-y-2">
          <div className="text-red-400 break-all">{error}</div>
          <button
            type="button"
            onClick={onRegenerate}
            className="px-2 py-0.5 rounded bg-zinc-700 hover:bg-zinc-600 text-zinc-100"
          >
            重试
          </button>
        </div>
      ) : loading ? (
        <div className="px-3 py-3 flex items-center gap-2 text-zinc-400">
          <Loader2 size={14} className="animate-spin" /> 正在改写…
        </div>
      ) : (
        <>
          <pre className="px-3 py-2 whitespace-pre-wrap break-words text-zinc-100 max-h-52 overflow-auto">
            {optimized}
          </pre>
          <details className="border-t border-zinc-800 px-3 py-1.5 text-zinc-500">
            <summary className="cursor-pointer hover:text-zinc-300">查看原文</summary>
            <pre className="mt-1 whitespace-pre-wrap break-words text-zinc-400">{original}</pre>
          </details>
          <div className="flex items-center gap-2 px-3 py-2 border-t border-zinc-800 justify-end">
            <button
              type="button"
              onClick={onDiscard}
              className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
            >
              弃用
            </button>
            <button
              type="button"
              onClick={onRegenerate}
              className="px-2 py-0.5 rounded bg-zinc-700 hover:bg-zinc-600 text-zinc-100"
            >
              重新生成
            </button>
            <button
              type="button"
              onClick={onAccept}
              className="px-2 py-0.5 rounded bg-blue-700 hover:bg-blue-600 text-white"
              title="Enter"
            >
              接受
            </button>
          </div>
        </>
      )}
    </div>
  );
}
