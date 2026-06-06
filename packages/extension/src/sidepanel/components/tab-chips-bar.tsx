import { useState } from "react";
import type { AttachedTab } from "@atwebpilot/shared/types";

type Props = {
  attachedTabs: AttachedTab[];
  onDetach: (tabId: number) => void;
  onPick: () => void;
};

const MAX_VISIBLE = 8;

export function TabChipsBar({ attachedTabs, onDetach, onPick }: Props): JSX.Element | null {
  const [expanded, setExpanded] = useState(false);
  if (attachedTabs.length === 0) return null;
  const showAll = expanded || attachedTabs.length <= MAX_VISIBLE;
  const visible = showAll ? attachedTabs : attachedTabs.slice(0, MAX_VISIBLE);
  const overflow = attachedTabs.length - visible.length;

  return (
    <div className="px-2 py-1 border-b border-zinc-900 bg-zinc-950 flex items-center gap-1 flex-wrap text-[11px]">
      <span className="text-zinc-600">附加:</span>
      {visible.map((a) => (
        <span
          key={a.tabId}
          data-testid={`chip-${a.tabId}`}
          data-url-changed={a.urlChanged ? "true" : "false"}
          title={`${a.lastSeenUrl}${a.urlChanged ? "\n(URL 已变化)" : ""}`}
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded ${
            a.urlChanged ? "bg-red-900/30 text-red-300" : "bg-zinc-800 text-zinc-200"
          }`}
        >
          {a.urlChanged && <span aria-hidden>⚠</span>}
          <span className="max-w-[120px] truncate">{a.lastSeenTitle || a.lastSeenUrl}</span>
          <button
            aria-label={`detach ${a.tabId}`}
            className="text-zinc-500 hover:text-red-400 text-[10px]"
            onClick={() => onDetach(a.tabId)}
          >
            ×
          </button>
        </span>
      ))}
      {overflow > 0 && !expanded && (
        <button
          className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400"
          onClick={() => setExpanded(true)}
        >
          +{overflow}
        </button>
      )}
      <button
        aria-label="add attached tab"
        className="ml-auto text-zinc-400 hover:text-zinc-100"
        onClick={onPick}
      >
        +
      </button>
    </div>
  );
}
