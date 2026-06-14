import { useEffect, useState } from "react";
import { useIntervention } from "@/sidepanel/chat/intervention-store";

/**
 * Modal overlay that renders whenever the LLM has called the `askUser` tool
 * and the request is pending. Three variants:
 *   - confirm: 取消 / 确认
 *   - select:  click-row list
 *   - text:    textarea + submit
 *
 * Resolved value flows back through the intervention store to the awaiting
 * `askUser` handler in run-session.
 */
export function InterventionOverlay() {
  const current = useIntervention((s) => s.current);
  const resolve = useIntervention((s) => s.resolve);
  const cancel = useIntervention((s) => s.cancel);
  const [textValue, setTextValue] = useState("");

  useEffect(() => {
    setTextValue("");
  }, [current?.request.id]);

  useEffect(() => {
    if (!current) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") cancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, cancel]);

  if (!current) return null;
  const { request } = current;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-lg border border-zinc-700 bg-zinc-900 p-4 text-zinc-100 shadow-xl">
        <h3 className="text-sm font-medium mb-3">AI 想问你一个问题</h3>
        <p className="text-[12px] text-zinc-300 whitespace-pre-wrap mb-3">{request.prompt}</p>

        {request.kind === "confirm" && (
          <div className="flex justify-end gap-2 text-[12px]">
            <button
              type="button"
              className="px-3 py-1 rounded bg-zinc-800 text-zinc-300"
              onClick={() => resolve({ kind: "confirm", ok: false })}
              data-testid="intervention-confirm-no"
            >
              否
            </button>
            <button
              type="button"
              className="px-3 py-1 rounded bg-blue-700 text-white"
              onClick={() => resolve({ kind: "confirm", ok: true })}
              data-testid="intervention-confirm-yes"
            >
              是
            </button>
          </div>
        )}

        {request.kind === "select" && (
          <ul className="space-y-1.5">
            {(request.options ?? []).map((opt) => (
              <li key={opt.id}>
                <button
                  type="button"
                  data-testid={`intervention-select-${opt.id}`}
                  className="w-full text-left rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-[12px] hover:bg-zinc-700"
                  onClick={() => resolve({ kind: "select", choice: opt.id })}
                >
                  <div className="font-medium text-zinc-100">{opt.label}</div>
                  {opt.description && (
                    <div className="text-[10px] text-zinc-400 mt-0.5">{opt.description}</div>
                  )}
                </button>
              </li>
            ))}
            <li className="text-right">
              <button
                type="button"
                className="text-[10px] text-zinc-500 hover:text-zinc-300"
                onClick={cancel}
              >
                取消
              </button>
            </li>
          </ul>
        )}

        {request.kind === "text" && (
          <div className="space-y-2">
            <textarea
              value={textValue}
              onChange={(e) => setTextValue(e.target.value)}
              placeholder="输入回复…"
              className="w-full rounded bg-zinc-950 border border-zinc-700 px-2 py-1.5 text-[12px] text-zinc-100"
              rows={3}
              autoFocus
            />
            <div className="flex justify-end gap-2 text-[12px]">
              <button
                type="button"
                className="px-3 py-1 rounded bg-zinc-800 text-zinc-300"
                onClick={cancel}
              >
                取消
              </button>
              <button
                type="button"
                disabled={!textValue.trim()}
                className="px-3 py-1 rounded bg-blue-700 text-white disabled:opacity-50"
                onClick={() => resolve({ kind: "text", value: textValue })}
                data-testid="intervention-text-submit"
              >
                提交
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
