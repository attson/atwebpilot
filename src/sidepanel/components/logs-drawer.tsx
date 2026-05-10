import { useSession, type LogEntry } from "../chat/session-store";

function fmt(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}.${String(d.getMilliseconds()).padStart(3, "0")}`;
}

function colorFor(level: LogEntry["level"]): string {
  if (level === "error") return "text-red-400";
  if (level === "warn") return "text-amber-400";
  return "text-zinc-400";
}

export function LogsDrawer() {
  const { logs, logsOpen, clearLogs, setLogsOpen } = useSession();
  if (!logsOpen) return null;

  async function copy() {
    const text = logs
      .map((l) => `[${fmt(l.ts)}] ${l.level.toUpperCase()} ${l.message}${l.details ? "\n" + l.details : ""}`)
      .join("\n");
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore
    }
  }

  return (
    <div className="border-t border-zinc-800 bg-zinc-950 max-h-[40%] flex flex-col">
      <div className="flex items-center gap-2 p-2 border-b border-zinc-800 text-xs">
        <span className="text-zinc-300 font-medium">日志（{logs.length}）</span>
        <button onClick={copy} className="px-2 py-0.5 bg-zinc-700 rounded text-[11px]">
          复制
        </button>
        <button onClick={clearLogs} className="px-2 py-0.5 bg-zinc-700 rounded text-[11px]">
          清空
        </button>
        <button
          onClick={() => setLogsOpen(false)}
          className="ml-auto px-2 py-0.5 bg-zinc-700 rounded text-[11px]"
        >
          关闭
        </button>
      </div>
      <ol className="overflow-auto p-2 space-y-1 font-mono">
        {logs.length === 0 && <li className="text-zinc-500 text-[11px]">暂无日志</li>}
        {logs.map((l, i) => (
          <li key={i} className="text-[11px] leading-tight">
            <span className="text-zinc-600">{fmt(l.ts)}</span>{" "}
            <span className={colorFor(l.level)}>{l.level}</span>{" "}
            <span className="text-zinc-200 whitespace-pre-wrap">{l.message}</span>
            {l.details && (
              <pre className="mt-1 text-[10px] text-zinc-400 bg-zinc-900 rounded p-1 overflow-auto max-h-32">
                {l.details}
              </pre>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
