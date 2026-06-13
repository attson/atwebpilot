import { useEffect } from "react";

type Props = {
  open: boolean;
  title: React.ReactNode;
  onClose: () => void;
  /** Optional: when set, a back arrow is rendered in the header to pop a sub-pane. */
  onBack?: () => void;
  children: React.ReactNode;
};

/**
 * Generic right-side drawer / sheet. Covers the full sidepanel viewport.
 * ESC closes; clicking the X also closes.
 */
export function Drawer({ open, title, onClose, onBack, children }: Props) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="absolute inset-0 bg-zinc-950 flex flex-col z-20"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex items-center gap-2 border-b border-zinc-800 px-3 py-2">
        {onBack ? (
          <button
            type="button"
            className="text-zinc-400 hover:text-zinc-100 text-base leading-none px-1"
            onClick={onBack}
            aria-label="返回"
          >
            ←
          </button>
        ) : null}
        <div className="flex-1 text-zinc-100 text-sm font-medium">{title}</div>
        <button
          type="button"
          className="text-zinc-400 hover:text-zinc-100 text-lg leading-none px-1"
          onClick={onClose}
          aria-label="关闭"
        >
          ×
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
