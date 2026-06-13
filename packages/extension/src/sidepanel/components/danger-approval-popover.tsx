import { useEffect, useRef, useState } from "react";
import { useSettings } from "../chat/settings-store";
import { DANGEROUS_TOTAL, DangerApprovalList } from "./danger-approval-list";

export function DangerApprovalPopover() {
  const settings = useSettings();
  const count = settings.trustedDangerTools?.length ?? 0;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={
          "flex items-center gap-1 px-2 py-0.5 rounded text-[11px] " +
          (count > 0
            ? "bg-amber-700/40 text-amber-200"
            : "bg-zinc-800 text-zinc-400 hover:text-zinc-200")
        }
        title="dangerous 自动通过白名单"
      >
        <span>⚠</span>
        <span>
          dangerous 自动: {count}/{DANGEROUS_TOTAL}
        </span>
        <span>{open ? "▴" : "▾"}</span>
      </button>
      {open && (
        <div className="absolute right-0 bottom-full mb-1 w-72 bg-zinc-900 border border-zinc-700 rounded p-2 z-20 shadow-xl">
          <DangerApprovalList />
          <p className="mt-2 text-[10px] text-zinc-500">
            ⚠ 勾选 = 这一类调用不再人工确认。
          </p>
        </div>
      )}
    </div>
  );
}
