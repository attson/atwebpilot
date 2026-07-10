import type { TabEvent } from "../rpc";
import {
  appendSystemNote,
  attachTab,
  markAttachedUrlChanged,
  removeAttachedTab,
  useStore
} from "./session-store";

export function handleTabEvent(ev: TabEvent): void {
  switch (ev.type) {
    case "tabs.spawned": {
      if (ev.openerTabId == null) return;
      const sessions = useStore.getState().sessionsByTab;
      for (const [sidStr, s] of Object.entries(sessions)) {
        const sid = Number(sidStr);
        const owns =
          sid === ev.openerTabId ||
          s.attachedTabs.some((a) => a.tabId === ev.openerTabId);
        if (!owns) continue;
        // Only attribute opener-matched spawns to AI when a tool JUST ran
        // (within the last 1500ms). The prior `status ∈ {running, streaming}`
        // gate was too loose — during a widget/sidepanel run the sidepanel
        // saw broadcast status="streaming" even while the AI was quiescent
        // between rounds, so a user Ctrl+click on the page got misattributed.
        //
        // AI's `openTab` tool uses `chrome.tabs.create` (no opener). The only
        // AI-caused spawn with openerTabId is a `click` tool hitting a
        // target=_blank link — which fires within milliseconds of tool_running.
        const now = Date.now();
        const recentAi =
          s._lastToolRunningAt != null && now - s._lastToolRunningAt < 1500;
        if (!recentAi) continue;
        attachTab(sid, {
          tabId: ev.tabId,
          windowId: ev.windowId,
          source: "ai-open",
          lastSeenUrl: ev.url,
          lastSeenTitle: ev.title
        });
        appendSystemNote(sid, `🆕 AI 在 #${ev.tabId} 打开了 ${truncate(ev.url, 80)}`);
      }
      return;
    }
    case "tabs.urlChanged": {
      const sessions = useStore.getState().sessionsByTab;
      for (const [sidStr, s] of Object.entries(sessions)) {
        const sid = Number(sidStr);
        if (s.attachedTabs.some((a) => a.tabId === ev.tabId)) {
          markAttachedUrlChanged(sid, ev.tabId, ev.newUrl, ev.newTitle);
        }
      }
      return;
    }
    case "tabs.removed": {
      const sessions = useStore.getState().sessionsByTab;
      for (const [sidStr, s] of Object.entries(sessions)) {
        const sid = Number(sidStr);
        if (s.attachedTabs.some((a) => a.tabId === ev.tabId)) {
          appendSystemNote(sid, `🗑 Tab #${ev.tabId} 已关闭`);
        }
      }
      removeAttachedTab(ev.tabId);
      return;
    }
  }
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
