import { X, AlertTriangle } from "lucide-react";
import { setError } from "@/sidepanel/chat/session-store";
import type { SessionData } from "@/sidepanel/chat/session-store";

type Props = { session: SessionData; tabId: number };

export function ErrorBanner({ session, tabId }: Props) {
  if (!session.errorMessage) return null;
  return (
    <div
      data-testid="widget-error-banner"
      className="px-3 py-1.5 bg-red-950 border-b border-red-900 text-[11px] text-red-200 flex items-start gap-2 shrink-0"
    >
      <AlertTriangle size={12} className="shrink-0 mt-0.5" />
      <span className="flex-1 break-words">{session.errorMessage}</span>
      <button
        aria-label="关闭错误提示"
        className="shrink-0 hover:text-red-100"
        onClick={() => setError(tabId, null)}
      >
        <X size={12} />
      </button>
    </div>
  );
}
