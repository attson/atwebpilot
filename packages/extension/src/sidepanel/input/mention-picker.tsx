import { useEffect, useMemo, useRef, useState } from "react";

export type MentionTabOption = {
  tabId: number;
  title: string;
  url: string;
};

export type MentionToolOption = {
  id: string;
  name: string;
  description?: string;
  matchesCurrentUrl?: boolean;
};

type MentionCategory = "tabs" | "tools";

type Props = {
  tabs: MentionTabOption[];
  tools: MentionToolOption[];
  onPickTab: (opt: MentionTabOption) => void;
  onPickTool: (opt: MentionToolOption) => void;
  onClose: () => void;
};

/**
 * Popover anchored above the input box with a Tabs | Tools segmented switch.
 * Keyboard: ←/→ (or Tab) switches category; ↑/↓ moves within category;
 * Enter picks; Esc closes.
 *
 * History / Skills categories are deferred per spec §15.
 */
export function MentionPicker({ tabs, tools, onPickTab, onPickTool, onClose }: Props) {
  const [cat, setCat] = useState<MentionCategory>("tabs");
  const [idx, setIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const sortedTools = useMemo(() => {
    return tools.slice().sort((a, b) => {
      const av = a.matchesCurrentUrl ? 1 : 0;
      const bv = b.matchesCurrentUrl ? 1 : 0;
      if (av !== bv) return bv - av;
      return a.name.localeCompare(b.name);
    });
  }, [tools]);

  const items: Array<{ kind: "tab"; v: MentionTabOption } | { kind: "tool"; v: MentionToolOption }> =
    cat === "tabs"
      ? tabs.map((v) => ({ kind: "tab" as const, v }))
      : sortedTools.map((v) => ({ kind: "tool" as const, v }));

  useEffect(() => {
    setIdx(0);
  }, [cat]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "ArrowRight" || (e.key === "Tab" && !e.shiftKey)) {
        e.preventDefault();
        setCat((c) => (c === "tabs" ? "tools" : "tabs"));
        return;
      }
      if (e.key === "ArrowLeft" || (e.key === "Tab" && e.shiftKey)) {
        e.preventDefault();
        setCat((c) => (c === "tabs" ? "tools" : "tabs"));
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setIdx((i) => Math.min(i + 1, Math.max(0, items.length - 1)));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setIdx((i) => Math.max(0, i - 1));
        return;
      }
      if (e.key === "Enter") {
        const it = items[idx];
        if (!it) return;
        e.preventDefault();
        if (it.kind === "tab") onPickTab(it.v);
        else onPickTool(it.v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [idx, items, onClose, onPickTab, onPickTool]);

  return (
    <div
      ref={containerRef}
      role="listbox"
      className="absolute left-0 bottom-full mb-1 w-72 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl z-30"
    >
      <div className="flex border-b border-zinc-800 text-[10px]" role="tablist">
        <CatBtn active={cat === "tabs"} onClick={() => setCat("tabs")}>
          Tabs ({tabs.length})
        </CatBtn>
        <CatBtn active={cat === "tools"} onClick={() => setCat("tools")}>
          Tools ({tools.length})
        </CatBtn>
      </div>
      <div className="py-1">
        {items.length === 0 ? (
          <div className="text-zinc-500 text-[11px] px-3 py-2">
            {cat === "tabs" ? "没有可挂载的 tab" : "没有可引用的工具"}
          </div>
        ) : (
          items.map((it, i) => {
            const selected = i === idx;
            if (it.kind === "tab") {
              return (
                <button
                  key={`tab-${it.v.tabId}`}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  data-testid={`mention-opt-tab-${it.v.tabId}`}
                  className={`w-full text-left flex items-center gap-2 px-3 py-1.5 text-[11px] hover:bg-zinc-800 ${selected ? "bg-zinc-800" : ""}`}
                  onClick={() => onPickTab(it.v)}
                  onMouseEnter={() => setIdx(i)}
                >
                  <span>📄</span>
                  <span className="flex-1 truncate text-zinc-100">{it.v.title || it.v.url}</span>
                  <span className="text-zinc-500 text-[10px]">#{it.v.tabId}</span>
                </button>
              );
            }
            return (
              <button
                key={`tool-${it.v.id}`}
                type="button"
                role="option"
                aria-selected={selected}
                data-testid={`mention-opt-tool-${it.v.id}`}
                className={`w-full text-left flex items-center gap-2 px-3 py-1.5 text-[11px] hover:bg-zinc-800 ${selected ? "bg-zinc-800" : ""}`}
                onClick={() => onPickTool(it.v)}
                onMouseEnter={() => setIdx(i)}
              >
                <span>{it.v.matchesCurrentUrl ? "✨" : "🧰"}</span>
                <span
                  className={`flex-1 truncate ${it.v.matchesCurrentUrl ? "text-emerald-300" : "text-zinc-100"}`}
                >
                  {it.v.name}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

function CatBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`px-3 py-1.5 ${active ? "text-zinc-100 border-b border-blue-500" : "text-zinc-500 hover:text-zinc-300"}`}
    >
      {children}
    </button>
  );
}
