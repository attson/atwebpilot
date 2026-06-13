import { useEffect, useRef, useState } from "react";

export type MentionTabOption = {
  tabId: number;
  title: string;
  url: string;
};

type Props = {
  tabs: MentionTabOption[];
  onPick: (opt: MentionTabOption) => void;
  onClose: () => void;
};

/**
 * Popover anchored above the input box. Currently exposes only the Tabs
 * category (Tools / History / Skills are deferred per spec §14).
 * Keyboard-navigable: ↑/↓ moves selection, Enter picks, Esc closes.
 */
export function MentionPicker({ tabs, onPick, onClose }: Props) {
  const [idx, setIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setIdx((i) => Math.min(i + 1, Math.max(0, tabs.length - 1)));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setIdx((i) => Math.max(0, i - 1));
        return;
      }
      if (e.key === "Enter") {
        if (tabs[idx]) {
          e.preventDefault();
          onPick(tabs[idx]);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [idx, tabs, onPick, onClose]);

  return (
    <div
      ref={containerRef}
      role="listbox"
      className="absolute left-0 bottom-full mb-1 w-72 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl py-1 z-30"
    >
      <div className="text-zinc-500 uppercase tracking-wider text-[9px] px-3 py-1">tabs</div>
      {tabs.length === 0 ? (
        <div className="text-zinc-500 text-[11px] px-3 py-2">没有可挂载的 tab</div>
      ) : (
        tabs.map((t, i) => (
          <button
            key={t.tabId}
            type="button"
            role="option"
            aria-selected={i === idx}
            data-testid={`mention-opt-${t.tabId}`}
            className={`w-full text-left flex items-center gap-2 px-3 py-1.5 text-[11px] hover:bg-zinc-800 ${
              i === idx ? "bg-zinc-800" : ""
            }`}
            onClick={() => onPick(t)}
            onMouseEnter={() => setIdx(i)}
          >
            <span>📄</span>
            <span className="flex-1 truncate text-zinc-100">{t.title || t.url}</span>
            <span className="text-zinc-500 text-[10px]">#{t.tabId}</span>
          </button>
        ))
      )}
    </div>
  );
}
