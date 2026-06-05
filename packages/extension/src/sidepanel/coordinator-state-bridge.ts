import { useStore } from "@/sidepanel/chat/session-store";

interface PingPayload {
  type: "ping.sidepanelState";
  req_id: string;
  tab_id: string;
}

interface SnapshotPayload {
  status: string;
  messagesCount: number;
  attachedTabs: Array<{ tabId: number; source: string; lastSeenUrl: string }>;
  lastSystemNote?: string;
}

interface PongPayload {
  type: "pong.sidepanelState";
  req_id: string;
  found: boolean;
  snapshot?: SnapshotPayload;
}

function isPing(raw: unknown): raw is PingPayload {
  if (typeof raw !== "object" || raw === null) return false;
  const m = raw as Record<string, unknown>;
  return m.type === "ping.sidepanelState"
    && typeof m.req_id === "string"
    && typeof m.tab_id === "string";
}

function findLastSystemNote(messages: Array<{ role: string; content: unknown }>): string | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== "user") continue;
    if (typeof m.content !== "string") continue;
    // System notes are user-role messages starting with an emoji/marker per session-store conventions.
    if (m.content.startsWith("🆕") || m.content.startsWith("🗑")) return m.content;
  }
  return undefined;
}

export function handleSidepanelStatePing(raw: unknown): PongPayload | null {
  if (!isPing(raw)) return null;
  const tabId = Number.parseInt(raw.tab_id, 10);
  const session = useStore.getState().sessionsByTab[tabId];
  if (!session) {
    return { type: "pong.sidepanelState", req_id: raw.req_id, found: false };
  }
  return {
    type: "pong.sidepanelState",
    req_id: raw.req_id,
    found: true,
    snapshot: {
      status: session.status,
      messagesCount: session.messages.length,
      attachedTabs: session.attachedTabs.map((a) => ({
        tabId: a.tabId, source: a.source, lastSeenUrl: a.lastSeenUrl
      })),
      ...(((): { lastSystemNote?: string } => {
        const note = findLastSystemNote(session.messages as never);
        return note != null ? { lastSystemNote: note } : {};
      })())
    }
  };
}

export function mountSidepanelStateBridge(): () => void {
  const listener = (msg: unknown): void => {
    const pong = handleSidepanelStatePing(msg);
    if (!pong) return;
    void chrome.runtime.sendMessage(pong);
  };
  chrome.runtime.onMessage.addListener(listener);
  return () => chrome.runtime.onMessage.removeListener(listener);
}
