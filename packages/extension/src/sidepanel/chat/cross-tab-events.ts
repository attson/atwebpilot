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
        // Only attribute opener-matched spawns to AI when the session is
        // actively running. Otherwise the user opened the tab manually
        // (Ctrl/middle/right-click on a link in the session tab), and
        // chrome.tabs.create from the openTab tool doesn't set openerTabId.
        if (s.status !== "running" && s.status !== "streaming") continue;
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
