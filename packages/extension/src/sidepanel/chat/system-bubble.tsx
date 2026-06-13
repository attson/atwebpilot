type Kind = "error" | "warning" | "navigation";

const TONE: Record<Kind, string> = {
  error:      "bg-red-950/60 border-red-900 text-red-200",
  warning:    "bg-amber-950/60 border-amber-900 text-amber-200",
  navigation: "bg-blue-950/60 border-blue-900 text-blue-200",
};

const PREFIX: Record<Kind, string> = {
  error:      "⚠",
  warning:    "▲",
  navigation: "↳",
};

type Props = {
  kind: Kind;
  children: React.ReactNode;
  onClick?: () => void;
};

/**
 * Centered system bubble — replaces the old error banner, log summary bar
 * and inline "页面跳转" notes. Renders inside the messages stream.
 */
export function SystemBubble({ kind, children, onClick }: Props) {
  const baseCls = `self-center max-w-[90%] rounded-lg border px-3 py-1.5 text-[11px] ${TONE[kind]}`;
  if (onClick) {
    return (
      <button
        type="button"
        data-kind={kind}
        className={`${baseCls} text-left hover:brightness-110`}
        onClick={onClick}
      >
        <span className="mr-1.5 font-semibold">{PREFIX[kind]}</span>
        {children}
      </button>
    );
  }
  return (
    <div data-kind={kind} className={baseCls}>
      <span className="mr-1.5 font-semibold">{PREFIX[kind]}</span>
      {children}
    </div>
  );
}
