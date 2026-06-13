import { useEffect, useState } from "react";
import type { PermissionMode } from "../chat/severity";
import { DANGEROUS_TOOLS } from "../lib/dangerous-tools";

const ORDER: PermissionMode[] = ["read", "default", "trust", "yolo"];

const MODE_INFO: Record<PermissionMode, { name: string; desc: string }> = {
  read:    { name: "只读",       desc: "只 safe 工具自动执行。caution 和 dangerous 工具每次询问。" },
  default: { name: "默认",       desc: "safe 和 caution 工具自动执行。dangerous 工具询问。" },
  trust:   { name: "信任白名单", desc: "safe + caution 自动；勾选的 dangerous 工具也自动；其余 dangerous 询问。" },
  yolo:    { name: "全自动",     desc: "所有工具自动执行（含 dangerous）。本会话生效。" },
};

const PILL_TONE: Record<PermissionMode, string> = {
  read:    "bg-blue-950 text-blue-300 border-blue-800",
  default: "bg-emerald-950 text-emerald-300 border-emerald-800",
  trust:   "bg-amber-950 text-amber-300 border-amber-800",
  yolo:    "bg-red-950 text-red-300 border-red-800 animate-pulse",
};

const DOT_COLOR: Record<PermissionMode, string> = {
  read:    "bg-blue-400",
  default: "bg-emerald-400",
  trust:   "bg-amber-400",
  yolo:    "bg-red-400",
};

type Props = {
  mode: PermissionMode;
  onChange: (mode: PermissionMode) => void;
  trustedDangerTools: string[];
  onTrustedChange: (next: string[]) => void;
};

export function PermissionModePill({
  mode,
  onChange,
  trustedDangerTools,
  onTrustedChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const [confirmYolo, setConfirmYolo] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Tab" || !e.shiftKey) return;
      const t = e.target;
      // Keep textareas usable: only cycle when focus is NOT in an editable field.
      if (
        t instanceof HTMLTextAreaElement ||
        t instanceof HTMLInputElement ||
        (t instanceof HTMLElement && t.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      const idx = ORDER.indexOf(mode);
      const next = ORDER[(idx + 1) % ORDER.length];
      if (next === "yolo") setConfirmYolo(true);
      else onChange(next);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, onChange]);

  function pick(m: PermissionMode) {
    if (m === "yolo") {
      setConfirmYolo(true);
      return;
    }
    onChange(m);
    setOpen(false);
  }

  function toggleTrusted(toolId: string) {
    const next = trustedDangerTools.includes(toolId)
      ? trustedDangerTools.filter((t) => t !== toolId)
      : [...trustedDangerTools, toolId];
    onTrustedChange(next);
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        className={`flex items-center gap-1 px-2 py-1 rounded-md border text-[11px] ${PILL_TONE[mode]}`}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={MODE_INFO[mode].desc}
      >
        <span>{MODE_INFO[mode].name}</span>
        <span className="opacity-60 italic font-serif text-[10px]" aria-label="info">ⓘ</span>
        <span className="opacity-70 text-[8px]">▾</span>
      </button>

      {open && (
        <div className="absolute left-0 bottom-full mb-1 w-60 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl py-1 z-30">
          {ORDER.map((m) => (
            <button
              key={m}
              type="button"
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-left hover:bg-zinc-800 ${
                m === mode ? "bg-blue-950/30" : ""
              }`}
              onClick={() => pick(m)}
            >
              <span className={`w-2 h-2 rounded-full ${DOT_COLOR[m]}`} />
              <span className={`flex-1 ${m === "yolo" ? "text-red-300" : "text-zinc-100"}`}>
                {MODE_INFO[m].name}
              </span>
              {m === mode && <span className="text-emerald-400 text-[10px]">✓</span>}
              <span
                className="text-zinc-500 italic font-serif text-[10px]"
                aria-label="info"
                title={MODE_INFO[m].desc}
              >
                ⓘ
              </span>
            </button>
          ))}

          {mode === "trust" && (
            <div className="border-t border-zinc-800 mt-1 px-3 py-2 text-[10px] text-zinc-400 space-y-1">
              <div className="text-zinc-500 uppercase tracking-wider text-[9px]">
                Dangerous 白名单
              </div>
              {DANGEROUS_TOOLS.map((t) => (
                <label key={t.id} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={trustedDangerTools.includes(t.id)}
                    onChange={() => toggleTrusted(t.id)}
                    className="accent-amber-500"
                  />
                  <span>{t.label}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      {confirmYolo && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-red-900 rounded-lg p-4 max-w-sm w-[90%] space-y-3">
            <h3 className="text-red-300 font-semibold">切到全自动模式？</h3>
            <p className="text-[12px] text-zinc-400">
              这会让 AI 跳过所有审核，包括 submitForm / uploadFile / runJS 等
              dangerous 工具。本会话生效。
            </p>
            <div className="flex justify-end gap-2 text-[12px]">
              <button
                type="button"
                className="px-3 py-1 rounded bg-zinc-800 text-zinc-300"
                onClick={() => setConfirmYolo(false)}
              >
                取消
              </button>
              <button
                type="button"
                className="px-3 py-1 rounded bg-red-900 text-red-100"
                onClick={() => {
                  onChange("yolo");
                  setConfirmYolo(false);
                  setOpen(false);
                }}
              >
                我知道风险，继续
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
