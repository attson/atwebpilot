import { useUi, type DrawerKind } from "../chat/ui-store";
import type { DebugBadge } from "../chat/session-store";

type Props = {
  debugBadge: DebugBadge;
  onNewChat: () => void;
};

function badgeClass(b: DebugBadge): string | null {
  if (!b) return null;
  if (b.kind === "error") return "bg-red-500";
  if (b.kind === "exchange") return "bg-amber-500";
  return "bg-blue-500";
}

export function Header({ debugBadge, onNewChat }: Props) {
  const open = useUi((s) => s.open);
  const dot = badgeClass(debugBadge);

  return (
    <div className="border-b border-zinc-800 bg-zinc-900">
      <div className="flex items-center justify-between px-3 pt-2.5">
        <div className="font-bold text-zinc-100 text-[13px] tracking-tight">AtWebPilot</div>
        <div className="flex gap-0.5">
          <IconBtn label="新会话" onClick={onNewChat}>＋</IconBtn>
          <IconBtn label="历史" onClick={() => open("history")}>⏱</IconBtn>
          <IconBtn label="工具库" onClick={() => open("tools")}>🧰</IconBtn>
          <IconBtn label="设置" onClick={() => open("settings")}>⚙</IconBtn>
          <IconBtn label="调试" onClick={() => open("debug")} badge={dot}>💭</IconBtn>
        </div>
      </div>
    </div>
  );
}

function IconBtn({
  label,
  onClick,
  badge,
  children,
}: {
  label: string;
  onClick: () => void;
  badge?: string | null;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="relative w-7 h-7 rounded text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 flex items-center justify-center text-base"
    >
      {children}
      {badge && (
        <span
          data-testid={`badge-${label}`}
          className={`absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full ${badge}`}
        />
      )}
    </button>
  );
}

/** Helper for callers that need the DrawerKind enum at use sites. */
export type { DrawerKind };
