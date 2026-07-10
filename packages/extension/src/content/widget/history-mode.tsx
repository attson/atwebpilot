import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import {
  listArchivedByUrl, restoreArchived,
} from "@/sidepanel/chat/persistence/sessions-storage";

type ArchivedRow = {
  id: string;
  url: string;
  updatedAt: number;
  messageCount: number;
  stepCount: number;
  status: string;
  title: string;
};

type Props = {
  url: string;
  tabId: number;
  onBack: () => void;
};

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + "…";
}

function relativeTime(ts: number): string {
  const diffMs = Date.now() - ts;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return `${diffSec}s 前`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m 前`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h 前`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d 前`;
}

export function HistoryMode({ url, tabId, onBack }: Props) {
  const [rows, setRows] = useState<ArchivedRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    listArchivedByUrl(url).then((list) => {
      if (cancelled) return;
      const mapped: ArchivedRow[] = list.map((s) => {
        const data = (s.data ?? {}) as { messages?: any[]; executedSteps?: any[]; status?: string };
        const msgs = data.messages ?? [];
        const firstUser = msgs.find((m: any) => m.role === "user");
        const firstText = typeof firstUser?.content === "string"
          ? firstUser.content
          : (firstUser?.content?.find?.((p: any) => p.type === "text")?.text ?? "");
        return {
          id: s.id,
          url: s.url,
          updatedAt: s.updatedAt ?? s.createdAt ?? 0,
          messageCount: msgs.length,
          stepCount: (data.executedSteps ?? []).length,
          status: data.status ?? "unknown",
          title: firstText ? truncate(firstText, 30) : "(无标题)",
        };
      }).sort((a, b) => b.updatedAt - a.updatedAt);
      setRows(mapped);
    }).catch(() => setRows([]));
    return () => { cancelled = true; };
  }, [url]);

  async function onRestore(id: string) {
    await restoreArchived(id, tabId);
    onBack();
  }

  return (
    <div
      data-testid="widget-history-mode"
      className="flex flex-col h-full overflow-hidden"
    >
      <div className="px-3 py-2 border-b border-zinc-800 flex items-center gap-2 text-xs text-zinc-400">
        <Clock size={12} />
        <span>本 URL 历史对话({rows?.length ?? "…"})</span>
      </div>
      <div className="flex-1 overflow-auto p-2 space-y-2">
        {rows == null && <div className="text-zinc-500 text-[11px] text-center pt-4">加载中…</div>}
        {rows && rows.length === 0 && (
          <div className="text-zinc-500 text-[11px] text-center pt-4">此 URL 无历史会话</div>
        )}
        {rows?.map((r) => (
          <button
            key={r.id}
            data-testid="widget-history-row"
            className="w-full text-left px-3 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded"
            onClick={() => void onRestore(r.id)}
          >
            <div className="text-zinc-200 text-[12px] font-medium truncate">{r.title}</div>
            <div className="text-zinc-500 text-[10px] mt-0.5">
              {r.messageCount} 条消息 · {r.stepCount} 步 · {r.status} · {relativeTime(r.updatedAt)}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
